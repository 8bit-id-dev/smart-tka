import { useEffect, useState } from 'react';
import { drafSoalAI } from '../lib/aiSoal';
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
  const [aiBusy, setAiBusy] = useState(false);
  const [drafAi, setDrafAi] = useState(false);
  const [catatanAi, setCatatanAi] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  const [tipe, setTipe] = useState<Tipe>('pg');
  const [difficulty, setDifficulty] = useState<number>(2); // 1: Mudah, 2: Sedang, 3: Sulit / HOTS
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
  const [pernyataan, setPernyataan] = useState(['', '', '']);
  const [kunciBs, setKunciBs] = useState<('B' | 'S')[]>(['B', 'S', 'B']);

  // Matching & Essay state
  const [matchKiri, setMatchKiri] = useState<string[]>(['', '', '']);
  const [matchKanan, setMatchKanan] = useState<string[]>(['', '', '']);
  const [kunciUraian, setKunciUraian] = useState('');

  async function load() {
    const { data, error } = await insforge.database
      .from('items')
      .select('id, item_type, mapel, materi, jenjang, difficulty, stem, stimulus, choices, correct_key, rationale, status, created_at')
      .eq('author_id', profile.id)
      .neq('status', 'retired')
      .order('created_at', { ascending: false });
    if (error) setErr(error.message);
    else setList((data || []) as ItemRow[]);
  }

  useEffect(() => {
    void load();
  }, [profile.id]);

  function resetForm() {
    setEditingId(null);
    setDrafAi(false);
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

  function toggleKom(L: string) {
    setKunciKom((c) => (c.includes(L) ? c.filter((x) => x !== L) : [...c, L].sort()));
  }

  function terapkanDraf(d: Awaited<ReturnType<typeof drafSoalAI>>) {
    if ('error' in d) {
      setErr(d.error);
      return;
    }
    if (d.stem) setStem(d.stem);
    if (d.pembahasan) setRationale(d.pembahasan);
    if (tipe === 'pernyataan_bs') {
      setPernyataan(d.pernyataan);
      setKunciBs(d.kunci_bs);
    } else if (tipe === 'pg' || tipe === 'pg_kompleks') {
      setOpsi(d.opsi);
      if (tipe === 'pg') setKunciPg(d.kunci[0] || 'C');
      else setKunciKom(d.kunci);
    }
    setDrafAi(true);
    setOk('Draf AI terisi. Sunting kunci & pembahasan, baru Simpan. Tidak otomatis tersimpan.');
  }

  async function buatDraf(mode: 'baru' | 'bahas') {
    setErr('');
    setOk('');
    if (!mapel.trim()) {
      setErr('Pilih mapel (dan materi jika ada) sebelum minta draf AI.');
      return;
    }
    setAiBusy(true);
    const d = await drafSoalAI({
      jenjang,
      mapel,
      materi,
      tipe: tipe === 'mencocokkan' || tipe === 'uraian' ? 'pg' : tipe,
      catatan: catatanAi,
      stemAda: mode === 'bahas' ? stem : '',
    });
    setAiBusy(false);
    terapkanDraf(d);
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
    <div className="placeholder" style={{ maxWidth: 900 }}>
      <div className="shell-nav" style={{ marginBottom: 16, borderBottom: '1px solid var(--card-border)', paddingBottom: 8 }}>
        <button className={subTab === 'buat' ? 'on' : ''} type="button" onClick={() => setSubTab('buat')}>
          Buat Soal
        </button>
        <button className={subTab === 'bank' ? 'on' : ''} type="button" onClick={() => setSubTab('bank')}>
          Bank Soal
        </button>
      </div>

      {subTab === 'buat' && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{editingId ? 'Sunting Soal' : 'Buat Soal'}</h2>
            {editingId && (
              <button className="btn btn-ghost" type="button" onClick={resetForm}>
                Batal Edit
              </button>
            )}
          </div>
          <p className="type-lab">
            {editingId
              ? 'Mengubah soal yang sudah ada di bank sekolah Anda.'
              : 'Masuk bank sekolah Anda, bukan bank nasional SMART. AI hanya draf — guru wajib menyunting.'}
          </p>

        <div className="auth-form">
          <label>
            Jenjang
            <select value={jenjang} onChange={(e) => setJenjang(e.target.value)} className="sel-input">
              <option value="sd">sd</option>
              <option value="smp">smp</option>
              <option value="sma">sma</option>
              <option value="smk">smk</option>
            </select>
          </label>
          <label>
            Tingkat Kesulitan
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="sel-input"
            >
              <option value={1}>Mudah (Tingkat Dasar)</option>
              <option value={2}>Sedang (Tingkat Menengah)</option>
              <option value={3}>Sulit / HOTS (High Order Thinking)</option>
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
        </div>

        <form onSubmit={simpan} className="auth-form">
          <label>
            Tipe
            <select value={tipe} onChange={(e) => setTipe(e.target.value as Tipe)} className="sel-input">
              <option value="pg">Pilihan ganda (5 opsi, satu kunci)</option>
              <option value="pg_kompleks">Pilihan ganda kompleks (lebih dari satu kunci)</option>
              <option value="pernyataan_bs">Pernyataan benar / salah</option>
              <option value="mencocokkan">Mencocokkan / Penjodohan (Kiri ↔ Kanan)</option>
              <option value="uraian">Uraian / Isian Singkat</option>
            </select>
          </label>

          {!editingId && (
            <div className="hint-panel">
              <span className="hint-kicker">Petunjuk untuk AI</span>
              <div className="hint-row">
                <input
                  type="text"
                  className="sel-input"
                  value={catatanAi}
                  onChange={(e) => setCatatanAi(e.target.value)}
                  placeholder="Opsional · contoh: stimulus tabel, penalaran"
                />
              </div>
              <p className="hint-note">AI hanya draf. Guru wajib menyunting sebelum simpan.</p>
            </div>
          )}

          {!editingId && (
            <div className="login-actions">
              <button className="btn" type="button" disabled={aiBusy} onClick={() => void buatDraf('baru')}>
                {aiBusy ? 'AI menulis…' : 'Draf soal + pembahasan AI'}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={aiBusy || !stem.trim()}
                onClick={() => void buatDraf('bahas')}
              >
                Perbaiki pembahasan AI
              </button>
            </div>
          )}

          {drafAi && (
            <p className="legal" style={{ color: '#d97706' }}>
              Ini draf AI. Cek kunci, opsi, dan bahasa. Baru klik Simpan soal.
            </p>
          )}

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

          {tipe === 'pernyataan_bs' &&
            pernyataan.map((p, idx) => (
              <div key={idx}>
                <MathField
                  label={`Pernyataan ${idx + 1}`}
                  value={p}
                  onChange={(v) => setPernyataan((a) => a.map((x, i) => (i === idx ? v : x)))}
                />
                <span className="bs-btns" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className={`choice bs ${kunciBs[idx] === 'B' ? 'sel' : ''}`}
                    onClick={() => setKunciBs((a) => a.map((x, i) => (i === idx ? 'B' : x)))}
                  >
                    Kunci: Benar
                  </button>
                  <button
                    type="button"
                    className={`choice bs ${kunciBs[idx] === 'S' ? 'sel' : ''}`}
                    onClick={() => setKunciBs((a) => a.map((x, i) => (i === idx ? 'S' : x)))}
                  >
                    Kunci: Salah
                  </button>
                </span>
              </div>
            ))}

          {tipe === 'mencocokkan' && (
            <div style={{ marginTop: 12 }}>
              <p className="type-lab">Isi Pasangan Kiri dan Pasangan Kanan yang Cocok:</p>
              {matchKiri.map((k, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <input
                    className="sel-input"
                    placeholder={`Premis/Item Kiri ${idx + 1}`}
                    value={k}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMatchKiri((arr) => arr.map((x, i) => (i === idx ? v : x)));
                    }}
                    style={{ flex: 1 }}
                  />
                  <span>↔</span>
                  <input
                    className="sel-input"
                    placeholder={`Pasangan Kanan ${idx + 1}`}
                    value={matchKanan[idx] || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMatchKanan((arr) => arr.map((x, i) => (i === idx ? v : x)));
                    }}
                    style={{ flex: 1 }}
                  />
                  {matchKiri.length > 2 && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ color: '#dc2626', padding: '6px 10px', fontSize: 13 }}
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
                className="btn btn-ghost"
                style={{ marginTop: 4 }}
                onClick={() => {
                  setMatchKiri((arr) => [...arr, '']);
                  setMatchKanan((arr) => [...arr, '']);
                }}
              >
                + Tambah Baris Pasangan
              </button>
            </div>
          )}

          {tipe === 'uraian' && (
            <MathField
              label="Kunci Acuan / Kata Kunci Jawaban Ideal (opsional)"
              value={kunciUraian}
              onChange={setKunciUraian}
              rows={2}
            />
          )}

          <MathField label="Pembahasan (wajib)" value={rationale} onChange={setRationale} rows={3} required />

          {err && <p className="auth-msg">{err}</p>}
          {ok && <p className="legal" style={{ color: '#2f9e6b' }}>{ok}</p>}

          <div className="login-actions" style={{ marginTop: 16 }}>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Menyimpan…' : editingId ? 'Simpan Perubahan Soal' : 'Simpan Soal'}
            </button>
            {editingId && (
              <button className="btn btn-ghost" type="button" onClick={resetForm}>
                Batal Edit
              </button>
            )}
          </div>
        </form>
        </section>
      )}

      {subTab === 'bank' && (
        <section className="card">
          <h2>Bank Soal Saya ({list.length})</h2>
          {list.length === 0 && <p className="type-lab">Belum ada soal. Buat soal pertama di tab "Buat Soal".</p>}

          {(() => {
            // Group by mapel > materi > difficulty
            const grouped: Record<string, Record<string, Record<number, ItemRow[]>>> = {};
            for (const item of list) {
              const mp = item.mapel || 'Tanpa Mapel';
              const mt = item.materi || 'Tanpa Materi';
              const diff = item.difficulty || 2;
              if (!grouped[mp]) grouped[mp] = {};
              if (!grouped[mp][mt]) grouped[mp][mt] = {};
              if (!grouped[mp][mt][diff]) grouped[mp][mt][diff] = [];
              grouped[mp][mt][diff].push(item);
            }
            return Object.entries(grouped).map(([mapel, materiGroups]) => (
              <div key={mapel} style={{ marginBottom: 24 }}>
                <h3 style={{ margin: '0 0 12px', color: 'var(--teal)', fontSize: 18 }}>{mapel}</h3>
                {Object.entries(materiGroups).map(([materi, diffGroups]) => (
                  <div key={materi} style={{ marginLeft: 12, marginBottom: 16, borderLeft: '3px solid var(--teal-soft)', paddingLeft: 12 }}>
                    <h4 style={{ margin: '8px 0 10px', fontSize: 15, color: 'var(--ink)' }}>{materi}</h4>
                    {Object.entries(diffGroups).map(([diffStr, items]) => {
                      const diff = Number(diffStr);
                      const diffLabel = diff === 1 ? 'Mudah' : diff === 3 ? 'Sulit (HOTS)' : 'Sedang';
                      const diffBg = diff === 1 ? '#e6f4ea' : diff === 3 ? '#fce8e6' : '#fef7e0';
                      const diffColor = diff === 1 ? '#137333' : diff === 3 ? '#c5221f' : '#b06000';
                      return (
                        <div key={diffStr} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span
                              className="chip"
                              style={{ backgroundColor: diffBg, color: diffColor, fontSize: 11, fontWeight: 600 }}
                            >
                              {diffLabel} ({items.length})
                            </span>
                          </div>
                          {items.map((r) => (
                            <article key={r.id} className="card" style={{ marginBottom: 8, boxShadow: 'none', padding: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <span className="chip chip-sedang">{r.item_type}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ padding: '4px 8px', fontSize: 13 }}
                                    onClick={() => mulaiEdit(r)}
                                  >
                                    Sunting
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ padding: '4px 8px', fontSize: 13, color: '#dc2626' }}
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
                                <p className="type-lab" style={{ margin: 0 }}>
                                  Pembahasan: <MathText text={r.rationale} />
                                </p>
                              )}
                            </article>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ));
          })()}
        </section>
      )}

    </div>
  );
}
