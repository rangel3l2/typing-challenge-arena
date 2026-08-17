import { useCallback, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreatePlayerSessionId, readPlayerSession, writePlayerSession } from "@/lib/playerSession";

function generatePlayerCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getPlayerCode(): string | null {
  return readPlayerSession("playerCode");
}

export function useSession() {
  const [sessionId, setSessionId] = useState(getOrCreatePlayerSessionId);
  const [playerCode, setPlayerCode] = useState<string | null>(getPlayerCode);
  const [playerName, setPlayerName] = useState<string | null>(() => readPlayerSession("playerName"));

  useEffect(() => {
    writePlayerSession("sessionId", sessionId);
    if (playerCode) writePlayerSession("playerCode", playerCode);
    if (playerName) writePlayerSession("playerName", playerName);
  }, [playerCode, playerName, sessionId]);

  // Register identity when we have a name and no code yet
  const registerIdentity = useCallback(async (name: string): Promise<string> => {
    // Check if session already has a code
    const { data: existing } = await supabase
      .from("player_identities")
      .select("player_code, name")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existing) {
      writePlayerSession("playerCode", existing.player_code);
      writePlayerSession("playerName", name);
      setPlayerCode(existing.player_code);
      setPlayerName(name);
      // Update name if different
      if (existing.name !== name) {
        await supabase
          .from("player_identities")
          .update({ name })
          .eq("session_id", sessionId);
      }
      return existing.player_code;
    }

    // Generate new code
    let code = generatePlayerCode();
    let attempts = 0;
    while (attempts < 10) {
      const { error } = await supabase
        .from("player_identities")
        .insert({ session_id: sessionId, player_code: code, name });
      if (!error) break;
      code = generatePlayerCode();
      attempts++;
    }

    writePlayerSession("playerCode", code);
    writePlayerSession("playerName", name);
    setPlayerCode(code);
    setPlayerName(name);
    return code;
  }, [sessionId]);

  // Restore session from a player tag like "Name#123456"
  const restoreFromTag = useCallback(async (tag: string): Promise<{ sessionId: string; name: string } | null> => {
    const match = tag.match(/^(.+)#(\d{6})$/);
    if (!match) return null;

    const [, , code] = match;
    const { data } = await supabase
      .from("player_identities")
      .select("session_id, name")
      .eq("player_code", code)
      .maybeSingle();

    if (!data) return null;

    // Adopt this session
    writePlayerSession("sessionId", data.session_id);
    writePlayerSession("playerCode", code);
    writePlayerSession("playerName", data.name);
    setSessionId(data.session_id);
    setPlayerCode(code);
    setPlayerName(data.name);
    return { sessionId: data.session_id, name: data.name };
  }, []);

  return { sessionId, playerCode, playerName, registerIdentity, restoreFromTag };
}
