import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

function generatePlayerCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getOrCreateSessionId(): string {
  const key = "typerace_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function getPlayerCode(): string | null {
  return localStorage.getItem("typerace_player_code");
}

export function useSession() {
  const [sessionId, setSessionId] = useState(getOrCreateSessionId);
  const [playerCode, setPlayerCode] = useState<string | null>(getPlayerCode);

  // Register identity when we have a name and no code yet
  const registerIdentity = async (name: string): Promise<string> => {
    // Check if session already has a code
    const { data: existing } = await supabase
      .from("player_identities")
      .select("player_code, name")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existing) {
      localStorage.setItem("typerace_player_code", existing.player_code);
      setPlayerCode(existing.player_code);
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

    localStorage.setItem("typerace_player_code", code);
    setPlayerCode(code);
    return code;
  };

  // Restore session from a player tag like "Name#123456"
  const restoreFromTag = async (tag: string): Promise<{ sessionId: string; name: string } | null> => {
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
    localStorage.setItem("typerace_session_id", data.session_id);
    localStorage.setItem("typerace_player_code", code);
    localStorage.setItem("typerace_player_name", data.name);
    setSessionId(data.session_id);
    setPlayerCode(code);
    return { sessionId: data.session_id, name: data.name };
  };

  return { sessionId, playerCode, registerIdentity, restoreFromTag };
}
