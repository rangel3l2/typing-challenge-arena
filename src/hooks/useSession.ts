import { useState } from "react";

function getOrCreateSessionId(): string {
  const key = "typerace_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function useSession() {
  const [sessionId] = useState(getOrCreateSessionId);
  return sessionId;
}
