import { useEffect, useMemo, useState, useCallback } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';
import type { Tab } from '../AppShell';

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
      .eq('student_id', me.id)
      .eq('is_archived', false);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="dashboard-page">
      <header className="page-header" style={{ marginBottom: 20 }}>
        <p className="page-subtitle">Hasil belajar Anda</p>
        <h1 className="page-title">Laporan Hasil</h1>
        <p className="page-subtitle">Riwayat pengerjaan paket simulasi dan latihan bebas.</p>
      </header>

      {err && (
        <div className="banner banner-danger" style={{ marginBottom: 20, whiteSpace: 'pre-wrap' }}>
          <p className="banner-text">{err}</p>
        </div>
      )}

      {/* Score summary card */}
      <section className="card" style={{ marginBottom: 20, textAlign: 'center', padding: '28px 24px' }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Rata-rata Nilai</p>
         <div style={{ fontSize: 64, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1, margin: '0 0 8px' }}>
          {avgScore == null ? '—' : avgScore}<small style={{ fontSize: 24, fontWeight: 500, color: 'var(--muted)' }}>/100</small>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px' }}>
          {totalSesi === 0 ? 'Belum ada sesi terkumpul' : `Berdasarkan ${totalSesi} sesi selesai`}
        </p>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>Tertinggi</p>
            <p style={{ fontSize: 22, fontWeight: 700,               color: 'var(--accent)', margin: 0 }}>{maxScore == null ? '—' : maxScore}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>Total Sesi</p>
            <p style={{ fontSize: 22, fontWeight: 700,               color: 'var(--accent)', margin: 0 }}>{totalSesi}</p>
          </div>
        </div>
      </section>

      {/* Domain performance */}
      {domainStats.length > 0 && (
        <section className="card" style={{ marginBottom: 20 }}>
          <h3 className="card-title" style={{ marginBottom: 14 }}>Performa per Mapel</h3>
          {domainStats.map((d) => (
            <div key={d.name} className="analysis-bar-row">
              <span className="analysis-bar-label" style={{ width: 120 }}>{d.name}</span>
              <div className="analysis-bar-track">
                <div className="analysis-bar-fill" style={{ width: `${d.avg}%`, background: d.avg < 50 ? 'var(--warn)' : d.avg < 70 ? 'var(--gold)' : 'var(--accent)' }} />
              </div>
              <span className="analysis-bar-pct">{d.avg}%</span>
              <span className={`analysis-bar-tag ${d.avg < 50 ? 'analysis-bar-tag-improve' : 'analysis-bar-tag-strong'}`}>
                {d.avg < 50 ? 'Perlu ditingkatkan' : 'Cukup'}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* Recommendation */}
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

      {/* Filter + Table */}
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Riwayat Pengerjaan</h3>
          <div className="lap-tab" role="tablist">
            <button type="button" role="tab"
              className={`lap-tab-btn ${filterKind === 'semua' ? 'active' : ''}`}
              onClick={() => setFilterKind('semua')}>Semua</button>
            <button type="button" role="tab"
              className={`lap-tab-btn ${filterKind === 'latihan' ? 'active' : ''}`}
              onClick={() => setFilterKind('latihan')}>Latihan</button>
            <button type="button" role="tab"
              className={`lap-tab-btn ${filterKind === 'ujian' ? 'active' : ''}`}
              onClick={() => setFilterKind('ujian')}>Ujian</button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Memuat riwayat…</p>
        ) : filteredRows.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
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
                        {p?.kind && <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{p.kind}</span>}
                      </td>
                      <td>{mapel}</td>
                      <td style={{ color: 'var(--muted)' }}>{durasi}</td>
                      <td>
                        {isSubmitted ? (
                          <strong style={{               color: 'var(--accent)', fontSize: 15 }}>
                            {r.score ?? 0} <small style={{ fontSize: 11, fontWeight: 400 }}>/ 100</small>
                          </strong>
                        ) : (
                          <span style={{ color: 'var(--warn)', fontSize: 12 }}>Belum Selesai</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--outline)', marginTop: 16 }}>
          SMART-TKA tidak berafiliasi dengan Kemendikdasmen. Angka ini hasil latihan/simulasi internal.
        </p>
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
  const [sortKey, setSortKey] = useState<'siswa' | 'kelas' | 'paket' | 'mapel' | 'skor' | 'tab' | 'waktu'>('waktu');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir((k === 'skor' || k === 'tab' || k === 'waktu') ? 'desc' : 'asc'); }
  }

  async function load() {
    setErr('');
    setSelected(new Set());
    let subjects: string[] = [];
    if (me.role === 'guru') {
      const { data: tsData } = await insforge.database
        .from('teacher_subjects')
        .select('subject')
        .eq('profile_id', me.id)
        .eq('is_active', true);
      if (tsData) subjects = (tsData as { subject: string }[]).map((r) => r.subject);

      if (subjects.length > 0) {
        const { data: sharedGurus } = await insforge.database
          .from('teacher_subjects')
          .select('profile_id')
          .in('subject', subjects)
          .eq('is_active', true);
        const guruIds = Array.from(new Set((sharedGurus || []).map((r: any) => r.profile_id)));
        if (guruIds.length > 0) {
          const { data: allSubjects } = await insforge.database
            .from('teacher_subjects')
            .select('subject')
            .in('profile_id', guruIds)
            .eq('is_active', true);
          const allSubj = Array.from(new Set((allSubjects || []).map((r: any) => r.subject)));
          if (allSubj.length > 0) subjects = allSubj;
        }
      }
    }
    const a = await insforge.database.from('attempts').select('id, package_id, student_id, status, score, started_at, submitted_at, tab_leave_count').eq('is_archived', false);
    if (a.error) setErr(a.error.message.includes('does not exist') ? 'Tabel attempts belum ada.' : a.error.message);
    else setRows((a.data || []) as Attempt[]);

    if (subjects.length > 0) {
      const p = await insforge.database
        .from('packages')
        .select('id, title, mapel, kind')
        .in('mapel', subjects);
      if (!p.error) setPkgs((p.data || []) as Pkg[]);
    } else {
      const p = await insforge.database.from('packages').select('id, title, mapel, kind');
      if (!p.error) setPkgs((p.data || []) as Pkg[]);
    }
    const pr = await insforge.database.from('profiles').select('id, full_name').eq('role', 'siswa');
    if (!pr.error) setProfs((pr.data || []) as Prof[]);
    const c = await insforge.database.from('classes').select('id, name');
    if (!c.error) setClasses((c.data || []) as Cls[]);
    const m = await insforge.database.from('class_students').select('class_id, profile_id');
    if (!m.error) setCs((m.data || []) as CS[]);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

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
    if (!confirm('Arsipkan riwayat pengerjaan ini? Data tidak akan ditampilkan lagi di laporan.')) return;
    const { error } = await insforge.database.from('attempts').update({ is_archived: true }).eq('id', id);
    if (error) setErr(error.message);
    else {
      setRows((c) => c.filter((r) => r.id !== id));
      setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  async function hapusTerpilih() {
    if (!confirm(`Arsipkan ${selected.size} riwayat yang dipilih? Data tidak akan ditampilkan lagi di laporan.`)) return;
    const ids = Array.from(selected);
    for (const id of ids) {
      await insforge.database.from('attempts').update({ is_archived: true }).eq('id', id);
    }
    setRows((c) => c.filter((r) => !selected.has(r.id)));
    setSelected(new Set());
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

  const rowValue = useCallback((r: Attempt, k: typeof sortKey): string | number => {
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = rowValue(a, sortKey);
      const vb = rowValue(b, sortKey);
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'id');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir, rowValue]);

  function arrow(k: typeof sortKey) {
    if (sortKey !== k) return '⇅';
    return sortDir === 'asc' ? '↑' : '↓';
  }

  return (
    <div className="dashboard-page">
      <header className="page-header" style={{ marginBottom: 20 }}>
        <p className="page-subtitle">Laporan hasil paket</p>
        <h1 className="page-title">Laporan Kelas</h1>
        <p className="page-subtitle">Skor dari pengumpulan simulasi/paket. Bukan prediksi nilai TKA resmi.</p>
      </header>

      {err && (
        <div className="banner banner-danger" style={{ marginBottom: 20, whiteSpace: 'pre-wrap' }}>
          <p className="banner-text">{err}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: '1 1 140px' }}>
          <p className="stat-label">Pengumpulan</p>
          <p className="stat-value" style={{ fontSize: 24 }}>{filtered.length}</p>
        </div>
        <div className="stat-card" style={{ flex: '1 1 140px' }}>
          <p className="stat-label">Rata-rata skor</p>
          <p className="stat-value" style={{ fontSize: 24 }}>{avg}</p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
            <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="form-label">Filter paket</label>
              <select className="input" value={fPkg} onChange={(e) => setFPkg(e.target.value)}>
                <option value="">Semua paket</option>
                {pkgs.map((p) => (
                  <option key={p.id} value={p.id}>{p.title} ({p.mapel})</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="form-label">Filter mapel</label>
              <select className="input" value={fMapel} onChange={(e) => setFMapel(e.target.value)}>
                <option value="">Semua mapel</option>
                {mapelList.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="form-label">Dari tanggal</label>
              <input className="input" type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="form-label">Sampai tanggal</label>
              <input className="input" type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="form-label">Filter kelas</label>
              <select className="input" value={fKelas} onChange={(e) => setFKelas(e.target.value)}>
                <option value="">Semua kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: '1 1 260px', marginBottom: 0 }}>
              <label className="form-label">Jenis</label>
              <div className="lap-tab" role="tablist">
                <button type="button" role="tab" className={`lap-tab-btn ${fKind === 'semua' ? 'active' : ''}`} onClick={() => setFKIND('semua')}>Semua</button>
                <button type="button" role="tab" className={`lap-tab-btn ${fKind === 'latihan' ? 'active' : ''}`} onClick={() => setFKIND('latihan')}>Latihan</button>
                <button type="button" role="tab" className={`lap-tab-btn ${fKind === 'ujian' ? 'active' : ''}`} onClick={() => setFKIND('ujian')}>Ujian</button>
              </div>
            </div>
          </div>
          {selected.size > 0 && (
            <button type="button" className="btn btn-danger" onClick={hapusTerpilih}>
              Hapus {selected.size} terpilih
            </button>
          )}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <p className="empty-state-title">Belum ada data</p>
            <p className="empty-state-text">Siswa harus mengumpulkan paket di menu Simulasi.</p>
          </div>
        )}

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} />
                </th>
                <th><button type="button" className="col-sort" onClick={() => toggleSort('siswa')}>Siswa {arrow('siswa')}</button></th>
                <th><button type="button" className="col-sort" onClick={() => toggleSort('kelas')}>Kelas {arrow('kelas')}</button></th>
                <th><button type="button" className="col-sort" onClick={() => toggleSort('paket')}>Paket {arrow('paket')}</button></th>
                <th><button type="button" className="col-sort" onClick={() => toggleSort('mapel')}>Mapel {arrow('mapel')}</button></th>
                <th><button type="button" className="col-sort" onClick={() => toggleSort('skor')}>Skor {arrow('skor')}</button></th>
                <th><button type="button" className="col-sort" onClick={() => toggleSort('tab')}>Pindah tab {arrow('tab')}</button></th>
                <th><button type="button" className="col-sort" onClick={() => toggleSort('waktu')}>Waktu {arrow('waktu')}</button></th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const p = r.package_id ? pkgMap.get(r.package_id) : null;
                return (
                  <tr key={r.id}>
                    <td>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} />
                    </td>
                    <td>{namaMap.get(r.student_id) || r.student_id.slice(0, 8)}</td>
                    <td>{kelasSiswa.get(r.student_id) || '—'}</td>
                    <td>{p?.title || (r.package_id ? r.package_id.slice(0, 8) : 'Latihan bebas')}</td>
                    <td>{p?.mapel || '—'}</td>
                    <td><strong>{r.score ?? '—'}</strong></td>
                    <td>{r.tab_leave_count ?? 0}</td>
                    <td style={{ color: 'var(--muted)' }}>{fmt(r.submitted_at || r.started_at)}</td>
                    <td>
                      <button type="button" className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => hapusAttempt(r.id)} title="Hapus riwayat">
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}