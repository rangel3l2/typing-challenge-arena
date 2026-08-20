import type { ArenaLevel } from "./obrArena";

export type MissionUnlocks = Record<ArenaLevel, number>;

export const initialMissionUnlocks = (): MissionUnlocks => ({ easy: 0, medium: 0, hard: 0 });

export function normalizeMissionUnlocks(value: unknown, missionCount: number): MissionUnlocks {
  const source = value && typeof value === "object" ? value as Partial<Record<ArenaLevel, unknown>> : {};
  const maximum = Math.max(0, missionCount - 1);
  const normalized = initialMissionUnlocks();
  for (const level of ["easy", "medium", "hard"] as const) {
    const numeric = Number(source[level]);
    normalized[level] = Number.isFinite(numeric) ? Math.max(0, Math.min(maximum, Math.trunc(numeric))) : 0;
  }
  return normalized;
}

export function unlockFromCompletedMissions(
  current: MissionUnlocks,
  completed: Array<{ arena_level: string; challenge_number: number }>,
  missionCount: number,
) {
  const next = { ...current };
  for (const level of ["easy", "medium", "hard"] as const) {
    const completedNumbers = new Set(completed.filter((row) => row.arena_level === level).map((row) => row.challenge_number));
    let highestAccessible = 0;
    while (highestAccessible < missionCount - 1 && completedNumbers.has(highestAccessible + 1)) highestAccessible += 1;
    next[level] = Math.max(next[level], highestAccessible);
  }
  return next;
}

export function unlockMissionAfterSuccess(current: MissionUnlocks, level: ArenaLevel, completedChallengeNumber: number, missionCount: number) {
  const highestAccessible = Math.min(missionCount - 1, Math.max(0, Math.trunc(completedChallengeNumber)));
  if (highestAccessible <= current[level]) return current;
  return { ...current, [level]: highestAccessible };
}
