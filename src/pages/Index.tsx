import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Zap, Trophy, ArrowRight, Plus, Calculator, Shield, Gift, Globe, Keyboard, MapPin } from "lucide-react";
import logoImg from "@/assets/logo.jpeg";
import heroCharImg from "@/assets/hero-character.png";
import { useSession } from "@/hooks/useSession";
import { ThemeToggle } from "@/components/ThemeToggle";
import ParticleBackground from "@/components/ParticleBackground";

const Index = () => {
  const navigate = useNavigate();
  const { restoreFromTag } = useSession();
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("typerace_player_name") || "");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"idle" | "choose" | "create" | "join">("idle");
  const [selectedGame, setSelectedGame] = useState<"digitar" | "acertar">("digitar");
  const [restoring, setRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState(false);

  const handleNameChange = (value: string) => {
    setPlayerName(value);
  };

  const handleNameBlur = async () => {
    const match = playerName.match(/^(.+)#(\d{6})$/);
    if (match) {
      setRestoring(true);
      const result = await restoreFromTag(playerName);
      if (result) {
        setPlayerName(result.name);
      }
      setRestoring(false);
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
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      <ParticleBackground />

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
      <nav className="relative z-20 flex items-center justify-between px-4 md:px-8 py-3">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 glass-card px-4 py-2"
        >
          <img src={logoImg} alt="Eu Vou Jogar" className="w-8 h-8 rounded-lg" width="32" height="32" />
          <span className="font-display font-bold text-primary text-lg">Eu Vou Jogar</span>
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
              className="px-4 py-2 rounded-xl text-sm font-body font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
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
      <main className="relative z-10 flex-1 flex items-center px-4 md:px-8 lg:px-16 py-4">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-6">
            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight">
                <span className="text-gradient-primary italic">Eu Vou</span>
                <br />
                <span className="text-gradient-fun italic">Jogar</span>
                <span className="text-primary inline-block animate-pulse-glow ml-2">⚡</span>
              </h1>
              <p className="text-lg text-muted-foreground font-body mt-4 max-w-lg">
                Jogos educacionais e infantis online — escolha e jogue grátis!
              </p>
            </motion.div>

            {/* Game Selector Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex gap-3"
            >
              <button
                onClick={() => setSelectedGame("digitar")}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-display font-bold text-lg transition-all ${
                  selectedGame === "digitar"
                    ? "bg-primary text-primary-foreground glow-primary shadow-lg"
                    : "glass-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Keyboard className="w-5 h-5" />
                Digitar
              </button>
              <button
                onClick={() => setSelectedGame("acertar")}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-display font-bold text-lg transition-all ${
                  selectedGame === "acertar"
                    ? "bg-secondary text-secondary-foreground glow-secondary shadow-lg"
                    : "glass-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <MapPin className="w-5 h-5" />
                Acertar 🎈
              </button>
            </motion.div>

            {/* Feature Pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-3"
            >
              {(selectedGame === "digitar"
                ? [
                    { icon: <Zap className="w-4 h-4" />, text: "Velocidade" },
                    { icon: <Users className="w-4 h-4" />, text: "Multiplayer" },
                    { icon: <Trophy className="w-4 h-4" />, text: "Rankings" },
                  ]
                : [
                    { icon: <Calculator className="w-4 h-4" />, text: "Matemática" },
                    { icon: <Zap className="w-4 h-4" />, text: "Agilidade" },
                    { icon: <Trophy className="w-4 h-4" />, text: "6 Fases" },
                  ]
              ).map((pill) => (
                <span key={pill.text} className="flex items-center gap-2 px-4 py-2 rounded-full glass-card text-muted-foreground text-sm font-body font-semibold">
                  {pill.icon} {pill.text}
                </span>
              ))}
            </motion.div>

            {/* Name Input Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass-card p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-body font-semibold text-muted-foreground">
                  Seu nome:
                </label>
                {savedCode && (
                  <button
                    onClick={() => setRestoreMode(!restoreMode)}
                    className="text-xs text-primary hover:underline font-body"
                  >
                    {restoreMode ? "Voltar" : "(Mal só usa código para restaurar)"}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={handleNameBlur}
                  placeholder={restoreMode && savedCode ? `Ex: MeuNome#${savedCode}` : "Digite seu nome..."}
                  maxLength={30}
                  className="flex-1 bg-muted rounded-xl px-4 py-3 text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  disabled={restoring}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => playerName.trim() && setMode("idle")}
                  className="p-3 rounded-xl bg-primary text-primary-foreground hover:brightness-110 transition-all"
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </div>
              {savedCode && (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground font-body">
                    Seu código: <span className="text-accent font-bold select-all">{playerName || "Jogador"}#{savedCode}</span>
                  </p>
                  <button
                    onClick={() => setRestoreMode(!restoreMode)}
                    className="text-xs text-primary hover:underline font-body"
                  >
                    Restaurar código
                  </button>
                </div>
              )}
            </motion.div>

            {/* Action Buttons Row */}
            {selectedGame === "acertar" ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/acertar")}
                  className="w-full py-4 rounded-2xl bg-secondary text-secondary-foreground font-display font-bold text-lg glow-secondary hover:brightness-110 transition-all flex items-center justify-center gap-3"
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
                className="flex flex-col sm:flex-row gap-3"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSolo}
                  disabled={!playerName.trim()}
                  className="flex-1 flex items-center gap-3 px-6 py-4 rounded-2xl glass-card hover:border-primary/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <span className="font-display font-bold text-foreground block">Jogar Sozinho</span>
                    <span className="text-xs text-muted-foreground">Treine no seu ritmo</span>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => playerName.trim() ? setMode("choose") : null}
                  disabled={!playerName.trim()}
                  className="flex-1 flex items-center gap-3 px-6 py-4 rounded-2xl glass-card hover:border-secondary/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center group-hover:bg-secondary/30 transition-colors">
                    <Users className="w-5 h-5 text-secondary" />
                  </div>
                  <div className="text-left">
                    <span className="font-display font-bold text-foreground block">Jogar Multiplayer</span>
                    <span className="text-xs text-muted-foreground">Desafie outros jogadores</span>
                  </div>
                </motion.button>
              </motion.div>
            ) : mode === "choose" ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setMode("create")}
                    className="glass-card p-5 flex flex-col items-center gap-2 hover:border-primary/50 transition-all group"
                  >
                    <Plus className="w-6 h-6 text-primary" />
                    <span className="font-display font-bold text-foreground text-sm">Criar Sala</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setMode("join")}
                    className="glass-card p-5 flex flex-col items-center gap-2 hover:border-secondary/50 transition-all group"
                  >
                    <Users className="w-6 h-6 text-secondary" />
                    <span className="font-display font-bold text-foreground text-sm">Entrar na Sala</span>
                  </motion.button>
                </div>
                <button onClick={() => setMode("idle")} className="w-full px-4 py-2 rounded-xl bg-muted text-foreground font-body text-sm hover:bg-muted/80 transition-colors">Voltar</button>
              </motion.div>
            ) : mode === "create" ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 text-center">
                <Plus className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-display font-bold text-lg text-foreground mb-1">Criar Sala</h3>
                <p className="text-muted-foreground text-sm mb-4 font-body">Você será o dono da sala</p>
                <div className="flex gap-3">
                  <button onClick={() => setMode("idle")} className="flex-1 px-4 py-3 rounded-xl bg-muted text-foreground font-body text-sm">Voltar</button>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleCreate}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-primary">
                    Criar <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
                <Users className="w-8 h-8 text-secondary mx-auto mb-3" />
                <h3 className="font-display font-bold text-lg text-foreground mb-1 text-center">Entrar na Sala</h3>
                <input
                  type="text" value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Código da sala"
                  maxLength={6}
                  className="w-full bg-muted rounded-xl px-4 py-3 text-foreground text-center text-xl font-display tracking-[0.3em] placeholder:text-muted-foreground/50 placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all mb-3"
                />
                <div className="flex gap-3">
                  <button onClick={() => setMode("idle")} className="flex-1 px-4 py-3 rounded-xl bg-muted text-foreground font-body text-sm">Voltar</button>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleJoin} disabled={!joinCode.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary text-secondary-foreground font-display font-bold glow-secondary disabled:opacity-40">
                    Entrar <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Ranking Global Button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/ranking")}
              className="self-start flex items-center gap-3 px-8 py-3 rounded-2xl border-2 border-accent/50 bg-accent/10 text-accent font-display font-bold hover:bg-accent/20 hover:border-accent transition-all glow-accent"
            >
              <Trophy className="w-5 h-5" />
              Ranking Global
            </motion.button>
          </div>

          {/* RIGHT COLUMN - Character */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="hidden lg:flex items-center justify-center relative"
          >
            {/* Glow ring */}
            <div className="absolute w-[90%] aspect-square rounded-full border-2 border-primary/30 animate-pulse-glow" />
            <div className="absolute w-[80%] aspect-square rounded-full border border-primary/15 animate-float" />
            <motion.img
              src={heroCharImg}
              alt="Personagem Eu Vou Jogar"
              className="relative z-10 w-full max-w-lg drop-shadow-2xl"
              width="1024"
              height="1024"
              loading="eager"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 flex flex-col sm:flex-row items-center justify-between px-4 md:px-8 py-4 gap-3" role="contentinfo">
        <div className="flex items-center gap-4 text-xs text-muted-foreground font-body">
          <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-primary" /> Seguro</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5 text-accent" /> Gratuito</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5 text-secondary" /> Para todas as idades</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full bg-primary/40 border-2 border-background" />
            <div className="w-6 h-6 rounded-full bg-secondary/40 border-2 border-background" />
            <div className="w-6 h-6 rounded-full bg-accent/40 border-2 border-background" />
          </div>
          <span>• 12.4k jogadores online</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
