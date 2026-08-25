import { useEffect, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';
import { romanize } from '../lib/roman';
import { FilterSelect } from '../components/FilterSelect';

type GpRow = {
  profile_id: string;
  xp: number;
  level: number;
  streak_current: number;
  streak_best: number;
  full_name: string;
  role: string;
  updated_at?: string;
};

type FilterRange = 'all' | 'month' | 'week';

type ClassRow = { id: string; name: string };

const ROMAN_NUMERALS: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15,
};

function parseClassName(name: string): { roman: string; romanNum: number; num: number } {
  const match = name.match(/^([IVXLCDM]+)(?:\.(\d+))?$/i);
  if (match) {
    const roman = match[1].toUpperCase();
    const num = match[2] ? parseInt(match[2], 10) : 0;
    return { roman, romanNum: ROMAN_NUMERALS[roman] || 0, num };
  }
  return { roman: '', romanNum: 0, num: 0 };
}

function sortClassesByName(classes: ClassRow[]): ClassRow[] {
  return [...classes].sort((a, b) => {
    const parsedA = parseClassName(a.name);
    const parsedB = parseClassName(b.name);
    if (parsedA.romanNum !== parsedB.romanNum) {
      return parsedA.romanNum - parsedB.romanNum;
    }
    return parsedA.num - parsedB.num;
  });
}

