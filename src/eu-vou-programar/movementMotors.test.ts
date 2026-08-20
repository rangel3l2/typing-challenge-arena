import * as Blockly from "blockly";
import { describe, expect, it } from "vitest";
import { generatePython, registerEV3Blocks } from "./blocks";
import { cloneHardware, EMPTY_HARDWARE, isRobotComplete, isRobotReady } from "./hardware";
import { advanceWorld, createRunner, createWorld, hasActiveDrivePower, parseProgram, stepRunner } from "./simulator";

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

  it("mostra a direção como no seletor do EV3 Classroom", () => {
    const workspace = new Blockly.Workspace();
    for (const type of ["ev3_move_start", "ev3_move_steer", "ev3_move_steer_speed"]) {
      const block = workspace.newBlock(type);
      expect(block.getField("STEERING")?.getText()).toBe("reto: 0");
      block.setFieldValue(-45, "STEERING");
      expect(block.getField("STEERING")?.getText()).toBe("esquerda: -45");
      block.setFieldValue(35, "STEERING");
      expect(block.getField("STEERING")?.getText()).toBe("direita: 35");
    }

    workspace.dispose();
  });

  it("inicia o movimento com direção e velocidade escolhidas", () => {
    const workspace = new Blockly.Workspace();
    const start = workspace.newBlock("ev3_start");
    const move = workspace.newBlock("ev3_move_start");
    move.setFieldValue(40, "STEERING");
    move.setFieldValue(60, "SPEED");
    start.nextConnection?.connect(move.previousConnection);

    expect(move.getFieldValue("SPEED")).toBe(60);
    expect(generatePython(workspace)).toContain([
      "motors.set_power(motor_movimento_esquerdo, 0.6)",
      "motors.set_power(motor_movimento_direito, 0.36)",
    ].join("\n"));

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

  it("permite movimentar somente com os motores B e C instalados", () => {
    const hardware = cloneHardware(EMPTY_HARDWARE);
    hardware.motors.B = "large";
    hardware.motors.C = "large";
    const world = createWorld(hardware);
    const runner = createRunner(parseProgram(`
motor_movimento_esquerdo = 1
motor_movimento_direito = 2
motors.set_power(motor_movimento_esquerdo, 0.5)
motors.set_power(motor_movimento_direito, 0.5)
utils.sleep(1)
`));

    stepRunner(runner, world, 0.016, () => undefined);

    expect(world.robot.leftPower).toBe(0.5);
    expect(world.robot.rightPower).toBe(0.5);
  });

  it("mantém o movimento iniciado mesmo depois de concluir a sequência de blocos", () => {
    const hardware = cloneHardware(EMPTY_HARDWARE);
    hardware.motors.B = "large";
    hardware.motors.C = "large";
    const world = createWorld(hardware);
    const runner = createRunner(parseProgram(`
motor_movimento_esquerdo = 1
motor_movimento_direito = 2
motors.set_power(motor_movimento_esquerdo, 0.5)
motors.set_power(motor_movimento_direito, 0.5)
`));

    stepRunner(runner, world, 0.016, () => undefined);
    const initialPosition = { x: world.robot.x, y: world.robot.y };
    advanceWorld(world, 0.25, () => undefined);

    expect(runner.finished).toBe(true);
    expect(hasActiveDrivePower(world)).toBe(true);
    expect(Math.hypot(world.robot.x - initialPosition.x, world.robot.y - initialPosition.y)).toBeGreaterThan(0);
  });
});

describe("prontidão funcional da montagem", () => {
  it("considera dois motores suficientes sem exigir sensores", () => {
    const hardware = cloneHardware(EMPTY_HARDWARE);
    hardware.motors.B = "large";
    hardware.motors.C = "large";

    expect(isRobotReady(hardware)).toBe(true);
    expect(isRobotComplete(hardware)).toBe(false);
  });
});
