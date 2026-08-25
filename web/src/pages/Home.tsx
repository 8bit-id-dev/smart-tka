import { useEffect, useMemo, useState, useRef } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';
import type { Tab } from '../AppShell';
import { Icons } from '../AppShell';
import { GamifQuickView } from '../components/GamifQuickView';
import { PhotoCropModal } from '../components/PhotoCropModal';
import { FilterSelect } from '../components/FilterSelect';
import defaultPhoto from '../assets/profile.jpg';

type AttemptRow = { id: string; score: number | null; status: string; submitted_at: string | null; package_id: string | null };
type AARow = { attempt_id: string; item_id: string; is_correct: boolean; items: { mapel: string; item_type: string; difficulty: number | null; materi: string | null }[] };
type PkgRow = { id: string; title: string; mapel: string; kind: string; item_count: number; duration_sec: number | null };
type ExamSchedule = { id: string; package_id: string; subject: string; materi: string | null; duration_sec: number | null; start_at: string; end_at: string; is_active: boolean };
type ClassRow = { id: string; name: string; jenjang: string };
type GpRow = { xp: number; level: number; streak_current: number; streak_best: number };

const JENJANG_LABEL: Record<string, string> = {
  sd: 'SD', smp: 'SMP', sma: 'SMA', smk: 'SMK',
  paket_a: 'Paket A', paket_b: 'Paket B', paket_c: 'Paket C',
};

function getTitle(level: number): string {
  if (level >= 16) return 'Legenda TKA';
  if (level >= 11) return 'Master TKA';
  if (level >= 7) return 'Master Simulasi';
  if (level >= 4) return 'Spesialis Materi';
  if (level >= 2) return 'Pelajar Tekun';
  return 'Petualuh Baru';
}

