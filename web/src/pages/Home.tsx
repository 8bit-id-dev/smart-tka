import { useEffect, useMemo, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';
import type { Tab } from '../AppShell';
import { Icons } from '../AppShell';
import { GamifQuickView } from '../components/GamifQuickView';

type AttemptRow = { score: number | null; status: string; submitted_at: string | null; package_id: string | null };
type AARow = { item_id: string; is_correct: boolean; items: { mapel: string }[] };
type PkgRow = { id: string; title: string; mapel: string; kind: string; item_count: number };
type ClassRow = { id: string; name: string; jenjang: string };
type GpRow = { xp: number; level: number; streak_current: number; streak_best: number };

const SUBJECT_ICONS: Record<string, string> = {
  'Matematika': '∑',
  'Bahasa Indonesia': 'Aa',
  'Bahasa Inggris': 'Ab',
  'IPA': '⚗',
  'IPS': '🌏',
};
const SUBJECT_COLORS: Record<string, string> = {
  'Matematika': 'subject-icon-math',
  'Bahasa Indonesia': 'subject-icon-indo',
  'Bahasa Inggris': 'subject-icon-inggris',
};

const JENJANG_LABEL: Record<string, string> = {
  sd: 'SD', smp: 'SMP', sma: 'SMA', smk: 'SMK',
  paket_a: 'Paket A', paket_b: 'Paket B', paket_c: 'Paket C',
};

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

export function Home({ name, profile, onTab }: { name: string; profile: AppProfile; onTab: (t: Tab) => void }) {
  const staf = ['guru', 'admin', 'kepsek', 'konten'].includes(profile.role);
  const isSiswa = profile.role === 'siswa';

  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [aa, setAa] = useState<AARow[]>([]);
  const [pkgs, setPkgs] = useState<PkgRow[]>([]);
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
        .select('id, title, mapel, kind, item_count')
        .order('kind')
        .order('mapel')
        .limit(50);
      if (!pk.error) setPkgs((pk.data || []) as PkgRow[]);

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

  useEffect(() => {
    if (!isSiswa || !attempts.length) return;
    void (async () => {
      const ids = attempts.map((a) => a.package_id).filter(Boolean);
      if (!ids.length) return;
      const { data } = await insforge.database
        .from('attempt_answers')
        .select('item_id, is_correct, items!inner(mapel)')
        .in('attempt_id', ids)
        .limit(1000);
      if (data) setAa(data as AARow[]);
    })();
  }, [attempts.length, isSiswa]);

  const stats = useMemo(() => {
    const submitted = attempts.filter((a) => a.status === 'submitted' && a.score != null);
    const soalDikerjakan = aa.length;
    const jawabanBenar = aa.filter((a) => a.is_correct).length;
    const akurasi = soalDikerjakan > 0 ? Math.round((jawabanBenar / soalDikerjakan) * 100) : 0;
    const rataSkor = submitted.length > 0
      ? Math.round((submitted.reduce((s, r) => s + Number(r.score), 0) / submitted.length) * 10) / 10
      : 0;
    return { soalDikerjakan, jawabanBenar, akurasi, rataSkor, simulasiSelesai: submitted.length };
  }, [attempts, aa]);

  const chartData = useMemo(() => {
    const submitted = attempts
      .filter((a) => a.status === 'submitted' && a.score != null && a.submitted_at)
      .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime())
      .slice(0, 7)
      .reverse();
    const data = submitted.map((a) => Number(a.score));
    const labels = submitted.map((a) => new Date(a.submitted_at!).toLocaleDateString('id-ID', { weekday: 'short' }));
    return { data, labels };
  }, [attempts]);

  const subjectStats = useMemo(() => {
    const byMapel: Record<string, { total: number; correct: number }> = {};
    for (const a of aa) {
      const mapel = Array.isArray(a.items) && a.items[0]?.mapel
        ? a.items[0].mapel
        : 'Lainnya';
      if (!byMapel[mapel]) byMapel[mapel] = { total: 0, correct: 0 };
      byMapel[mapel].total += 1;
      if (a.is_correct) byMapel[mapel].correct += 1;
    }
    return byMapel;
  }, [aa]);

  const recMapel = useMemo(() => {
    const entries = Object.entries(subjectStats).map(([name, v]) => ({
      name,
      akurasi: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      soal: v.total,
    }));
    return entries.sort((a, b) => a.akurasi - b.akurasi)[0];
  }, [subjectStats]);

  const simulasiPkg = useMemo(() => pkgs.find((p) => p.kind === 'simulasi') || pkgs[0], [pkgs]);
  const lastSimScore = useMemo(() => {
    const submitted = attempts.filter((a) => a.status === 'submitted' && a.score != null);
    return submitted.length > 0 ? Math.max(...submitted.map((a) => Number(a.score))) : 0;
  }, [attempts]);

  const [photoUrl, setPhotoUrl] = useState(profile.photo_url || '');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const avatarLetter = (profile.full_name || name || 'U').split(' ').map(p => p[0]).join('').slice(0, 1).toUpperCase();

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoErr('Hanya file gambar yang diperbolehkan.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoErr('Ukuran maksimal 2 MB.');
      return;
    }
    setPhotoLoading(true);
    setPhotoErr('');
    const ext = file.type.split('/')[1];
    const path = `${profile.id}.${ext}`;
    try {
      const { error, data } = await insforge.storage.from('profile-photos').upload(path, file);
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
    e.target.value = '';
  }

  async function deletePhoto() {
    if (!photoUrl) return;
    setPhotoLoading(true);
    setPhotoErr('');
    const fname = photoUrl.substring(photoUrl.lastIndexOf('/') + 1);
    try {
      const { error } = await insforge.storage.from('profile-photos').remove(fname);
      if (error) {
        setPhotoErr(error.message);
      } else {
        setPhotoUrl('');
        await insforge.database.from('profiles').update({ photo_url: null }).eq('id', profile.id);
      }
    } catch (e) {
      setPhotoErr(e instanceof Error ? e.message : 'Hapus gagal.');
    }
    setPhotoLoading(false);
  }

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
          <div className="avatar-wrap">
            {photoUrl ? (
              <img src={photoUrl} alt={name} className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">{avatarLetter}</div>
            )}
            {photoLoading && <div className="avatar-overlay">Menyimpan…</div>}
          </div>
          <div className="avatar-actions">
            <label className="avatar-btn" title="Ganti foto">
              {Icons.edit(true)}
              <input type="file" accept="image/*" onChange={uploadPhoto} style={{ display: 'none' }} />
            </label>
            {photoUrl && (
              <button className="avatar-btn" title="Hapus foto" onClick={deletePhoto} disabled={photoLoading}>
                {Icons.x(true)}
              </button>
            )}
            {photoErr && <div className="avatar-error">{photoErr}</div>}
          </div>
        </div>
        <div className="greeting-text">
          <h1>Selamat datang, {name.split(' ')[0]}!</h1>
          {myClass ? (
            <p className="greeting-sub">Kelas {myClass.name} · {JENJANG_LABEL[myClass.jenjang] || myClass.jenjang}</p>
          ) : (
            <p className="greeting-sub">Siap melanjutkan persiapan TKA hari ini?</p>
          )}
        </div>
      </div>

      <div className="section">
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 14 }}>Analisis Kemampuan</h3>
          {Object.keys(subjectStats).length === 0 ? (
            <p className="type-lab">Kerjakan soal untuk melihat analisis.</p>
          ) : (
            Object.entries(subjectStats).map(([mapel, v]) => {
              const pct = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
              const tag = pct >= 75 ? 'Kuat' : pct >= 50 ? 'Cukup' : 'Perlu ditingkatkan';
              const tagClass = pct >= 75 ? 'analysis-bar-tag-strong' : pct >= 50 ? 'analysis-bar-tag-improve' : 'analysis-bar-tag-improve';
              return (
                <div key={mapel} className="analysis-bar-row">
                  <span className="analysis-bar-label">{mapel}</span>
                  <div className="analysis-bar-track">
                    <div className="analysis-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="analysis-bar-pct">{pct}%</span>
                  <span className={`analysis-bar-tag ${tagClass}`}>{tag}</span>
                </div>
              );
            })
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

      <div className="grid-2 student-grid">
        <div className="col">
          <div className="section">
            <h2 className="section-title">Latihan TKA</h2>
            {pkgs.filter((p) => p.kind === 'latihan').length === 0 ? (
              <p className="type-lab">Belum ada paket latihan tersedia.</p>
            ) : (
              <div className="subject-hscroll">
                {pkgs.filter((p) => p.kind === 'latihan').slice(0, 8).map((p) => (
                  <div key={p.id} className="subject-card" onClick={() => onTab('latihan')}>
                    <div className="subject-card-header">
                      <div className={`subject-icon ${SUBJECT_COLORS[p.mapel] || 'subject-icon-other'}`}>
                        {SUBJECT_ICONS[p.mapel] || '📚'}
                      </div>
                      <div className="subject-meta">
                        <h4>{p.mapel || p.title}</h4>
                        <p>{p.item_count || 0} soal</p>
            {photoErr && <div className="avatar-error">{photoErr}</div>}
          </div>
        </div>
                    <button className="continue-btn" type="button" style={{ width: '100%' }}>Mulai</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <div className="featured-card">
              <div className="section-header" style={{ marginBottom: 8 }}>
                <h2 className="section-title" style={{ margin: 0 }}>Simulasi TKA</h2>
                <span className="badge badge-success">Aktif</span>
              </div>
              <div className="featured-grid">
                <div className="featured-stat">
                  <p className="featured-stat-label">Jumlah Soal</p>
                  <p className="featured-stat-value">{simulasiPkg?.item_count || 35}</p>
                </div>
                <div className="featured-stat">
                  <p className="featured-stat-label">Durasi</p>
                  <p className="featured-stat-value">90 mnt</p>
                </div>
                <div className="featured-stat">
                  <p className="featured-stat-label">Skor Terakhir</p>
                  <p className="featured-stat-value">{lastSimScore || '—'}</p>
                </div>
                <div className="featured-stat">
                  <p className="featured-stat-label">Skor Terbaik</p>
                  <p className="featured-stat-value">{lastSimScore || '—'}</p>
                </div>
              </div>
              <button className="continue-btn" type="button" style={{ width: '100%' }} onClick={() => onTab('simulasi')}>
                Mulai Simulasi
              </button>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="section">
            <div className="chart-card">
              <h3 className="card-title" style={{ margin: '0 0 8px' }}>Statistik Belajar</h3>
              <div className="chart-svg-wrap">
                <SimpleLineChart data={chartData.data} labels={chartData.labels} />
              </div>
            </div>
          </div>

          {recMapel && recMapel.akurasi < 70 && (
            <div className="section">
              <div className="rec-card">
                <div className="rec-icon">💡</div>
                <div className="rec-info">
                  <h3>Perkuat kemampuan {recMapel.name}</h3>
                  <p>Akurasi Anda di {recMapel.name} adalah {recMapel.akurasi}%. Lanjutkan latihan untuk meningkatkan pemahaman.</p>
                </div>
                <button className="continue-btn" type="button" onClick={() => onTab('latihan')}>Mulai Latihan</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}