import { useEffect, useState } from 'react';
import { getBookmarks, toggleBookmark } from '../lib/bookmarks';

type Bookmarked = {
  id: string;
  stem: string;
  mapel: string;
  item_type: string;
  created_at: string;
};

export function Bookmark({ profile, onHome }: { profile: { id: string; role: string }; onHome: () => void }) {
  const [items, setItems] = useState<Bookmarked[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const ids = getBookmarks(profile.id);
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    void (async () => {
      const { insforge } = await import('../lib/insforge');
      const { data, error } = await insforge.database
        .from('items')
        .select('id, stem, mapel, item_type, created_at')
        .in('id', ids);
      if (!error && data) setItems((data || []) as Bookmarked[]);
      setLoading(false);
    })();
  }, [profile.id]);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Memuat bookmark…</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onHome}>← Beranda</button>
        <h1 className="page-title" style={{ margin: 0, fontSize: 22 }}>Bookmark</h1>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔖</div>
          <h3 className="empty-state-title">Belum ada soal yang disimpan</h3>
          <p className="empty-state-text">Tekan ikon bookmark pada soal saat latihan untuk menyimpannya di sini.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((it) => (
            <div key={it.id} className="card" style={{ padding: '12px 16px', boxShadow: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <span className="chip chip-type">{it.item_type}</span>
                <span className="chip chip-sedang">{it.mapel}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                  {new Date(it.created_at).toLocaleDateString('id-ID')}
                </span>
              </div>
              <p style={{ margin: '4px 0', fontSize: 13, lineHeight: 1.4, color: 'var(--ink)' }}>
                {it.stem.slice(0, 200)}
                {it.stem.length > 200 && '…'}
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => copyToClipboard(it.stem)}
                  title="Salin teks soal"
                >
                  Salin
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => {
                    toggleBookmark(profile.id, it.id);
                    setItems((s) => s.filter((x) => x.id !== it.id));
                  }}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
