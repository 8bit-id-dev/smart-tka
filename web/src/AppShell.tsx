import { useEffect, useState, useCallback } from 'react';
import { insforge, type AppProfile } from './lib/insforge';
import { romanize } from './lib/roman';
import { XpReward } from './components/XpReward';
import AppIcon from './assets/smart.png';
import defaultPhoto from './assets/profile.jpg';
import {
  Home,
  BookOpen,
  Activity,
  Mail,
  Trophy,
  FileText,
  Package,
  Users,
  Megaphone,
  BarChart,
  Settings,
  User,
  Bookmark,
  Sparkles,
  Target,
  Award,
  Star,
  Crown,
  Menu,
  X,
  Bell,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Eye,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Loader2,
  Sun,
  Moon,
} from 'lucide-react';

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

function useOrientation() {
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false
  );
  useEffect(() => {
    function handleResize() {
      setIsLandscape(window.innerWidth > window.innerHeight);
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);
  return isLandscape;
}

const iconSize = 20;
const strokeWidth = 2;

const Icons = {
  beranda: () => <Home className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  latihan: () => <BookOpen className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  simulasi: () => <Activity className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  inbox: () => <Mail className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  leaderboard: () => <Trophy className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  soal: () => <FileText className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  paket: () => <Package className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  kelas: () => <Users className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  pengumuman: () => <Megaphone className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  laporan: () => <BarChart className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  admin: () => <Settings className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  profil: () => <User className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  bookmark: () => <Bookmark className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  anak: () => <User className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  latihanSoal: () => <Target className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  paketGuru: () => <Package className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  simulasiUjian: () => <Award className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  ranking: () => <Crown className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  star: () => <Star className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  sparkles: () => <Sparkles className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  medal: () => <Award className="icon-svg" width={iconSize} height={iconSize} fill="none" strokeWidth={strokeWidth} />,
  download: () => <Download className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  trash: () => <Trash2 className="icon-svg" width={16} height={16} strokeWidth={strokeWidth} />,
  sun: () => <Sun className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  moon: () => <Moon className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  chevronDown: () => <ChevronDown className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  chevronUp: () => <ChevronUp className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  search: () => <Search className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  filter: () => <Filter className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  plus: () => <Plus className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  edit: () => <Edit className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  trash2: () => <Trash2 className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  download2: () => <Download className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  upload: () => <Upload className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  eye: () => <Eye className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  clock: () => <Clock className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  calendar: () => <Calendar className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  alertCircle: () => <AlertCircle className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  checkCircle: () => <CheckCircle className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  xCircle: () => <XCircle className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  info: () => <Info className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  loader2: () => <Loader2 className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  bell: () => <Bell className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  menu: () => <Menu className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  x: () => <X className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  chevronDownIcon: () => <ChevronDown className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  chevronUpIcon: () => <ChevronUp className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
  sparklesIcon: () => <Sparkles className="icon-svg" width={iconSize} height={iconSize} strokeWidth={strokeWidth} />,
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

function ClockWidget() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const weekday = now.toLocaleDateString('id-ID', { weekday: 'long' });
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const date = `${weekday}, ${dd}/${mm}/${yy}`;
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
  return (
    <div className="header-clock">
      <span className="header-clock-date">{date}</span>
      <span className="header-clock-time">{time}</span>
    </div>
  );
}

function timeAgo(iso: string | undefined): string {  if (!iso) return '';
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

export function AppShell({
  tab,
  onTab,
  name,
  role,
  profile,
  children,
  headerExtra,
  immersive,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  name: string;
  role: string;
  profile: AppProfile;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  immersive?: boolean;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const isLightOnlyRole = ['guru', 'admin', 'siswa'].includes(role);
  const [theme, setTheme] = useState<'dark' | 'light'>(isLightOnlyRole ? 'light' : 'dark');
  const [rows, setRows] = useState<NotifRow[]>([]);
  const [gp, setGp] = useState<GamifProfile | null>(null);
  const isLandscape = useOrientation();

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const saved = localStorage.getItem('smart_tka_theme') as 'dark' | 'light' | null;
    const initial = isLightOnlyRole ? 'light' : (saved || 'dark');
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, [role]);
  /* eslint-enable react-hooks/exhaustive-deps */

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
      { id: 'inbox', label: 'Komunikasi' },


      { id: 'leaderboard', label: 'Peringkat' },
    );
  } else {
    items.push(
      { id: 'beranda', label: 'Beranda' },
      { id: 'latihan', label: 'Latihan' },
      { id: 'simulasi', label: 'Simulasi' },
      { id: 'inbox', label: 'Komunikasi' },


    );
    items.push(
      { id: 'soal', label: 'Soal' },
      { id: 'paket', label: 'Paket' },
      { id: 'kelas', label: 'Kelas' },
      { id: 'pengumuman', label: 'Pengumuman' },
      { id: 'laporan', label: 'Laporan' }
    );
    if (['admin', 'kepsek'].includes(role)) items.push({ id: 'admin', label: 'Admin' });
    items.push({ id: 'leaderboard', label: 'Peringkat' }, { id: 'profil', label: 'Profil' });
  }

  const isDesktopRole = ['guru', 'admin', 'konten', 'kepsek'].includes(role);
  const isMobileStudent = role === 'siswa' || role === 'orang_tua';
  const showSidebar = isDesktopRole || (isMobileStudent && isLandscape);
  const showBottomNav = isMobileStudent && !isLandscape;

  const getIcon = (id: Tab) => {
    const iconKey = id === 'beranda' && role === 'orang_tua' ? 'anak' : id;
    const IconComponent = Icons[iconKey as keyof typeof Icons];
    return IconComponent ? IconComponent() : null;
  };

  return (
     <div className={`shell ${showSidebar ? 'shell-desktop' : 'shell-mobile'} ${immersive ? 'shell-immersive' : ''}`}>
        {showSidebar ? (
         <>
<aside className="shell-sidebar">
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
                      <span className="nav-icon">{getIcon(i.id)}</span>
                    </button>
                  );
               })}
             </nav>
              <button type="button" className="sidebar-avatar" title="Profil" onClick={() => onTab('profil')}>
                <img src={profile.photo_url || defaultPhoto} alt={name} className="sidebar-avatar-img" />
              </button>
            </aside>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <header className="shell-header">
                <div className="shell-header-left">
                  <button type="button" className="brand brand-btn" title="Beranda" onClick={() => onTab('beranda')}>
                    <img className="brand-icon" src={AppIcon} alt="SMART-TKA" />
                    <span>SMART-TKA</span>
                  </button>
                </div>
                <div className="shell-header-right">
                  <ClockWidget />
                  {headerExtra}
                 <div className="header-action-group">
                   <button
                     type="button"
                     className="header-icon-btn"
                      title="Komunikasi"
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
                           <span className="notif-text">Komunikasi kosong</span>
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
                               âœ•
                             </button>
                           </div>
                         ))
                       )}
                     </div>
                    )}
                   <button type="button" className="header-avatar" title="Profil" onClick={() => onTab('profil')}>
                     <img src={profile.photo_url || defaultPhoto} alt={name} className="header-avatar-img" />
                     {gp && role === 'siswa' && <span className="level-badge">{romanize(gp.level)}</span>}
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
                <div
                  className="app-logo-wrapper"
                  role="button"
                  title="Beranda"
                  onClick={() => onTab('beranda')}
                  style={{ cursor: 'pointer' }}
                >
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
                title="Simpan"
                onClick={() => onTab('bookmark')}
              >
                {Icons.bookmark()}
              </button>
              <div className="shell-bar-right-end">
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
                {notifOpen && (
                  <div className="notif-dropdown">
                    {rows.length === 0 ? (
                      <button type="button" className="notif-empty">
                        <span className="notif-text">Komunikasi kosong</span>
                      </button>
                    ) : (
                      rows.map((n) => (
                        <div key={n.id} className="notif-item">
                          <div className="notif-item-main">
                            <span className="notif-sender">{n.title}</span>
                            <span className="notif-text">{n.body.slice(0, 80)}{n.body.length > 80 ? '…' : ''}</span>
                            <span className="notif-time">{timeAgo(n.created_at)}</span>
                          </div>
                          <button type="button" className="notif-remove" title="Hapus notifikasi" onClick={() => ackNotif(n.id)}>âœ•</button>
                        </div>
                      ))
                    )}
                  </div>
                )}
                <button type="button" className="header-avatar" title="Profil" onClick={() => onTab('profil')}>
                  <img src={profile.photo_url || defaultPhoto} alt={name} className="header-avatar-img" />
                  {gp && role === 'siswa' && <span className="level-badge">{romanize(gp.level)}</span>}
                </button>
              </div>
            </div>
          </header>
          <main className="shell-main-mobile">{children}</main>
          {showBottomNav && (
            <nav className="shell-mobile-nav">
              {items.slice(0, 5).map((i) => {
                const isActive = tab === i.id;
                return (
                  <button key={i.id} className={isActive ? 'on' : ''} type="button" onClick={() => onTab(i.id)}>
                    <span className="nav-icon-mobile">{getIcon(i.id)}</span>
                    <span>{i.label}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </>
      )}
      {role === 'siswa' && <XpReward onXpAwarded={handleXpAwarded} />}
    </div>
  );
}
