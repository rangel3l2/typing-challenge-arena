import { memo } from "react";
import { motion } from "framer-motion";

interface SoloBicycleProps {
  progress: number; // 0-100
  playerName: string;
  playerColor: string;
}

const SoloBicycle = ({ progress, playerName, playerColor }: SoloBicycleProps) => {
  return (
    <div className="w-full max-w-4xl mx-auto mb-2">
      <div className="glass-card p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-foreground">🚴 Pedalando...</span>
          <span className="text-xs text-muted-foreground font-body">{Math.round(progress)}%</span>
        </div>

        <div className="relative h-20">
          {/* Track */}
          <div className="absolute inset-x-0 bottom-4 h-1 bg-muted/50 rounded-full">
            <div
              className="h-full bg-primary/30 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Road markings */}
          <div className="absolute inset-x-0 bottom-[18px] flex items-center gap-3 px-2">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="h-[2px] w-4 bg-border/30 shrink-0" />
            ))}
          </div>

          {/* Finish flag */}
          <div className="absolute right-2 bottom-2 text-lg">🏁</div>

          {/* Bicycle */}
          <motion.div
            className="absolute bottom-1 z-10"
            style={{ width: 64, height: 56 }}
            animate={{ left: `calc(${Math.min(progress, 92)}% - 32px)` }}
            transition={{ type: "spring", stiffness: 80, damping: 20 }}
          >
            <svg viewBox="0 0 80 70" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              {/* Back wheel */}
              <circle cx="18" cy="52" r="12" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2.5" />
              <circle cx="18" cy="52" r="3" fill="hsl(var(--muted-foreground))" />
              {/* Spokes back */}
              <motion.g
                animate={{ rotate: progress > 0 ? 360 : 0 }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "18px 52px" }}
              >
                <line x1="18" y1="40" x2="18" y2="64" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
                <line x1="6" y1="52" x2="30" y2="52" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
                <line x1="10" y1="44" x2="26" y2="60" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
                <line x1="10" y1="60" x2="26" y2="44" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
              </motion.g>

              {/* Front wheel */}
              <circle cx="62" cy="52" r="12" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2.5" />
              <circle cx="62" cy="52" r="3" fill="hsl(var(--muted-foreground))" />
              {/* Spokes front */}
              <motion.g
                animate={{ rotate: progress > 0 ? 360 : 0 }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "62px 52px" }}
              >
                <line x1="62" y1="40" x2="62" y2="64" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
                <line x1="50" y1="52" x2="74" y2="52" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
                <line x1="54" y1="44" x2="70" y2="60" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
                <line x1="54" y1="60" x2="70" y2="44" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
              </motion.g>

              {/* Frame */}
              <polyline points="18,52 36,36 62,52" fill="none" stroke={playerColor} strokeWidth="2.5" strokeLinejoin="round" />
              <line x1="36" y1="36" x2="52" y2="36" stroke={playerColor} strokeWidth="2.5" />
              <line x1="52" y1="36" x2="62" y2="52" stroke={playerColor} strokeWidth="2.5" />
              <line x1="36" y1="36" x2="36" y2="48" stroke={playerColor} strokeWidth="2" />

              {/* Seat */}
              <rect x="32" y="33" width="10" height="3" rx="1.5" fill="hsl(var(--foreground))" />

              {/* Handlebar */}
              <line x1="52" y1="36" x2="56" y2="30" stroke="hsl(var(--foreground))" strokeWidth="2" />
              <line x1="53" y1="30" x2="59" y2="30" stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round" />

              {/* Pedals - animated */}
              <motion.g
                animate={{ rotate: progress > 0 ? 360 : 0 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "36px 48px" }}
              >
                <circle cx="36" cy="48" r="2" fill="hsl(var(--muted-foreground))" />
                <line x1="36" y1="48" x2="36" y2="54" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                <line x1="36" y1="48" x2="36" y2="42" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
              </motion.g>

              {/* Rider body */}
              <circle cx="38" cy="22" r="6" fill={playerColor} />
              <text x="38" y="25" textAnchor="middle" fontSize="8" fill="hsl(var(--foreground))" fontWeight="bold">
                {playerName[0]}
              </text>
              {/* Body */}
              <line x1="38" y1="28" x2="36" y2="36" stroke={playerColor} strokeWidth="2.5" />
              {/* Arms */}
              <line x1="38" y1="30" x2="52" y2="34" stroke={playerColor} strokeWidth="2" />

              {/* Legs animated */}
              <motion.g
                animate={{ rotate: progress > 0 ? 360 : 0 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "36px 48px" }}
              >
                <line x1="36" y1="36" x2="36" y2="54" stroke={playerColor} strokeWidth="2" />
              </motion.g>
            </svg>

            {/* Wind lines when moving */}
            {progress > 0 && progress < 100 && (
              <motion.div
                className="absolute -left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1"
                animate={{ opacity: [0.3, 0, 0.3], x: [-2, -10] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              >
                <div className="w-4 h-[1px] bg-muted-foreground/30" />
                <div className="w-3 h-[1px] bg-muted-foreground/20" />
                <div className="w-5 h-[1px] bg-muted-foreground/30" />
              </motion.div>
            )}
          </motion.div>

          {/* Name tag */}
          <motion.div
            className="absolute top-0 z-20"
            animate={{ left: `calc(${Math.min(progress, 92)}% - 32px)` }}
            transition={{ type: "spring", stiffness: 80, damping: 20 }}
          >
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground truncate max-w-[80px] block text-center">
              {playerName}
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default memo(SoloBicycle);
