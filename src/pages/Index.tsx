import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Zap, Trophy, ArrowRight, Plus, Calculator } from "lucide-react";
import logoImg from "@/assets/logo.jpeg";
import { useSession } from "@/hooks/useSession";

const Index = () => {
  const navigate = useNavigate();
  const { restoreFromTag } = useSession();
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("typerace_player_name") || "");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [selectedGame, setSelectedGame] = useState<"digitar" | "acertar">("digitar");
  const [restoring, setRestoring] = useState(false);

  const handleNameChange = (value: string) => {
    setPlayerName(value);
  };

  const handleNameBlur = async () => {
    // Check if user entered a tag like "Name#123456"
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
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* SEO: Hidden semantic content for crawlers */}
      <header className="sr-only">
        <nav aria-label="Navegação principal">
          <ul>
            <li><a href="/">Início - Eu Vou Jogar</a></li>
            <li><a href="/acertar">Eu Vou Acertar - Jogo de Matemática</a></li>
            <li><a href="/ranking">Ranking Global - Jogos Educacionais</a></li>
          </ul>
        </nav>
      </header>

      {/* SEO: Rich text content for indexing */}
      <section className="sr-only" aria-label="Sobre o Eu Vou Jogar">
        <h2>Jogos Educacionais e Infantis Online Grátis</h2>
        <p>Eu Vou Jogar é a melhor plataforma de jogos educacionais, jogos educativos e jogos infantis online grátis do Brasil. Nossos jogos didáticos e lúdicos ajudam crianças e adultos a aprender digitação e matemática de forma divertida, interativa e competitiva. Aprender brincando nunca foi tão fácil com nossa plataforma de aprendizado gamificado.</p>
        <h3>Eu Vou Digitar - Jogo de Digitação Multiplayer</h3>
        <p>Aprenda a digitar rápido com o Eu Vou Digitar! Crie salas, desafie amigos em tempo real e suba no ranking global. O melhor jogo educacional de treino de digitação online, perfeito como atividade educativa para escolas e jogos de teclado para crianças.</p>
        <h3>Eu Vou Acertar - Jogo de Matemática com Balões</h3>
        <p>Teste sua agilidade mental e raciocínio lógico com o Eu Vou Acertar! Estoure balões, resolva operações matemáticas e avance por 6 fases de dificuldade crescente. Jogo infantil educativo de matemática, ideal como jogo cognitivo e atividade pedagógica online.</p>
        <h3>Por que escolher o Eu Vou Jogar?</h3>
        <ul>
          <li>100% gratuito - jogos educativos online grátis sem necessidade de cadastro</li>
          <li>Jogos educacionais e didáticos para todas as idades</li>
          <li>Multiplayer educativo em tempo real</li>
          <li>Ranking global competitivo</li>
          <li>Jogos infantis seguros, lúdicos e divertidos</li>
          <li>Brincadeiras educativas que funcionam no celular e no computador</li>
          <li>Atividades interativas para crianças do ensino fundamental</li>
          <li>Gamificação educacional para aprender brincando</li>
          <li>Jogos de raciocínio e jogos de alfabetização</li>
        </ul>
      </section>

      {/* Background decorations */}
      <div className="absolute top-10 right-20 w-64 h-64 rounded-full bg-secondary/8 animate-float blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-10 left-20 w-80 h-80 rounded-full bg-primary/8 animate-float-reverse blur-3xl" aria-hidden="true" />
      <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-accent/6 animate-pulse-glow blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-1/3 left-1/3 w-48 h-48 rounded-full bg-game-terracotta/6 animate-float blur-3xl" aria-hidden="true" />

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12" role="main">
        {/* Logo */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="mb-4"
          >
            <img
              src={logoImg}
              alt="Eu Vou Jogar - Plataforma de Jogos Educacionais e Infantis Online Grátis"
              className="w-32 h-32 md:w-40 md:h-40 rounded-3xl mx-auto shadow-2xl border-4 border-primary/30"
              width="160"
              height="160"
              loading="eager"
            />
          </motion.div>
          <h1 className="text-5xl md:text-6xl font-display font-bold text-gradient-primary mb-2">
            Eu Vou Jogar
          </h1>
          <p className="text-xl text-muted-foreground font-body max-w-md mx-auto">
            Jogos educacionais e infantis online — escolha e jogue grátis!
          </p>
        </motion.div>

        {/* Game selector */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex gap-4 mb-8"
        >
          <button
            onClick={() => setSelectedGame("digitar")}
            className={`glass-card px-6 py-3 font-display font-bold transition-all flex items-center gap-2 ${
              selectedGame === "digitar" ? "border-primary/60 text-primary glow-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="w-5 h-5" />
            Digitar
          </button>
          <button
            onClick={() => setSelectedGame("acertar")}
            className={`glass-card px-6 py-3 font-display font-bold transition-all flex items-center gap-2 ${
              selectedGame === "acertar" ? "border-secondary/60 text-secondary glow-secondary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calculator className="w-5 h-5" />
            Acertar 🎈
          </button>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-3 mb-8"
        >
          {selectedGame === "digitar" ? (
            [
              { icon: <Zap className="w-4 h-4" />, text: "Velocidade" },
              { icon: <Users className="w-4 h-4" />, text: "Multiplayer" },
              { icon: <Trophy className="w-4 h-4" />, text: "Rankings" },
            ].map((pill) => (
              <span key={pill.text} className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm font-body font-semibold">
                {pill.icon} {pill.text}
              </span>
            ))
          ) : (
            [
              { icon: <Calculator className="w-4 h-4" />, text: "Matemática" },
              { icon: <Zap className="w-4 h-4" />, text: "Agilidade" },
              { icon: <Trophy className="w-4 h-4" />, text: "6 Velocidades" },
            ].map((pill) => (
              <span key={pill.text} className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm font-body font-semibold">
                {pill.icon} {pill.text}
              </span>
            ))
          )}
        </motion.div>

        {/* Global Ranking Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/ranking")}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-accent/20 text-accent font-display font-bold hover:bg-accent/30 transition-colors mb-12"
          aria-label="Ver ranking global de jogos educacionais"
        >
          <Trophy className="w-5 h-5" />
          Ranking Global
        </motion.button>

        {/* Acertar: direct play button */}
        {selectedGame === "acertar" ? (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="w-full max-w-md"
          >
            <div className="glass-card p-8 text-center">
              <div className="text-5xl mb-4">🎈🦆</div>
              <h3 className="font-display font-bold text-xl text-foreground mb-2">Eu Vou Acertar</h3>
              <p className="text-muted-foreground text-sm mb-6 font-body">
                Estoure balões com patos, resolva contas matemáticas e teste sua agilidade!
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/acertar")}
                className="w-full py-3 rounded-xl bg-secondary text-secondary-foreground font-display font-bold glow-secondary hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                Jogar! 🎈
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        ) : (
          /* Digitar: existing action cards */
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="w-full max-w-md"
          >
            {mode === "idle" ? (
              <div className="space-y-4">
                <div className="glass-card p-6">
                  <label className="block text-sm font-body font-semibold text-muted-foreground mb-2">
                    Seu nome {savedCode && <span className="text-xs text-primary/70">(ou cole seu código para restaurar)</span>}
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={handleNameBlur}
                    placeholder={savedCode ? `Ex: MeuNome#${savedCode}` : "Digite seu nome..."}
                    maxLength={30}
                    className="w-full bg-muted rounded-xl px-4 py-3 text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    disabled={restoring}
                  />
                  {savedCode && (
                    <p className="text-xs text-muted-foreground/70 mt-2 font-body">
                      Seu código: <span className="text-accent font-bold select-all">{playerName || "Jogador"}#{savedCode}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => playerName.trim() ? setMode("create") : null}
                    disabled={!playerName.trim()}
                    className="glass-card p-6 flex flex-col items-center gap-3 hover:border-primary/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                      <Plus className="w-7 h-7 text-primary" />
                    </div>
                    <span className="font-display font-bold text-foreground">Criar Sala</span>
                    <span className="text-xs text-muted-foreground">Comece um novo jogo</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => playerName.trim() ? setMode("join") : null}
                    disabled={!playerName.trim()}
                    className="glass-card p-6 flex flex-col items-center gap-3 hover:border-secondary/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-secondary/20 flex items-center justify-center group-hover:bg-secondary/30 transition-colors">
                      <Users className="w-7 h-7 text-secondary" />
                    </div>
                    <span className="font-display font-bold text-foreground">Entrar na Sala</span>
                    <span className="text-xs text-muted-foreground">Use um código</span>
                  </motion.button>
                </div>
              </div>
            ) : mode === "create" ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-display font-bold text-xl text-foreground mb-2">Criar Sala</h3>
                <p className="text-muted-foreground text-sm mb-6 font-body">Você será o dono da sala e poderá iniciar o jogo</p>
                <div className="flex gap-3">
                  <button onClick={() => setMode("idle")} className="flex-1 px-4 py-3 rounded-xl bg-muted text-foreground font-body font-semibold hover:bg-muted/80 transition-colors">Voltar</button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCreate}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-primary hover:brightness-110 transition-all"
                  >
                    Criar
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
                <div className="w-16 h-16 rounded-2xl bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="font-display font-bold text-xl text-foreground mb-2 text-center">Entrar na Sala</h3>
                <p className="text-muted-foreground text-sm mb-6 font-body text-center">Digite o código da sala para entrar</p>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Código da sala"
                  maxLength={6}
                  className="w-full bg-muted rounded-xl px-4 py-3 text-foreground text-center text-2xl font-display tracking-[0.3em] placeholder:text-muted-foreground/50 placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all mb-4"
                />
                <div className="flex gap-3">
                  <button onClick={() => setMode("idle")} className="flex-1 px-4 py-3 rounded-xl bg-muted text-foreground font-body font-semibold hover:bg-muted/80 transition-colors">Voltar</button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleJoin}
                    disabled={!joinCode.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary text-secondary-foreground font-display font-bold glow-secondary hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Entrar
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </main>

      <footer className="relative z-10 text-center py-6" role="contentinfo">
        <p className="text-xs text-muted-foreground font-body">
          © 2026 Eu Vou Jogar — Jogos Educacionais e Infantis Online Grátis 🎮
        </p>
        <nav className="sr-only" aria-label="Links do rodapé">
          <a href="/acertar">Eu Vou Acertar - Jogos de Matemática Infantis</a>
          <a href="/ranking">Ranking de Jogos Educacionais</a>
        </nav>
      </footer>
    </div>
  );
};

export default Index;
