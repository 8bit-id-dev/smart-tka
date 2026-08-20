import { useEffect, useMemo, useState } from 'react';
import { KurikulumCrud } from '../components/KurikulumCrud';
import { insforge, type AppProfile } from '../lib/insforge';
import type { MapelRow } from '../lib/kurikulum';

type ItemRow = { id: string; stem: string; mapel: string; materi?: string | null; item_type: string; difficulty?: number | null };
type Pkg = {
  id: string;
  title: string;
  kind: string;
  mapel: string;
  materi?: string | null;
  info?: string | null;
  jenjang: string;
  item_count: number;
  duration_sec: number | null;
  discuss_after_each: boolean;
  shuffle: boolean;
  use_ai_selection?: boolean;
  jumlah_soal_soal?: number | null;
  ai_config?: Record<string, unknown> | null;
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  pg: 'PG',
  pg_kompleks: 'PG Kompleks',
  uraian: 'Uraian',
  pernyataan_bs: 'B/S',
  mencocokkan: 'Mencocokkan',
};

const ALL_ITEM_TYPES = ['pg', 'pg_kompleks', 'uraian', 'pernyataan_bs', 'mencocokkan'];
const DIFF_OPTS = [
  { v: 1, label: '1 — Mudah' },
  { v: 2, label: '2 — Sedang' },
  { v: 3, label: '3 — Sulit' },
] as const;

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
  const [useAiSelection, setUseAiSelection] = useState(true);
  const [jumlahPerTipe, setJumlahPerTipe] = useState<Record<string, number>>(
    ALL_ITEM_TYPES.reduce((acc, t) => ({ ...acc, [t]: 0 }), {})
  );
  const jumlahSoalTotal = useMemo(
    () => Object.values(jumlahPerTipe).reduce((s, n) => s + (n || 0), 0),
    [jumlahPerTipe]
  );
  const [selectedMateris, setSelectedMateris] = useState<Set<string>>(new Set());
  const [infoText, setInfoText] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedDiffs, setSelectedDiffs] = useState<Set<number>>(new Set());
  const [mySubjects, setMySubjects] = useState<string[]>([]);
  const isGuru = profile.role === 'guru';

  const discuss = kind === 'latihan';
  const durationSec = kind === 'latihan' ? (menit > 0 ? menit * 60 : null) : Math.max(5, menit) * 60;

  async function load() {
       const p = await insforge.database
          .from('packages')
          .select('id, title, kind, mapel, materi, info, jenjang, item_count, duration_sec, discuss_after_each, shuffle, use_ai_selection, jumlah_soal_soal, ai_config')
          .eq('created_by', profile.id);
        if (p.error) setErr(p.error.message);
        else setPkgs((p.data || []) as Pkg[]);
    }

  useEffect(() => {
    void load();
  }, [profile.id]);

  useEffect(() => {
    if (!isGuru) return;
    void (async () => {
      const { data, error } = await insforge.database
        .from('teacher_subjects')
        .select('subject')
        .eq('profile_id', profile.id)
        .eq('is_active', true);
      if (!error && data) setMySubjects((data as { subject: string }[]).map((r) => r.subject));
    })();
  }, [profile.id, isGuru]);

  useEffect(() => {
    if (!mapel) {
      setItems([]);
      return;
    }
    void (async () => {
      const { data, error } = await insforge.database
        .from('items')
        .select('id, stem, mapel, materi, item_type, difficulty')
        .eq('mapel', mapel)
        .order('mapel')
        .order('materi');
      if (error) setErr(error.message);
      else setItems((data || []) as ItemRow[]);
    })();
  }, [mapel]);

  function toggle(id: string) {
    setPicked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  function kosongkanForm() {
    setEditId(null);
    setTitle('');
    setPicked([]);
    setKind('latihan');
    setMenit(15);
     setUseAiSelection(true);
    setJumlahPerTipe(ALL_ITEM_TYPES.reduce((acc, t) => ({ ...acc, [t]: 0 }), {}));
    setSelectedMateris(new Set());
    setSelectedTypes(new Set());
    setSelectedDiffs(new Set());
    setInfoText('');
  }

  async function muatPaket(p: Pkg) {
    if (isGuru && mySubjects.length > 0 && !mySubjects.includes(p.mapel)) {
      setErr(`Paket "${p.title}" adalah untuk mapel "${p.mapel}" yang tidak lagi Anda ajar.`);
      return;
    }
    setEditId(p.id);
    setTitle(p.title);
    setKind(p.kind as (typeof KINDS)[number]['id']);
    setMapel(p.mapel);
    setMateri(p.materi || '');
    setJenjang(p.jenjang);
    setMenit(p.duration_sec ? Math.round(p.duration_sec / 60) : 0);
    setShuffle(p.shuffle);
    setUseAiSelection(p.use_ai_selection || false);
    if (p.ai_config && typeof p.ai_config === 'object') {
      const cfg = p.ai_config as Record<string, unknown>;
      if (Array.isArray(cfg.materi)) setSelectedMateris(new Set(cfg.materi as string[]));
      else setSelectedMateris(p.materi ? new Set(p.materi.split(',').map((s) => s.trim()).filter(Boolean)) : new Set());
      if (Array.isArray(cfg.item_types)) setSelectedTypes(new Set(cfg.item_types as string[]));
      if (Array.isArray(cfg.difficulties)) setSelectedDiffs(new Set(cfg.difficulties as number[]));
      if (cfg.jumlah_per_type && typeof cfg.jumlah_per_type === 'object') setJumlahPerTipe(cfg.jumlah_per_type as Record<string, number>);
    } else {
      setSelectedMateris(p.materi ? new Set(p.materi.split(',').map((s) => s.trim()).filter(Boolean)) : new Set());
    }
    setInfoText(p.info || '');
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
    if (!useAiSelection && picked.length < 1) {
      setErr('Pilih minimal 1 soal dari bank soal.');
      return;
    }
    if (useAiSelection && jumlahSoalTotal < 1) {
      setErr('Pilih minimal 1 soal melalui jenis soal di bawah.');
      return;
    }
    if (useAiSelection) {
      for (const t of ALL_ITEM_TYPES) {
        const availT = itemsByMateri.filter((it) => it.item_type === t).length;
        if ((jumlahPerTipe[t] || 0) > availT) {
          setErr(`Jumlah ${ITEM_TYPE_LABELS[t] || t} (${jumlahPerTipe[t]}) melebihi tersedia (${availT}).`);
          return;
        }
      }
      if (jumlahSoalTotal > filteredItems.length && filteredItems.length > 0) {
        setErr(`Jumlah soal (${jumlahSoalTotal}) melebihi bank soal yang tersedia (${filteredItems.length}).`);
        return;
      }
    }

    const aiConfig = useAiSelection
      ? {
          mapel: mapel || null,
          materi: Array.from(selectedMateris),
          item_types: Array.from(selectedTypes),
          difficulties: Array.from(selectedDiffs),
          jumlah_soal: jumlahSoalTotal,
          jumlah_per_type: ALL_ITEM_TYPES.reduce(
            (acc, t) => ({ ...acc, [t]: jumlahPerTipe[t] || 0 }),
            {} as Record<string, number>
          ),
          jenjang,
        }
      : null;

    const row = {
      school_id: profile.school_id,
      created_by: profile.id,
      kind,
      mapel,
      materi: Array.from(selectedMateris).join(', ') || materi || null,
      info: infoText.trim() || null,
      jenjang,
      title: title.trim(),
      item_count: useAiSelection ? jumlahSoalTotal : picked.length,
      duration_sec: durationSec,
      shuffle,
      discuss_after_each: discuss,
      use_ai_selection: useAiSelection,
      jumlah_soal_soal: useAiSelection ? jumlahSoalTotal : null,
      ai_config: aiConfig,
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

    if (!useAiSelection && picked.length > 0) {
      const links = picked.map((item_id, position) => ({ package_id: pkgId, item_id, position: position + 1 }));
      const { error: e2 } = await insforge.database.from('package_items').insert(links);
      if (e2) {
        setErr(e2.message);
        setOk('');
        setBusy(false);
        return;
      }
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

  const uniqueMateris = [...new Set(items.map((it) => it.materi).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })
  );

  const itemsByMateri = useMemo(() =>
    items
      .filter((it) => !mapel || it.mapel === mapel)
      .filter((it) => {
        if (selectedMateris.size === 0) return true;
        return it.materi ? selectedMateris.has(it.materi) : false;
      }),
    [items, mapel, selectedMateris]
  );

  const filteredItems = useMemo(() =>
    itemsByMateri
      .filter((it) => (selectedTypes.size === 0 ? true : selectedTypes.has(it.item_type)))
      .filter((it) => (selectedDiffs.size === 0 ? true : it.difficulty !== null && selectedDiffs.has(Number(it.difficulty)))),
    [itemsByMateri, selectedTypes, selectedDiffs]
  );

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
          <p className="page-subtitle">Satu paket = satu mapel. Pilih soal dari semua bank soal sesuai mapel.</p>
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

      <div className="page-split">
        <div className="form-sticky">
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
            <div className="form-section-title">Mapel <span className="req"></span></div>
            {mapel ? (
              <p className="input-hint">
                {mapel}{Array.from(selectedMateris).length ? ` · ${Array.from(selectedMateris).join(', ')}` : ''}
              </p>
            ) : (
              <p className="input-hint">Belum dipilih</p>
            )}
            <div className="hint-panel" style={{ marginTop: 8 }}>
              <KurikulumCrud
                profile={profile}
                jenjang={jenjang}
                pilihMapelId={mapelId}
                pilihMateriId={materiId}
                allowedSubjects={isGuru ? mySubjects : undefined}
                isAdmin={profile.role !== 'guru'}
                onPilih={(mp: MapelRow | null) => {
                  if (isGuru && mp && !mySubjects.includes(mp.name)) {
                    setErr(`Anda tidak mengajar "${mp.name}". Hubungi admin untuk assignment.`);
                    return;
                  }
                  setMapelId(mp?.id || '');
                  setMateriId('');
                  setMapel(mp?.name || '');
                  setMateri('');
                  setSelectedMateris(new Set());
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
                <div className="field-row" style={{ marginTop: 6, gap: 6 }}>
                  <input
                    type="checkbox"
                    id="pkg-ai"
                    checked={useAiSelection}
                    onChange={(e) => {
                      setUseAiSelection(e.target.checked);
                    }}
                  />
                  <label className="form-label" htmlFor="pkg-ai">
                    AI seleksi acak per siswa
                  </label>
                </div>
                {useAiSelection && (
                  <div style={{ marginTop: 8 }}>
                    <div className="form-section-title" style={{ fontSize: 12 }}>Jumlah soal per jenis (AI distribusi acak per siswa)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                      {ALL_ITEM_TYPES.map((t) => {
                        const availT = itemsByMateri.filter((it) => it.item_type === t).length;
                        const label = t === 'pernyataan_bs' ? 'Pernyataan B/S' : (ITEM_TYPE_LABELS[t] ?? t);
                        return (
                          <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 90 }}>
                            <label style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</label>
                            <input
                              type="number"
                              className="input"
                              style={{ width: 90 }}
                              min={0}
                              max={availT}
                              value={(jumlahPerTipe as Record<string, number>)[t] || 0}
                              onChange={(e) => {
                                const v = Math.max(0, Math.min(Number(e.target.value) || 0, availT));
                                setJumlahPerTipe((prev) => ({ ...prev, [t]: v }));
                              }}
                            />
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{availT} tersedia</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="input-hint" style={{ marginTop: 6 }}>
                      Total {jumlahSoalTotal} soal ({filteredItems.length} tersedia). {jumlahSoalTotal === 0 ? 'Isi minimal 1.' : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Info paket <small className="muted" style={{ display: 'block', fontSize: 11, fontWeight: 400 }}>(opsional — ditampilkan di halaman konfirmasi sebelum mengerjakan)</small></div>
            <textarea
              className="input"
              value={infoText}
              onChange={(e) => setInfoText(e.target.value)}
              placeholder="mis. Paket ini mencakup PG + uraian. Durasi 90 menit. Bawa kalkulator."
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        </div>

        <div className="form-card">
          <header className="card-header">
            <h2 className="card-title">Pilih soal</h2>
            <p className="card-subtitle">
              {useAiSelection
                  ? `${filteredItems.length} soal tersedia — AI akan pilih ${jumlahSoalTotal} untuk tiap siswa`
                : `${picked.length} dipilih · ${filteredItems.length} tersedia`}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {!useAiSelection && items.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (picked.length === filteredItems.length) setPicked([]);
                    else setPicked(filteredItems.map((it) => it.id));
                  }}
                >
                  {picked.length === filteredItems.length ? 'Hapus semua' : 'Pilih semua'}
                </button>
              )}
              {uniqueMateris.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (selectedMateris.size === uniqueMateris.length) setSelectedMateris(new Set());
                    else setSelectedMateris(new Set(uniqueMateris));
                  }}
                >
                  {selectedMateris.size === uniqueMateris.length ? 'Semua materi' : `Semua materi (${uniqueMateris.length})`}
                </button>
              )}
            </div>
          </header>

          {uniqueMateris.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="form-section-title" style={{ fontSize: 12, marginBottom: 6 }}>Filter materi (pilih satu atau lebih)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {uniqueMateris.map((m) => {
                  const checked = selectedMateris.has(m);
                  return (
                    <label key={m} className="chip-pick" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(selectedMateris);
                          if (e.target.checked) next.add(m);
                          else next.delete(m);
                          setSelectedMateris(next);
                        }}
                      />
                      <span className="type-bm" style={{ fontSize: 12 }}>{m}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div className="form-section-title" style={{ fontSize: 12, marginBottom: 6 }}>Jenis soal</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_ITEM_TYPES.map((t) => {
                const checked = selectedTypes.has(t);
                const label = ITEM_TYPE_LABELS[t] ?? t;
                const available = itemsByMateri.filter((it) => it.item_type === t).length;
                return (
                  <label key={t} className="chip-pick" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: available === 0 ? 0.5 : 1 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={available === 0}
                      onChange={(e) => {
                        const next = new Set(selectedTypes);
                        if (e.target.checked) next.add(t);
                        else next.delete(t);
                        setSelectedTypes(next);
                      }}
                    />
                    <span className="type-bm" style={{ fontSize: 12 }}>{label} ({available})</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div className="form-section-title" style={{ fontSize: 12, marginBottom: 6 }}>Tingkat kesulitan</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DIFF_OPTS.map((d) => {
                const checked = selectedDiffs.has(d.v);
                const available = itemsByMateri.filter((it) => it.difficulty === d.v).length;
                return (
                  <label key={d.v} className="chip-pick" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: available === 0 ? 0.5 : 1 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={available === 0}
                      onChange={(e) => {
                        const next = new Set(selectedDiffs);
                        if (e.target.checked) next.add(d.v);
                        else next.delete(d.v);
                        setSelectedDiffs(next);
                      }}
                    />
                    <span className="type-bm" style={{ fontSize: 12 }}>{d.label} ({available})</span>
                  </label>
                );
              })}
            </div>
            {selectedDiffs.size > 0 && (
              <p className="input-hint" style={{ marginTop: 6 }}>Hanya soal dengan tingkat kesulitan terpilih yang dimasukkan ke paket.</p>
            )}
          </div>

          {useAiSelection && (
            <div className="rec-card" style={{ marginBottom: 12 }}>
              <div className="rec-icon">💡</div>
              <div className="rec-info">
                <h3>Distribusi oleh AI</h3>
                <p>AI akan memilih secara acak {jumlahSoalTotal} soal untuk setiap siswa — berbeda tiap user — berdasarkan jumlah per jenis soal, jenis soal, dan tingkat kesulitan di atas. Semua soal pada bank soal ini dapat dipilih.</p>
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="banner banner-warn">
              <p className="banner-text">Pilih mapel terlebih dahku untuk melihat bank soal tersedia.</p>
            </div>
          )}
          {items.length > 0 && filteredItems.length === 0 && (
            <p className="type-lab">Tidak ada soal untuk materi ini.</p>
          )}

          {!useAiSelection && (
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
                  backgroundColor: picked.includes(it.id) ? 'var(--accent-soft)' : undefined,
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
          )}
        </div>

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : editId ? 'Simpan perubahan' : 'Buat paket'}
          </button>
        </div>
      </form>
        </div>

      <section className="form-card" style={{ marginTop: 0 }}>
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
                  {p.use_ai_selection && ` · AI: ${p.jumlah_soal_soal} soal/siswa`}
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
  </div>
  );
}
