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
    const pintas: { id: Tab; t: string; d: string }[] = [
      { id: 'soal', t: 'Soal', d: 'Tulis atau draf AI' },
      { id: 'paket', t: 'Paket', d: 'Rakit latihan / ujian' },
      { id: 'kelas', t: 'Kelas', d: 'Siswa, pindah, kenaikan' },
      { id: 'laporan', t: 'Laporan', d: 'Skor & cetak PDF' },
    ];
    if (['admin', 'kepsek'].includes(profile.role)) pintas.push({ id: 'admin', t: 'Admin', d: 'Impor user & assignment' });
    return (
      <div className="board" style={{ paddingTop: 8 }}>
        <p className="board-sub">Halo, {name}</p>
        <h1 className="type-hl" style={{ color: 'var(--teal)', marginTop: 0 }}>
          Kerja sekolah
        </h1>
        <p className="caption" style={{ maxWidth: 420, marginBottom: 24 }}>
          SMART-TKA persiapan internal. Bukan aplikasi resmi Kemendikdasmen. Tes Kemampuan Akademik.
        </p>
        <div className="bento">
          {pintas.map((p) => (
            <section key={p.id} className="card" style={{ cursor: 'pointer' }} onClick={() => onTab(p.id)}>
              <h3 style={{ margin: '0 0 6px' }}>{p.t}</h3>
              <p className="meta" style={{ margin: 0 }}>
                {p.d}
              </p>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="board" style={{ paddingTop: 8 }}>
      <p className="board-sub">Halo, {name}</p>
      <h1 className="type-hl" style={{ color: 'var(--teal)', marginTop: 0 }}>
        Siap TKA karena menguasai
      </h1>
      <p className="caption" style={{ maxWidth: 420, marginBottom: 28 }}>
        Angka ini rata-rata skor latihan/simulasi Anda di SMART-TKA — bukan prediksi Tes Kemampuan Akademik resmi.
      </p>
      {err && <p className="auth-msg">{err}</p>}

      <div className="bento" style={{ marginBottom: 16 }}>
        <section className="card ring-wrap">
          <div className="ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={r} fill="none" stroke="#E6E1D8" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="#0F6B6B"
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
          <button className="btn" type="button" onClick={() => onTab('latihan')}>
            Mulai latihan
          </button>
        </section>

        <section className="card topic">
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
        </section>
      </div>
    </div>
  );
}
