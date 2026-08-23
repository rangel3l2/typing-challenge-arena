export const PROGRAMMING_STORAGE_KEYS = {
  code: "eu-vou-programar:robot-v2.py",
  blocks: "eu-vou-programar:ev3-blocks-v2.xml",
  hardware: "eu-vou-programar:ev3-hardware",
  mode: "eu-vou-programar:editor-mode-v2",
  arena: "eu-vou-programar:arena-level",
  challenge: "eu-vou-programar:arena-challenge",
  unlockedMissions: "eu-vou-programar:unlocked-missions-v1",
  completedMissions: "eu-vou-programar:completed-missions-v1",
  basicKnowledgeConfirmed: "eu-vou-programar:basic-knowledge-confirmed-v1",
  draftUpdatedAt: "eu-vou-programar:draft-updated-at",
} as const;

export type ProgrammingStorageField = keyof typeof PROGRAMMING_STORAGE_KEYS;

const LEGACY_OWNER_KEY = "eu-vou-programar:legacy-owner-session";

function browserReady() {
  return typeof window !== "undefined";
}

export function programmingStorageKey(sessionId: string, field: ProgrammingStorageField) {
  return `${PROGRAMMING_STORAGE_KEYS[field]}:${sessionId}`;
}

export function readProgrammingStorage(sessionId: string, field: ProgrammingStorageField) {
  if (!browserReady()) return null;
  return window.localStorage.getItem(programmingStorageKey(sessionId, field));
}

export function writeProgrammingStorage(sessionId: string, field: ProgrammingStorageField, value: string) {
  if (!browserReady()) return;
  window.localStorage.setItem(programmingStorageKey(sessionId, field), value);
}

export function removeProgrammingStorage(sessionId: string, field: ProgrammingStorageField) {
  if (!browserReady()) return;
  window.localStorage.removeItem(programmingStorageKey(sessionId, field));
}

/**
 * Move the pre-separation draft into the current player's namespace once.
 * An owner marker prevents a draft left by player A from being adopted by
 * player B if both use the same browser during the rollout.
 */
export function migrateLegacyProgrammingStorage(sessionId: string) {
  if (!browserReady()) return;
  const fields = Object.keys(PROGRAMMING_STORAGE_KEYS) as ProgrammingStorageField[];
  const legacyFields = fields.filter((field) => window.localStorage.getItem(PROGRAMMING_STORAGE_KEYS[field]) !== null);
  if (!legacyFields.length) return;

  const recordedOwner = window.localStorage.getItem(LEGACY_OWNER_KEY);
  if (recordedOwner && recordedOwner !== sessionId) return;

  for (const field of legacyFields) {
    const legacyKey = PROGRAMMING_STORAGE_KEYS[field];
    const scopedKey = programmingStorageKey(sessionId, field);
    const legacyValue = window.localStorage.getItem(legacyKey);
    if (legacyValue !== null && window.localStorage.getItem(scopedKey) === null) {
      window.localStorage.setItem(scopedKey, legacyValue);
    }
  }

  window.localStorage.setItem(LEGACY_OWNER_KEY, sessionId);
  for (const field of legacyFields) window.localStorage.removeItem(PROGRAMMING_STORAGE_KEYS[field]);
}
