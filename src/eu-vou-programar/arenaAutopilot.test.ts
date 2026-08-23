import { describe, expect, it } from "vitest";
import { createArenaAutopilot, createAuditHardware, stepArenaAutopilot } from "./arenaAutopilot";
import { ARENA_CHALLENGE_COUNT } from "./obrArena";
import type { ArenaLevel } from "./obrArena";
import { createWorld } from "./simulator";

const LEVELS: ArenaLevel[] = ["beginner", "easy", "medium", "hard"];

describe("auditoria automática das arenas", () => {
  it.each([0.05, 0.2, 0.4])("percorre as 40 missões com passos de %s s", (delta) => {
    const failures: string[] = [];
    const hardware = createAuditHardware();

    for (const level of LEVELS) {
      for (let challenge = 0; challenge < ARENA_CHALLENGE_COUNT; challenge += 1) {
        const world = createWorld(hardware, challenge, level);
        const autopilot = createArenaAutopilot(world);

        for (let step = 0; step < 20000 && autopilot.status === "running"; step += 1) {
          stepArenaAutopilot(world, autopilot, delta);
        }

        if (autopilot.status !== "passed") {
          failures.push(`${layoutLabel(level, challenge)}: ${autopilot.error || autopilot.message}`);
        } else if (world.competition.collisionCount || world.competition.victimTouches) {
          failures.push(`${layoutLabel(level, challenge)}: terminou com ${world.competition.collisionCount} colisões e ${world.competition.victimTouches} toques.`);
        }
      }
    }

    expect(failures).toEqual([]);
  }, 30_000);
});

function layoutLabel(level: ArenaLevel, challenge: number) {
  return `${level}-${challenge + 1}`;
}
