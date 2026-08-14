import { useEffect, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';

const JENJANG_LABEL: Record<string, string> = {
  sd: 'SD kelas 6',
  smp: 'SMP kelas 9',
  sma: 'SMA kelas 12',
  smk: 'SMK',
  paket_a: 'Paket A',
  paket_b: 'Paket B',
  paket_c: 'Paket C',
};

function sixDigit() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function Profil({
  profile,
  email,
  onOut,
}: {
  profile: AppProfile;
  email: string | null;
  onOut: () => void;
}) {
  const jenjang = profile.jenjang ? JENJANG_LABEL[profile.jenjang] || profile.jenjang : 'Belum diisi';
  const [code, setCode] = useState<string | null>(null);
  const [exp, setExp] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [ortu, setOrtu] = useState<{ parent_id: string; nama: string }[]>([]);

  useEffect(() => {
    if (profile.role !== 'siswa') return;
    void (async () => {
      const { data } = await insforge.database
        .from('profiles')
        .select('parent_code, parent_code_exp')
        .eq('id', profile.id);
      const row = (data || [])[0] as { parent_code?: string | null; parent_code_exp?: string | null } | undefined;
      if (row?.parent_code && row.parent_code_exp && new Date(row.parent_code_exp) > new Date()) {
        setCode(row.parent_code);
        setExp(row.parent_code_exp);
      }
      const links = await insforge.database
        .from('parent_links')
        .select('parent_id, status')
        .eq('student_id', profile.id)
        .eq('status', 'accepted');
      const ids = ((links.data || []) as { parent_id: string }[]).map((r) => r.parent_id);
      if (ids.length) {
        const p = await insforge.database.from('profiles').select('id, full_name').in('id', ids);
        setOrtu(((p.data || []) as { id: string; full_name: string | null }[]).map((r) => ({ parent_id: r.id, nama: r.full_name || 'Orang tua' })));
      }
    })();
  }, [profile.id, profile.role]);

  async function buatKode() {
    setBusy(true);
    setMsg('');
    const next = sixDigit();
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await insforge.database
      .from('profiles')
      .update({ parent_code: next, parent_code_exp: until })
      .eq('id', profile.id);
    setBusy(false);
    if (error) {
      setMsg(error.message + ' — jalankan SQL 017 di SQL Studio.');
      return;
    }
    setCode(next);
    setExp(until);
  }

  return (
    <div className="placeholder">
      <section className="card">
        <h2>Profil</h2>
        <p className="type-lab">Data dari InsForge · public.profiles</p>

        <dl className="profil-list">
          <div>
            <dt>Nama</dt>
            <dd>{profile.full_name || '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{email || '—'}</dd>
          </div>
          <div>
            <dt>Peran</dt>
            <dd>
              <span className="chip chip-ok">{profile.role}</span>
            </dd>
          </div>
          <div>
            <dt>Jenjang</dt>
            <dd>{jenjang}</dd>
          </div>
          <div>
            <dt>ID profil</dt>
            <dd className="mono">{profile.id}</dd>
          </div>
          <div>
            <dt>User ID Auth</dt>
            <dd className="mono">{profile.user_id}</dd>
          </div>
        </dl>

        {profile.role === 'siswa' && (
          <div className="hint-panel" style={{ marginTop: 24 }}>
            <p className="type-lab">Taut orang tua</p>
            <p style={{ margin: '0 0 12px' }}>
              Buat kode 6 digit. Orang tua memasukkan kode ini di menu Anak. Berlaku 24 jam. Bukan prediksi skor TKA resmi.
            </p>
            {code && exp && (
              <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--teal)', margin: '0 0 8px' }}>
                {code}
              </p>
            )}
            {exp && (
              <p className="meta" style={{ margin: '0 0 12px' }}>
                Kadaluarsa {new Date(exp).toLocaleString('id-ID')}
              </p>
            )}
            <button className="btn" type="button" disabled={busy} onClick={() => void buatKode()}>
              {code ? 'Buat kode baru' : 'Buat kode taut'}
            </button>
            {ortu.length > 0 && (
              <p className="meta" style={{ marginTop: 12 }}>
                Tertaut: {ortu.map((o) => o.nama).join(', ')}
              </p>
            )}
            {msg && <p className="legal">{msg}</p>}
          </div>
        )}

        <button className="btn" type="button" onClick={onOut} style={{ marginTop: 24, maxWidth: 220 }}>
          Keluar
        </button>
        <p className="legal">Tidak berafiliasi dengan Kemendikdasmen.</p>
      </section>
    </div>
  );
}
