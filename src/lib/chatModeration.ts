// Moderação leve de chat — focada em público infantil/educacional pt-BR.
// Filtragem client-side (não substitui validação server, mas o chat é público intencionalmente).

const BAD_WORDS = [
  // Palavrões pt-BR comuns (lista intencionalmente curta, sem expor o vocabulário todo)
  "porra", "caralho", "merda", "bosta", "buceta", "puta", "cuzao", "cuzão",
  "viado", "viadinho", "arrombado", "fdp", "filho da puta", "vagabunda",
  "piranha", "puto", "puta que pariu", "pqp", "vsf", "vai se fuder", "vtnc",
  "krl", "kct", "cu", "xota", "pinto", "rola", "boquete", "broxa",
  // En
  "fuck", "shit", "bitch", "asshole", "dick", "cunt", "pussy", "fag",
];

const LEET_MAP: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .split("")
    .map((c) => LEET_MAP[c] ?? c)
    .join("");
}

/** Replaces detected bad words with stars of the same length. */
export function filterProfanity(text: string): string {
  if (!text) return text;
  const normalized = normalize(text);
  let result = text;

  for (const word of BAD_WORDS) {
    // Match word with optional spaces/punctuation between letters (basic obfuscation)
    const pattern = word.split("").map((c) => `${c}[\\s._-]?`).join("");
    const re = new RegExp(`\\b${pattern.slice(0, -8)}\\b`, "gi");
    if (re.test(normalized)) {
      // Find the same range in the original text and mask
      const simpleRe = new RegExp(`\\b${word.replace(/\s/g, "\\s?")}\\b`, "gi");
      result = result.replace(simpleRe, (m) => "*".repeat(m.length));
    }
  }
  return result;
}

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  return BAD_WORDS.some((w) => {
    const re = new RegExp(`\\b${w.replace(/\s/g, "\\s?")}\\b`, "i");
    return re.test(normalized);
  });
}

// ─── Room code detection ────────────────────────────────────────────────
// Room codes are uppercase alphanumeric, 4-6 chars.
const ROOM_CODE_RE = /\b([A-Z0-9]{4,6})\b/g;

export interface ChatToken {
  type: "text" | "code";
  value: string;
}

/** Tokenizes a chat message, splitting out potential room codes. */
export function tokenizeMessage(text: string): ChatToken[] {
  if (!text) return [];
  const tokens: ChatToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  ROOM_CODE_RE.lastIndex = 0;

  while ((match = ROOM_CODE_RE.exec(text)) !== null) {
    // Skip pure numeric (likely just numbers, not codes) unless 6 chars
    const candidate = match[1];
    const isAllDigits = /^\d+$/.test(candidate);
    if (isAllDigits && candidate.length !== 6) continue;
    // Skip if all letters and looks like a regular word (heuristic: must have at least one digit OR be ALL CAPS in a 4-6 range)
    // Already enforced uppercase by regex, but also require either a digit OR length >= 5 to reduce false positives like "OLA" (3 chars don't match anyway)
    const hasDigit = /\d/.test(candidate);
    if (!hasDigit && candidate.length < 5) continue;

    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    tokens.push({ type: "code", value: candidate });
    lastIndex = match.index + candidate.length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }
  return tokens.length > 0 ? tokens : [{ type: "text", value: text }];
}

// ─── Local report list (hides messages locally only) ──────────────────
const REPORT_KEY = "typerace_reported_messages";

export function getReportedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function reportMessage(id: string) {
  const set = getReportedIds();
  set.add(id);
  localStorage.setItem(REPORT_KEY, JSON.stringify([...set].slice(-500)));
}
