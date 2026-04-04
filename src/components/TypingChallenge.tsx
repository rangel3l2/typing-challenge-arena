import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";

interface TypingChallengeProps {
  text: string;
  round: number;
  difficulty: string;
  label: string;
  onComplete: (wpm: number, accuracy: number, timeMs: number) => void;
  onProgressChange?: (progress: number) => void;
}

const TypingChallenge = ({ text, round, difficulty, label, onComplete, onProgressChange }: TypingChallengeProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [currentWpm, setCurrentWpm] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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
    containerRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isComplete) return;
    if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta" || e.key === "Tab" || e.key === "CapsLock") return;
    
    e.preventDefault();

    if (!startTime) {
      setStartTime(Date.now());
    }

    if (e.key === "Backspace") {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
      return;
    }

    if (e.key.length !== 1) return;

    setTotalKeystrokes(prev => prev + 1);
    const expectedChar = text[currentIndex];

    if (e.key === expectedChar) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);

      if (newIndex >= text.length) {
        setIsComplete(true);
        const elapsed = Date.now() - (startTime || Date.now());
        const wpm = Math.round((text.length / 5) / (elapsed / 60000));
        const accuracy = Math.round(((totalKeystrokes + 1 - errors) / (totalKeystrokes + 1)) * 100);
        onComplete(wpm, accuracy, elapsed);
      }
    } else {
      setErrors(prev => prev + 1);
      // Still advance but mark as error - simplified: just count error, don't advance
    }
  }, [currentIndex, errors, isComplete, onComplete, startTime, text, totalKeystrokes]);

  // Report progress changes
  useEffect(() => {
    if (onProgressChange) {
      const pct = Math.round((currentIndex / text.length) * 100);
      onProgressChange(pct);
    }
  }, [currentIndex, text.length, onProgressChange]);

  const progress = (currentIndex / text.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto"
    >
      {/* Header info */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-bold">
            Rodada {round}
          </span>
          <span className="px-3 py-1 rounded-full bg-accent text-accent-foreground text-sm font-bold">
            {difficulty}
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

      {/* Label */}
      <p className="text-sm text-muted-foreground mb-3 font-body">{label}</p>

      {/* Typing area */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="glass-card p-8 cursor-text focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
      >
        <p className="text-xl md:text-2xl leading-relaxed font-body select-none" style={{ wordBreak: "break-word" }}>
          {text.split("").map((char, i) => {
            let className = "text-muted-foreground/40"; // pending
            if (i < currentIndex) {
              className = "text-primary"; // correct
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
