// Shared chat UI primitives: Emoji picker, Sticker picker, Audio player.
// Used by RoomChat and GlobalChat to keep behavior consistent.
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X, Play, Pause } from "lucide-react";
import { STICKER_PACKS, type Sticker } from "@/lib/stickers";

const COMMON_EMOJIS = [
  // Personagem & temas do jogo
  "🧒", "⌨️", "🎈", "🏎️", "🚴", "🏁", "🏆", "🥇", "🥈", "🥉",
  // Matemática & acertar
  "➕", "➖", "✖️", "➗", "🔢", "🧠", "💡", "🎯", "✅", "❌",
  // Velocidade & energia
  "⚡", "🔥", "💨", "💥", "💯", "✨", "🌟", "⭐", "🚀", "⏱️",
  // Reações faciais
  "😀", "😂", "😍", "🤩", "😎", "🤔", "😮", "😢", "😤", "🥳",
  // Mãos & gestos
  "👍", "👎", "👏", "🙌", "🤝", "💪", "🤞", "👆", "🙏", "👑",
  // Diversão
  "🎉", "🎊", "🎮", "❤️", "💙", "💚", "💛", "💜", "🤡", "💀",
];

export const EmojiPicker = ({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 10 }}
    className="absolute bottom-full mb-2 left-0 right-0 bg-card border border-border rounded-xl p-3 shadow-xl z-50"
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-body font-semibold text-muted-foreground">Emojis</span>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
        <X className="w-3 h-3" />
      </button>
    </div>
    <div className="grid grid-cols-10 gap-1 max-h-32 overflow-y-auto">
      {COMMON_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose(); }}
          className="text-xl hover:bg-muted rounded p-0.5 transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  </motion.div>
);

export const StickerPicker = ({ onSelect, onClose }: { onSelect: (sticker: Sticker) => void; onClose: () => void }) => {
  const [activePack, setActivePack] = useState(0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-2 left-0 right-0 bg-card border border-border rounded-xl p-3 shadow-xl z-50"
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide flex-1">
          {STICKER_PACKS.map((pack, i) => (
            <button
              key={pack.name}
              onClick={() => setActivePack(i)}
              className={`text-[11px] px-2 py-1 rounded-lg font-body transition-colors whitespace-nowrap shrink-0 ${
                i === activePack ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {pack.name}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Fechar">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
        {STICKER_PACKS[activePack].stickers.map((sticker) => (
          <button
            key={sticker.id}
            onClick={() => { onSelect(sticker); onClose(); }}
            className="text-2xl hover:bg-muted rounded-lg p-2 transition-colors flex flex-col items-center justify-center gap-0.5"
            title={sticker.label}
          >
            <span>{sticker.url}</span>
            <span className="text-[9px] font-body text-muted-foreground leading-none">{sticker.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export const AudioPlayer = ({ url }: { url: string }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("timeupdate", () => setProgress(audio.currentTime / (audio.duration || 1)));
    audio.addEventListener("ended", () => { setPlaying(false); setProgress(0); });
    return () => { audio.pause(); audio.src = ""; };
  }, [url]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <button onClick={toggle} className="shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors" aria-label={playing ? "Pausar" : "Tocar"}>
        {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
      </button>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
        {duration > 0 ? `${Math.floor(duration)}s` : "..."}
      </span>
    </div>
  );
};

export type { Sticker };
