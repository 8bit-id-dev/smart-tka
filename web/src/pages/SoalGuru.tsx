import { useEffect, useState } from 'react';
import { drafSoalAI } from '../lib/aiSoal';
import { KurikulumCrud } from '../components/KurikulumCrud';
import { MathField } from '../components/MathField';
import { MathText } from '../components/MathText';
import { insforge, type AppProfile } from '../lib/insforge';
import type { MapelRow, MateriRow } from '../lib/kurikulum';

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
type Tipe = 'pg' | 'pg_kompleks' | 'pernyataan_bs';

type Row = {
  id: string;
  item_type: string;
  mapel: string;
  materi?: string | null;
  stem: string;
  status: string;
};

export function SoalGuru({ profile }: { profile: AppProfile }) {
  const [list, setList] = useState<Row[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [drafAi, setDrafAi] = useState(false);
  const [catatanAi, setCatatanAi] = useState('');

  const [tipe, setTipe] = useState<Tipe>('pg');
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

  async function load() {
    const { data, error } = await insforge.database
      .from('items')
      .select('id, item_type, mapel, materi, stem, status')
      .eq('author_id', profile.id);
    if (error) setErr(error.message);
    else setList((data || []) as Row[]);
  }

  useEffect(() => {
    void load();
  }, [profile.id]);

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
    } else {
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
      tipe,
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

    setBusy(true);
    const { error } = await insforge.database.from('items').insert({
      scope: 'school',
      school_id: profile.school_id,
      author_id: profile.id,
      jenjang,
      mapel,
      materi: materi || null,
      item_type,
      stem: stem.trim(),
      choices,
      correct_key,
      rationale: rationale.trim(),
      status: 'published',
      difficulty: 2,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setOk('Soal tersimpan di bank sekolah (bukan bank nasional SMART).');
    setDrafAi(false);
    setStem('');
    setRationale('');
    setOpsi(['', '', '', '', '']);
    setPernyataan(['', '', '']);
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
    <div className="placeholder" style={{ maxWidth: 760 }}>
      <section className="card">
        <h2>Buat soal</h2>
        <p className="type-lab">Masuk bank sekolah Anda, bukan bank nasional SMART. AI hanya draf — guru wajib menyunting.</p>
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
            </select>
          </label>
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
          <div className="login-actions">
            <button className="btn" type="button" disabled={aiBusy} onClick={() => void buatDraf('baru')}>
              {aiBusy ? 'AI menulis…' : 'Draf soal + pembahasan AI'}
            </button>
            <button className="btn btn-ghost" type="button" disabled={aiBusy || !stem.trim()} onClick={() => void buatDraf('bahas')}>
              Perbaiki pembahasan AI
            </button>
          </div>
          {drafAi && (
            <p className="legal" style={{ color: '#d97706' }}>
              Ini draf AI. Cek kunci, opsi, dan bahasa. Baru klik Simpan soal.
            </p>
          )}
          <MathField label="Pertanyaan / stimulus" value={stem} onChange={setStem} rows={3} required />

          {tipe !== 'pernyataan_bs' &&
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
                  <button type="button" className={`choice bs ${kunciBs[idx] === 'B' ? 'sel' : ''}`} onClick={() => setKunciBs((a) => a.map((x, i) => (i === idx ? 'B' : x)))}>
                    Kunci: Benar
                  </button>
                  <button type="button" className={`choice bs ${kunciBs[idx] === 'S' ? 'sel' : ''}`} onClick={() => setKunciBs((a) => a.map((x, i) => (i === idx ? 'S' : x)))}>
                    Kunci: Salah
                  </button>
                </span>
              </div>
            ))}

          <MathField label="Pembahasan (wajib)" value={rationale} onChange={setRationale} rows={3} required />

          {err && <p className="auth-msg">{err}</p>}
          {ok && <p className="legal" style={{ color: '#2f9e6b' }}>{ok}</p>}
          <button className="btn" type="submit" disabled={busy}>
            Simpan soal
          </button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Soal saya ({list.length})</h2>
        {list.length === 0 && <p className="type-lab">Belum ada. Simpan soal pertama di atas.</p>}
        {list.map((r) => (
          <article key={r.id} className="card" style={{ marginBottom: 8, boxShadow: 'none' }}>
            <span className="chip chip-sedang">{r.item_type}</span> {r.mapel}
            <p style={{ margin: '8px 0 0' }}>
              <MathText text={r.stem} />
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
