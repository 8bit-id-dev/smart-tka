import { useCallback, useEffect, useRef, useState } from 'react';
import { ItemPlayer } from '../components/ItemPlayer';
import { insforge } from '../lib/insforge';
import { acakListSeeded, acakOpsiSeeded, type DbItem } from '../lib/soal';
import { toggleBookmark, isBookmarked } from '../lib/bookmarks';
import { Icons } from '../AppShell';

function friendlyAttemptError(msg: string | undefined): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('attempts_one_active') || m.includes('violates')) {
    return 'Sesi ujian sudah berjalan. Silakan klik Mulai lagi.';
  }
  if (m.includes('profil tidak dikenal') || m.includes('token sesi kosong')) {
    return 'Sesi tidak dikenali. Silakan login kembali, lalu klik Mulai.';
  }
  return msg || 'Gagal memulai simulasi.';
}


type Pkg = {
  id: string;
  title: string;
  kind: string;
  mapel: string;
  materi?: string | null;
  info?: string | null;
  item_count: number;
  duration_sec: number | null;
  discuss_after_each: boolean;
  shuffle?: boolean;
  use_ai_selection?: boolean;
  jumlah_soal_soal?: number | null;
  ai_config?: Record<string, unknown> | null;
};

type Ans = { answer: string; correct: boolean };

type ExamSchedule = {
  id: string;
  package_id: string;
  title: string | null;
  subject: string;
  materi: string | null;
  duration_sec: number | null;
  info: string | null;
  start_at: string;
  end_at: string;
  token: string | null;
  is_active: boolean;
};

type Identity = { name: string; kelas: string; nisn: string; token: string };

const CHEAT_THRESHOLD = 5;
const CHEAT_WARNING_THRESHOLDS = [1, 2, 3, 4];

