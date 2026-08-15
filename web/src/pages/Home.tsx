import { useEffect, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';
import type { Tab } from '../AppShell';

export function Home({
  name,
  profile,
  onTab,
}: {
  name: string;
  profile: AppProfile;
  onTab: (t: Tab) => void;
}) {
  const staf = ['guru', 'admin', 'kepsek', 'konten'].includes(profile.role);
  const [rata, setRata] = useState<number | null>(null);
  const [nSesi, setNSesi] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (staf) return;
    void (async () => {
      const { data, error } = await insforge.database
        .from('attempts')
        .select('score, status')
        .eq('student_id', profile.id);
      if (error) {
        setErr(error.message);
        return;
      }
      const rows = ((data || []) as { score: number | null; status: string }[]).filter(
        (r) => r.status === 'submitted' && r.score != null,
      );
      setNSesi(rows.length);
      if (rows.length === 0) setRata(null);
      else setRata(Math.round((rows.reduce((s, r) => s + Number(r.score), 0) / rows.length) * 10) / 10);
    })();
  }, [profile.id, staf]);

  const value = rata == null ? 0 : Math.min(100, Math.max(0, rata));
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - (rata == null ? 0 : value / 100));

  if (staf) {
    const pintas: { id: Tab; t: string; d: string; icon: string }[] = [
      { id: 'soal', t: 'Soal', d: 'Tulis atau draf AI', icon: 'P' },
      { id: 'paket', t: 'Paket', d: 'Rakit latihan / ujian', icon: 'K' },
      { id: 'kelas', t: 'Kelas', d: 'Siswa, pindah, kenaikan', icon: 'S' },
      { id: 'laporan', t: 'Laporan', d: 'Skor & cetak PDF', icon: 'L' },
    ];
    if (['admin', 'kepsek'].includes(profile.role)) pintas.push({ id: 'admin', t: 'Admin', d: 'Impor user & assignment', icon: 'A' });
    return (
      <div className="page">
        <header className="page-header">
          <p className="page-subtitle">Halo, {name}</p>
          <h1 className="page-title">Kerja sekolah</h1>
          <p className="page-subtitle" style={{ maxWidth: 500 }}>
            SMART-TKA persiapan internal. Bukan aplikasi resmi Kemendikdasmen. Tes Kemampuan Akademik.
          </p>
        </header>
        <section className="section">
          <div className="bento">
            {pintas.map((p) => (
              <article key={p.id} className="card" style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }} onClick={() => onTab(p.id)} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--teal-soft)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>{p.icon}</div>
                  <div>
                    <h3 className="card-title" style={{ margin: '0 0 4px' }}>{p.t}</h3>
                    <p className="card-subtitle" style={{ margin: 0 }}>{p.d}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="page-subtitle">Halo, {name}</p>
        <h1 className="page-title">Siap TKA karena menguasai</h1>
        <p className="page-subtitle" style={{ maxWidth: 500 }}>
          Angka ini rata-rata skor latihan/simulasi Anda di SMART-TKA — bukan prediksi Tes Kemampuan Akademik resmi.
        </p>
      </header>
      {err && <div className="banner banner-danger"><p className="banner-text">{err}</p></div>}

      <section className="section">
        <div className="bento">
          <article className="card ring-wrap">
            <div className="ring">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={r} fill="none" stroke={value === 0 ? 'var(--card-border)' : 'var(--teal-light)'} strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke="var(--teal)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className="ring-label">
                {rata == null ? '—' : Math.round(value)}
                {rata != null && <small>%</small>}
              </div>
            </div>
            <p className="type-lab" style={{ margin: 0 }}>
              {nSesi === 0 ? 'Belum ada sesi terkumpul' : `Rata-rata ${nSesi} sesi`}
            </p>
            <div className="actions" style={{ width: '100%' }}>
              <button className="btn btn-primary" type="button" onClick={() => onTab('latihan')}>
                Mulai latihan
              </button>
            </div>
          </article>

          <article className="card topic">
            <div className="topic-head">
              <div>
                <h3>Latihan terarah</h3>
                <p className="meta">Pilih mapel, kunci jawaban, pembahasan langsung</p>
              </div>
            </div>
            <p>Kerjakan soal sekolah Anda. Skor tersimpan di laporan guru setelah sesi selesai.</p>
            <div className="topic-foot">
              <span>Bukan nilai TKA resmi</span>
              <button type="button" className="link" onClick={() => onTab('simulasi')}>
                Simulasi paket →
              </button>
            </div>
          </article>
        </div>
      </section>

      <section className="section">
        <header className="section-header">
          <h2 className="section-title">Menu cepat</h2>
        </header>
        <div className="bento">
          <article className="card" style={{ cursor: 'pointer' }} onClick={() => onTab('latihan')}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--teal-soft)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>L</div>
            <h3 className="card-title">Latihan Bebas</h3>
            <p className="card-subtitle">Soal per mapel dengan pembahasan langsung</p>
          </article>
          <article className="card" style={{ cursor: 'pointer' }} onClick={() => onTab('simulasi')}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--teal-soft)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>S</div>
            <h3 className="card-title">Simulasi Paket</h3>
            <p className="card-subtitle">Ujian lengkap dengan timer dan pembahasan akhir</p>
          </article>
          <article className="card" style={{ cursor: 'pointer' }} onClick={() => onTab('inbox')}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--teal-soft)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>I</div>
            <h3 className="card-title">Kotak Masuk</h3>
            <p className="card-subtitle">Pengumuman dan tugas dari guru</p>
          </article>
          <article className="card" style={{ cursor: 'pointer' }} onClick={() => onTab('laporan')}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--teal-soft)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>R</div>
            <h3 className="card-title">Laporan Saya</h3>
            <p className="card-subtitle">Riwayat nilai dan progres belajar</p>
          </article>
        </div>
      </section>
    </div>
  );
}
