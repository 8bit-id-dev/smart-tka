import { useState } from 'react';
import hero from './assets/hero.png';
import logo8bit from './assets/logo-8bit.png';

type Props = {
  configured: boolean;
  busy: boolean;
  message: string;
  onSignIn: (email: string, password: string) => void;
  onSignUp?: (name: string, email: string, password: string) => void;
};

const WA_ADMIN =
  'https://wa.me/6285800644841?text=' +
  encodeURIComponent('Halo admin SMART-TKA, saya ingin dibuatkan akun.');

function openWhatsAppAdmin(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  const w = window.open(WA_ADMIN, '_blank', 'noopener,noreferrer');
  if (!w) {
    try {
      if (window.top && window.top !== window) window.top.location.href = WA_ADMIN;
      else window.location.href = WA_ADMIN;
    } catch {
      window.location.href = WA_ADMIN;
    }
  }
}

function WaAdmin({ children }: { children: string }) {
  return (
    <a className="auth-wa" href={WA_ADMIN} target="_blank" rel="noopener noreferrer" onClick={openWhatsAppAdmin}>
      {children}
    </a>
  );
}

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function AuthScreen({ configured, busy, message, onSignIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSignIn(email, password);
  }

  return (
    <div className="auth-page auth-page--hero">
      <main className="auth-card auth-card--hero">
        <p className="auth-brand">SMART-TKA</p>
        <img className="auth-hero" src={hero} alt="" width={280} height={190} />
        <h1>Masuk</h1>
        <p className="auth-lead">Pakai email dan kata sandi dari admin sekolah.</p>

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-pill">
            <span className="sr-only">Email</span>
            <Icon d="M4 4h16v16H4z M22 6l-10 7L2 6" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="username"
            />
          </label>
          <label className="auth-pill">
            <span className="sr-only">Kata sandi</span>
            <Icon d="M19 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4" />
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Kata sandi"
              required
              minLength={8}
              autoComplete="current-password"
            />
            <button
              type="button"
              className={showPw ? 'pw-toggle on' : 'pw-toggle'}
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              aria-pressed={showPw}
            >
              <Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
            </button>
          </label>

          {message && <p className="auth-msg">{message}</p>}

          <button className="auth-cta" type="submit" disabled={busy || !configured}>
            <span>Masuk</span>
            <span className="auth-cta-go" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </button>
        </form>

        <p className="auth-admin-hint">
          Belum punya akun? Minta ke <WaAdmin>admin sekolah</WaAdmin>.
        </p>
        <p className="auth-powered">
          <span>powered by</span>
          <img src={logo8bit} alt="" width={20} height={20} />
          <span>8bit.id</span>
        </p>
      </main>
    </div>
  );
}
