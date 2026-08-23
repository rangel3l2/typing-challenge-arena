import type { ArenaLevel } from "./obrArena";

export type MissionUnlocks = Record<ArenaLevel, number>;

const arenaLevels: ArenaLevel[] = ["beginner", "easy", "medium", "hard"];

// The value is the highest accessible mission index. `missionCount` is a
// completion sentinel: every mission in that level has been completed (or the
// beginner level was intentionally skipped through the knowledge check).
export const initialMissionUnlocks = (): MissionUnlocks => ({ beginner: 1, easy: 0, medium: 0, hard: 0 });

export function highestAccessibleMission(unlocks: MissionUnlocks, level: ArenaLevel, missionCount: number) {
  return Math.max(0, Math.min(missionCount - 1, unlocks[level]));
}

export function isArenaLevelUnlocked(unlocks: MissionUnlocks, level: ArenaLevel, missionCount: number) {
  if (level === "beginner" || level === "easy") return true;
  if (level === "medium") return unlocks.easy >= missionCount;
  return unlocks.medium >= missionCount;
}

export function isArenaLevelPlayable(unlocks: MissionUnlocks, level: ArenaLevel, missionCount: number) {
  if (level === "beginner") return true;
  if (level === "easy") return unlocks.beginner >= missionCount;
  if (level === "medium") return unlocks.easy >= missionCount;
  return unlocks.medium >= missionCount;
}

export function unlockAllBeginnerMissions(current: MissionUnlocks, missionCount: number) {
  if (current.beginner >= missionCount) return current;
  return { ...current, beginner: missionCount };
}

export function resolveBasicKnowledgeConfirmation(
  explicitlyConfirmed: boolean,
  unlocks: MissionUnlocks,
  completed: Array<{ arena_level: string; challenge_number: number }>,
  missionCount: number,
) {
  if (explicitlyConfirmed) return true;
  if (unlocks.beginner < missionCount) return false;
  const completedBeginner = new Set(completed
    .filter((row) => row.arena_level === "beginner")
    .map((row) => row.challenge_number));
  // Backward compatibility for confirmations saved by the previous version,
  // where the choice was represented only by all beginner missions unlocked.
  return completedBeginner.size < missionCount;
}

export function normalizeMissionUnlocks(value: unknown, missionCount: number): MissionUnlocks {
  const source = value && typeof value === "object" ? value as Partial<Record<ArenaLevel, unknown>> : {};
  const maximum = Math.max(0, missionCount);
  const normalized = initialMissionUnlocks();
  for (const level of arenaLevels) {
    const numeric = Number(source[level]);
    const minimum = level === "beginner" ? 1 : 0;
    normalized[level] = Number.isFinite(numeric) ? Math.max(minimum, Math.min(maximum, Math.trunc(numeric))) : minimum;
  }
  return normalized;
}

export function mergeMissionUnlocks(current: MissionUnlocks, incoming: unknown, missionCount: number): MissionUnlocks {
  const normalized = normalizeMissionUnlocks(incoming, missionCount);
  const merged = initialMissionUnlocks();
  for (const level of arenaLevels) merged[level] = Math.max(current[level], normalized[level]);
  return merged;
}

export function unlockFromCompletedMissions(
  current: MissionUnlocks,
  completed: Array<{ arena_level: string; challenge_number: number }>,
  missionCount: number,
) {
  const next = { ...current };
  for (const level of arenaLevels) {
    const completedNumbers = new Set(completed.filter((row) => row.arena_level === level).map((row) => row.challenge_number));
    let highestAccessible = 0;
    while (highestAccessible < missionCount && completedNumbers.has(highestAccessible + 1)) highestAccessible += 1;
    next[level] = Math.max(next[level], highestAccessible);
  }
  return next;
}

export function unlockMissionAfterSuccess(current: MissionUnlocks, level: ArenaLevel, completedChallengeNumber: number, missionCount: number) {
  const highestAccessible = Math.min(missionCount, Math.max(0, Math.trunc(completedChallengeNumber)));
  if (highestAccessible <= current[level]) return current;
  return { ...current, [level]: highestAccessible };
}
