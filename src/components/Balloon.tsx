import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BalloonProps {
  label: string;
  color: string;
  x: number;
  durationMs: number;
  onDuckClick: () => void;
  onBalloonClick: () => void;
  onEscaped?: () => void;
  selected?: boolean;
  correct?: boolean | null;
  delay?: number;
  hidden?: boolean;
}

const BALLOON_COLORS: Record<string, { balloon: string; highlight: string }> = {
  red: { balloon: 'hsl(0 75% 55%)', highlight: 'hsl(0 75% 65%)' },
  blue: { balloon: 'hsl(210 80% 55%)', highlight: 'hsl(210 80% 65%)' },
  green: { balloon: 'hsl(140 55% 40%)', highlight: 'hsl(140 55% 50%)' },
  orange: { balloon: 'hsl(25 65% 45%)', highlight: 'hsl(25 65% 55%)' },
  purple: { balloon: 'hsl(270 60% 55%)', highlight: 'hsl(270 60% 65%)' },
  yellow: { balloon: 'hsl(45 95% 55%)', highlight: 'hsl(45 95% 65%)' },
  pink: { balloon: 'hsl(330 70% 55%)', highlight: 'hsl(330 70% 65%)' },
  teal: { balloon: 'hsl(180 60% 40%)', highlight: 'hsl(180 60% 50%)' },
};

const colorKeys = Object.keys(BALLOON_COLORS);

export function getBalloonColor(index: number) {
  return colorKeys[index % colorKeys.length];
}

type DuckState = "riding" | "falling" | "flyingAway" | "gone";

const Balloon = ({ label, color, x, durationMs, onDuckClick, onBalloonClick, onEscaped, selected, correct, delay = 0, hidden }: BalloonProps) => {
  const colors = BALLOON_COLORS[color] || BALLOON_COLORS.red;
  const sway = (x % 2 === 0 ? 1 : -1) * 20;
  const [duckState, setDuckState] = useState<DuckState>("riding");
  const [balloonGone, setBalloonGone] = useState(false);
  const escapedRef = useRef(false);

  // Fire onEscaped when balloon exits the visible screen (not full animation)
  // Balloon travels from 110vh to -120vh (230vh). Exits top at ~110/230 ≈ 48% of duration.
  useEffect(() => {
    if (hidden || duckState !== "riding") return;
    const escapeTime = delay * 1000 + durationMs * 0.42;
    const timer = setTimeout(() => {
      if (!escapedRef.current && onEscaped) {
        escapedRef.current = true;
        onEscaped();
      }
    }, escapeTime);
    return () => clearTimeout(timer);
  }, [durationMs, delay, hidden, onEscaped, duckState]);

  if (hidden) return null;

  const handleDuckClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (duckState !== "riding") return;
    setDuckState("falling");
    onDuckClick();
    setTimeout(() => setDuckState("gone"), 1200);
  };

  const handleBalloonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (duckState !== "riding" || balloonGone) return;
    setDuckState("flyingAway");
    setBalloonGone(true);
    onBalloonClick();
    setTimeout(() => setDuckState("gone"), 1000);
  };

  return (
    <motion.div
      className="absolute bottom-0 select-none"
      style={{ left: `${x}%`, transform: 'translateX(-50%)' }}
      initial={{ y: '110vh' }}
      animate={{ y: '-120vh', x: [0, sway, 0, -sway, 0] }}
      transition={{
        y: { duration: durationMs / 1000, ease: 'linear', delay },
        x: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      {/* Duck */}
      <AnimatePresence>
        {duckState !== "gone" && (
          <motion.div
            className="text-2xl sm:text-3xl md:text-4xl text-center mb-[-4px] relative z-10 cursor-pointer"
            onClick={handleDuckClick}
            whileHover={duckState === "riding" ? { scale: 1.3 } : undefined}
            whileTap={duckState === "riding" ? { scale: 0.8 } : undefined}
            title="Clique no pato!"
            animate={
              duckState === "falling"
                ? { y: [0, -20, 300], rotate: [0, -30, 180], opacity: [1, 1, 0] }
                : duckState === "flyingAway"
                ? { y: -200, x: (Math.random() > 0.5 ? 150 : -150), rotate: 20, opacity: 0, scale: 0.5 }
                : {}
            }
            transition={
              duckState === "falling"
                ? { duration: 1.2, ease: "easeIn" }
                : duckState === "flyingAway"
                ? { duration: 0.8, ease: "easeOut" }
                : undefined
            }
          >
            {duckState === "falling" ? "😵" : "🦆"}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Balloon body */}
      {!balloonGone && (
        <motion.div
          className="relative w-14 h-16 sm:w-16 sm:h-20 md:w-20 md:h-24 lg:w-24 lg:h-28 rounded-full flex items-center justify-center transition-all cursor-pointer"
          onClick={handleBalloonClick}
          style={{
            background: `radial-gradient(circle at 35% 30%, ${colors.highlight}, ${colors.balloon})`,
            boxShadow: selected
              ? `0 0 20px ${colors.balloon}, 0 0 40px ${colors.balloon}`
              : `0 4px 15px rgba(0,0,0,0.3)`,
            border: selected ? '3px solid white' : correct === true ? '3px solid hsl(140 70% 50%)' : correct === false ? '3px solid hsl(0 70% 50%)' : '2px solid rgba(255,255,255,0.2)',
            opacity: correct === false ? 0.5 : 1,
          }}
        >
          <div
            className="absolute top-2 left-3 w-3 h-4 sm:w-4 sm:h-6 rounded-full opacity-40"
            style={{ background: 'white' }}
          />
          <span className="text-white font-display font-bold text-base sm:text-lg md:text-xl lg:text-2xl drop-shadow-lg select-none">
            {label}
          </span>
        </motion.div>
      )}

      {/* String */}
      {!balloonGone && (
        <div className="w-[2px] h-5 sm:h-6 md:h-8 mx-auto" style={{ background: colors.balloon }} />
      )}
    </motion.div>
  );
};

export default Balloon;
