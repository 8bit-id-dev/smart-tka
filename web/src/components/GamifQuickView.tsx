import { romanize } from '../lib/roman';
import fire from '../assets/icon/fire.gif';

type GpRow = { xp: number; level: number; streak_current: number; streak_best: number };

function xpForLevel(level: number): number {
  return Math.round((50 * level * (level + 1) * (level + 2)) / 6);
}

export function GamifQuickView({ profile }: { profile: GpRow }) {
  const xpCurrent = profile.xp;
  const xpForCurrent = xpForLevel(profile.level);
  const xpForNext = xpForLevel(profile.level + 1);
  const xpToNext = xpForNext - xpCurrent;
  const progressPct = xpForNext - xpForCurrent > 0
    ? Math.round(((xpCurrent - xpForCurrent) / (xpForNext - xpForCurrent)) * 100)
    : 100;

  return (
    <div className="gamif-quickview">
      <div className="gamif-qv-row">
        <div className="gamif-qv-level">
          <div className="gamif-qv-level-badge">{romanize(profile.level)}</div>
          <div>
            <div className="gamif-qv-label">Level {profile.level}</div>
            <div className="gamif-qv-xp">{xpCurrent} / {xpForNext} XP</div>
          </div>
        </div>
        <div className="gamif-qv-streak">
          <img className="gamif-qv-streak-icon" src={fire} alt="Streak" />
          <div>
            <div className="gamif-qv-label">{profile.streak_current} hari</div>
            <div className="gamif-qv-sub">Best: {profile.streak_best}</div>
          </div>
        </div>
      </div>
      <div className="gamif-qv-progress">
        <div className="gamif-qv-progress-bar" style={{ width: `${Math.min(100, progressPct)}%` }} />
      </div>
      {xpToNext > 0 && (
        <div className="gamif-qv-hint">{xpToNext} XP lagi untuk level berikutnya</div>
      )}
    </div>
  );
}
