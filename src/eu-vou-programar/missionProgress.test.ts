import { describe, expect, it } from "vitest";
import { initialMissionUnlocks, normalizeMissionUnlocks, unlockFromCompletedMissions, unlockMissionAfterSuccess } from "./missionProgress";

describe("ordem das missões", () => {
  it("começa somente com a missão 1 liberada em cada nível", () => {
    expect(initialMissionUnlocks()).toEqual({ beginner: 0, easy: 0, medium: 0, hard: 0 });
  });

  it("libera a missão seguinte depois do sucesso atual", () => {
    const afterFirst = unlockMissionAfterSuccess(initialMissionUnlocks(), "easy", 1, 10);
    const afterSecond = unlockMissionAfterSuccess(afterFirst, "easy", 2, 10);

    expect(afterFirst.easy).toBe(1);
    expect(afterSecond.easy).toBe(2);
  });

  it("só recupera da nuvem uma sequência concluída sem pular missão", () => {
    const unlocked = unlockFromCompletedMissions(initialMissionUnlocks(), [
      { arena_level: "easy", challenge_number: 1 },
      { arena_level: "easy", challenge_number: 2 },
      { arena_level: "easy", challenge_number: 4 },
    ], 10);

    expect(unlocked.easy).toBe(2);
  });

  it("normaliza progresso local fora dos limites", () => {
    expect(normalizeMissionUnlocks({ beginner: "4", easy: 15, medium: -2, hard: "3" }, 10)).toEqual({ beginner: 4, easy: 9, medium: 0, hard: 3 });
  });
});
