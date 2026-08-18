import { useEffect, useState, useCallback } from 'react';
import { insforge, type AppProfile } from './lib/insforge';
import { XpReward } from './components/XpReward';
import AppIcon from './assets/smart.png';

export type Tab =
  | 'beranda'
  | 'latihan'
  | 'simulasi'
  | 'inbox'
  | 'leaderboard'
  | 'soal'
  | 'paket'
  | 'kelas'
  | 'pengumuman'
  | 'laporan'
  | 'admin'
  | 'profil'
  | 'bookmark';

const Icons = {
  beranda: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  latihan: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  simulasi: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M12 18v-6" />
      <path d="M9 15h6" />
    </svg>
  ),
  inbox: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  soal: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M12 6v4" />
      <path d="M12 14h.01" />
    </svg>
  ),
  paket: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.4l-9-5.19" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  kelas: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  pengumuman: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  laporan: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  admin: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  profil: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
   anak: (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  leaderboard: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 16V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2z" />
      <path d="M12 12h.01M16 16h.01M8 8h.01M8 12h.01" />
      <path d="M6 22h12" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  ),
  search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  edit: (filled = false) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 3.5a2.52 2.52 0 0 1 3.5 3.5L12 17l-4 1 1-4 10.5-10.5z" />
    </svg>
  ),
  x: (filled = false) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  menu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
   bookmark: (filled = false) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  sun: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="19" x2="3" y2="19" />
      <line x1="21" y1="5" x2="23" y2="5" />
    </svg>
  ),
  moon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
};

export { Icons };

type GamifProfile = { xp: number; level: number; streak_current: number; streak_best: number };

type NotifRow = {
  id: string;
  title: string;
  body: string;
  priority: string;
  requires_ack: boolean;
  created_at?: string;
};

