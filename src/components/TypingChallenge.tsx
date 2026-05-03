import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { analyzeText, calculateWordScore, classifyDifficulty, type WordResult, type MatchResult, type DifficultyInfo } from "@/lib/wordDifficulty";
import { playAccelerateSound, playSkidSound, stopEngineSound } from "@/lib/gameSounds";

interface TypingChallengeProps {
  text: string;
  round: number;
  totalRounds: number;
  difficulty: number;
  difficultyTier: DifficultyInfo;
  label: string;
  onComplete: (wpm: number, accuracy: number, timeMs: number, matchResult: MatchResult) => void;
  onProgressChange?: (progress: number) => void;
}

const TIER_STYLES: Record<string, string> = {
  "Muito Fácil": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Fácil": "bg-green-500/20 text-green-400 border-green-500/30",
  "Médio": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Difícil": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Insano": "bg-red-500/20 text-red-400 border-red-500/30",
  "Expert": "bg-red-500/20 text-red-400 border-red-500/30",
};

const ERROR_WINDOW_MS = 1500;

const TypingChallenge = ({ text, round, totalRounds, difficulty, difficultyTier, label, onComplete, onProgressChange }: TypingChallengeProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [currentWpm, setCurrentWpm] = useState(0);
  const [penaltyFlash, setPenaltyFlash] = useState(false);
  const [mistake, setMistake] = useState<{ expected: string; typed: string; key: number } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mistakeTimerRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const pausedTotalRef = useRef(0);

  // Per-word tracking
  const wordsRef = useRef(analyzeText(text));
  const wordStartTimeRef = useRef<number | null>(null);
  const wordKeystrokesRef = useRef(0);
  const wordErrorsRef = useRef(0);
  const wordResultsRef = useRef<WordResult[]>([]);
  const currentWordIndexRef = useRef(0);

  // Error penalty tracking
  const rapidErrorCountRef = useRef(0);
  const lastErrorTimeRef = useRef(0);

  // Precompute word boundaries (including spaces between words)
  const wordBoundaries = useRef<{ start: number; end: number; wordIdx: number }[]>([]);
  useEffect(() => {
    const boundaries: { start: number; end: number; wordIdx: number }[] = [];
    let pos = 0;
    const parts = text.split(/(\s+)/);
    let wordIdx = 0;
    for (const part of parts) {
      if (part.trim().length > 0) {
        boundaries.push({ start: pos, end: pos + part.length, wordIdx });
        wordIdx++;
      }
      pos += part.length;
    }
    wordBoundaries.current = boundaries;
  }, [text]);

  // Get the word boundary that contains charIndex
  const getCurrentWordBoundary = useCallback((charIndex: number) => {
    return wordBoundaries.current.find(b => charIndex >= b.start && charIndex < b.end);
  }, []);

  // Get word boundary by word index
  const getWordBoundaryByIdx = useCallback((wordIdx: number) => {
    return wordBoundaries.current.find(b => b.wordIdx === wordIdx);
  }, []);

  const calculateWpm = useCallback(() => {
    if (!startTime || currentIndex === 0) return 0;
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    if (elapsedMinutes === 0) return 0;
    return Math.round((currentIndex / 5) / elapsedMinutes);
  }, [startTime, currentIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (startTime && !isComplete && !isPaused) {
        setCurrentWpm(calculateWpm());
      }
    }, 500);
    return () => clearInterval(interval);
  }, [startTime, isComplete, isPaused, calculateWpm]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const refocusInput = () => inputRef.current?.focus();

  // Pause / Resume logic — triggered when input loses focus, keyboard closes, or tab hides
  const pauseGame = useCallback(() => {
    if (isComplete || !startTime) return;
    setIsPaused(prev => {
      if (prev) return prev;
      pausedAtRef.current = Date.now();
      stopEngineSound();
      return true;
    });
  }, [isComplete, startTime]);

  const resumeGame = useCallback(() => {
    setIsPaused(prev => {
      if (!prev) return prev;
      if (pausedAtRef.current) {
        const delta = Date.now() - pausedAtRef.current;
        pausedTotalRef.current += delta;
        // Shift timing references forward so paused time isn't counted
        if (startTime) setStartTime(startTime + delta);
        if (wordStartTimeRef.current) wordStartTimeRef.current += delta;
        pausedAtRef.current = null;
      }
      return false;
    });
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [startTime]);

  const handleResumeClick = useCallback(() => {
    inputRef.current?.focus();
    resumeGame();
  }, [resumeGame]);

  // Listen for tab/window visibility changes to also pause
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) pauseGame();
    };
    window.addEventListener("visibilitychange", onVis);
    return () => window.removeEventListener("visibilitychange", onVis);
  }, [pauseGame]);

  // Finalize a word's result when we move past it
  const finalizeWord = useCallback((wordIdx: number) => {
    const words = wordsRef.current;
    if (wordIdx >= words.length) return;
    // Don't double-finalize
    if (wordResultsRef.current.some(wr => wr.word === words[wordIdx].word && wordResultsRef.current.length > wordIdx)) return;

    const word = words[wordIdx];
    const elapsed = wordStartTimeRef.current
      ? (Date.now() - wordStartTimeRef.current)
      : 1000;
    const wordLen = word.word.length;
    const elapsedMin = elapsed / 60000;
    const wordWpm = elapsedMin > 0 ? Math.round((wordLen / 5) / elapsedMin) : 0;
    const totalKs = wordKeystrokesRef.current || 1;
    const wordAcc = Math.round(((totalKs - wordErrorsRef.current) / totalKs) * 100);
    const score = calculateWordScore(wordWpm, Math.max(0, wordAcc), word.difficulty);

    wordResultsRef.current.push({
      word: word.word,
      difficulty: word.difficulty,
      wpm: wordWpm,
      accuracy: Math.max(0, wordAcc),
      score,
    });

    // Reset for next word
    wordStartTimeRef.current = Date.now();
    wordKeystrokesRef.current = 0;
    wordErrorsRef.current = 0;
  }, []);

  // Apply penalty: move currentIndex back to the start of a target word
  const applyPenalty = useCallback((rapidErrors: number, currentCharIdx: number) => {
    const currentBound = getCurrentWordBoundary(currentCharIdx);
    if (!currentBound) return currentCharIdx;

    let targetWordIdx = currentBound.wordIdx;

    if (rapidErrors === 1) {
      // Go back to start of current word
      targetWordIdx = currentBound.wordIdx;
    } else if (rapidErrors === 2) {
      // Go back to previous word
      targetWordIdx = Math.max(0, currentBound.wordIdx - 1);
    } else {
      // Go back two words
      targetWordIdx = Math.max(0, currentBound.wordIdx - 2);
    }

    const targetBound = getWordBoundaryByIdx(targetWordIdx);
    if (!targetBound) return currentCharIdx;

    // Flash penalty indicator
    setPenaltyFlash(true);
    setTimeout(() => setPenaltyFlash(false), 400);

    // Reset word tracking to the target word
    currentWordIndexRef.current = targetWordIdx;
    wordStartTimeRef.current = Date.now();
    wordKeystrokesRef.current = 0;
    wordErrorsRef.current = 0;

    // Remove finalized results for words we're going back to
    wordResultsRef.current = wordResultsRef.current.filter(
      (_, i) => i < targetWordIdx
    );

    return targetBound.start;
  }, [getCurrentWordBoundary, getWordBoundaryByIdx]);

  // Process a single typed character (shared by hardware + soft keyboards)
  const processChar = useCallback((ch: string) => {
    if (isComplete || isPaused) return;
    if (!ch || ch.length !== 1) return;

    if (!startTime) {
      setStartTime(Date.now());
      wordStartTimeRef.current = Date.now();
    }

    setTotalKeystrokes(prev => prev + 1);
    wordKeystrokesRef.current++;

    const expectedChar = text[currentIndex];

    const prevBoundary = getCurrentWordBoundary(currentIndex - 1);
    const currBoundary = getCurrentWordBoundary(currentIndex);
    if (prevBoundary && currBoundary && prevBoundary.wordIdx !== currBoundary.wordIdx) {
      finalizeWord(prevBoundary.wordIdx);
      currentWordIndexRef.current = currBoundary.wordIdx;
    } else if (!prevBoundary && currBoundary && currentIndex > 0) {
      const lastBound = wordBoundaries.current.find(b => currentIndex - 1 >= b.start && currentIndex - 1 < b.end);
      if (lastBound) finalizeWord(lastBound.wordIdx);
      currentWordIndexRef.current = currBoundary.wordIdx;
    }

    if (ch === expectedChar) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setMistake(null);
      playAccelerateSound();

      if (newIndex >= text.length) {
        const lastBound = getCurrentWordBoundary(currentIndex);
        if (lastBound) finalizeWord(lastBound.wordIdx);

        stopEngineSound();
        setIsComplete(true);
        const elapsed = Date.now() - (startTime || Date.now());
        const wpm = Math.round((text.length / 5) / (elapsed / 60000));
        const accuracy = Math.round(((totalKeystrokes + 1 - errors) / (totalKeystrokes + 1)) * 100);

        const wordResults = wordResultsRef.current;
        const totalScore = wordResults.reduce((sum, wr) => sum + wr.score, 0);
        const avgDiff = wordResults.length > 0
          ? wordResults.reduce((sum, wr) => sum + wr.difficulty, 0) / wordResults.length
          : 1.0;

        const matchResult: MatchResult = {
          totalScore,
          averageDifficulty: Math.round(avgDiff * 100) / 100,
          wpm,
          accuracy,
          wordResults,
        };

        onComplete(wpm, accuracy, elapsed, matchResult);
      }
    } else {
      stopEngineSound();
      playSkidSound();
      setErrors(prev => prev + 1);
      wordErrorsRef.current++;

      // Visual feedback: highlight expected vs typed
      setMistake({ expected: expectedChar ?? "", typed: ch, key: Date.now() });
      if (mistakeTimerRef.current) window.clearTimeout(mistakeTimerRef.current);
      mistakeTimerRef.current = window.setTimeout(() => setMistake(null), 1200);

      // Haptic feedback on mobile
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate(40); } catch {}
      }
      const now = Date.now();
      const timeSinceLastError = now - lastErrorTimeRef.current;

      if (timeSinceLastError <= ERROR_WINDOW_MS && lastErrorTimeRef.current > 0) {
        rapidErrorCountRef.current++;
      } else {
        rapidErrorCountRef.current = 1;
      }
      lastErrorTimeRef.current = now;

      const newIdx = applyPenalty(rapidErrorCountRef.current, currentIndex);
      setCurrentIndex(newIdx);
    }
  }, [currentIndex, errors, isComplete, isPaused, onComplete, startTime, text, totalKeystrokes, getCurrentWordBoundary, finalizeWord, applyPenalty]);

  // Hardware keyboard (desktop): use keydown to catch every key cleanly
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComplete) return;
    if (["Shift", "Control", "Alt", "Meta", "Tab", "CapsLock"].includes(e.key)) return;
    if (e.key === "Backspace") { e.preventDefault(); return; } // Backspace blocked
    if (e.key.length !== 1) return;
    e.preventDefault();
    processChar(e.key);
  }, [isComplete, processChar]);

  // Soft keyboard (mobile/tablet): keydown is unreliable on Android, use beforeinput
  const handleBeforeInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const ne = e.nativeEvent as InputEvent;
    e.preventDefault();
    if (isComplete) return;
    if (ne.inputType === "deleteContentBackward" || ne.inputType === "deleteContentForward") return;
    const data = ne.data || "";
    for (const ch of data) processChar(ch);
  }, [isComplete, processChar]);


  // Report progress as character-level percentage
  useEffect(() => {
    if (onProgressChange) {
      const pct = Math.round((currentIndex / text.length) * 100);
      onProgressChange(pct);
    }
  }, [currentIndex, text.length, onProgressChange]);

  const progress = (currentIndex / text.length) * 100;
  const tierStyle = TIER_STYLES[difficultyTier.tier] || TIER_STYLES["Médio"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto"
    >
      {/* Hidden but real input — receives both hardware and on-screen keyboards.
          Positioned off-screen (not display:none) so mobile browsers will open
          the soft keyboard when we call .focus(). */}
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value=""
        onChange={() => { /* handled by onBeforeInput */ }}
        onKeyDown={handleKeyDown}
        onBeforeInput={handleBeforeInput}
        onBlur={refocusInput}
        autoFocus
        aria-label="Área de digitação"
        style={{
          position: "fixed",
          opacity: 0,
          pointerEvents: "none",
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          fontSize: 16, // prevent iOS zoom on focus
        }}
      />

      {/* Header info */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-bold">
            PARTIDA {round}/{totalRounds}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${tierStyle}`}>
            {difficultyTier.emoji} {difficultyTier.tier}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">WPM</p>
            <p className="text-lg font-display font-bold text-primary">{currentWpm}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Erros</p>
            <p className="text-lg font-display font-bold text-destructive">{errors}</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-muted rounded-full mb-2 overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      <p className="text-xs text-muted-foreground mb-1 font-body">{label}</p>

      {/* Typing area */}
      <div
        onClick={refocusInput}
        className={`glass-card p-4 sm:p-6 cursor-text focus-within:ring-2 focus-within:ring-primary/50 transition-all ${
          penaltyFlash ? "ring-2 ring-destructive/60 bg-destructive/5" : ""
        }`}
      >
        <p className="text-base sm:text-lg md:text-xl leading-relaxed font-body select-none" style={{ wordBreak: "break-word" }}>
          {text.split("").map((char, i) => {
            let className = "text-muted-foreground/40";
            const isCursor = i === currentIndex;
            if (i < currentIndex) {
              className = "text-primary";
            } else if (isCursor) {
              className = mistake
                ? "bg-destructive/30 text-destructive-foreground border-b-2 border-destructive animate-pulse rounded-sm"
                : "bg-primary/20 text-foreground border-b-2 border-primary";
            }
            return (
              <span key={i} className={`${className} transition-colors duration-100`}>
                {char}
              </span>
            );
          })}
        </p>

        {/* Mistake feedback: expected vs typed */}
        {mistake && (
          <motion.div
            key={mistake.key}
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm font-body"
            aria-live="polite"
          >
            <span className="text-muted-foreground">Esperado:</span>
            <span className="px-2.5 py-1 rounded-md bg-primary/15 border border-primary/40 text-primary font-display font-bold text-base sm:text-lg min-w-[2rem] text-center">
              {mistake.expected === " " ? "␣" : mistake.expected || "—"}
            </span>
            <span className="text-muted-foreground">→ Você digitou:</span>
            <span className="px-2.5 py-1 rounded-md bg-destructive/15 border border-destructive/50 text-destructive font-display font-bold text-base sm:text-lg min-w-[2rem] text-center line-through decoration-2">
              {mistake.typed === " " ? "␣" : mistake.typed}
            </span>
          </motion.div>
        )}

        {!startTime && (
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-muted-foreground text-center mt-3 text-xs"
          >
            <span className="hidden md:inline">Clique aqui e comece a digitar...</span>
            <span className="md:hidden">⌨️ Toque aqui para abrir o teclado e começar</span>
          </motion.p>
        )}
      </div>

      {/* Penalty indicator */}
      {penaltyFlash && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-destructive text-xs font-bold text-center mt-1"
        >
          ⚠️ Penalidade! Voltando...
        </motion.p>
      )}
    </motion.div>
  );
};

export default TypingChallenge;
