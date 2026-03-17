import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Keyboard, Users, Zap, Trophy, ArrowRight, Plus } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("typerace_player_name") || "");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");

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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background decorations */}
      <div className="absolute top-10 right-20 w-64 h-64 rounded-full bg-secondary/8 animate-float blur-3xl" />
      <div className="absolute bottom-10 left-20 w-80 h-80 rounded-full bg-primary/8 animate-float-reverse blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-accent/6 animate-pulse-glow blur-3xl" />
      <div className="absolute bottom-1/3 left-1/3 w-48 h-48 rounded-full bg-game-pink/6 animate-float blur-3xl" />

      {/* Floating keyboard keys decoration */}
      <div className="absolute top-20 left-[15%] animate-float opacity-10">
        <div className="w-12 h-12 rounded-lg border-2 border-foreground flex items-center justify-center font-display text-xl font-bold">A</div>
      </div>
      <div className="absolute top-40 right-[20%] animate-float-reverse opacity-10">
        <div className="w-12 h-12 rounded-lg border-2 border-foreground flex items-center justify-center font-display text-xl font-bold">S</div>
      </div>
      <div className="absolute bottom-40 left-[25%] animate-float opacity-10">
        <div className="w-12 h-12 rounded-lg border-2 border-foreground flex items-center justify-center font-display text-xl font-bold">D</div>
      </div>
      <div className="absolute bottom-20 right-[15%] animate-float-reverse opacity-10">
        <div className="w-12 h-12 rounded-lg border-2 border-foreground flex items-center justify-center font-display text-xl font-bold">F</div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <motion.div
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Keyboard className="w-12 h-12 text-primary" />
            </motion.div>
            <h1 className="text-6xl md:text-7xl font-display font-bold text-gradient-primary">
              TypeRace
            </h1>
          </div>
          <p className="text-xl text-muted-foreground font-body max-w-md mx-auto">
            Aprenda a digitar de forma divertida e competitiva!
          </p>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-3 mb-8"
        >
          {[
            { icon: <Zap className="w-4 h-4" />, text: "Velocidade" },
            { icon: <Users className="w-4 h-4" />, text: "Multiplayer" },
            { icon: <Trophy className="w-4 h-4" />, text: "Rankings" },
          ].map((pill) => (
            <span
              key={pill.text}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm font-body font-semibold"
            >
              {pill.icon}
              {pill.text}
            </span>
          ))}
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
        >
          <Trophy className="w-5 h-5" />
          Ranking Global
        </motion.button>

        {/* Action cards */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-md"
        >
          {mode === "idle" ? (
            <div className="space-y-4">
              <div className="glass-card p-6">
                <label className="block text-sm font-body font-semibold text-muted-foreground mb-2">Seu nome</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Digite seu nome..."
                  maxLength={20}
                  className="w-full bg-muted rounded-xl px-4 py-3 text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
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
      </div>

      <footer className="relative z-10 text-center py-6">
        <p className="text-xs text-muted-foreground font-body">TypeRace © 2026 — Aprenda digitação jogando 🎮</p>
      </footer>
    </div>
  );
};

export default Index;
