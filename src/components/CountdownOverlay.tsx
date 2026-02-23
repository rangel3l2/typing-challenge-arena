import { motion, AnimatePresence } from "framer-motion";

interface CountdownOverlayProps {
  count: number;
}

const CountdownOverlay = ({ count }: CountdownOverlayProps) => {
  const label = count === 0 ? "VAI!" : count.toString();
  const color = count === 0 ? "text-primary" : "text-accent";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={count}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.5, opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md"
      >
        <motion.span
          className={`text-9xl font-display font-bold ${color}`}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.5 }}
        >
          {label}
        </motion.span>
      </motion.div>
    </AnimatePresence>
  );
};

export default CountdownOverlay;
