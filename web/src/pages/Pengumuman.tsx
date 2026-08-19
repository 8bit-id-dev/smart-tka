import { useEffect, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';

type Row = { id: string; title: string; body: string; priority: string; requires_ack: boolean };

export function Pengumuman({ profile }: { profile: AppProfile }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

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
    setErr('');
    if (!profile.school_id) {
      setErr('Tidak ada school_id.');
      return;
    }
    setBusy(true);
    const { error } = await insforge.database.from('announcements').insert({
      school_id: profile.school_id,
      author_id: profile.id,
      title,
      body,
      priority: ack ? 'urgent' : 'normal',
      requires_ack: ack,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setOk('Pengumuman terkirim.');
      setTitle('');
      setBody('');
      await load();
    }
  }

  async function hapus(id: string) {
    if (!confirm('Hapus pengumuman ini?')) return;
    const { error } = await insforge.database.from('announcements').delete().eq('id', id);
    if (error) setErr(error.message);
    else await load();
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Pengumuman</h1>
        <p className="page-subtitle">Kirim pengumuman ke seluruh sekolah. Centang "wajib baca" agar muncul sebagai prioritas tinggi.</p>
      </header>

      {err && (
        <div className="banner banner-danger" style={{ marginBottom: 20 }}>
          <p className="banner-text">{err}</p>
        </div>
      )}
      {ok && (
        <div className="banner banner-ok" style={{ marginBottom: 20 }}>
          <p className="banner-text">{ok}</p>
        </div>
      )}

      <div className="page-split">
        <div className="form-sticky">
        <form onSubmit={kirim} className="form-container">
          <div className="form-card">
            <header className="card-header">
              <div>
                <h2 className="card-title">Tulis pengumuman</h2>
              <p className="card-subtitle">Judul singkat dan isi lengkap pengumuman.</p>
            </div>
          </header>

          <div className="form-section">
            <div className="form-section-title">Judul <span className="req"></span></div>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Mis. Libur hari Jumat depan"
            />
          </div>

          <div className="form-section">
            <div className="form-section-title">Isi <span className="req"></span></div>
            <textarea
              className="textarea"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              placeholder="Tulis isi pengumuman di sini..."
            />
          </div>

          <div className="form-section">
            <div className="field-row">
              <input type="checkbox" id="pkt-ack" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <label className="form-label" htmlFor="pkt-ack">
                Wajib baca (prioritas tinggi)
              </label>
            </div>
          </div>
        </div>

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Mengirim…' : 'Kirim'}
          </button>
        </div>
      </form>
        </div>
        <div>
          <section className="form-card" style={{ marginTop: 0 }}>
        <header className="card-header">
          <h2 className="card-title">Terkirim ({rows.length})</h2>
        </header>

        {rows.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3 className="empty-state-title">Belum ada pengumuman</h3>
            <p className="empty-state-text">Ajukan pengumuman pertama di formulir di atas.</p>
          </div>
        )}

        {rows.map((r) => (
          <article key={r.id} className="card" style={{ marginBottom: 8, boxShadow: 'none', padding: '12px 16px' }}>
            <div className="card-header">
              <div>
                <h3 className="card-title" style={{ fontSize: 15 }}>{r.title}</h3>
                <p className="card-subtitle">{r.body}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => hapus(r.id)}>
                Hapus
              </button>
            </div>
            {r.requires_ack && (
              <span className="badge badge-warn" style={{ marginTop: 4, display: 'inline-block' }}>
                Wajib baca
              </span>
            )}
          </article>
        ))}
      </section>
        </div>
      </div>
    </div>
  );
}
