import { useEffect, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';
import { loadMapels, loadMateris, type MapelRow, type MateriRow } from '../lib/kurikulum';

export function KurikulumCrud({
  profile,
  jenjang,
  onPilih,
  pilihMapelId,
  pilihMateriId,
  allowedSubjects,
  isAdmin = false,
}: {
  profile: AppProfile;
  jenjang: string;
  pilihMapelId: string;
  pilihMateriId: string;
  onPilih: (mapel: MapelRow | null, materi: MateriRow | null) => void;
  allowedSubjects?: string[];
  isAdmin?: boolean;
}) {
  const [mapels, setMapels] = useState<MapelRow[]>([]);
  const [materis, setMateris] = useState<MateriRow[]>([]);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(true);
  const [namaMapel, setNamaMapel] = useState('');
  const [namaMateri, setNamaMateri] = useState('');
  const [editMapel, setEditMapel] = useState<MapelRow | null>(null);
  const [editMateri, setEditMateri] = useState<MateriRow | null>(null);

  async function muatMateri(mapelId: string) {
    if (!mapelId) {
      setMateris([]);
      return [];
    }
    const r = await loadMateris(mapelId);
    if (r.error) setErr(r.error);
    setMateris(r.rows);
    return r.rows;
  }

  async function refresh() {
    if (!profile.school_id) {
      setErr('Profil belum punya school_id.');
      return;
    }
    const m = await loadMapels(profile.school_id, jenjang);
    if (m.error) {
      setErr(
        m.error.includes('does not exist') || m.error.includes('Could not find')
          ? 'Tabel mapels belum ada. Jalankan SQL 011_mapel_materi.sql di InsForge.'
          : m.error,
      );
      setMapels([]);
      return;
    }
    setErr('');
    const displayed = allowedSubjects
      ? m.rows.filter((r) => allowedSubjects.includes(r.name))
      : m.rows;
    setMapels(displayed);
    const still = displayed.find((r) => r.id === pilihMapelId);
    if (still) {
      await muatMateri(still.id);
    } else if (displayed[0]) {
      const mats = await muatMateri(displayed[0].id);
      onPilih(displayed[0], mats[0] || null);
    } else {
      setMateris([]);
      onPilih(null, null);
    }
  }

  useEffect(() => {
    void refresh();
  }, [profile.school_id, jenjang]);

  useEffect(() => {
    void muatMateri(pilihMapelId);
  }, [pilihMapelId]);

  async function simpanMapel() {
    if (!profile.school_id || !namaMapel.trim()) return;
    setErr('');
    if (editMapel) {
      const { error } = await insforge.database.from('mapels').update({ name: namaMapel.trim() }).eq('id', editMapel.id);
      if (error) {
        setErr(error.message);
        return;
      }
    } else {
      const { data, error } = await insforge.database
        .from('mapels')
        .insert({ school_id: profile.school_id, name: namaMapel.trim(), jenjang })
        .select('id, name, jenjang, school_id');
      if (error) {
        setErr(error.message);
        return;
      }
      const row = (data?.[0] || null) as MapelRow | null;
      if (row) onPilih(row, null);
    }
    setNamaMapel('');
    setEditMapel(null);
    await refresh();
  }

  async function salinDefault() {
    if (!profile.school_id) return;
    const defaults =
      jenjang === 'sma'
        ? ['Bahasa Indonesia', 'Matematika', 'Bahasa Inggris', 'Fisika', 'Kimia', 'Biologi', 'Ekonomi', 'Geografi', 'Sejarah', 'Sosiologi']
        : jenjang === 'smk'
          ? ['Bahasa Indonesia', 'Matematika', 'Bahasa Inggris', 'Produk / PKK']
          : ['Bahasa Indonesia', 'Matematika'];
    for (const name of defaults) {
      await insforge.database.from('mapels').insert({ school_id: profile.school_id, name, jenjang });
    }
    await refresh();
  }

  async function hapusMapel(id: string) {
    if (!confirm('Hapus mapel ini beserta materinya? Soal lama tetap ada.')) return;
    const { error } = await insforge.database.from('mapels').delete().eq('id', id);
    if (error) setErr(error.message);
    else await refresh();
  }

  async function simpanMateri() {
    if (!pilihMapelId || !namaMateri.trim()) {
      setErr('Pilih mapel dulu, lalu isi nama materi.');
      return;
    }
    setErr('');
    if (editMateri) {
      const { error } = await insforge.database.from('materis').update({ name: namaMateri.trim() }).eq('id', editMateri.id);
      if (error) {
        setErr(error.message);
        return;
      }
    } else {
      const { data, error } = await insforge.database
        .from('materis')
        .insert({ mapel_id: pilihMapelId, name: namaMateri.trim() })
        .select('id, name, mapel_id');
      if (error) {
        setErr(
          error.message.includes('does not exist') || error.message.includes('Could not find')
            ? 'Tabel materis belum ada. Jalankan SQL 011.'
            : error.message,
        );
        return;
      }
      const row = (data?.[0] || null) as MateriRow | null;
      const mp = mapels.find((x) => x.id === pilihMapelId) || null;
      if (row) onPilih(mp, row);
    }
    setNamaMateri('');
    setEditMateri(null);
    await muatMateri(pilihMapelId);
  }

  async function hapusMateri(id: string) {
    if (!confirm('Hapus materi ini?')) return;
    const { error } = await insforge.database.from('materis').delete().eq('id', id);
    if (error) setErr(error.message);
    else {
      const mats = await muatMateri(pilihMapelId);
      if (pilihMateriId === id) {
        const mp = mapels.find((x) => x.id === pilihMapelId) || null;
        onPilih(mp, mats[0] || null);
      }
    }
  }

  const mapelAktif = mapels.find((m) => m.id === pilihMapelId) || null;

  return (
    <div>
      <div>
        <span className="type-lab">
          Mapel — klik namanya untuk memilih
          {mapelAktif ? ` · terpilih: ${mapelAktif.name}` : ''}
        </span>
        <div className="chip-pick-row">
          {mapels.length === 0 && <span className="type-lab">Belum ada mapel.</span>}
          {[...mapels]
            .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
            .map((m) => (
              <button
                key={m.id}
                type="button"
                className={`chip-pick${m.id === pilihMapelId ? ' on' : ''}`}
                onClick={() => onPilih(m, null)}
              >
                {m.name}
              </button>
            ))}
        </div>
      </div>
      <div>
        <span className="type-lab">Materi — klik untuk memilih</span>
        <div className="chip-pick-row">
          {!pilihMapelId && <span className="type-lab">Pilih mapel dulu.</span>}
          {pilihMapelId && materis.length === 0 && <span className="type-lab">Belum ada materi.</span>}
          {[...materis]
            .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
            .map((m) => (
              <button
                key={m.id}
                type="button"
                className={`chip-pick${m.id === pilihMateriId ? ' on' : ''}`}
                onClick={() => onPilih(mapelAktif, m)}
              >
                {m.name}
              </button>
            ))}
        </div>
      </div>
      {err && (
        <div className="banner banner-danger">
          <p className="banner-text">{err}</p>
        </div>
      )}
      {!mapels.length && !err && (
        <p className="type-lab">
          Belum ada mapel untuk jenjang {jenjang}.{' '}
          <button type="button" className="link" onClick={() => void salinDefault()}>
            Isi daftar TKA default
          </button>
        </p>
      )}

      <button type="button" className="link" onClick={() => setOpen((v) => !v)} style={{ margin: '8px 0 12px' }}>
        {open ? '▲ Tutup' : '▼'} {isAdmin ? 'Kelola mapel & materi' : 'Kelola materi'}
      </button>

      {open && (
        <div style={{ marginBottom: 12 }}>
          {isAdmin && (
            <div className="hint-panel">
              <span className="hint-kicker">{editMapel ? 'Ubah mapel' : 'Mapel baru'}</span>
              <div className="hint-row">
                <input type="text" className="input" value={namaMapel} onChange={(e) => setNamaMapel(e.target.value)} placeholder="Contoh: Fisika" />
                <button className="btn" type="button" onClick={() => void simpanMapel()}>
                  {editMapel ? 'Simpan' : 'Tambah'}
                </button>
                {editMapel && (
                  <button className="btn btn-ghost" type="button" onClick={() => { setEditMapel(null); setNamaMapel(''); }}>
                    Batal
                  </button>
                )}
              </div>
              <ul className="chip-list">
                {mapels.map((m) => (
                  <li key={m.id} className={m.id === pilihMapelId ? 'on' : ''}>
                    <button type="button" className="link" onClick={() => onPilih(m, null)}>
                      {m.name}
                    </button>
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        setEditMapel(m);
                        setNamaMapel(m.name);
                        onPilih(m, null);
                      }}
                    >
                      ubah
                    </button>
                    <button type="button" className="link" onClick={() => hapusMapel(m.id)}>
                      hapus
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!mapels.length && !err && isAdmin && (
            <p className="type-lab">
              Belum ada mapel untuk jenjang {jenjang}.{' '}
              <button type="button" className="link" onClick={() => void salinDefault()}>
                Isi daftar TKA default
              </button>
            </p>
          )}
          <div className="hint-panel" style={{ marginTop: isAdmin ? 10 : 0 }}>
            <span className="hint-kicker">{editMateri ? 'Ubah materi' : 'Materi baru'}</span>
            <p className="hint-note">Untuk mapel: {mapelAktif?.name || 'pilih mapel di atas'}</p>
            <div className="hint-row">
              <input
                type="text"
                className="input"
                value={namaMateri}
                onChange={(e) => setNamaMateri(e.target.value)}
                placeholder="Contoh: Turunan"
                disabled={!pilihMapelId || (!isAdmin && !allowedSubjects?.includes(mapelAktif?.name || ''))}
              />
              <button className="btn" type="button" disabled={!pilihMapelId} onClick={() => void simpanMateri()}>
                {editMateri ? 'Simpan' : 'Tambah'}
              </button>
              {editMateri && (
                <button className="btn btn-ghost" type="button" onClick={() => { setEditMateri(null); setNamaMateri(''); }}>
                  Batal
                </button>
              )}
            </div>
            <ul className="chip-list">
              {materis.length === 0 && <li className="type-lab">Belum ada materi</li>}
              {materis.map((m) => (
                <li key={m.id}>
                  {m.name}
                  <button type="button" className="link" onClick={() => { setEditMateri(m); setNamaMateri(m.name); onPilih(mapelAktif, m); }}>
                    ubah
                  </button>
                  <button type="button" className="link" onClick={() => hapusMateri(m.id)}>
                    hapus
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
