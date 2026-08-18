import { useEffect, useState } from 'react';
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
import { getMyProfile, insforge, insforgeConfigured, type AppProfile } from './lib/insforge';
import './index.css';

export default function App() {
  const [status, setStatus] = useState('');
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [authId, setAuthId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('beranda');
  const [needOnboard, setNeedOnboard] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');

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
    setReady(true);
  }

  async function tautSendiri(role: 'admin' | 'siswa' | 'guru' | 'orang_tua') {
    if (!authId) return;
    setLinkMsg('Menyimpan profil…');
    const { error } = await insforge.database.from('profiles').insert({
      user_id: authId,
      full_name: email || 'Pengguna',
      role,
      school_id: '11111111-1111-1111-1111-111111111111',
      jenjang: 'smp',
      is_active: true,
    });
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

  async function onSignUp(name: string, em: string, password: string) {
    setBusy(true);
    setStatus('');
    const { data, error } = await insforge.auth.signUp({ email: em, password, name });
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    if (data?.requireEmailVerification) {
      setStatus('Cek email verifikasi, atau Auto-confirm di staging.');
      return;
    }
    await refresh();
  }

  async function onSignOut() {
    await insforge.auth.signOut();
    setProfile(null);
    setAuthId(null);
    setEmail(null);
    setNeedOnboard(false);
    setTab('beranda');
  }

  if (!ready) {
    return (
      <div className="auth-page">
        <p className="auth-lead">Memuat…</p>
      </div>
    );
  }

  if (!authId) {
    return <AuthScreen configured={insforgeConfigured} busy={busy} message={status} onSignIn={onSignIn} onSignUp={onSignUp} />;
  }

  if (!profile) {
    return (
      <div className="auth-page">
        <main className="auth-card unlinked">
          <h1>Akun belum terhubung</h1>
          <p className="auth-lead">Login berhasil. Belum ada profil, atau API menolak baca.</p>
          {status && <p className="auth-msg">{status}</p>}
          <pre className="debug">{authId}</pre>
          {linkMsg && <p className="legal">{linkMsg}</p>}
          <button className="btn" type="button" onClick={() => tautSendiri('admin')} style={{ marginTop: 12 }}>
            Hubungkan sebagai admin
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => tautSendiri('guru')} style={{ marginTop: 8 }}>
            Hubungkan sebagai guru
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => tautSendiri('siswa')} style={{ marginTop: 8 }}>
            Hubungkan sebagai siswa
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => tautSendiri('orang_tua')} style={{ marginTop: 8 }}>
            Hubungkan sebagai orang tua
          </button>
          <button className="btn btn-ghost" type="button" onClick={onSignOut} style={{ marginTop: 16 }}>
            Keluar
          </button>
        </main>
      </div>
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

  return (
     <AppShell tab={tab} onTab={setTab} name={name} role={profile.role} profile={profile}>
      {tab === 'beranda' && profile.role === 'orang_tua' && <Ortu me={profile} />}
      {tab === 'beranda' && profile.role !== 'orang_tua' && <Home name={name} profile={profile} onTab={setTab} />}
      {tab === 'latihan' && (
        <Practice schoolId={profile.school_id} studentId={profile.id} jenjang={profile.jenjang} onHome={() => setTab('beranda')} />
      )}
      {tab === 'simulasi' && <Simulasi schoolId={profile.school_id} studentId={profile.id} />}
       {tab === 'inbox' && <Inbox profileId={profile.id} />}
       {tab === 'leaderboard' && <Leaderboard me={profile} />}
      {tab === 'soal' && <SoalGuru profile={profile} />}
      {tab === 'paket' && <PaketGuru profile={profile} />}
      {tab === 'kelas' && <Kelas profile={profile} />}
      {tab === 'pengumuman' && <Pengumuman profile={profile} />}
      {tab === 'laporan' && <Laporan me={profile} onTab={setTab} />}
      {tab === 'admin' && <Admin me={profile} />}
      {tab === 'profil' && <Profil profile={profile} email={email} onOut={onSignOut} />}
    </AppShell>
  );
}