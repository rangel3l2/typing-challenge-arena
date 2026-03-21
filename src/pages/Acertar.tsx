import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, Zap, RotateCcw } from "lucide-react";
import Balloon, { getBalloonColor } from "@/components/Balloon";
import {
  generateMathRound,
  generateWrongAnswers,
  SPEED_LEVELS,
  ROUNDS_PER_SPEED,
  TOTAL_ROUNDS,
  type MathRound,
} from "@/lib/mathGameData";

type Phase = "equation" | "answer" | "feedback" | "results";

interface RoundScore {
  round: number;
  correct: boolean;
  timeMs: number;
  speed: number;
}

const Acertar = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<"menu" | "playing" | "finished">("menu");
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("equation");
  const [mathRound, setMathRound] = useState<MathRound | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [answerOptions, setAnswerOptions] = useState<number[]>([]);
  const [chosenAnswer, setChosenAnswer] = useState<number | null>(null);
  const [scores, setScores] = useState<RoundScore[]>([]);
  const [countdown, setCountdown] = useState(3);
  const roundStartRef = useRef(Date.now());

  const currentSpeedIndex = Math.min(Math.floor(round / ROUNDS_PER_SPEED), SPEED_LEVELS.length - 1);
  const currentSpeed = SPEED_LEVELS[currentSpeedIndex];
  const difficulty = currentSpeedIndex + 1;

  const startGame = () => {
    setGameState("playing");
    setRound(0);
    setScores([]);
    setCountdown(3);
  };

  // Countdown
  useEffect(() => {
    if (gameState !== "playing" || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [gameState, countdown]);

  // Start round when countdown ends
  useEffect(() => {
    if (gameState !== "playing" || countdown > 0) return;
    startRound();
  }, [gameState, countdown]);

  const startRound = useCallback(() => {
    const mr = generateMathRound(difficulty);
    setMathRound(mr);
    setPhase("equation");
    setSelected([]);
    setChosenAnswer(null);
    roundStartRef.current = Date.now();
  }, [difficulty]);

  // Handle equation balloon click (use index to avoid duplicate value issues)
  const handleEquationClick = (idx: number) => {
    if (selected.includes(String(idx)) || phase !== "equation" || !mathRound) return;
    const newSelected = [...selected, String(idx)];
    setSelected(newSelected);

    // All 3 selected → move to answer phase
    if (newSelected.length >= 3) {
      const wrongs = generateWrongAnswers(mathRound.answer, 3);
      const options = [...wrongs, mathRound.answer].sort(() => Math.random() - 0.5);
      setAnswerOptions(options);
      setTimeout(() => setPhase("answer"), 600);
    }
  };

  // Handle answer balloon click
  const handleAnswerClick = (value: number) => {
    if (phase !== "answer" || !mathRound) return;
    setChosenAnswer(value);
    const correct = value === mathRound.answer;
    const timeMs = Date.now() - roundStartRef.current;

    setScores((prev) => [
      ...prev,
      { round: round + 1, correct, timeMs, speed: currentSpeedIndex + 1 },
    ]);

    setPhase("feedback");

    setTimeout(() => {
      if (round + 1 >= TOTAL_ROUNDS) {
        setGameState("finished");
      } else {
        setRound((r) => r + 1);
        startRound();
      }
    }, 1500);
  };

  // Balloon positions spread evenly
  const equationPositions = [20, 50, 80];
  const answerPositions = [15, 38, 62, 85];

  const totalCorrect = scores.filter((s) => s.correct).length;
  const avgTime = scores.length > 0 ? Math.round(scores.reduce((a, s) => a + s.timeMs, 0) / scores.length) : 0;
  const accuracy = scores.length > 0 ? Math.round((totalCorrect / scores.length) * 100) : 0;

  if (gameState === "menu") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute top-10 left-20 w-64 h-64 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute bottom-10 right-20 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />

        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8 relative z-10"
        >
          <div className="text-6xl mb-4">🎈🦆</div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient-primary mb-2">
            Eu Vou Acertar
          </h1>
          <p className="text-lg text-muted-foreground font-body max-w-md mx-auto">
            Estoure balões, resolva contas e teste sua agilidade matemática!
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 max-w-sm w-full space-y-4 relative z-10"
        >
          <div className="space-y-3 text-sm text-muted-foreground font-body">
            <div className="flex items-start gap-3">
              <span className="text-xl">1️⃣</span>
              <span>3 balões aparecem com números e um operador. Clique nos 3!</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">2️⃣</span>
              <span>Novos balões surgem com respostas. Acerte o resultado!</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">⚡</span>
              <span>A velocidade aumenta a cada 3 rodadas. São 6 níveis!</span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={startGame}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-primary hover:brightness-110 transition-all"
          >
            Começar! 🎈
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card p-8 max-w-md w-full text-center"
        >
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="text-3xl font-display font-bold text-gradient-primary mb-6">
            Resultado Final
          </h2>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="glass-card p-4">
              <div className="text-2xl font-display font-bold text-primary">{totalCorrect}</div>
              <div className="text-xs text-muted-foreground font-body">Acertos</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-2xl font-display font-bold text-accent">{accuracy}%</div>
              <div className="text-xs text-muted-foreground font-body">Precisão</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-2xl font-display font-bold text-secondary">{(avgTime / 1000).toFixed(1)}s</div>
              <div className="text-xs text-muted-foreground font-body">Tempo médio</div>
            </div>
          </div>

          {/* Speed breakdown */}
          <div className="space-y-2 mb-6 text-left">
            {SPEED_LEVELS.map((speed, i) => {
              const roundScores = scores.filter((s) => s.speed === i + 1);
              const hits = roundScores.filter((s) => s.correct).length;
              return (
                <div key={i} className="flex items-center justify-between text-sm font-body">
                  <span className="text-muted-foreground">
                    <Zap className="w-3 h-3 inline mr-1" />
                    Vel. {speed.level} - {speed.label}
                  </span>
                  <span className={hits === ROUNDS_PER_SPEED ? "text-primary font-bold" : "text-foreground"}>
                    {hits}/{ROUNDS_PER_SPEED}
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

  // Playing state
  if (countdown > 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          key={countdown}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="text-8xl font-display font-bold text-primary"
        >
          {countdown}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden select-none">
      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setGameState("menu")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-display font-bold text-foreground">
            Rodada {round + 1}/{TOTAL_ROUNDS}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm font-body">
          <span className="text-primary font-bold flex items-center gap-1">
            <Zap className="w-4 h-4" />
            Vel. {currentSpeed.level}
          </span>
          <span className="text-accent font-bold">
            <Trophy className="w-4 h-4 inline mr-1" />
            {totalCorrect}
          </span>
        </div>
      </div>

      {/* Phase indicator */}
      <div className="absolute top-14 left-0 right-0 z-20 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            className="inline-block px-4 py-2 rounded-full bg-muted font-body text-sm text-muted-foreground"
          >
            {phase === "equation" && "🎯 Clique nos 3 balões para montar a conta!"}
            {phase === "answer" && `🧮 Qual é o resultado de ${mathRound?.num1} ${mathRound?.operator} ${mathRound?.num2}?`}
            {phase === "feedback" && (chosenAnswer === mathRound?.answer ? "✅ Correto!" : `❌ Era ${mathRound?.answer}`)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Balloons area */}
      <div className="absolute inset-0 pt-24">
        <AnimatePresence mode="wait">
          {phase === "equation" && mathRound && (
            <motion.div key={`eq-${round}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative w-full h-full">
              {[
                { val: String(mathRound.num1), idx: 0 },
                { val: mathRound.operator, idx: 1 },
                { val: String(mathRound.num2), idx: 2 },
              ].map(({ val, idx }) => (
                <Balloon
                  key={`eq-${round}-${idx}`}
                  label={val}
                  color={getBalloonColor(idx)}
                  x={equationPositions[idx]}
                  durationMs={currentSpeed.durationMs}
                  onClick={() => handleEquationClick(val)}
                  selected={selected.includes(val)}
                  delay={idx * 0.5}
                />
              ))}
            </motion.div>
          )}

          {(phase === "answer" || phase === "feedback") && mathRound && (
            <motion.div key={`ans-${round}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative w-full h-full">
              {answerOptions.map((val, idx) => (
                <Balloon
                  key={`ans-${round}-${idx}`}
                  label={String(val)}
                  color={getBalloonColor(idx + 3)}
                  x={answerPositions[idx]}
                  durationMs={currentSpeed.durationMs}
                  onClick={() => handleAnswerClick(val)}
                  selected={chosenAnswer === val}
                  correct={phase === "feedback" ? val === mathRound.answer : null}
                  delay={idx * 0.4}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-2 bg-muted">
        <motion.div
          className="h-full bg-primary"
          animate={{ width: `${((round + 1) / TOTAL_ROUNDS) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
};

export default Acertar;
