import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type BalloonDirection = "up" | "left" | "right";

interface BalloonProps {
  label: string;
  color: string;
  startX: number;
  startY: number;
  direction: BalloonDirection;
  durationMs: number;
  swayAmount: number;
  swaySpeed: number;
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
  coral: { balloon: 'hsl(15 80% 55%)', highlight: 'hsl(15 80% 65%)' },
  lime: { balloon: 'hsl(85 60% 45%)', highlight: 'hsl(85 60% 55%)' },
  indigo: { balloon: 'hsl(240 60% 55%)', highlight: 'hsl(240 60% 65%)' },
  amber: { balloon: 'hsl(35 90% 50%)', highlight: 'hsl(35 90% 60%)' },
  rose: { balloon: 'hsl(350 75% 55%)', highlight: 'hsl(350 75% 65%)' },
  sky: { balloon: 'hsl(195 75% 50%)', highlight: 'hsl(195 75% 60%)' },
  emerald: { balloon: 'hsl(160 60% 40%)', highlight: 'hsl(160 60% 50%)' },
  fuchsia: { balloon: 'hsl(295 65% 55%)', highlight: 'hsl(295 65% 65%)' },
};

const colorKeys = Object.keys(BALLOON_COLORS);

export function getBalloonColor(index: number) {
  return colorKeys[index % colorKeys.length];
}

type DuckState = "riding" | "falling" | "flyingAway" | "gone";

function getAnimationProps(direction: BalloonDirection, startX: number, startY: number, swayAmount: number, swaySpeed: number) {
  switch (direction) {
    case "up":
      return {
        initial: { x: 0, y: 0 },
        animate: { y: '-120vh', x: [0, swayAmount, 0, -swayAmount, 0] },
        xTransition: { duration: swaySpeed, repeat: Infinity, ease: 'easeInOut' as const },
      };
    case "left":
      return {
        initial: { x: 0, y: 0 },
        animate: { x: '-120vw', y: [0, -swayAmount * 2, 0, swayAmount * 2, 0] },
        xTransition: undefined,
        ySwayTransition: { duration: swaySpeed, repeat: Infinity, ease: 'easeInOut' as const },
      };
    case "right":
      return {
        initial: { x: 0, y: 0 },
        animate: { x: '120vw', y: [0, -swayAmount * 2, 0, swayAmount * 2, 0] },
        xTransition: undefined,
        ySwayTransition: { duration: swaySpeed, repeat: Infinity, ease: 'easeInOut' as const },
      };
  }
}

const Balloon = ({
  label, color, startX, startY, direction, durationMs, swayAmount, swaySpeed,
  onDuckClick, onBalloonClick, onEscaped, selected, correct, delay = 0, hidden
}: BalloonProps) => {
  const colors = BALLOON_COLORS[color] || BALLOON_COLORS.red;
  const [duckState, setDuckState] = useState<DuckState>("riding");
  const [balloonGone, setBalloonGone] = useState(false);
  const escapedRef = useRef(false);

  // Fire onEscaped when balloon exits visible area
  useEffect(() => {
    if (hidden || duckState !== "riding") return;
    // Balloon exits at ~45% of duration
    const escapeTime = delay * 1000 + durationMs * 0.45;
    const timer = setTimeout(() => {
      if (!escapedRef.current && onEscaped) {
        escapedRef.current = true;
        onEscaped();
      }
    }, escapeTime);
    return () => clearTimeout(timer);
  }, [durationMs, delay, hidden, onEscaped, duckState]);

  if (hidden) return null;

  const handleDuckClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (duckState !== "riding") return;
    setDuckState("falling");
    onDuckClick();
    setTimeout(() => setDuckState("gone"), 1200);
  };

  const handleBalloonClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (duckState !== "riding" || balloonGone) return;
    setDuckState("flyingAway");
    setBalloonGone(true);
    onBalloonClick();
    setTimeout(() => setDuckState("gone"), 1000);
  };

  const anim = getAnimationProps(direction, startX, startY, swayAmount, swaySpeed);

  const mainTransition: Record<string, any> = {};
  if (direction === "up") {
    mainTransition.y = { duration: durationMs / 1000, ease: 'linear', delay };
    mainTransition.x = anim.xTransition;
  } else if (direction === "left" || direction === "right") {
    mainTransition.x = { duration: durationMs / 1000, ease: 'linear', delay };
    mainTransition.y = anim.ySwayTransition;
  }

  // Position: for "up", start from bottom. For left/right, start from the side.
  const positionStyle: React.CSSProperties = {};
  if (direction === "up") {
    positionStyle.left = `${startX}%`;
    positionStyle.bottom = `${startY}%`;
    positionStyle.transform = 'translateX(-50%)';
  } else if (direction === "left") {
    positionStyle.right = '-5%';
    positionStyle.top = `${startY}%`;
  } else if (direction === "right") {
    positionStyle.left = '-5%';
    positionStyle.top = `${startY}%`;
  }

  return (
    <motion.div
      className="absolute select-none z-10"
      style={positionStyle}
      initial={anim.initial}
      animate={anim.animate}
      transition={mainTransition}
    >
      {/* Duck */}
      <AnimatePresence>
        {duckState !== "gone" && (
          <motion.div
            className="text-2xl sm:text-3xl md:text-4xl text-center mb-[-4px] relative z-10 cursor-pointer"
            onClick={handleDuckClick}
            onTouchEnd={handleDuckClick}
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
          onTouchEnd={handleBalloonClick}
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
