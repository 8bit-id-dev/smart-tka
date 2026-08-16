import { useEffect, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';

type Anak = {
  id: string;
  full_name: string | null;
  jenjang: string | null;
  rata: number | null;
  nSesi: number;
};

export function Ortu({ me }: { me: AppProfile }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [anak, setAnak] = useState<Anak[]>([]);
  const [loadErr, setLoadErr] = useState('');

  async function muat() {
    setLoadErr('');
    const { data: links, error } = await insforge.database
      .from('parent_links')
      .select('student_id, status')
      .eq('parent_id', me.id)
      .eq('status', 'accepted');
    if (error) {
      setLoadErr(error.message);
      return;
    }
    const ids = ((links || []) as { student_id: string }[]).map((r) => r.student_id);
    if (!ids.length) {
      setAnak([]);
      return;
    }
    const prof = await insforge.database.from('profiles').select('id, full_name, jenjang').in('id', ids);
    const atts = await insforge.database.from('attempts').select('student_id, score, status').in('student_id', ids);
    if (atts.error) setLoadErr(atts.error.message + ' — jalankan SQL 017 (policy attempts_parent).');
    const byId = new Map<string, { sum: number; n: number }>();
    for (const a of (atts.data || []) as { student_id: string; score: number | null; status: string }[]) {
      if (a.status !== 'submitted' || a.score == null) continue;
      const cur = byId.get(a.student_id) || { sum: 0, n: 0 };
      cur.sum += Number(a.score);
      cur.n += 1;
      byId.set(a.student_id, cur);
    }
    setAnak(
      ((prof.data || []) as { id: string; full_name: string | null; jenjang: string | null }[]).map((p) => {
        const s = byId.get(p.id);
        return {
          id: p.id,
          full_name: p.full_name,
          jenjang: p.jenjang,
          rata: s && s.n ? Math.round((s.sum / s.n) * 10) / 10 : null,
          nSesi: s?.n || 0,
        };
      }),
    );
  }

  useEffect(() => {
    void muat();
  }, [me.id]);

  async function taut(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setBusy(true);
    const raw = code.trim().toUpperCase();
    const { data, error } = await insforge.database.rpc('smart_parent_claim', { p_code: raw });
    setBusy(false);
    if (error) {
      setMsg(error.message + ' — pastikan SQL 017 sudah dijalankan dan kode masih berlaku.');
      return;
    }
    void data;
    setCode('');
    setMsg('Anak tertaut. Skor latihan/simulasi SMART-TKA (bukan prediksi TKA resmi).');
    await muat();
  }

  return (
    <div className="dashboard-page">
      <header className="page-header" style={{ marginBottom: 20 }}>
        <p className="page-subtitle">Pantau kesiapan anak</p>
        <h1 className="page-title">Anak</h1>
      </header>

      <section className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 20px' }}>
          Anda tidak mengerjakan soal atas nama anak. Bukan prediksi Tes Kemampuan Akademik resmi.
        </p>

        <form onSubmit={taut} className="auth-form" style={{ maxWidth: 400 }}>
          <label>
            Kode taut dari anak (6 digit)
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy || code.length < 6}>
            Tautkan
          </button>
        </form>
        {msg && <p className="legal">{msg}</p>}
        {loadErr && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{loadErr}</p>}
      </section>

      {anak.length === 0 ? (
        <section className="card hint-panel" style={{ marginTop: 16 }}>
          <p className="type-lab">Belum ada anak</p>
          <p style={{ margin: 0 }}>Minta anak buka Profil → Buat kode taut, lalu masukkan di sini sebelum 24 jam.</p>
        </section>
      ) : (
        <div className="bento" style={{ marginTop: 16 }}>
          {anak.map((a) => (
            <section key={a.id} className="card">
              <h3 style={{ margin: '0 0 4px' }}>{a.full_name || 'Siswa'}</h3>
              <p className="meta" style={{ margin: '0 0 12px' }}>
                {a.jenjang || 'Jenjang belum diisi'}
              </p>
              <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
                {a.rata == null ? '—' : `${Math.round(a.rata)}%`}
              </p>
              <p className="type-lab">
                {a.nSesi === 0 ? 'Belum ada sesi terkumpul' : `Rata-rata ${a.nSesi} sesi SMART-TKA`}
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
