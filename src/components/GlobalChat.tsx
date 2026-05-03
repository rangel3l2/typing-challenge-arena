// Global lobby chat — visible on the home page so players can meet,
// share room codes, and start matches together.
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Smile, Image, Mic, Square, X, Globe, Flag, Share2, Users } from "lucide-react";
import { EmojiPicker, StickerPicker, AudioPlayer, type Sticker } from "@/components/ChatPickers";
import { filterProfanity, containsProfanity, tokenizeMessage, getReportedIds, reportMessage } from "@/lib/chatModeration";
import { toast } from "sonner";

interface GlobalMessage {
  id: string;
  session_id: string;
  player_name: string;
  player_code: string;
  player_color: string;
  message_type: string;
  content: string;
  audio_url: string | null;
  room_code: string | null;
  created_at: string;
}

interface GlobalChatProps {
  sessionId: string;
  playerName: string;
  playerCode: string;
  playerColor?: string;
  /** Compact: 360px height. Otherwise: full panel. */
  compact?: boolean;
}

const MESSAGE_LIMIT = 100;
const COLOR_PALETTE = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

function colorFromCode(code: string): string {
  if (!code) return COLOR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) | 0;
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

function getActiveRoomCode(): string | null {
  try {
    const raw = sessionStorage.getItem("typerace_active_room");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.code || null;
  } catch {
    return null;
  }
}