export function Simulasi({ schoolId, studentId, onImmersiveChange, preSelectPackageId }: { schoolId: string | null; studentId?: string; onImmersiveChange?: (v: boolean) => void; preSelectPackageId?: string }) {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [items, setItems] = useState<DbItem[]>([]);
  const [i, setI] = useState(0);
  const [sisa, setSisa] = useState(0);
  const [phase, setPhase] = useState<'list' | 'landing' | 'run' | 'hasil'>('list');
  const [err, setErr] = useState('');
  const [ans, setAns] = useState<Record<string, Ans>>({});
  const [doubted, setDoubted] = useState<Set<string>>(new Set());
  const [skor, setSkor] = useState<number | null>(null);
  const [listExpanded, setListExpanded] = useState(false);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [subTab, setSubTab] = useState<'latihan' | 'ujian'>('latihan');
  const runStartedAtRef = useRef<number>(0);
  const pendingAnsRef = useRef<Record<string, Ans>>({});
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamSchedule | null>(null);
  const [identity, setIdentity] = useState<Identity>({ name: '', kelas: '', nisn: '', token: '' });
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Anti-cheat / fullscreen state
  const [tabLeaveCount, setTabLeaveCount] = useState(0);
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cheatWarnedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    onImmersiveChange?.(phase === 'run');
  }, [phase, onImmersiveChange]);

  const loadList = useCallback(
    async () => {
      let q = insforge.database
        .from('packages')
        .select('id, title, kind, mapel, info, materi, item_count, duration_sec, discuss_after_each, shuffle, use_ai_selection, jumlah_soal_soal');
      if (schoolId) q = q.eq('school_id', schoolId);
      const { data, error } = await q;
      if (error) setErr(error.message);
      else setPkgs((data || []) as Pkg[]);

      const { data: schData } = await insforge.database
        .from('exam_schedules')
        .select('id, package_id, title, subject, materi, duration_sec, info, start_at, end_at, token, is_active')
        .eq('is_active', true)
        .gte('end_at', new Date().toISOString())
        .lt('start_at', new Date(Date.now() + 24 * 3600 * 1000).toISOString())
        .order('start_at', { ascending: true });
      if (schData) setSchedules((schData || []) as ExamSchedule[]);
    },
    [schoolId],
  );

  useEffect(() => {
    void loadList();
    const onFocus = () => {
      void loadList();
    };
    window.addEventListener('focus', onFocus);
    const t = setInterval(() => {
      void loadList();
    }, 60000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(t);
    };
  }, [loadList]);

  // Auto-select package if preSelectPackageId is provided
  useEffect(() => {
    if (!preSelectPackageId || phase !== 'list' || pkgs.length === 0) return;
    const pkgToStart = pkgs.find((p) => p.id === preSelectPackageId);
    if (pkgToStart) {
      void mulai(pkgToStart);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectPackageId, phase, pkgs]);

  /* Countdown timer for the run phase.
   * The interval is always created; the "armed" guard only protects the
   * auto-submit call so a freshly started exam is never submitted instantly. */
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (phase !== 'run' || !pkg || items.length === 0) return;

    const t = setInterval(() => {
      setSisa((s) => {
        if (s <= 1) {
          // Guard: never auto-submit within the first 5 seconds of the run.
          if (Date.now() - runStartedAtRef.current < 5000) return 1;
          clearInterval(t);
          void kumpulkan();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [phase, pkg, items.length]);
  /* eslint-enable react-hooks/exhaustive-deps */

  /* Answers can be given before syncAttempt() resolves the attempt row, so
   * keep them in a pending queue and flush it as soon as attemptId is known.
   * Without this, everything answered in the first moments of the exam is lost
   * on reload even though it looked answered on screen. */
  useEffect(() => {
    if (phase !== 'run' || !attemptId || !studentId) return;
    const queue = pendingAnsRef.current;
    const ids = Object.keys(queue);
    if (ids.length === 0) return;

    const rows = ids.map((itemId) => ({
      attempt_id: attemptId,
      item_id: itemId,
      answer: queue[itemId].answer,
      is_correct: queue[itemId].correct,
      locked_at: new Date().toISOString(),
    }));

    void insforge.database
      .from('attempt_answers')
      .upsert(rows, { onConflict: 'attempt_id,item_id' })
      .then(({ error }) => {
        if (error) return;
        ids.forEach((itemId) => {
          if (pendingAnsRef.current[itemId] === queue[itemId]) delete pendingAnsRef.current[itemId];
        });
      });
  }, [phase, attemptId, studentId]);

  /* Local crash-recovery draft so a refresh mid-exam keeps the answers even
   * before the database round-trip completes. */
  useEffect(() => {
    if (phase !== 'run' || !pkg?.id) return;
    try {
      sessionStorage.setItem(
        `sim-${pkg.id}-draft`,
        JSON.stringify({ ans, i, endsAt: Date.now() + sisa * 1000 }),
      );
    } catch { /* storage full / private mode — non-fatal */ }
  }, [phase, pkg?.id, ans, i, sisa]);

  /* Fullscreen & Anti-cheat for run phase */
  useEffect(() => {
    if (phase !== 'run') {
      // Exit fullscreen when leaving run phase
      if (isFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
      setTabLeaveCount(0);
      cheatWarnedRef.current.clear();
      setShowCheatWarning(false);
      return;
    }

    // Detect mobile (Android WebView doesn't support fullscreen API reliably)
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroidWebView = isMobile && /wv|Android.*Version/i.test(navigator.userAgent);

    // Request fullscreen on desktop / non-WebView mobile
    const enterFullscreen = async () => {
      if (isAndroidWebView) {
        // Android WebView: skip fullscreen, just warn on visibility change
        return;
      }
      try {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        setIsFullscreen(true);
      } catch (e) {
        console.warn('[Simulasi] Fullscreen request failed:', e);
        // Don't block exam if fullscreen fails
        setIsFullscreen(false);
      }
    };

    // Handle visibility change (tab switch, minimize, etc.)
    const onVisibilityChange = () => {
      if (document.hidden) {
        handleTabLeave();
      }
    };

    // Handle blur (window focus lost)
    const onBlur = () => {
      if (!isAndroidWebView) {
        handleTabLeave();
      }
    };

    // Handle fullscreen change (user exited fullscreen manually)
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        handleTabLeave();
      } else if (document.fullscreenElement) {
        setIsFullscreen(true);
      }
    };

    const handleTabLeave = () => {
      setTabLeaveCount((prev) => {
        const next = prev + 1;
        persistTabLeaveCount(next);
        
        // Show warning at thresholds 1, 2
        if (CHEAT_WARNING_THRESHOLDS.includes(next) && !cheatWarnedRef.current.has(next)) {
          cheatWarnedRef.current.add(next);
          setShowCheatWarning(true);
        }
        
        // Auto-submit at threshold 3
        if (next >= CHEAT_THRESHOLD) {
          autoSubmitForCheating();
        }
        
        return next;
      });
    };

    // Beforeunload warning - prevent accidental navigation away during exam
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const msg = 'Ujian sedang berlangsung. Yakin ingin keluar? Progres Anda bisa hilang.';
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    };

    const persistTabLeaveCount = async (count: number) => {
      if (!attemptId || !studentId) return;
      try {
        await insforge.database
          .from('attempts')
          .update({ tab_leave_count: count })
          .eq('id', attemptId);
      } catch (e) {
        console.warn('[Simulasi] Failed to persist tab_leave_count:', e);
      }
    };

    const autoSubmitForCheating = async () => {
      if (!attemptId || !studentId) return;
      try {
        await insforge.database
          .from('attempts')
          .update({ 
            status: 'submitted', 
            submitted_at: new Date().toISOString(),
            tab_leave_count: tabLeaveCount + 1 
          })
          .eq('id', attemptId);
      } catch (e) {
        console.warn('[Simulasi] Auto-submit failed:', e);
      }
      setShowCheatWarning(false);
      setPhase('hasil');
    };

    // Enter fullscreen immediately
    enterFullscreen();

    // Attach listeners
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      
      // Exit fullscreen on cleanup
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [phase, attemptId, studentId, isFullscreen, tabLeaveCount]);

async function doMulai(p: Pkg, exam?: ExamSchedule) {
    setAns({});
    setSkor(null);
    pendingAnsRef.current = {};
    let ids: string[] = [];
    let payloadItems: DbItem[] | null = null;
    let attemptIdNew: string | null = null;
    let endsAtMs: number | null = null;

    if (p.id) sessionStorage.removeItem(`sim-${p.id}-draft`);

    if (p.use_ai_selection) {
      const token = identity.token || `${studentId || 'anon'}_${p.id}`;
      const { data, error } = await insforge.database.rpc('smart_attempt_start', {
        p_package_id: p.id,
        p_token: token,
        p_student_id: studentId,
      });
      if (error) {
        // One-active-attempt deadlock: a previous session is still in_progress.
        // Resume it instead of blocking the student permanently.
        const resumed = await resumeExisting(p);
        if (!resumed) {
          setErr(selectedExam ? 'Sesi ujian tidak dapat dilanjutkan.' : friendlyAttemptError(error.message));
          return;
        }
        ids = resumed.ids;
        attemptIdNew = resumed.attemptId;
        endsAtMs = null;
      } else {
        const res = (data || {}) as {
          ok: boolean;
          error?: string;
          items?: DbItem[];
          attempt_id?: string;
          ends_at?: string;
        };
        if (!res.ok) {
          setErr(friendlyAttemptError(res.error));
          return;
        }
        payloadItems = (res.items || []) as DbItem[];
        ids = payloadItems.map((x) => x.id);
        attemptIdNew = res.attempt_id || null;
        endsAtMs = res.ends_at ? Date.parse(res.ends_at) : null;
        if (ids.length === 0) {
          setErr('Paket belum berisi soal.');
          return;
        }
      }
    } else {
      const { data: links, error } = await insforge.database.from('package_items').select('item_id, position').eq('package_id', p.id);
      if (error) {
        setErr(error.message);
        return;
      }
      ids = ((links || []) as { item_id: string; position: number }[]).sort((a, b) => a.position - b.position).map((x) => x.item_id);
      if (ids.length === 0) {
        setErr('Paket belum berisi soal.');
        return;
      }
    }

    // Load full item fields. For AI packages the RPC already returns items, so the
    // re-fetch below is only a best-effort enrichment: school-scoped items can be
    // blocked by RLS, and in that case we fall back to the RPC payload so the
    // student can still start the session instead of being stuck on the list page.
    let ordered: DbItem[];
    if (payloadItems && payloadItems.length > 0) {
      try {
        const { data: its } = await insforge.database
          .from('items')
          .select('id, item_type, mapel, materi, stem, stimulus, choices, correct_key, rationale, jenjang, difficulty')
          .in('id', ids);
        const map = new Map(((its || []) as DbItem[]).map((x) => [x.id, x]));
        ordered = ids.map((id) => map.get(id)).filter(Boolean) as DbItem[];
        if (ordered.length < payloadItems.length) ordered = payloadItems;
      } catch {
        ordered = payloadItems;
      }
    } else {
      const { data: its, error: e2 } = await insforge.database
        .from('items')
        .select('id, item_type, mapel, materi, stem, stimulus, choices, correct_key, rationale, jenjang, difficulty')
        .in('id', ids);
      if (e2) {
        setErr(e2.message);
        return;
      }
      const map = new Map(((its || []) as DbItem[]).map((x) => [x.id, x]));
      ordered = ids.map((id) => map.get(id)).filter(Boolean) as DbItem[];
    }
    if (ordered.length === 0) {
      setErr('Paket belum berisi soal.');
      return;
    }
    // Deterministic shuffle/selection so resume reproduces the exact same layout (+ answers map by item_id).
    const seed = `${studentId ?? 'anon'}_${p.id}`;
    if (p.use_ai_selection && p.jumlah_soal_soal && p.jumlah_soal_soal > 0 && p.jumlah_soal_soal < ordered.length) {
      const detail = p.ai_config?.detail as Record<string, Record<string, Record<number, number>>> | undefined;
      if (detail) {
        // AI picks a per-student deterministic subset honoring materi x jenis soal x tingkat kesulitan.
        let chosen: DbItem[] = [];
        for (const [m, types] of Object.entries(detail)) {
          for (const [t, diffs] of Object.entries(types)) {
            for (const [d, n] of Object.entries(diffs)) {
              if (!Number(n)) continue;
              const pool = ordered.filter((it) => it.materi === m && it.item_type === t && Number(it.difficulty) === Number(d));
              chosen = chosen.concat(acakListSeeded(pool, `${seed}:${m}:${t}:${d}`).slice(0, Number(n)));
            }
          }
        }
        ordered = chosen.length ? chosen : acakListSeeded(ordered, `${seed}:sel`).slice(0, p.jumlah_soal_soal);
      } else {
        ordered = acakListSeeded(ordered, `${seed}:sel`).slice(0, p.jumlah_soal_soal);
      }
    }
    if (p.shuffle) ordered = acakListSeeded(ordered, `${seed}:sh`);
    const shuffled = ordered.map((it) => acakOpsiSeeded(it, `${seed}:${it.id}`));
    setItems(shuffled);
    setPkg(p);
    setI(0);
    setAttemptId(attemptIdNew || attemptId);
    setSisa(
      endsAtMs
        ? Math.round(Math.max(0, endsAtMs - Date.now()) / 1000)
        : (exam && exam.duration_sec && exam.duration_sec > 0)
          ? exam.duration_sec
          : p.duration_sec && p.duration_sec > 0
            ? p.duration_sec
            : 15 * 60,
    );
    const saved = new Set<string>();
    shuffled.forEach((it) => {
      if (isBookmarked(studentId, it.id)) saved.add(it.id);
    });
    setBookmarked(saved);
    setListExpanded(false);
    runStartedAtRef.current = Date.now();
    setPhase('run');
    const draft = sessionStorage.getItem(`sim-${p.id}-draft`);
    if (draft) {
      try {
        const d = JSON.parse(draft) as { ans?: Record<string, Ans>; i?: number; endsAt?: number };
        if (d.ans) setAns(d.ans);
        if (typeof d.i === 'number' && d.i > 0 && d.i < shuffled.length) setI(d.i);
        if (typeof d.endsAt === 'number' && d.endsAt > Date.now()) {
          setSisa(Math.round(Math.max(0, d.endsAt - Date.now()) / 1000));
        }
      } catch { /* noop */ }
    }
    if (studentId) {
      void syncAttempt(p, exam ?? null, shuffled);
    }
  }

  /* Resume an existing in_progress session (used when smart_attempt_start rejects
   * because of the one-active-attempt constraint). The AI item selection is
   * deterministic per student (seeded by studentId + packageId), so reconstructing
   * from the full package item list reproduces the exact same question set; answers
   * are restored afterwards by syncAttempt from attempt_answers. */
  async function resumeExisting(p: Pkg): Promise<{ attemptId: string; ids: string[] } | null> {
    if (!studentId) return null;
    const { data: ex, error } = await insforge.database
      .from('attempts')
      .select('id')
      .eq('student_id', studentId)
      .eq('package_id', p.id)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !ex?.id) return null;

    if (selectedExam) {
      const { data: allowed } = await insforge.database.rpc('exam_resume_allowed', { p_attempt_id: ex.id });
      if (!allowed) return null;
    }

    const { data: links } = await insforge.database
      .from('package_items')
      .select('item_id, position')
      .eq('package_id', p.id);
    const rows = (links || []) as { item_id: string; position: number }[];
    if (rows.length === 0) return null;
    return { attemptId: ex.id as string, ids: rows.sort((a, b) => a.position - b.position).map((x) => x.item_id) };
  }

  async function mulai(p: Pkg, exam?: ExamSchedule) {
    setErr('');
    setStarting(true);
    try {
      await doMulai(p, exam);
    } catch (e) {
      console.error('mulai gagal:', e);
      setErr(e instanceof Error ? e.message : 'Terjadi kesalahan saat memulai. Coba lagi.');
    } finally {
      setStarting(false);
    }
  }

  /* Persist attempt + enable crash recovery.
   * Anti-cheat: for scheduled exams we only resume a previous attempt if
   * exam_resume_allowed() returns true (status still in_progress and the
   * schedule window is still open). A submitted / exited attempt is never
   * resumed, so a user cannot re-enter an already finished exam. */
  async function syncAttempt(p: Pkg, exam: ExamSchedule | null, shuffled: DbItem[]) {
    const examId: string | null = exam?.id ?? null;
    let attempt: { id: string } | null = null;

    if (examId && studentId) {
      const { data: ex, error: exErr } = await insforge.database
        .from('attempts')
        .select('id')
        .eq('student_id', studentId)
        .eq('scheduled_exam_id', examId)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!exErr && ex?.id) {
        const { data: allowed } = await insforge.database.rpc('exam_resume_allowed', { p_attempt_id: ex.id });
        if (allowed) {
          attempt = { id: ex.id as string };
        } else {
          // An in_progress attempt exists but the schedule window is closed (or it expired):
          // the exam cannot be started again.
          setErr('Ujian sudah tidak dapat dilanjutkan: jadwal sudah tutup.');
          return;
        }
      }
    } else if (studentId) {
      // Check if an in_progress attempt already exists for this package
      const { data: ex } = await insforge.database
        .from('attempts')
        .select('id')
        .eq('student_id', studentId)
        .eq('package_id', p.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ex?.id) {
        attempt = { id: ex.id as string };
      }
    }

    if (!attempt) {
      const { data: ins, error: insErr } = await insforge.database
        .from('attempts')
        .insert({
          package_id: p.id,
          student_id: studentId,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          scheduled_exam_id: examId,
        })
        .select('id');
      if (insErr) {
        // Unique violation (23505) => another tab/session already created the in_progress attempt; retrieve and resume it.
        if (studentId) {
          const { data: ex2 } = await insforge.database
            .from('attempts')
            .select('id')
            .eq('student_id', studentId)
            .eq('package_id', p.id)
            .eq('status', 'in_progress')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (ex2?.id) attempt = { id: ex2.id as string };
        }
        if (!attempt) {
          setErr(friendlyAttemptError(insErr.message));
          return;
        }
      } else {
        if (!ins?.[0]?.id) { setErr('Gagal membuat sesi ujian.'); return; }
        attempt = { id: ins[0].id as string };
      }
    }
    setAttemptId(attempt.id);

    const { data: savedAns } = await insforge.database
      .from('attempt_answers')
      .select('item_id, answer, is_correct')
      .eq('attempt_id', attempt.id);
    if (savedAns && savedAns.length > 0) {
      const restored: Record<string, Ans> = {};
      const answeredIds: string[] = [];
      shuffled.forEach((it) => {
        const match = (savedAns as any[]).find((a) => a.item_id === it.id);
        if (match) {
          restored[it.id] = { answer: match.answer || '', correct: !!match.is_correct };
          answeredIds.push(it.id);
        }
      });
      setAns(restored);
      if (answeredIds.length > 0 && answeredIds.length < shuffled.length) {
        const answered = new Set(answeredIds);
        const firstUn = shuffled.findIndex((it) => !answered.has(it.id));
        if (firstUn >= 0) setI(firstUn);
      }
    }
  }

  async function kumpulkan() {
    if (phase === 'hasil') return;
    // Guard: prevent accidental early submit (min 5 seconds after start, or attemptId exists)
    if (Date.now() - runStartedAtRef.current < 5000 && !attemptId) return;
    // Guard: prevent submit if items not loaded
    if (!pkg || items.length === 0) return;

    document.body.style.userSelect = 'normal';
    document.onselectstart = null;
    document.oncontextmenu = null;
    document.onkeydown = null;

    const benar = items.filter((it) => ans[it.id]?.correct).length;
    const nilai = Math.round((benar / items.length) * 10000) / 100;
    setSkor(nilai);
    setPhase('hasil');
    if (pkg && pkg.id) sessionStorage.removeItem(`sim-${pkg.id}-draft`);

    if (!studentId) return;

    let aid = attemptId;
    if (!aid) {
      const { data, error } = await insforge.database
        .from('attempts')
        .insert({
          package_id: pkg.id,
          student_id: studentId,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          scheduled_exam_id: selectedExam?.id ?? null,
        })
        .select('id');
      if (error) {
        setErr(friendlyAttemptError(error.message));
        return;
      }
      aid = (data?.[0] as { id?: string } | undefined)?.id ?? null;
    }
    if (!aid) return;

    const rows = items.map((it) => ({
      attempt_id: aid,
      item_id: it.id,
      answer: ans[it.id]?.answer || '',
      is_correct: !!ans[it.id]?.correct,
      locked_at: new Date().toISOString(),
    }));
    await insforge.database.from('attempt_answers').upsert(rows, { onConflict: 'attempt_id,item_id' });

    await insforge.database
      .from('attempts')
      .update({ status: 'submitted', submitted_at: new Date().toISOString(), score: nilai })
      .eq('id', aid);
    setAttemptId(null);

    const xpEarned = Math.round(nilai * 2) + 20;
    if (xpEarned > 0) {
      try {
        await insforge.database.rpc('award_xp', { p_profile: studentId, p_xp: xpEarned });
      } catch {
        /* XP award best-effort */
      }
    }
  }

  const mm = String(Math.floor(sisa / 60)).padStart(2, '0');
  const ss = String(sisa % 60).padStart(2, '0');

  if (phase === 'landing' && pkg) {
    const isUjian = selectedExam !== null;
    const durSrc = (selectedExam && selectedExam.duration_sec && selectedExam.duration_sec > 0) ? selectedExam.duration_sec : pkg.duration_sec;
    const durMin = durSrc ? Math.round(durSrc / 60) : 15;
    const invalidToken = isUjian && !!selectedExam?.token && identity.token !== selectedExam.token;
    return (
      <div className="dashboard-page">
        <header className="page-header" style={{ marginBottom: 20 }}>
          <p className="page-subtitle">Identitas Peserta · {isUjian ? 'Ujian Terjadwal' : 'Latihan'}</p>
          <h1 className="page-title">{pkg.title}</h1>
        </header>
        <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>Nama</label>
              <input type="text" value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} placeholder="Nama lengkap" style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--outline)', background: 'var(--card)', color: 'var(--ink)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>Kelas</label>
              <input type="text" value={identity.kelas} onChange={(e) => setIdentity({ ...identity, kelas: e.target.value })} placeholder="Mis. 12 IPA 1" style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--outline)', background: 'var(--card)', color: 'var(--ink)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>NISN</label>
              <input type="text" value={identity.nisn} onChange={(e) => setIdentity({ ...identity, nisn: e.target.value })} placeholder="Nomor Induk Siswa Nasional" style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--outline)', background: 'var(--card)', color: 'var(--ink)' }} />
            </div>
            {isUjian && selectedExam?.token && (
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>Token Ujian</label>
                <input type="password" value={identity.token} onChange={(e) => setIdentity({ ...identity, token: e.target.value })} placeholder="Masukkan token" style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--outline)', background: 'var(--card)', color: 'var(--ink)' }} />
                {invalidToken && <p style={{ color: 'var(--warn)', fontSize: 11, marginTop: 4 }}>Token salah</p>}
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--outline)', paddingTop: 14, marginTop: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 4px' }}>Informasi {isUjian ? 'Ujian' : 'Paket'}</p>
              <p style={{ margin: '2px 0', fontSize: 13 }}><b>Nama paket:</b> {pkg.title}</p>
              <p style={{ margin: '2px 0', fontSize: 13 }}><b>Mata pelajaran:</b> {pkg.mapel}</p>
              <p style={{ margin: '2px 0', fontSize: 13 }}><b>Materi:</b> {selectedExam?.materi || pkg.mapel}</p>
              <p style={{ margin: '2px 0', fontSize: 13 }}><b>Durasi:</b> {durMin} menit</p>
              {pkg.info && <p style={{ margin: '2px 0', fontSize: 13, lineHeight: 1.4 }}><b>Info paket:</b> {pkg.info}</p>}
              {selectedExam?.info && <p style={{ margin: '2px 0', fontSize: 13, lineHeight: 1.4 }}><b>Info ujian:</b> {selectedExam.info}</p>}
            </div>
            {err && <p style={{ color: 'var(--warn)', fontSize: 12 }}>{err}</p>}
            <button
              type="button"
              className="continue-btn"
              disabled={starting || Boolean(!identity.name || !identity.kelas || !identity.nisn || (isUjian && selectedExam?.token && !identity.token))}
              onClick={async () => {
                setErr('');
                if (!identity.name || !identity.kelas || !identity.nisn) { setErr('Nama, Kelas, dan NISN wajib diisi.'); return; }
                if (isUjian && selectedExam?.token && !identity.token) { setErr('Token ujian wajib.'); return; }
                if (invalidToken) { setErr('Token ujian salah.'); return; }
                await mulai(pkg, selectedExam || undefined);
              }}
            >
              {starting ? 'Memuat…' : `Mulai ${isUjian ? 'Ujian' : 'Latihan'}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'list') {
    return (
      <div className="dashboard-page">
        <header className="page-header" style={{ marginBottom: 20 }}>
          <p className="page-subtitle">Latihan bebas atau ujian terjadwal</p>
          <h1 className="page-title">Simulasi &amp; Ujian TKA</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className={subTab === 'latihan' ? 'seg-active' : 'seg'} onClick={() => setSubTab('latihan')}>Latihan</button>
            <button type="button" className={subTab === 'ujian' ? 'seg-active' : 'seg'} onClick={() => setSubTab('ujian')}>Ujian</button>
          </div>
        </header>
        {err && (
          <div className="banner banner-danger" style={{ marginBottom: 16 }}>
            <p className="banner-text">{err}</p>
          </div>
        )}
        {subTab === 'latihan' && (
          <>
            {pkgs.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <h3 className="empty-state-title">Belum ada paket</h3>
                <p className="empty-state-text">Guru membuat paket di menu Paket.</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pkgs.map((p) => (
                <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 650 }}>{p.title}</h3>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                      {p.kind} · {p.mapel} · {p.item_count} soal · {p.discuss_after_each ? 'Pembahasan langsung' : 'Kunci setelah selesai'}
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <span className="badge badge-info">{p.kind}</span>
                      <span className="badge badge-neutral">{p.mapel}</span>
                      <span className="badge badge-neutral">{p.item_count} soal</span>
                      {p.duration_sec && <span className="badge badge-neutral">{Math.floor(p.duration_sec / 60)} mnt</span>}
                      {p.use_ai_selection && p.jumlah_soal_soal && (
                        <span className="badge badge-neutral">AI: {p.jumlah_soal_soal}/siswa</span>
                      )}
                    </div>
                  </div>
                  <button className="continue-btn" type="button" disabled={starting} onClick={() => mulai(p)}>{starting ? 'Memuat…' : 'Mulai Simulasi'}</button>
                </div>
              ))}
            </div>
          </>
        )}
        {subTab === 'ujian' && (
          <>
            {schedules.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <h3 className="empty-state-title">Belum ada ujian terjadwal</h3>
                <p className="empty-state-text">Ujian hanya bisa dikerjakan pada jadwal yang ditentukan.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {schedules.map((s) => {
                  const pkgForExam = pkgs.find((p) => p.id === s.package_id);
                  const now = new Date();
                  const active = new Date(s.start_at) <= now && new Date(s.end_at) >= now;
                  return (
                    <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', opacity: active ? 1 : 0.6 }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 650 }}>{s.title || pkgForExam?.title || 'Ujian'}</h3>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                          {pkgForExam?.mapel || s.subject} · {s.materi || '-'} · {s.duration_sec ? Math.floor(s.duration_sec / 60) + ' mnt' : '-'}
                        </p>
                        <p style={{ margin: '2px 0', fontSize: 12, color: 'var(--muted)' }}>
                          {new Date(s.start_at).toLocaleString('id-ID')} - {new Date(s.end_at).toLocaleString('id-ID')}
                        </p>
                        {s.info && <p style={{ margin: '2px 0', fontSize: 12, color: 'var(--muted)' }}>{s.info}</p>}
                        {s.token && <p style={{ margin: '2px 0', fontSize: 12, color: 'var(--muted)' }}>Token diperlukan</p>}
                      </div>
                      <button
                        className="continue-btn"
                        type="button"
                        disabled={!active}
                        onClick={() => {
                          if (!pkgForExam) { setErr('Paket ujian tidak ditemukan.'); return; }
                          setPkg(pkgForExam);
                          setSelectedExam(s);
                          setIdentity({ name: '', kelas: '', nisn: '', token: '' });
                          setErr('');
                          setPhase('landing');
                        }}
                      >
                        {active ? 'Mulai Ujian' : 'Belum dimulai'}
                      </button>
                      </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  }


  if (phase === 'hasil' && pkg) {
    const benar = items.filter((it) => ans[it.id]?.correct).length;
    return (
      <div className="dashboard-page">
        <section className="card" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: '32px 24px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Selesai: {pkg.title}</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 20px' }}>Skor internal SMART-TKA, bukan prediksi TKA resmi.</p>
          <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1, margin: '0 0 8px' }}>
            {skor ?? 0}<small style={{ fontSize: 22, fontWeight: 500, color: 'var(--muted)' }}>/100</small>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 24px' }}>{benar}/{items.length} benar</p>
          {err && <p style={{ color: 'var(--warn)', fontSize: 13, margin: '0 0 16px' }}>{err}</p>}
          <div className="btn-group" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" type="button" onClick={() => setPhase('list')}>Daftar Paket</button>
          </div>
        </section>

        {items.length > 0 && (
          <section style={{ maxWidth: 960, margin: '0 auto', padding: '0 12px 24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Pembahasan Soal</h3>
            {items.map((it, idx) => {
              const myAns = ans[it.id];
              const status = myAns?.correct === true ? 'benar' : myAns ? 'salah' : 'belum';
              return (
                <div key={it.id} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <strong style={{ fontSize: 14 }}>No {idx + 1} · {it.item_type}</strong>
                    <span className={`badge ${status === 'benar' ? 'badge-success' : status === 'salah' ? 'badge-danger' : 'badge-neutral'}`}>
                      {status === 'benar' ? 'Benar' : status === 'salah' ? 'Salah' : 'Belum'}
                    </span>
                  </div>
                  <ItemPlayer
                    item={it}
                    showBahas
                    hideKeys={false}
                    review
                    answer={myAns?.answer || ''}
                  />
                </div>
              );
            })}
          </section>
        )}
      </div>
    );
  }

  const item = items[i];

  function toggleBookmarkItem(idx: number) {
    const it = items[idx];
    if (!it) return;
    const now = toggleBookmark(studentId, it.id);
    setBookmarked((s) => {
      const next = new Set(s);
      if (now) next.add(it.id);
      else next.delete(it.id);
      return next;
    });
  }

  return (
    <>
      <div className="dashboard-page">
        {/* Compact top nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{pkg?.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="timer-lab" style={{ fontSize: 10 }}>Waktu</div>
          <div className="timer">{mm}:{ss}</div>
          {tabLeaveCount > 0 && (
            <div className="cheat-indicator" style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 999,
              background: 'var(--warn-bg)', color: 'var(--warn)',
              fontSize: 11, fontWeight: 600, fontFamily: 'monospace'
            }}>
              ⚠ {tabLeaveCount}/{CHEAT_THRESHOLD}
            </div>
          )}
          <button
            type="button"
            className="header-icon-btn"
            title={bookmarked.has(item?.id) ? 'Hapus bookmark' : 'Simpan soal'}
            onClick={() => toggleBookmarkItem(i)}
            style={{ padding: 4 }}
          >
            {Icons.bookmark()}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 4, background: 'var(--canvas)', borderRadius: 999, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ width: `${((i + 1) / items.length) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 999, transition: 'width 0.3s ease' }} />
      </div>

      {err && (
        <div className="banner banner-warn" style={{ marginBottom: 16 }}>
          <p className="banner-text">{err}</p>
        </div>
      )}

      {/* Cheat warning modal */}
      {showCheatWarning && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ maxWidth: 400, width: '90%', textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h3 style={{ margin: '0 0 12px', fontSize: 20 }}>Peringatan Anti-Cheat</h3>
            <p style={{ margin: '0 0 20px', color: 'var(--muted)', lineHeight: 1.5 }}>
              Anda telah keluar dari layar ujian <strong>{tabLeaveCount}x</strong>.<br/>
              Keluar lagi <strong>{CHEAT_THRESHOLD - tabLeaveCount}x</strong> akan mengakhiri ujian secara otomatis.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCheatWarning(false)}
              style={{ width: '100%' }}
            >
              Kembali ke Ujian
            </button>
          </div>
        </div>
      )}

      {/* Question list - above card, expandable, 5 columns */}
      <div className="question-list-container">
        <button
          type="button"
          className="question-list-toggle"
          onClick={() => setListExpanded((v) => !v)}
          title={listExpanded ? 'Lipat daftar soal' : 'Buka daftar soal'}
        >
          <span className={`question-list-toggle-icon ${listExpanded ? '' : 'collapsed'}`}>▼</span>
          Daftar Soal
        </button>
        {listExpanded && (
          <div className="question-grid">
            {items.map((it, q) => {
              const isAns = Boolean(ans[it.id]?.answer);
              const isDoubted = doubted.has(it.id);
              const cls = isDoubted ? 'q-doubted' : isAns ? 'q-answered' : 'q-unanswered';
              const isCurrent = q === i;
              const isBm = bookmarked.has(it.id);
              return (
                <button
                  key={q}
                  type="button"
                  className={`q-num ${cls} ${isCurrent ? 'current' : ''} ${isBm ? 'bookmarked' : ''}`}
                  onClick={() => setI(q)}
                >
                  {q + 1}
                  {isBm && <span className="q-bookmark-mark">🔖</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <section className="card" style={{ maxWidth: 800 }}>
        {item && (
          <ItemPlayer
            key={item.id}
            item={item}
            showBahas={phase === 'hasil'}
            hideKeys={phase !== 'hasil'}
            answer={ans[item.id]?.answer || ''}
            onUpdate={(info) => {
              const value: Ans = { answer: info.answer ?? '', correct: !!info.correct };
              setAns((m) => ({ ...m, [item.id]: value }));
              // Always queue first, then persist. If attemptId is not resolved
              // yet the flush effect writes it as soon as it becomes available.
              pendingAnsRef.current[item.id] = value;
              if (attemptId && studentId) {
                void insforge.database
                  .from('attempt_answers')
                  .upsert({
                    attempt_id: attemptId,
                    item_id: item.id,
                    answer: value.answer,
                    is_correct: value.correct,
                    locked_at: new Date().toISOString(),
                  }, { onConflict: 'attempt_id,item_id' })
                  .then(({ error }) => {
                    if (!error) delete pendingAnsRef.current[item.id];
                  });
              }
            }}
          />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="q-nav-btn" disabled={i === 0} onClick={() => setI((x) => x - 1)} aria-label="Soal sebelumnya" title="Soal sebelumnya">
            ‹
          </button>
          <button
            type="button"
            className={`ragu-btn ${doubted.has(item?.id) ? 'active' : ''}`}
            onClick={() => {
              setDoubted((s) => {
                const next = new Set(s);
                if (next.has(item?.id)) next.delete(item?.id);
                else next.add(item?.id);
                return next;
              });
            }}
            title={doubted.has(item?.id) ? 'Hapus ragu' : 'Tandai ragu'}
          >
            {doubted.has(item?.id) ? '✕ Ragu' : 'Ragu'}
          </button>
          {i < items.length - 1 ? (
            <button type="button" className="q-nav-btn" onClick={() => setI((x) => x + 1)} aria-label="Soal berikutnya" title="Soal berikutnya">
              ›
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={() => void kumpulkan()}>
              Kumpulkan
</button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}