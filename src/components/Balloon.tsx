import { useRef, useState, memo } from "react";
import { motion } from "framer-motion";

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
  curveAmplitude?: number;
  sinePhase?: number;
  sineFreq?: number;
  staggerMs?: number;
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

// ─── Bézier + Sine curved path keyframe generator ──────────────────────
// Generates multi-step CSS keyframes following a quadratic Bézier curve
// with sine perturbation for organic, game-quality balloon flight.
function generateCurvedKeyframes(
  animName: string,
  direction: BalloonDirection,
  startX: number,
  startY: number,
  curveAmp: number,
  sinePh: number,
  sineFr: number,
): { keyframes: string; initialStyle: React.CSSProperties } {
  const STEPS = 16;
  let p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number;

  if (direction === 'up') {
    p0x = startX; p0y = 115;
    p2x = startX; p2y = -20;
    p1x = startX + curveAmp; p1y = 48;
  } else if (direction === 'left') {
    p0x = 108; p0y = startY;
    p2x = -15; p2y = startY;
    p1x = 50; p1y = startY + curveAmp;
  } else {
    p0x = -12; p0y = startY;
    p2x = 112; p2y = startY;
    p1x = 50; p1y = startY + curveAmp;
  }

  let frames = '';
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const pct = Math.round(t * 100);
    const bezX = (1 - t) ** 2 * p0x + 2 * (1 - t) * t * p1x + t ** 2 * p2x;
    const bezY = (1 - t) ** 2 * p0y + 2 * (1 - t) * t * p1y + t ** 2 * p2y;
    const sinV = Math.sin(t * Math.PI * sineFr + sinePh) * 2.5;
    const x = direction === 'up' ? bezX + sinV : bezX;
    const y = direction === 'up' ? bezY : bezY + sinV;
    frames += `${pct}%{left:${x.toFixed(1)}%;top:${y.toFixed(1)}%}`;
  }

  return {
    keyframes: `@keyframes ${animName}{${frames}}`,
    initialStyle: { left: `${p0x}%`, top: `${p0y}%`, transform: 'translate(-50%,-50%)' },
  };
}

const BalloonComponent = ({
  id: balloonId,
  label,
  color,
  startX,
  startY,
  direction,
  durationMs,
  swayAmount,
  swaySpeed,
  curveAmplitude = 0,
  sinePhase = 0,
  sineFreq = 2,
  staggerMs = 0,
  onDuckClick,
  onBalloonClick,
  onEscaped,
  selected,
  correct,
  hidden,
}: BalloonProps) => {
  const colors = BALLOON_COLORS[color] || BALLOON_COLORS.red;
  const [duckState, setDuckState] = useState<DuckState>("riding");
  const [balloonGone, setBalloonGone] = useState(false);
  const escapedRef = useRef(false);
  const interactionLockedRef = useRef(false);

  if (hidden) return null;

  const handleDuckClick = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button && e.button !== 0) return;
    if (duckState !== "riding" || interactionLockedRef.current) return;

    interactionLockedRef.current = true;
    setDuckState("falling");
    onDuckClick();
    window.setTimeout(() => setDuckState("gone"), 800);
  };

  const handleBalloonClick = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button && e.button !== 0) return;
    if (duckState !== "riding" || balloonGone || interactionLockedRef.current) return;

    interactionLockedRef.current = true;
    setDuckState("flyingAway");
    setBalloonGone(true);
    onBalloonClick();
    window.setTimeout(() => setDuckState("gone"), 650);
  };

  const handleTravelAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (hidden || duckState !== "riding" || escapedRef.current || balloonGone || interactionLockedRef.current) return;

    escapedRef.current = true;
    onEscaped?.();
  };

  const travelAnim = `travel-${balloonId}`;
  const swayAnim = `sway-${balloonId}`;

  const { keyframes: travelKeyframes, initialStyle: containerStyle } = generateCurvedKeyframes(
    travelAnim, direction, startX, startY, curveAmplitude, sinePhase, sineFreq,
  );

  const swayProp = direction === 'up' ? 'translateX' : 'translateY';
  const sa = Math.abs(swayAmount);
  const swayKeyframes = `@keyframes ${swayAnim}{0%,100%{transform:translate(-50%,-50%) ${swayProp}(0px)}20%{transform:translate(-50%,-50%) ${swayProp}(${sa * 0.6}px)}40%{transform:translate(-50%,-50%) ${swayProp}(${-sa * 0.3}px)}60%{transform:translate(-50%,-50%) ${swayProp}(${sa}px)}80%{transform:translate(-50%,-50%) ${swayProp}(${-sa * 0.7}px)}}`;

  const totalDur = durationMs / 1000;
  const delayS = staggerMs / 1000;

  return (
    <>
      <style>{travelKeyframes}{swayKeyframes}</style>
      <div
        className="absolute select-none z-10 will-change-transform"
        style={{
          ...containerStyle,
          animation: `${travelAnim} ${totalDur}s cubic-bezier(0.25,0.1,0.25,1) ${delayS}s both`,
          touchAction: "manipulation",
        }}
        onAnimationEnd={handleTravelAnimationEnd}
      >
        <div
          style={{
            animation: `${swayAnim} ${swaySpeed}s ease-in-out infinite`,
          }}
        >
          {duckState !== "gone" && (
            <motion.div
              className="text-3xl sm:text-3xl md:text-4xl text-center mb-[-4px] relative z-10 cursor-pointer"
              onPointerUp={handleDuckClick}
              style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: "manipulation",
                pointerEvents: duckState === "riding" ? "auto" : "none",
                // Larger invisible tap area on mobile
                padding: '8px',
                margin: '-8px',
              }}
              animate={
                duckState === "falling"
                  ? { y: [0, -15, 200], rotate: [0, -20, 120], opacity: [1, 1, 0] }
                  : duckState === "flyingAway"
                    ? { y: -150, x: -80, opacity: 0, scale: 0.5 }
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

          {!balloonGone && (
            <div
              className="relative w-16 h-[4.5rem] sm:w-16 sm:h-20 md:w-20 md:h-24 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
              onPointerUp={handleBalloonClick}
              style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: "manipulation",
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
};

const Balloon = memo(BalloonComponent, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.label === next.label &&
    prev.color === next.color &&
    prev.startX === next.startX &&
    prev.startY === next.startY &&
    prev.direction === next.direction &&
    prev.durationMs === next.durationMs &&
    prev.swayAmount === next.swayAmount &&
    prev.swaySpeed === next.swaySpeed &&
    prev.selected === next.selected &&
    prev.correct === next.correct &&
  prev.hidden === next.hidden &&
  prev.curveAmplitude === next.curveAmplitude &&
  prev.sinePhase === next.sinePhase &&
  prev.sineFreq === next.sineFreq &&
  prev.staggerMs === next.staggerMs
  );
});

Balloon.displayName = 'Balloon';

export default Balloon;
