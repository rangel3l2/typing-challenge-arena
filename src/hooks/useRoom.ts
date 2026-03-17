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

export function useRoom(sessionId: string) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [roundResults, setRoundResults] = useState<RoundResultRow[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

  // Subscribe to realtime changes
  const subscribe = useCallback((roomId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`room-${roomId}`)
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
      .subscribe();

    channelRef.current = channel;
  }, [fetchPlayers, fetchResults]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // Create a new room
  const createRoom = useCallback(async (playerName: string): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const code = generateRoomCode();
      const { data: roomData, error: roomErr } = await supabase
        .from("rooms")
        .insert({ code, owner_session_id: sessionId, max_rounds: 10 })
        .select()
        .single();

      if (roomErr || !roomData) throw new Error(roomErr?.message || "Failed to create room");

      const roomState = roomData as RoomState;
      setRoom(roomState);

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
      setMyPlayerId((playerData as RoomPlayer).id);

      await fetchPlayers(roomState.id);
      subscribe(roomState.id);
      setLoading(false);
      return code;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      return null;
    }
  }, [sessionId, fetchPlayers, subscribe]);

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

      // Check if already in room
      const { data: existing } = await supabase
        .from("room_players")
        .select("*")
        .eq("room_id", roomState.id)
        .eq("session_id", sessionId)
        .maybeSingle();

      if (existing) {
        setMyPlayerId((existing as RoomPlayer).id);
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
        setMyPlayerId((playerData as RoomPlayer).id);
      }

      await fetchPlayers(roomState.id);
      await fetchResults(roomState.id);
      subscribe(roomState.id);
      setLoading(false);
      return true;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      return false;
    }
  }, [sessionId, fetchPlayers, fetchResults, subscribe]);

  // Update room status (owner only)
  const updateRoom = useCallback(async (updates: Partial<Pick<RoomState, "status" | "current_round">>) => {
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

  const isOwner = room?.owner_session_id === sessionId;

  return {
    room,
    players,
    roundResults,
    myPlayerId,
    isOwner,
    loading,
    error,
    createRoom,
    joinRoom,
    updateRoom,
    submitResult,
  };
}
