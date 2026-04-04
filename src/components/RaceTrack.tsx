import { memo } from "react";
import { motion } from "framer-motion";

interface RacerData {
  id: string;
  name: string;
  color: string;
  progress: number; // 0–100
  isMe?: boolean;
}

interface RaceTrackProps {
  racers: RacerData[];
}

// Three distinct Fusca/VW Beetle SVG designs
const FuscaDesigns = [
  // Design 1 — Classic rounded Beetle
  ({ color, accent }: { color: string; accent: string }) => (
    <svg viewBox="0 0 120 60" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <path d="M15 40 Q15 20 40 15 Q60 10 80 15 Q105 20 105 40 Z" fill={color} />
      {/* Roof */}
      <path d="M35 20 Q50 5 75 10 Q85 12 85 20" fill={accent} stroke={color} strokeWidth="1" />
      {/* Windows */}
      <path d="M40 18 Q50 10 65 12 L65 22 Q52 20 40 22 Z" fill="hsl(200 80% 85%)" opacity="0.8" />
      <path d="M68 12 Q78 14 80 20 L80 22 L68 22 Z" fill="hsl(200 80% 85%)" opacity="0.8" />
      {/* Headlight */}
      <circle cx="102" cy="32" r="4" fill="hsl(50 100% 80%)" />
      {/* Bumper */}
      <rect x="106" y="28" width="4" height="12" rx="2" fill="hsl(0 0% 75%)" />
      {/* Fender lines */}
      <path d="M25 40 Q25 32 35 30" fill="none" stroke={accent} strokeWidth="1.5" />
      <path d="M95 40 Q95 32 85 30" fill="none" stroke={accent} strokeWidth="1.5" />
      {/* Racing stripe */}
      <rect x="30" y="25" width="55" height="3" rx="1.5" fill="white" opacity="0.4" />
      {/* Racing number circle */}
      <circle cx="60" cy="32" r="8" fill="white" opacity="0.9" />
      {/* Wheels */}
      <circle cx="32" cy="44" r="8" fill="hsl(0 0% 20%)" />
      <circle cx="32" cy="44" r="4" fill="hsl(0 0% 50%)" />
      <circle cx="32" cy="44" r="2" fill="hsl(0 0% 70%)" />
      <circle cx="88" cy="44" r="8" fill="hsl(0 0% 20%)" />
      <circle cx="88" cy="44" r="4" fill="hsl(0 0% 50%)" />
      <circle cx="88" cy="44" r="2" fill="hsl(0 0% 70%)" />
      {/* Exhaust */}
      <rect x="8" y="36" width="8" height="3" rx="1.5" fill="hsl(0 0% 60%)" />
    </svg>
  ),
  // Design 2 — Sporty Beetle with spoiler
  ({ color, accent }: { color: string; accent: string }) => (
    <svg viewBox="0 0 120 60" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Spoiler */}
      <rect x="8" y="18" width="14" height="3" rx="1" fill={accent} />
      <rect x="12" y="18" width="3" height="10" rx="1" fill={accent} />
      {/* Body — lower, sportier */}
      <path d="M18 42 Q18 24 45 18 Q65 14 85 18 Q108 24 108 42 Z" fill={color} />
      {/* Roof — flatter */}
      <path d="M42 22 Q55 12 72 14 Q82 16 82 22" fill={accent} stroke={color} strokeWidth="1" />
      {/* Windows */}
      <path d="M46 20 Q55 14 64 15 L64 24 Q55 22 46 24 Z" fill="hsl(200 80% 85%)" opacity="0.8" />
      <path d="M67 15 Q76 17 78 22 L78 24 L67 24 Z" fill="hsl(200 80% 85%)" opacity="0.8" />
      {/* Headlight — angular */}
      <rect x="104" y="28" width="6" height="6" rx="2" fill="hsl(50 100% 80%)" />
      {/* Dual racing stripes */}
      <rect x="30" y="26" width="55" height="2" rx="1" fill="white" opacity="0.5" />
      <rect x="30" y="30" width="55" height="2" rx="1" fill="white" opacity="0.5" />
      {/* Number */}
      <circle cx="60" cy="36" r="7" fill="white" opacity="0.9" />
      {/* Wheels — bigger */}
      <circle cx="35" cy="46" r="9" fill="hsl(0 0% 18%)" />
      <circle cx="35" cy="46" r="5" fill="hsl(0 0% 45%)" />
      <circle cx="35" cy="46" r="2" fill="hsl(0 0% 65%)" />
      <circle cx="90" cy="46" r="9" fill="hsl(0 0% 18%)" />
      <circle cx="90" cy="46" r="5" fill="hsl(0 0% 45%)" />
      <circle cx="90" cy="46" r="2" fill="hsl(0 0% 65%)" />
    </svg>
  ),
  // Design 3 — Retro Beetle with flower/peace vibe
  ({ color, accent }: { color: string; accent: string }) => (
    <svg viewBox="0 0 120 60" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Body — extra round */}
      <path d="M12 40 Q12 18 42 12 Q60 8 78 12 Q108 18 108 40 Z" fill={color} />
      {/* Roof — tall */}
      <path d="M32 16 Q48 2 70 6 Q82 10 82 18" fill={accent} stroke={color} strokeWidth="1" />
      {/* Windows — big round */}
      <ellipse cx="52" cy="16" rx="14" ry="8" fill="hsl(200 80% 85%)" opacity="0.8" />
      <ellipse cx="74" cy="18" rx="7" ry="6" fill="hsl(200 80% 85%)" opacity="0.8" />
      {/* Headlight — round vintage */}
      <circle cx="104" cy="30" r="5" fill="hsl(50 100% 80%)" />
      <circle cx="104" cy="30" r="3" fill="hsl(50 100% 90%)" />
      {/* Decorative star */}
      <text x="55" y="36" fontSize="14" textAnchor="middle" fill="white" opacity="0.7">★</text>
      {/* Bumpers */}
      <rect x="5" y="34" width="8" height="4" rx="2" fill="hsl(0 0% 72%)" />
      <rect x="108" y="34" width="6" height="4" rx="2" fill="hsl(0 0% 72%)" />
      {/* Wheels — whitewall style */}
      <circle cx="30" cy="44" r="8" fill="hsl(0 0% 20%)" />
      <circle cx="30" cy="44" r="6" fill="hsl(0 0% 92%)" />
      <circle cx="30" cy="44" r="4" fill="hsl(0 0% 20%)" />
      <circle cx="30" cy="44" r="2" fill="hsl(0 0% 60%)" />
      <circle cx="86" cy="44" r="8" fill="hsl(0 0% 20%)" />
      <circle cx="86" cy="44" r="6" fill="hsl(0 0% 92%)" />
      <circle cx="86" cy="44" r="4" fill="hsl(0 0% 20%)" />
      <circle cx="86" cy="44" r="2" fill="hsl(0 0% 60%)" />
    </svg>
  ),
];

