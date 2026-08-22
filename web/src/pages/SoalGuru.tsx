import { useEffect, useState } from 'react';
import { KurikulumCrud } from '../components/KurikulumCrud';
import { MathField } from '../components/MathField';
import { MathText } from '../components/MathText';
import { insforge, type AppProfile } from '../lib/insforge';
import type { MapelRow, MateriRow } from '../lib/kurikulum';
import { parseMatchPairs } from '../lib/soal';

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
type Tipe = 'pg' | 'pg_kompleks' | 'pernyataan_bs' | 'mencocokkan' | 'uraian';

type ItemRow = {
  id: string;
  item_type: string;
  mapel: string;
  materi?: string | null;
  jenjang: string;
  difficulty?: number;
  stem: string;
  stimulus: string | null;
  choices: unknown;
  correct_key: string;
  rationale: string;
  status: string;
  created_at?: string;
};

type SubTab = 'buat' | 'bank';

export function SoalGuru({ profile }: { profile: AppProfile }) {
  const [subTab, setSubTab] = useState<SubTab>('buat');
  const [list, setList] = useState<ItemRow[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [tipe, setTipe] = useState<Tipe>('pg');
  const [difficulty, setDifficulty] = useState<number>(2);
  const [mapel, setMapel] = useState('');
  const [materi, setMateri] = useState('');
  const [mapelId, setMapelId] = useState('');
  const [materiId, setMateriId] = useState('');
  const [jenjang, setJenjang] = useState(profile.jenjang || 'sma');
  const [stem, setStem] = useState('');
  const [rationale, setRationale] = useState('');
  const [opsi, setOpsi] = useState(['', '', '', '', '']);
  const [kunciPg, setKunciPg] = useState('C');
  const [kunciKom, setKunciKom] = useState<string[]>([]);
  const [pernyataan, setPernyataan] = useState<string[]>(['', '', '']);
  const [kunciBs, setKunciBs] = useState<('B' | 'S')[]>(['B', 'S', 'B']);

  const [matchKiri, setMatchKiri] = useState<string[]>(['', '', '']);
  const [matchKanan, setMatchKanan] = useState<string[]>(['', '', '']);
  const [kunciUraian, setKunciUraian] = useState('');

  // Collapsible state for bank soal
  const [openMapel, setOpenMapel] = useState<Record<string, boolean>>({});
  const [openMateri, setOpenMateri] = useState<Record<string, boolean>>({});
  const [openTipe, setOpenTipe] = useState<Record<string, boolean>>({});
  const [openDiff, setOpenDiff] = useState<Record<string, boolean>>({});

  const [mySubjects, setMySubjects] = useState<string[]>([]);
  const isGuru = profile.role === 'guru';
  const isAdmin = profile.role === 'admin' || profile.role === 'konten';

  async function loadMySubjects() {
    if (!isGuru && !isAdmin) return;
    const { data, error } = await insforge.database
      .from('teacher_subjects')
      .select('subject')
      .eq('profile_id', profile.id)
      .eq('is_active', true);
    if (!error && data) {
      setMySubjects((data as { subject: string }[]).map((r) => r.subject));
    }
  }

  async function load() {
    let q = insforge.database
      .from('items')
      .select('id, item_type, mapel, materi, jenjang, difficulty, stem, stimulus, choices, correct_key, rationale, status, created_at')
      .neq('status', 'retired')
      .order('created_at', { ascending: false });
    if (isGuru) {
      if (mySubjects.length > 0) {
        q = q.in('mapel', mySubjects);
      } else {
        q = q.eq('author_id', profile.id);
      }
    } else if (!isAdmin) {
      q = q.eq('author_id', profile.id);
    }
    const { data, error } = await q;
    if (error) setErr(error.message);
    else setList((data || []) as ItemRow[]);
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    void loadMySubjects();
  }, [profile.id]);
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    void load();
  }, [profile.id, mySubjects.length]);
  /* eslint-enable react-hooks/exhaustive-deps */

  function resetForm() {
    setEditingId(null);
    setDifficulty(2);
    setStem('');
    setRationale('');
    setOpsi(['', '', '', '', '']);
    setKunciPg('C');
    setKunciKom([]);
    setPernyataan(['', '', '']);
    setKunciBs(['B', 'S', 'B']);
    setMatchKiri(['', '', '']);
    setMatchKanan(['', '', '']);
    setKunciUraian('');
    setErr('');
    setOk('');
    setMapel('');
    setMateri('');
    setMapelId('');
    setMateriId('');
  }

  function toggleKom(L: string) {
    setKunciKom((c) => (c.includes(L) ? c.filter((x) => x !== L) : [...c, L].sort()));
  }

  function mulaiEdit(item: ItemRow) {
    setEditingId(item.id);
    setJenjang(item.jenjang || profile.jenjang || 'sma');
    setDifficulty(item.difficulty || 2);
    setMapel(item.mapel || '');
    setMateri(item.materi || '');
    const t = (item.item_type as Tipe) || 'pg';
    setTipe(t);
    setStem(item.stem || '');
    setRationale(item.rationale || '');

    if (t === 'pernyataan_bs') {
      if (Array.isArray(item.choices)) {
        setPernyataan(item.choices.map(String));
      } else {
        setPernyataan(['', '', '']);
      }
      try {
        const parsed = JSON.parse(item.correct_key);
        if (Array.isArray(parsed)) setKunciBs(parsed);
      } catch {
        setKunciBs(['B', 'S', 'B']);
      }
    } else if (t === 'mencocokkan') {
      const parsed = parseMatchPairs(item);
      setMatchKiri(parsed.kiri.length ? parsed.kiri : ['', '', '']);
      setMatchKanan(parsed.kanan.length ? parsed.kanan : ['', '', '']);
    } else if (t === 'uraian') {
      setKunciUraian(item.correct_key || '');
    } else {
      if (Array.isArray(item.choices)) {
        const arr = item.choices.map(String);
        while (arr.length < 5) arr.push('');
        setOpsi(arr.slice(0, 5));
      } else {
        setOpsi(['', '', '', '', '']);
      }

      if (t === 'pg') {
        setKunciPg(item.correct_key || 'A');
      } else if (t === 'pg_kompleks') {
        try {
          const parsed = JSON.parse(item.correct_key);
          if (Array.isArray(parsed)) setKunciKom(parsed);
        } catch {
          setKunciKom([]);
        }
      }
    }

    setOk('Mode sunting soal. Ubah data lalu klik "Simpan Perubahan".');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function hapusSoal(id: string) {
    if (!window.confirm('Yakin ingin menghapus soal ini dari bank soal Anda?')) {
      return;
    }
    setErr('');
    setOk('');
    setBusy(true);

    if (isGuru && mySubjects.length > 0) {
      const { data: existing, error: e1 } = await insforge.database
        .from('items')
        .select('mapel')
        .eq('id', id)
        .single();
      if (!existing || e1 || !mySubjects.includes(existing.mapel)) {
        setErr('Soal ini bukan dari mata pelajaran yang Anda ajar.');
        setBusy(false);
        return;
      }
    }

    // Optimistically remove from UI list immediately
    setList((prev) => prev.filter((item) => item.id !== id));

    // Try hard delete first
    const { error } = await insforge.database.from('items').delete().eq('id', id);
    if (error) {
      // If hard delete fails (e.g. FK constraint because item is linked to a package or attempt), perform soft delete (status = 'retired')
      const { error: softErr } = await insforge.database
        .from('items')
        .update({ status: 'retired' })
        .eq('id', id);

      if (softErr) {
        setErr('Gagal menghapus soal: ' + softErr.message);
        await load(); // restore list if soft delete also fails
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    setOk('Soal berhasil dihapus.');
    if (editingId === id) resetForm();
    await load();
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setOk('');
    if (!profile.school_id) {
      setErr('Profil Anda belum punya school_id. Minta admin menautkan sekolah.');
      return;
    }
     if (!mapel.trim()) {
       setErr('Pilih mapel dulu. Jika daftar kosong, kelola mapel atau jalankan SQL 011.');
       return;
     }
     if (isGuru && mySubjects.length > 0 && !mySubjects.includes(mapel)) {
       setErr(`Anda tidak mengajar "${mapel}". Hubungi admin untuk assignment mata pelajaran.`);
       return;
     }
    if (!stem.trim() || !rationale.trim()) {
      setErr('Pertanyaan dan pembahasan wajib diisi.');
      return;
    }

    let choices: unknown = opsi;
    let correct_key = kunciPg;
    let item_type = tipe;

    if (tipe === 'pg') {
      if (opsi.some((o) => !o.trim())) {
        setErr('Isi kelima opsi A–E.');
        return;
      }
    }
    if (tipe === 'pg_kompleks') {
      if (opsi.some((o) => !o.trim()) || kunciKom.length < 1) {
        setErr('Isi opsi A–E dan centang minimal satu kunci.');
        return;
      }
      correct_key = JSON.stringify(kunciKom);
    }
    if (tipe === 'pernyataan_bs') {
      if (pernyataan.some((p) => !p.trim())) {
        setErr('Isi semua pernyataan.');
        return;
      }
      choices = pernyataan;
      correct_key = JSON.stringify(kunciBs);
    }
    if (tipe === 'mencocokkan') {
      if (matchKiri.some((k) => !k.trim()) || matchKanan.some((k) => !k.trim())) {
        setErr('Isi semua item pasangan Kiri dan Kanan.');
        return;
      }
      choices = { kiri: matchKiri, kanan: matchKanan };
      correct_key = JSON.stringify(matchKanan);
    }
    if (tipe === 'uraian') {
      choices = null;
      correct_key = kunciUraian.trim();
    }

    setBusy(true);
    let errorObj = null;

    if (editingId) {
      if (isGuru && mySubjects.length > 0) {
        const { data: existing, error: e1 } = await insforge.database
          .from('items')
          .select('mapel')
          .eq('id', editingId)
          .single();
        if (e1 || !existing || !mySubjects.includes(existing.mapel)) {
          setErr('Anda tidak diizinkan mengubah soal dari mata pelajaran ini.');
          setBusy(false);
          return;
        }
      }
      const { error } = await insforge.database
        .from('items')
        .update({
          jenjang,
          mapel,
          materi: materi || null,
          difficulty,
          item_type,
          stem: stem.trim(),
          choices,
          correct_key,
          rationale: rationale.trim(),
        })
        .eq('id', editingId);
      errorObj = error;
    } else {
      const { error } = await insforge.database.from('items').insert({
        scope: 'school',
        school_id: profile.school_id,
        author_id: profile.id,
        jenjang,
        mapel,
        materi: materi || null,
        difficulty,
        item_type,
        stem: stem.trim(),
        choices,
        correct_key,
        rationale: rationale.trim(),
        status: 'published',
      });
      errorObj = error;
    }

    setBusy(false);
    if (errorObj) {
      setErr(errorObj.message);
      return;
    }
    setOk(editingId ? 'Perubahan soal berhasil disimpan!' : 'Soal tersimpan di bank sekolah.');
    resetForm();
    await load();
  }

  const bisaTulis = ['guru', 'admin', 'konten'].includes(profile.role);

  if (!bisaTulis) {
    return (
      <div className="placeholder">
        <section className="card">
          <h2>Soal</h2>
          <p>Hanya guru atau admin yang dapat menulis soal.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Soal</h1>
         <p className="page-subtitle">Kelola soal di bank sekolah Anda.</p>
      </header>

      <nav className="subtabs" style={{ marginBottom: 20 }}>
        <button
          className={`subtab ${subTab === 'buat' ? 'active' : ''}`}
          type="button"
          onClick={() => setSubTab('buat')}
        >
          Buat Soal
        </button>
        <button
          className={`subtab ${subTab === 'bank' ? 'active' : ''}`}
          type="button"
          onClick={() => setSubTab('bank')}
        >
          Bank Soal ({list.length})
        </button>
      </nav>

      {subTab === 'buat' && isGuru && mySubjects.length === 0 && (
        <div className="banner banner-danger" style={{ margin: '16px 0' }}>
          <p className="banner-text">Anda belum memiliki mata pelajaran yang diassign. Hubungi admin untuk menambahkan Anda ke mata pelajaran yang diajarkan.</p>
        </div>
      )}
      {subTab === 'buat' && (
        <form onSubmit={simpan} className="form-container">
          <div className="card">
            <header className="card-header">
              <div>
                <h2 className="card-title">{editingId ? 'Sunting Soal' : 'Buat Soal Baru'}</h2>
                <p className="card-subtitle">
                  {editingId
                    ? 'Ubah soal yang sudah ada.'
                     : 'Buat soal untuk bank sekolah Anda, bukan bank nasional SMART.'}
                </p>
              </div>
              {editingId && (
                <button className="btn btn-ghost btn-sm" type="button" onClick={resetForm}>
                  Batal
                </button>
              )}
            </header>

            <div className="form-row" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Jenjang</label>
                <select value={jenjang} onChange={(e) => setJenjang(e.target.value)} className="select">
                  <option value="sd">SD</option>
                  <option value="smp">SMP</option>
                  <option value="sma">SMA</option>
                  <option value="smk">SMK</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tingkat Kesulitan</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  className="select"
                >
                  <option value={1}>Mudah (Dasar)</option>
                  <option value={2}>Sedang (Menengah)</option>
                  <option value={3}>Sulit / HOTS</option>
                </select>
              </div>
            </div>

             <div style={{ marginBottom: 20 }}>
               {isGuru && mySubjects.length === 0 ? (
                 <div>
                   <label className="form-label">Mapel</label>
                   <p className="type-lab" style={{ marginTop: 4, color: 'var(--danger)' }}>
                     Anda belum memiliki mata pelajaran yang diassign. Hubungi admin untuk menambahkan Anda ke mata pelajaran yang diajarkan.
                   </p>
                 </div>
               ) : (
                 <KurikulumCrud
                   profile={profile}
                   jenjang={jenjang}
                   pilihMapelId={mapelId}
                   pilihMateriId={materiId}
                   pilihMapelName={mapel}
                   pilihMateriName={materi}
                   allowedSubjects={isGuru ? mySubjects : undefined}
                   isAdmin={isAdmin || profile.role !== 'guru'}
                   onPilih={(mp: MapelRow | null, mt: MateriRow | null) => {
                     if (isGuru && mp && !mySubjects.includes(mp.name)) {
                       setErr(`Anda tidak mengajar "${mp.name}". Hubungi admin untuk assignment.`);
                       return;
                     }
                     setMapelId(mp?.id || '');
                     setMateriId(mt?.id || '');
                     setMapel(mp?.name || '');
                     setMateri(mt?.name || '');
                   }}
                 />
               )}
             </div>

            <div className="form-group">
              <label className="form-label">Tipe Soal</label>
              <select value={tipe} onChange={(e) => setTipe(e.target.value as Tipe)} className="select">
                <option value="pg">Pilihan ganda (5 opsi, satu kunci)</option>
                <option value="pg_kompleks">Pilihan ganda kompleks (banyak kunci)</option>
                <option value="pernyataan_bs">Pernyataan benar / salah</option>
                <option value="mencocokkan">Mencocokkan / Penjodohan</option>
                <option value="uraian">Uraian / Isian Singkat</option>
              </select>
            </div>

            <MathField label="Pertanyaan / stimulus" value={stem} onChange={setStem} rows={3} required />

            {(tipe === 'pg' || tipe === 'pg_kompleks') &&
              LETTERS.map((L, idx) => (
                <MathField
                  key={L}
                  label={`Opsi ${L}`}
                  value={opsi[idx]}
                  onChange={(v) => setOpsi((a) => a.map((x, i) => (i === idx ? v : x)))}
                  prefix={
                    tipe === 'pg' ? (
                      <input type="radio" name="kunci" checked={kunciPg === L} onChange={() => setKunciPg(L)} />
                    ) : (
                      <input type="checkbox" checked={kunciKom.includes(L)} onChange={() => toggleKom(L)} />
                    )
                  }
                />
              ))}

            {tipe === 'pernyataan_bs' && (
              <div className="form-group">
                {pernyataan.map((p, idx) => (
                  <div key={idx} className="form-group" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <MathField
                          label={`Pernyataan ${idx + 1}`}
                          value={p}
                          onChange={(v) =>
                            setPernyataan((a) => a.map((x, i) => (i === idx ? v : x)))
                          }
                        />
                      </div>
                      <div className="btn-group">
                        <button
                          type="button"
                          className={`btn btn-sm ${kunciBs[idx] === 'B' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setKunciBs((a) => {
                            const arr = [...a];
                            arr[idx] = 'B';
                            return arr;
                          })}
                        >
                          Benar
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${kunciBs[idx] === 'S' ? 'btn-danger' : 'btn-ghost'}`}
                          onClick={() => setKunciBs((a) => {
                            const arr = [...a];
                            arr[idx] = 'S';
                            return arr;
                          })}
                        >
                          Salah
                        </button>
                      </div>
                    </div>
                    {pernyataan.length > 2 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ marginTop: 4, color: 'var(--danger)' }}
                        onClick={() => {
                          const newPernyataan = pernyataan.filter((_, i) => i !== idx);
                          const newKunciBs = kunciBs.filter((_, i) => i !== idx);
                          setPernyataan(newPernyataan);
                          setKunciBs(newKunciBs);
                        }}
                      >
                        Hapus Pernyataan
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setPernyataan([...pernyataan, '']);
                    setKunciBs([...kunciBs, 'S']);
                  }}
                >
                  + Tambah Pernyataan
                </button>
              </div>
            )}

            {tipe === 'mencocokkan' && (
              <div className="form-group">
                <label className="form-label">Pasangan Kiri ↔ Kanan</label>
                {matchKiri.map((k, idx) => (
                  <div key={idx} className="form-row" style={{ alignItems: 'flex-end' }}>
                    <input
                      className="input"
                      placeholder={`Kiri ${idx + 1}`}
                      value={k}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMatchKiri((arr) => arr.map((x, i) => (i === idx ? v : x)));
                      }}
                    />
                    <span style={{ textAlign: 'center', padding: '0 8px' }}>↔</span>
                    <input
                      className="input"
                      placeholder={`Kanan ${idx + 1}`}
                      value={matchKanan[idx] || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMatchKanan((arr) => arr.map((x, i) => (i === idx ? v : x)));
                      }}
                    />
                    {matchKiri.length > 2 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => {
                          setMatchKiri((arr) => arr.filter((_, i) => i !== idx));
                          setMatchKanan((arr) => arr.filter((_, i) => i !== idx));
                        }}
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setMatchKiri((arr) => [...arr, '']);
                    setMatchKanan((arr) => [...arr, '']);
                  }}
                >
                  + Baris Pasangan
                </button>
              </div>
            )}

            {tipe === 'uraian' && (
              <MathField
                label="Kunci jawaban ideal (opsional)"
                value={kunciUraian}
                onChange={setKunciUraian}
                rows={2}
              />
            )}

            <MathField label="Pembahasan (wajib)" value={rationale} onChange={setRationale} rows={3} required />

            {err && <div className="banner banner-danger"><p className="banner-text">{err}</p></div>}
            {ok && <div className="banner banner-ok"><p className="banner-text">{ok}</p></div>}

            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Menyimpan…' : editingId ? 'Simpan Perubahan' : 'Simpan Soal'}
              </button>
            </div>
          </div>
        </form>
      )}

      {subTab === 'bank' && (
        <section>
          {list.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <h3 className="empty-state-title">Belum ada soal</h3>
              <p className="empty-state-text">Buat soal pertama di tab "Buat Soal".</p>
            </div>
          )}

          {(() => {
            const grouped: Record<string, Record<string, Record<string, Record<number, ItemRow[]>>>> = {};
            for (const item of list) {
              const mp = item.mapel || 'Tanpa Mapel';
              const mt = item.materi || 'Tanpa Materi';
              const tp = item.item_type || 'pg';
              const diff = item.difficulty || 2;
              if (!grouped[mp]) grouped[mp] = {};
              if (!grouped[mp][mt]) grouped[mp][mt] = {};
              if (!grouped[mp][mt][tp]) grouped[mp][mt][tp] = {};
              if (!grouped[mp][mt][tp][diff]) grouped[mp][mt][tp][diff] = [];
              grouped[mp][mt][tp][diff].push(item);
            }

            const tipeLabels: Record<string, string> = {
              pg: 'Pilihan Ganda',
              pg_kompleks: 'Pilihan Ganda Kompleks',
              pernyataan_bs: 'Pernyataan B/S',
              mencocokkan: 'Mencocokkan',
              uraian: 'Uraian',
            };

            return Object.entries(grouped).map(([mapel, materiGroups]) => {
              const mapelKey = `mapel-${mapel}`;
              const isOpenMapel = openMapel[mapelKey] ?? true;
              return (
                <div key={mapel} className="collapsible-section">
                  <button
                    type="button"
                    className="collapsible-header"
                    onClick={() => setOpenMapel((m) => ({ ...m, [mapelKey]: !isOpenMapel }))}
                  >
                    <h3 className="collapsible-title">{mapel}</h3>
                    <span className="collapsible-toggle">{isOpenMapel ? '▼' : '▶'}</span>
                  </button>
                  {isOpenMapel && (
                    <div className="collapsible-content">
                      {Object.entries(materiGroups).map(([materi, tipeGroups]) => {
                        const materiKey = `${mapelKey}-${materi}`;
                        const isOpenMateri = openMateri[materiKey] ?? true;
                        return (
                          <div key={materi} className="collapsible-subsection">
                            <button
                              type="button"
                              className="collapsible-subheader"
                              onClick={() => setOpenMateri((m) => ({ ...m, [materiKey]: !isOpenMateri }))}
                            >
                              <h4 className="collapsible-subtitle">{materi}</h4>
                              <span className="collapsible-toggle">{isOpenMateri ? '▼' : '▶'}</span>
                            </button>
                            {isOpenMateri && (
                              <div className="collapsible-subcontent">
                                {Object.entries(tipeGroups).map(([tipeKey, diffGroups]) => {
                                  const tipeFullKey = `${materiKey}-${tipeKey}`;
                                  const isOpenTipeLocal = openTipe[tipeFullKey] ?? true;
                                  const tipeLabelName = tipeLabels[tipeKey] || tipeKey;
                                  return (
                                    <div key={tipeKey} className="collapsible-subsection">
                                      <button
                                        type="button"
                                        className="collapsible-subheader"
                                        style={{ background: 'var(--canvas)', borderRadius: 'var(--radius-sm)' }}
                                        onClick={() => setOpenTipe((m) => ({ ...m, [tipeFullKey]: !isOpenTipeLocal }))}
                                      >
                                        <span className="chip chip-type">{tipeLabelName}</span>
                                        <span className="collapsible-toggle">{isOpenTipeLocal ? '▼' : '▶'}</span>
                                      </button>
                                      {isOpenTipeLocal && (
                                        <div style={{ paddingLeft: 12, paddingTop: 4 }}>
                                          {Object.entries(diffGroups).map(([diffStr, items]) => {
                                            const diff = Number(diffStr);
                                            const diffKey = `${tipeFullKey}-${diff}`;
                                            const isOpenDiffLocal = openDiff[diffKey] ?? true;
                                            const diffLabel = diff === 1 ? 'Mudah' : diff === 3 ? 'Sulit (HOTS)' : 'Sedang';
                                            const diffColor = diff === 1 ? 'var(--success)' : diff === 3 ? 'var(--danger)' : 'var(--warn)';
                                            return (
                                              <div key={diffKey} className="collapsible-subsection">
                                                <button
                                                  type="button"
                                                  className="collapsible-subheader"
                                                  style={{ background: 'var(--accent-soft)' }}
                                                  onClick={() => setOpenDiff((m) => ({ ...m, [diffKey]: !isOpenDiffLocal }))}
                                                >
                                                  <span className="badge" style={{ color: diffColor }}>
                                                    {diffLabel} ({items.length})
                                                  </span>
                                                  <span className="collapsible-toggle">{isOpenDiffLocal ? '▼' : '▶'}</span>
                                                </button>
                                                {isOpenDiffLocal && (
                                                  <div style={{ paddingLeft: 12, paddingTop: 4 }}>
                                                    {items.map((r) => (
                                                      <article key={r.id} className="card" style={{ marginBottom: 8, boxShadow: 'none', padding: '12px 16px' }}>
                                                        <div className="card-header">
                                                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                                            <span className="chip chip-type">{r.item_type}</span>
                                                          </div>
                                                          <div className="btn-group">
                                                            <button
                                                              type="button"
                                                              className="btn btn-ghost btn-sm"
                                                              onClick={() => mulaiEdit(r)}
                                                            >
                                                              Sunting
                                                            </button>
                                                            <button
                                                              type="button"
                                                              className="btn btn-ghost btn-sm"
                                                              style={{ color: 'var(--danger)' }}
                                                              onClick={() => void hapusSoal(r.id)}
                                                            >
                                                              Hapus
                                                            </button>
                                                          </div>
                                                        </div>
                                                        <p style={{ margin: '8px 0 4px', fontWeight: 500 }}>
                                                          <MathText text={r.stem} />
                                                        </p>
                                                        {r.rationale && (
                                                          <p className="type-lab">
                                                            Pembahasan: <MathText text={r.rationale} />
                                                          </p>
                                                        )}
                                                      </article>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </section>
      )}
    </div>
  );
}
