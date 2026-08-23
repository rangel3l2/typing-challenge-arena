import * as Blockly from "blockly";
import { describe, expect, it } from "vitest";
import { createExampleBlocks, generatePython, registerEV3Blocks } from "./blocks";
import { cloneHardware, createLineFollowerHardware, EMPTY_HARDWARE } from "./hardware";
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

  it("reproduz as correções por giro do EV3 a 30% e supera a curva de 90 graus", () => {
    const hardware = cloneHardware(EMPTY_HARDWARE);
    hardware.motors.A = "large";
    hardware.motors.B = "large";
    hardware.motorMounts.A = { role: "left-wheel" };
    hardware.motorMounts.B = { role: "right-wheel" };
    hardware.sensors["1"] = "color";
    hardware.sensors["2"] = "color";
    hardware.sensorMounts["1"] = { position: "front-left", aim: "ground" };
    hardware.sensorMounts["2"] = { position: "front-right", aim: "ground" };
    const world = createWorld(hardware, 0, "easy");
    const runner = createRunner(parseProgram(`
velocidade_motor_A = 30
velocidade_motor_B = 30
while True:
    cor_ev3_porta_1 = ev3.color("1")
    cor_ev3_porta_2 = ev3.color("2")
    if ((cor_ev3_porta_1 == "branco") and (cor_ev3_porta_2 == "branco")):
        motors.set_power(0, velocidade_motor_A / 100)
        motors.set_power(1, velocidade_motor_B / 100)
    else:
        cor_ev3_porta_1 = ev3.color("1")
        cor_ev3_porta_2 = ev3.color("2")
        if ((cor_ev3_porta_1 == "preto") and (cor_ev3_porta_2 == "branco")):
            motors.set_power(0, velocidade_motor_A / 100)
            motors.set_power(1, -1 * velocidade_motor_B / 100)
        cor_ev3_porta_1 = ev3.color("1")
        cor_ev3_porta_2 = ev3.color("2")
        if ((cor_ev3_porta_1 == "branco") and (cor_ev3_porta_2 == "preto")):
            motors.set_power(0, -1 * velocidade_motor_A / 100)
            motors.set_power(1, velocidade_motor_B / 100)
    `));
    let passedRightAngle = false;
    let reachedRed = false;

    for (let step = 0; step < 4500 && !reachedRed; step += 1) {
      stepRunner(runner, world, 0.02, () => undefined);
      advanceWorld(world, 0.02, () => undefined);
      passedRightAngle ||= world.robot.x > 320 && world.robot.y < 390;
      reachedRed = sensorColor(world, "1") === "vermelho" || sensorColor(world, "2") === "vermelho";
    }

    expect(passedRightAngle).toBe(true);
    expect(reachedRed).toBe(true);
  });

  it("permite que os dois sensores detectem a estação vermelha e concluam a parada", () => {
    const hardware = cloneHardware(EMPTY_HARDWARE);
    hardware.motors.A = "large";
    hardware.motors.B = "large";
    hardware.motorMounts.A = { role: "left-wheel" };
    hardware.motorMounts.B = { role: "right-wheel" };
    hardware.sensors["1"] = "color";
    hardware.sensors["2"] = "color";
    hardware.sensorMounts["1"] = { position: "front-left", aim: "ground" };
    hardware.sensorMounts["2"] = { position: "front-right", aim: "ground" };
    const world = createWorld(hardware, 0, "easy");
    const runner = createRunner(parseProgram(`
velocidade_motor_A = 40
velocidade_motor_B = 40
while True:
    cor_ev3_porta_1 = ev3.color("1")
    cor_ev3_porta_2 = ev3.color("2")
    if ((cor_ev3_porta_1 == "branco") and (cor_ev3_porta_2 == "branco")):
        motors.set_power(0, velocidade_motor_A / 100)
        motors.set_power(1, velocidade_motor_B / 100)
    else:
        if ((cor_ev3_porta_1 == "preto") and (cor_ev3_porta_2 == "branco")):
            motors.set_power(0, velocidade_motor_A / 100)
            motors.set_power(1, -1 * velocidade_motor_B / 100)
        if ((cor_ev3_porta_1 == "branco") and (cor_ev3_porta_2 == "preto")):
            motors.set_power(0, -1 * velocidade_motor_A / 100)
            motors.set_power(1, velocidade_motor_B / 100)
    if ((cor_ev3_porta_1 == "vermelho") and (cor_ev3_porta_2 == "vermelho")):
        utils.sleep(0.5)
        motors.set_power(0, 0)
        motors.set_power(1, 0)
    `));
    let bothSensorsSawRed = false;

    for (let step = 0; step < 6000 && !world.success; step += 1) {
      stepRunner(runner, world, 0.02, () => undefined);
      advanceWorld(world, 0.02, () => undefined);
      bothSensorsSawRed ||= sensorColor(world, "1") === "vermelho" && sensorColor(world, "2") === "vermelho";
    }

    const metrics = {
      colours: [sensorColor(world, "1"), sensorColor(world, "2")],
      position: { x: world.robot.x, y: world.robot.y, angle: world.robot.angle },
      powers: [world.robot.leftPower, world.robot.rightPower],
    };
    expect(bothSensorsSawRed, JSON.stringify(metrics)).toBe(true);
    expect(world.success, JSON.stringify(metrics)).toBe(true);
    expect(world.robot.leftPower).toBe(0);
    expect(world.robot.rightPower).toBe(0);
  });
});
