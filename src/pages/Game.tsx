import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Play, ArrowRight, Home, RotateCcw, Copy, Check, Link2, Trophy, WifiOff, Settings } from "lucide-react";
import TypingChallenge from "@/components/TypingChallenge";
import Leaderboard from "@/components/Leaderboard";
import RaceTrack from "@/components/RaceTrack";
import SoloBicycle from "@/components/SoloBicycle";
import CountdownOverlay from "@/components/CountdownOverlay";
import { useSession } from "@/hooks/useSession";
import { useRoom, type RoomPlayer } from "@/hooks/useRoom";
import { generateProgressiveChallenges, DEFAULT_ROUNDS, type MatchResult } from "@/lib/wordDifficulty";

type GamePhase = "lobby" | "countdown" | "playing" | "roundResults" | "finalResults";

const Game = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { code: urlCode } = useParams<{ code?: string }>();
  const { sessionId, playerCode, registerIdentity } = useSession();

  const { playerName: stateName, roomCode: stateCode, action } = (location.state as {
    playerName?: string;
    roomCode?: string;
    action?: "create" | "join" | "solo";
  }) || {};

  const {
    room,
    players,
    roundResults,
    myPlayerId,
    isOwner,
    loading,
    error,
    onlinePlayerIds,
    createRoom,
    joinRoom,
    updateRoom,
    submitResult,
    retrackPresence,
  } = useRoom(sessionId);

  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [countdown, setCountdown] = useState(3);
  const [initialized, setInitialized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [needsName, setNeedsName] = useState(false);

  // Connection state
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [wasOfflineDuringRound, setWasOfflineDuringRound] = useState(false);
  const [canRejoin, setCanRejoin] = useState(true);
  const roundWhenDisconnected = useRef<number | null>(null);
  const phaseWhenDisconnected = useRef<GamePhase | null>(null);

  // Track online/offline events
  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      if (phase === "playing" || phase === "countdown") {
        setWasOfflineDuringRound(true);
        roundWhenDisconnected.current = room?.current_round || null;
        phaseWhenDisconnected.current = phase;
      }
    };

    const handleOnline = () => {
      setIsOffline(false);
      // Re-track presence so others see us again
      retrackPresence();

      // Check if we can still rejoin
      if (wasOfflineDuringRound && room) {
        const currentRound = room.current_round;
        const disconnectedRound = roundWhenDisconnected.current;
        
        // If still on the same round and still playing/countdown, player can continue
        if (disconnectedRound !== null && currentRound === disconnectedRound && 
            (room.status === "playing" || room.status === "countdown")) {
          setCanRejoin(true);
          setWasOfflineDuringRound(false);
          roundWhenDisconnected.current = null;
          phaseWhenDisconnected.current = null;
        } else if (room.status === "round_results" && disconnectedRound !== null && currentRound === disconnectedRound) {
          // Round ended while offline - they missed it, but can continue next round
          setCanRejoin(true);
          setWasOfflineDuringRound(false);
          roundWhenDisconnected.current = null;
          phaseWhenDisconnected.current = null;
        } else if (room.status === "final_results") {
          // Match ended
          setCanRejoin(false);
        } else {
          // Round advanced past them - they can watch from next round
          setCanRejoin(true);
          setWasOfflineDuringRound(false);
          roundWhenDisconnected.current = null;
          phaseWhenDisconnected.current = null;
        }
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [phase, room, wasOfflineDuringRound, retrackPresence]);

  // When coming back online, re-fetch room state to check if we can rejoin
  useEffect(() => {
    if (isOffline || !wasOfflineDuringRound || !room) return;
    
    const checkRejoin = async () => {
      const { data: freshRoom } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", room.id)
        .single();
      
      if (!freshRoom) {
        setCanRejoin(false);
        return;
      }

      const fr = freshRoom as any;
      const disconnectedRound = roundWhenDisconnected.current;

      if (fr.status === "final_results") {
        setCanRejoin(false);
      } else if (disconnectedRound !== null && fr.current_round > disconnectedRound + 1) {
        // Missed more than 1 round - show "next match" message
        setCanRejoin(false);
      } else {
        setCanRejoin(true);
        setWasOfflineDuringRound(false);
        roundWhenDisconnected.current = null;
        phaseWhenDisconnected.current = null;
      }
    };
    checkRejoin();
  }, [isOffline, wasOfflineDuringRound, room]);

  // Reset disconnect state on new round
  useEffect(() => {
    if (phase === "countdown" && !isOffline) {
      setWasOfflineDuringRound(false);
      roundWhenDisconnected.current = null;
      phaseWhenDisconnected.current = null;
    }
  }, [phase, isOffline]);

  // Race progress tracking (multiplayer only)
  const [raceProgress, setRaceProgress] = useState<Record<string, number>>({});
  const [soloProgress, setSoloProgress] = useState(0);
  const progressChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Setup broadcast channel for progress when room exists and multiplayer
  useEffect(() => {
    if (!room || players.length <= 1) return;

    const channel = supabase.channel(`race-${room.id}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "progress" }, ({ payload }) => {
        if (payload?.playerId && typeof payload?.progress === "number") {
          setRaceProgress((prev) => ({ ...prev, [payload.playerId]: payload.progress }));
        }
      })
      .subscribe();

    progressChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      progressChannelRef.current = null;
    };
  }, [room?.id, players.length]);

  // Broadcast my progress
  const handleProgressChange = useCallback(
    (progress: number) => {
      if (!myPlayerId || !progressChannelRef.current) return;
      setRaceProgress((prev) => ({ ...prev, [myPlayerId]: progress }));
      progressChannelRef.current.send({
        type: "broadcast",
        event: "progress",
        payload: { playerId: myPlayerId, progress },
      });
    },
    [myPlayerId]
  );

  // Reset race progress on new round
  useEffect(() => {
    if (phase === "countdown") {
      setRaceProgress({});
      setSoloProgress(0);
    }
  }, [phase]);

  // Build racer data for the RaceTrack component - filter out offline players
  const isMultiplayer = players.length > 1;
  const racers = isMultiplayer
    ? players
        .filter((p) => {
          // Always show self
          if (p.id === myPlayerId) return true;
          // Only show online players during gameplay
          if (phase === "playing" || phase === "countdown") {
            return onlinePlayerIds.size === 0 || onlinePlayerIds.has(p.id);
          }
          return true;
        })
        .map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          progress: raceProgress[p.id] || 0,
          isMe: p.id === myPlayerId,
        }))
    : [];

  // Count only online players for "all submitted" check
  // Always include self to prevent 0-count deadlocks
  const onlinePlayers = players.filter((p) => {
    if (p.id === myPlayerId) return true; // always count self
    if (onlinePlayerIds.size === 0) return true; // presence not loaded yet, count all
    return onlinePlayerIds.has(p.id);
  });

  const [isSoloMode, setIsSoloMode] = useState(false);
  const [roundConfig, setRoundConfig] = useState(DEFAULT_ROUNDS);
  const [generatedChallenges, setGeneratedChallenges] = useState(() => generateProgressiveChallenges(DEFAULT_ROUNDS));

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    if (action === "solo" && stateName) {
      setIsSoloMode(true);
      createRoom(stateName).then(() => registerIdentity(stateName));
    } else if (action === "create" && stateName) {
      createRoom(stateName).then(() => registerIdentity(stateName));
    } else if (action === "join" && stateCode && stateName) {
      joinRoom(stateCode, stateName).then(() => registerIdentity(stateName));
    } else if (urlCode) {
      setNeedsName(true);
    }
  }, [initialized, action, stateName, stateCode, urlCode, createRoom, joinRoom]);

  const startGame = useCallback(() => {
    // Regenerate challenges with the configured round count
    setGeneratedChallenges(generateProgressiveChallenges(roundConfig));
    updateRoom({ status: "countdown", current_round: 1, max_rounds: roundConfig });
  }, [updateRoom, roundConfig]);

  // Auto-start for solo mode
  useEffect(() => {
    if (isSoloMode && room && phase === "lobby" && isOwner && players.length >= 1) {
      setPhase("countdown");
      setCountdown(3);
      supabase.from("rooms").update({ status: "countdown", current_round: 1 }).eq("id", room.id);
    }
  }, [isSoloMode, room?.id, phase, isOwner, players.length]);

  const handleJoinViaLink = () => {
    if (!joinName.trim() || !urlCode) return;
    joinRoom(urlCode, joinName.trim()).then(() => registerIdentity(joinName.trim()));
    setNeedsName(false);
  };

  // Regenerate challenges when room max_rounds changes (for non-owners joining)
  useEffect(() => {
    if (!room) return;
    const rounds = room.max_rounds || DEFAULT_ROUNDS;
    if (rounds !== generatedChallenges.length) {
      setRoundConfig(rounds);
      setGeneratedChallenges(generateProgressiveChallenges(rounds));
    }
  }, [room?.max_rounds]);

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
      if (isOwner) {
        updateRoom({ status: "playing" });
      }
      setPhase("playing");
      return;
    }
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown, isOwner, updateRoom]);

  const handlePlayerComplete = useCallback(async (wpm: number, accuracy: number, timeMs: number, _matchResult: MatchResult) => {
    if (!room) return;
    await submitResult(room.current_round, wpm, accuracy, timeMs);
  }, [room, submitResult]);

  // Check if all ONLINE players submitted results for current round
  const currentRound = room?.current_round || 1;
  const currentRoundResults = roundResults.filter(r => r.round === currentRound);
  const allPlayersSubmitted = onlinePlayers.length > 0 && currentRoundResults.length >= onlinePlayers.length;
  const isSolo = players.length === 1;
  const mySubmitted = currentRoundResults.some(r => r.player_id === myPlayerId);

  // Historical results for solo comparison
  const [historicalResults, setHistoricalResults] = useState<{ name: string; color: string; wpm: number; accuracy: number }[]>([]);


  // Auto-transition when all online players submit (or solo player submits)
  useEffect(() => {
    if (phase !== "playing") return;
    if (isSolo && mySubmitted && isOwner) {
      updateRoom({ status: "round_results" });
      return;
    }
    if (allPlayersSubmitted && isOwner) {
      updateRoom({ status: "round_results" });
    }
  }, [allPlayersSubmitted, mySubmitted, isSolo, phase, isOwner, updateRoom]);

  // Fetch historical results for solo comparison
  useEffect(() => {
    if (phase !== "roundResults" || !isSolo || !room) return;

    const fetchHistorical = async () => {
      const { data } = await supabase
        .from("round_results")
        .select("wpm, accuracy, player_id, room_players!inner(name, color, room_id)")
        .eq("round", currentRound)
        .order("wpm", { ascending: false })
        .limit(20);

      if (data) {
        const historical = (data as any[])
          .filter((r: any) => r.room_players.room_id !== room.id)
          .map((r: any) => ({
            name: r.room_players.name,
            color: r.room_players.color,
            wpm: r.wpm,
            accuracy: r.accuracy,
          }));
        setHistoricalResults(historical);
      }
    };
    fetchHistorical();
  }, [phase, isSolo, currentRound, room]);

  const maxRounds = room ? (room.max_rounds || DEFAULT_ROUNDS) : DEFAULT_ROUNDS;

  const nextRound = () => {
    const next = currentRound + 1;
    if (next > maxRounds) {
      updateRoom({ status: "final_results" });
    } else {
      updateRoom({ status: "countdown", current_round: next });
    }
  };

  const playAgain = () => {
    setGeneratedChallenges(generateProgressiveChallenges(maxRounds));
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

  // Build leaderboard-compatible data - only online players in multiplayer
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

  // Overall results (average across all rounds) - only count players who have results
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

  const challenge = generatedChallenges[(currentRound || 1) - 1];

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

  // Offline overlay - show when player loses connection during a match
  if (isOffline && phase !== "lobby") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 w-full max-w-md text-center border-destructive/30"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <WifiOff className="w-16 h-16 text-destructive mx-auto mb-4" />
          </motion.div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">Conexão Perdida</h2>
          <p className="text-muted-foreground font-body mb-4">
            Sua internet caiu. Quando a conexão voltar, você será reconectado automaticamente.
          </p>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-sm text-muted-foreground/70 font-body">
            Sala: <span className="text-accent font-bold">{room?.code}</span>
          </p>
        </motion.div>
      </div>
    );
  }

  // Can't rejoin overlay - match moved too far or ended
  if (!canRejoin && !isOffline) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 w-full max-w-md text-center"
        >
          <div className="text-5xl mb-4">😔</div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">Partida Encerrada</h2>
          <p className="text-muted-foreground font-body mb-6">
            Infelizmente a partida avançou enquanto você estava desconectado. Seus pontos desta rodada não foram contabilizados.
          </p>
          <p className="text-sm text-muted-foreground/70 font-body mb-6">
            Você poderá participar da próxima partida!
          </p>
          <div className="flex gap-3 justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-primary hover:brightness-110 transition-all"
            >
              <Home className="w-5 h-5" />
              Voltar ao Início
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Only show loading on initial load, not mid-game
  if ((loading || !room) && (phase === "lobby" || !initialized)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // If room is null mid-game (connection lost), show reconnecting message
  if (!room && phase !== "lobby") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-foreground font-display font-bold">Reconectando...</p>
          <p className="text-muted-foreground font-body text-sm mt-2">Aguarde um momento</p>
        </div>
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
    <div className="h-[100dvh] bg-background relative overflow-hidden flex flex-col">
      <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-secondary/10 animate-float blur-2xl" />
      <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-primary/10 animate-float-reverse blur-2xl" />
      <div className="absolute top-1/2 left-1/3 w-24 h-24 rounded-full bg-accent/10 animate-pulse-glow blur-2xl" />

      <div className="relative z-10 container mx-auto px-4 py-2 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 shrink-0">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Home className="w-4 h-4" />
            <span className="font-body text-sm">Início</span>
          </button>
          <div className="glass-card px-4 py-1.5 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sala:</span>
            <span className="font-display font-bold text-accent text-sm tracking-wider">{room.code}</span>
            <button onClick={copyCode} className="text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
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

              {isOwner && !isSoloMode && (
                <>
                  {/* Round config */}
                  <div className="glass-card p-4 w-full max-w-lg mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Settings className="w-4 h-4 text-primary" />
                      <span className="font-display font-bold text-foreground text-sm">Configuração da Partida</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="text-sm text-muted-foreground font-body">Rodadas:</label>
                      <input
                        type="range"
                        min={3}
                        max={20}
                        value={roundConfig}
                        onChange={(e) => setRoundConfig(Number(e.target.value))}
                        className="flex-1 accent-primary"
                      />
                      <span className="font-display font-bold text-primary text-lg w-8 text-center">{roundConfig}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1 font-body">
                      Dificuldade aumenta progressivamente ao longo das rodadas
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={startGame}
                    disabled={players.length < 2}
                    className="flex items-center gap-3 px-10 py-4 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-xl glow-primary hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                  >
                    <Play className="w-6 h-6" />
                    {players.length < 2 ? "Aguardando jogadores..." : "Iniciar Jogo!"}
                  </motion.button>
                </>
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
            <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col flex-1 min-h-0">
              {/* Race Track — multiplayer only */}
              {isMultiplayer && <div className="shrink-0"><RaceTrack racers={racers} /></div>}
              {/* Bicycle — solo only */}
              {isSolo && (
                <div className="shrink-0">
                  <SoloBicycle
                    progress={soloProgress}
                    playerName={players[0]?.name || "Você"}
                    playerColor={players[0]?.color || "hsl(142 70% 45%)"}
                  />
                </div>
              )}
              <div className="flex-1 min-h-0 flex flex-col justify-center">
                <TypingChallenge
                  text={challenge.text}
                  round={challenge.round}
                  totalRounds={maxRounds}
                  difficulty={challenge.difficulty}
                  difficultyTier={challenge.tier}
                  label={challenge.label}
                  onComplete={handlePlayerComplete}
                  onProgressChange={isMultiplayer ? handleProgressChange : (p) => setSoloProgress(p)}
                />
              </div>
            </motion.div>
          )}

          {/* Waiting for others */}
          {phase === "playing" && mySubmitted && (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-10">
              {/* Show race track while waiting */}
              {isMultiplayer && <RaceTrack racers={racers} />}
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full mb-4" />
              <p className="text-foreground font-display font-bold text-xl mb-2">Você terminou! 🎉</p>
              <p className="text-muted-foreground font-body">Aguardando os outros jogadores... ({currentRoundResults.length}/{onlinePlayers.length})</p>
            </motion.div>
          )}

          {/* ROUND RESULTS */}
          {phase === "roundResults" && (
            <motion.div key="roundResults" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center overflow-y-auto max-h-[calc(100dvh-80px)]">
              {isSolo ? (
                <>
                  {(() => {
                    const myResult = leaderboardCurrentResults[0];
                    if (!myResult) return null;
                    
                    const allEntries = [
                      { name: leaderboardPlayers[0]?.name || "Você", color: leaderboardPlayers[0]?.color || "hsl(142 70% 45%)", wpm: myResult.wpm, accuracy: myResult.accuracy, isMe: true },
                      ...historicalResults.map(h => ({ ...h, isMe: false })),
                    ].sort((a, b) => b.wpm - a.wpm);

                    const myRank = allEntries.findIndex(e => e.isMe) + 1;
                    const top5 = allEntries.slice(0, 5);
                    const myInTop5 = myRank <= 5;
                    const displayEntries = myInTop5
                      ? top5
                      : [...top5, allEntries[myRank - 1]];

                    return (
                      <div className="w-full max-w-2xl mx-auto">
                        <h2 className="text-3xl font-display font-bold text-center mb-2 text-gradient-primary">
                          Rodada {currentRound}
                        </h2>
                        <p className="text-center text-muted-foreground font-body mb-6">
                          Sua posição: <span className="text-accent font-bold">{myRank}º</span> de {allEntries.length} jogador{allEntries.length !== 1 ? "es" : ""}
                        </p>

                        <div className="glass-card p-6 mb-6 glow-primary border-primary/30">
                          <div className="flex items-center justify-center gap-8">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">WPM</p>
                              <p className="text-4xl font-display font-bold text-primary">{myResult.wpm}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Precisão</p>
                              <p className="text-4xl font-display font-bold text-foreground">{myResult.accuracy}%</p>
                            </div>
                          </div>
                        </div>

                        {allEntries.length > 1 && (
                          <>
                            <h3 className="text-sm font-body font-semibold text-muted-foreground mb-3 text-center">Comparação com outros jogadores nesta rodada</h3>
                            <div className="space-y-2">
                              {displayEntries.map((entry, idx) => {
                                const realIndex = entry.isMe && !myInTop5 ? myRank - 1 : allEntries.indexOf(entry);
                                const isLast = idx === displayEntries.length - 1 && !myInTop5 && entry.isMe;

                                return (
                                  <div key={`${entry.name}-${idx}`}>
                                    {isLast && (
                                      <div className="text-center text-muted-foreground/50 text-xs py-1">• • •</div>
                                    )}
                                    <motion.div
                                      initial={{ opacity: 0, x: -30 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: idx * 0.06 }}
                                      className={`glass-card p-3 flex items-center gap-3 ${
                                        entry.isMe ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30" : ""
                                      }`}
                                    >
                                      <span className="w-8 text-center font-display font-bold text-muted-foreground">{realIndex + 1}º</span>
                                      <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-foreground font-display font-bold text-sm shrink-0"
                                        style={{ backgroundColor: entry.color }}
                                      >
                                        {entry.name[0]}
                                      </div>
                                      <span className="flex-1 font-body font-semibold text-foreground text-sm">
                                        {entry.name}
                                        {entry.isMe && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">← Você</span>}
                                      </span>
                                      <span className="font-display font-bold text-primary">{entry.wpm} <span className="text-xs text-muted-foreground">WPM</span></span>
                                      <span className="font-display font-bold text-foreground text-sm">{entry.accuracy}%</span>
                                    </motion.div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <Leaderboard
                  players={leaderboardPlayers}
                  results={leaderboardCurrentResults}
                  title={`Resultado - Rodada ${currentRound}`}
                />
              )}

              {/* Continue button — always visible for owner */}
              {isOwner && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={nextRound}
                  className="mt-6 mb-4 flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-lg glow-primary hover:brightness-110 transition-all shrink-0"
                >
                  {currentRound >= maxRounds ? "Ver Ranking Final" : "Próxima Rodada"}
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
              {!isOwner && (
                <p className="mt-6 text-muted-foreground font-body text-sm">Aguardando o dono avançar...</p>
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

              {/* Player Code Display */}
              {playerCode && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="glass-card p-6 mt-6 w-full max-w-md text-center border-accent/30"
                >
                  <p className="text-sm text-muted-foreground font-body mb-2">Seu código de identificação:</p>
                  <p className="text-2xl font-display font-bold text-accent select-all">
                    {stateName || "Jogador"}#{playerCode}
                  </p>
                  <p className="text-xs text-muted-foreground/70 font-body mt-2">
                    Guarde este código! Cole no campo de nome para restaurar sua conta.
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${stateName || "Jogador"}#${playerCode}`);
                    }}
                    className="mt-3 px-4 py-2 rounded-xl bg-accent/20 text-accent text-sm font-body font-semibold hover:bg-accent/30 transition-colors"
                  >
                    📋 Copiar Código
                  </button>
                </motion.div>
              )}

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
