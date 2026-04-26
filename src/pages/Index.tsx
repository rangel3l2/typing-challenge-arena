import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Zap, Trophy, ArrowRight, Plus, Calculator, Shield, Gift, Globe, Keyboard, MapPin, MessageCircle, User } from "lucide-react";
import logoImg from "@/assets/logo.jpeg";
import heroCharImg from "@/assets/hero-character.webp";
import heroPlaceholder from "@/assets/hero-character-placeholder.webp";
import { useSession } from "@/hooks/useSession";
import { ThemeToggle } from "@/components/ThemeToggle";
import GlobalChat from "@/components/GlobalChat";
const ParticleBackground = lazy(() => import("@/components/ParticleBackground"));
import { supabase } from "@/integrations/supabase/client";

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
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("typerace_player_name") || "");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"name" | "idle" | "choose" | "create" | "join">("name");
  const [selectedGame, setSelectedGame] = useState<"digitar" | "acertar">("digitar");
  const [restoring, setRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState(false);
  const [restoreInput, setRestoreInput] = useState("");
  const [displayCount, setDisplayCount] = useState(0);
  const [isLiveOnline, setIsLiveOnline] = useState(false);

  // Real-time online + fallback to monthly unique players
  useEffect(() => {
    const sessionId = localStorage.getItem("typerace_session_id") || crypto.randomUUID();
    localStorage.setItem("typerace_session_id", sessionId);

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

  const handleNameChange = (value: string) => {
    setPlayerName(value);
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
          localStorage.setItem("typerace_session_id", data.session_id);
          localStorage.setItem("typerace_player_code", data.player_code);
          localStorage.setItem("typerace_player_name", data.name);
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
        localStorage.setItem("typerace_player_name", playerName.trim());
        // Register identity so the player has a code for the global chat
        if (!playerCode) registerIdentity(playerName.trim()).catch(() => {});
        setMode(mode === "name" ? "idle" : "name");
      }
    }
  };

  const handleSolo = () => {
    if (!playerName.trim()) return;
    localStorage.setItem("typerace_player_name", playerName.trim());
    navigate("/game", { state: { playerName: playerName.trim(), action: "solo" } });
  };

  const handleCreate = () => {
    if (!playerName.trim()) return;
    localStorage.setItem("typerace_player_name", playerName.trim());
    navigate("/game", { state: { playerName: playerName.trim(), action: "create" } });
  };

  const handleJoin = () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    localStorage.setItem("typerace_player_name", playerName.trim());
    navigate("/game", { state: { playerName: playerName.trim(), roomCode: joinCode.trim().toUpperCase(), action: "join" } });
  };

  const savedCode = localStorage.getItem("typerace_player_code");

  return (
    <div className="min-h-[100dvh] relative overflow-x-hidden flex flex-col">
      <Suspense fallback={null}><ParticleBackground /></Suspense>

      {/* SEO hidden content */}
      <header className="sr-only">
        <nav aria-label="Navegação principal">
          <ul>
            <li><a href="/">Início - Eu Vou Jogar</a></li>
            <li><a href="/acertar">Eu Vou Acertar - Jogo de Matemática</a></li>
            <li><a href="/ranking">Ranking Global - Jogos Educacionais</a></li>
          </ul>
        </nav>
      </header>
      <section className="sr-only" aria-label="Sobre o Eu Vou Jogar">
        <h2>Jogos Educacionais e Infantis Online Grátis</h2>
        <p>Eu Vou Jogar é a melhor plataforma de jogos educacionais, jogos educativos e jogos infantis online grátis do Brasil.</p>
      </section>

      {/* ─── NAVBAR ─── */}
      <nav className="relative z-20 flex items-center justify-between px-3 sm:px-4 md:px-8 py-2 sm:py-3">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 glass-card px-3 py-1.5 sm:px-4 sm:py-2"
        >
          <img src={logoImg} alt="Eu Vou Jogar" className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg" width="32" height="32" />
          <span className="font-display font-bold text-primary text-sm sm:text-lg">Eu Vou Jogar</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden md:flex items-center gap-1 glass-card px-2 py-1"
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
        >
          <ThemeToggle />
        </motion.div>
      </nav>

      {/* ─── MAIN CONTENT ─── */}
      <main className="relative z-10 flex-1 flex items-start lg:items-center px-3 sm:px-4 md:px-8 lg:px-16 py-2 sm:py-4">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-center">

          {/* LEFT COLUMN — Fibonacci hierarchy: gaps escalam em φ (≈1.618):
              2→3→5→8→13. Tamanhos e ênfase priorizam o caminho do usuário:
              1º Nome  →  2º Tipo de jogo  →  3º Ação principal  →  4º Features  →  5º Ranking */}
          <div className="flex flex-col gap-[13px] sm:gap-[21px]">
            {/* Character on mobile - shown above title */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="flex lg:hidden items-center justify-center relative"
            >
              <div className="absolute w-[70%] aspect-square rounded-full border-2 border-primary/30 animate-pulse-glow" />
              <HeroImage className="relative z-10 w-40 sm:w-52 md:w-64 drop-shadow-2xl" />
            </motion.div>

            {/* Title — peso visual máximo (φ⁴), centralizado */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold leading-tight">
                <span className="text-gradient-primary italic">Eu Vou</span>
                <br />
                <span className="text-gradient-fun italic">Jogar</span>
                <span className="text-primary inline-block animate-pulse-glow ml-2">⚡</span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground font-body mt-2 sm:mt-3 max-w-lg mx-auto">
                Jogos educacionais e infantis online — escolha e jogue grátis!
              </p>
            </motion.div>

            {/* PRIORIDADE 2 — Seletor de jogo (escala φ³, peso forte) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex gap-[8px] sm:gap-[13px] justify-center"
            >
              <button
                onClick={() => setSelectedGame("digitar")}
                aria-pressed={selectedGame === "digitar"}
                className={`flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-2xl font-display font-bold text-base sm:text-lg transition-all ${
                  selectedGame === "digitar"
                    ? "bg-primary text-primary-foreground glow-primary shadow-lg scale-[1.05]"
                    : "glass-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Keyboard className="w-5 h-5" />
                Digitar
              </button>
              <button
                onClick={() => setSelectedGame("acertar")}
                aria-pressed={selectedGame === "acertar"}
                className={`flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-2xl font-display font-bold text-base sm:text-lg transition-all ${
                  selectedGame === "acertar"
                    ? "bg-secondary text-secondary-foreground glow-secondary shadow-lg scale-[1.05]"
                    : "glass-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <MapPin className="w-5 h-5" />
                Acertar 🎈
              </button>
            </motion.div>

            {/* PRIORIDADE 1 — Entrada de Nome (gateway obrigatório) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass-card p-3 sm:p-5"
            >
              <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                <label className="text-xs sm:text-sm font-body font-semibold text-muted-foreground">
                  {restoreMode ? "Restaurar conta:" : "Seu nome:"}
                </label>
                <button
                  onClick={handleToggleRestore}
                  className="text-xs text-primary hover:underline font-body"
                >
                  {restoreMode ? "Voltar" : "(Usar código para restaurar)"}
                </button>
              </div>
              <div className="flex gap-2">
                {restoreMode ? (
                  <input
                    type="text"
                    value={restoreInput}
                    onChange={(e) => setRestoreInput(e.target.value)}
                    placeholder="Digite o código aqui (ex: 123456)"
                    maxLength={30}
                    className="flex-1 bg-muted rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    disabled={restoring}
                  />
                ) : (
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Digite seu nome..."
                    maxLength={30}
                    className="flex-1 bg-muted rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    disabled={restoring}
                  />
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleConfirm}
                  disabled={restoreMode ? !restoreInput.trim() || restoring : !playerName.trim()}
                  className="p-2.5 sm:p-3 rounded-xl bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <motion.div animate={{ rotate: !restoreMode && mode !== "name" ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </motion.div>
                </motion.button>
              </div>
              {savedCode && !restoreMode && (
                <p className="text-xs text-muted-foreground font-body mt-1.5 sm:mt-2">
                  Seu código: <span className="text-accent font-bold select-all">{playerName || "Jogador"}#{savedCode}</span>
                </p>
              )}
            </motion.div>

            {/* Action Buttons Row */}
            {mode === "name" ? null : selectedGame === "acertar" ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/acertar")}
                  className="w-full py-3 sm:py-4 rounded-2xl bg-secondary text-secondary-foreground font-display font-bold text-base sm:text-lg glow-secondary hover:brightness-110 transition-all flex items-center justify-center gap-3"
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
                className="flex flex-col sm:flex-row gap-2 sm:gap-3"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSolo}
                  disabled={!playerName.trim()}
                  className="flex-1 flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl glass-card hover:border-primary/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
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
                  className="flex-1 flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl glass-card hover:border-secondary/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
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
              className="flex flex-wrap gap-[5px] sm:gap-[8px] justify-center lg:justify-start"
            >
              {(selectedGame === "digitar"
                ? [
                    { icon: <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "Velocidade" },
                    { icon: <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "Multiplayer" },
                    { icon: <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "Rankings" },
                  ]
                : [
                    { icon: <Calculator className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "Matemática" },
                    { icon: <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "Agilidade" },
                    { icon: <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: "6 Fases" },
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
              className="self-center flex items-center gap-3 px-6 sm:px-8 py-2.5 sm:py-3 rounded-2xl border-2 border-accent/50 bg-accent/10 text-accent font-display font-bold text-sm sm:text-base hover:bg-accent/20 hover:border-accent transition-all glow-accent"
            >
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
              Ranking Global
            </motion.button>
          </div>

          {/* RIGHT COLUMN - Tabbed: Personagem | Chat Global (desktop only) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="hidden lg:flex flex-col gap-3 h-[560px]"
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
              {rightTab === "hero" ? (
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

        {/* MOBILE: Chat Global below the main content */}
        <div className="lg:hidden w-full max-w-7xl mx-auto mt-6 px-3 sm:px-0">
          <GlobalChat
            sessionId={sessionId}
            playerName={playerName}
            playerCode={playerCode || ""}
            compact
          />
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 flex flex-col sm:flex-row items-center justify-between px-3 sm:px-4 md:px-8 py-2 sm:py-4 gap-2 sm:gap-3" role="contentinfo">
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