function SimpleLineChart({ data, labels, color = 'var(--accent)' }: { data: number[]; labels: string[]; color?: string }) {
  if (!data.length) {
    return <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Belum ada data aktivitas.</p>;
  }
  const w = 600;
  const h = 160;
  const pad = { top: 10, right: 10, bottom: 24, left: 10 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: pad.left + (i / Math.max(data.length - 1, 1)) * cw,
    y: pad.top + ch - ((v - min) / range) * ch,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = pathD + ` L ${pts[pts.length - 1].x} ${pad.top + ch} L ${pts[0].x} ${pad.top + ch} Z`;
  const dots = pts.map((p, i) => (
    <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} stroke="#fff" strokeWidth={2} />
  ));
  const xLabels = labels.map((l, i) => {
    const x = pad.left + (i / Math.max(labels.length - 1, 1)) * cw;
    return <text key={i} x={x} y={h - 4} textAnchor="middle" fontSize="10" fill="#7a8a8a">{l}</text>;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
      <path d={areaD} fill={color} opacity={0.08} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {dots}
      {xLabels}
    </svg>
  );
}

function MapelBarChart({ data }: { data: Record<string, { total: number; correct: number }> }) {
  const entries = Object.entries(data).sort(
    (a, b) => b[1].correct / b[1].total - a[1].correct / a[1].total
  );
  if (!entries.length) return null;
  const w = 600;
  const h = 220;
  const pad = { top: 20, right: 10, bottom: 30, left: 10 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;
  const slot = cw / entries.length;
  const barW = Math.min(46, slot * 0.55);
  const shortName = (n: string) =>
    n === 'Matematika' ? 'Mat' : n === 'Bahasa Indonesia' ? 'B.Indo' : n === 'Bahasa Inggris' ? 'B.Ing' : n.length > 8 ? `${n.slice(0, 7)}…` : n;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {entries.map(([name, v], i) => {
        const pct = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
        const x = pad.left + slot * i + (slot - barW) / 2;
        const bh = Math.max((pct / 100) * ch, 3);
        const y = pad.top + ch - bh;
        const color = pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--accent)' : 'var(--danger)';
        return (
          <g key={name}>
            <rect x={x} y={y} width={barW} height={bh} rx={6} fill={color} opacity={0.9} />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">
              {pct}%
            </text>
            <text x={x + barW / 2} y={h - 10} textAnchor="middle" fontSize="9" fill="var(--muted)">
              {shortName(name)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type AnalysisTab = 'mapel' | 'jenis' | 'kesulitan' | 'materi';

const RecIcons = {
  book: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  pencil: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),
  target: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  document: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  trendUp: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  trendDown: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  ),
  flask: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 9h4M10.5 3l-1 6a4 4 0 0 0 1 3.5L12 14.5l1.5-2a4 4 0 0 0 1-3.5l-1-6" />
      <path d="M5 21h14" />
    </svg>
  ),
};

function AbilityAnalysis({
  stats,
  subjectStats,
  typeStats,
  diffStats,
  materiStats,
  trend,
  activityChart,
}: {
  stats: { soalDikerjakan: number; jawabanBenar: number; akurasi: number; rataSkor: number; simulasiSelesai: number; totalAttempts: number };
  subjectStats: Record<string, { total: number; correct: number }>;
  typeStats: Record<string, { total: number; correct: number }>;
  diffStats: Record<number, { total: number; correct: number }>;
  materiStats: Record<string, { total: number; correct: number; mapel: string }>;
  trend: string;
  activityChart: { data: number[]; labels: string[] };
}) {
  const [tab, setTab] = useState<AnalysisTab>('mapel');
  const hasData = Object.keys(subjectStats).length > 0 || Object.keys(typeStats).length > 0 || Object.keys(diffStats).length > 0 || Object.keys(materiStats).length > 0;

  const TABS: { id: AnalysisTab; label: string }[] = [
    { id: 'mapel', label: 'Mata Pelajaran' },
    { id: 'jenis', label: 'Jenis Soal' },
    { id: 'kesulitan', label: 'Kesulitan' },
    { id: 'materi', label: 'Materi' },
  ];

  const getStrengths = () => {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    Object.entries(subjectStats).forEach(([name, v]) => {
      const pct = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
      if (v.total >= 3 && pct >= 75) strengths.push(name);
      if (v.total >= 3 && pct < 50) weaknesses.push(name);
    });
    return { strengths, weaknesses };
  };

  const { strengths, weaknesses } = useMemo(getStrengths, [subjectStats]);

  const getTag = (pct: number) => {
    if (pct >= 80) return { label: 'Sangat Kuat', cls: 'analysis-bar-tag-strong' };
    if (pct >= 65) return { label: 'Kuat', cls: 'analysis-bar-tag-strong' };
    if (pct >= 50) return { label: 'Cukup', cls: 'analysis-bar-tag-improve' };
    return { label: 'Perlu Latihan', cls: 'analysis-bar-tag-improve' };
  };

  return (
    <div className="section">
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 className="card-title" style={{ margin: 0 }}>Analisis Kemampuan</h3>
          <FilterSelect
            value={tab}
            onChange={(v) => setTab(v as AnalysisTab)}
            placeholder="Pilih filter"
            minWidth={160}
            options={TABS.map((t) => ({ value: t.id, label: t.label }))}
          />
        </div>

        {!hasData ? (
          <p className="type-lab">Kerjakan soal untuk melihat analisis.</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '14px 10px', backgroundColor: 'var(--surface-2)', borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{stats.akurasi}%</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Akurasi</div>
              </div>
              <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '14px 10px', backgroundColor: 'var(--surface-2)', borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{stats.jawabanBenar}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Jawaban Benar</div>
              </div>
              <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '14px 10px', backgroundColor: 'var(--surface-2)', borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)' }}>{stats.soalDikerjakan}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Soal Selesai</div>
              </div>
              <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '14px 10px', backgroundColor: 'var(--surface-2)', borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: stats.rataSkor >= 70 ? 'var(--success)' : stats.rataSkor >= 50 ? 'var(--gold)' : 'var(--danger)' }}>{stats.rataSkor}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Rata-rata Skor</div>
              </div>
            </div>

            {strengths.length > 0 && (
              <div style={{ marginBottom: 16, padding: '10px 14px', backgroundColor: 'var(--success-bg)', borderRadius: 8, borderLeft: '3px solid var(--success)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>Kekuatan</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{strengths.map((s) => `${s} (${Math.round((subjectStats[s].correct / subjectStats[s].total) * 100)}%)`).join(', ')}</div>
              </div>
            )}
            {weaknesses.length > 0 && (
              <div style={{ marginBottom: 16, padding: '10px 14px', backgroundColor: 'var(--danger-bg, #fef2f2)', borderRadius: 8, borderLeft: '3px solid var(--danger)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>Perlu Ditingkatkan</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{weaknesses.map((w) => `${w} (${Math.round((subjectStats[w].correct / subjectStats[w].total) * 100)}%)`).join(', ')}</div>
              </div>
            )}

            {Object.keys(subjectStats).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 8px 10px' }}>Akurasi per Mata Pelajaran</h4>
                <div className="chart-svg-wrap" style={{ height: 'auto' }}>
                  <MapelBarChart data={subjectStats} />
                </div>
              </div>
            )}

            {tab === 'mapel' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(subjectStats).sort(([, a], [, b]) => (b.correct / b.total) - (a.correct / a.total)).map(([mapel, v]) => {
                  const pct = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
                  const tag = getTag(pct);
                  return <AnalysisBar key={mapel} label={mapel} pct={pct} tag={tag.label} tagCls={tag.cls} subtitle={`${v.correct}/${v.total} soal`} />;
                })}
              </div>
            )}

            {tab === 'jenis' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(typeStats).map(([type, v]) => {
                  const pct = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
                  const label = type === 'pg' ? 'Pilihan Ganda' : type === 'pg_kompleks' ? 'PG Kompleks' : type === 'uraian' ? 'Uraian' : type === 'pernyataan_bs' ? 'Benar/Salah' : type === 'mencocokkan' ? 'Mencocokkan' : type;
                  const tag = getTag(pct);
                  return <AnalysisBar key={type} label={label} pct={pct} tag={tag.label} tagCls={tag.cls} subtitle={`${v.correct}/${v.total} soal`} />;
                })}
              </div>
            )}

            {tab === 'kesulitan' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(diffStats).sort(([a], [b]) => Number(a) - Number(b)).map(([diff, v]) => {
                  const pct = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
                  const diffNum = Number(diff);
                  const label = diffNum === 1 ? 'Mudah' : diffNum === 2 ? 'Sedang' : diffNum === 3 ? 'Sulit' : `Level ${diff}`;
                  const tag = getTag(pct);
                  return <AnalysisBar key={diff} label={label} pct={pct} tag={tag.label} tagCls={tag.cls} subtitle={`${v.correct}/${v.total} soal`} />;
                })}
              </div>
            )}

            {tab === 'materi' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(materiStats).sort(([, a], [, b]) => (a.correct / a.total) - (b.correct / b.total)).map(([materi, v]) => {
                  const pct = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
                  const tag = getTag(pct);
                  return <AnalysisBar key={materi} label={materi + (v.mapel ? ` (${v.mapel})` : '')} pct={pct} tag={tag.label} tagCls={tag.cls} subtitle={`${v.correct}/${v.total} soal`} />;
                })}
              </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 8px 10px' }}>Tren Skor (7 Terakhir)</h4>
              <div className="chart-svg-wrap" style={{ height: 100 }}>
                <SimpleLineChart data={activityChart.data} labels={activityChart.labels} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0', textAlign: 'center' }}>
                {trend === 'up' ? '📈 Tren meningkat — pertahankan!' : trend === 'down' ? '📉 Tren menurun — review salah jawab' : '📊 Belum ada tren yang signifikan'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AnalysisBar({ label, pct, tag, tagCls, subtitle }: { label: string; pct: number; tag: string; tagCls: string; subtitle?: string }) {
  return (
    <div className="analysis-bar-row">
      <span className="analysis-bar-label">{label}{subtitle && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>{subtitle}</span>}</span>
      <div className="analysis-bar-track">
        <div className="analysis-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className={tagCls}>{tag}</span>
    </div>
  );
}

export function Home({ name, profile, onTab }: { name: string; profile: AppProfile; onTab: (t: Tab) => void }) {
  const staf = ['guru', 'admin', 'kepsek', 'konten'].includes(profile.role);
  const isSiswa = profile.role === 'siswa';

  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [aa, setAa] = useState<AARow[]>([]);
  const [pkgs, setPkgs] = useState<PkgRow[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [myClass, setMyClass] = useState<ClassRow | null>(null);
  const [gp, setGp] = useState<GpRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSiswa) return;
    void (async () => {
      setLoading(true);

      const att = await insforge.database
        .from('attempts')
        .select('id, score, status, submitted_at, package_id')
        .eq('student_id', profile.id);
      if (!att.error) setAttempts((att.data || []) as AttemptRow[]);

      const pk = await insforge.database
        .from('packages')
        .select('id, title, mapel, kind, item_count, duration_sec')
        .order('kind')
        .order('mapel')
        .limit(50);
      if (!pk.error) setPkgs((pk.data || []) as PkgRow[]);

      const sch = await insforge.database
        .from('exam_schedules')
        .select('id, package_id, subject, materi, duration_sec, start_at, end_at, is_active')
        .eq('is_active', true);
      if (!sch.error) setSchedules((sch.data || []) as ExamSchedule[]);

      void Promise.all([
        insforge.database
          .from('class_students')
          .select('class_id, classes!inner(id, name, jenjang)')
          .eq('profile_id', profile.id)
          .limit(1),
        insforge.database
          .from('gamification_profiles')
          .select('xp, level, streak_current, streak_best')
          .eq('profile_id', profile.id)
          .single(),
      ]).then(([clsRes, gpRes]) => {
        if (!clsRes.error && clsRes.data && (clsRes.data as any[]).length > 0) {
          const first = (clsRes.data as any[])[0];
          setMyClass(first.classes as ClassRow);
        }
        if (!gpRes.error && gpRes.data) setGp(gpRes.data as GpRow);
      });

      setLoading(false);
    })();
  }, [profile.id, isSiswa]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!isSiswa || !attempts.length) return;
    void (async () => {
      const ids = attempts.map((a) => a.id).filter(Boolean);
      if (!ids.length) return;
      const { data } = await insforge.database
        .from('attempt_answers')
        .select('attempt_id, item_id, is_correct, items!inner(mapel, item_type, difficulty, materi)')
        .in('attempt_id', ids)
        .limit(1000);
      if (data) setAa(data as AARow[]);
    })();
  }, [attempts.length, isSiswa]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const stats = useMemo(() => {
    const submittedAttempts = attempts.filter((a) => a.status === 'submitted' && a.score != null);
    const submittedIds = new Set(submittedAttempts.map((a) => a.id));
    const completedAa = aa.filter((x) => submittedIds.has(x.attempt_id));
    const soalDikerjakan = completedAa.length;
    const jawabanBenar = completedAa.filter((a) => a.is_correct).length;
    const akurasi = soalDikerjakan > 0 ? Math.round((jawabanBenar / soalDikerjakan) * 100) : 0;
    const rataSkor = submittedAttempts.length > 0
      ? Math.round((submittedAttempts.reduce((s, r) => s + Number(r.score), 0) / submittedAttempts.length) * 10) / 10
      : 0;
    return { soalDikerjakan, jawabanBenar, akurasi, rataSkor, simulasiSelesai: submittedAttempts.length, totalAttempts: attempts.length };
  }, [attempts, aa]);

  const subjectStats = useMemo(() => {
    const submittedIds = new Set(attempts.filter((a) => a.status === 'submitted').map((a) => a.id));
    const byMapel: Record<string, { total: number; correct: number }> = {};
    for (const a of aa) {
      if (!submittedIds.has(a.attempt_id)) continue;
      const mapel = Array.isArray(a.items) && a.items[0]?.mapel
        ? a.items[0].mapel
        : 'Lainnya';
      if (!byMapel[mapel]) byMapel[mapel] = { total: 0, correct: 0 };
      byMapel[mapel].total += 1;
      if (a.is_correct) byMapel[mapel].correct += 1;
    }
    return byMapel;
  }, [aa, attempts]);

  const recMapel = useMemo(() => {
    const entries = Object.entries(subjectStats).map(([name, v]) => ({
      name,
      akurasi: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      soal: v.total,
    }));
    return entries.sort((a, b) => a.akurasi - b.akurasi)[0];
  }, [subjectStats]);

  const typeStats = useMemo(() => {
    const submittedIds = new Set(attempts.filter((a) => a.status === 'submitted').map((a) => a.id));
    const byType: Record<string, { total: number; correct: number }> = {};
    for (const a of aa) {
      if (!submittedIds.has(a.attempt_id)) continue;
      const itemType = Array.isArray(a.items) && a.items[0]?.item_type
        ? a.items[0].item_type
        : 'Lainnya';
      if (!byType[itemType]) byType[itemType] = { total: 0, correct: 0 };
      byType[itemType].total += 1;
      if (a.is_correct) byType[itemType].correct += 1;
    }
    return byType;
  }, [aa, attempts]);

  const diffStats = useMemo(() => {
    const submittedIds = new Set(attempts.filter((a) => a.status === 'submitted').map((a) => a.id));
    const byDiff: Record<number, { total: number; correct: number }> = {};
    for (const a of aa) {
      if (!submittedIds.has(a.attempt_id)) continue;
      const diff = Array.isArray(a.items) && a.items[0]?.difficulty != null
        ? Number(a.items[0].difficulty)
        : 0;
      if (!byDiff[diff]) byDiff[diff] = { total: 0, correct: 0 };
      byDiff[diff].total += 1;
      if (a.is_correct) byDiff[diff].correct += 1;
    }
    return byDiff;
  }, [aa, attempts]);

  const materiStats = useMemo(() => {
    const submittedIds = new Set(attempts.filter((a) => a.status === 'submitted').map((a) => a.id));
    const byMateri: Record<string, { total: number; correct: number; mapel: string }> = {};
    for (const a of aa) {
      if (!submittedIds.has(a.attempt_id)) continue;
      const materi = Array.isArray(a.items) && a.items[0]?.materi
        ? a.items[0].materi
        : 'Umum';
      const mapel = Array.isArray(a.items) && a.items[0]?.mapel || '';
      if (!byMateri[materi]) byMateri[materi] = { total: 0, correct: 0, mapel };
      byMateri[materi].total += 1;
      if (a.is_correct) byMateri[materi].correct += 1;
    }
    return byMateri;
  }, [aa, attempts]);

  const trend = useMemo(() => {
    const submitted = attempts
      .filter((a) => a.status === 'submitted' && a.score != null && a.submitted_at)
      .sort((a, b) => new Date(a.submitted_at!).getTime() - new Date(b.submitted_at!).getTime());
    if (submitted.length < 2) return 'neutral';
    const recent = submitted.slice(-3);
    const earlier = submitted.slice(0, Math.min(3, submitted.length - 3));
    if (earlier.length === 0) return 'neutral';
    const recentAvg = recent.reduce((s, r) => s + Number(r.score), 0) / recent.length;
    const earlierAvg = earlier.reduce((s, r) => s + Number(r.score), 0) / earlier.length;
    if (recentAvg > earlierAvg + 5) return 'up';
    if (recentAvg < earlierAvg - 5) return 'down';
    return 'neutral';
  }, [attempts]);

  const activityChart = useMemo(() => {
    const last7 = attempts
      .filter((a) => a.status === 'submitted' && a.submitted_at)
      .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime())
      .slice(0, 7)
      .reverse();
    const data = last7.map((a) => Number(a.score) || 0);
    const labels = last7.map((a) => new Date(a.submitted_at!).toLocaleDateString('id-ID', { weekday: 'short' }));
    return { data, labels };
  }, [attempts]);

  const recommendations = useMemo(() => {
    const recs: { icon: 'book' | 'pencil' | 'target' | 'document' | 'trendUp' | 'trendDown' | 'flask'; title: string; desc: string; action: Tab; actionLabel: string; priority: number }[] = [];
    if (recMapel && recMapel.akurasi < 70) {
      recs.push({ icon: 'book', title: `Perkuat ${recMapel.name}`, desc: `Akurasi ${recMapel.akurasi}% (${recMapel.soal} soal). Fokus pada topik yang belum dikuasai.`, action: 'latihan', actionLabel: 'Latihan', priority: 1 });
    }
    const weakTypes = Object.entries(typeStats).filter(([, v]) => v.total >= 3 && (v.correct / v.total) < 0.5);
    for (const [t] of weakTypes) {
      const typeLabel = t === 'pg' ? 'Pilihan Ganda' : t === 'pg_kompleks' ? 'PG Kompleks' : t === 'uraian' ? 'Uraian' : t === 'pernyataan_bs' ? 'Benar/Salah' : t === 'mencocokkan' ? 'Mencocokkan' : t;
      recs.push({ icon: 'pencil', title: `Latih soal ${typeLabel}`, desc: 'Akurasi jenis soal ini masih rendah. Kerjakan lebih banyak latihan.', action: 'latihan', actionLabel: 'Latihan', priority: 2 });
    }
    const weakDiffs = Object.entries(diffStats).filter(([, v]) => v.total >= 2 && (v.correct / v.total) < 0.4);
    for (const [d] of weakDiffs) {
      const label = d === '1' ? 'Mudah' : d === '2' ? 'Sedang' : d === '3' ? 'Sulit' : `Level ${d}`;
      recs.push({ icon: 'target', title: `Tingkatkan soal ${label}`, desc: `Soal tingkat ${label} masih sering salah. Mulai dari tingkat lebih mudah dulu.`, action: 'latihan', actionLabel: 'Latihan', priority: 3 });
    }
    const weakMateris = Object.entries(materiStats).filter(([, v]) => v.total >= 2 && (v.correct / v.total) < 0.5);
    for (const [m, v] of weakMateris) {
      const pct = Math.round((v.correct / v.total) * 100);
      recs.push({ icon: 'document', title: `Review materi: ${m}`, desc: `${pct}% akurasi di ${v.mapel}. Pelajari kembali konsep dasar materi ini.`, action: 'latihan', actionLabel: 'Latihan', priority: 4 });
    }
    if (trend === 'down') {
      recs.push({ icon: 'trendDown', title: 'Skor menurun', desc: 'Skor beberapa tes terakhir menurun. Ambil jeda, review salah jawab, coba lagi.', action: 'latihan', actionLabel: 'Coba Lagi', priority: 5 });
    } else if (trend === 'up') {
      recs.push({ icon: 'trendUp', title: 'Teruskan!', desc: 'Skor konsisten meningkat. Pertahankan ritme latihan dan coba soal lebih sulit.', action: 'simulasi', actionLabel: 'Simulasi', priority: 6 });
    }
    if (stats.simulasiSelesai < 3) {
      recs.push({ icon: 'flask', title: 'Perbanyak simulasi', desc: `Kamu baru ${stats.simulasiSelesai} simulasi. Target minimal 5 simulasi untuk pembiasaan.`, action: 'simulasi', actionLabel: 'Simulasi', priority: 7 });
    }
    return recs.sort((a, b) => a.priority - b.priority).slice(0, 4);
  }, [recMapel, typeStats, diffStats, materiStats, trend, stats]);

  const assignedPkgIds = useMemo(() => schedules.map((s) => s.package_id), [schedules]);
  const simulasiPkg = useMemo(
    () =>
      pkgs.find((p) => assignedPkgIds.includes(p.id) && p.kind === 'simulasi') ||
      pkgs.find((p) => assignedPkgIds.includes(p.id)) ||
      pkgs.find((p) => p.kind === 'simulasi') ||
      pkgs[0],
    [pkgs, assignedPkgIds]
  );
  const { lastSimScore: _lastSimScore, bestSimScore: _bestSimScore } = useMemo(() => {
    const submitted = attempts.filter((a) => a.status === 'submitted' && a.score != null && a.score > 0);
    if (submitted.length === 0) return { lastSimScore: 0, bestSimScore: 0 };
    const sorted = [...submitted].sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime());
    return { lastSimScore: Number(sorted[0].score), bestSimScore: Math.max(...sorted.map((a) => Number(a.score))) };
  }, [attempts]);

  const [photoUrl, setPhotoUrl] = useState(profile.photo_url || defaultPhoto);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openPhotoMenu() {
    if (!isSiswa || photoLoading) return;
    setPhotoMenuOpen(true);
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoErr('Hanya file gambar yang diperbolehkan.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoErr('Ukuran maksimal 2 MB.');
      return;
    }
    setPhotoErr('');
    setCropSrc(URL.createObjectURL(file));
  }

  async function uploadBlob(blob: Blob) {
    setPhotoLoading(true);
    setPhotoErr('');
    const ext = blob.type.split('/')[1] || 'jpg';
    const path = `${profile.id}.${ext}`;
    try {
      const { error, data } = await insforge.storage.from('profile-photos').upload(path, blob);
      if (error) {
        setPhotoErr(error.message);
      } else {
        const url = (data as { url?: string })?.url || (data as { publicUrl?: string })?.publicUrl || '';
        setPhotoUrl(url);
        await insforge.database.from('profiles').update({ photo_url: url }).eq('id', profile.id);
      }
    } catch (e) {
      setPhotoErr(e instanceof Error ? e.message : 'Upload gagal.');
    }
    setPhotoLoading(false);
    if (cropSrc) {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  }

  async function deletePhoto() {
    setPhotoLoading(true);
    setPhotoErr('');
    if (!photoUrl || photoUrl === defaultPhoto) {
      setPhotoLoading(false);
      return;
    }
    try {
      const clean = photoUrl.split('?')[0];
      const fname = clean.substring(clean.lastIndexOf('/') + 1);
      await insforge.storage.from('profile-photos').remove(fname);
    } catch {
      /* file mungkin sudah tidak ada — tetap lanjut ke foto default */
    }
    setPhotoUrl(defaultPhoto);
    const { error } = await insforge.database.from('profiles').update({ photo_url: null }).eq('id', profile.id);
    if (error) setPhotoErr(error.message);
    setPhotoLoading(false);
  }

  if (staf) {
    const role = profile.role;
    const isAdmin = role === 'admin';
    const isKepsek = role === 'kepsek';
    const pintas: { id: Tab; t: string; d: string; detail: string; icon: React.ReactNode }[] = [];
    if (isKepsek) {
      pintas.push(
        { id: 'laporan', t: 'Laporan', d: 'Rekap & ekspor', detail: 'Pantau skor dan unduh CSV/PDF', icon: Icons.laporan(true) },
        { id: 'kelas', t: 'Kelas', d: 'Lihat struktur', detail: 'Tinjau kelas dan keanggotaan siswa', icon: Icons.kelas(true) },
        { id: 'pengumuman', t: 'Pengumuman', d: 'Informasi sekolah', detail: 'Kelola pengumuman untuk siswa', icon: Icons.pengumuman(true) },
      );
    } else {
      pintas.push(
        { id: 'soal', t: 'Soal', d: 'Tulis atau draf AI', detail: 'Buat, edit, dan kelola soal TKA', icon: Icons.soal(true) },
        { id: 'paket', t: 'Paket', d: 'Rakit latihan / ujian', detail: 'Rakit dan atur paket latihan UTK', icon: Icons.paket(true) },
        { id: 'kelas', t: 'Kelas', d: 'Siswa, pindah, kenaikan', detail: 'Kelola anggota dan kenaikan kelas', icon: Icons.kelas(true) },
        { id: 'laporan', t: 'Laporan', d: 'Skor & cetak PDF', detail: 'Lihat rekap skor dan ekspor PDF', icon: Icons.laporan(true) },
      );
    }
    if (isAdmin || isKepsek) pintas.push({ id: 'admin', t: 'Admin', d: 'Impor user & assignment', detail: 'Kelola pengguna dan assignment sekolah', icon: Icons.admin(true) });
    return (
      <div className="dashboard-page">
        <header className="page-header">
          <p className="page-subtitle">Halo, {name}</p>
          <h1 className="page-title">{isKepsek ? 'Ringkasan sekolah' : isAdmin ? 'Panel admin' : 'Kerja sekolah'}</h1>
          <p className="page-subtitle" style={{ maxWidth: 500 }}>
            SMART-TKA persiapan internal. Bukan aplikasi resmi Kemendikdasmen. Tes Kemampuan Akademik.
          </p>
        </header>
        <section className="section">
          <div className="grid-3">
            {pintas.map((p) => (
              <article key={p.id} className="quick-card" onClick={() => onTab(p.id)}>
                <div className="quick-icon">{p.icon}</div>
                <div className="quick-info">
                  <h3>{p.t}</h3>
                  <p className="quick-desc">{p.d}</p>
                  <p className="quick-detail">{p.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Memuat dashboard…</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page student-dashboard">
      <div className="greeting-card">
        <div className="greeting-left">
          <div
            className="avatar-wrap"
            onClick={openPhotoMenu}
            style={isSiswa ? { cursor: 'pointer' } : undefined}
          >
            {photoUrl ? (
              <img src={photoUrl} alt={name} className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">
                {Icons.profil(false)}
              </div>
            )}
            {photoLoading && <div className="avatar-overlay">Menyimpan…</div>}
          </div>
          {photoErr && <div className="avatar-error">{photoErr}</div>}
          {photoMenuOpen && (
            <div className="photo-menu-backdrop" onClick={() => setPhotoMenuOpen(false)}>
              <div className="photo-menu" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="photo-menu-item" onClick={() => { fileInputRef.current?.click(); setPhotoMenuOpen(false); }} disabled={photoLoading}>
                  Ganti Foto
                </button>
                {photoUrl && photoUrl !== defaultPhoto && (
                  <button type="button" className="photo-menu-item photo-menu-item-danger" onClick={() => { void deletePhoto(); setPhotoMenuOpen(false); }} disabled={photoLoading}>
                    Hapus Foto
                  </button>
                )}
              </div>
            </div>
          )}
          <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={onPickPhoto} disabled={photoLoading} />
        </div>
        <div className="greeting-text">
          <h1>Selamat datang, {name}!</h1>
          {gp && <span className="greeting-title">[{getTitle(gp.level)} Level {gp.level}]</span>}
          {myClass ? (
            <>
              <p className="greeting-sub">Kelas {myClass.name} · {JENJANG_LABEL[myClass.jenjang] || myClass.jenjang}</p>
            </>
          ) : (
            <p className="greeting-sub">Siap melanjutkan persiapan TKA hari ini?</p>
          )}
        </div>
      </div>

      {gp && <GamifQuickView profile={gp} />}

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>?</div>
          <p className="stat-label">Soal Dikerjakan</p>
          <p className="stat-value">{stats.soalDikerjakan}</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>✓</div>
          <p className="stat-label">Jawaban Benar</p>
          <p className="stat-value">{stats.jawabanBenar}</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--gold-soft)', color: 'var(--gold)' }}>%</div>
          <p className="stat-label">Akurasi</p>
          <p className="stat-value">{stats.akurasi}%</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>★</div>
          <p className="stat-label">Rata-rata Skor</p>
          <p className="stat-value">{stats.rataSkor}</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>⏱</div>
          <p className="stat-label">Simulasi Selesai</p>
          <p className="stat-value">{stats.simulasiSelesai}</p>
        </div>
      </div>

      <AbilityAnalysis
        stats={stats}
        subjectStats={subjectStats}
        typeStats={typeStats}
        diffStats={diffStats}
        materiStats={materiStats}
        trend={trend}
        activityChart={activityChart}
      />

      {recommendations.length > 0 && (
        <div className="section">
          <h2 className="section-title">Rekomendasi Untukmu</h2>
          <div className="rec-grid">
            {recommendations.map((rec, i) => (
              <div key={i} className="rec-card">
                 <div className="rec-icon-svg">{RecIcons[rec.icon](false)}</div>
                <div className="rec-info">
                  <h3>{rec.title}</h3>
                  <p>{rec.desc}</p>
                </div>
                <button className="continue-btn" type="button" onClick={() => onTab(rec.action)}>{rec.actionLabel}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <div className="quick-actions-grid">
          <div className="quick-action-card quick-action-latihan" onClick={() => onTab('latihan')}>
            <div className="quick-action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div className="quick-action-info">
              <h3>Latihan</h3>
              <p>Kerjakan soal per mata pelajaran</p>
            </div>
            <span className="quick-action-arrow">→</span>
          </div>
          <div className="quick-action-card quick-action-simulasi" onClick={() => onTab('simulasi')}>
            <div className="quick-action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M12 18v-6" />
                <path d="M9 15h6" />
              </svg>
            </div>
            <div className="quick-action-info">
              <h3>Simulasi</h3>
              <p>{simulasiPkg?.title || 'Simulasi TKA'}</p>
            </div>
            <span className="quick-action-arrow">→</span>
          </div>
        </div>
      </div>

      {cropSrc && (
        <PhotoCropModal
          src={cropSrc}
          onCancel={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }}
          onSave={(blob) => {
            void uploadBlob(blob);
          }}
        />
      )}
    </div>
  );
}