import { useEffect, useState, useMemo } from 'react';
import { assignSiswaKeKelas } from '../lib/kelas';
import { insforge, type AppProfile } from '../lib/insforge';
import { FilterSelect } from '../components/FilterSelect';

type Cls = { id: string; name: string; jenjang: string; invite_code: string };
type Siswa = { id: string; full_name: string | null; user_id: string; jenjang: string | null };
type Anggota = { profile_id: string };

const JENJANG_OPTS = ['sd', 'smp', 'sma', 'smk'] as const;

const ROMAN_NUMERALS: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15,
};

function parseClassName(name: string): { romanNum: number; num: number } {
  const match = name.match(/^([IVXLCDM]+)(?:\.(\d+))?$/i);
  if (match) {
    const roman = match[1].toUpperCase();
    const num = match[2] ? parseInt(match[2], 10) : 0;
    return { romanNum: ROMAN_NUMERALS[roman] || 0, num };
  }
  return { romanNum: 0, num: 0 };
}

function sortClassesByName(classes: Cls[]): Cls[] {
  return [...classes].sort((a, b) => {
    const parsedA = parseClassName(a.name);
    const parsedB = parseClassName(b.name);
    if (parsedA.romanNum !== parsedB.romanNum) {
      return parsedA.romanNum - parsedB.romanNum;
    }
    return parsedA.num - parsedB.num;
  });
}

