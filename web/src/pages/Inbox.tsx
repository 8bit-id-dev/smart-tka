import { useEffect, useState } from 'react';
import { insforge } from '../lib/insforge';

type Row = { id: string; title: string; body: string; priority: string; requires_ack: boolean };

export function Inbox({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [acked, setAcked] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await insforge.database.from('announcements').select('id, title, body, priority, requires_ack');
      if (error) setErr(error.message);
      else setRows((data || []) as Row[]);
    })();
  }, []);

  async function ack(id: string) {
    await insforge.database.from('announcement_acks').insert({ announcement_id: id, profile_id: profileId });
    setAcked((a) => ({ ...a, [id]: true }));
  }

  return (
    <div className="dashboard-page">
      <header className="page-header" style={{ marginBottom: 20 }}>
        <p className="page-subtitle">Pengumuman dan tugas</p>
        <h1 className="page-title">Kotak Masuk</h1>
      </header>

      {err && (
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>
          <p className="banner-text">{err}</p>
        </div>
      )}

      {rows.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h3 className="empty-state-title">Belum ada pengumuman</h3>
          <p className="empty-state-text">Pengumuman dari guru akan muncul di sini.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((m) => (
          <div key={m.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>{m.title}</h3>
                {m.requires_ack && <span className="badge badge-warn">Wajib</span>}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>{m.body}</p>
            </div>
            {m.requires_ack && !acked[m.id] && (
              <button className="continue-btn" type="button" style={{ flexShrink: 0 }} onClick={() => ack(m.id)}>
                Saya sudah baca
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}