// Map player color strings to car paint colors
function getCarColors(playerColor: string, designIndex: number) {
  // darken a bit for the accent
  return { color: playerColor, accent: playerColor.replace(/\d+%\)$/, (m) => `${Math.max(10, parseInt(m) - 15)}%)`) };
}

const FuscaCar = memo(({ racer, index }: { racer: RacerData; index: number }) => {
  const designIndex = index % FuscaDesigns.length;
  const Design = FuscaDesigns[designIndex];
  const { color, accent } = getCarColors(racer.color, designIndex);
  const position = racer.progress; // 0–100

  return (
    <div className="relative h-20 sm:h-24">
      {/* Track lane */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 rounded-lg bg-muted/30 border border-border/30 overflow-hidden">
        {/* Road markings */}
        <div className="absolute inset-0 flex items-center">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="h-[2px] bg-border/40 mx-1"
              style={{ width: "20px", flexShrink: 0 }}
            />
          ))}
        </div>
        {/* Finish line */}
        <div className="absolute right-2 top-0 bottom-0 w-3 flex flex-col">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 ${i % 2 === 0 ? "bg-foreground/80" : "bg-background"}`}
              style={{ width: "50%" }}
            />
          ))}
        </div>
      </div>

      {/* Car container */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 z-10"
        style={{ width: "70px", height: "40px" }}
        animate={{ left: `calc(${Math.min(position, 95)}% - 35px)` }}
        transition={{ type: "spring", stiffness: 80, damping: 20 }}
      >
        <Design color={color} accent={accent} />
        {/* Exhaust smoke when moving */}
        {position > 0 && position < 100 && (
          <motion.div
            className="absolute -left-3 top-1/2 -translate-y-1/2"
            animate={{ opacity: [0.4, 0, 0.3, 0], x: [-2, -12], scale: [0.5, 1.5] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeOut" }}
          >
            <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
          </motion.div>
        )}
      </motion.div>

      {/* Player name label */}
      <motion.div
        className="absolute -top-1 z-20 flex items-center gap-1"
        animate={{ left: `calc(${Math.min(position, 95)}% - 35px)` }}
        transition={{ type: "spring", stiffness: 80, damping: 20 }}
      >
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full truncate max-w-[80px] ${
            racer.isMe
              ? "bg-primary text-primary-foreground"
              : "bg-card text-card-foreground border border-border"
          }`}
        >
          {racer.name}
        </span>
      </motion.div>
    </div>
  );
});

FuscaCar.displayName = "FuscaCar";

const RaceTrack = ({ racers }: RaceTrackProps) => {
  if (racers.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mb-6">
      <div className="glass-card p-4 space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-foreground">🏁 Corrida de Fuscas</span>
        </div>
        {racers.map((racer, i) => (
          <FuscaCar key={racer.id} racer={racer} index={i} />
        ))}
      </div>
    </div>
  );
};

export default memo(RaceTrack);
