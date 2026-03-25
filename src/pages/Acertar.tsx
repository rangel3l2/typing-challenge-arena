import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, Zap, RotateCcw, Star } from "lucide-react";
import Balloon, { getBalloonColor } from "@/components/Balloon";
import SkyBackground from "@/components/SkyBackground";
import {
  generatePhaseBalloons,
  isValidTrio,
  computeFromTrio,
  getMaxValueForPhase,
  SPEED_LEVELS,
  WAVE_DELAY,
  type BalloonItem,
} from "@/lib/mathGameData";

const FUNNY_GAMEOVER_MESSAGES = [
  "Os patos fugiram todos! 🦆💨 Parece que você tem medo de patos...",
  "Parabéns! Você conseguiu errar TODOS os balões! 🎈💥 Isso é talento!",
  "Os patos mandaram um recado: 'Tenta de novo, campeão!' 🦆😂",
  "Alerta: nenhum pato foi acertado! A liga dos patos agradece 🦆🏆",
  "Você acertou mais balões que patos... o circo tá precisando! 🎪",
  "Os patos fizeram uma festa porque ninguém acertou eles! 🦆🎉",
  "Missão: acertar o pato. Status: fracasso espetacular! 💀😂",
  "Os patos saíram pra tomar sorvete. Volta depois! 🍦🦆",
  "Nenhum pato foi nocauteado. Eles mandam um abraço! 🦆🤗",
  "3 números? Sem operação? Que tal estudar matemática? 🧮😂",
  "Combinação inválida! Os patos estão rindo de você! 🦆🤣",
];

