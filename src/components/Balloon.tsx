import { useState, useRef, memo, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type BalloonDirection = "up" | "left" | "right";

interface BalloonProps {
  id: string;
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

const Balloon = memo(forwardRef<HTMLDivElement, BalloonProps>(({
  id: balloonId, label, color, startX, startY, direction, durationMs, swayAmount, swaySpeed,
  onDuckClick, onBalloonClick, onEscaped, selected, correct, hidden,
}, ref) => {
  const colors = BALLOON_COLORS[color] || BALLOON_COLORS.red;
  const [duckState, setDuckState] = useState<DuckState>("riding");
  const [balloonGone, setBalloonGone] = useState(false);
  const escapedRef = useRef(false);

  if (hidden) return null;

  const handleDuckClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (duckState !== "riding") return;
    setDuckState("falling");
    onDuckClick();
    setTimeout(() => setDuckState("gone"), 1000);
  };

  const handleBalloonClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (duckState !== "riding" || balloonGone) return;
    setDuckState("flyingAway");
    setBalloonGone(true);
    onBalloonClick();
    setTimeout(() => setDuckState("gone"), 800);
  };

  const handleTravelAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (hidden || duckState !== "riding" || escapedRef.current || balloonGone) return;
    escapedRef.current = true;
    onEscaped?.();
  };

  const travelAnim = `travel-${balloonId}`;
  const swayAnim = `sway-${balloonId}`;

  let travelKeyframes = '';
  let containerStyle: React.CSSProperties = {};

  if (direction === 'up') {
    containerStyle = { left: `${startX}%`, bottom: '-15%', transform: 'translateX(-50%)' };
    travelKeyframes = `@keyframes ${travelAnim} { from { bottom: -15%; } to { bottom: 120%; } }`;
  } else if (direction === 'left') {
    containerStyle = { right: '-10%', top: `${startY}%` };
    travelKeyframes = `@keyframes ${travelAnim} { from { right: -10%; } to { right: 120%; } }`;
  } else {
    containerStyle = { left: '-10%', top: `${startY}%` };
    travelKeyframes = `@keyframes ${travelAnim} { from { left: -10%; } to { left: 120%; } }`;
  }

  const swayProp = direction === 'up' ? 'translateX' : 'translateY';
  const swayKeyframes = `@keyframes ${swayAnim} { 0%, 100% { transform: ${swayProp}(0px); } 25% { transform: ${swayProp}(${swayAmount}px); } 75% { transform: ${swayProp}(${-swayAmount}px); } }`;

  return (
    <>
      <style>{travelKeyframes}{swayKeyframes}</style>
      <div
        ref={ref}
        className="absolute select-none z-10"
        style={{
          ...containerStyle,
          animation: `${travelAnim} ${durationMs / 1000}s linear forwards`,
        }}
        onAnimationEnd={handleTravelAnimationEnd}
      >
        <div
          style={{
            animation: `${swayAnim} ${swaySpeed}s ease-in-out infinite`,
          }}
        >
          <AnimatePresence>
            {duckState !== "gone" && (
              <motion.div
                className="text-2xl sm:text-3xl md:text-4xl text-center mb-[-4px] relative z-10 cursor-pointer"
                onClick={handleDuckClick}
                onTouchEnd={handleDuckClick}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                animate={
                  duckState === "falling"
                    ? { y: [0, -15, 200], rotate: [0, -20, 120], opacity: [1, 1, 0] }
                    : duckState === "flyingAway"
                      ? { y: -150, x: (Math.random() > 0.5 ? 100 : -100), opacity: 0, scale: 0.5 }
                      : { scale: [1, 1.05, 1] }
                }
                transition={
                  duckState === "falling"
                    ? { duration: 0.8, ease: "easeIn" }
                    : duckState === "flyingAway"
                      ? { duration: 0.6, ease: "easeOut" }
                      : { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }
              >
                {duckState === "falling" ? "😵" : "🦆"}
              </motion.div>
            )}
          </AnimatePresence>

          {!balloonGone && (
            <div
              className="relative w-14 h-16 sm:w-16 sm:h-20 md:w-20 md:h-24 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
              onClick={handleBalloonClick}
              onTouchEnd={handleBalloonClick}
              style={{
                WebkitTapHighlightColor: 'transparent',
                background: `radial-gradient(circle at 35% 30%, ${colors.highlight}, ${colors.balloon})`,
                boxShadow: selected
                  ? `0 0 15px ${colors.balloon}`
                  : `0 4px 10px rgba(0,0,0,0.25)`,
                border: selected ? '3px solid white' : correct === true ? '3px solid hsl(140 70% 50%)' : correct === false ? '3px solid hsl(0 70% 50%)' : '2px solid rgba(255,255,255,0.15)',
                opacity: correct === false ? 0.5 : 1,
              }}
            >
              <div
                className="absolute top-2 left-3 w-3 h-4 sm:w-4 sm:h-5 rounded-full opacity-30"
                style={{ background: 'white' }}
              />
              <span className="text-white font-display font-bold text-sm sm:text-base md:text-lg drop-shadow-lg select-none">
                {label}
              </span>
            </div>
          )}

          {!balloonGone && (
            <div className="w-[2px] h-4 sm:h-5 md:h-6 mx-auto" style={{ background: colors.balloon }} />
          )}
        </div>
      </div>
    </>
  );
}));

Balloon.displayName = 'Balloon';

export default Balloon;
