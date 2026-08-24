import { useCallback, useEffect, useRef, useState } from 'react';
import heroLandingImg from '../assets/hero-landing.png';
import icon8bit from '../assets/logo-8bit.png';

const BEAT = 468;
const INTRO_END = BEAT * 2;

function IntroOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, INTRO_END);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="lp-intro" aria-hidden>
      <span className="lp-intro-flash" />
      <span className="lp-intro-ring" />
      <p className="lp-intro-word">
        {'SMART-TKA'.split('').map((ch, i) => (
          <span className="lp-intro-letter" key={i} style={{ animationDelay: `${BEAT + i * 30}ms` }}>
            {ch}
          </span>
        ))}
      </p>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" fill="#F0B429" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function SlideToLogin({ onDone }: { onDone: () => void }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const maxRef = useRef(0);

  function startDrag(e: React.PointerEvent) {
    const track = trackRef.current;
    if (!track) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    maxRef.current = track.clientWidth - (e.currentTarget as HTMLElement).offsetWidth - 12;
    setDragging(true);
  }

  function moveDrag(e: React.PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - startXRef.current;
    setOffset(Math.max(0, Math.min(maxRef.current, dx)));
  }

  function endDrag() {
    if (!dragging) return;
    setDragging(false);
    if (offset >= maxRef.current - 4) {
      onDone();
    } else {
      setOffset(0);
    }
  }

  return (
    <div className="lp-slider" ref={trackRef}>
      <span className="lp-slider-label">Geser ke kanan untuk masuk</span>
      <button
        className="lp-slider-thumb"
        type="button"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label="Geser ke kanan untuk masuk"
      >
        <ArrowRightIcon />
      </button>
    </div>
  );
}

export function LandingPage() {
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      if (sessionStorage.getItem('lp-intro-seen')) return false;
    } catch {
      /* ignore */
    }
    return true;
  });
  const introEnabledRef = useRef(showIntro);

  const finishIntro = useCallback(() => {
    setShowIntro(false);
    try {
      sessionStorage.setItem('lp-intro-seen', '1');
    } catch {
      /* ignore */
    }
  }, []);

  function goToLogin() {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new Event('popstate'));
  }

  return (
    <>
      {showIntro && <IntroOverlay onDone={finishIntro} />}
      <div className="lp-page">
        <div className={`lp-mulai${introEnabledRef.current ? ' lp-intro-anim' : ''}`}>
          <div className="lp-mulai-hero">
            <img src={heroLandingImg} alt="Ilustrasi belajar SMART-TKA" />
          </div>
          <div className="lp-mulai-bottom">
            <SlideToLogin onDone={goToLogin} />
          </div>
          <p className="lp-powered">
            <span>powered by</span>
            <img className="lp-powered-logo" src={icon8bit} alt="8bit.id" />
            <span>8bit.id</span>
          </p>
        </div>
      </div>
    </>
  );
}

type UnlinkedProps = {
  authId: string;
  status: string;
  linkMsg: string;
  onLink: (role: 'admin' | 'siswa' | 'guru' | 'orang_tua') => void;
  onSignOut: () => void;
};

export function UnlinkedScreen({ authId, status, linkMsg, onLink, onSignOut }: UnlinkedProps) {
  const [showDev, setShowDev] = useState(false);

  return (
    <div className="lp-page">
      <div className="lp-unlinked">
        <div className="lp-wordmark">
          <SparkleIcon />
          <span>SMART-TKA</span>
        </div>
        <div className="lp-unlinked-illustration">
          <svg width="120" height="100" viewBox="0 0 120 100" fill="none" aria-hidden>
            <rect x="10" y="20" width="100" height="60" rx="6" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1" />
            <rect x="20" y="30" width="80" height="6" rx="2" fill="#E5E7EB" />
            <rect x="20" y="42" width="60" height="4" rx="2" fill="#E5E7EB" />
            <rect x="20" y="52" width="70" height="4" rx="2" fill="#E5E7EB" />
            <rect x="20" y="62" width="40" height="4" rx="2" fill="#E5E7EB" />
            <circle cx="60" cy="10" r="8" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1" />
            <circle cx="60" cy="10" r="6" fill="#F9FAFB" />
            <circle cx="58" cy="8" r="2" fill="#D1D5DB" />
            <circle cx="62" cy="8" r="2" fill="#D1D5DB" />
            <path d="M55 13c2 3 8 3 10 0" stroke="#9CA3AF" strokeWidth="1" fill="none" strokeLinecap="round" />
            <g opacity="0.15" stroke="#6B7280" strokeWidth="1" strokeLinecap="round">
              <line x1="100" y1="12" x2="110" y2="6" />
              <line x1="110" y1="6" x2="115" y2="12" />
            </g>
          </svg>
        </div>
        <h1 className="lp-unlinked-title">Akun belum terhubung ke sekolah.</h1>
        <p className="lp-unlinked-lead">Login berhasil, tapi akun Anda belum ditautkan ke data sekolah.</p>
        {status && <p className="lp-msg">{status}</p>}
        <div className="lp-id-box">
          <span className="lp-id-label">Berikan ID ini ke admin</span>
          <code className="lp-id-value">{authId}</code>
        </div>
        <p className="lp-unlinked-copy">Admin akan menautkan ID ini ke profil. Jangan bagikan kata sandi.</p>
        {linkMsg && <p className="lp-msg">{linkMsg}</p>}
        <button className="lp-btn-outline" type="button" onClick={onSignOut}>
          Keluar
        </button>
        <details className="lp-dev" open={showDev} onToggle={(e) => setShowDev((e.target as HTMLDetailsElement).open)}>
          <summary className="lp-dev-summary">Mode pengembang</summary>
          <div className="lp-dev-actions">
            <button className="lp-btn-dev" type="button" onClick={() => onLink('admin')}>Hubungkan sebagai admin</button>
            <button className="lp-btn-dev" type="button" onClick={() => onLink('guru')}>Hubungkan sebagai guru</button>
            <button className="lp-btn-dev" type="button" onClick={() => onLink('siswa')}>Hubungkan sebagai siswa</button>
            <button className="lp-btn-dev" type="button" onClick={() => onLink('orang_tua')}>Hubungkan sebagai orang tua</button>
          </div>
        </details>
      </div>
    </div>
  );
}