export const PLAYER_SESSION_KEYS = {
  sessionId: "typerace_session_id",
  playerCode: "typerace_player_code",
  playerName: "typerace_player_name",
} as const;

type PlayerSessionKey = keyof typeof PLAYER_SESSION_KEYS;

function browserReady() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readCookie(name: string) {
  if (!browserReady()) return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

function writeTemporaryCookie(name: string, value: string) {
  if (!browserReady()) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${secure}`;
}

export function readPlayerSession(key: PlayerSessionKey) {
  if (!browserReady()) return null;
  const storageKey = PLAYER_SESSION_KEYS[key];
  const localValue = window.localStorage.getItem(storageKey);
  if (localValue) {
    writeTemporaryCookie(storageKey, localValue);
    return localValue;
  }
  const cookieValue = readCookie(storageKey);
  if (cookieValue) window.localStorage.setItem(storageKey, cookieValue);
  return cookieValue;
}

export function writePlayerSession(key: PlayerSessionKey, value: string) {
  if (!browserReady()) return;
  const storageKey = PLAYER_SESSION_KEYS[key];
  window.localStorage.setItem(storageKey, value);
  writeTemporaryCookie(storageKey, value);
}

export function getOrCreatePlayerSessionId() {
  const existing = readPlayerSession("sessionId");
  if (existing) return existing;
  const sessionId = crypto.randomUUID();
  writePlayerSession("sessionId", sessionId);
  return sessionId;
}
