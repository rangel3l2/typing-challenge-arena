import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode } from "@/lib/gameData";

const playerColors = [
  "hsl(142 70% 45%)",
  "hsl(0 75% 55%)",
  "hsl(170 70% 45%)",
  "hsl(210 80% 55%)",
  "hsl(45 95% 55%)",
  "hsl(270 60% 55%)",
  "hsl(330 70% 55%)",
  "hsl(25 90% 55%)",
];

export interface RoomPlayer {
  id: string;
  session_id: string;
  name: string;
  color: string;
  is_owner: boolean;
}

export interface RoundResultRow {
  id: string;
  player_id: string;
  round: number;
  wpm: number;
  accuracy: number;
  time_ms: number;
}

export interface RoomState {
  id: string;
  code: string;
  status: string;
  current_round: number;
  max_rounds: number;
  owner_session_id: string;
}

const ROOM_STORAGE_KEY = "typerace_active_room";

function saveActiveRoom(roomId: string, code: string) {
  sessionStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify({ roomId, code }));
}

function getActiveRoom(): { roomId: string; code: string } | null {
  try {
    const raw = sessionStorage.getItem(ROOM_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearActiveRoom() {
  sessionStorage.removeItem(ROOM_STORAGE_KEY);
}

export function useRoom(sessionId: string) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [roundResults, setRoundResults] = useState<RoundResultRow[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch room by ID (for recovery)
  const fetchRoom = useCallback(async (roomId: string): Promise<RoomState | null> => {
    const { data } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();
    return data as RoomState | null;
  }, []);

  // Fetch players for a room
  const fetchPlayers = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    if (data) setPlayers(data as RoomPlayer[]);
  }, []);

  // Fetch round results for a room
  const fetchResults = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("round_results")
      .select("*")
      .eq("room_id", roomId)
      .order("round", { ascending: true });
    if (data) setRoundResults(data as RoundResultRow[]);
  }, []);

  // Update online players set from presence state
  const syncPresence = useCallback((channel: ReturnType<typeof supabase.channel>) => {
    const state = channel.presenceState();
    const ids = new Set<string>();
    Object.values(state).forEach((presences: any[]) => {
      presences.forEach((p: any) => {
        if (p.player_id) ids.add(p.player_id);
      });
    });
    setOnlinePlayerIds(ids);
  }, []);

  // Subscribe to presence for a room
  const subscribePresence = useCallback((roomId: string, playerId: string) => {
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
    }

    const channel = supabase.channel(`presence-${roomId}`);
    
    channel
      .on("presence", { event: "sync" }, () => {
        syncPresence(channel);
      })
      .on("presence", { event: "join" }, () => {
        syncPresence(channel);
      })
      .on("presence", { event: "leave" }, () => {
        syncPresence(channel);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ player_id: playerId });
        }
      });

    presenceChannelRef.current = channel;
  }, [syncPresence]);

  // Subscribe to realtime changes with reconnection
  const subscribe = useCallback((roomId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    roomIdRef.current = roomId;

    const channel = supabase
      .channel(`room-${roomId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setRoom(payload.new as RoomState);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` },
        () => {
          fetchPlayers(roomId);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "round_results", filter: `room_id=eq.${roomId}` },
        () => {
          fetchResults(roomId);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Immediately fetch fresh data once subscribed to catch anything missed
          fetchPlayers(roomId);
          fetchResults(roomId);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (roomIdRef.current === roomId) {
              fetchRoom(roomId).then((r) => {
                if (r) setRoom(r);
              });
              fetchPlayers(roomId);
              fetchResults(roomId);
              subscribe(roomId);
            }
          }, 2000);
        }
      });

    channelRef.current = channel;
  }, [fetchPlayers, fetchResults, fetchRoom]);

  // Periodic heartbeat: re-fetch room state every 5s during active gameplay
  useEffect(() => {
    if (!room || room.status === "lobby" || room.status === "final_results") return;
    const interval = setInterval(async () => {
      if (!roomIdRef.current) return;
      const fresh = await fetchRoom(roomIdRef.current);
      if (fresh) setRoom(fresh);
      await fetchResults(roomIdRef.current);
    }, 5000);
    return () => clearInterval(interval);
  }, [room?.id, room?.status, fetchRoom, fetchResults]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  // Try to recover room from sessionStorage on mount
  useEffect(() => {
    const saved = getActiveRoom();
    if (!saved || room) return;

    const recover = async () => {
      setLoading(true);
      try {
        const roomData = await fetchRoom(saved.roomId);
        if (!roomData || roomData.status === "final_results") {
          clearActiveRoom();
          setLoading(false);
          return;
        }
        setRoom(roomData);

        // Find my player
        const { data: myPlayer } = await supabase
          .from("room_players")
          .select("*")
          .eq("room_id", saved.roomId)
          .eq("session_id", sessionId)
          .maybeSingle();

        if (myPlayer) {
          const pid = (myPlayer as RoomPlayer).id;
          setMyPlayerId(pid);
          subscribePresence(saved.roomId, pid);
        }

        await fetchPlayers(saved.roomId);
        await fetchResults(saved.roomId);
        subscribe(saved.roomId);
      } catch {
        clearActiveRoom();
      }
      setLoading(false);
    };
    recover();
  }, [sessionId]);

  // Create a new room
  const createRoom = useCallback(async (playerName: string): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const code = generateRoomCode();
      const { data: roomData, error: roomErr } = await supabase
        .from("rooms")
        .insert({ code, owner_session_id: sessionId, max_rounds: 14 })
        .select()
        .single();

      if (roomErr || !roomData) throw new Error(roomErr?.message || "Failed to create room");

      const roomState = roomData as RoomState;
      setRoom(roomState);
      saveActiveRoom(roomState.id, roomState.code);

      // Add owner as player
      const { data: playerData, error: playerErr } = await supabase
        .from("room_players")
        .insert({
          room_id: roomState.id,
          session_id: sessionId,
          name: playerName,
          color: playerColors[0],
          is_owner: true,
        })
        .select()
        .single();

      if (playerErr || !playerData) throw new Error(playerErr?.message || "Failed to join room");
      const pid = (playerData as RoomPlayer).id;
      setMyPlayerId(pid);

      await fetchPlayers(roomState.id);
      subscribe(roomState.id);
      subscribePresence(roomState.id, pid);
      setLoading(false);
      return code;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      return null;
    }
  }, [sessionId, fetchPlayers, subscribe, subscribePresence]);

  // Join an existing room by code
  const joinRoom = useCallback(async (code: string, playerName: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { data: roomData, error: roomErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code.toUpperCase())
        .single();

      if (roomErr || !roomData) throw new Error("Sala não encontrada");

      const roomState = roomData as RoomState;
      if (roomState.status !== "lobby") throw new Error("O jogo já começou");

      setRoom(roomState);
      saveActiveRoom(roomState.id, roomState.code);

      // Check if already in room
      const { data: existing } = await supabase
        .from("room_players")
        .select("*")
        .eq("room_id", roomState.id)
        .eq("session_id", sessionId)
        .maybeSingle();

      let pid: string;
      if (existing) {
        pid = (existing as RoomPlayer).id;
        setMyPlayerId(pid);
      } else {
        // Get player count for color assignment
        const { count } = await supabase
          .from("room_players")
          .select("*", { count: "exact", head: true })
          .eq("room_id", roomState.id);

        const colorIndex = (count || 0) % playerColors.length;

        const { data: playerData, error: playerErr } = await supabase
          .from("room_players")
          .insert({
            room_id: roomState.id,
            session_id: sessionId,
            name: playerName,
            color: playerColors[colorIndex],
            is_owner: false,
          })
          .select()
          .single();

        if (playerErr || !playerData) throw new Error(playerErr?.message || "Erro ao entrar na sala");
        pid = (playerData as RoomPlayer).id;
        setMyPlayerId(pid);
      }

      await fetchPlayers(roomState.id);
      await fetchResults(roomState.id);
      subscribe(roomState.id);
      subscribePresence(roomState.id, pid);
      setLoading(false);
      return true;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      return false;
    }
  }, [sessionId, fetchPlayers, fetchResults, subscribe, subscribePresence]);

  // Update room status (owner only)
  const updateRoom = useCallback(async (updates: Partial<Pick<RoomState, "status" | "current_round" | "max_rounds">>) => {
    if (!room) return;
    await supabase.from("rooms").update(updates).eq("id", room.id);
  }, [room]);

  // Submit a round result
  const submitResult = useCallback(async (round: number, wpm: number, accuracy: number, timeMs: number) => {
    if (!room || !myPlayerId) return;
    await supabase.from("round_results").insert({
      room_id: room.id,
      player_id: myPlayerId,
      round,
      wpm,
      accuracy,
      time_ms: timeMs,
    });
  }, [room, myPlayerId]);

  // Re-track presence (useful after reconnection)
  const retrackPresence = useCallback(() => {
    if (presenceChannelRef.current && myPlayerId) {
      presenceChannelRef.current.track({ player_id: myPlayerId });
    }
  }, [myPlayerId]);

  const isOwner = room?.owner_session_id === sessionId;

  return {
    room,
    players,
    roundResults,
    myPlayerId,
    isOwner,
    loading,
    error,
    onlinePlayerIds,
    createRoom,
    joinRoom,
    updateRoom,
    submitResult,
    retrackPresence,
  };
}