function MedalIcon({ rank }: { rank: number }) {
  const medals = [
    { bg: '#FFD700', stroke: '#B8860B', icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
    { bg: '#C0C0C0', stroke: '#808080', icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
    { bg: '#CD7F32', stroke: '#8B4513', icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  ];
  const m = medals[rank];
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-label={`Medali peringkat ${rank + 1}`}>
      <defs>
        <linearGradient id={`medalGrad${rank}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={m.bg} />
          <stop offset="100%" stopColor={m.stroke} />
        </linearGradient>
      </defs>
      <path d={m.icon} fill={`url(#medalGrad${rank})`} stroke={m.stroke} strokeWidth="0.8" />
    </svg>
  );
}

function CrownIcon({ rank }: { rank: number }) {
  const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const strokeColors = ['#B8860B', '#808080', '#8B4513'];
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-label={`Mahkota peringkat ${rank + 1}`}>
      <path
        d="M2 17l3-7 4 4 3-9 3 9 4-4 3 7H2z"
        fill={colors[rank]}
        stroke={strokeColors[rank]}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <circle cx="2" cy="17" r="1.5" fill={colors[rank]} />
      <circle cx="22" cy="17" r="1.5" fill={colors[rank]} />
      <rect x="2" y="18" width="20" height="3" rx="1" fill={colors[rank]} stroke={strokeColors[rank]} strokeWidth="0.5" />
    </svg>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function Leaderboard({ me }: { me: AppProfile }) {
  const [rows, setRows] = useState<GpRow[]>([]);
  const [myGp, setMyGp] = useState<{ xp: number; level: number; streak_current: number } | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filterRange, setFilterRange] = useState<FilterRange>('all');
  const [filterKelas, setFilterKelas] = useState<string>('');
  const [filterMapel, setFilterMapel] = useState<string>('');
  const [filterKind, setFilterKind] = useState<string>('');
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [mapelList, setMapelList] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: gpData, error: gpErr } = await insforge.database
        .from('gamification_profiles')
        .select('xp, level, streak_current, streak_best')
        .eq('profile_id', me.id)
        .single();
      if (!gpErr && gpData) setMyGp(gpData as { xp: number; level: number; streak_current: number; streak_best: number });

      const { data: classesData } = await insforge.database
        .from('classes')
        .select('id, name')
        .eq('school_id', me.school_id);
      if (classesData) setClasses(sortClassesByName(classesData as ClassRow[]));

      const { data: packagesData } = await insforge.database
        .from('packages')
        .select('mapel')
        .eq('school_id', me.school_id);
      if (packagesData) {
        const mapels = [...new Set((packagesData as { mapel: string }[]).map((p) => p.mapel).filter(Boolean))].sort();
        setMapelList(mapels);
      }

      const { data: studentsData, error: studentsErr } = await insforge.database
        .from('profiles')
        .select('id, full_name, role, school_id')
        .eq('school_id', me.school_id)
        .eq('role', 'siswa');

      if (studentsErr) {
        setErr(studentsErr.message);
        setLoading(false);
        return;
      }

      const studentIds = ((studentsData || []) as any[]).map((r) => r.id);
      const gpMap = new Map<string, { xp: number; level: number; streak_current: number; streak_best: number; updated_at?: string }>();
      if (studentIds.length > 0) {
        const { data: gpData } = await insforge.database
          .from('gamification_profiles')
          .select('profile_id, xp, level, streak_current, streak_best, updated_at')
          .in('profile_id', studentIds);
        if (gpData) {
          for (const gp of gpData as any[]) {
            gpMap.set(gp.profile_id, gp);
          }
        }
      }

      let mapped = ((studentsData || []) as any[]).map((r) => {
        const gp = gpMap.get(r.id);
        return {
          profile_id: r.id,
          xp: gp?.xp ?? 0,
          level: gp?.level ?? 1,
          streak_current: gp?.streak_current ?? 0,
          streak_best: gp?.streak_best ?? 0,
          full_name: r.full_name ?? 'Pengguna',
          role: r.role ?? 'siswa',
          updated_at: gp?.updated_at,
        };
      });

      if (filterRange === 'month') {
        const since = new Date();
        since.setMonth(since.getMonth() - 1);
        mapped = mapped.filter((r) => !r.updated_at || new Date(r.updated_at) >= since);
      } else if (filterRange === 'week') {
        const since = new Date();
        since.setDate(since.getDate() - 7);
        mapped = mapped.filter((r) => !r.updated_at || new Date(r.updated_at) >= since);
      }

      if (filterKelas) {
        const { data: csData } = await insforge.database
          .from('class_students')
          .select('profile_id')
          .eq('class_id', filterKelas);
        if (csData) {
          const studentIds = new Set((csData as { profile_id: string }[]).map((s) => s.profile_id));
          mapped = mapped.filter((r) => studentIds.has(r.profile_id));
        }
      }

      if (filterMapel) {
        const { data: attemptsData } = await insforge.database
          .from('attempts')
          .select('student_id, package_id, packages!inner(mapel)')
          .eq('packages.mapel', filterMapel);
        if (attemptsData) {
          const studentIds = new Set((attemptsData as { student_id: string }[]).map((a) => a.student_id));
          mapped = mapped.filter((r) => studentIds.has(r.profile_id));
        }
      }

      if (filterKind) {
        const { data: attemptsData } = await insforge.database
          .from('attempts')
          .select('student_id, package_id, packages!inner(kind)')
          .eq('packages.kind', filterKind);
        if (attemptsData) {
          const studentIds = new Set((attemptsData as { student_id: string }[]).map((a) => a.student_id));
          mapped = mapped.filter((r) => studentIds.has(r.profile_id));
        }
      }

      mapped.sort((a, b) => b.xp - a.xp);

      setRows(mapped);

      const idx = mapped.findIndex((r) => r.profile_id === me.id);
      setMyRank(idx >= 0 ? idx + 1 : null);
      setLoading(false);
    })();
  }, [me.id, me.school_id, filterRange, filterKelas, filterMapel, filterKind]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="card">
          <p style={{ margin: 0, color: 'var(--muted)' }}>Memuat peringkat…</p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="dashboard-page">
        <div className="banner banner-danger">
          <p className="banner-text">{err}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <p className="page-subtitle">Peringkat kelas / sekolah</p>
        <h1 className="page-title">Papan Peringkat SMART-TKA</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {myGp && <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 'auto' }}>💰 {myGp.xp} XP</span>}
        </div>
        <p className="page-subtitle" style={{ maxWidth: 500 }}>
          Bergaullah dengan belajar rutin. XP dan level naik otomatis saat menyelesaikan latihan dan simulasi.
        </p>
      </header>

      <section className="section">
        <div className="leaderboard-filters">
              <div className="filter-group">
                <span className="filter-label">Periode:</span>
                <FilterSelect
                  value={filterRange}
                  onChange={(v) => setFilterRange(v as FilterRange)}
                  placeholder="Semua Waktu"
                  options={[
                    { value: 'all', label: 'Semua Waktu' },
                    { value: 'month', label: 'Bulan Ini' },
                    { value: 'week', label: 'Minggu Ini' },
                  ]}
                />
              </div>
              <div className="filter-group">
                <span className="filter-label">Kelas:</span>
                <FilterSelect
                  value={filterKelas}
                  onChange={setFilterKelas}
                  placeholder="Semua Kelas"
                  options={classes.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
              <div className="filter-group">
                <span className="filter-label">Mapel:</span>
                <FilterSelect
                  value={filterMapel}
                  onChange={setFilterMapel}
                  placeholder="Semua Mapel"
                  options={mapelList.map((m) => ({ value: m, label: m }))}
                />
              </div>
              <div className="filter-group">
                <span className="filter-label">Jenis:</span>
                <FilterSelect
                  value={filterKind}
                  onChange={setFilterKind}
                  placeholder="Semua Jenis"
                  options={[
                    { value: 'latihan', label: 'Latihan' },
                    { value: 'simulasi', label: 'Simulasi' },
                    { value: 'ujian_kelas', label: 'Ujian' },
                  ]}
                />
              </div>
            </div>
          </section>

          {rows.length > 0 && (
        <section className="section">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {myRank !== null && (
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--accent-light)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  #{myRank}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{getInitials(me.full_name ?? '')}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{me.full_name}</span>
                    {myGp && <span className="level-badge">{romanize(myGp.level)}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {myGp?.xp ?? 0} XP · {myGp?.streak_current ?? 0} hari streak
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 8, boxShadow: 'var(--shadow-sm)' }}>
            {rows.map((r, i) => {
              const isMe = r.profile_id === me.id;
              const isTop3 = i < 3;
              return (
                <div
                  key={r.profile_id}
                  className={`leaderboard-row ${isTop3 ? 'leaderboard-row-top' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: i === rows.length - 1 ? 0 : 'var(--radius-sm)',
                    background: isMe ? 'var(--accent-soft)' : isTop3 ? 'var(--gold-soft, #fffbeb)' : undefined,
                    margin: i === rows.length - 1 ? '0' : '0 0 4px',
                  }}
                >
                  <div style={{ width: 36, height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isTop3 ? <CrownIcon rank={i} /> : <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>#{i + 1}</span>}
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: isMe ? 'var(--accent)' : isTop3 ? 'var(--gold, #f59e0b)' : 'var(--accent-soft)', color: isMe || isTop3 ? '#fff' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                    {getInitials(r.full_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.full_name}</span>
                      <span className="level-badge">{romanize(r.level)}</span>
                      {isTop3 && <MedalIcon rank={i} />}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {r.xp} XP · streak {r.streak_best}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isTop3 ? 'var(--gold, #f59e0b)' : 'var(--accent)', textAlign: 'right' }}>
                    {r.xp}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {rows.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <h3 className="empty-state-title">Belum ada peringkat</h3>
          <p className="empty-state-text">Jadilah yang pertama menyelesaikan latihan atau simulasi untuk masuk ke papan peringkat.</p>
        </div>
      )}
    </div>
  );
}
