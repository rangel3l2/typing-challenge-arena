import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Play, ArrowRight, Home, RotateCcw } from "lucide-react";
import TypingChallenge from "@/components/TypingChallenge";
import Leaderboard from "@/components/Leaderboard";
import CountdownOverlay from "@/components/CountdownOverlay";
import {
  challenges,
  generateBotPlayers,
  simulateBotResult,
  type Player,
  type PlayerResult,
  type RoundResult,
} from "@/lib/gameData";

type GamePhase = "lobby" | "countdown" | "playing" | "roundResults" | "finalResults";

const Game = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { playerName, roomCode, isOwner } = (location.state as {
    playerName: string;
    roomCode: string;
    isOwner: boolean;
  }) || { playerName: "Jogador", roomCode: "ABC123", isOwner: true };

  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [currentRound, setCurrentRound] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [currentRoundResults, setCurrentRoundResults] = useState<PlayerResult[]>([]);
  const [overallScores, setOverallScores] = useState<Map<string, { totalWpm: number; rounds: number; totalAccuracy: number }>>(new Map());

  // Initialize players
  useEffect(() => {
    const me: Player = {
      id: "player-me",
      name: playerName,
      color: "hsl(142 70% 45%)",
      isBot: false,
      isOwner,
    };
    const bots = generateBotPlayers(3 + Math.floor(Math.random() * 3));
    setPlayers([me, ...bots]);
  }, [playerName, isOwner]);

  const startGame = useCallback(() => {
    setCurrentRound(0);
    setRoundResults([]);
    setOverallScores(new Map());
    startCountdown(0);
  }, []);

  const startCountdown = (round: number) => {
    setCurrentRound(round);
    setPhase("countdown");
    setCountdown(3);
    setCurrentRoundResults([]);
  };

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown < 0) {
      setPhase("playing");
      return;
    }
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  const handlePlayerComplete = useCallback((wpm: number, accuracy: number, timeMs: number) => {
    const playerResult: PlayerResult = {
      playerId: "player-me",
      wpm,
      accuracy,
      timeMs,
    };

    // Simulate bot results
    const challenge = challenges[currentRound];
    const botResults: PlayerResult[] = players
      .filter(p => p.isBot)
      .map(bot => {
        const result = simulateBotResult(challenge.text.length);
        return { ...result, playerId: bot.id };
      });

    const allResults = [playerResult, ...botResults];
    setCurrentRoundResults(allResults);

    // Update overall scores
    setOverallScores(prev => {
      const next = new Map(prev);
      allResults.forEach(r => {
        const existing = next.get(r.playerId) || { totalWpm: 0, rounds: 0, totalAccuracy: 0 };
        next.set(r.playerId, {
          totalWpm: existing.totalWpm + r.wpm,
          rounds: existing.rounds + 1,
          totalAccuracy: existing.totalAccuracy + r.accuracy,
        });
      });
      return next;
    });

    setRoundResults(prev => [...prev, { round: currentRound, results: allResults }]);
    setPhase("roundResults");
  }, [currentRound, players]);

  const nextRound = () => {
    const next = currentRound + 1;
    if (next >= challenges.length) {
      setPhase("finalResults");
    } else {
      startCountdown(next);
    }
  };

  const getOverallResults = (): PlayerResult[] => {
    return Array.from(overallScores.entries()).map(([playerId, scores]) => ({
      playerId,
      wpm: Math.round(scores.totalWpm / scores.rounds),
      accuracy: Math.round(scores.totalAccuracy / scores.rounds),
      timeMs: 0,
    }));
  };

  const challenge = challenges[currentRound];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-secondary/10 animate-float blur-2xl" />
      <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-primary/10 animate-float-reverse blur-2xl" />
      <div className="absolute top-1/2 left-1/3 w-24 h-24 rounded-full bg-accent/10 animate-pulse-glow blur-2xl" />

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Room code header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="w-5 h-5" />
            <span className="font-body">Início</span>
          </button>
          <div className="glass-card px-6 py-2 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Sala:</span>
            <span className="font-display font-bold text-accent text-lg tracking-wider">{roomCode}</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* LOBBY */}
          {phase === "lobby" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-2 text-gradient-primary">
                Sala de Espera
              </h1>
              <p className="text-muted-foreground mb-8 font-body">
                Aguardando jogadores...
              </p>

              <div className="glass-card p-6 w-full max-w-lg mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-bold text-foreground">
                    Jogadores ({players.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {players.map((player, i) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-foreground"
                        style={{ backgroundColor: player.color }}
                      >
                        {player.name[0]}
                      </div>
                      <span className="font-body font-semibold text-foreground flex-1">
                        {player.name}
                      </span>
                      {player.isOwner && (
                        <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full font-bold">
                          Dono
                        </span>
                      )}
                      {player.isBot && (
                        <span className="text-xs text-muted-foreground">Bot</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {isOwner && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="flex items-center gap-3 px-10 py-4 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-xl glow-primary hover:brightness-110 transition-all"
                >
                  <Play className="w-6 h-6" />
                  Iniciar Jogo!
                </motion.button>
              )}
            </motion.div>
          )}

          {/* COUNTDOWN */}
          {phase === "countdown" && countdown >= 0 && (
            <CountdownOverlay count={countdown} />
          )}

          {/* PLAYING */}
          {phase === "playing" && challenge && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TypingChallenge
                text={challenge.text}
                round={challenge.round}
                difficulty={challenge.difficulty}
                label={challenge.label}
                onComplete={handlePlayerComplete}
              />
            </motion.div>
          )}

          {/* ROUND RESULTS */}
          {phase === "roundResults" && (
            <motion.div
              key="roundResults"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <Leaderboard
                players={players}
                results={currentRoundResults}
                title={`Resultado - Rodada ${currentRound + 1}`}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={nextRound}
                className="mt-8 flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-lg glow-primary hover:brightness-110 transition-all"
              >
                {currentRound + 1 >= challenges.length ? "Ver Ranking Final" : "Próxima Rodada"}
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </motion.div>
          )}

          {/* FINAL RESULTS */}
          {phase === "finalResults" && (
            <motion.div
              key="finalResults"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="text-6xl mb-4"
              >
                🏆
              </motion.div>
              <Leaderboard
                players={players}
                results={getOverallResults()}
                title="Ranking Final"
                showOverall
              />
              <div className="flex gap-4 mt-8">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-secondary-foreground font-display font-bold glow-secondary hover:brightness-110 transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  Jogar Novamente
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-muted text-foreground font-display font-bold hover:bg-muted/80 transition-all"
                >
                  <Home className="w-5 h-5" />
                  Voltar ao Início
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Game;