export function Kelas({ profile }: { profile: AppProfile }) {
  const [rows, setRows] = useState<Cls[]>([]);
  const [siswa, setSiswa] = useState<Siswa[]>([]);
  const [anggota, setAnggota] = useState<Record<string, string[]>>({});
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [name, setName] = useState('Kelas XII.1');
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

  const sortedClasses = useMemo(() => sortClassesByName(rows), [rows]);

  const selectedClass = useMemo(
    () => rows.find((c) => c.id === selectedClassId) || null,
    [rows, selectedClassId]
  );

  const selectedClassMemberIds = selectedClass ? anggota[selectedClass.id] || [] : [];

  const selectedClassStudents = useMemo(() => {
    if (!selectedClass) return [];
    const idSet = new Set(selectedClassMemberIds);
    return siswa
      .filter((s) => idSet.has(s.id))
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'id', { sensitivity: 'base' }));
  }, [selectedClass, siswa, selectedClassMemberIds]);

  const availableStudents = useMemo(() => {
    if (!selectedClass) return [];
    return siswa
      .filter((s) => !sudahDiKelas.has(s.id))
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'id', { sensitivity: 'base' }));
  }, [selectedClass, siswa, sudahDiKelas]);

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

  useEffect(() => {
    if (!selectedClassId && sortedClasses.length > 0) {
      setSelectedClassId(sortedClasses[0].id);
    }
  }, [sortedClasses, selectedClassId]);

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
      setName('Kelas XII.1');
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
    else {
      if (selectedClassId === id) setSelectedClassId('');
      await load();
    }
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
    <div className="dashboard-page">
      <header className="page-header">
        <h1 className="page-title">Manajemen Kelas</h1>
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

      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Buat Kelas Baru</h3>
        <form onSubmit={buat}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
              <label className="form-label">Nama Kelas</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
              <label className="form-label">Kode Undangan</label>
              <input
                className="input"
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                placeholder="Kosong = otomatis"
              />
            </div>
            <div className="form-group" style={{ minWidth: 100 }}>
              <label className="form-label">Jenjang</label>
              <FilterSelect
                value={jenjang}
                onChange={setJenjang}
                placeholder="Pilih jenjang"
                minWidth={90}
                options={JENJANG_OPTS.map((j) => ({ value: j, label: j.toUpperCase() }))}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Membuat…' : 'Buat Kelas'}
            </button>
          </div>
        </form>
      </div>

      <div className="kelas-layout">
        <div className="kelas-sidebar">
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Pilih Kelas</label>
            <FilterSelect
              value={selectedClassId}
              onChange={setSelectedClassId}
              placeholder="-- Pilih Kelas --"
              minWidth={180}
              options={sortedClasses.map((c) => ({
                value: c.id,
                label: `${c.name} (${c.jenjang.toUpperCase()})`,
              }))}
            />
          </div>

          {selectedClass && (
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Info Kelas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>Nama Kelas</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{selectedClass.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>Jenjang</span>
                  <span style={{ fontSize: 13 }}>{selectedClass.jenjang.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>Kode Undangan</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{selectedClass.invite_code}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>Jumlah Siswa</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{selectedClassMemberIds.length} siswa</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setEditId(selectedClass.id);
                    setEditName(selectedClass.name);
                    setEditKode(selectedClass.invite_code);
                  }}
                >
                  Ubah
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => hapusKelas(selectedClass.id)}
                >
                  Hapus
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="kelas-main">
          {selectedClass ? (
            <>
              {editId === selectedClass.id && (
                <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Edit Kelas</h3>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
                      <label className="form-label">Nama Kelas</label>
                      <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
                      <label className="form-label">Kode Undangan</label>
                      <input className="input" value={editKode} onChange={(e) => setEditKode(e.target.value.toUpperCase())} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void simpanKelas(selectedClass.id)} disabled={busy}>
                      {busy ? 'Menyimpan…' : 'Simpan'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>
                      Batal
                    </button>
                  </div>
                </div>
              )}

              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Siswa di {selectedClass.name}</h3>
                  <span className="badge badge-info">{selectedClassStudents.length} siswa</span>
                </div>
                {selectedClassStudents.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: 13 }}>Belum ada siswa di kelas ini.</p>
                ) : (
                  <div className="student-list">
                    {selectedClassStudents.map((s, idx) => (
                      <div key={s.id} className="student-item">
                        <div className="student-info">
                          <span className="student-number">{idx + 1}</span>
                          <div>
                            <span className="student-name">{s.full_name || s.user_id}</span>
                            <span className="student-meta">{s.jenjang?.toUpperCase() || '-'}</span>
                          </div>
                        </div>
                        <div className="student-actions">
                          <FilterSelect
                            value={pindahKe[s.id] || ''}
                            onChange={(v) => setPindahKe((m) => ({ ...m, [s.id]: v }))}
                            placeholder="Pindah ke…"
                            minWidth={140}
                            options={sortedClasses
                              .filter((k) => k.id !== selectedClass.id)
                              .map((k) => ({ value: k.id, label: k.name }))}
                          />
                          <button type="button" className="btn btn-sm" style={{ fontSize: 12 }} onClick={() => void pindah(selectedClass.id, s.id)}>
                            Pindah
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => keluarkan(selectedClass.id, s.id)}>
                            Keluarkan
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedClassStudents.length > 0 && (
                  <div className="hint-panel" style={{ marginTop: 16 }}>
                    <span className="hint-kicker">Kenaikan kelas (semua siswa di sini)</span>
                    <div className="hint-row">
                      <FilterSelect
                        value={naikKe[selectedClass.id] || ''}
                        onChange={(v) => setNaikKe((m) => ({ ...m, [selectedClass.id]: v }))}
                        placeholder="— kelas tujuan —"
                        minWidth={180}
                        options={sortedClasses
                          .filter((k) => k.id !== selectedClass.id)
                          .map((k) => ({ value: k.id, label: `${k.name} (${k.jenjang})` }))}
                      />
                      <button type="button" className="btn" onClick={() => void naikkanSemua(selectedClass.id)} disabled={busy}>
                        {busy ? 'Memindah…' : 'Naikkan semua'}
                      </button>
                    </div>
                    <p className="hint-note">Satu siswa tetap satu kelas. Jenjang profil mengikuti kelas tujuan.</p>
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Masukkan Siswa</h3>
                {availableStudents.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: 13 }}>Semua siswa sudah di kelas.</p>
                ) : (
                  <div className="student-list">
                    {availableStudents.map((s) => (
                      <div key={s.id} className="student-item">
                        <div className="student-info">
                          <div>
                            <span className="student-name">{s.full_name || s.user_id}</span>
                            <span className="student-meta">{s.jenjang?.toUpperCase() || '-'}</span>
                          </div>
                        </div>
                        <button type="button" className="btn btn-sm" style={{ fontSize: 12 }} onClick={() => masukkan(selectedClass.id, s.id)}>
                          Masukkan
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🏫</div>
              <h3 className="empty-state-title">Pilih Kelas</h3>
              <p className="empty-state-text">Pilih kelas dari dropdown di samping untuk melihat dan mengelola siswa.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
