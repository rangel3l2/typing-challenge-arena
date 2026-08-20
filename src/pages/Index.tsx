import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Zap, Trophy, ArrowRight, Plus, Calculator, Shield, Gift, Globe, Keyboard, MapPin, MessageCircle, User, Bot } from "lucide-react";
import logoImg from "@/assets/logo.jpeg";
import heroCharImg from "@/assets/hero-character.webp";
import heroPlaceholder from "@/assets/hero-character-placeholder.webp";
import { useSession } from "@/hooks/useSession";
import { ThemeToggle } from "@/components/ThemeToggle";
import GlobalChat from "@/components/GlobalChat";
import { readPlayerSession, writePlayerSession } from "@/lib/playerSession";
const ParticleBackground = lazy(() => import("@/components/ParticleBackground"));
import { supabase } from "@/integrations/supabase/client";
import { aggregateProgrammingScores } from "@/lib/programmingRanking";

const HeroImage = ({ className }: { className?: string }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative ${className || ""}`}>
      <img src={heroPlaceholder} alt="" className={`w-full h-auto ${loaded ? "hidden" : "block"} blur-md`} width="512" height="512" />
      <img
        src={heroCharImg}
        alt="Personagem Eu Vou Jogar"
        className={`w-full h-auto transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0 absolute inset-0"}`}
        width="512" height="512"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const { sessionId, playerCode, registerIdentity, restoreFromTag } = useSession();
  const [rightTab, setRightTab] = useState<"hero" | "chat">("hero");
  const [playerName, setPlayerName] = useState(() => readPlayerSession("playerName") || "");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"name" | "idle" | "choose" | "create" | "join">("name");
  const [selectedGame, setSelectedGame] = useState<"digitar" | "acertar" | "programar">("digitar");
  const [restoring, setRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState(false);
  const [restoreInput, setRestoreInput] = useState("");
  const [displayCount, setDisplayCount] = useState(0);
  const [isLiveOnline, setIsLiveOnline] = useState(false);
  const [champions, setChampions] = useState({
    digitar: null as { name: string; result: string } | null,
    acertar: null as { name: string; result: string } | null,
    programar: null as { name: string; result: string } | null,
  });

  // Real-time online + fallback to monthly unique players
  useEffect(() => {
    const sessionId = readPlayerSession("sessionId") || crypto.randomUUID();
    writePlayerSession("sessionId", sessionId);

    let monthlyCount = 0;

    // Fetch monthly unique players as fallback
    const fetchMonthly = async () => {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("player_identities")
        .select("*", { count: "exact", head: true })
        .gte("created_at", firstOfMonth);
      monthlyCount = count || 0;
    };

    fetchMonthly();

    const channel = supabase.channel("online-presence", {
      config: { presence: { key: sessionId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const liveCount = Object.keys(state).length;
        if (liveCount >= 20) {
          setDisplayCount(liveCount);
          setIsLiveOnline(true);
        } else {
          // Show monthly players when few are online
          setDisplayCount(Math.max(monthlyCount, liveCount));
          setIsLiveOnline(false);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadChampions = async () => {
      const [typingResult, acertarResult, programmingResult, programmingProgressResult] = await Promise.all([
        supabase
          .from("round_results")
          .select("wpm, room_players!inner(name)")
          .order("wpm", { ascending: false })
          .limit(1),
        supabase
          .from("acertar_scores")
          .select("player_name, score")
          .order("score", { ascending: false })
          .limit(1),
        supabase
          .from("programming_scores")
          .select("player_name, player_code, score, arena_level, challenge_number"),
        supabase
          .from("programming_progress")
          .select("session_id, total_points")
          .gt("total_points", 0)
          .order("total_points", { ascending: false })
          .limit(1),
      ]);
      if (cancelled) return;

      const typingTop = typingResult.data?.[0] as any;
      const acertarTop = acertarResult.data?.[0];
      let programmingTop = programmingResult.data
        ? aggregateProgrammingScores(programmingResult.data).sort((left, right) => right.totalScore - left.totalScore)[0]
        : undefined;

      if (!programmingTop && programmingProgressResult.data?.[0]) {
        const legacyTop = programmingProgressResult.data[0];
        const { data: identity } = await supabase
          .from("player_identities")
          .select("name, player_code")
          .eq("session_id", legacyTop.session_id)
          .maybeSingle();
        if (identity) {
          programmingTop = {
            playerName: identity.name,
            playerCode: identity.player_code,
            totalScore: legacyTop.total_points,
            bestScore: legacyTop.total_points,
            challengesCompleted: 0,
          };
        }
      }
      if (cancelled) return;

      setChampions({
        digitar: typingTop ? { name: typingTop.room_players.name, result: `${typingTop.wpm} WPM` } : null,
        acertar: acertarTop ? { name: acertarTop.player_name, result: `${acertarTop.score} pts` } : null,
        programar: programmingTop ? { name: programmingTop.playerName, result: `${programmingTop.totalScore} pts` } : null,
      });
    };

    void loadChampions();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNameChange = (value: string) => {
    setPlayerName(value);
  };

  const handleSelectGame = (game: "digitar" | "acertar" | "programar") => {
    setSelectedGame(game);
    if (mode !== "name") setMode("idle");
  };

  const handleToggleRestore = () => {
    if (restoreMode) {
      // Going back to name mode
      setRestoreMode(false);
      setRestoreInput("");
    } else {
      setRestoreMode(true);
      setRestoreInput("");
    }
  };

  const handleConfirm = async () => {
    if (restoreMode) {
      // Try to restore from code
      const code = restoreInput.trim();
      if (!code) return;
      setRestoring(true);
      // Support both "Name#123456" and just "123456"
      const tag = code.includes("#") ? code : `_#${code}`;
      const match = tag.match(/#(\d{6})$/);
      if (match) {
        const { data } = await supabase
          .from("player_identities")
          .select("session_id, name, player_code")
          .eq("player_code", match[1])
          .maybeSingle();
        if (data) {
          writePlayerSession("sessionId", data.session_id);
          writePlayerSession("playerCode", data.player_code);
          writePlayerSession("playerName", data.name);
          setPlayerName(data.name);
          setRestoreMode(false);
          setRestoreInput("");
          setMode("idle");
        }
      }
      setRestoring(false);
    } else {
      // Normal name confirm
      if (playerName.trim()) {
        writePlayerSession("playerName", playerName.trim());
        // Register identity so the player has a code for the global chat
        if (!playerCode) registerIdentity(playerName.trim()).catch(() => {});
        setMode(mode === "name" ? "idle" : "name");
      }
    }
  };

  const handleSolo = () => {
    if (!playerName.trim()) return;
    writePlayerSession("playerName", playerName.trim());
    navigate("/game", { state: { playerName: playerName.trim(), action: "solo" } });
  };

  const handleCreate = () => {
    if (!playerName.trim()) return;
    writePlayerSession("playerName", playerName.trim());
    navigate("/game", { state: { playerName: playerName.trim(), action: "create" } });
  };

  const handleJoin = () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    writePlayerSession("playerName", playerName.trim());
    navigate("/game", { state: { playerName: playerName.trim(), roomCode: joinCode.trim().toUpperCase(), action: "join" } });
  };

  const handleProgramar = () => {
    if (!playerName.trim()) return;
    writePlayerSession("playerName", playerName.trim());
    window.location.assign("/eu-vou-programar/");
  };

  const savedCode = playerCode || readPlayerSession("playerCode");

  return (
    <div className="home-shell min-h-[100dvh] relative overflow-x-hidden flex flex-col">
      <Suspense fallback={null}><ParticleBackground /></Suspense>

      {/* ─── NAVBAR ─── */}
      <nav className="home-navbar relative z-20 flex items-center justify-between px-3 sm:px-4 md:px-8 py-2 sm:py-3" aria-label="Navegação principal">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="home-brand flex items-center gap-2 glass-card px-3 py-1.5 sm:px-4 sm:py-2"
        >
          <img src={logoImg} alt="Eu Vou Jogar" className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg" width="32" height="32" />
          <span className="font-display font-bold text-primary text-sm sm:text-lg">Eu Vou Jogar</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="home-desktop-nav hidden md:flex items-center gap-1 glass-card px-2 py-1"
        >
          {[
            { label: "Início", href: "/" },
            { label: "Como Jogar", href: "/sobre" },
            { label: "Rankings", href: "/ranking" },
            { label: "Sobre", href: "/sobre" },
          ].map((link) => (
            <button
              key={link.label}
              onClick={() => navigate(link.href)}
              className="px-3 lg:px-4 py-2 rounded-xl text-sm font-body font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            >
              {link.label}
            </button>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="home-nav-actions"
        >
          <button type="button" onClick={() => navigate("/ranking")} className="home-mobile-ranking md:hidden" aria-label="Abrir ranking global">
            <Trophy className="w-4 h-4" />
            <span>Ranking</span>
          </button>
          <ThemeToggle />
        </motion.div>
      </nav>

      {/* ─── MAIN CONTENT ─── */}
      <main className="home-main relative z-10 flex-1 flex flex-col items-stretch lg:items-center px-3 sm:px-4 md:px-8 lg:px-16 py-2 sm:py-4">
        <div className="home-layout w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-center">

          {/* LEFT COLUMN — Fibonacci hierarchy: gaps escalam em φ (≈1.618):
              2→3→5→8→13. Tamanhos e ênfase priorizam o caminho do usuário:
              1º Nome  →  2º Tipo de jogo  →  3º Ação principal  →  4º Features  →  5º Ranking */}
          <div className="home-content flex flex-col gap-[13px] sm:gap-[21px]">
            <div className="home-intro-card">
              {/* Character on mobile - compact and beside the title */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="home-mobile-character flex lg:hidden items-center justify-center relative"
                aria-hidden="true"
              >
                <div className="home-mobile-character-ring absolute aspect-square rounded-full border-2 border-primary/30 animate-pulse-glow" />
                <HeroImage className="home-mobile-character-image relative z-10 drop-shadow-2xl" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="home-hero-copy"
              >
                <span className="home-eyebrow"><Zap className="w-3.5 h-3.5" /> Aprender brincando</span>
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold leading-tight">
                  <span className="text-gradient-primary italic">Eu Vou</span>
                  <br />
                  <span className="text-gradient-fun italic">Jogar</span>
                  <span className="text-primary inline-block animate-pulse-glow ml-2">⚡</span>
                </h1>
                <p className="text-sm sm:text-base lg:text-lg text-muted-foreground font-body mt-2 sm:mt-3 max-w-lg">
                  Jogos educacionais para aprender, competir e se divertir gratuitamente.
                </p>
              </motion.div>
            </div>

            {/* PRIORIDADE 2 — Seletor de jogo (escala φ³, peso forte) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="home-game-switcher"
              aria-label="Escolha um jogo"
            >
              <button
                onClick={() => handleSelectGame("digitar")}
                aria-pressed={selectedGame === "digitar"}
                className={`home-game-option flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-2xl font-display font-bold text-base sm:text-lg transition-all ${
                  selectedGame === "digitar"
                    ? "bg-primary text-primary-foreground glow-primary shadow-lg scale-[1.05]"
                    : "glass-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="home-game-icon"><Keyboard className="w-5 h-5" /></span>
                <span>Digitar</span>
              </button>
              <button
                onClick={() => handleSelectGame("acertar")}
                aria-pressed={selectedGame === "acertar"}
                className={`home-game-option flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-2xl font-display font-bold text-base sm:text-lg transition-all ${
                  selectedGame === "acertar"
                    ? "bg-secondary text-secondary-foreground glow-secondary shadow-lg scale-[1.05]"
                    : "glass-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="home-game-icon"><MapPin className="w-5 h-5" /></span>
                <span>Acertar</span>
              </button>
              <button
                onClick={() => handleSelectGame("programar")}
                aria-pressed={selectedGame === "programar"}
                className={`home-game-option flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-2xl font-display font-bold text-base sm:text-lg transition-all ${
                  selectedGame === "programar"
                    ? "bg-primary text-primary-foreground glow-primary shadow-lg scale-[1.05]"
                    : "glass-card text-muted-foreground hover:text-foreground hover:border-primary/60"
                }`}
              >
                <span className="home-game-icon"><Bot className="w-5 h-5" /></span>
                <span>Programar</span>
              </button>
            </motion.div>

            {/* PRIORIDADE 1 — Entrada de Nome (gateway obrigatório) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="home-player-card glass-card p-3 sm:p-5"
            >
              <div className="home-player-header flex items-center gap-2 mb-1.5 sm:mb-2">
                <label className="text-xs sm:text-sm font-body font-semibold text-muted-foreground">
                  {restoreMode ? "Restaurar conta:" : "Seu nome:"}
                </label>
                <button
                  onClick={handleToggleRestore}
                  className="text-xs text-primary hover:underline font-body"
                >
                  {restoreMode ? "Voltar" : "Já tenho um código"}
                </button>
              </div>
              <div className="home-name-row flex gap-2">
                {restoreMode ? (
                  <input
                    type="text"
                    value={restoreInput}
                    onChange={(e) => setRestoreInput(e.target.value)}
                    placeholder="Digite o código aqui (ex: 123456)"
                    maxLength={30}
                    className="home-name-input flex-1 bg-muted rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    disabled={restoring}
                  />
                ) : (
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Digite seu nome..."
                    maxLength={30}
                    className="home-name-input flex-1 bg-muted rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    disabled={restoring}
                  />
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleConfirm}
                  disabled={restoreMode ? !restoreInput.trim() || restoring : !playerName.trim()}
                  className="home-confirm-button p-2.5 sm:p-3 rounded-xl bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={restoreMode ? "Restaurar conta" : mode === "name" ? "Continuar" : "Trocar jogador"}
                >
                  <span>{restoreMode ? restoring ? "Buscando…" : "Restaurar" : mode === "name" ? "Continuar" : "Trocar"}</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </motion.button>
              </div>
              {savedCode && !restoreMode && (
                <p className="text-xs text-muted-foreground font-body mt-1.5 sm:mt-2">
                  Seu código: <span className="text-accent font-bold select-all">{playerName || "Jogador"}#{savedCode}</span>
                </p>
              )}
            </motion.div>

            {/* Action Buttons Row */}
            {mode === "name" ? null : selectedGame === "programar" ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleProgramar}
                  disabled={!playerName.trim()}
                  className="home-primary-action w-full py-3 sm:py-4 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-base sm:text-lg glow-primary hover:brightness-110 transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Bot className="w-5 h-5" />
                  Entrar no Eu Vou Programar
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            ) : selectedGame === "acertar" ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/acertar")}
                  className="home-primary-action w-full py-3 sm:py-4 rounded-2xl bg-secondary text-secondary-foreground font-display font-bold text-base sm:text-lg glow-secondary hover:brightness-110 transition-all flex items-center justify-center gap-3"
                >
                  🎈 Jogar Eu Vou Acertar
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            ) : mode === "idle" ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="home-play-options flex flex-col sm:flex-row gap-2 sm:gap-3"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSolo}
                  disabled={!playerName.trim()}
                  className="home-play-option flex-1 flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl glass-card hover:border-primary/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors shrink-0">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <span className="font-display font-bold text-foreground block text-sm sm:text-base">Jogar Sozinho</span>
                    <span className="text-xs text-muted-foreground">Treine no seu ritmo</span>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => playerName.trim() ? setMode("choose") : null}
                  disabled={!playerName.trim()}
                  className="home-play-option flex-1 flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl glass-card hover:border-secondary/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-secondary/20 flex items-center justify-center group-hover:bg-secondary/30 transition-colors shrink-0">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
                  </div>
                  <div className="text-left">
                    <span className="font-display font-bold text-foreground block text-sm sm:text-base">Jogar Multiplayer</span>
                    <span className="text-xs text-muted-foreground">Desafie outros jogadores</span>
                  </div>
                </motion.button>
              </motion.div>
            ) : mode === "choose" ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 sm:space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setMode("create")}
                    className="glass-card p-4 sm:p-5 flex flex-col items-center gap-2 hover:border-primary/50 transition-all group"
                  >
                    <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    <span className="font-display font-bold text-foreground text-xs sm:text-sm">Criar Sala</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setMode("join")}
                    className="glass-card p-4 sm:p-5 flex flex-col items-center gap-2 hover:border-secondary/50 transition-all group"
                  >
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                    <span className="font-display font-bold text-foreground text-xs sm:text-sm">Entrar na Sala</span>
                  </motion.button>
                </div>
                <button onClick={() => setMode("idle")} className="w-full px-4 py-2 rounded-xl bg-muted text-foreground font-body text-sm hover:bg-muted/80 transition-colors">Voltar</button>
              </motion.div>
            ) : mode === "create" ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 sm:p-6 text-center">
                <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-primary mx-auto mb-2 sm:mb-3" />
                <h3 className="font-display font-bold text-base sm:text-lg text-foreground mb-1">Criar Sala</h3>
                <p className="text-muted-foreground text-xs sm:text-sm mb-3 sm:mb-4 font-body">Você será o dono da sala</p>
                <div className="flex gap-2 sm:gap-3">
                  <button onClick={() => setMode("idle")} className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl bg-muted text-foreground font-body text-sm">Voltar</button>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleCreate}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-primary">
                    Criar <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 sm:p-6">
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-secondary mx-auto mb-2 sm:mb-3" />
                <h3 className="font-display font-bold text-base sm:text-lg text-foreground mb-1 text-center">Entrar na Sala</h3>
                <input
                  type="text" value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Código da sala"
                  maxLength={6}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 sm:py-3 text-foreground text-center text-lg sm:text-xl font-display tracking-[0.3em] placeholder:text-muted-foreground/50 placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all mb-2 sm:mb-3"
                />
                <div className="flex gap-2 sm:gap-3">
                  <button onClick={() => setMode("idle")} className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl bg-muted text-foreground font-body text-sm">Voltar</button>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleJoin} disabled={!joinCode.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl bg-secondary text-secondary-foreground font-display font-bold glow-secondary disabled:opacity-40">
                    Entrar <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* PRIORIDADE 4 — Feature Pills (informação de apoio, peso φ¹) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="home-feature-pills flex flex-wrap gap-[5px] sm:gap-[8px] justify-center lg:justify-start"
            >
              {(selectedGame === "digitar"
                ? [
                    { icon: <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "Velocidade" },
                    { icon: <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "Multiplayer" },
                    { icon: <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "Rankings" },
                  ]
                : selectedGame === "acertar" ? [
                    { icon: <Calculator className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "Matemática" },
                    { icon: <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "Agilidade" },
                    { icon: <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "6 Fases" },
                  ] : [
                    { icon: <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "Robótica" },
                    { icon: <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "30 desafios" },
                    { icon: <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "Ranking próprio" },
                  ]
              ).map((pill) => (
                <span key={pill.text} className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-muted/40 text-muted-foreground/80 text-[11px] sm:text-xs font-body">
                  {pill.icon} {pill.text}
                </span>
              ))}
            </motion.div>

            {/* Ranking Global — botão visível e destacado */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/ranking")}
              className="home-ranking-button self-center flex items-center gap-3 px-6 sm:px-8 py-2.5 sm:py-3 rounded-2xl border-2 border-accent/50 bg-accent/10 text-accent font-display font-bold text-sm sm:text-base hover:bg-accent/20 hover:border-accent transition-all glow-accent"
            >
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
              Ranking Global
            </motion.button>

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="home-champions w-full glass-card p-3 sm:p-4"
              aria-labelledby="home-trophies-title"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p id="home-trophies-title" className="font-display font-bold text-sm text-foreground">🏆 Campeões de cada jogo</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Cada módulo possui sua própria disputa.</p>
                </div>
                <button onClick={() => navigate("/ranking")} className="text-[10px] sm:text-xs font-bold text-primary hover:underline">Ver todos</button>
              </div>
              <div className="home-champions-grid grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  { key: "digitar" as const, icon: "⌨️", label: "Eu Vou Digitar" },
                  { key: "acertar" as const, icon: "🎈", label: "Eu Vou Acertar" },
                  { key: "programar" as const, icon: "🤖", label: "Eu Vou Programar" },
                ]).map((game) => {
                  const champion = champions[game.key];
                  return (
                    <button
                      key={game.key}
                      onClick={() => navigate(`/ranking?tab=${game.key}`)}
                      className="home-champion-card flex items-center gap-2 rounded-xl bg-muted/55 px-3 py-2 text-left hover:bg-muted transition-colors"
                    >
                      <span className="text-lg" aria-hidden="true">{game.icon}</span>
                      <span className="min-w-0">
                        <b className="block truncate text-[10px] text-foreground">{game.label}</b>
                        <small className="block truncate text-[9px] text-muted-foreground">
                          {champion ? `${champion.name} · ${champion.result}` : "Seja o primeiro campeão"}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          </div>

          {/* RIGHT COLUMN - Tabbed: Personagem | Chat Global (desktop only) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="home-side hidden lg:flex flex-col gap-3 h-[560px]"
          >
            {/* Tab switcher — Chat só aparece após confirmar o nome */}
            {mode !== "name" && (
            <div className="flex gap-1 p-1 glass-card self-center">
              <button
                onClick={() => setRightTab("hero")}
                aria-pressed={rightTab === "hero"}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-display font-bold transition-all ${
                  rightTab === "hero" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Personagem
              </button>
              <button
                onClick={() => setRightTab("chat")}
                aria-pressed={rightTab === "chat"}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-display font-bold transition-all relative ${
                  rightTab === "chat" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Chat Global
                {rightTab !== "chat" && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}
              </button>
            </div>
            )}

            {/* Tab content */}
            <div className="flex-1 flex items-center justify-center relative min-h-0">
              {rightTab === "hero" || mode === "name" ? (
                <motion.div
                  key="hero"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full flex items-center justify-center relative"
                >
                  <div className="absolute w-[80%] aspect-square rounded-full border-2 border-primary/30 animate-pulse-glow" />
                  <div className="absolute w-[70%] aspect-square rounded-full border border-primary/15 animate-float" />
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <HeroImage className="relative z-10 w-full max-w-md drop-shadow-2xl" />
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full">
                  <GlobalChat
                    sessionId={sessionId}
                    playerName={playerName}
                    playerCode={playerCode || ""}
                  />
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        {/* MOBILE: Chat Global below the main content — só após confirmar nome */}
        {mode !== "name" && (
          <div className="home-mobile-chat lg:hidden w-full max-w-7xl mx-auto mt-6 px-0 sm:px-0">
            <GlobalChat
              sessionId={sessionId}
              playerName={playerName}
              playerCode={playerCode || ""}
              compact
            />
          </div>
        )}
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="home-footer relative z-10 flex flex-col sm:flex-row items-center justify-between px-3 sm:px-4 md:px-8 py-2 sm:py-4 gap-2 sm:gap-3" role="contentinfo">
        <div className="flex items-center gap-3 sm:gap-4 text-xs text-muted-foreground font-body">
          <span className="flex items-center gap-1"><Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" /> Seguro</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Gift className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" /> Gratuito</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-secondary" /> Para todas as idades</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
          <div className="flex -space-x-2">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/40 border-2 border-background" />
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-secondary/40 border-2 border-background" />
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-accent/40 border-2 border-background" />
          </div>
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${isLiveOnline ? 'bg-primary' : 'bg-accent'} animate-pulse`} />
            {displayCount} {isLiveOnline ? (displayCount === 1 ? "jogador online" : "jogadores online") : (displayCount === 1 ? "jogador este mês" : "jogadores este mês")}
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
