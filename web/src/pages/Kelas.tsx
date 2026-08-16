import { useEffect, useState } from 'react';
import { assignSiswaKeKelas } from '../lib/kelas';
import { insforge, type AppProfile } from '../lib/insforge';

type Cls = { id: string; name: string; jenjang: string; invite_code: string };
type Siswa = { id: string; full_name: string | null; user_id: string; jenjang: string | null };
type Anggota = { profile_id: string };

const JENJANG_OPTS = ['sd', 'smp', 'sma', 'smk'] as const;
const JENJANG_LABEL: Record<string, string> = {
  sd: 'SD',
  smp: 'SMP',
  sma: 'SMA',
  smk: 'SMK',
};

export function Kelas({ profile }: { profile: AppProfile }) {
  const [rows, setRows] = useState<Cls[]>([]);
  const [siswa, setSiswa] = useState<Siswa[]>([]);
  const [anggota, setAnggota] = useState<Record<string, string[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState('Kelas 9A');
  const [jenjang, setJenjang] = useState(profile.jenjang || 'sma');
  const [kode, setKode] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editKode, setEditKode] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [pindahKe, setPindahKe] = useState<Record<string, string>>({});
  const [naikKe, setNaikKe] = useState<Record<string, string>>({});

  const sudahDiKelas = new Set(Object.values(anggota).flat());

  async function load() {
    setErr('');
    const c = await insforge.database.from('classes').select('id, name, jenjang, invite_code');
    if (c.error) {
      setErr(c.error.message);
      return;
    }
    const list = (c.data || []) as Cls[];
    setRows(list);

    const s = await insforge.database.from('profiles').select('id, full_name, user_id, jenjang').eq('role', 'siswa');
    if (!s.error) setSiswa((s.data || []) as Siswa[]);

    const map: Record<string, string[]> = {};
    for (const cl of list) {
      const a = await insforge.database.from('class_students').select('profile_id').eq('class_id', cl.id);
      map[cl.id] = ((a.data || []) as Anggota[]).map((x) => x.profile_id);
    }
    setAnggota(map);
  }

  useEffect(() => {
    void load();
  }, []);

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    setOk('');
    setErr('');
    if (!profile.school_id) {
      setErr('Admin/guru belum punya school_id.');
      return;
    }
    setBusy(true);
    const code = (kode.trim() || 'K' + Math.random().toString(36).slice(2, 8)).toUpperCase();
    const { error } = await insforge.database.from('classes').insert({
      school_id: profile.school_id,
      name: name.trim(),
      jenjang,
      invite_code: code,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setOk(`Kelas dibuat. Kode: ${code}`);
      setName('Kelas 9A');
      setKode('');
      await load();
    }
  }

  async function simpanKelas(id: string) {
    setErr('');
    setOk('');
    setBusy(true);
    const { error } = await insforge.database
      .from('classes')
      .update({
        name: editName.trim(),
        invite_code: (editKode.trim() || editName.trim()).toUpperCase(),
      })
      .eq('id', id);
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setEditId(null);
      setOk('Kelas diperbarui.');
      await load();
    }
  }

  async function hapusKelas(id: string) {
    if (!confirm('Hapus kelas ini? Siswa hanya dilepas dari kelas, profil tetap ada.')) return;
    const { error } = await insforge.database.from('classes').delete().eq('id', id);
    if (error) setErr(error.message);
    else await load();
  }

  async function masukkan(classId: string, profileId: string) {
    setErr('');
    const tujuan = rows.find((r) => r.id === classId);
    const { error } = await assignSiswaKeKelas(profileId, classId, {
      reason: 'masuk',
      jenjang: tujuan?.jenjang,
    });
    if (error) setErr(error.message);
    else {
      setOk('Siswa masuk kelas ini.');
      await load();
    }
  }

  async function pindah(fromId: string, profileId: string) {
    const toId = pindahKe[profileId];
    if (!toId || toId === fromId) {
      setErr('Pilih kelas tujuan yang berbeda.');
      return;
    }
    const tujuan = rows.find((r) => r.id === toId);
    const { error } = await assignSiswaKeKelas(profileId, toId, {
      fromClassId: fromId,
      reason: 'pindah',
      jenjang: tujuan?.jenjang,
    });
    if (error) setErr(error.message);
    else {
      setOk(`${namaSiswa(profileId)} pindah ke ${tujuan?.name || 'kelas baru'}.`);
      setPindahKe((m) => ({ ...m, [profileId]: '' }));
      await load();
    }
  }

  async function naikkanSemua(fromId: string) {
    const toId = naikKe[fromId];
    if (!toId || toId === fromId) {
      setErr('Pilih kelas tujuan kenaikan.');
      return;
    }
    const ids = anggota[fromId] || [];
    const tujuan = rows.find((r) => r.id === toId);
    if (!confirm(`Pindahkan ${ids.length} siswa ke ${tujuan?.name}? Untuk kenaikan kelas.`)) return;
    setErr('');
    setBusy(true);
    for (const pid of ids) {
      const { error } = await assignSiswaKeKelas(pid, toId, {
        fromClassId: fromId,
        reason: 'kenaikan',
        jenjang: tujuan?.jenjang,
      });
      if (error) {
        setErr(error.message);
        await load();
        setBusy(false);
        return;
      }
    }
    setOk(`${ids.length} siswa dinaikkan ke ${tujuan?.name}.`);
    setBusy(false);
    await load();
  }

  async function keluarkan(classId: string, profileId: string) {
    const { error } = await insforge.database.from('class_students').delete().eq('class_id', classId).eq('profile_id', profileId);
    if (error) setErr(error.message);
    else await load();
  }

  const namaSiswa = (id: string) =>
    siswa.find((s) => s.id === id)?.full_name || siswa.find((s) => s.id === id)?.user_id || id.slice(0, 8);

  const byJenjang = JENJANG_OPTS.map((j) => ({
    jenjang: j,
    label: JENJANG_LABEL[j],
    kelas: rows
      .filter((c) => c.jenjang === j)
      .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })),
  })).filter((g) => g.kelas.length > 0);

  if (!['guru', 'admin', 'kepsek'].includes(profile.role)) {
    return (
      <div className="page">
        <div className="form-card">
          <h2 className="card-title">Kelas</h2>
          <p className="card-subtitle">Hanya guru/admin/kepsek.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Kelas</h1>
        <p className="page-subtitle">Kelola kelas dan anggotanya. Satu siswa hanya di satu kelas.</p>
      </header>

      {err && (
        <div className="banner banner-danger" style={{ marginBottom: 20, whiteSpace: 'pre-wrap' }}>
          <p className="banner-text">{err}</p>
        </div>
      )}
      {ok && (
        <div className="banner banner-ok" style={{ marginBottom: 20 }}>
          <p className="banner-text">{ok}</p>
        </div>
      )}

      <form onSubmit={buat} className="form-container">
        <div className="form-card">
          <header className="card-header">
            <h2 className="card-title">Buat kelas + kode</h2>
            <p className="card-subtitle">Satu siswa hanya di satu kelas. Import CSV memakai kolom kode_kelas = kode undangan ini.</p>
          </header>

          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <div className="form-section-title">Nama kelas <span className="req"></span></div>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <div className="form-section-title">Kode kelas (undangan)</div>
                <input
                  className="input"
                  value={kode}
                  onChange={(e) => setKode(e.target.value.toUpperCase())}
                  placeholder="Contoh: 9A-2026 (kosong = otomatis)"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Jenjang <span className="req"></span></div>
            <select className="select" value={jenjang} onChange={(e) => setJenjang(e.target.value)}>
              {JENJANG_OPTS.map((j) => (
                <option key={j} value={j}>
                  {j.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Membuat…' : 'Buat kelas'}
          </button>
        </div>
      </form>

      {rows.length === 0 && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <div className="empty-state-icon">🏫</div>
          <h3 className="empty-state-title">Belum ada kelas</h3>
          <p className="empty-state-text">Buat kelas pertama di formulir di atas.</p>
        </div>
      )}

      {byJenjang.map((g) => (
        <div key={g.jenjang} className="form-section" style={{ marginTop: 24 }}>
          <div className="form-section-title">{g.label} ({g.kelas.length})</div>
          <div className="kelas-grid">
            {g.kelas.map((c) => {
              const ids = anggota[c.id] || [];
              const belum = siswa.filter((s) => !sudahDiKelas.has(s.id));
              const terbuka = openId === c.id;
              return (
                <div key={c.id}>
                  <button
                    type="button"
                    className="kelas-card"
                    onClick={() => setOpenId((cur) => (cur === c.id ? null : c.id))}
                    aria-expanded={terbuka}
                  >
                     <div className="kelas-card-top">
                      <h3 className="kelas-name">{c.name}</h3>
                      <div className="kelas-code">{c.invite_code}</div>
                    </div>
                    <div className="kelas-meta">
                      <span className="kelas-badge-jenjang">{c.jenjang}</span>
                      <span className="kelas-badge-siswa">{ids.length} siswa</span>
                    </div>
                  </button>

                  {terbuka && (
                    <div className="form-card" style={{ marginTop: 12, padding: '24px 28px' }}>
                      {editId === c.id ? (
                        <div className="form-container" style={{ marginTop: 16 }}>
                          <div className="form-group">
                            <div className="form-section-title">Nama</div>
                            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <div className="form-section-title">Kode kelas</div>
                            <input className="input" value={editKode} onChange={(e) => setEditKode(e.target.value.toUpperCase())} />
                          </div>
                          <div className="actions">
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => void simpanKelas(c.id)} disabled={busy}>
                              {busy ? 'Menyimpan…' : 'Simpan nama & kode'}
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="actions" style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setEditId(c.id);
                            setEditName(c.name);
                            setEditKode(c.invite_code);
                          }}
                        >
                          Ubah nama & kode
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => hapusKelas(c.id)}>
                          Hapus kelas
                        </button>
                      </div>

                      <h3 className="type-hm" style={{ marginTop: 16, marginBottom: 8 }}>
                        Siswa di kelas ({ids.length})
                      </h3>
                      {ids.length === 0 && <p className="type-lab">Belum ada siswa.</p>}
                      {ids
                        .slice()
                        .sort((a, b) => namaSiswa(a).localeCompare(namaSiswa(b), 'id', { sensitivity: 'base' }))
                        .map((pid) => (
                          <div key={pid} className="actions" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ flex: '1 1 140px' }}>{namaSiswa(pid)}</span>
                            <select className="select" style={{ maxWidth: 200 }} value={pindahKe[pid] || ''} onChange={(e) => setPindahKe((m) => ({ ...m, [pid]: e.target.value }))}>
                              <option value="">Pindah ke…</option>
                              {rows
                                .filter((k) => k.id !== c.id)
                                .map((k) => (
                                  <option key={k.id} value={k.id}>
                                    {k.name}
                                  </option>
                                ))}
                            </select>
                            <button type="button" className="btn btn-sm" style={{ maxWidth: 120 }} onClick={() => void pindah(c.id, pid)}>
                              Pindah
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" style={{ maxWidth: 120 }} onClick={() => keluarkan(c.id, pid)}>
                              Keluarkan
                            </button>
                          </div>
                        ))}

                      <div className="hint-panel" style={{ marginTop: 16 }}>
                        <span className="hint-kicker">Kenaikan kelas (semua siswa di sini)</span>
                        <div className="hint-row">
                          <select
                            className="select"
                            value={naikKe[c.id] || ''}
                            onChange={(e) => setNaikKe((m) => ({ ...m, [c.id]: e.target.value }))}
                          >
                            <option value="">— kelas tujuan —</option>
                            {rows
                              .filter((k) => k.id !== c.id)
                              .map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.name} ({k.jenjang})
                                </option>
                              ))}
                          </select>
                          <button type="button" className="btn" onClick={() => void naikkanSemua(c.id)} disabled={busy}>
                            {busy ? 'Memindah…' : 'Naikkan semua'}
                          </button>
                        </div>
                        <p className="hint-note">Satu siswa tetap satu kelas. Jenjang profil mengikuti kelas tujuan. Buat kelas baru dulu (mis. 11 IPA 1) sebelum menaikkan dari 10.</p>
                      </div>

                      <h3 className="type-hm" style={{ marginTop: 16, marginBottom: 8 }}>
                        Masukkan siswa yang belum punya kelas
                      </h3>
                      {siswa.length === 0 && <p className="type-lab">Belum ada profil siswa. Buat di menu Admin dulu.</p>}
                      {belum.length === 0 && siswa.length > 0 && (
                        <p className="type-lab">Semua siswa sudah di satu kelas. Keluarkan dulu untuk memindah.</p>
                      )}
                      {belum.map((s) => (
                        <div key={s.id} className="actions" style={{ alignItems: 'center' }}>
                          <span style={{ flex: '1 1 140px' }}>
                            {s.full_name || s.user_id} <span className="type-lab">{s.jenjang}</span>
                          </span>
                          <button type="button" className="btn" style={{ maxWidth: 160 }} onClick={() => masukkan(c.id, s.id)}>
                            Masukkan
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
