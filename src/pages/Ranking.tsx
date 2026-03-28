import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Medal, Award, Home, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TypingScore {
  playerName: string;
  playerColor: string;
  bestWpm: number;
  bestAccuracy: number;
  totalGames: number;
  avgWpm: number;
}

interface AcertarScore {
  playerName: string;
  playerCode: string;
  bestScore: number;
  bestPhase: number;
  totalGames: number;
  avgScore: number;
}

const rankIcons = [
  <Trophy className="w-6 h-6 text-accent" />,
  <Medal className="w-6 h-6 text-muted-foreground" />,
  <Award className="w-6 h-6 text-game-orange" />,
];

type Tab = "digitar" | "acertar";

const Ranking = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "digitar";
  const [tab, setTab] = useState<Tab>(initialTab);

  // Typing state
  const [typingScores, setTypingScores] = useState<TypingScore[]>([]);
  const [typingLoading, setTypingLoading] = useState(true);
  const [typingSortBy, setTypingSortBy] = useState<"bestWpm" | "avgWpm" | "totalGames">("bestWpm");

  // Acertar state
  const [acertarScores, setAcertarScores] = useState<AcertarScore[]>([]);
  const [acertarLoading, setAcertarLoading] = useState(true);
  const [acertarSortBy, setAcertarSortBy] = useState<"bestScore" | "bestPhase" | "totalGames">("bestScore");

  useEffect(() => {
    fetchTypingRanking();
    fetchAcertarRanking();
  }, []);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setSearchParams({ tab: newTab });
  };

  const fetchTypingRanking = async () => {
    setTypingLoading(true);
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, max_rounds")
      .in("status", ["final_results", "lobby"]);

    const { data: results } = await supabase
      .from("round_results")
      .select("wpm, accuracy, player_id, room_id, round, room_players!inner(name, color)")
      .order("wpm", { ascending: false });

    if (!results || !rooms) {
      setTypingLoading(false);
      return;
    }

    const roomMaxRounds = new Map<string, number>();
    rooms.forEach((r: any) => roomMaxRounds.set(r.id, r.max_rounds));

    const playerRoomResults = new Map<string, Map<string, { rounds: Set<number>; wpms: number[]; accuracies: number[] }>>();
    results.forEach((r: any) => {
      const pid = r.player_id;
      const rid = r.room_id;
      if (!playerRoomResults.has(pid)) playerRoomResults.set(pid, new Map());
      const roomMap = playerRoomResults.get(pid)!;
      if (!roomMap.has(rid)) roomMap.set(rid, { rounds: new Set(), wpms: [], accuracies: [] });
      const entry = roomMap.get(rid)!;
      entry.rounds.add(r.round);
      entry.wpms.push(r.wpm);
      entry.accuracies.push(r.accuracy);
    });

    const playerMap = new Map<string, { name: string; color: string; wpms: number[]; accuracies: number[] }>();
    results.forEach((r: any) => {
      const pid = r.player_id;
      const rid = r.room_id;
      const maxRounds = roomMaxRounds.get(rid) || 5;
      const roomEntry = playerRoomResults.get(pid)?.get(rid);
      if (!roomEntry || roomEntry.rounds.size < maxRounds) return;
      const name = r.room_players.name;
      const color = r.room_players.color;
      const key = name.toLowerCase();
      const existing = playerMap.get(key) || { name, color, wpms: [], accuracies: [] };
      existing.wpms.push(r.wpm);
      existing.accuracies.push(r.accuracy);
      playerMap.set(key, existing);
    });

    const aggregated: TypingScore[] = Array.from(playerMap.values()).map(p => ({
      playerName: p.name,
      playerColor: p.color,
      bestWpm: Math.max(...p.wpms),
      bestAccuracy: Math.max(...p.accuracies),
      totalGames: p.wpms.length,
      avgWpm: Math.round(p.wpms.reduce((a, b) => a + b, 0) / p.wpms.length),
    }));

    setTypingScores(aggregated);
    setTypingLoading(false);
  };

  const fetchAcertarRanking = async () => {
    setAcertarLoading(true);
    const { data } = await supabase
      .from("acertar_scores")
      .select("*")
      .order("score", { ascending: false });

    if (!data) {
      setAcertarLoading(false);
      return;
    }

    // Aggregate by player_code (best score, best phase, total games, avg)
    const playerMap = new Map<string, { name: string; code: string; scores: number[]; phases: number[] }>();
    data.forEach((r: any) => {
      const key = r.player_code;
      const existing = playerMap.get(key) || { name: r.player_name, code: r.player_code, scores: [], phases: [] };
      existing.scores.push(r.score);
      existing.phases.push(r.phase_reached);
      // Keep the latest name
      existing.name = r.player_name;
      playerMap.set(key, existing);
    });

    const aggregated: AcertarScore[] = Array.from(playerMap.values()).map(p => ({
      playerName: p.name,
      playerCode: p.code,
      bestScore: Math.max(...p.scores),
      bestPhase: Math.max(...p.phases),
      totalGames: p.scores.length,
      avgScore: Math.round(p.scores.reduce((a, b) => a + b, 0) / p.scores.length),
    }));

    setAcertarScores(aggregated);
    setAcertarLoading(false);
  };

  const sortedTyping = [...typingScores].sort((a, b) => b[typingSortBy] - a[typingSortBy]);
  const sortedAcertar = [...acertarScores].sort((a, b) => b[acertarSortBy] - a[acertarSortBy]);

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

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="w-10 h-10 text-accent" />
            <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient-primary">Ranking Global</h1>
          </div>
          <p className="text-muted-foreground font-body">Melhores pontuações de todos os jogadores</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => handleTabChange("digitar")}
            className={`px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all ${
              tab === "digitar"
                ? "bg-primary text-primary-foreground glow-primary"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            ⌨️ Eu Vou Digitar
          </button>
          <button
            onClick={() => handleTabChange("acertar")}
            className={`px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all ${
              tab === "acertar"
                ? "bg-primary text-primary-foreground glow-primary"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            🎈 Eu Vou Acertar
          </button>
        </div>

        {/* ====== TYPING TAB ====== */}
        {tab === "digitar" && (
          <>
            <div className="flex justify-center gap-3 mb-8">
              {[
                { key: "bestWpm" as const, label: "Melhor WPM" },
                { key: "avgWpm" as const, label: "Média WPM" },
                { key: "totalGames" as const, label: "Mais Rodadas" },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setTypingSortBy(opt.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body font-semibold transition-colors ${
                    typingSortBy === opt.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>

            {typingLoading ? (
              <div className="flex justify-center py-20">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : sortedTyping.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground font-body text-lg">Nenhuma pontuação registrada ainda.</p>
                <p className="text-muted-foreground/60 font-body text-sm mt-2">Jogue uma partida para aparecer no ranking!</p>
              </div>
            ) : (
              <div className="w-full max-w-2xl mx-auto space-y-3">
                {sortedTyping.map((score, index) => (
                  <motion.div
                    key={`${score.playerName}-${index}`}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className={`glass-card p-4 flex items-center gap-4 ${index === 0 ? "glow-accent border-accent/30" : ""}`}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted shrink-0">
                      {index < 3 ? rankIcons[index] : <span className="font-display font-bold text-muted-foreground">{index + 1}</span>}
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-foreground font-display font-bold shrink-0" style={{ backgroundColor: score.playerColor }}>
                      {score.playerName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-bold text-foreground truncate">{score.playerName}</p>
                      <p className="text-xs text-muted-foreground">{score.totalGames} rodada{score.totalGames !== 1 ? "s" : ""}</p>
                    </div>
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
          </>
        )}

        {/* ====== ACERTAR TAB ====== */}
        {tab === "acertar" && (
          <>
            <div className="flex justify-center gap-3 mb-8">
              {[
                { key: "bestScore" as const, label: "Melhor Pontuação" },
                { key: "bestPhase" as const, label: "Melhor Fase" },
                { key: "totalGames" as const, label: "Mais Partidas" },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setAcertarSortBy(opt.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body font-semibold transition-colors ${
                    acertarSortBy === opt.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>

            {acertarLoading ? (
              <div className="flex justify-center py-20">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : sortedAcertar.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground font-body text-lg">Nenhuma pontuação registrada ainda.</p>
                <p className="text-muted-foreground/60 font-body text-sm mt-2">Jogue Eu Vou Acertar para aparecer no ranking!</p>
              </div>
            ) : (
              <div className="w-full max-w-2xl mx-auto space-y-3">
                {sortedAcertar.map((score, index) => (
                  <motion.div
                    key={`${score.playerCode}-${index}`}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className={`glass-card p-4 flex items-center gap-4 ${index === 0 ? "glow-accent border-accent/30" : ""}`}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted shrink-0">
                      {index < 3 ? rankIcons[index] : <span className="font-display font-bold text-muted-foreground">{index + 1}</span>}
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/20 text-primary font-display font-bold shrink-0">
                      {score.playerName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-bold text-foreground truncate">{score.playerName}</p>
                      <p className="text-xs text-muted-foreground">{score.playerCode} · {score.totalGames} partida{score.totalGames !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Melhor</p>
                        <p className="font-display font-bold text-lg text-primary">{score.bestScore}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Média</p>
                        <p className="font-display font-bold text-lg text-foreground">{score.avgScore}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Fase</p>
                        <p className="font-display font-bold text-lg text-foreground">{score.bestPhase}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Ranking;
