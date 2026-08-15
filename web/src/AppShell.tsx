import { useState } from 'react';

export type Tab =
  | 'beranda'
  | 'latihan'
  | 'simulasi'
  | 'inbox'
  | 'soal'
  | 'paket'
  | 'kelas'
  | 'pengumuman'
  | 'laporan'
  | 'admin'
  | 'profil';

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
};

export function AppShell({
  tab,
  onTab,
  name,
  role,
  children,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  name: string;
  role: string;
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const items: { id: Tab; label: string }[] = [];
  if (role === 'orang_tua') {
    items.push({ id: 'beranda', label: 'Anak' }, { id: 'profil', label: 'Profil' });
  } else {
    items.push(
      { id: 'beranda', label: 'Beranda' },
      { id: 'latihan', label: 'Latihan' },
      { id: 'simulasi', label: 'Simulasi' },
      { id: 'inbox', label: 'Kotak Masuk' },
    );
    if (['guru', 'admin', 'konten'].includes(role)) {
      items.push(
        { id: 'soal', label: 'Soal' },
        { id: 'paket', label: 'Paket' },
        { id: 'kelas', label: 'Kelas' },
        { id: 'pengumuman', label: 'Pengumuman' },
        { id: 'laporan', label: 'Laporan' }
      );
    }
    if (role === 'kepsek' || role === 'siswa') items.push({ id: 'laporan', label: 'Laporan' });
    if (['admin', 'kepsek'].includes(role)) items.push({ id: 'admin', label: 'Admin' });
    items.push({ id: 'profil', label: 'Profil' });
  }

  const isDesktopRole = ['guru', 'admin', 'konten', 'kepsek'].includes(role);

  const getIcon = (id: Tab, isActive: boolean) => {
    const iconKey = id === 'beranda' && role === 'orang_tua' ? 'anak' : id;
    const IconComponent = Icons[iconKey as keyof typeof Icons];
    return IconComponent ? IconComponent(isActive) : null;
  };

  return (
    <div className={`shell ${isDesktopRole ? 'shell-desktop' : 'shell-mobile'} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {isDesktopRole ? (
        <>
          <aside className="shell-sidebar">
            <div className="shell-sidebar-header">
              {!sidebarCollapsed && <strong className="brand">SMART-TKA</strong>}
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? '»' : '«'}
              </button>
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
                    title={sidebarCollapsed ? i.label : undefined}
                  >
                    <span className="nav-icon">{getIcon(i.id, isActive)}</span>
                    {!sidebarCollapsed && <span className="nav-label">{i.label}</span>}
                  </button>
                );
              })}
            </nav>
            <span className="shell-user">
              {sidebarCollapsed ? name.charAt(0).toUpperCase() : `${name} · ${role}`}
            </span>
          </aside>
          <main className="shell-main">{children}</main>
        </>
      ) : (
        <>
          <header className="shell-bar">
            <strong className="brand">SMART-TKA</strong>
            <nav className="shell-nav">
              {items.map((i) => {
                const isActive = tab === i.id;
                return (
                  <button key={i.id} className={isActive ? 'on' : ''} type="button" onClick={() => onTab(i.id)}>
                    <span className="nav-icon-mobile">{getIcon(i.id, isActive)}</span>
                    <span>{i.label}</span>
                  </button>
                );
              })}
            </nav>
            <span className="shell-user">
              {name} · {role}
            </span>
          </header>
          <main className="shell-main-mobile">{children}</main>
        </>
      )}
    </div>
  );
}
