import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Smile, Image, Mic, Square, X, ChevronDown, History, Globe, Users } from "lucide-react";
import { EmojiPicker, StickerPicker, AudioPlayer, type Sticker } from "@/components/ChatPickers";
import { filterProfanity, containsProfanity, tokenizeMessage, getReportedIds, reportMessage } from "@/lib/chatModeration";
import GlobalChat from "@/components/GlobalChat";
import { toast } from "sonner";

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

interface GlobalContextMessage {
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
  /** When true, renders as a large always-visible panel (use between matches) */
  expanded?: boolean;
  /** Other players in the room (used to fetch prior global conversation context) */
  participantSessionIds?: string[];
  /** Player code (for the embedded global chat tab) */
  playerCode?: string;
  /** Default visible tab. "global" is useful right after creating a room so the owner can share. */
  defaultTab?: "room" | "global";
  /** Show the Global tab inside this chat (only makes sense in expanded mode). */
  showGlobalTab?: boolean;
  /** True for the room owner — used to prompt when a new player joins. */
  isOwner?: boolean;
}

const RoomChat = ({
  roomId,
  sessionId,
  playerName,
  playerColor,
  expanded = false,
  participantSessionIds = [],
  playerCode = "",
  defaultTab = "room",
  showGlobalTab = false,
  isOwner = false,
}: RoomChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"room" | "global">(defaultTab);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [globalContext, setGlobalContext] = useState<GlobalContextMessage[]>([]);
  const [showContext, setShowContext] = useState(false);
  const [input, setInput] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reported, setReported] = useState<Set<string>>(getReportedIds);
  const [joinPrompt, setJoinPrompt] = useState<string | null>(null);
  const prevParticipantCountRef = useRef<number>(participantSessionIds.length);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // When expanded mode is active, the chat is always considered "visible" (no unread badge)
  const effectivelyOpen = expanded || isOpen;

  // Detect new joiners — prompt the owner to choose between Global (invite more) and Room (chat with newcomers).
  useEffect(() => {
    const count = participantSessionIds.length;
    const prev = prevParticipantCountRef.current;
    if (isOwner && showGlobalTab && count > prev && prev >= 1 && activeTab === "global") {
      setJoinPrompt(`Alguém entrou na sua sala! 🎉`);
    }
    prevParticipantCountRef.current = count;
  }, [participantSessionIds.length, isOwner, showGlobalTab, activeTab]);



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
          if (!effectivelyOpen) setUnreadCount((c) => c + 1);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, effectivelyOpen]);

  // Auto-scroll
  useEffect(() => {
    if (effectivelyOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, effectivelyOpen]);

  // Reset unread when opening
  useEffect(() => {
    if (effectivelyOpen) setUnreadCount(0);
  }, [effectivelyOpen]);

  // Fetch prior global conversation history with the other participants in this room.
  // Keeps the social thread continuous between the lobby and the match.
  useEffect(() => {
    if (!roomId) return;
    const others = participantSessionIds.filter((s) => s && s !== sessionId);
    if (others.length === 0) { setGlobalContext([]); return; }
    const ids = [sessionId, ...others];
    const load = async () => {
      const { data } = await supabase
        .from("global_messages")
        .select("id, session_id, player_name, player_color, message_type, content, audio_url, created_at")
        .in("session_id", ids)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setGlobalContext((data as GlobalContextMessage[]).reverse());
    };
    load();
  }, [roomId, sessionId, participantSessionIds.join(",")]);

  const sendMessage = useCallback(async (type: string, rawContent: string, audioUrl?: string) => {
    if (!rawContent.trim() && !audioUrl) return;
    const content = type === "text" ? filterProfanity(rawContent.slice(0, 200)).trim() : rawContent.trim();
    await supabase.from("room_messages").insert({
      room_id: roomId,
      session_id: sessionId,
      player_name: playerName,
      player_color: playerColor,
      message_type: type,
      content,
      audio_url: audioUrl || null,
    });
  }, [roomId, sessionId, playerName, playerColor]);

  const handleSend = () => {
    if (!input.trim()) return;
    if (containsProfanity(input)) toast.warning("Mensagem ajustada para manter o chat amigável 💛");
    sendMessage("text", input);
    setInput("");
    setShowEmojis(false);
    setShowStickers(false);
  };

  const handleReport = (id: string) => {
    reportMessage(id);
    setReported(new Set(getReportedIds()));
    toast.success("Mensagem ocultada");
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

  const visibleMessages = useMemo(() => messages.filter((m) => !reported.has(m.id)), [messages, reported]);
  const visibleContext = useMemo(() => globalContext.filter((m) => !reported.has(m.id)), [globalContext, reported]);

  const renderTextContent = (text: string, mine: boolean) => (
    <p className="text-sm font-body break-words">
      {tokenizeMessage(text).map((tok, i) =>
        tok.type === "code" ? (
          <span
            key={i}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md font-mono font-bold text-xs ${
              mine ? "bg-primary-foreground/20" : "bg-accent/20 text-accent"
            }`}
          >
            🎮 {tok.value}
          </span>
        ) : (
          <span key={i}>{tok.value}</span>
        )
      )}
    </p>
  );

  const panelBody = (
    <>
      {/* Header */}
      <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center gap-2 shrink-0">
        <MessageCircle className="w-4 h-4 text-primary" />
        <span className="font-display font-bold text-foreground text-sm">Chat da Sala</span>
        <span className="text-xs text-muted-foreground ml-auto">{visibleMessages.length} msg</span>
      </div>

      {/* Prior global conversation context */}
      {visibleContext.length > 0 && (
        <div className="border-b border-border bg-muted/20 shrink-0">
          <button
            onClick={() => setShowContext((v) => !v)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-body font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <Globe className="w-3 h-3" />
            <History className="w-3 h-3" />
            Conversa anterior no chat global ({visibleContext.length})
            <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showContext ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {showContext && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-3 pb-2 space-y-1.5 max-h-32 overflow-y-auto"
              >
                {visibleContext.map((m) => (
                  <div key={m.id} className="flex items-start gap-1.5 text-[11px] font-body">
                    <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: m.player_color }} />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-muted-foreground">{m.player_name}: </span>
                      <span className="text-foreground/70 break-words">
                        {m.message_type === "audio" ? "🎤 Áudio" : m.message_type === "sticker" ? m.content : m.content}
                      </span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {visibleMessages.length === 0 && (
          <p className="text-center text-muted-foreground/50 text-xs font-body mt-8">
            Nenhuma mensagem ainda. Diga oi! 👋
          </p>
        )}
        {visibleMessages.map((msg) => {
          const mine = isMe(msg);
          return (
            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"} group`}>
              <div className={`max-w-[75%] ${mine ? "order-1" : ""}`}>
                {!mine && (
                  <div className="flex items-center gap-1 mb-0.5">
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: msg.player_color }} />
                    <span className="text-[10px] font-body font-semibold text-muted-foreground">{msg.player_name}</span>
                  </div>
                )}
                <div className={`rounded-2xl px-3 py-1.5 ${
                  mine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
                } ${msg.message_type === "sticker" ? "bg-transparent !px-0 !py-0 text-4xl" : ""}`}>
                  {msg.message_type === "audio" && msg.audio_url ? (
                    <AudioPlayer url={msg.audio_url} />
                  ) : msg.message_type === "sticker" ? (
                    <span className="text-5xl leading-none">{msg.content}</span>
                  ) : (
                    renderTextContent(msg.content, mine)
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
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
    </>
  );

  // EXPANDED MODE: Large always-visible panel for between-match moments
  if (expanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg mx-auto bg-card border-2 border-primary/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden glow-primary mt-6"
      >
        {showGlobalTab && (
          <div className="flex shrink-0 border-b border-border bg-muted/30">
            <button
              onClick={() => setActiveTab("global")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-display font-bold transition-colors ${
                activeTab === "global"
                  ? "bg-primary/15 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Chat Global
            </button>
            <button
              onClick={() => setActiveTab("room")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-display font-bold transition-colors ${
                activeTab === "room"
                  ? "bg-primary/15 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Chat da Sala
            </button>
          </div>
        )}
        <div className="h-[360px] flex flex-col overflow-hidden">
          {showGlobalTab && activeTab === "global" ? (
            <GlobalChat
              sessionId={sessionId}
              playerName={playerName}
              playerCode={playerCode}
              playerColor={playerColor}
              compact
            />
          ) : (
            panelBody
          )}
        </div>
      </motion.div>
    );
  }

  // FLOATING MODE: Compact button with collapsible panel (during gameplay)
  return (
    <>
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] h-96 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {panelBody}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default RoomChat;
