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
  const items: { id: Tab; label: string }[] = [];
  if (role === 'orang_tua') {
    items.push({ id: 'beranda', label: 'Anak' }, { id: 'profil', label: 'Profil' });
  } else {
    items.push(
      { id: 'beranda', label: 'Beranda' },
      { id: 'latihan', label: 'Latihan' },
      { id: 'simulasi', label: 'Simulasi' },
      { id: 'inbox', label: 'Kotak masuk' },
    );
    if (['guru', 'admin', 'konten'].includes(role)) {
      items.push({ id: 'soal', label: 'Soal' }, { id: 'paket', label: 'Paket' }, { id: 'kelas', label: 'Kelas' }, { id: 'pengumuman', label: 'Pengumuman' }, { id: 'laporan', label: 'Laporan' });
    }
    if (role === 'kepsek') items.push({ id: 'laporan', label: 'Laporan' });
    if (['admin', 'kepsek'].includes(role)) items.push({ id: 'admin', label: 'Admin' });
    items.push({ id: 'profil', label: 'Profil' });
  }

  return (
    <div className="shell">
      <header className="shell-bar">
        <strong className="brand">SMART-TKA</strong>
        <nav className="shell-nav">
          {items.map((i) => (
            <button key={i.id} className={tab === i.id ? 'on' : ''} type="button" onClick={() => onTab(i.id)}>
              {i.label}
            </button>
          ))}
        </nav>
        <span className="shell-user">
          {name} · {role}
        </span>
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}
