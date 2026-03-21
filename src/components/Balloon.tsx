import { motion } from "framer-motion";

interface BalloonProps {
  label: string;
  color: string;
  x: number; // percentage 0-100
  durationMs: number;
  onClick: () => void;
  selected?: boolean;
  correct?: boolean | null; // null = not revealed
  delay?: number;
}

const BALLOON_COLORS: Record<string, { balloon: string; highlight: string }> = {
  red: { balloon: 'hsl(0 75% 55%)', highlight: 'hsl(0 75% 65%)' },
  blue: { balloon: 'hsl(210 80% 55%)', highlight: 'hsl(210 80% 65%)' },
  green: { balloon: 'hsl(140 55% 40%)', highlight: 'hsl(140 55% 50%)' },
  orange: { balloon: 'hsl(25 65% 45%)', highlight: 'hsl(25 65% 55%)' },
  purple: { balloon: 'hsl(270 60% 55%)', highlight: 'hsl(270 60% 65%)' },
  yellow: { balloon: 'hsl(45 95% 55%)', highlight: 'hsl(45 95% 65%)' },
};

const colorKeys = Object.keys(BALLOON_COLORS);

export function getBalloonColor(index: number) {
  return colorKeys[index % colorKeys.length];
}

const Balloon = ({ label, color, x, durationMs, onClick, selected, correct, delay = 0 }: BalloonProps) => {
  const colors = BALLOON_COLORS[color] || BALLOON_COLORS.red;
  const sway = (x % 2 === 0 ? 1 : -1) * 20;

  return (
    <motion.div
      className="absolute bottom-0 cursor-pointer select-none"
      style={{ left: `${x}%`, transform: 'translateX(-50%)' }}
      initial={{ y: '110vh' }}
      animate={{ y: '-120vh', x: [0, sway, 0, -sway, 0] }}
      transition={{
        y: { duration: durationMs / 1000, ease: 'linear', delay },
        x: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
      }}
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      {/* Duck on top */}
      <div className="text-3xl md:text-4xl text-center mb-[-4px] relative z-10">
        🦆
      </div>
      {/* Balloon */}
      <div
        className="relative w-20 h-24 md:w-24 md:h-28 rounded-full flex items-center justify-center transition-all"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${colors.highlight}, ${colors.balloon})`,
          boxShadow: selected
            ? `0 0 20px ${colors.balloon}, 0 0 40px ${colors.balloon}`
            : `0 4px 15px rgba(0,0,0,0.3)`,
          border: selected ? '3px solid white' : correct === true ? '3px solid hsl(140 70% 50%)' : correct === false ? '3px solid hsl(0 70% 50%)' : '2px solid rgba(255,255,255,0.2)',
          opacity: correct === false ? 0.5 : 1,
        }}
      >
        {/* Shine */}
        <div
          className="absolute top-3 left-4 w-4 h-6 rounded-full opacity-40"
          style={{ background: 'white' }}
        />
        {/* Label */}
        <span className="text-white font-display font-bold text-xl md:text-2xl drop-shadow-lg select-none">
          {label}
        </span>
      </div>
      {/* String */}
      <div className="w-[2px] h-8 mx-auto" style={{ background: colors.balloon }} />
    </motion.div>
  );
};

export default Balloon;
