import * as Blockly from "blockly";
import { describe, expect, it } from "vitest";
import { createExampleBlocks, generatePython, registerEV3Blocks } from "./blocks";
import { createLineFollowerHardware } from "./hardware";
import type { ArenaPoint } from "./obrArena";
import { advanceWorld, createRunner, createWorld, parseProgram, sensorColor, stepRunner } from "./simulator";

registerEV3Blocks(Blockly);

function distanceToSegment(point: ArenaPoint, start: ArenaPoint, end: ArenaPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + amount * dx), point.y - (start.y + amount * dy));
}

function distanceToPath(point: ArenaPoint, path: ArenaPoint[]) {
  return Math.min(...path.slice(1).map((end, index) => distanceToSegment(point, path[index], end)));
}

describe("seguidor de linha em blocos", () => {
  it("gera Python válido e acompanha as curvas até parar na estação vermelha", () => {
    const workspace = new Blockly.Workspace();
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(createExampleBlocks("seguidor")), workspace);
    const code = generatePython(workspace);
    const world = createWorld(createLineFollowerHardware(), 0, "easy");
    const runner = createRunner(parseProgram(code));
    let maximumLineDistance = 0;
    const seenColours = new Set<string>();

    for (let step = 0; step < 6000 && !world.success; step += 1) {
      stepRunner(runner, world, 0.02, () => undefined);
      advanceWorld(world, 0.02, () => undefined);
      maximumLineDistance = Math.max(maximumLineDistance, distanceToPath(world.robot, world.layout.mainPath));
      seenColours.add(`${sensorColor(world, "4")}/${sensorColor(world, "2")}`);
    }

    expect(code).toContain('cor_ev3_porta_4 = ev3.color("4")');
    expect(code).toContain('cor_ev3_porta_2 = ev3.color("2")');
    expect(code).toContain("while True:");
    expect(code).toContain("motors.set_power(1, 0.32)");
    expect(code).toContain("motors.set_power(2, 0.32)");
    expect(code).not.toMatch(/motors\.set_power\([12],\s*-/);
    const metrics = {
      success: world.success,
      position: { x: Math.round(world.robot.x), y: Math.round(world.robot.y) },
      maximumLineDistance: Math.round(maximumLineDistance),
      colours: [...seenColours],
    };
    expect(world.success, JSON.stringify(metrics)).toBe(true);
    expect(maximumLineDistance).toBeLessThan(45);
    expect(world.competition.collisionCount).toBe(0);
    expect(runner.finished).toBe(false);

    workspace.dispose();
  });
});
