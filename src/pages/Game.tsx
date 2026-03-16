import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Play, ArrowRight, Home, RotateCcw, Copy, Check, Link2 } from "lucide-react";
import TypingChallenge from "@/components/TypingChallenge";
import Leaderboard from "@/components/Leaderboard";
import CountdownOverlay from "@/components/CountdownOverlay";
import { challenges } from "@/lib/gameData";
import { useSession } from "@/hooks/useSession";
import { useRoom, type RoomPlayer } from "@/hooks/useRoom";

type GamePhase = "lobby" | "countdown" | "playing" | "roundResults" | "finalResults";

const Game = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { code: urlCode } = useParams<{ code?: string }>();
  const sessionId = useSession();

  const { playerName: stateName, roomCode: stateCode, action } = (location.state as {
    playerName?: string;
    roomCode?: string;
    action?: "create" | "join";
  }) || {};

  const {
    room,
    players,
    roundResults,
    myPlayerId,
    isOwner,
    loading,
    error,
    createRoom,
    joinRoom,
    updateRoom,
    submitResult,
  } = useRoom(sessionId);

  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [countdown, setCountdown] = useState(3);
  const [initialized, setInitialized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [needsName, setNeedsName] = useState(false);

  // Initialize room
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    if (action === "create" && stateName) {
      createRoom(stateName);
    } else if (action === "join" && stateCode && stateName) {
      joinRoom(stateCode, stateName);
    } else if (urlCode) {
      // Joining via link - need name input
      setNeedsName(true);
    }
  }, [initialized, action, stateName, stateCode, urlCode, createRoom, joinRoom]);

  const handleJoinViaLink = () => {
    if (!joinName.trim() || !urlCode) return;
    joinRoom(urlCode, joinName.trim());
    setNeedsName(false);
  };

  // Sync phase with room status from DB
  useEffect(() => {
    if (!room) return;
    const status = room.status;
    if (status === "lobby") setPhase("lobby");
    else if (status === "countdown") {
      setPhase("countdown");
      setCountdown(3);
    } else if (status === "playing") setPhase("playing");
    else if (status === "round_results") setPhase("roundResults");
    else if (status === "final_results") setPhase("finalResults");
  }, [room?.status]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown < 0) {
      // Only owner transitions to playing
      if (isOwner) {
        updateRoom({ status: "playing" });
      }
      setPhase("playing");
      return;
    }
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown, isOwner, updateRoom]);

  const startGame = useCallback(() => {
    updateRoom({ status: "countdown", current_round: 1 });
  }, [updateRoom]);

  const handlePlayerComplete = useCallback(async (wpm: number, accuracy: number, timeMs: number) => {
    if (!room) return;
    await submitResult(room.current_round, wpm, accuracy, timeMs);

    // Check if all players finished - owner decides when to show results
    // For simplicity, each player submits and we show results when all are in
    // The owner will advance the round
  }, [room, submitResult]);

  // Check if all players submitted results for current round
  const currentRound = room?.current_round || 1;
  const currentRoundResults = roundResults.filter(r => r.round === currentRound);
  const allPlayersSubmitted = players.length > 0 && currentRoundResults.length >= players.length;
  const isSolo = players.length === 1;

  // Auto-transition when all submit (owner triggers)
  useEffect(() => {
    if (allPlayersSubmitted && phase === "playing" && isOwner) {
      if (isSolo) {
        // Solo: skip round results, go straight to next round or final
        const next = currentRound + 1;
        if (next > challenges.length) {
          updateRoom({ status: "final_results" });
        } else {
          updateRoom({ status: "countdown", current_round: next });
        }
      } else {
        updateRoom({ status: "round_results" });
      }
    }
  }, [allPlayersSubmitted, phase, isOwner, updateRoom, isSolo, currentRound]);

  const nextRound = () => {
    const next = currentRound + 1;
    if (next > challenges.length) {
      updateRoom({ status: "final_results" });
    } else {
      updateRoom({ status: "countdown", current_round: next });
    }
  };

  const playAgain = () => {
    updateRoom({ status: "countdown", current_round: 1 });
  };

  const copyCode = () => {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyLink = () => {
    if (room?.code) {
      const link = `${window.location.origin}/join/${room.code}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Build leaderboard-compatible data
  const leaderboardPlayers = players.map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    isBot: false,
    isOwner: p.is_owner,
  }));

  const leaderboardCurrentResults = currentRoundResults.map(r => ({
    playerId: r.player_id,
    wpm: r.wpm,
    accuracy: r.accuracy,
    timeMs: r.time_ms,
  }));

  // Overall results (average across all rounds)
  const getOverallResults = () => {
    const playerScores = new Map<string, { totalWpm: number; totalAcc: number; count: number }>();
    roundResults.forEach(r => {
      const existing = playerScores.get(r.player_id) || { totalWpm: 0, totalAcc: 0, count: 0 };
      playerScores.set(r.player_id, {
        totalWpm: existing.totalWpm + r.wpm,
        totalAcc: existing.totalAcc + r.accuracy,
        count: existing.count + 1,
      });
    });
    return Array.from(playerScores.entries()).map(([playerId, scores]) => ({
      playerId,
      wpm: Math.round(scores.totalWpm / scores.count),
      accuracy: Math.round(scores.totalAcc / scores.count),
      timeMs: 0,
    }));
  };

  const challenge = challenges[(currentRound || 1) - 1];
  const mySubmitted = currentRoundResults.some(r => r.player_id === myPlayerId);

  // Name input for link-based join
  if (needsName) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 w-full max-w-md">
          <h2 className="text-2xl font-display font-bold text-foreground mb-2 text-center">Entrar na Sala</h2>
          <p className="text-muted-foreground text-sm mb-6 text-center font-body">Código: <span className="text-accent font-bold">{urlCode}</span></p>
          <input
            type="text"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Seu nome..."
            maxLength={20}
            className="w-full bg-muted rounded-xl px-4 py-3 text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all mb-4"
            onKeyDown={(e) => e.key === "Enter" && handleJoinViaLink()}
          />
          <div className="flex gap-3">
            <button onClick={() => navigate("/")} className="flex-1 px-4 py-3 rounded-xl bg-muted text-foreground font-body font-semibold hover:bg-muted/80 transition-colors">
              Voltar
            </button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleJoinViaLink}
              disabled={!joinName.trim()}
              className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-primary hover:brightness-110 transition-all disabled:opacity-40"
            >
              Entrar
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading || !room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="glass-card p-8 text-center max-w-md">
          <p className="text-destructive font-bold mb-4">{error}</p>
          <button onClick={() => navigate("/")} className="px-6 py-3 rounded-xl bg-muted text-foreground font-body font-semibold">Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-secondary/10 animate-float blur-2xl" />
      <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-primary/10 animate-float-reverse blur-2xl" />
      <div className="absolute top-1/2 left-1/3 w-24 h-24 rounded-full bg-accent/10 animate-pulse-glow blur-2xl" />

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Home className="w-5 h-5" />
            <span className="font-body">Início</span>
          </button>
          <div className="glass-card px-6 py-2 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Sala:</span>
            <span className="font-display font-bold text-accent text-lg tracking-wider">{room.code}</span>
            <button onClick={copyCode} className="text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* LOBBY */}
          {phase === "lobby" && (
            <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-2 text-gradient-primary">Sala de Espera</h1>
              <p className="text-muted-foreground mb-4 font-body">Aguardando jogadores...</p>

              {/* Share buttons */}
              <div className="flex gap-3 mb-8">
                <button onClick={copyCode} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground font-body text-sm hover:bg-muted/80 transition-colors">
                  <Copy className="w-4 h-4" />
                  Copiar Código
                </button>
                <button onClick={copyLink} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground font-body text-sm hover:bg-muted/80 transition-colors">
                  <Link2 className="w-4 h-4" />
                  Copiar Link
                </button>
              </div>

              <div className="glass-card p-6 w-full max-w-lg mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-bold text-foreground">Jogadores ({players.length})</h3>
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
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-foreground" style={{ backgroundColor: player.color }}>
                        {player.name[0]}
                      </div>
                      <span className="font-body font-semibold text-foreground flex-1">{player.name}</span>
                      {player.is_owner && (
                        <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full font-bold">Dono</span>
                      )}
                      {player.session_id === sessionId && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">Você</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {isOwner && players.length >= 1 && (
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
              {!isOwner && (
                <p className="text-muted-foreground font-body text-sm">Aguardando o dono iniciar o jogo...</p>
              )}
            </motion.div>
          )}

          {/* COUNTDOWN */}
          {phase === "countdown" && countdown >= 0 && (
            <CountdownOverlay count={countdown} />
          )}

          {/* PLAYING */}
          {phase === "playing" && challenge && !mySubmitted && (
            <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TypingChallenge
                text={challenge.text}
                round={challenge.round}
                difficulty={challenge.difficulty}
                label={challenge.label}
                onComplete={handlePlayerComplete}
              />
            </motion.div>
          )}

          {/* Waiting for others */}
          {phase === "playing" && mySubmitted && (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full mb-4" />
              <p className="text-foreground font-display font-bold text-xl mb-2">Você terminou! 🎉</p>
              <p className="text-muted-foreground font-body">Aguardando os outros jogadores... ({currentRoundResults.length}/{players.length})</p>
            </motion.div>
          )}

          {/* ROUND RESULTS */}
          {phase === "roundResults" && (
            <motion.div key="roundResults" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
              <Leaderboard
                players={leaderboardPlayers}
                results={leaderboardCurrentResults}
                title={`Resultado - Rodada ${currentRound}`}
              />
              {isOwner && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={nextRound}
                  className="mt-8 flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-lg glow-primary hover:brightness-110 transition-all"
                >
                  {currentRound >= challenges.length ? "Ver Ranking Final" : "Próxima Rodada"}
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
              {!isOwner && (
                <p className="mt-8 text-muted-foreground font-body text-sm">Aguardando o dono avançar...</p>
              )}
            </motion.div>
          )}

          {/* FINAL RESULTS */}
          {phase === "finalResults" && (
            <motion.div key="finalResults" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="text-6xl mb-4">
                🏆
              </motion.div>
              <Leaderboard
                players={leaderboardPlayers}
                results={getOverallResults()}
                title={isSolo ? "Seu Resultado Final" : "Ranking da Sala"}
                showOverall
              />
              <div className="flex flex-wrap justify-center gap-4 mt-8">
                {isOwner && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={playAgain}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-secondary-foreground font-display font-bold glow-secondary hover:brightness-110 transition-all"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Jogar Novamente
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/ranking")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent/20 text-accent font-display font-bold hover:bg-accent/30 transition-all"
                >
                  <Trophy className="w-5 h-5" />
                  Ranking Global
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
