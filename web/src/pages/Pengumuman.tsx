import { useEffect, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';

type Row = { id: string; title: string; body: string; priority: string; requires_ack: boolean };

export function Pengumuman({ profile }: { profile: AppProfile }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    const { data, error } = await insforge.database.from('announcements').select('id, title, body, priority, requires_ack');
    if (error) setErr(error.message);
    else setRows((data || []) as Row[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!profile.school_id) {
      setErr('Tidak ada school_id.');
      return;
    }
    const { error } = await insforge.database.from('announcements').insert({
      school_id: profile.school_id,
      author_id: profile.id,
      title,
      body,
      priority: ack ? 'urgent' : 'normal',
      requires_ack: ack,
    });
    if (error) setErr(error.message);
    else {
      setTitle('');
      setBody('');
      await load();
    }
  }

  async function hapus(id: string) {
    await insforge.database.from('announcements').delete().eq('id', id);
    await load();
  }

  return (
    <div className="placeholder">
      <section className="card">
        <h2>Tulis pengumuman</h2>
        <form onSubmit={kirim} className="auth-form">
          <label>
            Judul
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Isi
            <textarea className="sel-input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required />
          </label>
          <label style={{ flexDirection: 'row', gap: 8 }}>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            Wajib baca
          </label>
          {err && <p className="auth-msg">{err}</p>}
          <button className="btn" type="submit">
            Kirim
          </button>
        </form>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>Terkirim</h2>
        {rows.map((r) => (
          <article key={r.id} className="card" style={{ marginTop: 8, boxShadow: 'none' }}>
            <strong>{r.title}</strong>
            <p>{r.body}</p>
            <button type="button" className="btn-ghost btn" style={{ maxWidth: 120 }} onClick={() => hapus(r.id)}>
              Hapus
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
