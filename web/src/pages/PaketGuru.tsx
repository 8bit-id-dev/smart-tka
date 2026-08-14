import { useEffect, useState } from 'react';
import { KurikulumCrud } from '../components/KurikulumCrud';
import { insforge, type AppProfile } from '../lib/insforge';
import type { MapelRow, MateriRow } from '../lib/kurikulum';

type ItemRow = { id: string; stem: string; mapel: string; materi?: string | null; item_type: string };
type Pkg = {
  id: string;
  title: string;
  kind: string;
  mapel: string;
  materi?: string | null;
  jenjang: string;
  item_count: number;
  duration_sec: number | null;
  discuss_after_each: boolean;
  shuffle: boolean;
};

const KINDS = [
  { id: 'latihan', label: 'Latihan (pembahasan langsung)' },
  { id: 'simulasi', label: 'Simulasi (pembahasan setelah paket)' },
  { id: 'ujian_kelas', label: 'Ujian kelas' },
  { id: 'lab_25', label: 'Lab 25 menit' },
] as const;

export function PaketGuru({ profile }: { profile: AppProfile }) {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('latihan');
  const [mapel, setMapel] = useState('');
  const [materi, setMateri] = useState('');
  const [mapelId, setMapelId] = useState('');
  const [materiId, setMateriId] = useState('');
  const [jenjang, setJenjang] = useState(profile.jenjang || 'sma');
  const [menit, setMenit] = useState(15);
  const [shuffle, setShuffle] = useState(true);

  const discuss = kind === 'latihan';
  const durationSec = kind === 'latihan' ? (menit > 0 ? menit * 60 : null) : Math.max(5, menit) * 60;

  async function load() {
    const p = await insforge.database
      .from('packages')
      .select('id, title, kind, mapel, materi, jenjang, item_count, duration_sec, discuss_after_each, shuffle')
      .eq('created_by', profile.id);
    if (p.error) setErr(p.error.message);
    else setPkgs((p.data || []) as Pkg[]);

    const it = await insforge.database.from('items').select('id, stem, mapel, materi, item_type').eq('author_id', profile.id);
    if (!it.error) setItems((it.data || []) as ItemRow[]);
  }

  useEffect(() => {
    void load();
  }, [profile.id]);

  function toggle(id: string) {
    setPicked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  function kosongkanForm() {
    setEditId(null);
    setTitle('');
    setPicked([]);
    setKind('latihan');
    setMenit(15);
  }

  async function muatPaket(p: Pkg) {
    setEditId(p.id);
    setTitle(p.title);
    setKind(p.kind as (typeof KINDS)[number]['id']);
    setMapel(p.mapel);
    setMateri(p.materi || '');
    setJenjang(p.jenjang);
    setMenit(p.duration_sec ? Math.round(p.duration_sec / 60) : 0);
    setShuffle(p.shuffle);
    const { data } = await insforge.database.from('package_items').select('item_id').eq('package_id', p.id);
    setPicked(((data || []) as { item_id: string }[]).map((r) => r.item_id));
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setOk('');
    if (!profile.school_id) {
      setErr('Profil belum punya school_id.');
      return;
    }
    if (!title.trim()) {
      setErr('Judul wajib.');
      return;
    }
    if (!mapel.trim()) {
      setErr('Pilih mapel.');
      return;
    }
    if (picked.length < 1) {
      setErr('Pilih minimal 1 soal dari bank Anda.');
      return;
    }

    const row = {
      school_id: profile.school_id,
      created_by: profile.id,
      kind,
      mapel,
      materi: materi || null,
      jenjang,
      title: title.trim(),
      item_count: picked.length,
      duration_sec: durationSec,
      shuffle,
      discuss_after_each: discuss,
    };

    setOk('Menyimpan…');
    let pkgId = editId;
    if (editId) {
      const { error } = await insforge.database.from('packages').update(row).eq('id', editId);
      if (error) {
        setErr(error.message);
        setOk('');
        return;
      }
      await insforge.database.from('package_items').delete().eq('package_id', editId);
    } else {
      const { data, error } = await insforge.database.from('packages').insert(row).select('id');
      if (error || !data?.[0]) {
        setErr(error?.message || 'Gagal insert paket.');
        setOk('');
        return;
      }
      pkgId = (data[0] as { id: string }).id;
    }

    const links = picked.map((item_id, position) => ({ package_id: pkgId, item_id, position: position + 1 }));
    const { error: e2 } = await insforge.database.from('package_items').insert(links);
    if (e2) {
      setErr(e2.message);
      setOk('');
      return;
    }
    setOk(editId ? 'Paket diperbarui.' : 'Paket dibuat.');
    kosongkanForm();
    await load();
  }

  async function hapus(id: string) {
    if (!confirm('Hapus paket ini?')) return;
    const { error } = await insforge.database.from('packages').delete().eq('id', id);
    if (error) setErr(error.message);
    else {
      if (editId === id) kosongkanForm();
      await load();
    }
  }

  if (!['guru', 'admin', 'konten'].includes(profile.role)) {
    return (
      <div className="placeholder">
        <section className="card">
          <h2>Paket</h2>
          <p>Hanya guru/admin.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="placeholder" style={{ maxWidth: 800 }}>
      <section className="card">
        <h2>{editId ? 'Ubah paket' : 'Buat paket soal'}</h2>
        <p className="type-lab">Satu paket = satu mapel. Pilih soal dari bank Anda (menu Soal).</p>
        <form onSubmit={simpan} className="auth-form">
          <label>
            Judul
            <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Latihan penalaran 15 menit" />
          </label>
          <label>
            Jenis
            <select className="sel-input" value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number]['id'])}>
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
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
          <KurikulumCrud
            profile={profile}
            jenjang={jenjang}
            pilihMapelId={mapelId}
            pilihMateriId={materiId}
            onPilih={(mp: MapelRow | null, mt: MateriRow | null) => {
              setMapelId(mp?.id || '');
              setMateriId(mt?.id || '');
              setMapel(mp?.name || '');
              setMateri(mt?.name || '');
            }}
          />
          <label>
            Durasi (menit) {kind === 'latihan' ? '— 0 = tanpa countdown ketat' : '— wajib untuk simulasi/ujian'}
            <input type="number" min={kind === 'latihan' ? 0 : 5} max={180} value={menit} onChange={(e) => setMenit(Number(e.target.value))} />
          </label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
            Acak urutan per murid
          </label>

          <p className="type-lab">Pilih soal ({picked.length} dipilih)</p>
          {items.length === 0 && <p className="auth-msg">Belum ada soal. Buat dulu di menu Soal.</p>}
          {items
            .filter((it) => !mapel || it.mapel === mapel)
            .filter((it) => !materi || it.materi === materi)
            .map((it) => (
            <label key={it.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', fontWeight: 400 }}>
              <input type="checkbox" checked={picked.includes(it.id)} onChange={() => toggle(it.id)} />
              <span>
                <span className="chip chip-sedang">{it.item_type}</span> {it.mapel}
                {it.materi ? ` · ${it.materi}` : ''} — {it.stem.slice(0, 100)}
              </span>
            </label>
          ))}

          {err && <p className="auth-msg">{err}</p>}
          {ok && <p className="legal" style={{ color: '#2f9e6b' }}>{ok}</p>}
          <div className="login-actions">
            <button className="btn" type="submit">
              {editId ? 'Simpan perubahan' : 'Buat paket'}
            </button>
            {editId && (
              <button className="btn btn-ghost" type="button" onClick={kosongkanForm}>
                Batal
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Paket saya ({pkgs.length})</h2>
        {pkgs.map((p) => (
          <article key={p.id} className="card" style={{ marginBottom: 8, boxShadow: 'none' }}>
            <strong>{p.title}</strong>
            <p className="meta">
              {p.kind} · {p.mapel} · {p.item_count} soal · {p.duration_sec ? `${Math.round(p.duration_sec / 60)} mnt` : 'tanpa timer ketat'} ·{' '}
              {p.discuss_after_each ? 'pembahasan langsung' : 'pembahasan setelah paket'}
            </p>
            <div className="login-actions">
              <button type="button" className="btn-ghost btn" onClick={() => muatPaket(p)}>
                Ubah
              </button>
              <button type="button" className="btn-ghost btn" onClick={() => hapus(p.id)}>
                Hapus
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
