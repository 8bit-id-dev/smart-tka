import { useEffect, useMemo, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';

type Attempt = {
  id: string;
  package_id: string;
  student_id: string;
  status: string;
  score: number | null;
  submitted_at: string | null;
  started_at: string;
  tab_leave_count?: number | null;
};
type Pkg = { id: string; title: string; mapel: string; kind: string };
type Prof = { id: string; full_name: string | null };
type Cls = { id: string; name: string };
type CS = { class_id: string; profile_id: string };

function fmt(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
}

export function Laporan({ me }: { me: AppProfile }) {
  const [rows, setRows] = useState<Attempt[]>([]);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [profs, setProfs] = useState<Prof[]>([]);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [cs, setCs] = useState<CS[]>([]);
  const [err, setErr] = useState('');
  const [fPkg, setFPkg] = useState('');
  const [fKelas, setFKelas] = useState('');

  async function load() {
    setErr('');
    const a = await insforge.database
      .from('attempts')
      .select('id, package_id, student_id, status, score, submitted_at, started_at, tab_leave_count');
    if (a.error) {
      setErr(
        a.error.message.includes('does not exist')
          ? 'Tabel attempts belum ada. Jalankan migrasi inti (001) di InsForge.'
          : a.error.message,
      );
    } else setRows((a.data || []) as Attempt[]);

    const p = await insforge.database.from('packages').select('id, title, mapel, kind');
    if (!p.error) setPkgs((p.data || []) as Pkg[]);
    const pr = await insforge.database.from('profiles').select('id, full_name').eq('role', 'siswa');
    if (!pr.error) setProfs((pr.data || []) as Prof[]);
    const c = await insforge.database.from('classes').select('id, name');
    if (!c.error) setClasses((c.data || []) as Cls[]);
    const m = await insforge.database.from('class_students').select('class_id, profile_id');
    if (!m.error) setCs((m.data || []) as CS[]);
  }

  useEffect(() => {
    void load();
  }, []);

  const pkgMap = useMemo(() => new Map(pkgs.map((p) => [p.id, p])), [pkgs]);
  const namaMap = useMemo(() => new Map(profs.map((p) => [p.id, p.full_name || p.id.slice(0, 8)])), [profs]);
  const kelasSiswa = useMemo(() => {
    const m = new Map<string, string>();
    const cn = new Map(classes.map((c) => [c.id, c.name]));
    for (const r of cs) m.set(r.profile_id, cn.get(r.class_id) || '');
    return m;
  }, [cs, classes]);

  const selesai = rows.filter((r) => r.status === 'submitted' || r.score != null);
  const filtered = selesai.filter((r) => {
    if (fPkg && r.package_id !== fPkg) return false;
    if (fKelas) {
      const kid = cs.find((x) => x.profile_id === r.student_id && x.class_id === fKelas);
      if (!kid) return false;
    }
    return true;
  });

  const avg =
    filtered.length === 0
      ? 0
      : Math.round((filtered.reduce((s, r) => s + Number(r.score || 0), 0) / filtered.length) * 100) / 100;

  function cetakPdf() {
    window.print();
  }

  if (!['guru', 'admin', 'kepsek'].includes(me.role)) {
    return (
      <div className="placeholder">
        <section className="card">
          <h2>Laporan</h2>
          <p>Hanya guru / admin / kepsek.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="placeholder laporan-page" style={{ maxWidth: 920 }}>
      <section className="card no-print">
        <h2>Laporan hasil paket</h2>
        <p className="type-lab">
          Skor dari pengumpulan simulasi/paket. Bukan prediksi nilai TKA resmi. Cetak → pilih “Simpan sebagai PDF”.
        </p>
        <div className="auth-form">
          <label>
            Filter paket
            <select className="sel-input" value={fPkg} onChange={(e) => setFPkg(e.target.value)}>
              <option value="">Semua paket</option>
              {pkgs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.mapel})
                </option>
              ))}
            </select>
          </label>
          <label>
            Filter kelas
            <select className="sel-input" value={fKelas} onChange={(e) => setFKelas(e.target.value)}>
              <option value="">Semua kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="login-actions">
          <button type="button" className="btn" onClick={cetakPdf}>
            Cetak / PDF
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Muat ulang
          </button>
        </div>
        {err && <p className="auth-msg">{err}</p>}
      </section>

      <section className="card laporan-cetak" style={{ marginTop: 16 }}>
        <header className="laporan-kop">
          <strong>SMART-TKA</strong>
          <p>Laporan hasil paket soal (internal sekolah)</p>
          <p className="type-lab">
            Dicetak {fmt(new Date().toISOString())} · {me.full_name || me.role}
          </p>
        </header>
        <div className="bento" style={{ marginBottom: 16 }}>
          <div className="card" style={{ boxShadow: 'none' }}>
            <p className="type-lab">Pengumpulan</p>
            <p className="type-hm" style={{ margin: 0 }}>
              {filtered.length}
            </p>
          </div>
          <div className="card" style={{ boxShadow: 'none' }}>
            <p className="type-lab">Rata-rata skor</p>
            <p className="type-hm" style={{ margin: 0 }}>
              {avg}
            </p>
          </div>
        </div>
        {filtered.length === 0 && (
          <p className="type-lab">Belum ada data. Siswa harus Kumpulkan paket di menu Simulasi.</p>
        )}
        <table className="laporan-tabel">
          <thead>
            <tr>
              <th>Siswa</th>
              <th>Kelas</th>
              <th>Paket</th>
              <th>Mapel</th>
              <th>Skor</th>
              <th>Pindah tab</th>
              <th>Waktu</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const p = pkgMap.get(r.package_id);
              return (
                <tr key={r.id}>
                  <td>{namaMap.get(r.student_id) || r.student_id.slice(0, 8)}</td>
                  <td>{kelasSiswa.get(r.student_id) || '—'}</td>
                  <td>{p?.title || (r.package_id ? r.package_id.slice(0, 8) : 'Latihan bebas')}</td>
                  <td>{p?.mapel || '—'}</td>
                  <td>
                    <strong>{r.score ?? '—'}</strong>
                  </td>
                  <td>{fmt(r.submitted_at || r.started_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="legal">
          SMART-TKA tidak berafiliasi dengan Kemendikdasmen. Angka ini hasil latihan/simulasi internal, bukan prediksi
          skor TKA resmi.
        </p>
      </section>
    </div>
  );
}
