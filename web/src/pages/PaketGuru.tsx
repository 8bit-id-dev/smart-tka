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

const JENJANG_OPTS = ['sd', 'smp', 'sma', 'smk'] as const;

export function PaketGuru({ profile }: { profile: AppProfile }) {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    let pkgId = editId;
    if (editId) {
      const { error } = await insforge.database.from('packages').update(row).eq('id', editId);
      if (error) {
        setErr(error.message);
        setOk('');
        setBusy(false);
        return;
      }
      await insforge.database.from('package_items').delete().eq('package_id', editId);
    } else {
      const { data, error } = await insforge.database.from('packages').insert(row).select('id');
      if (error || !data?.[0]) {
        setErr(error?.message || 'Gagal insert paket.');
        setOk('');
        setBusy(false);
        return;
      }
      pkgId = (data[0] as { id: string }).id;
    }

    const links = picked.map((item_id, position) => ({ package_id: pkgId, item_id, position: position + 1 }));
    const { error: e2 } = await insforge.database.from('package_items').insert(links);
    if (e2) {
      setErr(e2.message);
      setOk('');
      setBusy(false);
      return;
    }
    setOk(editId ? 'Paket diperbarui.' : 'Paket dibuat.');
    kosongkanForm();
    setBusy(false);
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

  const filteredItems = items.filter((it) => !mapel || it.mapel === mapel).filter((it) => !materi || it.materi === materi);

  if (!['guru', 'admin', 'konten'].includes(profile.role)) {
    return (
      <div className="page">
        <div className="form-card">
          <h2 className="card-title">Paket</h2>
          <p className="card-subtitle">Hanya guru/admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{editId ? 'Ubah paket' : 'Buat paket soal'}</h1>
        <p className="page-subtitle">Satu paket = satu mapel. Pilih soal dari bank Anda (menu Soal).</p>
      </header>

      {err && (
        <div className="banner banner-danger" style={{ marginBottom: 20 }}>
          <p className="banner-text">{err}</p>
        </div>
      )}
      {ok && (
        <div className="banner banner-ok" style={{ marginBottom: 20 }}>
          <p className="banner-text">{ok}</p>
        </div>
      )}

      <form onSubmit={simpan} className="form-container">
        <div className="form-card">
          <header className="card-header">
            <div>
              <h2 className="card-title">{editId ? 'Sunting paket' : 'Identitas paket'}</h2>
              <p className="card-subtitle">Judul, jenis uji, jenjang, dan mapel/materi.</p>
            </div>
            {editId && (
              <button className="btn btn-ghost btn-sm" type="button" onClick={kosongkanForm}>
                Batal
              </button>
            )}
          </header>

          <div className="form-section">
            <div className="form-section-title">Judul <span className="req"></span></div>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Latihan penalaran 15 menit"
            />
          </div>

          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <div className="form-section-title">Jenis <span className="req"></span></div>
                <select className="select" value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number]['id'])}>
                  {KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
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
          </div>

          <div className="form-section">
            <div className="form-section-title">Mapel &amp; materi <span className="req"></span></div>
            <p className="input-hint">
              {mapel ? `${mapel}${materi ? ` · ${materi}` : ''}` : 'Belum dipilih'}
            </p>
            <div className="hint-panel" style={{ marginTop: 8 }}>
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
            </div>
          </div>

          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <div className="form-section-title">
                  Durasi (menit) <span className="req"></span>
                </div>
                <input
                  className="input"
                  type="number"
                  min={kind === 'latihan' ? 0 : 5}
                  max={180}
                  value={menit}
                  onChange={(e) => setMenit(Number(e.target.value))}
                />
                <p className="input-hint" style={{ marginTop: 4 }}>
                  {kind === 'latihan' ? '0 = tanpa countdown ketat' : 'wajib untuk simulasi/ujian'}
                </p>
              </div>
              <div className="form-group">
                <div className="form-section-title">Pengaturan</div>
                <div className="field-row" style={{ marginTop: 8 }}>
                  <input type="checkbox" id="pkg-shuffle" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
                  <label className="form-label" htmlFor="pkg-shuffle">
                    Acak urutan per murid
                  </label>
                </div>
                <div className="field-row" style={{ marginTop: 6 }}>
                  <input type="checkbox" id="pkg-discuss" checked={discuss} onChange={() => {}} disabled />
                  <label className="form-label" htmlFor="pkg-discuss" style={{ color: 'var(--muted)' }}>
                    Pembahasan langsung (otomatis untuk jenis Latihan)
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="form-card">
          <header className="card-header">
            <h2 className="card-title">Pilih soal</h2>
            <p className="card-subtitle">{picked.length} dipilih · {filteredItems.length} tersedia untuk mapel ini</p>
          </header>

          {items.length === 0 && (
            <div className="banner banner-warn">
              <p className="banner-text">Belum ada soal. Buat dulu di menu Soal.</p>
            </div>
          )}
          {items.length > 0 && filteredItems.length === 0 && (
            <p className="type-lab">Tidak ada soal yang cocup dengan filter mapel/materi ini.</p>
          )}

          <div className="chip-pick-row">
            {filteredItems.map((it) => (
              <label
                key={it.id}
                className="chip-pick"
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 6,
                  cursor: 'pointer',
                  backgroundColor: picked.includes(it.id) ? 'var(--teal-soft)' : undefined,
                }}
              >
                <div className="field-row" style={{ width: '100%', margin: 0, gap: 6, padding: 0 }}>
                  <input type="checkbox" checked={picked.includes(it.id)} onChange={() => toggle(it.id)} />
                  <span className="chip chip-sedang" style={{ fontSize: 10, padding: '2px 6px' }}>{it.item_type}</span>
                </div>
                <span className="type-bm" style={{ fontSize: 13, marginTop: 2 }}>
                  {it.mapel}
                  {it.materi ? ` · ${it.materi}` : ''} — {it.stem.slice(0, 120)}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : editId ? 'Simpan perubahan' : 'Buat paket'}
          </button>
        </div>
      </form>

      <section className="form-card" style={{ marginTop: 24 }}>
        <header className="card-header">
          <h2 className="card-title">Paket saya ({pkgs.length})</h2>
        </header>

        {pkgs.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3 className="empty-state-title">Belum ada paket</h3>
            <p className="empty-state-text">Buat paket pertama di formulir di atas.</p>
          </div>
        )}

        {pkgs.map((p) => (
          <article key={p.id} className="card" style={{ marginBottom: 8, boxShadow: 'none', padding: '12px 16px' }}>
            <div className="card-header">
              <div>
                <h3 className="card-title" style={{ fontSize: 15 }}>{p.title}</h3>
                <p className="card-subtitle">
                  {p.kind} · {p.mapel} · {p.item_count} soal ·{' '}
                  {p.duration_sec ? `${Math.round(p.duration_sec / 60)} mnt` : 'tanpa timer ketat'} ·{' '}
                  {p.discuss_after_each ? 'pembahasan langsung' : 'pembahasan setelah paket'}
                </p>
              </div>
              <div className="btn-group">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => muatPaket(p)}>
                  Ubah
                </button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => hapus(p.id)}>
                  Hapus
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
