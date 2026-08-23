import { describe, expect, it } from "vitest";
import { AUDIT_DRIVE_MODES, auditDriveProgram, createArenaAutopilot, createAuditHardware, stepArenaAutopilot } from "./arenaAutopilot";
import { ARENA_CHALLENGE_COUNT } from "./obrArena";
import type { ArenaLevel } from "./obrArena";
import { createWorld } from "./simulator";

const LEVELS: ArenaLevel[] = ["beginner", "easy", "medium", "hard"];

describe("auditoria automática das arenas", () => {
  it.each(AUDIT_DRIVE_MODES.flatMap((mode) => [0.05, 0.2, 0.4].map((delta) => ({ mode, delta }))))(
    "percorre as 40 missões com $mode.label e passos de $delta s",
    ({ mode, delta }) => {
    const failures: string[] = [];
    const hardware = createAuditHardware();

    for (const level of LEVELS) {
      for (let challenge = 0; challenge < ARENA_CHALLENGE_COUNT; challenge += 1) {
        const world = createWorld(hardware, challenge, level);
        const autopilot = createArenaAutopilot(world, mode.id);

        for (let step = 0; step < 20000 && autopilot.status === "running"; step += 1) {
          stepArenaAutopilot(world, autopilot, delta);
        }

        if (autopilot.status !== "passed") {
          failures.push(`${layoutLabel(level, challenge)}: ${autopilot.error || autopilot.message}`);
        } else if (autopilot.driveChecks < 3) {
          failures.push(`${layoutLabel(level, challenge)}: nenhum comando de ${mode.label} foi confirmado.`);
        } else if (world.layout.arenaStyle === "obr" && autopilot.lineWaypoints === 0) {
          failures.push(`${layoutLabel(level, challenge)}: a rota ignorou completamente a linha preta.`);
        } else if (world.competition.collisionCount || world.competition.victimTouches) {
          failures.push(`${layoutLabel(level, challenge)}: terminou com ${world.competition.collisionCount} colisões e ${world.competition.victimTouches} toques.`);
        }
      }
    }

    expect(failures).toEqual([]);
    },
    30_000,
  );

  it("usa os canais variáveis do rosa e os canais diretos do azul", () => {
    expect(auditDriveProgram("movement", 0.5, -0.35)).toContain("motors.set_power(motor_movimento_esquerdo, 0.5)");
    expect(auditDriveProgram("movement", 0.5, -0.35)).toContain("motors.set_power(motor_movimento_direito, -0.35)");
    expect(auditDriveProgram("motor", 0.5, -0.35)).toBe("motors.set_power(1, 0.5)\nmotors.set_power(2, -0.35)");
  });

  it("mantém a missão final fácil estável com intervalos variáveis do navegador", () => {
    const world = createWorld(createAuditHardware(), 9, "easy");
    const autopilot = createArenaAutopilot(world, "movement");
    const browserDeltas = [0.4, 0.13, 0.08, 0.4, 0.17, 0.11];

    for (let step = 0; step < 20000 && autopilot.status === "running"; step += 1) {
      stepArenaAutopilot(world, autopilot, browserDeltas[step % browserDeltas.length]);
    }

    expect({
      status: autopilot.status,
      error: autopilot.error,
      collisions: world.competition.collisionCount,
    }).toEqual({ status: "passed", error: "", collisions: 0 });
  });

  it("mantém a missão final fácil estável em todos os intervalos até 0,40 s", () => {
    const failures: string[] = [];
    for (let hundredths = 1; hundredths <= 40; hundredths += 1) {
      const delta = hundredths / 100;
      const world = createWorld(createAuditHardware(), 9, "easy");
      const autopilot = createArenaAutopilot(world, "movement");
      for (let step = 0; step < 20000 && autopilot.status === "running"; step += 1) {
        stepArenaAutopilot(world, autopilot, delta);
      }
      if (autopilot.status !== "passed" || world.competition.collisionCount) {
        failures.push(`${delta.toFixed(2)} s: ${autopilot.error}; colisões: ${world.competition.collisionCount}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

function layoutLabel(level: ArenaLevel, challenge: number) {
  return `${level}-${challenge + 1}`;
}
