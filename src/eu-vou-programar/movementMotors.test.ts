import * as Blockly from "blockly";
import { describe, expect, it } from "vitest";
import { generatePython, registerEV3Blocks } from "./blocks";
import { createRunner, createWorld, parseProgram, stepRunner } from "./simulator";

registerEV3Blocks(Blockly);

describe("bloco de motores de movimento", () => {
  it("oferece dois seletores independentes com B e C como padrão", () => {
    const workspace = new Blockly.Workspace();
    const block = workspace.newBlock("ev3_move_set_motors");

    expect(block.getFieldValue("LEFT_PORT")).toBe("B");
    expect(block.getFieldValue("RIGHT_PORT")).toBe("C");
    expect(block.getField("LEFT_PORT")?.getOptions(false).map((option) => option[1])).toEqual(["A", "B", "C", "D"]);
    expect(block.getField("RIGHT_PORT")?.getOptions(false).map((option) => option[1])).toEqual(["A", "B", "C", "D"]);

    workspace.dispose();
  });

  it("gera código que usa as duas portas escolhidas nos movimentos seguintes", () => {
    const workspace = new Blockly.Workspace();
    const start = workspace.newBlock("ev3_start");
    const motors = workspace.newBlock("ev3_move_set_motors");
    const move = workspace.newBlock("ev3_move_start");
    motors.setFieldValue("A", "LEFT_PORT");
    motors.setFieldValue("D", "RIGHT_PORT");
    start.nextConnection?.connect(motors.previousConnection);
    motors.nextConnection?.connect(move.previousConnection);

    const code = generatePython(workspace);

    expect(code).toContain("motor_movimento_esquerdo = 0");
    expect(code).toContain("motor_movimento_direito = 3");
    expect(code).toContain("motors.set_power(motor_movimento_esquerdo");
    expect(code).toContain("motors.set_power(motor_movimento_direito");

    workspace.dispose();
  });
});

describe("simulação dos motores escolhidos", () => {
  it("move os lados do robô usando portas diferentes de B e C", () => {
    const world = createWorld();
    const runner = createRunner(parseProgram(`
motor_movimento_esquerdo = 0
motor_movimento_direito = 3
motors.set_power(motor_movimento_esquerdo, 0.4)
motors.set_power(motor_movimento_direito, 0.7)
utils.sleep(1)
`));

    stepRunner(runner, world, 0.016, () => undefined);

    expect(world.robot.motorPowers.A).toBe(0.4);
    expect(world.robot.motorPowers.D).toBe(0.7);
    expect(world.robot.leftPower).toBe(0.4);
    expect(world.robot.rightPower).toBe(0.7);
  });
});
