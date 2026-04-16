import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Smile, Image, Mic, Square, X, Play, Pause, ChevronDown } from "lucide-react";
import { STICKER_PACKS, type Sticker } from "@/lib/stickers";

interface ChatMessage {
  id: string;
  session_id: string;
  player_name: string;
  player_color: string;
  message_type: string;
  content: string;
  audio_url: string | null;
  created_at: string;
}

interface RoomChatProps {
  roomId: string;
  sessionId: string;
  playerName: string;
  playerColor: string;
}

const EmojiPicker = ({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) => {
  const commonEmojis = [
    "😀", "😂", "😍", "🤩", "😎", "🤔", "😮", "😢", "😡", "🥳",
    "👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "💪", "🔥", "⚡",
    "❤️", "💙", "💚", "💛", "🧡", "💜", "🖤", "🤍", "💯", "✨",
    "🎉", "🎊", "🏆", "🥇", "🚀", "⭐", "🌟", "💥", "💨", "🎯",
    "😜", "🤪", "😏", "🙃", "😈", "👻", "💀", "🤡", "👑", "🧠",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-2 left-0 right-0 bg-card border border-border rounded-xl p-3 shadow-xl z-50"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-body font-semibold text-muted-foreground">Emojis</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-10 gap-1 max-h-32 overflow-y-auto">
        {commonEmojis.map((emoji) => (
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
};

const StickerPicker = ({ onSelect, onClose }: { onSelect: (sticker: Sticker) => void; onClose: () => void }) => {
  const [activePack, setActivePack] = useState(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-2 left-0 right-0 bg-card border border-border rounded-xl p-3 shadow-xl z-50"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {STICKER_PACKS.map((pack, i) => (
            <button
              key={pack.name}
              onClick={() => setActivePack(i)}
              className={`text-xs px-2 py-1 rounded-lg font-body transition-colors ${
                i === activePack ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {pack.name}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto">
        {STICKER_PACKS[activePack].stickers.map((sticker) => (
          <button
            key={sticker.id}
            onClick={() => { onSelect(sticker); onClose(); }}
            className="text-3xl hover:bg-muted rounded-lg p-1 transition-colors flex items-center justify-center"
            title={sticker.label}
          >
            {sticker.url}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

const AudioPlayer = ({ url }: { url: string }) => {
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
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <button onClick={toggle} className="shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors">
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

const RoomChat = ({ roomId, sessionId, playerName, playerColor }: RoomChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial messages
  useEffect(() => {
    if (!roomId) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data as ChatMessage[]);
    };
    fetchMessages();
  }, [roomId]);

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`chat-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => [...prev, msg]);
          if (!isOpen) setUnreadCount((c) => c + 1);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, isOpen]);

  // Auto-scroll
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Reset unread when opening
  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  const sendMessage = useCallback(async (type: string, content: string, audioUrl?: string) => {
    if (!content.trim() && !audioUrl) return;
    await supabase.from("room_messages").insert({
      room_id: roomId,
      session_id: sessionId,
      player_name: playerName,
      player_color: playerColor,
      message_type: type,
      content: content.trim(),
      audio_url: audioUrl || null,
    });
  }, [roomId, sessionId, playerName, playerColor]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage("text", input);
    setInput("");
    setShowEmojis(false);
    setShowStickers(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    setInput((prev) => prev + emoji);
  };

  const handleStickerSelect = (sticker: Sticker) => {
    sendMessage("sticker", sticker.url);
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 500) return; // too short

        const fileName = `${roomId}/${Date.now()}_${sessionId.slice(0, 8)}.webm`;
        const { data, error } = await supabase.storage.from("chat-audio").upload(fileName, blob, { contentType: "audio/webm" });
        if (error) { console.error("Upload error:", error); return; }

        const { data: urlData } = supabase.storage.from("chat-audio").getPublicUrl(data.path);
        sendMessage("audio", "🎤 Áudio", urlData.publicUrl);
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      console.error("Mic access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  // Max 30s recording
  useEffect(() => {
    if (isRecording && recordingTime >= 30) stopRecording();
  }, [recordingTime, isRecording]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const isMe = (msg: ChatMessage) => msg.session_id === sessionId;

  return (
    <>
      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center glow-primary"
      >
        {isOpen ? <ChevronDown className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] h-96 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center gap-2 shrink-0">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="font-display font-bold text-foreground text-sm">Chat da Sala</span>
              <span className="text-xs text-muted-foreground ml-auto">{messages.length} msg</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {messages.length === 0 && (
                <p className="text-center text-muted-foreground/50 text-xs font-body mt-8">
                  Nenhuma mensagem ainda. Diga oi! 👋
                </p>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${isMe(msg) ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] ${isMe(msg) ? "order-1" : ""}`}>
                    {!isMe(msg) && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: msg.player_color }} />
                        <span className="text-[10px] font-body font-semibold text-muted-foreground">{msg.player_name}</span>
                      </div>
                    )}
                    <div className={`rounded-2xl px-3 py-1.5 ${
                      isMe(msg)
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    } ${msg.message_type === "sticker" ? "bg-transparent !px-0 !py-0 text-4xl" : ""}`}>
                      {msg.message_type === "audio" && msg.audio_url ? (
                        <AudioPlayer url={msg.audio_url} />
                      ) : msg.message_type === "sticker" ? (
                        <span className="text-5xl leading-none">{msg.content}</span>
                      ) : (
                        <p className="text-sm font-body break-words">{msg.content}</p>
                      )}
                    </div>
                    <p className={`text-[9px] text-muted-foreground/50 mt-0.5 ${isMe(msg) ? "text-right" : ""}`}>
                      {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-2 border-t border-border shrink-0 relative">
              <AnimatePresence>
                {showEmojis && <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojis(false)} />}
                {showStickers && <StickerPicker onSelect={handleStickerSelect} onClose={() => setShowStickers(false)} />}
              </AnimatePresence>

              {isRecording ? (
                <div className="flex items-center gap-2">
                  <motion.div animate={{ opacity: [1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity }} className="w-3 h-3 rounded-full bg-destructive" />
                  <span className="text-sm font-mono text-destructive font-bold flex-1">{formatTime(recordingTime)}</span>
                  <button onClick={cancelRecording} className="p-2 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={stopRecording} className="p-2 bg-primary text-primary-foreground rounded-full">
                    <Square className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setShowEmojis(!showEmojis); setShowStickers(false); }}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    title="Emojis"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setShowStickers(!showStickers); setShowEmojis(false); }}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    title="Figurinhas"
                  >
                    <Image className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Mensagem..."
                    maxLength={200}
                    className="flex-1 bg-muted rounded-full px-3 py-1.5 text-sm font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
                  />
                  {input.trim() ? (
                    <button onClick={handleSend} className="p-1.5 text-primary hover:text-primary/80 transition-colors">
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={startRecording} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Gravar áudio">
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default RoomChat;
