import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, Zap, RotateCcw, Star } from "lucide-react";
import Balloon, { getBalloonColor } from "@/components/Balloon";
import {
  generateMathRound,
  generateEquationBalloons,
  generateWrongAnswers,
  computeFromSelection,
  SPEED_LEVELS,
  ROUNDS_PER_SPEED,
  TOTAL_ROUNDS,
  WAVE_DELAY,
  type MathRound,
  type BalloonItem,
} from "@/lib/mathGameData";

type Phase = "equation" | "answer" | "feedback" | "results" | "gameover";

interface RoundScore {
  round: number;
  correct: boolean;
  timeMs: number;
  speed: number;
  points: number;
}

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
];

const Acertar = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<"menu" | "playing" | "finished">("menu");
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("equation");
  const [mathRound, setMathRound] = useState<MathRound | null>(null);
  const [balloons, setBalloons] = useState<BalloonItem[]>([]);
  const [hiddenBalloons, setHiddenBalloons] = useState<Set<number>>(new Set());
  const [escapedBalloons, setEscapedBalloons] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<BalloonItem[]>([]);
  const [answerOptions, setAnswerOptions] = useState<number[]>([]);
  const [chosenAnswer, setChosenAnswer] = useState<number | null>(null);
  const [scores, setScores] = useState<RoundScore[]>([]);
  const [countdown, setCountdown] = useState(3);
  const [roundPoints, setRoundPoints] = useState(10);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [gameOverMsg, setGameOverMsg] = useState("");
  const [visibleBalloonIds, setVisibleBalloonIds] = useState<Set<number>>(new Set());
  const [hiddenAnswers, setHiddenAnswers] = useState<Set<number>>(new Set());
  const roundStartRef = useRef(Date.now());
  const phaseRef = useRef<Phase>("equation");
  const selectedRef = useRef<BalloonItem[]>([]);
  const hiddenRef = useRef<Set<number>>(new Set());
  const escapedRef = useRef<Set<number>>(new Set());
  const balloonsRef = useRef<BalloonItem[]>([]);
  const waveTimersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { hiddenRef.current = hiddenBalloons; }, [hiddenBalloons]);
  useEffect(() => { escapedRef.current = escapedBalloons; }, [escapedBalloons]);
  useEffect(() => { balloonsRef.current = balloons; }, [balloons]);

  const currentSpeedIndex = Math.min(Math.floor(round / ROUNDS_PER_SPEED), SPEED_LEVELS.length - 1);
  const currentSpeed = SPEED_LEVELS[currentSpeedIndex];
  const difficulty = currentSpeedIndex + 1;

  const startGame = () => {
    setGameState("playing");
    setRound(0);
    setScores([]);
    setCountdown(3);
  };

  useEffect(() => {
    if (gameState !== "playing" || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [gameState, countdown]);

  useEffect(() => {
    if (gameState !== "playing" || countdown > 0) return;
    startRound();
  }, [gameState, countdown]);

  const triggerGameOver = useCallback(() => {
    if (phaseRef.current === "gameover") return;
    const msg = FUNNY_GAMEOVER_MESSAGES[Math.floor(Math.random() * FUNNY_GAMEOVER_MESSAGES.length)];
    setGameOverMsg(msg);
    setPhase("gameover");
    // Clear wave timers
    waveTimersRef.current.forEach(t => clearTimeout(t));
    waveTimersRef.current = [];
  }, []);

  const checkCanComplete = useCallback(() => {
    if (phaseRef.current !== "equation") return;
    const bl = balloonsRef.current;
    const sel = selectedRef.current;
    const hid = hiddenRef.current;
    const esc = escapedRef.current;

    const remaining = bl.filter(b =>
      !hid.has(b.id) && !esc.has(b.id) && !sel.some(s => s.id === b.id)
    );
    // Also count visible but not yet spawned
    const needNums = 2 - sel.filter(s => s.type === 'number').length;
    const needOps = 1 - sel.filter(s => s.type === 'operator').length;
    const remainingNums = remaining.filter(b => b.type === 'number').length;
    const remainingOps = remaining.filter(b => b.type === 'operator').length;

    if (remainingNums < needNums || remainingOps < needOps) {
      triggerGameOver();
    }
  }, [triggerGameOver]);

  const startRound = useCallback(() => {
    // Clear previous wave timers
    waveTimersRef.current.forEach(t => clearTimeout(t));
    waveTimersRef.current = [];

    const mr = generateMathRound(difficulty);
    const bl = generateEquationBalloons(mr, difficulty);
    setMathRound(mr);
    setBalloons(bl);
    setHiddenBalloons(new Set());
    setEscapedBalloons(new Set());
    setPhase("equation");
    setSelected([]);
    setChosenAnswer(null);
    setRoundPoints(10);
    setHiddenAnswers(new Set());
    setFeedbackMsg("");
    roundStartRef.current = Date.now();

    // Spawn balloons in waves of ~4
    const totalWaves = Math.ceil(bl.length / 4);
    const initialVisible = new Set<number>();
    // First wave immediately
    bl.filter(b => b.waveIndex === 0).forEach(b => initialVisible.add(b.id));
    setVisibleBalloonIds(new Set(initialVisible));

    // Subsequent waves
    for (let w = 1; w < totalWaves; w++) {
      const timer = setTimeout(() => {
        if (phaseRef.current !== "equation") return;
        const waveIds = bl.filter(b => b.waveIndex === w).map(b => b.id);
        setVisibleBalloonIds(prev => {
          const next = new Set(prev);
          waveIds.forEach(id => next.add(id));
          return next;
        });
      }, w * WAVE_DELAY * 1000);
      waveTimersRef.current.push(timer);
    }
  }, [difficulty]);

  const canSelect = (item: BalloonItem): boolean => {
    if (selected.length >= 3) return false;
    if (item.type === 'operator') {
      return !selected.some(s => s.type === 'operator');
    }
    return selected.filter(s => s.type === 'number').length < 2;
  };

  const handleDuckClick = useCallback((item: BalloonItem) => {
    if (phaseRef.current !== "equation" || hiddenRef.current.has(item.id)) return;
    if (selectedRef.current.find(s => s.id === item.id)) return;

    const currentSelected = selectedRef.current;
    // canSelect inline
    if (currentSelected.length >= 3) return;
    if (item.type === 'operator' && currentSelected.some(s => s.type === 'operator')) {
      setFeedbackMsg("⚠️ Selecione: 2 números e 1 operação!");
      setTimeout(() => setFeedbackMsg(""), 1500);
      return;
    }
    if (item.type === 'number' && currentSelected.filter(s => s.type === 'number').length >= 2) {
      setFeedbackMsg("⚠️ Selecione: 2 números e 1 operação!");
      setTimeout(() => setFeedbackMsg(""), 1500);
      return;
    }

    const newSelected = [...currentSelected, item];
    setSelected(newSelected);

    if (newSelected.length >= 3) {
      const eq = computeFromSelection(newSelected);
      if (eq) {
        const wrongs = generateWrongAnswers(eq.answer, 3);
        const options = [...wrongs, eq.answer].sort(() => Math.random() - 0.5);
        setAnswerOptions(options);
        // Clear wave timers when moving to answer phase
        waveTimersRef.current.forEach(t => clearTimeout(t));
        waveTimersRef.current = [];
        setTimeout(() => setPhase("answer"), 600);
      }
    }
  }, []);

  const handleBalloonClick = useCallback((item: BalloonItem) => {
    if (phaseRef.current !== "equation" || hiddenRef.current.has(item.id)) return;
    setHiddenBalloons(prev => {
      const next = new Set([...prev, item.id]);
      hiddenRef.current = next;
      return next;
    });
    setRoundPoints(prev => Math.max(0, prev - 2));
    setFeedbackMsg("💥 Acerte o pato, não o balão! -2 pontos");
    setTimeout(() => setFeedbackMsg(""), 1500);
    setTimeout(checkCanComplete, 50);
  }, [checkCanComplete]);

  const handleBalloonEscaped = useCallback((item: BalloonItem) => {
    if (phaseRef.current !== "equation") return;
    setEscapedBalloons(prev => {
      const next = new Set([...prev, item.id]);
      escapedRef.current = next;
      return next;
    });
    setTimeout(checkCanComplete, 50);
  }, [checkCanComplete]);

  const handleAnswerDuckClick = useCallback((value: number) => {
    if (phaseRef.current !== "answer") return;
    const sel = selectedRef.current;
    const eq = computeFromSelection(sel);
    if (!eq) return;

    setChosenAnswer(value);
    const correct = value === eq.answer;
    const finalPoints = correct ? roundPoints : 0;
    const timeMs = Date.now() - roundStartRef.current;

    setScores(prev => [
      ...prev,
      { round: round + 1, correct, timeMs, speed: currentSpeedIndex + 1, points: finalPoints },
    ]);

    setPhase("feedback");

    setTimeout(() => {
      if (round + 1 >= TOTAL_ROUNDS) {
        setGameState("finished");
      } else {
        setRound(r => r + 1);
      }
    }, 1500);
  }, [round, currentSpeedIndex, roundPoints]);

  // When round changes, start new round
  useEffect(() => {
    if (gameState === "playing" && countdown <= 0 && round > 0) {
      startRound();
    }
  }, [round]);

  const handleAnswerBalloonClick = useCallback((value: number) => {
    if (phaseRef.current !== "answer") return;
    setHiddenAnswers(prev => {
      const next = new Set([...prev, value]);
      const remainingAnswers = answerOptions.filter(v => !next.has(v));
      if (remainingAnswers.length === 0) {
        triggerGameOver();
      }
      return next;
    });
    setRoundPoints(prev => Math.max(0, prev - 2));
    setFeedbackMsg("💥 Acerte o pato! -2 pontos");
    setTimeout(() => setFeedbackMsg(""), 1500);
  }, [answerOptions, triggerGameOver]);

  const answerPositions = [
    { startX: 15, startY: -10 },
    { startX: 40, startY: -5 },
    { startX: 65, startY: -8 },
    { startX: 88, startY: -12 },
  ];

  const totalPoints = scores.reduce((a, s) => a + s.points, 0);
  const totalCorrect = scores.filter(s => s.correct).length;
  const avgTime = scores.length > 0 ? Math.round(scores.reduce((a, s) => a + s.timeMs, 0) / scores.length) : 0;

  if (gameState === "menu") {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-3 sm:px-4 relative overflow-hidden">
        <div className="absolute top-10 left-20 w-64 h-64 rounded-full bg-secondary/5 blur-3xl" />
        <div className="absolute bottom-10 right-20 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />

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
            Mire no pato, monte a conta e acerte o resultado!
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
              <span>16 balões surgem em ondas. Acerte 3 patos: número + operação + número.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">🎯</span>
              <span>Depois acerte o pato com o resultado certo!</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">⚡</span>
              <span>6 níveis de velocidade, 3 rodadas cada!</span>
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

  if (gameState === "finished") {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-3 sm:px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card p-5 sm:p-8 max-w-md w-full text-center"
        >
          <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🏆</div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-gradient-primary mb-4 sm:mb-6">
            Resultado Final
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="glass-card p-3 sm:p-4">
              <div className="text-xl sm:text-2xl font-display font-bold text-primary">{totalPoints}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground font-body">Pontos</div>
            </div>
            <div className="glass-card p-3 sm:p-4">
              <div className="text-xl sm:text-2xl font-display font-bold text-accent">{totalCorrect}/{scores.length}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground font-body">Acertos</div>
            </div>
            <div className="glass-card p-3 sm:p-4">
              <div className="text-xl sm:text-2xl font-display font-bold text-secondary">{(avgTime / 1000).toFixed(1)}s</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground font-body">Tempo médio</div>
            </div>
          </div>
          <div className="space-y-2 mb-6 text-left">
            {SPEED_LEVELS.map((speed, i) => {
              const roundScores = scores.filter(s => s.speed === i + 1);
              const pts = roundScores.reduce((a, s) => a + s.points, 0);
              const maxPts = roundScores.length * 10;
              return (
                <div key={i} className="flex items-center justify-between text-sm font-body">
                  <span className="text-muted-foreground">
                    <Zap className="w-3 h-3 inline mr-1" />
                    Vel. {speed.level} - {speed.label}
                  </span>
                  <span className={pts === maxPts ? "text-primary font-bold" : "text-foreground"}>
                    {pts}/{maxPts} pts
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={startGame}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-primary"
            >
              <RotateCcw className="w-4 h-4 inline mr-2" />
              Jogar de novo
            </motion.button>
            <button
              onClick={() => navigate("/")}
              className="flex-1 py-3 rounded-xl bg-muted text-foreground font-body font-semibold"
            >
              Menu
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (countdown > 0) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <motion.div
          key={countdown}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="text-6xl sm:text-7xl md:text-8xl font-display font-bold text-primary"
        >
          {countdown}
        </motion.div>
      </div>
    );
  }

  const eq = selected.length === 3 ? computeFromSelection(selected) : null;

  return (
    <div className="min-h-[100dvh] bg-background relative overflow-hidden select-none">
      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => { waveTimersRef.current.forEach(t => clearTimeout(t)); setGameState("menu"); }} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <span className="font-display font-bold text-foreground text-xs sm:text-sm md:text-base">
            R{round + 1}/{TOTAL_ROUNDS}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs md:text-sm font-body">
          <span className="text-primary font-bold flex items-center gap-0.5 sm:gap-1">
            <Zap className="w-3 h-3 sm:w-4 sm:h-4" />V{currentSpeed.level}
          </span>
          <span className="text-accent font-bold flex items-center gap-0.5 sm:gap-1">
            <Star className="w-3 h-3 sm:w-4 sm:h-4" />{roundPoints}
          </span>
          <span className="text-foreground font-bold flex items-center gap-0.5 sm:gap-1">
            <Trophy className="w-3 h-3 sm:w-4 sm:h-4" />{totalPoints}
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
              className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-destructive/20 text-destructive font-body text-xs sm:text-sm font-bold"
            >
              {feedbackMsg}
            </motion.div>
          ) : (
            <motion.div
              key={`p-${phase}-${selected.length}`}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-muted font-body text-xs sm:text-sm text-muted-foreground"
            >
              {phase === "equation" && (
                <span>🦆 Acerte os patos! {selected.map(s => s.label).join(' ')} {selected.length < 3 && '_ '.repeat(3 - selected.length)}</span>
              )}
              {phase === "answer" && eq && (
                <span>🎯 Qual é {eq.num1} {eq.operator} {eq.num2}?</span>
              )}
              {phase === "feedback" && eq && (
                <span>{chosenAnswer === eq.answer ? `✅ Correto! +${roundPoints} pts` : `❌ Era ${eq.answer}! 0 pts`}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Balloons area */}
      <div className="absolute inset-0 pt-20 sm:pt-24">
        {phase === "equation" && balloons.map((item, idx) => {
          if (!visibleBalloonIds.has(item.id)) return null;
          return (
            <Balloon
              key={`eq-${round}-${item.id}`}
              id={`eq-${round}-${item.id}`}
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

        {(phase === "answer" || phase === "feedback") && eq && answerOptions.map((val, idx) => (
          <Balloon
            key={`ans-${round}-${idx}`}
            id={`ans-${round}-${idx}`}
            label={String(val)}
            color={getBalloonColor(idx + 5)}
            startX={answerPositions[idx].startX}
            startY={answerPositions[idx].startY}
            direction="up"
            durationMs={currentSpeed.durationMs * 1.2}
            swayAmount={10 + idx * 4}
            swaySpeed={2.5 + idx * 0.7}
            onDuckClick={() => handleAnswerDuckClick(val)}
            onBalloonClick={() => handleAnswerBalloonClick(val)}
            selected={chosenAnswer === val}
            correct={phase === "feedback" ? val === eq.answer : null}
            hidden={hiddenAnswers.has(val)}
          />
        ))}

        {phase === "gameover" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center z-30"
          >
            <div className="glass-card p-5 sm:p-8 max-w-md mx-3 sm:mx-4 text-center">
              <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">🦆💨</div>
              <h3 className="text-xl sm:text-2xl font-display font-bold text-foreground mb-2 sm:mb-3">Game Over!</h3>
              <p className="text-muted-foreground font-body mb-4 sm:mb-6 text-sm sm:text-base">{gameOverMsg}</p>
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

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-2 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((round + 1) / TOTAL_ROUNDS) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default Acertar;
