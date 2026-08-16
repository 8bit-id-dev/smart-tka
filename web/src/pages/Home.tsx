import { useEffect, useMemo, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';
import type { Tab } from '../AppShell';
import { Icons } from '../AppShell';

type SubjectCard = { id: string; name: string; domain: string; count: number; difficulty: string; progress: number; icon: string; iconClass: string };

const SUBJECTS: SubjectCard[] = [
  { id: 'math', name: 'Matematika', domain: 'Bilangan & Aljabar', count: 120, difficulty: 'Sedang', progress: 68, icon: '∑', iconClass: 'subject-icon-math' },
  { id: 'indo', name: 'Bahasa Indonesia', domain: 'Tata bahasa & bacaan', count: 85, difficulty: 'Mudah', progress: 82, icon: 'Aa', iconClass: 'subject-icon-indo' },
  { id: 'inggris', name: 'Bahasa Inggris', domain: 'Vocabulary & grammar', count: 60, difficulty: 'Sedang', progress: 45, icon: 'Ab', iconClass: 'subject-icon-inggris' },
  { id: 'ipa', name: 'IPA', domain: 'Sains & alam', count: 40, difficulty: 'Sulit', progress: 30, icon: '⚗', iconClass: 'subject-icon-other' },
  { id: 'ips', name: 'IPS', domain: 'Sejarah & geografi', count: 35, difficulty: 'Sedang', progress: 55, icon: '🌏', iconClass: 'subject-icon-other' },
];

const ANALYSIS_DOMAINS = [
  { name: 'Bilangan', pct: 75, tag: 'Kuat', tagClass: 'analysis-bar-tag-strong' },
  { name: 'Aljabar', pct: 40, tag: 'Perlu ditingkatkan', tagClass: 'analysis-bar-tag-improve' },
  { name: 'Geometri', pct: 60, tag: 'Cukup', tagClass: 'analysis-bar-tag-improve' },
  { name: 'Data & Peluang', pct: 85, tag: 'Kuat', tagClass: 'analysis-bar-tag-strong' },
];

const CHART_DATA_WEEKLY = [30, 45, 60, 35, 70, 55, 80];
const CHART_DATA_MONTHLY = [20, 35, 50, 45, 60, 55, 70, 65, 80, 75, 85, 90];
const CHART_LABELS_WEEKLY = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const CHART_LABELS_MONTHLY = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function SimpleLineChart({ data, labels, color = '#000000' }: { data: number[]; labels: string[]; color?: string }) {
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

export function Home({ name, profile, onTab }: { name: string; profile: AppProfile; onTab: (t: Tab) => void }) {
  const staf = ['guru', 'admin', 'kepsek', 'konten'].includes(profile.role);
  const [stats, setStats] = useState({ soalDikerjakan: 0, jawabanBenar: 0, akurasi: 0, rataSkor: 0, simulasiSelesai: 0 });
  const [chartTab, setChartTab] = useState<'aktivitas' | 'soal' | 'skor'>('aktivitas');
  const [chartRange, setChartRange] = useState<'mingguan' | 'bulanan' | 'semester'>('mingguan');
  const [filterMapel, setFilterMapel] = useState('Semua');

  useEffect(() => {
    if (staf) return;
    void (async () => {
      const { data, error } = await insforge.database
        .from('attempts')
        .select('score, status')
        .eq('student_id', profile.id);
      if (error) return;
      const rows = ((data || []) as { score: number | null; status: string }[]).filter(
        (r) => r.status === 'submitted' && r.score != null,
      );
      if (rows.length === 0) {
        setStats({ soalDikerjakan: 0, jawabanBenar: 0, akurasi: 0, rataSkor: 0, simulasiSelesai: 0 });
        return;
      }
      const avg = Math.round((rows.reduce((s, r) => s + Number(r.score), 0) / rows.length) * 10) / 10;
      setStats({
        soalDikerjakan: rows.length * 10,
        jawabanBenar: Math.round(rows.length * 6.5),
        akurasi: Math.round((rows.length * 6.5) / (rows.length * 10) * 100),
        rataSkor: avg,
        simulasiSelesai: Math.floor(rows.length * 0.4),
      });
    })();
  }, [profile.id, staf]);

  const chartData = useMemo(() => {
    if (chartRange === 'mingguan') return CHART_DATA_WEEKLY;
    if (chartRange === 'bulanan') return CHART_DATA_MONTHLY;
    return CHART_DATA_MONTHLY.map(v => Math.min(100, v + Math.floor(Math.random() * 10 - 5)));
  }, [chartRange]);

  const chartLabels = chartRange === 'mingguan' ? CHART_LABELS_WEEKLY : CHART_LABELS_MONTHLY;

  if (staf) {
    const pintas: { id: Tab; t: string; d: string; detail: string; icon: React.ReactNode }[] = [
      { id: 'soal', t: 'Soal', d: 'Tulis atau draf AI', detail: 'Buat, edit, dan kelola soal TKA', icon: Icons.soal(true) },
      { id: 'paket', t: 'Paket', d: 'Rakit latihan / ujian', detail: 'Rakit dan atur paket latihan UTK', icon: Icons.paket(true) },
      { id: 'kelas', t: 'Kelas', d: 'Siswa, pindah, kenaikan', detail: 'Kelola anggota dan kenaikan kelas', icon: Icons.kelas(true) },
      { id: 'laporan', t: 'Laporan', d: 'Skor & cetak PDF', detail: 'Lihat rekap skor dan ekspor PDF', icon: Icons.laporan(true) },
    ];
    if (['admin', 'kepsek'].includes(profile.role)) pintas.push({ id: 'admin', t: 'Admin', d: 'Impor user & assignment', detail: 'Kelola pengguna dan assignment sekolah', icon: Icons.admin(true) });
    return (
      <div className="dashboard-page">
        <header className="page-header">
          <p className="page-subtitle">Halo, {name}</p>
          <h1 className="page-title">Kerja sekolah</h1>
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

  return (
    <div className="dashboard-page">
      {/* Greeting */}
      <div className="greeting-card">
        <div>
          <h1>Selamat datang kembali, {name.split(' ')[0]}! 👋</h1>
          <p>Siap melanjutkan persiapan TKA hari ini?</p>
        </div>
        <svg className="greeting-illustration" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="50" fill="#f0f0f0" />
          <circle cx="45" cy="52" r="14" fill="#000000" opacity={0.06} />
          <circle cx="75" cy="52" r="14" fill="#000000" opacity={0.06} />
          <path d="M45 52 L60 68 L75 52" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="42" cy="50" r="2" fill="#000000" />
          <circle cx="72" cy="50" r="2" fill="#000000" />
          <path d="M36 42 Q42 36 48 42" stroke="#000000" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M66 42 Q72 36 78 42" stroke="#000000" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      {/* Continue Learning */}
      <div className="continue-card">
        <div className="continue-icon">∑</div>
        <div className="continue-info">
          <h3>Matematika — Bilangan</h3>
          <p>10 soal tersisa · Akurasi 68%</p>
          <div className="continue-progress">
            <div className="continue-progress-bar" style={{ width: '68%' }} />
          </div>
        </div>
        <button className="continue-btn" type="button" onClick={() => onTab('latihan')}>Lanjutkan</button>
      </div>

      {/* Quick Stats */}
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
          <div className="stat-icon" style={{ background: 'var(--gold-soft)', color: 'var(--gold)' }}>%</div>          <p className="stat-label">Akurasi</p>
          <p className="stat-value">{stats.akurasi}%</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>★</div>
          <p className="stat-label">Rata-rata Skor</p>
          <p className="stat-value">{stats.rataSkor}</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>⏱</div>
          <p className="stat-label">Simulasi Selesai</p>
          <p className="stat-value">{stats.simulasiSelesai}</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="col">
          {/* Subject filter + Latihan TKA */}
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Latihan TKA</h2>
            </div>
            <div className="filter-tabs">
              {['Semua', 'Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'Lainnya'].map((m) => (
                <button key={m} className={`filter-tab ${filterMapel === m ? 'active' : ''}`} type="button" onClick={() => setFilterMapel(m)}>
                  {m}
                </button>
              ))}
            </div>
            <div className="subject-hscroll">
              {SUBJECTS.filter(s => filterMapel === 'Semua' || s.name.includes(filterMapel) || (filterMapel === 'Lainnya' && !['Matematika','Bahasa Indonesia','Bahasa Inggris'].includes(s.name))).map((s) => (
                <div key={s.id} className="subject-card">
                  <div className="subject-card-header">
                    <div className={`subject-icon ${s.iconClass}`}>{s.icon}</div>
                    <div className="subject-meta">
                      <h4>{s.name}</h4>
                      <p>{s.domain}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={`subject-badge subject-badge-${s.difficulty === 'Mudah' ? 'mudah' : s.difficulty === 'Sedang' ? 'sedang' : 'sulit'}`}>{s.difficulty}</span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{s.count} soal</span>
                  </div>
                  <div className="mini-progress">
                    <div className="mini-progress-bar" style={{ width: `${s.progress}%` }} />
                  </div>
                  <button className="continue-btn" type="button" style={{ width: '100%' }} onClick={() => onTab('latihan')}>
                    {s.progress > 0 ? 'Lanjutkan' : 'Mulai'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Simulasi TKA */}
          <div className="section">
            <div className="featured-card">
              <div className="section-header" style={{ marginBottom: 8 }}>
                <h2 className="section-title" style={{ margin: 0 }}>Simulasi TKA</h2>
                <span className="badge badge-success">Aktif</span>
              </div>
              <div className="featured-grid">
                <div className="featured-stat">
                  <p className="featured-stat-label">Jumlah Soal</p>
                  <p className="featured-stat-value">35</p>
                </div>
                <div className="featured-stat">
                  <p className="featured-stat-label">Durasi</p>
                  <p className="featured-stat-value">90 mnt</p>
                </div>
                <div className="featured-stat">
                  <p className="featured-stat-label">Skor Terakhir</p>
                  <p className="featured-stat-value">72</p>
                </div>
                <div className="featured-stat">
                  <p className="featured-stat-label">Skor Terbaik</p>
                  <p className="featured-stat-value">85</p>
                </div>
              </div>
              <button className="continue-btn" type="button" style={{ width: '100%' }} onClick={() => onTab('simulasi')}>Mulai Simulasi</button>
            </div>
          </div>

          {/* Analisis Kemampuan */}
          <div className="section">
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 14 }}>Analisis Kemampuan</h3>
              {ANALYSIS_DOMAINS.map((d) => (
                <div key={d.name} className="analysis-bar-row">
                  <span className="analysis-bar-label">{d.name}</span>
                  <div className="analysis-bar-track">
                    <div className="analysis-bar-fill" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="analysis-bar-pct">{d.pct}%</span>
                  <span className={`analysis-bar-tag ${d.tagClass}`}>{d.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col">
          {/* Statistik Belajar */}
          <div className="section">
            <div className="chart-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div className="chart-tabs">
                  {(['aktivitas', 'soal', 'skor'] as const).map((t) => (
                    <button key={t} className={`chart-tab ${chartTab === t ? 'active' : ''}`} type="button" onClick={() => setChartTab(t)}>
                      {t === 'aktivitas' ? 'Aktivitas' : t === 'soal' ? 'Soal' : 'Skor'}
                    </button>
                  ))}
                </div>
                <div className="chart-time-filter">
                  {(['mingguan', 'bulanan', 'semester'] as const).map((r) => (
                    <button key={r} className={`chart-time-btn ${chartRange === r ? 'active' : ''}`} type="button" onClick={() => setChartRange(r)}>
                      {r === 'mingguan' ? 'Mingguan' : r === 'bulanan' ? 'Bulanan' : 'Semester'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="chart-svg-wrap">
                <SimpleLineChart data={chartData} labels={chartLabels} />
              </div>
            </div>
          </div>

          {/* Rekomendasi */}
          <div className="section">
            <div className="rec-card">
              <div className="rec-icon">💡</div>
              <div className="rec-info">
                <h3>Perkuat kemampuan Aljabar</h3>
                <p>Akurasi Anda di Aljabar adalah 40%. Lanjutkan latihan untuk meningkatkan pemahaman.</p>
              </div>
              <button className="continue-btn" type="button" onClick={() => onTab('latihan')}>Mulai Latihan</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}