const Acertar = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<"menu" | "playing" | "finished">("menu");
  const [phase, setPhase] = useState(1); // current phase/level
  const [balloons, setBalloons] = useState<BalloonItem[]>([]);
  const [hiddenBalloons, setHiddenBalloons] = useState<Set<number>>(new Set());
  const [escapedBalloons, setEscapedBalloons] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<BalloonItem[]>([]);
  const [score, setScore] = useState(0);
  const [phasePoints, setPhasePoints] = useState(10);
  const [countdown, setCountdown] = useState(3);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [gameOverMsg, setGameOverMsg] = useState("");
  const [isGameOver, setIsGameOver] = useState(false);
  const [visibleBalloonIds, setVisibleBalloonIds] = useState<Set<number>>(new Set());
  const [triosCompleted, setTriosCompleted] = useState(0);

  const gameOverRef = useRef(false);
  const selectedRef = useRef<BalloonItem[]>([]);
  const hiddenRef = useRef<Set<number>>(new Set());
  const escapedRef = useRef<Set<number>>(new Set());
  const balloonsRef = useRef<BalloonItem[]>([]);
  const waveTimersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { hiddenRef.current = hiddenBalloons; }, [hiddenBalloons]);
  useEffect(() => { escapedRef.current = escapedBalloons; }, [escapedBalloons]);
  useEffect(() => { balloonsRef.current = balloons; }, [balloons]);

  const speedIndex = Math.min(phase - 1, SPEED_LEVELS.length - 1);
  const currentSpeed = SPEED_LEVELS[speedIndex];

  const startGame = () => {
    gameOverRef.current = false;
    setGameState("playing");
    setPhase(1);
    setScore(0);
    setTriosCompleted(0);
    setCountdown(3);
    setIsGameOver(false);
  };

  useEffect(() => {
    if (gameState !== "playing" || countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [gameState, countdown]);

  useEffect(() => {
    if (gameState !== "playing" || countdown > 0) return;
    startPhase();
  }, [gameState, countdown]);

  const triggerGameOver = useCallback((customMsg?: string) => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    const msg = customMsg || FUNNY_GAMEOVER_MESSAGES[Math.floor(Math.random() * FUNNY_GAMEOVER_MESSAGES.length)];
    setGameOverMsg(msg);
    setIsGameOver(true);
    waveTimersRef.current.forEach(t => clearTimeout(t));
    waveTimersRef.current = [];
  }, []);

  const checkCanComplete = useCallback(() => {
    if (gameOverRef.current) return;
    const bl = balloonsRef.current;
    const sel = selectedRef.current;
    const hid = hiddenRef.current;
    const esc = escapedRef.current;

    const remaining = bl.filter(b =>
      !hid.has(b.id) && !esc.has(b.id) && !sel.some(s => s.id === b.id)
    );

    const needNums = 2 - sel.filter(s => s.type === 'number').length;
    const needOps = 1 - sel.filter(s => s.type === 'operator').length;
    const remainingNums = remaining.filter(b => b.type === 'number').length;
    const remainingOps = remaining.filter(b => b.type === 'operator').length;

    if (remainingNums < needNums || remainingOps < needOps) {
      triggerGameOver();
    }
  }, [triggerGameOver]);

  const startPhase = useCallback(() => {
    if (gameOverRef.current) return;
    waveTimersRef.current.forEach(t => clearTimeout(t));
    waveTimersRef.current = [];

    const bl = generatePhaseBalloons(phase);
    setBalloons(bl);
    setHiddenBalloons(new Set());
    setEscapedBalloons(new Set());
    setSelected([]);
    setPhasePoints(10);
    setFeedbackMsg("");
    setIsGameOver(false);

    // Spawn in waves of 4
    const totalWaves = Math.ceil(bl.length / 4);
    const initialVisible = new Set<number>();
    bl.filter(b => b.waveIndex === 0).forEach(b => initialVisible.add(b.id));
    setVisibleBalloonIds(new Set(initialVisible));

    for (let w = 1; w < totalWaves; w++) {
      const timer = setTimeout(() => {
        if (gameOverRef.current) return;
        const waveIds = bl.filter(b => b.waveIndex === w).map(b => b.id);
        setVisibleBalloonIds(prev => {
          const next = new Set(prev);
          waveIds.forEach(id => next.add(id));
          return next;
        });
      }, w * WAVE_DELAY * 1000);
      waveTimersRef.current.push(timer);
    }
  }, [phase]);

  // When phase changes after initial load, start new phase
  useEffect(() => {
    if (gameState === "playing" && countdown <= 0 && phase > 1) {
      startPhase();
    }
  }, [phase]);

  const handleDuckClick = useCallback((item: BalloonItem) => {
    if (gameOverRef.current || hiddenRef.current.has(item.id)) return;
    if (selectedRef.current.find(s => s.id === item.id)) return;

    const currentSelected = selectedRef.current;

    // If already have 3, ignore (shouldn't happen but safety)
    if (currentSelected.length >= 3) return;

    const newSelected = [...currentSelected, item];
    setSelected(newSelected);

    // On the 3rd selection, validate the trio
    if (newSelected.length === 3) {
      if (!isValidTrio(newSelected)) {
        // INVALID COMBO → INSTANT GAME OVER
        triggerGameOver("Combinação inválida! Precisa ser 2 números e 1 operação! 🦆🤣");
        return;
      }

      // Valid trio! Compute result, burst the 3 balloons
      const result = computeFromTrio(newSelected);
      const trioBalloonIds = newSelected.map(s => s.id);

      // Show result feedback briefly
      if (result) {
        setFeedbackMsg(`✅ ${result.num1} ${result.operator} ${result.num2} = ${result.answer} (+${phasePoints} pts)`);
        setScore(prev => prev + phasePoints);
      }

      // Hide the 3 balloons
      setHiddenBalloons(prev => {
        const next = new Set(prev);
        trioBalloonIds.forEach(id => next.add(id));
        hiddenRef.current = next;
        return next;
      });

      // Clear selection
      setTimeout(() => {
        setSelected([]);
        setFeedbackMsg("");

        // Check if all 18 are cleared
        const bl = balloonsRef.current;
        const hid = hiddenRef.current;
        const esc = escapedRef.current;
        const remaining = bl.filter(b => !hid.has(b.id) && !esc.has(b.id));

        if (remaining.length === 0) {
          // Phase complete! Level up
          setTriosCompleted(prev => prev + 1);
          setFeedbackMsg(`🎉 Fase ${phase} completa! Próxima fase...`);
          setTimeout(() => {
            setFeedbackMsg("");
            setPhase(p => p + 1);
            setPhasePoints(10); // reset phase points
          }, 1500);
        } else {
          // Check if remaining balloons can still form a valid trio
          queueMicrotask(checkCanComplete);
        }
      }, 800);

      setTriosCompleted(prev => prev + 1);
    }
  }, [triggerGameOver, phasePoints, phase, checkCanComplete]);

  const handleBalloonClick = useCallback((item: BalloonItem) => {
    if (gameOverRef.current || hiddenRef.current.has(item.id)) return;

    // Clicking the balloon (not the duck) → penalize and remove that balloon
    setHiddenBalloons(prev => {
      const next = new Set([...prev, item.id]);
      hiddenRef.current = next;
      return next;
    });
    setPhasePoints(prev => Math.max(0, prev - 2));
    setFeedbackMsg("💥 Acerte o pato, não o balão! -2 pontos");
    setTimeout(() => setFeedbackMsg(""), 1500);
    queueMicrotask(checkCanComplete);
  }, [checkCanComplete]);

  const handleBalloonEscaped = useCallback((item: BalloonItem) => {
    if (gameOverRef.current) return;
    setEscapedBalloons(prev => {
      const next = new Set([...prev, item.id]);
      escapedRef.current = next;
      return next;
    });
    queueMicrotask(checkCanComplete);
  }, [checkCanComplete]);

  // Periodic safety check
  useEffect(() => {
    if (gameState !== "playing" || countdown > 0) return;
    const interval = setInterval(() => {
      if (!gameOverRef.current) checkCanComplete();
    }, 300);
    return () => clearInterval(interval);
  }, [gameState, countdown, checkCanComplete]);

  const maxVal = getMaxValueForPhase(phase);

  // ============ MENU ============
  if (gameState === "menu") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-3 sm:px-4 relative overflow-hidden">
        <SkyBackground />
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-6 sm:mb-8 relative z-10"
        >
          <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">🎈🦆</div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-gradient-primary mb-2">
            Eu Vou Acertar
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-body max-w-md mx-auto px-2">
            Mire no pato, monte trios matemáticos e limpe o quadro!
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4 sm:p-6 max-w-sm w-full space-y-3 sm:space-y-4 relative z-10"
        >
          <div className="space-y-3 text-sm text-muted-foreground font-body">
            <div className="flex items-start gap-3">
              <span className="text-xl">🦆</span>
              <span>Clique no <strong>pato</strong> em cima do balão!</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">🧮</span>
              <span>Forme trios: <strong>2 números + 1 operação</strong>. Qualquer outra combinação = Game Over!</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">🎯</span>
              <span>Limpe todos os 18 balões para avançar de fase!</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">⚡</span>
              <span>A cada fase os números ficam maiores e os balões mais rápidos!</span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={startGame}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-primary hover:brightness-110 transition-all"
          >
            Começar! 🦆
          </motion.button>

          <button
            onClick={() => navigate("/")}
            className="w-full py-2 text-muted-foreground font-body text-sm hover:text-foreground transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao menu
          </button>
        </motion.div>
      </div>
    );
  }

  // ============ COUNTDOWN ============
  if (countdown > 0) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden">
        <SkyBackground />
        <motion.div
          key={countdown}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="text-6xl sm:text-7xl md:text-8xl font-display font-bold text-white drop-shadow-lg relative z-10"
        >
          {countdown}
        </motion.div>
      </div>
    );
  }

  // ============ PLAYING ============
  const remainingCount = balloons.filter(b => !hiddenBalloons.has(b.id) && !escapedBalloons.has(b.id)).length;

  return (
    <div className="min-h-[100dvh] relative overflow-hidden select-none">
      <SkyBackground />

      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 bg-white/20 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => { waveTimersRef.current.forEach(t => clearTimeout(t)); setGameState("menu"); }} className="text-white/70 hover:text-white">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <span className="font-display font-bold text-white text-xs sm:text-sm md:text-base drop-shadow">
            Fase {phase}
          </span>
          <span className="text-white/70 text-[10px] sm:text-xs font-body drop-shadow">
            (max: {maxVal})
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs md:text-sm font-body">
          <span className="text-yellow-200 font-bold flex items-center gap-0.5 sm:gap-1 drop-shadow">
            <Zap className="w-3 h-3 sm:w-4 sm:h-4" />V{currentSpeed.level}
          </span>
          <span className="text-amber-200 font-bold flex items-center gap-0.5 sm:gap-1 drop-shadow">
            <Star className="w-3 h-3 sm:w-4 sm:h-4" />{phasePoints}
          </span>
          <span className="text-white font-bold flex items-center gap-0.5 sm:gap-1 drop-shadow">
            <Trophy className="w-3 h-3 sm:w-4 sm:h-4" />{score}
          </span>
          <span className="text-white/60 text-[10px] sm:text-xs drop-shadow">
            🎈{remainingCount}
          </span>
        </div>
      </div>

      {/* Status bar */}
      <div className="absolute top-10 sm:top-14 left-0 right-0 z-20 text-center px-2">
        <AnimatePresence mode="wait">
          {feedbackMsg ? (
            <motion.div
              key="fb"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              className={`inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-body text-xs sm:text-sm font-bold drop-shadow ${
                feedbackMsg.startsWith('✅') || feedbackMsg.startsWith('🎉')
                  ? 'bg-green-500/80 text-white'
                  : 'bg-red-500/80 text-white'
              }`}
            >
              {feedbackMsg}
            </motion.div>
          ) : (
            <motion.div
              key={`sel-${selected.length}`}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/30 backdrop-blur-sm font-body text-xs sm:text-sm text-white font-semibold drop-shadow"
            >
              🦆 Forme um trio! {selected.map(s => s.label).join(' ')} {selected.length < 3 && '_ '.repeat(3 - selected.length)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Balloons */}
      <div className="absolute inset-0 pt-20 sm:pt-24">
        {!isGameOver && balloons.map((item, idx) => {
          if (!visibleBalloonIds.has(item.id)) return null;
          return (
            <Balloon
              key={`ph${phase}-${item.id}`}
              id={`ph${phase}-${item.id}`}
              label={item.label}
              color={getBalloonColor(idx)}
              startX={item.startX}
              startY={item.startY}
              direction={item.direction}
              durationMs={currentSpeed.durationMs * item.speedMultiplier}
              swayAmount={item.swayAmount}
              swaySpeed={item.swaySpeed}
              onDuckClick={() => handleDuckClick(item)}
              onBalloonClick={() => handleBalloonClick(item)}
              onEscaped={() => handleBalloonEscaped(item)}
              selected={selected.some(s => s.id === item.id)}
              hidden={hiddenBalloons.has(item.id)}
            />
          );
        })}

        {/* Game Over overlay */}
        {isGameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center z-30"
          >
            <div className="glass-card p-5 sm:p-8 max-w-md mx-3 sm:mx-4 text-center">
              <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">🦆💨</div>
              <h3 className="text-xl sm:text-2xl font-display font-bold text-foreground mb-2 sm:mb-3">Game Over!</h3>
              <p className="text-muted-foreground font-body mb-2 sm:mb-3 text-sm sm:text-base">{gameOverMsg}</p>
              <div className="text-sm font-body text-muted-foreground mb-4 sm:mb-6">
                <span className="font-bold text-primary">Fase alcançada: {phase}</span> · <span className="font-bold text-accent">Pontos: {score}</span>
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={startGame}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-primary"
                >
                  <RotateCcw className="w-4 h-4 inline mr-2" />Tentar de novo
                </motion.button>
                <button
                  onClick={() => setGameState("menu")}
                  className="flex-1 py-3 rounded-xl bg-muted text-foreground font-body font-semibold"
                >
                  Menu
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Progress bar showing remaining balloons */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-2 bg-white/20">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((18 - remainingCount) / 18) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default Acertar;
