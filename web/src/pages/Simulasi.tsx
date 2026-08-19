import { useEffect, useState } from 'react';
import { ItemPlayer } from '../components/ItemPlayer';
import { insforge } from '../lib/insforge';
import { acakList, acakOpsi, type DbItem } from '../lib/soal';
import { toggleBookmark, isBookmarked } from '../lib/bookmarks';
import { Icons } from '../AppShell';

type Pkg = {
  id: string;
  title: string;
  kind: string;
  mapel: string;
  item_count: number;
  duration_sec: number | null;
  discuss_after_each: boolean;
  shuffle?: boolean;
  use_ai_selection?: boolean;
  jumlah_soal_soal?: number | null;
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

export function Simulasi({ schoolId, studentId }: { schoolId: string | null; studentId?: string }) {
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
  const [cheatCount, setCheatCount] = useState(0);
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const [cheatMessage, setCheatMessage] = useState('');
  const [subTab, setSubTab] = useState<'latihan' | 'ujian'>('latihan');
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamSchedule | null>(null);
  const [identity, setIdentity] = useState<Identity>({ name: '', kelas: '', nisn: '', token: '' });

  useEffect(() => {
    (async () => {
      const { data, error } = await insforge.database
        .from('packages')
        .select('id, title, kind, mapel, item_count, duration_sec, discuss_after_each, shuffle, use_ai_selection, jumlah_soal_soal');
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
    })();
  }, [schoolId]);

  useEffect(() => {
    if (phase !== 'run' || !pkg) return;
    const t = setInterval(() => {
      setSisa((s) => {
        if (s <= 1) {
          clearInterval(t);
          void kumpulkan();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, pkg]);

  /* Anti-cheat: fullscreen + tab-exit detection */
  useEffect(() => {
    if (phase !== 'run') return;

    async function enterFullscreen() {
      try {
        const doc = window.document;
        const docEl = doc.documentElement;
        const fs = docEl.requestFullscreen || (docEl as any).webkitRequestFullscreen || (doc as any).msRequestFullscreen;
        if (fs) await fs.call(docEl);
      } catch {
        /* fullscreen may be blocked by browser policy */
      }
    }
    void enterFullscreen();

    function handleExit() {
      const exitFs = () => {
        try { (window.document as any).exitFullscreen?.(); } catch { /* noop */ }
        try { (window.document as any).webkitCancelFullScreen?.(); } catch { /* noop */ }
      };
      exitFs();

      document.body.style.userSelect = 'normal';
      document.onselectstart = null;
      document.oncontextmenu = null;
      document.onkeydown = null;
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        setCheatCount((c) => {
          const next = c + 1;
          if (next >= 3) {
            void kumpulkan();
          } else {
            setCheatMessage('Anda keluar dari tab simulasi. SISA 2x lagi akan otomatis mengirimkan jawaban.');
            setShowCheatWarning(true);
          }
          return next;
        });
      }
    }

    function handleBlur() {
      setCheatCount((c) => {
        const next = c + 1;
        if (next >= 3) {
          void kumpulkan();
        } else {
          setCheatMessage('Jendela simulasi kehilangan fokus. Sisa 2x lagi akan otomatis mengirimkan jawaban.');
          setShowCheatWarning(true);
        }
        return next;
      });
    }

    function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
      return false;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && (e.key === 't' || e.key === 'r' || e.key === 'n' || e.key === 'w' || e.key === 'l')) {
        e.preventDefault();
        e.stopPropagation();
        setCheatMessage('Shortcut dilarang saat simulasi berlangsung.');
        setShowCheatWarning(true);
        return false;
      }
    }

    document.body.style.userSelect = 'none';
    document.onselectstart = () => false;
    document.oncontextmenu = handleContextMenu;
    document.onkeydown = handleKeyDown;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      handleExit();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === 'run' && pkg) {
      sessionStorage.setItem(`sim-${pkg.id}-draft`, JSON.stringify({ ans, i }));
    }
  }, [ans, i, phase, pkg]);


  async function mulai(p: Pkg, exam?: ExamSchedule) {
    setErr('');
    setAns({});
    setSkor(null);
    const { data: links, error } = await insforge.database.from('package_items').select('item_id, position').eq('package_id', p.id);
    if (error) {
      setErr(error.message);
      return;
    }
    const ids = ((links || []) as { item_id: string; position: number }[]).sort((a, b) => a.position - b.position).map((x) => x.item_id);
    if (ids.length === 0) {
      setErr('Paket belum berisi soal.');
      return;
    }
    const { data: its, error: e2 } = await insforge.database
      .from('items')
      .select('id, item_type, mapel, stem, stimulus, choices, correct_key, rationale, jenjang');
    if (e2) {
      setErr(e2.message);
      return;
    }
    const map = new Map(((its || []) as DbItem[]).map((x) => [x.id, x]));
    let ordered = ids.map((id) => map.get(id)).filter(Boolean) as DbItem[];
    if (p.use_ai_selection && p.jumlah_soal_soal && p.jumlah_soal_soal > 0 && p.jumlah_soal_soal < ordered.length) {
      ordered = acakList(ordered).slice(0, p.jumlah_soal_soal);
    }
    if (p.shuffle) ordered = acakList(ordered);
    const shuffled = ordered.map(acakOpsi);
    setItems(shuffled);
    setPkg(p);
    setI(0);
    setSisa((exam && exam.duration_sec && exam.duration_sec > 0) ? exam.duration_sec : (p.duration_sec && p.duration_sec > 0 ? p.duration_sec : 15 * 60));
    const saved = new Set<string>();
    shuffled.forEach((it) => {
      if (isBookmarked(studentId, it.id)) saved.add(it.id);
    });
    setBookmarked(saved);
    setListExpanded(false);
    setPhase('run');
    const draft = sessionStorage.getItem(`sim-${p.id}-draft`);
    if (draft) {
      try {
        const d = JSON.parse(draft) as { ans?: Record<string, Ans>; i?: number };
        if (d.ans) setAns(d.ans);
        if (typeof d.i === 'number' && d.i > 0 && d.i < shuffled.length) setI(d.i);
      } catch { /* noop */ }
    }
  }

  async function kumpulkan() {
    try { (document as any).exitFullscreen?.(); } catch { /* noop */ }
    document.body.style.userSelect = 'normal';
    document.onselectstart = null;
    document.oncontextmenu = null;
    document.onkeydown = null;

    if (!pkg || items.length === 0) {
      setPhase('hasil');
      return;
    }
    const benar = items.filter((it) => ans[it.id]?.correct).length;
    const nilai = Math.round((benar / items.length) * 10000) / 100;
    setSkor(nilai);
    setPhase('hasil');
    if (pkg && pkg.id) sessionStorage.removeItem(`sim-${pkg.id}-draft`);

    if (!studentId) return;

    const { data, error } = await insforge.database
      .from('attempts')
      .insert({
        package_id: pkg.id,
        student_id: studentId,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        score: nilai,
      })
      .select('id');
    if (error) {
      setErr('Nilai dihitung, tapi belum tersimpan ke laporan: ' + error.message);
      return;
    }
    const aid = (data?.[0] as { id?: string } | undefined)?.id;
    if (!aid) return;
    const rows = items.map((it) => ({
      attempt_id: aid,
      item_id: it.id,
      answer: ans[it.id]?.answer || '',
      is_correct: !!ans[it.id]?.correct,
      locked_at: new Date().toISOString(),
    }));
    await insforge.database.from('attempt_answers').insert(rows);

    const xpEarned = Math.round(nilai * 2) + 20;
    if (xpEarned > 0) {
      const showXp = (window as any).__showXpReward;
      if (showXp) {
        showXp(xpEarned, 'Simulasi');
      } else {
        try {
          await insforge.database.rpc('award_xp', { p_profile: studentId, p_xp: xpEarned });
        } catch {
          /* XP award best-effort */
        }
      }
    }
  }

  const mm = String(Math.floor(sisa / 60)).padStart(2, '0');
  const ss = String(sisa % 60).padStart(2, '0');
  const bahasLangsung = !!pkg?.discuss_after_each;

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
              {selectedExam?.info && <p style={{ margin: '2px 0', fontSize: 13 }}><b>Info:</b> {selectedExam.info}</p>}
            </div>
            {err && <p style={{ color: 'var(--warn)', fontSize: 12 }}>{err}</p>}
            <button
              type="button"
              className="continue-btn"
              disabled={!identity.name || !identity.kelas || !identity.nisn || (isUjian && selectedExam?.token && !identity.token)}
              onClick={async () => {
                setErr('');
                if (!identity.name || !identity.kelas || !identity.nisn) { setErr('Nama, Kelas, dan NISN wajib diisi.'); return; }
                if (isUjian && selectedExam?.token && !identity.token) { setErr('Token ujian wajib.'); return; }
                if (invalidToken) { setErr('Token ujian salah.'); return; }
                await mulai(pkg, selectedExam || undefined);
              }}
            >
              Mulai {isUjian ? 'Ujian' : 'Latihan'}
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
                  <button className="continue-btn" type="button" onClick={() => mulai(p)}>Mulai Simulasi</button>
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
          <button
            type="button"
            className="header-icon-btn"
            title={bookmarked.has(item?.id) ? 'Hapus bookmark' : 'Simpan soal'}
            onClick={() => toggleBookmarkItem(i)}
            style={{ padding: 4 }}
          >
            {Icons.bookmark(bookmarked.has(item?.id))}
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
            showBahas={bahasLangsung}
            hideKeys={!bahasLangsung}
            onUpdate={(info) => setAns((m) => ({ ...m, [item.id]: info }))}
          />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost" type="button" disabled={i === 0} onClick={() => setI((x) => x - 1)}>
            ← Sebelumnya
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
            title={doubted.has(item?.id) ? 'Hapus ragu-ragu' : 'Tandai ragu-ragu'}
          >
            {doubted.has(item?.id) ? '✕ Ragu' : 'Ragu-ragu'}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            {i < items.length - 1 ? (
              <button className="btn btn-primary" type="button" onClick={() => setI((x) => x + 1)}>
                Selanjutnya →
              </button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={() => void kumpulkan()}>
                Kumpulkan
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
    {showCheatWarning && (
      <div className="cheat-modal-backdrop" onClick={() => setShowCheatWarning(false)}>
        <div className="cheat-modal" onClick={(e) => e.stopPropagation()}>
          <h3 className="cheat-modal-title">⚠ Peringatan Penting</h3>
          <p className="cheat-modal-text">{cheatMessage}</p>
          <p className="cheat-modal-sub">
            {cheatCount >= 3
              ? 'Simulasi otomatis dikumpulkan. Jangan keluar dari tab selama ujian.'
              : `Pelanggaran: ${cheatCount} dari 3. Keluar lagi akan mengirimkan otomatis.`}
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCheatWarning(false)}>
            Kembali ke simulasi
          </button>
        </div>
      </div>
    )}
      </>
  );
}