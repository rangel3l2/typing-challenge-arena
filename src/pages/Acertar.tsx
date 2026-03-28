import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, Zap, RotateCcw, Star, Copy, Check } from "lucide-react";
import Balloon, { getBalloonColor } from "@/components/Balloon";
import SkyBackground from "@/components/SkyBackground";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import {
  generatePhaseBalloons,
  generateAnswerBalloons,
  isValidTrio,
  computeFromTrio,
  getMaxValueForPhase,
  SPEED_LEVELS,
  WAVE_DELAY,
  type BalloonItem,
  type AnswerBalloon,
} from "@/lib/mathGameData";
import {
  playCorrectSound,
  playBalloonPopSound,
  playGameOverSound,
  playDuckSelectSound,
  playPhaseCompleteSound,
} from "@/lib/gameSounds";

type Screen = "board" | "answer";

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

interface GameOverRankEntry {
  playerName: string;
  playerCode: string;
  score: number;
  phaseReached: number;
}

const Acertar = () => {
  const navigate = useNavigate();
  const { sessionId, playerCode, registerIdentity, restoreFromTag } = useSession();
  const [gameState, setGameState] = useState<"menu" | "playing" | "finished">("menu");
  const [currentScreen, setCurrentScreen] = useState<Screen>("board");
  const [phase, setPhase] = useState(1);
  
  // Board state
  const [balloons, setBalloons] = useState<BalloonItem[]>([]);
  const [hiddenBalloons, setHiddenBalloons] = useState<Set<number>>(new Set());
  const [escapedBalloons, setEscapedBalloons] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<BalloonItem[]>([]);
  const [visibleBalloonIds, setVisibleBalloonIds] = useState<Set<number>>(new Set());
  
  // Answer screen state
  const [answerBalloons, setAnswerBalloons] = useState<AnswerBalloon[]>([]);
  const [currentEquation, setCurrentEquation] = useState<{ num1: number; num2: number; operator: string; answer: number } | null>(null);
  const [pendingTrioIds, setPendingTrioIds] = useState<number[]>([]);
  const [hiddenAnswers, setHiddenAnswers] = useState<Set<number>>(new Set());
  const [escapedAnswers, setEscapedAnswers] = useState<Set<number>>(new Set());
  
  // Player identity
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("typerace_player_name") || "");
  const [currentPlayerCode, setCurrentPlayerCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Scoring
  const [score, setScore] = useState(0);
  const [phasePoints, setPhasePoints] = useState(10);
  const [countdown, setCountdown] = useState(3);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [gameOverMsg, setGameOverMsg] = useState("");
  const [isGameOver, setIsGameOver] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [endGameRanking, setEndGameRanking] = useState<GameOverRankEntry[]>([]);

  const gameOverRef = useRef(false);
  const selectedRef = useRef<BalloonItem[]>([]);
  const hiddenRef = useRef<Set<number>>(new Set());
  const escapedRef = useRef<Set<number>>(new Set());
  const balloonsRef = useRef<BalloonItem[]>([]);
  const screenRef = useRef<Screen>("board");
  const hiddenAnswersRef = useRef<Set<number>>(new Set());
  const escapedAnswersRef = useRef<Set<number>>(new Set());
  const answerBalloonsRef = useRef<AnswerBalloon[]>([]);
  const waveTimersRef = useRef<NodeJS.Timeout[]>([]);
  const interactionLockRef = useRef(false);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scoreRef = useRef(0);
  const phaseRef = useRef(1);

  const clearUiTimer = useCallback((timerRef: React.MutableRefObject<NodeJS.Timeout | null>) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setTemporaryFeedback = useCallback((message: string, duration = 1500) => {
    setFeedbackMsg(message);
    clearUiTimer(feedbackTimerRef);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackMsg("");
      feedbackTimerRef.current = null;
    }, duration);
  }, [clearUiTimer]);

  const unlockInteraction = useCallback(() => {
    interactionLockRef.current = false;
  }, []);

  const lockInteractionFor = useCallback((duration = 0) => {
    interactionLockRef.current = true;
    clearUiTimer(transitionTimerRef);

    if (duration <= 0) {
      transitionTimerRef.current = null;
      return;
    }

    transitionTimerRef.current = setTimeout(() => {
      unlockInteraction();
      transitionTimerRef.current = null;
    }, duration);
  }, [clearUiTimer, unlockInteraction]);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { hiddenRef.current = hiddenBalloons; }, [hiddenBalloons]);
  useEffect(() => { escapedRef.current = escapedBalloons; }, [escapedBalloons]);
  useEffect(() => { balloonsRef.current = balloons; }, [balloons]);
  useEffect(() => { screenRef.current = currentScreen; }, [currentScreen]);
  useEffect(() => { hiddenAnswersRef.current = hiddenAnswers; }, [hiddenAnswers]);
  useEffect(() => { escapedAnswersRef.current = escapedAnswers; }, [escapedAnswers]);
  useEffect(() => { answerBalloonsRef.current = answerBalloons; }, [answerBalloons]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const speedIndex = Math.min(phase - 1, SPEED_LEVELS.length - 1);
  const currentSpeed = SPEED_LEVELS[speedIndex];

  const handleNameInput = async (value: string) => {
    setPlayerName(value);
    // Check if it's a restore tag
    if (value.match(/^.+#\d{6}$/)) {
      const restored = await restoreFromTag(value);
      if (restored) {
        setPlayerName(restored.name);
        localStorage.setItem("typerace_player_name", restored.name);
      }
    }
  };

  const saveScoreToDb = useCallback(async (finalScore: number, finalPhase: number) => {
    if (scoreSaved || !playerName.trim()) return;
    setScoreSaved(true);

    const name = playerName.trim();
    localStorage.setItem("typerace_player_name", name);
    const code = await registerIdentity(name);
    setCurrentPlayerCode(code);

    await supabase.from("acertar_scores").insert({
      session_id: sessionId,
      player_name: name,
      player_code: code,
      score: finalScore,
      phase_reached: finalPhase,
    } as any);

    // Fetch end-game ranking (top 10 recent scores)
    const { data: ranking } = await supabase
      .from("acertar_scores")
      .select("player_name, player_code, score, phase_reached")
      .order("score", { ascending: false })
      .limit(10);

    if (ranking) {
      setEndGameRanking(ranking.map((r: any) => ({
        playerName: r.player_name,
        playerCode: r.player_code,
        score: r.score,
        phaseReached: r.phase_reached,
      })));
    }
  }, [playerName, scoreSaved, sessionId, registerIdentity]);

  const startGame = async () => {
    if (!playerName.trim()) return;
    localStorage.setItem("typerace_player_name", playerName.trim());
    const code = await registerIdentity(playerName.trim());
    setCurrentPlayerCode(code);

    gameOverRef.current = false;
    setGameState("playing");
    setPhase(1);
    setScore(0);
    setCountdown(3);
    setIsGameOver(false);
    setCurrentScreen("board");
    setScoreSaved(false);
    setEndGameRanking([]);
    setCopied(false);
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
    lockInteractionFor();
    playGameOverSound();
    const msg = customMsg || FUNNY_GAMEOVER_MESSAGES[Math.floor(Math.random() * FUNNY_GAMEOVER_MESSAGES.length)];
    setGameOverMsg(msg);
    setIsGameOver(true);
    waveTimersRef.current.forEach(t => clearTimeout(t));
    waveTimersRef.current = [];
    // Save score async
    saveScoreToDb(scoreRef.current, phaseRef.current);
  }, [lockInteractionFor, saveScoreToDb]);

  const checkCanCompleteBoard = useCallback(() => {
    if (gameOverRef.current || screenRef.current !== "board") return;
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

  const checkAnswerScreen = useCallback(() => {
    if (gameOverRef.current || screenRef.current !== "answer") return;
    const abs = answerBalloonsRef.current;
    const hid = hiddenAnswersRef.current;
    const esc = escapedAnswersRef.current;
    const remaining = abs.filter(b => !hid.has(b.id) && !esc.has(b.id));
    if (remaining.length === 0) {
      triggerGameOver("Todos os balões de resposta escaparam! 🦆💨");
    }
  }, [triggerGameOver]);

  const startPhase = useCallback(() => {
    if (gameOverRef.current) return;
    unlockInteraction();
    clearUiTimer(feedbackTimerRef);
    clearUiTimer(transitionTimerRef);
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
    setCurrentScreen("board");
    setCurrentEquation(null);
    setPendingTrioIds([]);
    setHiddenAnswers(new Set());
    setEscapedAnswers(new Set());
    setAnswerBalloons([]);
    setVisibleBalloonIds(new Set());

    // Spawn in waves of 4
    const totalWaves = Math.ceil(bl.length / 4);
    const initialVisible = new Set<number>();
    bl.filter(b => b.waveIndex === 0).forEach(b => initialVisible.add(b.id));
    setVisibleBalloonIds(new Set(initialVisible));

    for (let w = 1; w < totalWaves; w++) {
      const timer = setTimeout(() => {
        if (gameOverRef.current || screenRef.current !== "board") return;
        const waveIds = bl.filter(b => b.waveIndex === w).map(b => b.id);
        setVisibleBalloonIds(prev => {
          const next = new Set(prev);
          waveIds.forEach(id => next.add(id));
          return next;
        });
      }, w * WAVE_DELAY * 1000);
      waveTimersRef.current.push(timer);
    }
  }, [phase, clearUiTimer, unlockInteraction]);

  useEffect(() => {
    return () => {
      waveTimersRef.current.forEach(t => clearTimeout(t));
      clearUiTimer(feedbackTimerRef);
      clearUiTimer(transitionTimerRef);
    };
  }, [clearUiTimer]);

  // When phase changes after initial load
  useEffect(() => {
    if (gameState === "playing" && countdown <= 0 && phase > 1) {
      startPhase();
    }
  }, [phase]);

  // === BOARD: Duck click (select for trio) ===
  const handleBoardDuckClick = useCallback((item: BalloonItem) => {
    if (gameOverRef.current || screenRef.current !== "board" || hiddenRef.current.has(item.id) || interactionLockRef.current) return;
    if (selectedRef.current.find(s => s.id === item.id)) return;

    const currentSelected = selectedRef.current;
    if (currentSelected.length >= 3) return;

    const newSelected = [...currentSelected, item];
    setSelected(newSelected);
    playDuckSelectSound();

    if (newSelected.length === 3) {
      lockInteractionFor();

      if (!isValidTrio(newSelected)) {
        triggerGameOver("Combinação inválida! Precisa ser 2 números e 1 operação! 🦆🤣");
        return;
      }

      const result = computeFromTrio(newSelected);
      if (!result) return;

      // Pause wave timers
      waveTimersRef.current.forEach(t => clearTimeout(t));
      waveTimersRef.current = [];

      // Store pending trio and equation, transition to answer screen
      const trioBalloonIds = newSelected.map(s => s.id);
      setPendingTrioIds(trioBalloonIds);
      setCurrentEquation(result);

      // Generate answer balloons
      const abs = generateAnswerBalloons(result.answer, 4);
      setAnswerBalloons(abs);
      setHiddenAnswers(new Set());
      setEscapedAnswers(new Set());

      setCurrentScreen("answer");
      unlockInteraction();
    }
  }, [lockInteractionFor, triggerGameOver, unlockInteraction]);

  // === BOARD: Balloon click (penalty) ===
  const handleBoardBalloonClick = useCallback((item: BalloonItem) => {
    if (gameOverRef.current || screenRef.current !== "board" || hiddenRef.current.has(item.id) || interactionLockRef.current) return;
    setHiddenBalloons(prev => {
      const next = new Set([...prev, item.id]);
      hiddenRef.current = next;
      return next;
    });
    setPhasePoints(prev => Math.max(0, prev - 2));
    playBalloonPopSound();
    setTemporaryFeedback("💥 Acerte o pato, não o balão! -2 pontos");
    queueMicrotask(checkCanCompleteBoard);
  }, [checkCanCompleteBoard, setTemporaryFeedback]);

  // === BOARD: Balloon escaped ===
  const handleBoardBalloonEscaped = useCallback((item: BalloonItem) => {
    if (gameOverRef.current || screenRef.current !== "board") return;
    setEscapedBalloons(prev => {
      const next = new Set([...prev, item.id]);
      escapedRef.current = next;
      return next;
    });
    queueMicrotask(checkCanCompleteBoard);
  }, [checkCanCompleteBoard]);

  // === ANSWER: Duck click (pick answer) ===
  const handleAnswerDuckClick = useCallback((ab: AnswerBalloon) => {
    if (gameOverRef.current || screenRef.current !== "answer" || !currentEquation || interactionLockRef.current) return;
    if (hiddenAnswersRef.current.has(ab.id) || escapedAnswersRef.current.has(ab.id)) return;

    lockInteractionFor();

    if (ab.value === currentEquation.answer) {
      // CORRECT! Burst the pending trio and return to board
      playCorrectSound();
      const pts = phasePoints;
      setScore(prev => prev + pts);
      setFeedbackMsg(`✅ ${currentEquation.num1} ${currentEquation.operator} ${currentEquation.num2} = ${currentEquation.answer} (+${pts} pts)`);

      // Hide the trio from the board
      setHiddenBalloons(prev => {
        const next = new Set(prev);
        pendingTrioIds.forEach(id => next.add(id));
        hiddenRef.current = next;
        return next;
      });

      // Return to board after brief delay
      clearUiTimer(transitionTimerRef);
      transitionTimerRef.current = setTimeout(() => {
        setSelected([]);
        setCurrentScreen("board");
        setCurrentEquation(null);
        setPendingTrioIds([]);
        setAnswerBalloons([]);
        setFeedbackMsg("");

        // Check if board is cleared
        const bl = balloonsRef.current;
        const hid = hiddenRef.current;
        const esc = escapedRef.current;
        const remaining = bl.filter(b => !hid.has(b.id) && !esc.has(b.id));

        if (remaining.length === 0) {
          playPhaseCompleteSound();
          setFeedbackMsg(`🎉 Fase ${phase} completa! Próxima fase...`);
          transitionTimerRef.current = setTimeout(() => {
            setFeedbackMsg("");
            setPhase(p => p + 1);
            setPhasePoints(10);
            transitionTimerRef.current = null;
          }, 1500);
        } else {
          // Resume wave timers for remaining balloons
          // Re-show all remaining visible
          const allVisible = new Set<number>();
          bl.forEach(b => {
            if (!hid.has(b.id) && !esc.has(b.id)) allVisible.add(b.id);
          });
          setVisibleBalloonIds(allVisible);
          unlockInteraction();
          queueMicrotask(checkCanCompleteBoard);
        }
        if (remaining.length === 0) {
          interactionLockRef.current = true;
        }
      }, 1000);
    } else {
      // WRONG answer — lose all phase points, game over
      triggerGameOver(`Resposta errada! ${currentEquation.num1} ${currentEquation.operator} ${currentEquation.num2} = ${currentEquation.answer}, não ${ab.value}! 🦆😵`);
    }
  }, [currentEquation, phasePoints, pendingTrioIds, phase, triggerGameOver, checkCanCompleteBoard, clearUiTimer, lockInteractionFor, unlockInteraction]);

  // === ANSWER: Balloon click (penalty) ===
  const handleAnswerBalloonClick = useCallback((ab: AnswerBalloon) => {
    if (gameOverRef.current || screenRef.current !== "answer" || interactionLockRef.current) return;
    if (hiddenAnswersRef.current.has(ab.id)) return;
    setHiddenAnswers(prev => {
      const next = new Set([...prev, ab.id]);
      hiddenAnswersRef.current = next;
      return next;
    });
    setPhasePoints(prev => Math.max(0, prev - 2));
    playBalloonPopSound();
    setTemporaryFeedback("💥 Acerte o pato! -2 pontos");
    queueMicrotask(checkAnswerScreen);
  }, [checkAnswerScreen, setTemporaryFeedback]);

  // === ANSWER: Balloon escaped ===
  const handleAnswerBalloonEscaped = useCallback((ab: AnswerBalloon) => {
    if (gameOverRef.current || screenRef.current !== "answer") return;
    setEscapedAnswers(prev => {
      const next = new Set([...prev, ab.id]);
      escapedAnswersRef.current = next;
      return next;
    });
    queueMicrotask(checkAnswerScreen);
  }, [checkAnswerScreen]);

  // Periodic safety check
  useEffect(() => {
    if (gameState !== "playing" || countdown > 0) return;
    const interval = setInterval(() => {
      if (gameOverRef.current) return;
      if (screenRef.current === "board") checkCanCompleteBoard();
      else checkAnswerScreen();
    }, 300);
    return () => clearInterval(interval);
  }, [gameState, countdown, checkCanCompleteBoard, checkAnswerScreen]);

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
            Mire no pato, monte trios e acerte o resultado!
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
              <span>Clique no <strong>pato</strong> para selecionar!</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">🧮</span>
              <span>Forme trios: <strong>2 números + 1 operação</strong>. Combinação errada = Game Over!</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">🎯</span>
              <span>Depois acerte o balão com o <strong>resultado correto</strong> da conta!</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">⚡</span>
              <span>Limpe todos os 18 balões para avançar de fase!</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground font-body mb-1">
              Seu nome (ou cole seu código Nome#123456)
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => handleNameInput(e.target.value)}
              placeholder="Digite seu nome..."
              className="w-full px-4 py-2.5 rounded-xl bg-muted text-foreground font-body text-sm border border-border focus:border-primary focus:outline-none transition-colors"
              maxLength={30}
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={startGame}
            disabled={!playerName.trim()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-primary hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              key={`scr-${currentScreen}-${selected.length}`}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/30 backdrop-blur-sm font-body text-xs sm:text-sm text-white font-semibold drop-shadow"
            >
              {currentScreen === "board" && (
                <span>🦆 Forme um trio! {selected.map(s => s.label).join(' ')} {selected.length < 3 && '_ '.repeat(3 - selected.length)}</span>
              )}
              {currentScreen === "answer" && currentEquation && (
                <span>🎯 Qual é {currentEquation.num1} {currentEquation.operator} {currentEquation.num2}?</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Game area */}
      <div className="absolute inset-0 pt-20 sm:pt-24">

        {/* BOARD SCREEN: equation balloons */}
        {currentScreen === "board" && !isGameOver && balloons.map((item, idx) => {
          if (!visibleBalloonIds.has(item.id)) return null;
          return (
            <Balloon
              key={`ph${phase}-b-${item.id}`}
              id={`ph${phase}-b-${item.id}`}
              label={item.label}
              color={getBalloonColor(idx)}
              startX={item.startX}
              startY={item.startY}
              direction={item.direction}
              durationMs={currentSpeed.durationMs * item.speedMultiplier}
              swayAmount={item.swayAmount}
              swaySpeed={item.swaySpeed}
              curveAmplitude={item.curveAmplitude}
              sinePhase={item.sinePhase}
              sineFreq={item.sineFreq}
              staggerMs={item.staggerMs}
              onDuckClick={() => handleBoardDuckClick(item)}
              onBalloonClick={() => handleBoardBalloonClick(item)}
              onEscaped={() => handleBoardBalloonEscaped(item)}
              selected={selected.some(s => s.id === item.id)}
              hidden={hiddenBalloons.has(item.id)}
            />
          );
        })}

        {/* ANSWER SCREEN: answer balloons + equation display */}
        {currentScreen === "answer" && !isGameOver && (
          <>
            {/* Equation highlight */}
            {currentEquation && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute top-4 sm:top-8 left-1/2 -translate-x-1/2 z-20"
              >
                <div className="glass-card px-6 sm:px-8 py-3 sm:py-4 text-center">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-white drop-shadow-lg">
                    {currentEquation.num1} {currentEquation.operator} {currentEquation.num2} = ?
                  </div>
                  <p className="text-xs sm:text-sm text-white/70 font-body mt-1">Acerte o pato com a resposta certa!</p>
                </div>
              </motion.div>
            )}

            {/* Answer balloons */}
            {answerBalloons.map((ab, idx) => (
              <Balloon
                key={`ph${phase}-a-${ab.id}`}
                id={`ph${phase}-a-${ab.id}`}
                label={ab.label}
                color={getBalloonColor(idx + 10)}
                startX={ab.startX}
                startY={ab.startY}
                direction={ab.direction}
                durationMs={currentSpeed.durationMs * ab.speedMultiplier * 1.2}
                swayAmount={ab.swayAmount}
                swaySpeed={ab.swaySpeed}
              curveAmplitude={ab.curveAmplitude}
              sinePhase={ab.sinePhase}
              sineFreq={ab.sineFreq}
              staggerMs={ab.staggerMs}
                onDuckClick={() => handleAnswerDuckClick(ab)}
                onBalloonClick={() => handleAnswerBalloonClick(ab)}
                onEscaped={() => handleAnswerBalloonEscaped(ab)}
                hidden={hiddenAnswers.has(ab.id) || escapedAnswers.has(ab.id)}
              />
            ))}
          </>
        )}

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
                <span className="font-bold text-primary">Fase: {phase}</span> · <span className="font-bold text-accent">Pontos: {score}</span>
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

      {/* Progress bar */}
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
