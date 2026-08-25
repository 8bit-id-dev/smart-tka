import { useEffect, useMemo, useState, useCallback } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';
import { Icons, type Tab } from '../AppShell';
import { FilterSelect } from '../components/FilterSelect';

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

const UJIAN_KINDS = ['simulasi', 'ujian_kelas', 'lab_25'];
const isUjian = (kind: string) => UJIAN_KINDS.includes(kind);
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
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function SortIcon({ state, level }: { state: 'none' | 'asc' | 'desc'; level?: number }) {
  const on = 'var(--accent)';
  const off = 'var(--muted-light)';
  return (
    <span className="sort-wrap">
      <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden>
        <path d="M6 2 L9 6 H3 Z" fill={state === 'asc' ? on : off} />
        <path d="M6 12 L9 8 H3 Z" fill={state === 'desc' ? on : off} />
      </svg>
      {level != null && <span className="sort-level">{level}</span>}
    </span>
  );
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

function escapeCsv(val: string | number | null | undefined): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function LaporanSiswa({ me, onTab }: { me: AppProfile; onTab?: (t: 'beranda' | 'latihan' | 'simulasi' | 'inbox' | 'soal' | 'paket' | 'kelas' | 'pengumuman' | 'laporan' | 'admin' | 'profil') => void }) {
  const [rows, setRows] = useState<Attempt[]>([]);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterKind, setFilterKind] = useState<string>('semua');

  async function load() {
    setErr('');
    setLoading(true);
    const { data: aData, error: aErr } = await insforge.database
      .from('attempts')
      .select('id, package_id, student_id, status, score, started_at, submitted_at')
      .eq('student_id', me.id);
    if (aErr) setErr(aErr.message);
    else {
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

  useEffect(() => { void load(); }, [me.id]);

  const pkgMap = useMemo(() => new Map(pkgs.map((p) => [p.id, p])), [pkgs]);
  const submittedRows = useMemo(
    () => rows.filter((r) => r.status === 'submitted' && r.score != null),
    [rows],
  );

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const p = r.package_id ? pkgMap.get(r.package_id) : null;
      const kind = p ? p.kind : 'latihan';
      if (filterKind === 'latihan' && isUjian(kind)) return false;
      if (filterKind === 'ujian' && !isUjian(kind)) return false;
      return true;
    });
  }, [rows, pkgMap, filterKind]);

  const totalSesi = submittedRows.length;
  const avgScore = totalSesi === 0 ? null : Math.round((submittedRows.reduce((s, r) => s + Number(r.score || 0), 0) / totalSesi) * 10) / 10;
  const maxScore = totalSesi === 0 ? null : Math.max(...submittedRows.map((r) => Number(r.score || 0)));

  const domainStats = useMemo(() => {
    const byDomain: Record<string, { total: number; count: number }> = {};
    for (const r of submittedRows) {
      const p = r.package_id ? pkgMap.get(r.package_id) : null;
      const mapel = p?.mapel || 'Lainnya';
      if (!byDomain[mapel]) byDomain[mapel] = { total: 0, count: 0 };
      byDomain[mapel].total += Number(r.score || 0);
      byDomain[mapel].count += 1;
    }
    return Object.entries(byDomain).map(([name, v]) => ({
      name,
      avg: v.count ? Math.round(v.total / v.count) : 0,
      count: v.count,
    })).sort((a, b) => a.avg - b.avg);
  }, [submittedRows, pkgMap]);

  function downloadCSV() {
    const headers = ['No', 'Tanggal', 'Jenis', 'Judul', 'Mapel', 'Durasi', 'Nilai', 'Status'];
    const lines = [headers.join(',')];
    filteredRows.forEach((r, idx) => {
      const p = r.package_id ? pkgMap.get(r.package_id) : null;
      const title = p?.title || (r.package_id ? `Paket (${r.package_id.slice(0, 8)})` : 'Latihan Bebas');
      const mapel = p?.mapel || '—';
      const kind = p?.kind || 'latihan';
      const durasi = calcDuration(r.started_at, r.submitted_at);
      const isSubmitted = r.status === 'submitted';
      const row = [
        idx + 1,
        fmtDate(r.submitted_at || r.started_at),
        kind,
        title,
        mapel,
        durasi,
        isSubmitted ? String(r.score ?? 0) : '—',
        isSubmitted ? 'Selesai' : 'Belum Selesai',
      ].map(escapeCsv);
      lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-${me.full_name || 'siswa'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <p className="page-subtitle">Hasil belajar Anda</p>
        <h1 className="page-title">Laporan Hasil</h1>
        <p className="page-subtitle">Riwayat pengerjaan paket simulasi dan latihan bebas.</p>
      </header>

      {err && (
        <div className="banner banner-danger" style={{ marginBottom: 20, whiteSpace: 'pre-wrap' }}>
          <p className="banner-text">{err}</p>
        </div>
      )}

      <section className="card stat-card" style={{ marginBottom: 20 }}>
        <div className="stat-card-content">
          <div className="stat-main">
            <p className="stat-label">Rata-rata Nilai</p>
            <p className="stat-value-large">{avgScore == null ? '—' : avgScore}<small>/100</small></p>
            <p className="stat-sub">{totalSesi === 0 ? 'Belum ada sesi terkumpul' : `Berdasarkan ${totalSesi} sesi selesai`}</p>
          </div>
          <div className="stat-side">
            <div className="stat-item">
              <p className="stat-label">Tertinggi</p>
              <p className="stat-value">{maxScore == null ? '—' : maxScore}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Total Sesi</p>
              <p className="stat-value">{totalSesi}</p>
            </div>
          </div>
        </div>
      </section>

      {domainStats.length > 0 && (
        <section className="card" style={{ marginBottom: 20 }}>
          <h3 className="card-title">Performa per Mapel</h3>
          {domainStats.map((d) => (
            <div key={d.name} className="analysis-bar-row">
              <span className="analysis-bar-label">{d.name}</span>
              <div className="analysis-bar-track">
                <div className="analysis-bar-fill" style={{ width: `${d.avg}%`, background: d.avg < 50 ? 'var(--warn)' : d.avg < 70 ? 'var(--gold)' : 'var(--accent)' }} />
              </div>
              <span className="analysis-bar-pct">{d.avg}%</span>
            </div>
          ))}
        </section>
      )}

      {domainStats.length > 0 && domainStats[0]?.avg < 70 && (
        <section className="rec-card" style={{ marginBottom: 20 }}>
          <div className="rec-icon">💡</div>
          <div className="rec-info">
            <h3>Perkuat {domainStats[0].name}</h3>
            <p>Rata-rata Anda di {domainStats[0].name} adalah {domainStats[0].avg}%. Lanjutkan latihan untuk meningkatkan pemahaman.</p>
          </div>
          {onTab && <button className="continue-btn" type="button" onClick={() => onTab('latihan')}>Mulai Latihan</button>}
        </section>
      )}

      <section className="card">
        <div className="lap-header">
          <h3 className="card-title">Riwayat Pengerjaan</h3>
          <div className="lap-actions">
            <div className="lap-tab" role="tablist">
              <button type="button" role="tab" className={`lap-tab-btn ${filterKind === 'semua' ? 'active' : ''}`} onClick={() => setFilterKind('semua')}>Semua</button>
              <button type="button" role="tab" className={`lap-tab-btn ${filterKind === 'latihan' ? 'active' : ''}`} onClick={() => setFilterKind('latihan')}>Latihan</button>
              <button type="button" role="tab" className={`lap-tab-btn ${filterKind === 'ujian' ? 'active' : ''}`} onClick={() => setFilterKind('ujian')}>Ujian</button>
            </div>
            {filteredRows.length > 0 && (
<button type="button" className="btn btn-outline" onClick={downloadCSV}>
                {Icons.download()} Download
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading-state"><p>Memuat riwayat…</p></div>
        ) : filteredRows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3 className="empty-state-title">Belum ada riwayat</h3>
            <p className="empty-state-text">Silakan kerjakan soal di menu Latihan atau Simulasi.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Tanggal</th>
                  <th>Jenis & Judul</th>
                  <th>Mapel</th>
                  <th>Durasi</th>
                  <th>Nilai</th>
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
                        {p?.kind && <span className="table-meta">{p.kind}</span>}
                      </td>
                      <td>{mapel}</td>
                      <td className="text-muted">{durasi}</td>
                      <td>
                        {isSubmitted ? (
                          <strong className="score-value">{r.score ?? 0}<small>/100</small></strong>
                        ) : (
                          <span className="score-pending">Belum Selesai</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="disclaimer">SMART-TKA tidak berafiliasi dengan Kemendikdasmen. Angka ini hasil latihan/simulasi internal.</p>
      </section>
    </div>
  );
}

export function Laporan({ me, onTab }: { me: AppProfile; onTab?: (t: Tab) => void }) {
  if (me.role === 'siswa') {
    return <LaporanSiswa me={me} onTab={onTab} />;
  }

  if (!['guru', 'admin', 'kepsek', 'konten'].includes(me.role)) {
    return (
      <div className="dashboard-page">
        <section className="card">
          <h2 className="card-title">Laporan</h2>
          <p style={{ color: 'var(--muted)' }}>Akses laporan tidak tersedia untuk akun ini.</p>
        </section>
      </div>
    );
  }

  return <LaporanGuru me={me} onTab={onTab} />;
}

function LaporanGuru({ me, onTab: _onTab }: { me: AppProfile; onTab?: (t: Tab) => void }) {
  const [rows, setRows] = useState<Attempt[]>([]);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [profs, setProfs] = useState<Prof[]>([]);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [cs, setCs] = useState<CS[]>([]);
  const [err, setErr] = useState('');
  const [fPkg, setFPkg] = useState('');
  const [fKelas, setFKelas] = useState('');
  const [fKind, setFKIND] = useState<'semua' | 'latihan' | 'ujian'>('semua');
  const [fMapel, setFMapel] = useState('');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo, setFDateTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  type SortKey = 'siswa' | 'kelas' | 'paket' | 'mapel' | 'skor' | 'tab' | 'waktu';
  const [sortSpecs, setSortSpecs] = useState<{ key: SortKey; dir: 'asc' | 'desc' }[]>([
    { key: 'waktu', dir: 'desc' },
  ]);

  const isAdmin = me.role === 'admin';

  function toggleSort(k: SortKey, multi = false) {
    setSortSpecs((specs) => {
      const existing = specs.find((s) => s.key === k);
      if (multi) {
        if (existing) {
          return specs.map((s) => (s.key === k ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s));
        }
        const next: { key: SortKey; dir: 'asc' | 'desc' } = {
          key: k,
          dir: k === 'skor' || k === 'tab' || k === 'waktu' ? 'desc' : 'asc',
        };
        return [...specs, next].slice(0, 3);
      }
      if (existing === specs[0]) {
        return [{ ...specs[0], dir: specs[0].dir === 'asc' ? 'desc' : 'asc' }];
      }
      return [{ key: k, dir: k === 'skor' || k === 'tab' || k === 'waktu' ? 'desc' : 'asc' }];
    });
  }

  async function load(reset = true) {
    setErr('');
    if (reset) setSelected(new Set());
    const a = await insforge.database.from('attempts').select('id, package_id, student_id, status, score, started_at, submitted_at, tab_leave_count');
    if (a.error) setErr(a.error.message.includes('does not exist') ? 'Tabel attempts belum ada.' : a.error.message);
    else setRows((a.data || []) as Attempt[]);

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
    const t = window.setInterval(() => void load(false), 30000);
    return () => window.clearInterval(t);
  }, []);

  const pkgMap = useMemo(() => new Map(pkgs.map((p) => [p.id, p])), [pkgs]);
  const namaMap = useMemo(() => new Map(profs.map((p) => [p.id, p.full_name || p.id.slice(0, 8)])), [profs]);
  const kelasSiswa = useMemo(() => {
    const m = new Map<string, string>();
    const cn = new Map(classes.map((c) => [c.id, c.name]));
    for (const r of cs) m.set(r.profile_id, cn.get(r.class_id) || '');
    return m;
  }, [cs, classes]);

  const mapelList = useMemo(() => {
    const s = new Set<string>();
    for (const p of pkgs) if (p.mapel) s.add(p.mapel);
    return Array.from(s).sort();
  }, [pkgs]);

  const selesai = rows.filter((r) => r.status === 'submitted' || r.score != null);
  const filtered = selesai.filter((r) => {
    const p = r.package_id ? pkgMap.get(r.package_id) : null;
    const kind = p ? p.kind : 'latihan';
    if (fPkg && r.package_id !== fPkg) return false;
    if (fKind === 'latihan' && isUjian(kind)) return false;
    if (fKind === 'ujian' && !isUjian(kind)) return false;
    if (fKelas) {
      const kid = cs.find((x) => x.profile_id === r.student_id && x.class_id === fKelas);
      if (!kid) return false;
    }
    if (fMapel) {
      const mp = p?.mapel;
      if (mp !== fMapel) return false;
    }
    const tgl = r.submitted_at || r.started_at;
    if (fDateFrom) {
      const from = new Date(fDateFrom);
      if (new Date(tgl) < from) return false;
    }
    if (fDateTo) {
      const to = new Date(fDateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(tgl) > to) return false;
    }
    return true;
  });

  async function hapusAttempt(id: string) {
    if (!confirm('Hapus riwayat pengerjaan ini? Semua jawaban dan history terkait akan dihapus permanen.')) return;
    const { error: aaErr } = await insforge.database.from('attempt_answers').delete().eq('attempt_id', id);
    if (aaErr) { setErr(aaErr.message); return; }
    const { error } = await insforge.database.from('attempts').delete().eq('id', id);
    if (error) setErr(error.message);
    else {
      setRows((c) => c.filter((r) => r.id !== id));
      setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  async function hapusTerpilih() {
    if (!confirm(`Hapus ${selected.size} riwayat yang dipilih? Semua jawaban dan history terkait akan dihapus permanen.`)) return;
    const ids = Array.from(selected);
    for (const id of ids) {
      await insforge.database.from('attempt_answers').delete().eq('attempt_id', id);
      const { error } = await insforge.database.from('attempts').delete().eq('id', id);
      if (error) { setErr(error.message); return; }
    }
    setRows((c) => c.filter((r) => !selected.has(r.id)));
    setSelected(new Set());
  }

  function downloadCSV() {
    const headers = ['No', 'Siswa', 'Kelas', 'Paket', 'Mapel', 'Skor', 'Pindah Tab', 'Waktu', 'Status'];
    const lines = [headers.join(',')];
    sorted.forEach((r, idx) => {
      const p = r.package_id ? pkgMap.get(r.package_id) : null;
      const title = p?.title || (r.package_id ? `Paket (${r.package_id.slice(0, 8)})` : 'Latihan bebas');
      const mapel = p?.mapel || '—';
      const isSubmitted = r.status === 'submitted';
      const row = [
        idx + 1,
        namaMap.get(r.student_id) || r.student_id.slice(0, 8),
        kelasSiswa.get(r.student_id) || '—',
        title,
        mapel,
        isSubmitted ? String(r.score ?? '—') : '—',
        r.tab_leave_count ?? 0,
        fmt(r.submitted_at || r.started_at),
        isSubmitted ? 'Selesai' : 'Belum Selesai',
      ].map(escapeCsv);
      lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s);
      if (n.size === filtered.length) n.clear();
      else filtered.forEach((r) => n.add(r.id));
      return n;
    });
  }

  function toggleRow(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const avg = filtered.length === 0 ? 0 : Math.round((filtered.reduce((s, r) => s + Number(r.score || 0), 0) / filtered.length) * 100) / 100;

  const rowValue = useCallback((r: Attempt, k: SortKey): string | number => {
    const p = r.package_id ? pkgMap.get(r.package_id) : null;
    switch (k) {
      case 'siswa': return namaMap.get(r.student_id) || r.student_id.slice(0, 8);
      case 'kelas': return kelasSiswa.get(r.student_id) || '';
      case 'paket': return p?.title || (r.package_id ? `Paket (${r.package_id.slice(0, 8)})` : 'Latihan bebas');
      case 'mapel': return p?.mapel || '—';
      case 'skor': return Number(r.score || 0);
      case 'tab': return Number(r.tab_leave_count || 0);
      case 'waktu': return new Date(r.submitted_at || r.started_at).getTime() || 0;
      default: return 0;
    }
  }, [pkgMap, namaMap, kelasSiswa]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      for (const { key, dir } of sortSpecs) {
        const va = rowValue(a, key);
        const vb = rowValue(b, key);
        const cmp = typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'id');
        if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
    return arr;
  }, [filtered, sortSpecs, rowValue]);

  function sortState(k: SortKey): { state: 'none' | 'asc' | 'desc'; level?: number } {
    const idx = sortSpecs.findIndex((s) => s.key === k);
    if (idx === -1) return { state: 'none' };
    return { state: sortSpecs[idx].dir === 'asc' ? 'asc' : 'desc', level: idx + 1 };
  }

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <p className="page-subtitle">Laporan hasil paket</p>
        <h1 className="page-title">Laporan Kelas</h1>
        <p className="page-subtitle">Skor dari pengumpulan simulasi/paket. Bukan prediksi nilai TKA resmi.</p>
      </header>

      {err && (
        <div className="banner banner-danger" style={{ marginBottom: 20, whiteSpace: 'pre-wrap' }}>
          <p className="banner-text">{err}</p>
        </div>
      )}

      <div className="stats-row">
        <div className="stat-card">
          <p className="stat-label">Pengumpulan</p>
          <p className="stat-value">{filtered.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Rata-rata skor</p>
          <p className="stat-value">{avg}</p>
        </div>
      </div>

      <section className="card">
        <div className="filter-bar">
          <div className="filter-row">
            <div className="filter-group">
              <label className="filter-label">Paket</label>
              <FilterSelect
                value={fPkg}
                onChange={setFPkg}
                placeholder="Semua paket"
                options={pkgs.map((p) => ({ value: p.id, label: p.title, sub: p.mapel }))}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">Mapel</label>
              <FilterSelect
                value={fMapel}
                onChange={setFMapel}
                placeholder="Semua mapel"
                options={mapelList.map((m) => ({ value: m, label: m }))}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">Kelas</label>
              <FilterSelect
                value={fKelas}
                onChange={setFKelas}
                placeholder="Semua kelas"
                options={[...classes]
                  .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }))
                  .map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">Dari</label>
              <input className="filter-input" type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} />
            </div>
            <div className="filter-group">
              <label className="filter-label">Sampai</label>
              <input className="filter-input" type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} />
            </div>
            <div className="filter-group">
              <label className="filter-label">Jenis</label>
              <div className="lap-tab" role="tablist">
                <button type="button" role="tab" className={`lap-tab-btn ${fKind === 'semua' ? 'active' : ''}`} onClick={() => setFKIND('semua')}>Semua</button>
                <button type="button" role="tab" className={`lap-tab-btn ${fKind === 'latihan' ? 'active' : ''}`} onClick={() => setFKIND('latihan')}>Latihan</button>
                <button type="button" role="tab" className={`lap-tab-btn ${fKind === 'ujian' ? 'active' : ''}`} onClick={() => setFKIND('ujian')}>Ujian</button>
              </div>
            </div>
          </div>
          <div className="filter-actions">
            {isAdmin && selected.size > 0 && (
              <button type="button" className="btn btn-danger" onClick={hapusTerpilih}>
                {Icons.trash()} Hapus {selected.size} terpilih
              </button>
            )}
{filtered.length > 0 && (
              <button type="button" className="btn btn-outline" onClick={downloadCSV}>
                {Icons.download()} Download
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3 className="empty-state-title">Belum ada data</h3>
            <p className="empty-state-text">Siswa harus mengumpulkan paket di menu Simulasi.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  {isAdmin && <th style={{ width: 40 }}><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} /></th>}
                  <th><button type="button" className="col-sort" onClick={(e) => toggleSort('siswa', e.shiftKey)} title="Klik: urutkan · Shift+Klik: level kedua">Siswa <SortIcon state={sortState('siswa').state} level={sortState('siswa').level} /></button></th>
                  <th><button type="button" className="col-sort" onClick={(e) => toggleSort('kelas', e.shiftKey)} title="Klik: urutkan · Shift+Klik: level kedua">Kelas <SortIcon state={sortState('kelas').state} level={sortState('kelas').level} /></button></th>
                  <th><button type="button" className="col-sort" onClick={(e) => toggleSort('paket', e.shiftKey)} title="Klik: urutkan · Shift+Klik: level kedua">Paket <SortIcon state={sortState('paket').state} level={sortState('paket').level} /></button></th>
                  <th><button type="button" className="col-sort" onClick={(e) => toggleSort('mapel', e.shiftKey)} title="Klik: urutkan · Shift+Klik: level kedua">Mapel <SortIcon state={sortState('mapel').state} level={sortState('mapel').level} /></button></th>
                  <th><button type="button" className="col-sort" onClick={(e) => toggleSort('skor', e.shiftKey)} title="Klik: urutkan · Shift+Klik: level kedua">Skor <SortIcon state={sortState('skor').state} level={sortState('skor').level} /></button></th>
                  <th><button type="button" className="col-sort" onClick={(e) => toggleSort('tab', e.shiftKey)} title="Klik: urutkan · Shift+Klik: level kedua">Pindah tab <SortIcon state={sortState('tab').state} level={sortState('tab').level} /></button></th>
                  <th><button type="button" className="col-sort" onClick={(e) => toggleSort('waktu', e.shiftKey)} title="Klik: urutkan · Shift+Klik: level kedua">Waktu <SortIcon state={sortState('waktu').state} level={sortState('waktu').level} /></button></th>
                  {isAdmin && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const p = r.package_id ? pkgMap.get(r.package_id) : null;
                  return (
                    <tr key={r.id}>
                      {isAdmin && <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} /></td>}
                      <td>{namaMap.get(r.student_id) || r.student_id.slice(0, 8)}</td>
                      <td>{kelasSiswa.get(r.student_id) || '—'}</td>
                      <td>{p?.title || (r.package_id ? r.package_id.slice(0, 8) : 'Latihan bebas')}</td>
                      <td>{p?.mapel || '—'}</td>
                      <td><strong>{r.score ?? '—'}</strong></td>
                      <td>{r.tab_leave_count ?? 0}</td>
                      <td className="text-muted">{fmt(r.submitted_at || r.started_at)}</td>
                      {isAdmin && (
                        <td>
                          <button type="button" className="btn-icon btn-danger" onClick={() => hapusAttempt(r.id)} title="Hapus riwayat">
                            {Icons.trash()}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="disclaimer">SMART-TKA tidak berafiliasi dengan Kemendikdasmen. Angka ini hasil latihan/simulasi internal.</p>
      </section>
    </div>
  );
}
