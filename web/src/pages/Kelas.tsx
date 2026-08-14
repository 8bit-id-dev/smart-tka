import { useEffect, useState } from 'react';
import { assignSiswaKeKelas } from '../lib/kelas';
import { insforge, type AppProfile } from '../lib/insforge';

type Cls = { id: string; name: string; jenjang: string; invite_code: string };
type Siswa = { id: string; full_name: string | null; user_id: string; jenjang: string | null };
type Anggota = { profile_id: string };

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
    const code = (kode.trim() || 'K' + Math.random().toString(36).slice(2, 8)).toUpperCase();
    const { error } = await insforge.database.from('classes').insert({
      school_id: profile.school_id,
      name: name.trim(),
      jenjang,
      invite_code: code,
    });
    if (error) setErr(error.message);
    else {
      setOk('Kelas dibuat. Kode: ' + code);
      setName('Kelas 9A');
      setKode('');
      await load();
    }
  }

  async function simpanKelas(id: string) {
    const { error } = await insforge.database
      .from('classes')
      .update({
        name: editName.trim(),
        invite_code: (editKode.trim() || editName.trim()).toUpperCase(),
      })
      .eq('id', id);
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
    for (const pid of ids) {
      const { error } = await assignSiswaKeKelas(pid, toId, {
        fromClassId: fromId,
        reason: 'kenaikan',
        jenjang: tujuan?.jenjang,
      });
      if (error) {
        setErr(error.message);
        await load();
        return;
      }
    }
    setOk(`${ids.length} siswa dinaikkan ke ${tujuan?.name}.`);
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
      <div className="placeholder">
        <section className="card">
          <h2>Kelas</h2>
          <p>Hanya guru/admin/kepsek.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="placeholder" style={{ maxWidth: 800 }}>
      {err && <p className="auth-msg">{err}</p>}
      {ok && (
        <p className="legal" style={{ color: '#2f9e6b' }}>
          {ok}
        </p>
      )}

      <section className="card">
        <h2>Buat kelas + kode</h2>
        <p className="type-lab">Satu siswa hanya di satu kelas. Import CSV memakai kolom kode_kelas = kode undangan ini.</p>
        <form onSubmit={buat} className="auth-form">
          <label>
            Nama kelas
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Kode kelas (undangan)
            <input
              value={kode}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
              placeholder="Contoh: 9A-2026 (kosong = otomatis)"
            />
          </label>
          <label>
            Jenjang
            <select className="sel-input" value={jenjang} onChange={(e) => setJenjang(e.target.value)}>
              <option value="sd">sd</option>
              <option value="smp">smp</option>
              <option value="sma">sma</option>
              <option value="smk">smk</option>
            </select>
          </label>
          <button className="btn" type="submit">
            Buat kelas
          </button>
        </form>
      </section>

      {rows.map((c) => {
        const ids = anggota[c.id] || [];
        const belum = siswa.filter((s) => !sudahDiKelas.has(s.id));
        const terbuka = openId === c.id;
        return (
          <section key={c.id} className="card" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="link"
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                alignItems: 'center',
                textAlign: 'left',
                background: 'none',
                border: 0,
                padding: 0,
                cursor: 'pointer',
              }}
              onClick={() => setOpenId((cur) => (cur === c.id ? null : c.id))}
              aria-expanded={terbuka}
            >
              <h2 style={{ margin: 0 }}>
                {c.name} <span className="type-lab">({ids.length} siswa)</span>
              </h2>
              <span className="type-lab">{terbuka ? '▲ tutup' : '▼ buka'}</span>
            </button>
            <p className="mono" style={{ marginTop: 8 }}>
              Kode: {c.invite_code} · {c.jenjang}
            </p>

            {terbuka && (
              <>
                {editId === c.id ? (
                  <div className="auth-form">
                    <label>
                      Nama
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </label>
                    <label>
                      Kode kelas
                      <input value={editKode} onChange={(e) => setEditKode(e.target.value.toUpperCase())} />
                    </label>
                    <button type="button" className="btn" onClick={() => simpanKelas(c.id)}>
                      Simpan nama & kode
                    </button>
                  </div>
                ) : null}
                <div className="login-actions">
                  <button
                    type="button"
                    className="btn-ghost btn"
                    onClick={() => {
                      setEditId(c.id);
                      setEditName(c.name);
                      setEditKode(c.invite_code);
                    }}
                  >
                    Ubah nama & kode
                  </button>
                  <button type="button" className="btn-ghost btn" onClick={() => hapusKelas(c.id)}>
                    Hapus kelas
                  </button>
                </div>

                <h3 className="type-hm" style={{ fontSize: 18, marginTop: 20 }}>
                  Siswa di kelas ({ids.length})
                </h3>
                {ids.length === 0 && <p className="type-lab">Belum ada siswa.</p>}
                {ids
                  .slice()
                  .sort((a, b) => namaSiswa(a).localeCompare(namaSiswa(b), 'id', { sensitivity: 'base' }))
                  .map((pid) => (
                  <div key={pid} className="login-actions" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ flex: '1 1 140px' }}>{namaSiswa(pid)}</span>
                    <select
                      className="sel-input"
                      style={{ maxWidth: 200 }}
                      value={pindahKe[pid] || ''}
                      onChange={(e) => setPindahKe((m) => ({ ...m, [pid]: e.target.value }))}
                    >
                      <option value="">Pindah ke…</option>
                      {rows
                        .filter((k) => k.id !== c.id)
                        .map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name}
                          </option>
                        ))}
                    </select>
                    <button type="button" className="btn" style={{ maxWidth: 120 }} onClick={() => void pindah(c.id, pid)}>
                      Pindah
                    </button>
                    <button type="button" className="btn-ghost btn" style={{ maxWidth: 120 }} onClick={() => keluarkan(c.id, pid)}>
                      Keluarkan
                    </button>
                  </div>
                ))}

                <div className="hint-panel" style={{ marginTop: 16 }}>
                  <span className="hint-kicker">Kenaikan kelas (semua siswa di sini)</span>
                  <div className="hint-row">
                    <select
                      className="sel-input"
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
                    <button type="button" className="btn" onClick={() => void naikkanSemua(c.id)}>
                      Naikkan semua
                    </button>
                  </div>
                  <p className="hint-note">Satu siswa tetap satu kelas. Jenjang profil mengikuti kelas tujuan. Buat kelas baru dulu (mis. 11 IPA 1) sebelum menaikkan dari 10.</p>
                </div>

                <h3 className="type-hm" style={{ fontSize: 18, marginTop: 16 }}>
                  Masukkan siswa yang belum punya kelas
                </h3>
                {siswa.length === 0 && <p className="type-lab">Belum ada profil siswa. Buat di menu Admin dulu.</p>}
                {belum.length === 0 && siswa.length > 0 && (
                  <p className="type-lab">Semua siswa sudah di satu kelas. Keluarkan dulu untuk memindah, atau pilih siswa di sini lalu mereka pindah otomatis.</p>
                )}
                {belum.map((s) => (
                  <div key={s.id} className="login-actions" style={{ alignItems: 'center' }}>
                    <span>
                      {s.full_name || s.user_id} <span className="type-lab">{s.jenjang}</span>
                    </span>
                    <button type="button" className="btn" style={{ maxWidth: 160 }} onClick={() => masukkan(c.id, s.id)}>
                      Masukkan
                    </button>
                  </div>
                ))}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
