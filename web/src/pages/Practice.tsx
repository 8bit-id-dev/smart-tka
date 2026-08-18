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
    if (error) {
      setErr('Sesi selesai. Skor belum ke laporan: ' + error.message);
    } else {
      const xpEarned = benar * 5 + jawab * 2;
      if (xpEarned > 0) {
        const showXp = (window as any).__showXpReward;
        if (showXp) {
          showXp(xpEarned, 'Latihan');
        } else {
          await insforge.database.rpc('award_xp', { p_profile: studentId, p_xp: xpEarned });
        }
      }
    }
  }

  if (err && phase === 'pilih') {
    return (
      <div className="dashboard-page">
        <section className="card">
          <p style={{ color: 'var(--danger)', margin: 0 }}>{err}</p>
        </section>
      </div>
    );
  }

  if (phase === 'pilih') {
    return (
      <div className="dashboard-page">
        <section className="card" style={{ maxWidth: 520 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onHome}>← Beranda</button>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Latihan Bebas</h2>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 20px' }}>
            Maksimal {MAX} soal. Pembahasan setelah kunci. Skor masuk laporan (bukan TKA resmi).
          </p>
          <div className="form-group">
            <label className="form-label">Mapel</label>
            <select className="input" value={mapel} onChange={(e) => setMapel(e.target.value)}>
              <option value="">Semua mapel</option>
              {mapels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px' }}>
            Tersedia {mapel ? pool.filter((x) => x.mapel === mapel).length : pool.length} soal
            {jenjang ? ` · jenjang ${jenjang}` : ''}
          </p>
          {err && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 12px' }}>{err}</p>}
          <button className="btn btn-primary" type="button" style={{ maxWidth: 200 }} onClick={mulai}>Mulai Latihan</button>
        </section>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="dashboard-page">
        <section className="card" style={{ maxWidth: 520, textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Sesi Selesai</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 16px' }}>Skor internal SMART-TKA, bukan prediksi TKA resmi.</p>
          <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 4px' }}>
            {skor ?? 0}<small style={{ fontSize: 22, fontWeight: 500, color: 'var(--muted)' }}>/100</small>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 24px' }}>
            {benar} benar dari {jawab || items.length} dijawab
          </p>
          <div className="btn-group" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" type="button" onClick={() => setPhase('pilih')}>Latihan Lagi</button>
            <button className="btn btn-ghost" type="button" onClick={onHome}>Beranda</button>
          </div>
        </section>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="dashboard-page">
        <section className="card" style={{ maxWidth: 520, textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px' }}>Latihan</h2>
          <p style={{ color: 'var(--muted)', margin: '0 0 20px' }}>Belum ada soal. Guru membuat di menu Soal.</p>
          <button className="btn btn-primary" type="button" onClick={onHome}>Beranda</button>
        </section>
      </div>
    );
  }

  const item = items[i];
  return (
    <div className="dashboard-page">
      {/* Compact top nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onHome}>← Beranda</button>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
            {item?.mapel} · {i + 1} / {items.length}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="timer-lab" style={{ fontSize: 10 }}>Soal</div>
          <div style={{ background: 'var(--canvas)', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {i + 1}/{items.length}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 4, background: 'var(--canvas)', borderRadius: 999, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ width: `${((i + 1) / items.length) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 999, transition: 'width 0.3s ease' }} />
      </div>

      <section className="card" style={{ maxWidth: 720 }}>
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
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" type="button" disabled={i === 0} onClick={() => setI((x) => x - 1)}>
            ← Sebelumnya
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" type="button" onClick={() => { setJawab((n) => n + 1); setI((x) => x + 1); }}>
              Lewati
            </button>
            {i >= items.length - 1 ? (
              <button className="btn btn-primary" type="button" onClick={() => void selesai()}>
                Selesai & Simpan
              </button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={() => setI((x) => x + 1)}>
                Berikutnya →
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}