import { useEffect, useState } from 'react';
import { LandingPage, UnlinkedScreen } from './pages/LandingPage';
import { AuthScreen } from './AuthScreen';
import { AppShell, type Tab } from './AppShell';
import { Home } from './pages/Home';
import { Practice } from './pages/Practice';
import { Simulasi } from './pages/Simulasi';
import { Inbox } from './pages/Inbox';
import { Leaderboard } from './pages/Leaderboard';
import { Profil } from './pages/Profil';
import { Onboarding } from './pages/Onboarding';
import { SoalGuru } from './pages/SoalGuru';
import { PaketGuru } from './pages/PaketGuru';
import { Admin } from './pages/Admin';
import { Kelas } from './pages/Kelas';
import { Pengumuman } from './pages/Pengumuman';
import { Ortu } from './pages/Ortu';
import { Laporan } from './pages/Laporan';
import { Bookmark } from './pages/Bookmark';
import { getMyProfile, insforge, insforgeConfigured, type AppProfile } from './lib/insforge';
import './index.css';

const TAB_PATHS: Record<Tab, string> = {
  beranda: '/beranda',
  latihan: '/latihan',
  simulasi: '/simulasi',
  inbox: '/inbox',
  leaderboard: '/peringkat',
  profil: '/profil',
  bookmark: '/bookmark',
  soal: '/soal',
  paket: '/paket',
  kelas: '/kelas',
  pengumuman: '/pengumuman',
  laporan: '/laporan',
  admin: '/admin',
};
const PATH_TO_TAB: Record<string, Tab> = Object.fromEntries(
  Object.entries(TAB_PATHS).map(([t, p]) => [p, t as Tab])
);
PATH_TO_TAB['/'] = 'beranda';

export default function App() {
  const [status, setStatus] = useState('');
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [authId, setAuthId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [needOnboard, setNeedOnboard] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  const [path, setPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    setImmersive(false);
  }, [path]);

  function go(next: string, replace = false) {
    if (replace) window.history.replaceState({}, '', next);
    else window.history.pushState({}, '', next);
    setPath(next);
  }

  async function refresh() {
    if (!insforgeConfigured) {
      setStatus('Isi web/.env lalu restart npm run dev.');
      setReady(true);
      return;
    }
    const r = await getMyProfile();
    setAuthId(r.authUser?.id ?? null);
    setEmail(r.authUser?.email ?? null);
    setProfile(r.profile);
    if (r.profile?.role === 'siswa' && !r.profile.jenjang) setNeedOnboard(true);
    if (r.authUser && !r.profile) setStatus(r.error || 'Akun belum terhubung.');
    else setStatus('');
    if (r.authUser && window.location.pathname === '/login') go('/beranda', true);
    setReady(true);
  }

  async function tautSendiri(role: 'admin' | 'siswa' | 'guru' | 'orang_tua') {
    if (!authId) return;
    setLinkMsg('Menyimpan profil…');
    const { error } = await insforge.database.from('profiles').upsert(
      {
        user_id: authId,
        full_name: email || 'Pengguna',
        role,
        school_id: '11111111-1111-1111-1111-111111111111',
        jenjang: 'smp',
        is_active: true,
      },
      { onConflict: 'user_id' }
    );
    if (error) setLinkMsg(error.message);
    else {
      setLinkMsg('Tersimpan. Memuat ulang…');
      await refresh();
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onSignIn(em: string, password: string) {
    setBusy(true);
    setStatus('');
    const { error } = await insforge.auth.signInWithPassword({ email: em, password });
    setBusy(false);
    if (error) setStatus(error.message);
    else await refresh();
  }

  async function onSignOut() {
    await insforge.auth.signOut();
    setProfile(null);
    setAuthId(null);
    setEmail(null);
    setNeedOnboard(false);
    go('/', true);
  }

  if (!ready) {
    return (
      <div className="auth-page">
        <p className="auth-lead">Memuat…</p>
      </div>
    );
  }

  if (!authId) {
    if (path === '/login') {
      return <AuthScreen configured={insforgeConfigured} busy={busy} message={status} onSignIn={onSignIn} />;
    }
    return <LandingPage />;
  }

  if (!profile) {
    return (
      <UnlinkedScreen
        authId={authId}
        status={status}
        linkMsg={linkMsg}
        onLink={tautSendiri}
        onSignOut={onSignOut}
      />
    );
  }

  if (profile.is_active === false) {
    return (
      <div className="auth-page">
        <main className="auth-card unlinked" style={{ borderLeft: '4px solid #dc2626' }}>
          <h1 style={{ color: '#dc2626' }}>Akun Dinonaktifkan</h1>
          <p className="auth-lead">
            Akun Anda telah dinonaktifkan oleh administrator. Silakan hubungi admin sekolah Anda.
          </p>
          <button className="btn" type="button" onClick={onSignOut} style={{ marginTop: 20 }}>
            Keluar (Sign Out)
          </button>
        </main>
      </div>
    );
  }

  if (needOnboard) {
    return (
      <Onboarding
        onDone={async (j) => {
          await insforge.database.from('profiles').update({ jenjang: j }).eq('id', profile.id);
          setProfile({ ...profile, jenjang: j });
          setNeedOnboard(false);
        }}
      />
    );
  }

  const name = profile.full_name || email || 'Pengguna';
  const tab: Tab = PATH_TO_TAB[path] ?? 'beranda';

  return (
     <AppShell tab={tab} onTab={(t) => go(TAB_PATHS[t])} name={name} role={profile.role} profile={profile} immersive={immersive}>
      {tab === 'beranda' && profile.role === 'orang_tua' && <Ortu me={profile} />}
      {tab === 'beranda' && profile.role !== 'orang_tua' && <Home name={name} profile={profile} onTab={(t) => go(TAB_PATHS[t])} />}
      {tab === 'latihan' && (
        <Practice schoolId={profile.school_id} studentId={profile.id} jenjang={profile.jenjang} onHome={() => go('/')} onImmersiveChange={setImmersive} />
      )}
      {tab === 'simulasi' && <Simulasi schoolId={profile.school_id} studentId={profile.id} onImmersiveChange={setImmersive} />}
       {tab === 'inbox' && <Inbox profileId={profile.id} />}
       {tab === 'leaderboard' && <Leaderboard me={profile} />}
      {tab === 'soal' && <SoalGuru profile={profile} />}
      {tab === 'paket' && <PaketGuru profile={profile} />}
      {tab === 'kelas' && <Kelas profile={profile} />}
      {tab === 'pengumuman' && <Pengumuman profile={profile} />}
      {tab === 'laporan' && <Laporan me={profile} onTab={(t) => go(TAB_PATHS[t])} />}
      {tab === 'admin' && <Admin me={profile} />}
      {tab === 'profil' && <Profil profile={profile} email={email} onOut={onSignOut} />}
      {tab === 'bookmark' && <Bookmark profile={profile} onHome={() => go('/')} />}
    </AppShell>
  );
}