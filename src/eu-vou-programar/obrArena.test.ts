import { describe, expect, it } from "vitest";
import { ARENA_CHALLENGE_COUNT, createOBRLayout, getArenaChallenges } from "./obrArena";
import type { ArenaLevel } from "./obrArena";
import { cloneHardware, DEFAULT_HARDWARE } from "./hardware";
import { advanceWorld, createWorld } from "./simulator";

const levels: ArenaLevel[] = ["easy", "medium", "hard"];

function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const amount = lengthSquared ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(point.x - (start.x + amount * dx), point.y - (start.y + amount * dy));
}

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

  it("faz os desafios fáceis 2, 3 e 4 exigirem estratégias diferentes de seguir linha", () => {
    const decision = createOBRLayout(1, "easy");
    const openField = createOBRLayout(2, "easy");
    const offTrack = createOBRLayout(3, "easy");
    expect(decision.branches.length).toBeGreaterThan(0);
    expect(decision.challenge.requireHazardOrder).toBe(true);
    expect(openField.gaps.some((gap) => gap.width > 200 && gap.height > 150)).toBe(true);
    const targetDistance = Math.min(...offTrack.mainPath.slice(1).map((point, index) => distanceToSegment(offTrack.challenge.goal, offTrack.mainPath[index], point)));
    expect(targetDistance).toBeGreaterThan(100);
    expect(offTrack.challenge.requiredHazards).toHaveLength(1);
  });

  it("só confirma o portal quando dois sensores de cor laterais enxergam vermelho", () => {
    const incompleteWorld = createWorld(DEFAULT_HARDWARE, 4, "easy");
    incompleteWorld.robot.x = 525;
    incompleteWorld.robot.y = 500;
    advanceWorld(incompleteWorld, 0.1, () => undefined);
    expect(incompleteWorld.competition.scoredHazards).not.toContain("e5-portal");

    const portalHardware = cloneHardware(DEFAULT_HARDWARE);
    portalHardware.sensors["1"] = "color";
    portalHardware.sensorMounts["1"] = { position: "left", aim: "outward" };
    portalHardware.sensors["2"] = "color";
    portalHardware.sensorMounts["2"] = { position: "right", aim: "outward" };
    const completeWorld = createWorld(portalHardware, 4, "easy");
    completeWorld.robot.x = 525;
    completeWorld.robot.y = 500;
    advanceWorld(completeWorld, 0.1, () => undefined);
    expect(completeWorld.competition.scoredHazards).toContain("e5-portal");
  });

  it("faz o desafio 7 terminar sobre o portão prateado", () => {
    const layout = createOBRLayout(6, "easy");
    expect(layout.start.angle).toBe(Math.PI);
    expect(layout.challenge.goal.x).toBeGreaterThanOrEqual(layout.silverGate.x);
    expect(layout.challenge.goal.x).toBeLessThanOrEqual(layout.silverGate.x + layout.silverGate.width);
    expect(layout.challenge.goal.y).toBeGreaterThanOrEqual(layout.silverGate.y);
    expect(layout.challenge.goal.y).toBeLessThanOrEqual(layout.silverGate.y + layout.silverGate.height);
  });

  it("registra toque nas bolinhas e permite concluir o desafio 8 em movimento pela saída preta", () => {
    const touchedWorld = createWorld(DEFAULT_HARDWARE, 7, "easy");
    touchedWorld.robot.x = touchedWorld.victims[0].x - 30;
    touchedWorld.robot.y = touchedWorld.victims[0].y;
    advanceWorld(touchedWorld, 0.1, () => undefined);
    expect(touchedWorld.competition.victimTouches).toBe(1);
    expect(touchedWorld.victims[0].touched).toBe(true);

    const cleanWorld = createWorld(DEFAULT_HARDWARE, 7, "easy");
    cleanWorld.competition.scoredHazards = ["e8-silver", "e8-black"];
    cleanWorld.robot.x = 815;
    cleanWorld.robot.y = 370;
    cleanWorld.robot.angle = Math.PI / 2;
    cleanWorld.robot.leftPower = 0.1;
    cleanWorld.robot.rightPower = 0.1;
    advanceWorld(cleanWorld, 0.2, () => undefined);
    expect(cleanWorld.success).toBe(true);
    expect(cleanWorld.competition.victimTouches).toBe(0);
  });
});
