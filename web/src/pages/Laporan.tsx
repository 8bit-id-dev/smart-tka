import { useEffect, useMemo, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';

type Attempt = {
  id: string;
  package_id: string | null;
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

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function calcDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return '—';
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return '—';
  const sec = Math.floor((end - start) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} dtk`;
  return `${m} mnt ${s} dtk`;
}

function LaporanSiswa({ me }: { me: AppProfile }) {
  const [rows, setRows] = useState<Attempt[]>([]);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterKind, setFilterKind] = useState<string>('semua'); // semua | simulasi | latihan

  async function load() {
    setErr('');
    setLoading(true);
    const { data: aData, error: aErr } = await insforge.database
      .from('attempts')
      .select('id, package_id, student_id, status, score, started_at, submitted_at')
      .eq('student_id', me.id);

    if (aErr) {
      setErr(aErr.message);
    } else {
      const sorted = ((aData || []) as Attempt[]).sort((x, y) => {
        const tx = new Date(x.submitted_at || x.started_at).getTime();
        const ty = new Date(y.submitted_at || y.started_at).getTime();
        return ty - tx;
      });
      setRows(sorted);
    }

    const { data: pData } = await insforge.database.from('packages').select('id, title, mapel, kind');
    if (pData) setPkgs(pData as Pkg[]);

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [me.id]);

  const pkgMap = useMemo(() => new Map(pkgs.map((p) => [p.id, p])), [pkgs]);

  const submittedRows = useMemo(
    () => rows.filter((r) => r.status === 'submitted' && r.score != null),
    [rows],
  );

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const p = r.package_id ? pkgMap.get(r.package_id) : null;
      const kind = p ? p.kind : 'latihan';
      if (filterKind === 'simulasi' && kind !== 'simulasi') return false;
      if (filterKind === 'latihan' && kind === 'simulasi') return false;
      return true;
    });
  }, [rows, pkgMap, filterKind]);

  const totalSesi = submittedRows.length;
  const avgScore =
    totalSesi === 0
      ? null
      : Math.round((submittedRows.reduce((s, r) => s + Number(r.score || 0), 0) / totalSesi) * 10) / 10;
  const maxScore =
    totalSesi === 0 ? null : Math.max(...submittedRows.map((r) => Number(r.score || 0)));

  return (
    <div className="placeholder laporan-page" style={{ maxWidth: 920 }}>
      <section className="card no-print">
        <h2>Laporan Hasil Latihan & Simulasi</h2>
        <p className="type-lab">
          Riwayat pengerjaan paket simulasi dan latihan bebas Anda di SMART-TKA.
        </p>

        <div className="bento" style={{ marginTop: 16, marginBottom: 16 }}>
          <div className="card" style={{ boxShadow: 'none', background: 'var(--surface-variant, #f4f0ea)' }}>
            <p className="type-lab">Total Sesi Selesai</p>
            <p className="type-hm" style={{ margin: 0, color: 'var(--teal)' }}>
              {totalSesi}
            </p>
          </div>
          <div className="card" style={{ boxShadow: 'none', background: 'var(--surface-variant, #f4f0ea)' }}>
            <p className="type-lab">Rata-Rata Nilai</p>
            <p className="type-hm" style={{ margin: 0, color: 'var(--teal)' }}>
              {avgScore == null ? '—' : avgScore}
            </p>
          </div>
          <div className="card" style={{ boxShadow: 'none', background: 'var(--surface-variant, #f4f0ea)' }}>
            <p className="type-lab">Nilai Tertinggi</p>
            <p className="type-hm" style={{ margin: 0, color: 'var(--teal)' }}>
              {maxScore == null ? '—' : maxScore}
            </p>
          </div>
        </div>

        <div className="auth-form" style={{ marginTop: 12 }}>
          <label>
            Filter Jenis Sesi
            <select
              className="sel-input"
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
            >
              <option value="semua">Semua Sesi</option>
              <option value="simulasi">Simulasi Paket</option>
              <option value="latihan">Latihan Bebas</option>
            </select>
          </label>
        </div>

        <div className="login-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Muat ulang
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            Cetak / PDF
          </button>
        </div>

        {err && <p className="auth-msg">{err}</p>}
      </section>

      <section className="card laporan-cetak" style={{ marginTop: 16 }}>
        <header className="laporan-kop">
          <strong>SMART-TKA</strong>
          <p>Laporan Hasil Latihan & Simulasi Siswa</p>
          <p className="type-lab">
            Nama: <strong>{me.full_name || 'Siswa'}</strong> · Dicetak: {fmtDate(new Date().toISOString())}
          </p>
        </header>

        {loading ? (
          <p className="type-lab">Memuat riwayat pengerjaan…</p>
        ) : filteredRows.length === 0 ? (
          <p className="type-lab" style={{ padding: '16px 0' }}>
            Belum ada riwayat pengerjaan {filterKind !== 'semua' ? `(${filterKind})` : ''}. Silakan kerjakan soal di menu Latihan atau Simulasi.
          </p>
        ) : (
          <table className="laporan-tabel">
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal Pengerjaan</th>
                <th>Jenis & Judul</th>
                <th>Mapel</th>
                <th>Waktu Pengerjaan</th>
                <th>Nilai / Hasil</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, idx) => {
                const p = r.package_id ? pkgMap.get(r.package_id) : null;
                const title = p?.title || (r.package_id ? `Paket (${r.package_id.slice(0, 8)})` : 'Latihan Bebas');
                const mapel = p?.mapel || '—';
                const durasi = calcDuration(r.started_at, r.submitted_at);
                const isSubmitted = r.status === 'submitted';

                return (
                  <tr key={r.id}>
                    <td>{idx + 1}</td>
                    <td>{fmtDate(r.submitted_at || r.started_at)}</td>
                    <td>
                      <strong>{title}</strong>
                      {p?.kind && (
                        <span className="type-lab" style={{ display: 'block', fontSize: 11 }}>
                          {p.kind}
                        </span>
                      )}
                    </td>
                    <td>{mapel}</td>
                    <td>{durasi}</td>
                    <td>
                      {isSubmitted ? (
                        <strong style={{ color: 'var(--teal)', fontSize: 15 }}>
                          {r.score ?? 0} <small style={{ fontSize: 11, fontWeight: 400 }}>/ 100</small>
                        </strong>
                      ) : (
                        <span className="type-lab" style={{ color: '#d97706' }}>
                          Belum Selesai
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <p className="legal">
          SMART-TKA tidak berafiliasi dengan Kemendikdasmen. Angka ini hasil latihan/simulasi internal, bukan prediksi skor TKA resmi.
        </p>
      </section>
    </div>
  );
}

export function Laporan({ me }: { me: AppProfile }) {
  if (me.role === 'siswa') {
    return <LaporanSiswa me={me} />;
  }

  if (!['guru', 'admin', 'kepsek', 'konten'].includes(me.role)) {
    return (
      <div className="placeholder">
        <section className="card">
          <h2>Laporan</h2>
          <p>Akses laporan tidak tersedia untuk akun ini.</p>
        </section>
      </div>
    );
  }

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
              const p = r.package_id ? pkgMap.get(r.package_id) : null;
              return (
                <tr key={r.id}>
                  <td>{namaMap.get(r.student_id) || r.student_id.slice(0, 8)}</td>
                  <td>{kelasSiswa.get(r.student_id) || '—'}</td>
                  <td>{p?.title || (r.package_id ? r.package_id.slice(0, 8) : 'Latihan bebas')}</td>
                  <td>{p?.mapel || '—'}</td>
                  <td>
                    <strong>{r.score ?? '—'}</strong>
                  </td>
                  <td>{r.tab_leave_count ?? 0}</td>
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
