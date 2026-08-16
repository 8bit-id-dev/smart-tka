import { useState } from 'react';

type Props = {
  configured: boolean;
  busy: boolean;
  message: string;
  onSignIn: (email: string, password: string) => void;
  onSignUp: (name: string, email: string, password: string) => void;
};

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function AuthScreen({ configured, busy, message, onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<'daftar' | 'masuk'>('masuk');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'daftar') onSignUp(name, email, password);
    else onSignIn(email, password);
  }

  return (
    <div className="auth-page">
      <main className="auth-card">
        <div className="auth-mark" aria-hidden>
          <Icon d="M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5" size={28} />
        </div>
        <h1>{mode === 'daftar' ? 'Daftar' : 'Masuk'}</h1>
        <p className="auth-lead">
          {mode === 'daftar'
            ? 'Bergabung dengan SMART-TKA untuk persiapan akademik yang terarah.'
            : 'Masuk untuk lanjut latihan. Siap TKA karena menguasai, bukan menebak.'}
        </p>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'daftar' && (
            <label>
              Nama Tampilan
              <span className="auth-input">
                <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masukkan nama Anda" required minLength={2} />
              </span>
            </label>
          )}
          <label>
            Email
            <span className="auth-input">
              <Icon d="M4 4h16v16H4z M22 6l-10 7L2 6" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contoh@email.com" required />
            </span>
          </label>
          <label>
            Password
            <span className="auth-input">
              <Icon d="M19 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                required
                minLength={8}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label="Tampilkan password">
                <Icon d={showPw ? 'M17.94 17.94A10 10 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5-5M9.9 4.2A10 10 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22' : 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'} />
              </button>
            </span>
          </label>

          {mode === 'daftar' && (
            <div className="auth-note">
              <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01" />
              <p>
                Jika diminta verifikasi, cek email.
                <small>Staging: admin bisa Auto-confirm.</small>
              </p>
            </div>
          )}

          {message && <p className="auth-msg">{message}</p>}

          <button className="btn btn-primary auth-submit" type="submit" disabled={busy || !configured}>
            {mode === 'daftar' ? 'Daftar' : 'Masuk'}
            <span aria-hidden> →</span>
          </button>
        </form>

        <footer className="auth-foot">
          {mode === 'daftar' ? (
            <p>
              Sudah punya akun?{' '}
              <button type="button" className="link" onClick={() => setMode('masuk')}>
                Masuk di sini
              </button>
            </p>
          ) : (
            <p>
              Belum punya akun?{' '}
              <button type="button" className="link" onClick={() => setMode('daftar')}>
                Daftar
              </button>
            </p>
          )}
          <p className="legal">Tidak berafiliasi dengan Kemendikdasmen.</p>
        </footer>
      </main>
    </div>
  );
}
