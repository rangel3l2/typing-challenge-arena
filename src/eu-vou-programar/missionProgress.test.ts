import { describe, expect, it } from "vitest";
import { highestAccessibleMission, initialMissionUnlocks, isArenaLevelPlayable, isArenaLevelUnlocked, mergeMissionUnlocks, normalizeMissionUnlocks, resolveBasicKnowledgeConfirmation, unlockAllBeginnerMissions, unlockFromCompletedMissions, unlockMissionAfterSuccess } from "./missionProgress";

describe("ordem das missões", () => {
  it("começa com as missões 1 e 2 do Muito Fácil acessíveis", () => {
    expect(initialMissionUnlocks()).toEqual({ beginner: 1, easy: 0, medium: 0, hard: 0 });
    expect(highestAccessibleMission(initialMissionUnlocks(), "beginner", 10)).toBe(1);
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

  it("não libera a terceira Muito Fácil quando apenas a missão 2 foi concluída", () => {
    const unlocked = unlockFromCompletedMissions(initialMissionUnlocks(), [
      { arena_level: "beginner", challenge_number: 2 },
    ], 10);

    expect(unlocked.beginner).toBe(1);
  });

  it("usa o teste de conhecimentos para liberar todo o básico e autorizar o Fácil", () => {
    const skipped = unlockAllBeginnerMissions(initialMissionUnlocks(), 10);

    expect(skipped.beginner).toBe(10);
    expect(isArenaLevelPlayable(skipped, "easy", 10)).toBe(true);
  });

  it("recupera a confirmação antiga sem confundir com dez missões concluídas", () => {
    const skipped = { ...initialMissionUnlocks(), beginner: 10 };
    const allCompleted = Array.from({ length: 10 }, (_, index) => ({ arena_level: "beginner", challenge_number: index + 1 }));

    expect(resolveBasicKnowledgeConfirmation(false, skipped, [], 10)).toBe(true);
    expect(resolveBasicKnowledgeConfirmation(false, skipped, allCompleted, 10)).toBe(false);
    expect(resolveBasicKnowledgeConfirmation(true, skipped, allCompleted, 10)).toBe(true);
  });

  it("mantém Médio e Avançado com cadeado até concluir o nível anterior", () => {
    const initial = initialMissionUnlocks();
    expect(isArenaLevelUnlocked(initial, "easy", 10)).toBe(true);
    expect(isArenaLevelUnlocked(initial, "medium", 10)).toBe(false);
    expect(isArenaLevelUnlocked({ ...initial, easy: 10 }, "medium", 10)).toBe(true);
    expect(isArenaLevelUnlocked({ ...initial, medium: 10 }, "hard", 10)).toBe(true);
  });

  it("normaliza progresso local fora dos limites", () => {
    expect(normalizeMissionUnlocks({ beginner: "4", easy: 15, medium: -2, hard: "3" }, 10)).toEqual({ beginner: 4, easy: 10, medium: 0, hard: 3 });
  });

  it("mescla desbloqueios locais e remotos sem rebaixar o jogador", () => {
    expect(mergeMissionUnlocks(
      { beginner: 5, easy: 1, medium: 0, hard: 4 },
      { beginner: 2, easy: 7, medium: 3, hard: 1 },
      10,
    )).toEqual({ beginner: 5, easy: 7, medium: 3, hard: 4 });
  });
});
