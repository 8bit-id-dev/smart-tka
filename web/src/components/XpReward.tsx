import { useEffect, useState } from 'react';

type XpToast = {
  id: number;
  xp: number;
  x: number;
  y: number;
  label?: string;
};

type AchievementToast = {
  id: number;
  title: string;
  icon: string;
};

type LevelUpToast = {
  id: number;
  oldLevel: number;
  newLevel: number;
  xp: number;
};

export function XpReward({
  onXpAwarded,
}: {
  onXpAwarded: (xp: number, label?: string) => Promise<{ levelUp?: { old: number; new: number }; newAchievement?: { title: string; icon: string } } | null>;
}) {
  const [xpToasts, setXpToasts] = useState<XpToast[]>([]);
  const [achToasts, setAchToasts] = useState<AchievementToast[]>([]);
  const [lvlToasts, setLvlToasts] = useState<LevelUpToast[]>([]);
  const counter = useState(0)[0];

  async function showXp(xp: number, label?: string, x?: number, y?: number) {
    const id = counter + 1;
    const toast: XpToast = {
      id,
      xp,
      x: x ?? Math.random() * 200 + 100,
      y: y ?? 100,
      label,
    };
    setXpToasts((prev) => [...prev, toast]);

    setTimeout(() => {
      setXpToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2000);

    const result = await onXpAwarded(xp, label);
    if (result?.levelUp) {
      const lid = counter + 2;
      setLvlToasts((prev) => [
        ...prev,
        { id: lid, oldLevel: result.levelUp!.old, newLevel: result.levelUp!.new, xp: 0 },
      ]);
      setTimeout(() => {
        setLvlToasts((prev) => prev.filter((t) => t.id !== lid));
      }, 4000);
    }
    if (result?.newAchievement) {
      const aid = counter + 3;
      setAchToasts((prev) => [
        ...prev,
        { id: aid, title: result.newAchievement!.title, icon: result.newAchievement!.icon },
      ]);
      setTimeout(() => {
        setAchToasts((prev) => prev.filter((t) => t.id !== aid));
      }, 3000);
    }
  }

  // Expose showXp globally for parent components
  useEffect(() => {
    (window as any).__showXpReward = showXp;
  }, []);

  return (
    <>
      {xpToasts.map((t) => (
        <div
          key={`xp-${t.id}`}
          className="xp-toast"
          style={{
            left: t.x,
            top: t.y,
            transform: 'translateY(0)',
          }}
        >
          <span className="xp-toast-amount">+{t.xp} XP</span>
          {t.label && <span className="xp-toast-label">{t.label}</span>}
          <div className="xp-toast-confetti">
            <span>✨</span>
            <span>⭐</span>
            <span>🎯</span>
          </div>
        </div>
      ))}

      {achToasts.map((t) => (
        <div key={`ach-${t.id}`} className="ach-toast">
          <span className="ach-toast-icon">{t.icon}</span>
          <div className="ach-toast-content">
            <span className="ach-toast-title">Pencapaian Terbuka!</span>
            <span className="ach-toast-desc">{t.title}</span>
          </div>
        </div>
      ))}

      {lvlToasts.map((t) => (
        <div key={`lvl-${t.id}`} className="lvl-toast-backdrop">
          <div className="lvl-toast">
            <div className="lvl-toast-confetti">🎊</div>
            <h3 className="lvl-toast-title">SELAMAT NAik LEVEL!</h3>
            <div className="lvl-toast-level">
              <span className="lvl-old">L{t.oldLevel}</span>
              <span className="lvl-arrow">→</span>
              <span className="lvl-new">L{t.newLevel}</span>
            </div>
            <p className="lvl-toast-text">XP kamu terus bertambah. Pertahankan!</p>
          </div>
        </div>
      ))}
    </>
  );
}
