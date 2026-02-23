import { motion } from "framer-motion";
import { Trophy, Medal, Award } from "lucide-react";
import type { Player, PlayerResult } from "@/lib/gameData";

interface LeaderboardProps {
  players: Player[];
  results: PlayerResult[];
  title: string;
  showOverall?: boolean;
}

const rankIcons = [
  <Trophy className="w-6 h-6 text-accent" />,
  <Medal className="w-6 h-6 text-muted-foreground" />,
  <Award className="w-6 h-6 text-game-orange" />,
];

const Leaderboard = ({ players, results, title, showOverall }: LeaderboardProps) => {
  const sorted = [...results].sort((a, b) => b.wpm - a.wpm);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-2xl mx-auto"
    >
      <h2 className="text-3xl font-display font-bold text-center mb-8 text-gradient-primary">
        {title}
      </h2>

      <div className="space-y-3">
        {sorted.map((result, index) => {
          const player = players.find(p => p.id === result.playerId);
          if (!player) return null;

          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.15 }}
              className={`glass-card p-4 flex items-center gap-4 ${
                index === 0 ? "glow-accent border-accent/30" : ""
              }`}
            >
              {/* Rank */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted shrink-0">
                {index < 3 ? rankIcons[index] : (
                  <span className="font-display font-bold text-muted-foreground">{index + 1}</span>
                )}
              </div>

              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-foreground font-display font-bold shrink-0"
                style={{ backgroundColor: player.color }}
              >
                {player.name[0]}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="font-body font-bold text-foreground truncate">
                  {player.name}
                  {player.isOwner && (
                    <span className="ml-2 text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                      Dono
                    </span>
                  )}
                </p>
                {player.isBot && (
                  <p className="text-xs text-muted-foreground">Bot</p>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 shrink-0">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">WPM</p>
                  <p className="font-display font-bold text-lg text-primary">{result.wpm}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Precisão</p>
                  <p className="font-display font-bold text-lg text-foreground">{result.accuracy}%</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default Leaderboard;
