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
    <div className="placeholder">
      <section className="card">
        <h2>Kotak masuk</h2>
        {err && <p className="auth-msg">{err}</p>}
        {rows.length === 0 && <p>Belum ada pengumuman.</p>}
        {rows.map((m) => (
          <article key={m.id} className="card" style={{ marginTop: 12, boxShadow: 'none' }}>
            <strong>{m.title}</strong>
            {m.requires_ack && <span className="chip chip-sedang" style={{ marginLeft: 8 }}>Wajib</span>}
            <p className="meta">{m.body}</p>
            {m.requires_ack && !acked[m.id] && (
              <button className="btn" type="button" style={{ maxWidth: 200, marginTop: 8 }} onClick={() => ack(m.id)}>
                Saya sudah baca
              </button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
