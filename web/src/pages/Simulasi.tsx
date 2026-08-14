import { useEffect, useState } from 'react';
import { ItemPlayer } from '../components/ItemPlayer';
import { insforge } from '../lib/insforge';
import { acakList, acakOpsi, type DbItem } from '../lib/soal';

type Pkg = {
  id: string;
  title: string;
  kind: string;
  mapel: string;
  item_count: number;
  duration_sec: number | null;
  discuss_after_each: boolean;
  shuffle?: boolean;
};

export function Simulasi({ schoolId }: { schoolId: string | null }) {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [items, setItems] = useState<DbItem[]>([]);
  const [i, setI] = useState(0);
  const [sisa, setSisa] = useState(0);
  const [phase, setPhase] = useState<'list' | 'run' | 'hasil'>('list');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await insforge.database
        .from('packages')
        .select('id, title, kind, mapel, item_count, duration_sec, discuss_after_each');
      if (error) setErr(error.message);
      else setPkgs((data || []) as Pkg[]);
    })();
  }, [schoolId]);

  useEffect(() => {
    if (phase !== 'run' || !pkg) return;
    const t = setInterval(() => {
      setSisa((s) => {
        if (s <= 1) {
          clearInterval(t);
          setPhase('hasil');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, pkg]);

  async function mulai(p: Pkg) {
    setErr('');
    const { data: links, error } = await insforge.database.from('package_items').select('item_id, position').eq('package_id', p.id);
    if (error) {
      setErr(error.message);
      return;
    }
    const ids = ((links || []) as { item_id: string; position: number }[]).sort((a, b) => a.position - b.position).map((x) => x.item_id);
    if (ids.length === 0) {
      setErr('Paket belum berisi soal.');
      return;
    }
    const { data: its, error: e2 } = await insforge.database
      .from('items')
      .select('id, item_type, mapel, stem, stimulus, choices, correct_key, rationale, jenjang');
    if (e2) {
      setErr(e2.message);
      return;
    }
    const map = new Map(((its || []) as DbItem[]).map((x) => [x.id, x]));
    let ordered = ids.map((id) => map.get(id)).filter(Boolean) as DbItem[];
    if (p.shuffle) ordered = acakList(ordered);
    setItems(ordered.map(acakOpsi));
    setPkg(p);
    setI(0);
    setSisa(p.duration_sec && p.duration_sec > 0 ? p.duration_sec : 15 * 60);
    setPhase('run');
  }

  const mm = String(Math.floor(sisa / 60)).padStart(2, '0');
  const ss = String(sisa % 60).padStart(2, '0');
  const bahasLangsung = !!pkg?.discuss_after_each;

  if (phase === 'list') {
    return (
      <div className="placeholder">
        <section className="card">
          <h2>Simulasi & paket</h2>
          {err && <p className="auth-msg">{err}</p>}
          {pkgs.length === 0 && <p>Belum ada paket. Guru membuat di menu Paket.</p>}
          {pkgs.map((p) => (
            <article key={p.id} className="card" style={{ marginTop: 12, boxShadow: 'none' }}>
              <strong>{p.title}</strong>
              <p className="meta">
                {p.kind} · {p.mapel} · {p.item_count} soal · {p.discuss_after_each ? 'latihan' : 'kunci setelah selesai'}
              </p>
              <button className="btn" type="button" style={{ maxWidth: 200 }} onClick={() => mulai(p)}>
                Mulai
              </button>
            </article>
          ))}
        </section>
      </div>
    );
  }

  if (phase === 'hasil' && pkg) {
    return (
      <div className="placeholder">
        <section className="card">
          <h2>Selesai: {pkg.title}</h2>
          <p className="type-lab">Pembahasan paket (bukan prediksi TKA resmi).</p>
          {items.map((it) => (
            <div key={it.id} className="bahas" style={{ marginTop: 12 }}>
              <p>{it.stem}</p>
              <p>{it.rationale}</p>
            </div>
          ))}
          <button className="btn" type="button" style={{ marginTop: 16, maxWidth: 200 }} onClick={() => setPhase('list')}>
            Daftar paket
          </button>
        </section>
      </div>
    );
  }

  const item = items[i];
  return (
    <div className="board" style={{ maxWidth: 800, paddingTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="type-lab">
          {pkg?.title} · {i + 1}/{items.length}
        </span>
        <div>
          <div className="timer-lab">Waktu server</div>
          <div className="timer">
            {mm}:{ss}
          </div>
        </div>
      </div>
      {err && <p className="auth-msg">{err}</p>}
      <section className="card" style={{ marginTop: 12 }}>
        {item && (
          <ItemPlayer key={item.id} item={item} showBahas={bahasLangsung} hideKeys={!bahasLangsung} />
        )}
        <div className="login-actions">
          <button className="btn-ghost btn" type="button" disabled={i === 0} onClick={() => setI((x) => x - 1)}>
            Sebelumnya
          </button>
          {i < items.length - 1 ? (
            <button className="btn" type="button" onClick={() => setI((x) => x + 1)}>
              Selanjutnya
            </button>
          ) : (
            <button className="btn" type="button" onClick={() => setPhase('hasil')}>
              Kumpulkan
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
