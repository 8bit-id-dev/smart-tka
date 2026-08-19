import { useEffect, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';

type GpRow = {
  profile_id: string;
  xp: number;
  level: number;
  streak_current: number;
  streak_best: number;
  full_name: string;
  role: string;
};

const MEDALS = ['🥇', '🥈', '🥉'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type StoreItem = {
  id: string;
  name: string;
  desc: string;
  cost: number;
  icon: string;
};

const STORE_ITEMS: StoreItem[] = [
  { id: 'gold_frame', name: 'Gold Frame', desc: 'Bingkai avatar emas', cost: 100, icon: '🥇' },
  { id: 'diamond_frame', name: 'Diamond Frame', desc: 'Bingkai avatar berlian', cost: 500, icon: '💎' },
  { id: 'master_title', name: 'Master Title', desc: 'Judul badge tambahan', cost: 200, icon: '🏆' },
  { id: 'cosmic_theme', name: 'Cosmic Theme', desc: 'Tema cosmic', cost: 300, icon: '🌌' },
];

export function Leaderboard({ me }: { me: AppProfile }) {
  const [rows, setRows] = useState<GpRow[]>([]);
  const [myGp, setMyGp] = useState<{ xp: number; level: number; streak_current: number } | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [view, setView] = useState<'leaderboard' | 'store'>('leaderboard');
  const [owned, setOwned] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      const { data: gpData, error: gpErr } = await insforge.database
        .from('gamification_profiles')
        .select('xp, level, streak_current, streak_best')
        .eq('profile_id', me.id)
        .single();
      if (!gpErr && gpData) setMyGp(gpData as { xp: number; level: number; streak_current: number; streak_best: number });

      const { data, error } = await insforge.database
        .from('gamification_profiles')
        .select('profile_id, xp, level, streak_current, streak_best, profile:profiles!inner(full_name, role)')
        .order('xp', { ascending: false })
        .limit(50);
      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      const mapped = ((data || []) as any[]).map((r) => ({
        profile_id: r.profile_id,
        xp: r.xp,
        level: r.level,
        streak_current: r.streak_current,
        streak_best: r.streak_best,
        full_name: r.profile?.full_name ?? 'Pengguna',
        role: r.profile?.role ?? 'siswa',
      }));
      setRows(mapped);

      const inv = await insforge.database
        .from('store_inventory')
        .select('item_id')
        .eq('profile_id', me.id);
      if (!inv.error && inv.data) setOwned((inv.data as { item_id: string }[]).map((r) => r.item_id));

      const idx = mapped.findIndex((r) => r.profile_id === me.id);
      setMyRank(idx >= 0 ? idx + 1 : null);
      setLoading(false);
    })();
  }, [me.id]);

  const [storeErr, setStoreErr] = useState('');

  async function buyItem(item: StoreItem) {
    setStoreErr('');
    if (!myGp || myGp.xp < item.cost) { setStoreErr('XP tidak cukup untuk membeli item ini.'); return; }
    if (owned.includes(item.id)) { setStoreErr('Item sudah dimiliki.'); return; }
    const { error: invErr } = await insforge.database
      .from('store_inventory')
      .insert({ profile_id: me.id, item_id: item.id });
    if (invErr) { setStoreErr(invErr.message); return; }
    const { error: xpErr } = await insforge.database
      .from('gamification_profiles')
      .update({ xp: myGp.xp - item.cost })
      .eq('profile_id', me.id);
    if (xpErr) { setStoreErr(xpErr.message); return; }
    setMyGp({ ...myGp, xp: myGp.xp - item.cost });
    const newOwned = [...owned, item.id];
    setOwned(newOwned);
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="card">
          <p style={{ margin: 0, color: 'var(--muted)' }}>Memuat peringkat…</p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="dashboard-page">
        <div className="banner banner-danger">
          <p className="banner-text">{err}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <p className="page-subtitle">Peringkat kelas / sekolah</p>
        <h1 className="page-title">Papan Peringkat SMART-TKA</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className={view === 'leaderboard' ? 'seg-active' : 'seg'} onClick={() => setView('leaderboard')}>Peringkat</button>
          <button type="button" className={view === 'store' ? 'seg-active' : 'seg'} onClick={() => setView('store')}>Toko</button>
          {myGp && <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 'auto' }}>💰 {myGp.xp} XP</span>}
        </div>
        <p className="page-subtitle" style={{ maxWidth: 500 }}>
          Bergaullah dengan belajar rutin. XP dan level naik otomatis saat menyelesaikan latihan dan simulasi.
        </p>
      </header>

      {view === 'store' && (
        <section className="section">
          <h2 style={{ fontSize: 18, fontWeight: 650, marginBottom: 12 }}>Toko Item</h2>
          {storeErr && <div className="banner banner-danger" style={{ marginBottom: 12 }}><p className="banner-text">{storeErr}</p></div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {STORE_ITEMS.map((item) => {
              const isOwned = owned.includes(item.id);
              const canAfford = !!myGp && myGp.xp >= item.cost;
              return (
                <div key={item.id} className="card" style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{item.icon}</div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 650 }}>{item.name}</h3>
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>{item.desc}</p>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{item.cost} XP</div>
                  {isOwned ? (
                    <button type="button" style={{ marginTop: 8, fontSize: 12, opacity: 0.6, cursor: 'default' }} disabled>Dimiliki</button>
                  ) : (
                    <button type="button" className="btn" onClick={() => void buyItem(item)} disabled={!canAfford} style={{ marginTop: 8, fontSize: 12, cursor: canAfford ? 'pointer' : 'not-allowed' }}>
                      {canAfford ? 'Beli' : 'XP Kurang'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {owned.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
              Item dimiliki: {owned.length} — {owned.map((id) => STORE_ITEMS.find((i) => i.id === id)?.name).filter(Boolean).join(', ')}
            </p>
          )}
        </section>
      )}
      {view === 'leaderboard' && (
        <>
          {rows.length > 0 && (
        <section className="section">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {myRank !== null && (
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--accent-light)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  #{myRank}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{getInitials(me.full_name ?? '')}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{me.full_name}</span>
                    {myGp && <span className="level-badge">L{myGp.level}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {myGp?.xp ?? 0} XP · {myGp?.streak_current ?? 0} hari streak
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 8, boxShadow: 'var(--shadow-sm)' }}>
            {rows.map((r, i) => {
              const isMe = r.profile_id === me.id;
              const isTop3 = i < 3;
              return (
                <div
                  key={r.profile_id}
                  className="leaderboard-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: i === rows.length - 1 ? 0 : 'var(--radius-sm)',
                    background: isMe ? 'var(--accent-soft)' : undefined,
                    margin: i === rows.length - 1 ? '0' : '0 0 4px',
                  }}
                >
                  <div style={{ width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isTop3 ? 20 : 14, fontWeight: 700, color: isTop3 ? undefined : 'var(--muted)' }}>
                    {isTop3 ? MEDALS[i] : `#${i + 1}`}
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: isMe ? 'var(--accent)' : 'var(--accent-soft)', color: isMe ? '#fff' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                    {getInitials(r.full_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.full_name}</span>
                      <span className="level-badge">L{r.level}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {r.xp} XP · streak {r.streak_best}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', textAlign: 'right' }}>
                    {r.xp}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {rows.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <h3 className="empty-state-title">Belum ada peringkat</h3>
          <p className="empty-state-text">Jadilah yang pertama menyelesaikan latihan atau simulasi untuk masuk ke papan peringkat.</p>
        </div>
      )}
        </>
      )}
    </div>
  );
}
