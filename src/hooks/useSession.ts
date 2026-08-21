import { useCallback, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parsePlayerRecoveryCode } from "@/lib/playerCode";
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
    let created = false;
    let lastError = "Não foi possível criar o código de recuperação.";
    for (let attempts = 0; attempts < 10; attempts += 1) {
      const { error } = await supabase
        .from("player_identities")
        .insert({ session_id: sessionId, player_code: code, name });
      if (!error) {
        created = true;
        break;
      }
      lastError = error.message;
      code = generatePlayerCode();
    }

    if (!created) throw new Error(lastError);

    writePlayerSession("playerCode", code);
    writePlayerSession("playerName", name);
    setPlayerCode(code);
    setPlayerName(name);
    return code;
  }, [sessionId]);

  // This is a progress recovery code, not an authentication credential.
  const restoreFromTag = useCallback(async (tag: string): Promise<{ sessionId: string; name: string; code: string } | null> => {
    const code = parsePlayerRecoveryCode(tag);
    if (!code) return null;

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
    return { sessionId: data.session_id, name: data.name, code };
  }, []);

  return { sessionId, playerCode, playerName, registerIdentity, restoreFromTag };
}