const GlobalChat = ({ sessionId, playerName, playerCode, playerColor, compact = false }: GlobalChatProps) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<GlobalMessage[]>([]);
  const [input, setInput] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [reported, setReported] = useState<Set<string>>(getReportedIds);
  const [onlineCount, setOnlineCount] = useState(1);
  // Status of rooms referenced in chat: "open" (joinable), "closed" (ended/abandoned/missing), or undefined (loading)
  const [roomStatuses, setRoomStatuses] = useState<Record<string, "open" | "closed">>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentRef = useRef<number>(0);

  const myColor = playerColor || colorFromCode(playerCode || sessionId);

  // Fetch initial messages
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("global_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(MESSAGE_LIMIT);
      if (data) setMessages((data as GlobalMessage[]).reverse());
    };
    load();
  }, []);

  // Realtime + presence
  useEffect(() => {
    const channel = supabase
      .channel("global-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "global_messages" }, (payload) => {
        const msg = payload.new as GlobalMessage;
        setMessages((prev) => {
          const next = [...prev, msg];
          return next.length > MESSAGE_LIMIT ? next.slice(-MESSAGE_LIMIT) : next;
        });
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: playerName || "Visitante", at: Date.now() });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [playerName]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (type: string, rawContent: string, audioUrl?: string, roomCode?: string) => {
    if (!playerName.trim()) {
      toast.error("Digite seu nome antes de enviar mensagens");
      return;
    }
    // Rate limit: 1 msg per 1.5s
    const now = Date.now();
    if (now - lastSentRef.current < 1500) {
      toast.warning("Aguarde um instante antes de enviar outra mensagem");
      return;
    }
    lastSentRef.current = now;

    const content = type === "text" ? filterProfanity(rawContent.slice(0, 200)) : rawContent;
    if (!content && !audioUrl) return;

    const { error } = await supabase.from("global_messages").insert({
      session_id: sessionId,
      player_name: playerName.trim().slice(0, 30),
      player_code: playerCode || "",
      player_color: myColor,
      message_type: type,
      content,
      audio_url: audioUrl || null,
      room_code: roomCode || null,
    });
    if (error) toast.error("Erro ao enviar mensagem");
  }, [sessionId, playerName, playerCode, myColor]);

  const handleSend = () => {
    if (!input.trim()) return;
    if (containsProfanity(input)) {
      toast.warning("Mensagem ajustada para manter o chat amigável 💛");
    }
    sendMessage("text", input);
    setInput("");
    setShowEmojis(false);
    setShowStickers(false);
  };

  const activeRoomCode = getActiveRoomCode();

  const handleShareRoom = () => {
    const code = getActiveRoomCode();
    if (!code) {
      // No active room — take the player straight into the create-room flow
      if (!playerName.trim()) {
        toast.error("Digite seu nome primeiro");
        return;
      }
      localStorage.setItem("typerace_player_name", playerName.trim());
      toast.info("Crie sua sala — depois é só voltar e compartilhar! 🎮");
      navigate("/game", { state: { playerName: playerName.trim(), action: "create" } });
      return;
    }
    sendMessage("text", `Bora jogar na minha sala: ${code} 🎮`, undefined, code);
  };

  const handleReport = (id: string) => {
    reportMessage(id);
    setReported(new Set(getReportedIds()));
    toast.success("Mensagem ocultada");
  };

  const handleJoinByCode = (code: string) => {
    if (!playerName.trim()) {
      toast.error("Digite seu nome primeiro");
      return;
    }
    localStorage.setItem("typerace_player_name", playerName.trim());
    navigate(`/join/${code}`);
  };

  // Audio recording
  const startRecording = async () => {
    if (!playerName.trim()) {
      toast.error("Digite seu nome primeiro");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 500) return;
        const fileName = `global/${Date.now()}_${sessionId.slice(0, 8)}.webm`;
        const { data, error } = await supabase.storage.from("chat-audio").upload(fileName, blob, { contentType: "audio/webm" });
        if (error) return;
        const { data: urlData } = supabase.storage.from("chat-audio").getPublicUrl(data.path);
        sendMessage("audio", "🎤 Áudio", urlData.publicUrl);
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone");
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

  useEffect(() => {
    if (isRecording && recordingTime >= 30) stopRecording();
  }, [recordingTime, isRecording]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const isMe = (msg: GlobalMessage) => msg.session_id === sessionId;

  const visibleMessages = useMemo(
    () => messages.filter((m) => !reported.has(m.id)),
    [messages, reported]
  );

  return (
    <div className={`w-full bg-card border-2 border-primary/30 rounded-2xl shadow-xl flex flex-col overflow-hidden ${compact ? "h-[360px]" : "h-full min-h-[420px]"}`}>
      {/* Header */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-primary/15 to-secondary/15 border-b border-border flex items-center gap-2 shrink-0">
        <Globe className="w-4 h-4 text-primary" />
        <span className="font-display font-bold text-foreground text-sm">Chat Global</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground font-body">
          <Users className="w-3 h-3" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {onlineCount} online
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {visibleMessages.length === 0 && (
          <div className="text-center text-muted-foreground/60 text-xs font-body mt-8 px-4">
            <p className="mb-2">💬 Seja o primeiro a dizer oi!</p>
            <p className="text-[11px]">Compartilhe seu código de sala para jogar com outras pessoas.</p>
          </div>
        )}
        {visibleMessages.map((msg) => {
          const mine = isMe(msg);
          return (
            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"} group`}>
              <div className={`max-w-[80%] ${mine ? "order-1" : ""}`}>
                {!mine && (
                  <div className="flex items-center gap-1 mb-0.5">
                    <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: msg.player_color }} />
                    <span className="text-[10px] font-body font-semibold text-muted-foreground">
                      {msg.player_name}
                      {msg.player_code && <span className="opacity-50">#{msg.player_code}</span>}
                    </span>
                  </div>
                )}
                <div className={`relative rounded-2xl px-3 py-1.5 ${
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                } ${msg.message_type === "sticker" ? "bg-transparent !px-0 !py-0" : ""}`}>
                  {msg.message_type === "audio" && msg.audio_url ? (
                    <AudioPlayer url={msg.audio_url} />
                  ) : msg.message_type === "sticker" ? (
                    <span className="text-5xl leading-none">{msg.content}</span>
                  ) : (
                    <p className="text-sm font-body break-words">
                      {tokenizeMessage(msg.content).map((tok, i) =>
                        tok.type === "code" ? (
                          <button
                            key={i}
                            onClick={() => handleJoinByCode(tok.value)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md font-mono font-bold text-xs transition-all hover:scale-105 ${
                              mine
                                ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
                                : "bg-accent/20 text-accent hover:bg-accent/30"
                            }`}
                            title={`Entrar na sala ${tok.value}`}
                          >
                            🎮 {tok.value}
                          </button>
                        ) : (
                          <span key={i}>{tok.value}</span>
                        )
                      )}
                    </p>
                  )}
                  {msg.room_code && msg.message_type === "text" && (
                    <button
                      onClick={() => handleJoinByCode(msg.room_code!)}
                      className={`mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-display font-bold transition-all hover:scale-[1.02] ${
                        mine
                          ? "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
                          : "bg-accent text-accent-foreground hover:brightness-110"
                      }`}
                    >
                      🎮 Entrar na sala
                    </button>
                  )}
                </div>
                <div className={`flex items-center gap-1.5 mt-0.5 ${mine ? "justify-end" : ""}`}>
                  <span className="text-[9px] text-muted-foreground/50">
                    {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {!mine && (
                    <button
                      onClick={() => handleReport(msg.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
                      title="Denunciar / ocultar"
                    >
                      <Flag className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick action: share my room (or create one) */}
      <div className="px-2 pt-2 shrink-0">
        <button
          onClick={handleShareRoom}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl border transition-all text-xs font-body font-semibold ${
            activeRoomCode
              ? "bg-accent/15 text-accent border-accent/30 hover:bg-accent/25"
              : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
          }`}
        >
          <Share2 className="w-3 h-3" />
          {activeRoomCode ? `Compartilhar minha sala (${activeRoomCode})` : "Crie uma sala para compartilhar"}
        </button>
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border shrink-0 relative mt-2">
        <AnimatePresence>
          {showEmojis && <EmojiPicker onSelect={(e) => setInput((p) => p + e)} onClose={() => setShowEmojis(false)} />}
          {showStickers && <StickerPicker onSelect={(s: Sticker) => { sendMessage("sticker", s.url); setShowStickers(false); }} onClose={() => setShowStickers(false)} />}
        </AnimatePresence>

        {isRecording ? (
          <div className="flex items-center gap-2">
            <motion.div animate={{ opacity: [1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity }} className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-sm font-mono text-destructive font-bold flex-1">{formatTime(recordingTime)}</span>
            <button onClick={cancelRecording} className="p-2 text-muted-foreground hover:text-foreground" aria-label="Cancelar">
              <X className="w-4 h-4" />
            </button>
            <button onClick={stopRecording} className="p-2 bg-primary text-primary-foreground rounded-full" aria-label="Enviar áudio">
              <Square className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={() => { setShowEmojis(!showEmojis); setShowStickers(false); }} className="p-1.5 text-muted-foreground hover:text-foreground" title="Emojis">
              <Smile className="w-4 h-4" />
            </button>
            <button onClick={() => { setShowStickers(!showStickers); setShowEmojis(false); }} className="p-1.5 text-muted-foreground hover:text-foreground" title="Figurinhas">
              <Image className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={playerName.trim() ? "Diga oi para todos..." : "Digite seu nome acima primeiro"}
              maxLength={200}
              disabled={!playerName.trim()}
              className="flex-1 bg-muted rounded-full px-3 py-1.5 text-sm font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0 disabled:opacity-50"
            />
            {input.trim() ? (
              <button onClick={handleSend} className="p-1.5 text-primary hover:text-primary/80" aria-label="Enviar">
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={startRecording} className="p-1.5 text-muted-foreground hover:text-foreground" title="Gravar áudio">
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalChat;
