import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Medal, Award, Home, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GlobalScore {
  playerName: string;
  playerColor: string;
  bestWpm: number;
  bestAccuracy: number;
  totalGames: number;
  avgWpm: number;
}

const rankIcons = [
  <Trophy className="w-6 h-6 text-accent" />,
  <Medal className="w-6 h-6 text-muted-foreground" />,
  <Award className="w-6 h-6 text-game-orange" />,
];

const Ranking = () => {
  const navigate = useNavigate();
  const [scores, setScores] = useState<GlobalScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"bestWpm" | "avgWpm" | "totalGames">("bestWpm");

  useEffect(() => {
    fetchGlobalRanking();
  }, []);

  const fetchGlobalRanking = async () => {
    setLoading(true);

    // Get all results joined with player info
    const { data: results } = await supabase
      .from("round_results")
      .select("wpm, accuracy, player_id, room_players!inner(name, color)")
      .order("wpm", { ascending: false });

    if (!results) {
      setLoading(false);
      return;
    }

    // Aggregate by player name (since no auth, group by name+color)
    const playerMap = new Map<string, { name: string; color: string; wpms: number[]; accuracies: number[] }>();

    results.forEach((r: any) => {
      const name = r.room_players.name;
      const color = r.room_players.color;
      const key = name.toLowerCase();
      const existing = playerMap.get(key) || { name, color, wpms: [], accuracies: [] };
      existing.wpms.push(r.wpm);
      existing.accuracies.push(r.accuracy);
      playerMap.set(key, existing);
    });

    const aggregated: GlobalScore[] = Array.from(playerMap.values()).map(p => ({
      playerName: p.name,
      playerColor: p.color,
      bestWpm: Math.max(...p.wpms),
      bestAccuracy: Math.max(...p.accuracies),
      totalGames: p.wpms.length,
      avgWpm: Math.round(p.wpms.reduce((a, b) => a + b, 0) / p.wpms.length),
    }));

    setScores(aggregated);
    setLoading(false);
  };

  const sorted = [...scores].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-accent/10 animate-float blur-2xl" />
      <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-primary/10 animate-float-reverse blur-2xl" />

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Home className="w-5 h-5" />
            <span className="font-body">Início</span>
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="w-10 h-10 text-accent" />
            <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient-primary">Ranking Global</h1>
          </div>
          <p className="text-muted-foreground font-body">Melhores pontuações de todos os jogadores</p>
        </motion.div>

        {/* Sort buttons */}
        <div className="flex justify-center gap-3 mb-8">
          {[
            { key: "bestWpm" as const, label: "Melhor WPM" },
            { key: "avgWpm" as const, label: "Média WPM" },
            { key: "totalGames" as const, label: "Mais Rodadas" },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body font-semibold transition-colors ${
                sortBy === opt.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground font-body text-lg">Nenhuma pontuação registrada ainda.</p>
            <p className="text-muted-foreground/60 font-body text-sm mt-2">Jogue uma partida para aparecer no ranking!</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl mx-auto space-y-3">
            {sorted.map((score, index) => (
              <motion.div
                key={`${score.playerName}-${index}`}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
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
                  style={{ backgroundColor: score.playerColor }}
                >
                  {score.playerName[0]}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="font-body font-bold text-foreground truncate">{score.playerName}</p>
                  <p className="text-xs text-muted-foreground">{score.totalGames} rodada{score.totalGames !== 1 ? "s" : ""}</p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Melhor</p>
                    <p className="font-display font-bold text-lg text-primary">{score.bestWpm}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Média</p>
                    <p className="font-display font-bold text-lg text-foreground">{score.avgWpm}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Precisão</p>
                    <p className="font-display font-bold text-lg text-foreground">{score.bestAccuracy}%</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Ranking;