function timeAgo(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}j`;
  const days = Math.floor(h / 24);
  return `${days}h`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function AppShell({
  tab,
  onTab,
  name,
  role,
  profile,
  children,
  headerExtra,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  name: string;
  role: string;
  profile: AppProfile;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(['guru', 'admin'].includes(role) ? 'light' : 'dark');
  const [rows, setRows] = useState<NotifRow[]>([]);
  const [gp, setGp] = useState<GamifProfile | null>(null);

  const isLightOnlyRole = ['guru', 'admin'].includes(role);

  useEffect(() => {
    const saved = localStorage.getItem('smart_tka_theme') as 'dark' | 'light' | null;
    const initial = isLightOnlyRole ? 'light' : (saved || 'dark');
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, [role]);

  useEffect(() => {
    void (async () => {
      const { data, error } = await insforge.database
        .from('gamification_profiles')
        .select('xp, level, streak_current, streak_best')
        .eq('profile_id', profile.id)
        .single();
      if (!error && data) setGp(data as GamifProfile);
    })();
  }, [profile.id]);

  useEffect(() => {
      void (async () => {
        const { data: anData, error: anErr } = await insforge.database
          .from('announcements')
          .select('id, title, body, priority, requires_ack, created_at');
        if (anErr) {
          const fallback = await insforge.database
            .from('announcements')
            .select('id, title, body, priority, requires_ack');
          if (fallback.error) return;
          const anns = (fallback.data || []) as NotifRow[];
          const { data: ackData } = await insforge.database
            .from('announcement_acks')
            .select('announcement_id')
            .eq('profile_id', profile.id);
          const acked = new Set(((ackData || []) as { announcement_id: string }[]).map((a) => a.announcement_id));
          setRows(anns.filter((a) => !acked.has(a.id)));
          return;
        }
        const anns = (anData || []) as NotifRow[];

        const { data: ackData } = await insforge.database
          .from('announcement_acks')
          .select('announcement_id')
          .eq('profile_id', profile.id);
        const acked = new Set(((ackData || []) as { announcement_id: string }[]).map((a) => a.announcement_id));

        const unread = anns.filter((a) => !acked.has(a.id));
        unread.sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime());
        setRows(unread);
      })();
    }, [profile.id]);

  async function ackNotif(id: string) {
    await insforge.database.from('announcement_acks').insert({
      announcement_id: id,
      profile_id: profile.id,
    });
     setRows((prev) => prev.filter((r) => r.id !== id));
   }

   function toggleTheme() {
     const next = theme === 'dark' ? 'light' : 'dark';
     setTheme(next);
     localStorage.setItem('smart_tka_theme', next);
     document.documentElement.classList.toggle('dark', next === 'dark');
   }

   const handleXpAwarded = useCallback(async (xp: number) => {
    if (role !== 'siswa') return null;

    const before = { ...(gp ?? { level: 1, xp: 0 }) };

    try {
      await insforge.database.rpc('award_xp', { p_profile: profile.id, p_xp: xp });
    } catch {
      return null;
    }

    const { data: gpData } = await insforge.database
      .from('gamification_profiles')
      .select('xp, level, streak_current, streak_best')
      .eq('profile_id', profile.id)
      .single();

    if (gpData) {
      setGp(gpData as GamifProfile);
    }

    const newLevel = (gpData as GamifProfile | null)?.level ?? before.level;
    const result: { levelUp?: { old: number; new: number }; newAchievement?: { title: string; icon: string } } = {};

    if (newLevel > before.level) {
      result.levelUp = { old: before.level, new: newLevel };
    }

    if (xp > 0 || result.levelUp) {
      void insforge.database
        .from('user_achievements')
        .select('!*')
        .eq('profile_id', profile.id)
        .order('earned_at', { ascending: false })
        .limit(1);
    }

    return result;
  }, [profile.id, gp, role]);

  const items: { id: Tab; label: string }[] = [];
  if (role === 'orang_tua') {
    items.push({ id: 'beranda', label: 'Anak' }, { id: 'profil', label: 'Profil' });
  } else if (role === 'siswa') {
    items.push(
      { id: 'beranda', label: 'Beranda' },
      { id: 'latihan', label: 'Latihan' },
      { id: 'simulasi', label: 'Simulasi' },
      { id: 'inbox', label: 'Kotak Masuk' },
      { id: 'leaderboard', label: 'Peringkat' },
    );
  } else {
    items.push(
      { id: 'beranda', label: 'Beranda' },
      { id: 'latihan', label: 'Latihan' },
      { id: 'simulasi', label: 'Simulasi' },
      { id: 'inbox', label: 'Kotak Masuk' },
    );
    items.push(
      { id: 'soal', label: 'Soal' },
      { id: 'paket', label: 'Paket' },
      { id: 'kelas', label: 'Kelas' },
      { id: 'pengumuman', label: 'Pengumuman' },
      { id: 'laporan', label: 'Laporan' }
    );
    if (['admin', 'kepsek'].includes(role)) items.push({ id: 'admin', label: 'Admin' });
    items.push({ id: 'profil', label: 'Profil' });
  }

  const isDesktopRole = ['guru', 'admin', 'konten', 'kepsek'].includes(role);

  const getIcon = (id: Tab, isActive: boolean) => {
    const iconKey = id === 'beranda' && role === 'orang_tua' ? 'anak' : id;
    const IconComponent = Icons[iconKey as keyof typeof Icons];
    return IconComponent ? IconComponent(isActive) : null;
  };

  const initials = getInitials(name);

  return (
     <div className={`shell ${isDesktopRole ? 'shell-desktop sidebar-collapsed' : 'shell-mobile'}`}>
       {isDesktopRole ? (
         <>
           <aside className="shell-sidebar">
             <div className="shell-sidebar-header">
               <strong className="brand">
                 <span className="brand-icon">TKA</span>
                 <span>SMART-TKA</span>
               </strong>
             </div>
             <nav className="shell-nav">
               {items.map((i) => {
                 const isActive = tab === i.id;
                 return (
                   <button
                     key={i.id}
                     className={isActive ? 'on' : ''}
                     type="button"
                     onClick={() => onTab(i.id)}
                     title={i.label}
                   >
                     <span className="nav-icon">{getIcon(i.id, isActive)}</span>
                     <span className="nav-label">{i.label}</span>
                   </button>
                 );
              })}
            </nav>
             <span className="shell-user">
               {initials}
             </span>
          </aside>
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
             <header className="shell-header">
               <div className="shell-header-right">
                 {headerExtra}
                 <div className="header-action-group">
                   <button
                     type="button"
                     className="header-icon-btn"
                     title="Kotak masuk"
                     onClick={() => setNotifOpen(!notifOpen)}
                     aria-expanded={notifOpen}
                   >
                     <Icons.bell />
                    <span className="header-badge">{rows.length}</span>
                   </button>
                   {notifOpen && (
                     <div className="notif-dropdown">
                       {rows.length === 0 ? (
                         <button type="button" className="notif-empty">
                           <span className="notif-text">Kotak masuk kosong</span>
                         </button>
                       ) : (
                         rows.map((n) => (
                           <div key={n.id} className="notif-item">
                             <div className="notif-item-main">
                               <span className="notif-sender">{n.title}</span>
                               <span className="notif-text">{n.body.slice(0, 80)}{n.body.length > 80 ? '…' : ''}</span>
                               <span className="notif-time">{timeAgo(n.created_at)}</span>
                             </div>
                             <button
                               type="button"
                               className="notif-remove"
                               title="Tandai sudah dibaca"
                               onClick={() => ackNotif(n.id)}
                             >
                               ✕
                             </button>
                           </div>
                         ))
                       )}
                     </div>
                    )}
                   <button type="button" className="header-avatar" title={name}>
                     {initials}
                     {gp && role === 'siswa' && <span className="level-badge">L{gp.level}</span>}
                   </button>
                 </div>
               </div>
             </header>
            <main className="shell-main">{children}</main>
          </div>
        </>
      ) : (
        <>
          <header className="shell-bar">
            <div className="shell-bar-left">
              <div className="app-logo-wrapper">
                <img src={AppIcon} alt="SMART-TKA" className="app-logo" />
                <strong className="brand">SMART-TKA</strong>
              </div>
            </div>
            <div className="shell-bar-right">
              {!isLightOnlyRole && (
                <button
                  type="button"
                  className="header-icon-btn"
                  title="Tema gelap/terang"
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? Icons.moon() : Icons.sun()}
                </button>
              )}
              <button
                type="button"
                className="header-icon-btn"
                title="Notifikasi"
                onClick={() => setNotifOpen(!notifOpen)}
                aria-expanded={notifOpen}
              >
                {Icons.bell()}
                {rows.length > 0 && <span className="header-badge">{rows.length}</span>}
              </button>
{!isLightOnlyRole && (
                <button
                  type="button"
                  className="header-icon-btn"
                  title="Tema gelap/terang"
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? Icons.moon() : Icons.sun()}
                </button>
              )}
              <button
                type="button"
                className="header-icon-btn"
                title="Simpan"
                onClick={() => onTab('bookmark')}
              >
                {Icons.bookmark()}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  {rows.length === 0 ? (
                    <button type="button" className="notif-empty">
                      <span className="notif-text">Kotak masuk kosong</span>
                    </button>
                  ) : (
                    rows.map((n) => (
                      <div key={n.id} className="notif-item">
                        <div className="notif-item-main">
                          <span className="notif-sender">{n.title}</span>
                          <span className="notif-text">{n.body.slice(0, 80)}{n.body.length > 80 ? '…' : ''}</span>
                          <span className="notif-time">{timeAgo(n.created_at)}</span>
                        </div>
                        <button type="button" className="notif-remove" title="Hapus notifikasi" onClick={() => ackNotif(n.id)}>✕</button>
                      </div>
                    ))
                  )}
                </div>
              )}
              <span className="shell-user">
                {name} · {role}
              </span>
            </div>
          </header>
          <main className="shell-main-mobile">{children}</main>
          <nav className="shell-mobile-nav">
            {items.slice(0, 5).map((i) => {
              const isActive = tab === i.id;
              return (
                <button key={i.id} className={isActive ? 'on' : ''} type="button" onClick={() => onTab(i.id)}>
                  <span className="nav-icon-mobile">{getIcon(i.id, isActive)}</span>
                  <span>{i.label}</span>
                </button>
              );
            })}
          </nav>
        </>
      )}
      {role === 'siswa' && <XpReward onXpAwarded={handleXpAwarded} />}
    </div>
  );
}
