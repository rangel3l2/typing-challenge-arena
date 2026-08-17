import { describe, expect, it } from "vitest";
import { ARENA_CHALLENGE_COUNT, createOBRLayout, getArenaChallenges } from "./obrArena";
import type { ArenaLevel } from "./obrArena";

const levels: ArenaLevel[] = ["easy", "medium", "hard"];

describe("catálogo de objetivos da arena", () => {
  it.each(levels)("oferece dez objetivos coerentes no nível %s", (level) => {
    const challenges = getArenaChallenges(level);
    expect(challenges).toHaveLength(ARENA_CHALLENGE_COUNT);
    expect(challenges.map((challenge) => challenge.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(challenges.map((challenge) => challenge.title)).size).toBe(ARENA_CHALLENGE_COUNT);
    expect(challenges.every((challenge) => challenge.objective.length > 35 && challenge.hint.length > 25)).toBe(true);
  });

  it.each(levels)("mantém metas, etapas e elementos dentro da arena no nível %s", (level) => {
    for (let index = 0; index < ARENA_CHALLENGE_COUNT; index += 1) {
      const layout = createOBRLayout(index, level);
      const hazardIds = new Set(layout.hazards.map((hazard) => hazard.id));
      expect(layout.challenge.requiredHazards.every((id) => hazardIds.has(id))).toBe(true);
      expect(layout.challenge.goal.x).toBeGreaterThan(18);
      expect(layout.challenge.goal.x).toBeLessThan(942);
      expect(layout.challenge.goal.y).toBeGreaterThan(18);
      expect(layout.challenge.goal.y).toBeLessThan(582);
      expect(layout.mainPath.length).toBeGreaterThanOrEqual(2);
      expect(layout.challenge.timeLimit).toBeGreaterThanOrEqual(60);
    }
  });

  it("devolve cópias independentes para que uma rodada não altere a seguinte", () => {
    const first = createOBRLayout(0, "easy");
    first.mainPath[0].x = 999;
    first.challenge.requiredHazards.push("alterado");
    const second = createOBRLayout(0, "easy");
    expect(second.mainPath[0].x).toBe(70);
    expect(second.challenge.requiredHazards).not.toContain("alterado");
  });
});
