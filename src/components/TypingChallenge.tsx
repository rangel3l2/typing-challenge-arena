import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { analyzeText, calculateWordScore, classifyDifficulty, type WordResult, type MatchResult, type DifficultyInfo } from "@/lib/wordDifficulty";

interface TypingChallengeProps {
  text: string;
  round: number;
  difficulty: number; // average word difficulty number
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
  "Expert": "bg-red-500/20 text-red-400 border-red-500/30",
};

const TypingChallenge = ({ text, round, difficulty, difficultyTier, label, onComplete, onProgressChange }: TypingChallengeProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [currentWpm, setCurrentWpm] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Per-word tracking
  const wordsRef = useRef(analyzeText(text));
  const wordStartTimeRef = useRef<number | null>(null);
  const wordKeystrokesRef = useRef(0);
  const wordErrorsRef = useRef(0);
  const wordResultsRef = useRef<WordResult[]>([]);
  const currentWordIndexRef = useRef(0);

  // Precompute word boundaries
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

  const getCurrentWordBoundary = useCallback((charIndex: number) => {
    return wordBoundaries.current.find(b => charIndex >= b.start && charIndex < b.end);
  }, []);

  const calculateWpm = useCallback(() => {
    if (!startTime || currentIndex === 0) return 0;
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    if (elapsedMinutes === 0) return 0;
    return Math.round((currentIndex / 5) / elapsedMinutes);
  }, [startTime, currentIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (startTime && !isComplete) {
        setCurrentWpm(calculateWpm());
      }
    }, 500);
    return () => clearInterval(interval);
  }, [startTime, isComplete, calculateWpm]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const refocusInput = () => inputRef.current?.focus();

  // Finalize a word's result when we move past it
  const finalizeWord = useCallback((wordIdx: number) => {
    const words = wordsRef.current;
    if (wordIdx >= words.length) return;

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComplete) return;
    if (["Shift", "Control", "Alt", "Meta", "Tab", "CapsLock"].includes(e.key)) return;

    e.preventDefault();

    if (!startTime) {
      setStartTime(Date.now());
      wordStartTimeRef.current = Date.now();
    }

    if (e.key === "Backspace") {
      if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
      return;
    }

    if (e.key.length !== 1) return;

    setTotalKeystrokes(prev => prev + 1);
    wordKeystrokesRef.current++;

    const expectedChar = text[currentIndex];

    // Check if we're crossing a word boundary
    const prevBoundary = getCurrentWordBoundary(currentIndex - 1);
    const currBoundary = getCurrentWordBoundary(currentIndex);
    if (prevBoundary && currBoundary && prevBoundary.wordIdx !== currBoundary.wordIdx) {
      finalizeWord(prevBoundary.wordIdx);
      currentWordIndexRef.current = currBoundary.wordIdx;
    } else if (!prevBoundary && currBoundary && currentIndex > 0) {
      // Transitioning from whitespace into a new word
      const lastBound = wordBoundaries.current.find(b => currentIndex - 1 >= b.start && currentIndex - 1 < b.end);
      if (lastBound) finalizeWord(lastBound.wordIdx);
      currentWordIndexRef.current = currBoundary.wordIdx;
    }

    if (e.key === expectedChar) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);

      if (newIndex >= text.length) {
        // Finalize last word
        const lastBound = getCurrentWordBoundary(currentIndex);
        if (lastBound) finalizeWord(lastBound.wordIdx);

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
      setErrors(prev => prev + 1);
      wordErrorsRef.current++;
    }
  }, [currentIndex, errors, isComplete, onComplete, startTime, text, totalKeystrokes, getCurrentWordBoundary, finalizeWord]);

  // Report progress
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
      <input
        ref={inputRef}
        type="text"
        className="sr-only"
        onKeyDown={handleKeyDown}
        onBlur={refocusInput}
        autoFocus
        aria-label="Área de digitação"
      />

      {/* Header info */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-bold">
            Rodada {round}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-bold border ${tierStyle}`}>
            {difficultyTier.emoji} {difficultyTier.tier}
          </span>
          <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
            Dif: {difficulty.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">WPM</p>
            <p className="text-2xl font-display font-bold text-primary">{currentWpm}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Erros</p>
            <p className="text-2xl font-display font-bold text-destructive">{errors}</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-muted rounded-full mb-6 overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      <p className="text-sm text-muted-foreground mb-3 font-body">{label}</p>

      {/* Typing area */}
      <div
        onClick={refocusInput}
        className="glass-card p-8 cursor-text focus-within:ring-2 focus-within:ring-primary/50 transition-all"
      >
        <p className="text-xl md:text-2xl leading-relaxed font-body select-none" style={{ wordBreak: "break-word" }}>
          {text.split("").map((char, i) => {
            let className = "text-muted-foreground/40";
            if (i < currentIndex) {
              className = "text-primary";
            } else if (i === currentIndex) {
              className = "bg-primary/20 text-foreground border-b-2 border-primary";
            }
            return (
              <span key={i} className={`${className} transition-colors duration-100`}>
                {char}
              </span>
            );
          })}
        </p>

        {!startTime && (
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-muted-foreground text-center mt-6 text-sm"
          >
            Clique aqui e comece a digitar...
          </motion.p>
        )}
      </div>
    </motion.div>
  );
};

export default TypingChallenge;
