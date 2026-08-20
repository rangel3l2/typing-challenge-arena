import * as Blockly from "blockly";
import { describe, expect, it } from "vitest";
import { createExampleBlocks, generatePython, registerEV3Blocks } from "./blocks";
import { pythonToBlocks } from "./pythonBlocks";
import { evaluateExpression, parseProgram } from "./simulator";

registerEV3Blocks(Blockly);

function workspaceFromXml(source: string) {
  const workspace = new Blockly.Workspace();
  Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(source), workspace);
  return workspace;
}

describe("sintaxe gerada pelos blocos", () => {
  it("consome os dois lados de and/or sem acusar parêntese ausente", () => {
    expect(evaluateExpression("(False and (True == True))", {})).toBe(false);
    expect(evaluateExpression("(True or (False == True))", {})).toBe(true);
  });

  it("mantém uma variável independente para cada porta do sensor de cor", () => {
    const xml = `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <block type="ev3_start">
          <next><block type="ev3_forever">
            <statement name="DO"><block type="ev3_if">
              <value name="CONDITION"><block type="ev3_op_logic">
                <field name="OP">e</field>
                <value name="LEFT"><block type="ev3_color_is"><field name="PORT">4</field><field name="COLOR">branco</field></block></value>
                <value name="RIGHT"><block type="ev3_color_is"><field name="PORT">2</field><field name="COLOR">preto</field></block></value>
              </block></value>
              <statement name="DO"><block type="ev3_motor_start"><field name="PORT">B</field><field name="DIRECTION">horário</field></block></statement>
            </block></statement>
          </block></next>
        </block>
      </xml>`;
    const workspace = workspaceFromXml(xml);
    const code = generatePython(workspace);

    expect(code).toContain('cor_ev3_porta_4 = ev3.color("4")');
    expect(code).toContain('cor_ev3_porta_2 = ev3.color("2")');
    expect(code).toContain('(cor_ev3_porta_4 == "branco") and (cor_ev3_porta_2 == "preto")');
    expect(() => parseProgram(code)).not.toThrow();

    workspace.dispose();
  });
});

describe("conversão Python para blocos", () => {
  it.each(["", "# Ainda não escrevi o programa\n\n# Vou começar pelos blocos"])("abre uma área de blocos vazia para Python sem comandos", (python) => {
    const workspace = workspaceFromXml(pythonToBlocks(python));

    expect(workspace.getAllBlocks(false)).toHaveLength(0);

    workspace.dispose();
  });

  it("reconstrói laço, condição composta, sensores e os dois sentidos dos motores", () => {
    const python = `
from sbot import arduino, leds, motors, utils, ev3

velocidade_motor_A = 75
velocidade_motor_B = 75
velocidade_motor_C = 75
velocidade_motor_D = 75
velocidade_movimento = 50
motor_movimento_esquerdo = 1
motor_movimento_direito = 2

for sempre_0 in range(100):
    cor_ev3_porta_4 = ev3.color("4")
    cor_ev3_porta_2 = ev3.color("2")
    if ((cor_ev3_porta_4 == "branco") and (cor_ev3_porta_2 == "preto")):
        motors.set_power(1, velocidade_motor_B / 100)
        motors.set_power(2, -1 * velocidade_motor_C / 100)
    else:
        utils.sleep(1)
`;

    const xml = pythonToBlocks(python);
    const workspace = workspaceFromXml(xml);
    const types = workspace.getAllBlocks(false).map((block) => block.type);
    const colours = workspace.getAllBlocks(false).filter((block) => block.type === "ev3_color_is");
    const motors = workspace.getAllBlocks(false).filter((block) => block.type === "ev3_motor_start");

    expect(types).toEqual(expect.arrayContaining(["ev3_start", "ev3_forever", "ev3_if_else", "ev3_op_logic"]));
    expect(colours.map((block) => [block.getFieldValue("PORT"), block.getFieldValue("COLOR")])).toEqual(expect.arrayContaining([["4", "branco"], ["2", "preto"]]));
    expect(motors.map((block) => [block.getFieldValue("PORT"), block.getFieldValue("DIRECTION")])).toEqual(expect.arrayContaining([["B", "horário"], ["C", "anti-horário"]]));

    const regenerated = generatePython(workspace);
    expect(regenerated).toContain('cor_ev3_porta_4 = ev3.color("4")');
    expect(regenerated).toContain('cor_ev3_porta_2 = ev3.color("2")');
    expect(() => parseProgram(regenerated)).not.toThrow();

    workspace.dispose();
  });

  it.each(["avancar", "curva", "sensor", "seguidor"] as const)("mantém o exemplo %s executável depois do round-trip", (example) => {
    const original = workspaceFromXml(createExampleBlocks(example));
    const firstPython = generatePython(original);
    const reconstructed = workspaceFromXml(pythonToBlocks(firstPython));
    const regenerated = generatePython(reconstructed);

    expect(() => parseProgram(firstPython)).not.toThrow();
    expect(() => parseProgram(regenerated)).not.toThrow();
    expect(reconstructed.getAllBlocks(false).some((block) => block.type === "ev3_start")).toBe(true);

    original.dispose();
    reconstructed.dispose();
  });

  it("reconstrói direção e velocidade do movimento iniciado", () => {
    const python = `
motors.set_power(motor_movimento_esquerdo, 0.6)
motors.set_power(motor_movimento_direito, 0.36)
`;
    const workspace = workspaceFromXml(pythonToBlocks(python));
    const move = workspace.getAllBlocks(false).find((block) => block.type === "ev3_move_start");

    expect(move?.getFieldValue("STEERING")).toBe(40);
    expect(move?.getFieldValue("SPEED")).toBe(60);
    expect(() => parseProgram(generatePython(workspace))).not.toThrow();

    workspace.dispose();
  });

  it("transforma elif na cadeia equivalente de se/senão", () => {
    const python = `
cor = ev3.color("4")
if cor == "branco":
    motors.set_power(1, 0.75)
elif cor == "preto":
    motors.set_power(1, -0.75)
else:
    motors.set_power(1, 0)
`;
    const workspace = workspaceFromXml(pythonToBlocks(python));
    const conditionals = workspace.getAllBlocks(false).filter((block) => block.type === "ev3_if_else");

    expect(conditionals).toHaveLength(2);
    expect(() => parseProgram(generatePython(workspace))).not.toThrow();

    workspace.dispose();
  });
});
