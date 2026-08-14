import { useEffect, useState } from 'react';
import { ItemPlayer } from '../components/ItemPlayer';
import { insforge } from '../lib/insforge';
import { acakList, acakOpsi, type DbItem } from '../lib/soal';

const MAX = 10;

export function Practice({
  schoolId,
  studentId,
  jenjang,
  onHome,
}: {
  schoolId: string | null;
  studentId: string;
  jenjang: string | null;
  onHome: () => void;
}) {
  const [pool, setPool] = useState<DbItem[]>([]);
  const [mapels, setMapels] = useState<string[]>([]);
  const [mapel, setMapel] = useState('');
  const [items, setItems] = useState<DbItem[]>([]);
  const [i, setI] = useState(0);
  const [err, setErr] = useState('');
  const [phase, setPhase] = useState<'pilih' | 'run' | 'done'>('pilih');
  const [benar, setBenar] = useState(0);
  const [skor, setSkor] = useState<number | null>(null);
  const [jawab, setJawab] = useState(0);

  useEffect(() => {
    void (async () => {
      const { data, error } = await insforge.database
        .from('items')
        .select('id, item_type, mapel, stem, stimulus, choices, correct_key, rationale, jenjang')
        .eq('status', 'published');
      if (error) {
        setErr(error.message);
        return;
      }
      let rows = (data || []) as DbItem[];
      if (jenjang) rows = rows.filter((x) => !x.jenjang || x.jenjang === jenjang);
      setPool(rows);
      const uniq = [...new Set(rows.map((x) => x.mapel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
      setMapels(uniq);
    })();
  }, [schoolId, jenjang]);

  function mulai() {
    let rows = pool;
    if (mapel) rows = rows.filter((x) => x.mapel === mapel);
    if (rows.length === 0) {
      setErr('Tidak ada soal untuk filter ini.');
      return;
    }
    setErr('');
    setItems(acakList(rows).slice(0, MAX).map(acakOpsi));
    setI(0);
    setBenar(0);
    setJawab(0);
    setSkor(null);
    setPhase('run');
  }

  async function selesai() {
    const n = jawab || items.length;
    const nilai = n ? Math.round((benar / Math.max(jawab, 1)) * 1000) / 10 : 0;
    setSkor(nilai);
    setPhase('done');
    const { error } = await insforge.database.from('attempts').insert({
      package_id: null,
      student_id: studentId,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      score: nilai,
    });
    if (error) setErr('Sesi selesai. Skor belum ke laporan: ' + error.message);
  }

  if (err && phase === 'pilih') {
    return (
      <div className="placeholder">
        <section className="card">
          <p className="auth-msg">{err}</p>
        </section>
      </div>
    );
  }

  if (phase === 'pilih') {
    return (
      <div className="placeholder">
        <section className="card">
          <h2>Latihan</h2>
          <p className="type-lab">Maksimal {MAX} soal. Pembahasan setelah kunci. Skor masuk laporan (bukan TKA resmi).</p>
          <label>
            Mapel
            <select className="sel-input" value={mapel} onChange={(e) => setMapel(e.target.value)}>
              <option value="">Semua mapel</option>
              {mapels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <p className="type-lab" style={{ marginTop: 12 }}>
            Tersedia {mapel ? pool.filter((x) => x.mapel === mapel).length : pool.length} soal
            {jenjang ? ` · jenjang ${jenjang}` : ''}
          </p>
          {err && <p className="auth-msg">{err}</p>}
          <button className="btn" type="button" style={{ marginTop: 16, maxWidth: 220 }} onClick={mulai}>
            Mulai
          </button>
        </section>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="placeholder">
        <section className="card">
          <h2>Sesi selesai</h2>
          <p className="type-hm" style={{ color: 'var(--teal)' }}>
            {skor ?? 0} <small style={{ fontSize: 16 }}>/ 100</small>
          </p>
          <p className="type-lab">
            {benar} benar dari {jawab || items.length} dijawab. Bukan prediksi Tes Kemampuan Akademik resmi.
          </p>
          {err && <p className="auth-msg">{err}</p>}
          <div className="login-actions">
            <button className="btn" type="button" onClick={() => setPhase('pilih')}>
              Latihan lagi
            </button>
            <button className="btn btn-ghost" type="button" onClick={onHome}>
              Beranda
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="placeholder">
        <section className="card">
          <h2>Latihan</h2>
          <p>Belum ada soal. Guru membuat di menu Soal.</p>
          <button className="btn" type="button" onClick={onHome} style={{ marginTop: 16, maxWidth: 200 }}>
            Beranda
          </button>
        </section>
      </div>
    );
  }

  const item = items[i];
  return (
    <div className="board" style={{ maxWidth: 740, paddingTop: 8 }}>
      <p className="type-lab">
        {item.mapel} · {i + 1} / {items.length}
      </p>
      <section className="card">
        <ItemPlayer
          key={item.id}
          item={item}
          showBahas
          hideKeys={false}
          onLocked={(ok) => {
            setJawab((n) => n + 1);
            if (ok) setBenar((n) => n + 1);
          }}
        />
        <button
          className="btn btn-ghost"
          type="button"
          style={{ marginTop: 16 }}
          onClick={() => (i >= items.length - 1 ? void selesai() : setI(i + 1))}
        >
          {i >= items.length - 1 ? 'Selesai & simpan skor' : 'Soal berikutnya'}
        </button>
      </section>
    </div>
  );
}
