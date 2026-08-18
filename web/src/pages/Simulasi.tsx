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

type Ans = { answer: string; correct: boolean };

export function Simulasi({ schoolId, studentId }: { schoolId: string | null; studentId?: string }) {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [items, setItems] = useState<DbItem[]>([]);
  const [i, setI] = useState(0);
  const [sisa, setSisa] = useState(0);
  const [phase, setPhase] = useState<'list' | 'run' | 'hasil'>('list');
  const [err, setErr] = useState('');
  const [ans, setAns] = useState<Record<string, Ans>>({});
  const [skor, setSkor] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await insforge.database
        .from('packages')
        .select('id, title, kind, mapel, item_count, duration_sec, discuss_after_each, shuffle');
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
          void kumpulkan();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, pkg]);

  async function mulai(p: Pkg) {
    setErr('');
    setAns({});
    setSkor(null);
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

  async function kumpulkan() {
    if (!pkg || items.length === 0) {
      setPhase('hasil');
      return;
    }
    const benar = items.filter((it) => ans[it.id]?.correct).length;
    const nilai = Math.round((benar / items.length) * 10000) / 100;
    setSkor(nilai);
    setPhase('hasil');

    if (!studentId) return;

    const { data, error } = await insforge.database
      .from('attempts')
      .insert({
        package_id: pkg.id,
        student_id: studentId,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        score: nilai,
      })
      .select('id');
    if (error) {
      setErr('Nilai dihitung, tapi belum tersimpan ke laporan: ' + error.message);
      return;
    }
    const aid = (data?.[0] as { id?: string } | undefined)?.id;
    if (!aid) return;
    const rows = items.map((it) => ({
      attempt_id: aid,
      item_id: it.id,
      answer: ans[it.id]?.answer || '',
      is_correct: !!ans[it.id]?.correct,
      locked_at: new Date().toISOString(),
    }));
    await insforge.database.from('attempt_answers').insert(rows);

    const xpEarned = Math.round(nilai * 2) + 20;
    if (xpEarned > 0) {
      const showXp = (window as any).__showXpReward;
      if (showXp) {
        showXp(xpEarned, 'Simulasi');
      } else {
        try {
          await insforge.database.rpc('award_xp', { p_profile: studentId, p_xp: xpEarned });
        } catch {
          /* XP award best-effort */
        }
      }
    }
  }

  const mm = String(Math.floor(sisa / 60)).padStart(2, '0');
  const ss = String(sisa % 60).padStart(2, '0');
  const bahasLangsung = !!pkg?.discuss_after_each;

  if (phase === 'list') {
    return (
      <div className="dashboard-page">
        <header className="page-header" style={{ marginBottom: 20 }}>
          <p className="page-subtitle">Ujian lengkap dengan timer</p>
          <h1 className="page-title">Simulasi TKA</h1>
        </header>
        {err && (
          <div className="banner banner-danger" style={{ marginBottom: 16 }}>
            <p className="banner-text">{err}</p>
          </div>
        )}
        {pkgs.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3 className="empty-state-title">Belum ada paket</h3>
            <p className="empty-state-text">Guru membuat paket di menu Paket.</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pkgs.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 650 }}>{p.title}</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                  {p.kind} · {p.mapel} · {p.item_count} soal · {p.discuss_after_each ? 'Pembahasan langsung' : 'Kunci setelah selesai'}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <span className="badge badge-info">{p.kind}</span>
                  <span className="badge badge-neutral">{p.mapel}</span>
                  <span className="badge badge-neutral">{p.item_count} soal</span>
                  {p.duration_sec && <span className="badge badge-neutral">{Math.floor(p.duration_sec / 60)} mnt</span>}
                </div>
              </div>
              <button className="continue-btn" type="button" onClick={() => mulai(p)}>Mulai Simulasi</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'hasil' && pkg) {
    const benar = items.filter((it) => ans[it.id]?.correct).length;
    return (
      <div className="dashboard-page">
        <section className="card" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: '32px 24px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Selesai: {pkg.title}</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 20px' }}>Skor internal SMART-TKA, bukan prediksi TKA resmi.</p>
          <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1, margin: '0 0 8px' }}>
            {skor ?? 0}<small style={{ fontSize: 22, fontWeight: 500, color: 'var(--muted)' }}>/100</small>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 24px' }}>{benar}/{items.length} benar</p>
          {err && <p style={{ color: 'var(--warn)', fontSize: 13, margin: '0 0 16px' }}>{err}</p>}
          <div className="btn-group" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" type="button" onClick={() => setPhase('list')}>Daftar Paket</button>
          </div>
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
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{pkg?.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="timer-lab" style={{ fontSize: 10 }}>Waktu</div>
          <div className="timer">{mm}:{ss}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 4, background: 'var(--canvas)', borderRadius: 999, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ width: `${((i + 1) / items.length) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 999, transition: 'width 0.3s ease' }} />
      </div>

      {err && (
        <div className="banner banner-warn" style={{ marginBottom: 16 }}>
          <p className="banner-text">{err}</p>
        </div>
      )}

      <section className="card" style={{ maxWidth: 800 }}>
        {item && (
          <ItemPlayer
            key={item.id}
            item={item}
            showBahas={bahasLangsung}
            hideKeys={!bahasLangsung}
            onUpdate={(info) => setAns((m) => ({ ...m, [item.id]: info }))}
          />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" type="button" disabled={i === 0} onClick={() => setI((x) => x - 1)}>
            ← Sebelumnya
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            {i < items.length - 1 ? (
              <button className="btn btn-primary" type="button" onClick={() => setI((x) => x + 1)}>
                Selanjutnya →
              </button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={() => void kumpulkan()}>
                Kumpulkan
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}