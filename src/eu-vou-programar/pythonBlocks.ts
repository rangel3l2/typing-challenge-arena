import { parseProgram, ProgramError } from "./simulator";
import type { ProgramNode } from "./simulator";
import { createEmptyBlocks } from "./blocks";

type FieldValue = string | number;

interface BlockModel {
  type: string;
  fields?: Record<string, FieldValue>;
  values?: Record<string, BlockModel>;
  statements?: Record<string, BlockModel[]>;
}

interface SensorBinding {
  sensor: string;
  port?: string;
}

export class PythonBlocksError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PythonBlocksError";
  }
}

const escapeXml = (value: FieldValue) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

function serializeSequence(blocks: BlockModel[]): string {
  if (!blocks.length) return "";
  const [current, ...following] = blocks;
  const fields = Object.entries(current.fields ?? {})
    .map(([name, value]) => `<field name="${escapeXml(name)}">${escapeXml(value)}</field>`)
    .join("");
  const values = Object.entries(current.values ?? {})
    .map(([name, value]) => `<value name="${escapeXml(name)}">${serializeBlock(value)}</value>`)
    .join("");
  const statements = Object.entries(current.statements ?? {})
    .map(([name, value]) => `<statement name="${escapeXml(name)}">${serializeSequence(value)}</statement>`)
    .join("");
  const next = following.length ? `<next>${serializeSequence(following)}</next>` : "";
  return `<block type="${escapeXml(current.type)}">${fields}${values}${statements}${next}</block>`;
}

function serializeBlock(block: BlockModel): string {
  return serializeSequence([block]);
}

function stringLiteral(value: string): string | null {
  const source = value.trim();
  if (source.length < 2 || !["'", "\""].includes(source[0]) || source[source.length - 1] !== source[0]) return null;
  if (source[0] === "\"") {
    try {
      const parsed: unknown = JSON.parse(source);
      return typeof parsed === "string" ? parsed : null;
    } catch {
      return null;
    }
  }
  return source.slice(1, -1)
    .replace(/\\'/g, "'")
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");
}

function numberLiteral(value: string): number | null {
  const source = stripOuterParentheses(value.trim());
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(source)) return null;
  const parsed = Number(source);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFullyWrapped(value: string): boolean {
  if (!value.startsWith("(") || !value.endsWith(")")) return false;
  let depth = 0;
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote && value[index - 1] !== "\\") quote = "";
      continue;
    }
    if (char === "'" || char === "\"") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0 && index < value.length - 1) return false;
      if (depth < 0) return false;
    }
  }
  return depth === 0 && !quote;
}

function stripOuterParentheses(value: string): string {
  let result = value.trim();
  while (isFullyWrapped(result)) result = result.slice(1, -1).trim();
  return result;
}

interface OperatorMatch { index: number; operator: string }

function findTopLevelOperator(value: string, operators: string[], useLast = false): OperatorMatch | null {
  let depth = 0;
  let quote = "";
  let found: OperatorMatch | null = null;
  const sorted = [...operators].sort((left, right) => right.length - left.length);
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote && value[index - 1] !== "\\") quote = "";
      continue;
    }
    if (char === "'" || char === "\"") { quote = char; continue; }
    if (char === "(") { depth += 1; continue; }
    if (char === ")") { depth -= 1; continue; }
    if (depth !== 0) continue;

    const operator = sorted.find((candidate) => {
      if (!value.startsWith(candidate, index)) return false;
      if (/^[a-z]+$/i.test(candidate)) {
        return !/[A-Za-z0-9_]/.test(value[index - 1] ?? "")
          && !/[A-Za-z0-9_]/.test(value[index + candidate.length] ?? "");
      }
      if ((candidate === "+" || candidate === "-") && (!value.slice(0, index).trim() || /[+\-*/%<(]$/.test(value.slice(0, index).trim()))) return false;
      return true;
    });
    if (!operator) continue;
    found = { index, operator };
    if (!useLast) return found;
    index += operator.length - 1;
  }
  return found;
}

const comparisonField = (operator: string) => ({
  "==": "=", "!=": "≠", "<": "<", "<=": "≤", ">": ">", ">=": "≥",
}[operator] ?? operator);

const sensorComparisonField = (operator: string) => ({
  "<": "menor que", ">": "maior que",
}[operator] ?? "maior que");

function portValue(value?: string, fallback = "3") {
  if (!value) return fallback;
  return stringLiteral(value) ?? value.trim();
}

function sensorReporter(binding: SensorBinding): BlockModel {
  const port = portValue(binding.port);
  switch (binding.sensor) {
    case "color": return { type: "ev3_color", fields: { PORT: port } };
    case "distance_cm": return { type: "ev3_distance", fields: { PORT: port } };
    case "touch_pressed": return { type: "ev3_touch", fields: { PORT: port, STATE: "pressionado" } };
    case "gyro_angle": return { type: "ev3_gyro_angle", fields: { PORT: port } };
    case "gyro_speed": return { type: "ev3_gyro_speed", fields: { PORT: port } };
    case "timer": return { type: "ev3_timer" };
    case "light_reflected": return { type: "ev3_light_reflected", fields: { PORT: port } };
    case "light_ambient": return { type: "ev3_light_ambient", fields: { PORT: port } };
    case "motor_degrees": return { type: "ev3_motor_degrees", fields: { PORT: portValue(binding.port, "A") } };
    case "motor_speed": return { type: "ev3_motor_speed", fields: { PORT: portValue(binding.port, "A") } };
    default: throw new PythonBlocksError(`o sensor ev3.${binding.sensor} ainda não possui um bloco equivalente.`);
  }
}

function specializedSensorComparison(
  left: string,
  operator: string,
  right: string,
  bindings: Map<string, SensorBinding>,
): BlockModel | null {
  const binding = bindings.get(left.trim());
  if (!binding) return null;
  const port = portValue(binding.port);
  const numeric = numberLiteral(right);
  const text = stringLiteral(right);
  if (binding.sensor === "color" && ["==", "!="].includes(operator) && text !== null) {
    const colour: BlockModel = { type: "ev3_color_is", fields: { PORT: port, COLOR: text } };
    return operator === "!=" ? { type: "ev3_op_not", values: { VALUE: colour } } : colour;
  }
  if (numeric === null || !["<", ">"].includes(operator)) return null;
  if (binding.sensor === "distance_cm") return { type: "ev3_distance_compare", fields: { PORT: port, OP: sensorComparisonField(operator), VALUE: numeric } };
  if (binding.sensor === "gyro_angle") return { type: "ev3_gyro_compare", fields: { PORT: port, OP: sensorComparisonField(operator), VALUE: numeric } };
  if (binding.sensor === "light_reflected") return { type: "ev3_light_reflected_compare", fields: { PORT: port, OP: sensorComparisonField(operator), VALUE: numeric } };
  if (binding.sensor === "light_ambient") return { type: "ev3_light_ambient_compare", fields: { PORT: port, OP: sensorComparisonField(operator), VALUE: numeric } };
  return null;
}

function expressionBlock(expression: string, bindings: Map<string, SensorBinding>): BlockModel {
  const source = stripOuterParentheses(expression.trim());
  if (!source) throw new PythonBlocksError("há uma expressão incompleta no código Python.");

  const logicOr = findTopLevelOperator(source, ["or"]);
  if (logicOr) return {
    type: "ev3_op_logic",
    fields: { OP: "ou" },
    values: {
      LEFT: expressionBlock(source.slice(0, logicOr.index), bindings),
      RIGHT: expressionBlock(source.slice(logicOr.index + logicOr.operator.length), bindings),
    },
  };
  const logicAnd = findTopLevelOperator(source, ["and"]);
  if (logicAnd) return {
    type: "ev3_op_logic",
    fields: { OP: "e" },
    values: {
      LEFT: expressionBlock(source.slice(0, logicAnd.index), bindings),
      RIGHT: expressionBlock(source.slice(logicAnd.index + logicAnd.operator.length), bindings),
    },
  };
  if (/^not\b/.test(source)) return { type: "ev3_op_not", values: { VALUE: expressionBlock(source.replace(/^not\b/, ""), bindings) } };

  const compare = findTopLevelOperator(source, ["==", "!=", "<=", ">=", "<", ">"]);
  if (compare) {
    const left = source.slice(0, compare.index).trim();
    const right = source.slice(compare.index + compare.operator.length).trim();
    const specialized = specializedSensorComparison(left, compare.operator, right, bindings);
    if (specialized) return specialized;
    return {
      type: "ev3_op_compare",
      fields: { OP: comparisonField(compare.operator) },
      values: { LEFT: expressionBlock(left, bindings), RIGHT: expressionBlock(right, bindings) },
    };
  }

  const addition = findTopLevelOperator(source, ["+", "-"], true);
  if (addition) return {
    type: "ev3_op_math",
    fields: { OP: addition.operator === "-" ? "−" : "+" },
    values: {
      LEFT: expressionBlock(source.slice(0, addition.index), bindings),
      RIGHT: expressionBlock(source.slice(addition.index + 1), bindings),
    },
  };
  const multiplication = findTopLevelOperator(source, ["*", "/", "%"], true);
  if (multiplication) {
    const left = expressionBlock(source.slice(0, multiplication.index), bindings);
    const right = expressionBlock(source.slice(multiplication.index + 1), bindings);
    if (multiplication.operator === "%") return { type: "ev3_op_mod", values: { LEFT: left, RIGHT: right } };
    return { type: "ev3_op_math", fields: { OP: multiplication.operator === "*" ? "×" : "÷" }, values: { LEFT: left, RIGHT: right } };
  }

  const numeric = numberLiteral(source);
  if (numeric !== null) return { type: "ev3_number", fields: { VALUE: numeric } };
  const text = stringLiteral(source);
  if (text !== null) return { type: "ev3_text", fields: { VALUE: text } };
  if (source === "True" || source === "False") return { type: "ev3_boolean", fields: { VALUE: source === "True" ? "verdadeiro" : "falso" } };
  const binding = bindings.get(source);
  if (binding) return sensorReporter(binding);
  throw new PythonBlocksError(`a expressão “${source}” não possui um bloco equivalente.`);
}

const headerAssignments: Array<[string, string]> = [
  ["velocidade_motor_A", "75"],
  ["velocidade_motor_B", "75"],
  ["velocidade_motor_C", "75"],
  ["velocidade_motor_D", "75"],
  ["velocidade_movimento", "50"],
  ["motor_movimento_esquerdo", "1"],
  ["motor_movimento_direito", "2"],
];

function withoutGeneratedHeader(nodes: ProgramNode[]): ProgramNode[] {
  const hasHeader = headerAssignments.every(([target, expression], index) => {
    const node = nodes[index];
    return node?.kind === "assign" && node.target === target && stripOuterParentheses(node.expression) === expression;
  });
  return hasHeader ? nodes.slice(headerAssignments.length) : nodes;
}

const channelPorts = ["A", "B", "C", "D"];
const directPort = (channel: string) => {
  const numeric = numberLiteral(channel);
  return numeric !== null && Number.isInteger(numeric) ? channelPorts[numeric] : undefined;
};
const percentFromPower = (power: string) => {
  const numeric = numberLiteral(power);
  return numeric === null ? null : Math.round(numeric * 100000) / 1000;
};

function motorPowerBlock(node: Extract<ProgramNode, { kind: "setPower" }>): BlockModel {
  const port = directPort(node.channel);
  if (!port) throw new PythonBlocksError(`o canal de motor “${node.channel}” não possui uma porta A–D equivalente.`);
  const compactPower = stripOuterParentheses(node.power).replace(/\s+/g, " ");
  if (numberLiteral(compactPower) === 0) return { type: "ev3_motor_stop", fields: { PORT: port } };
  const configured = compactPower.match(/^(-1\s*\*\s*)?velocidade_motor_([A-D])\s*\/\s*100$/);
  if (configured && configured[2] === port) return {
    type: "ev3_motor_start",
    fields: { PORT: port, DIRECTION: configured[1] ? "anti-horário" : "horário" },
  };
  const percent = percentFromPower(compactPower);
  if (percent !== null) return { type: "ev3_motor_start_speed", fields: { PORT: port, SPEED: percent } };
  throw new PythonBlocksError(`a potência “${node.power}” não pode ser representada pelos blocos de motor.`);
}

function movementPair(nodes: ProgramNode[], index: number): { block: BlockModel; consumed: number } | null {
  const left = nodes[index];
  const right = nodes[index + 1];
  if (left?.kind !== "setPower" || right?.kind !== "setPower") return null;
  if (left.channel !== "motor_movimento_esquerdo" || right.channel !== "motor_movimento_direito") return null;
  const leftPercent = percentFromPower(left.power);
  const rightPercent = percentFromPower(right.power);
  if (leftPercent === null || rightPercent === null) return null;
  if (leftPercent === 0 && rightPercent === 0) return { block: { type: "ev3_move_stop" }, consumed: 2 };
  if (leftPercent * rightPercent >= 0) {
    const leftIsOuter = Math.abs(leftPercent) >= Math.abs(rightPercent);
    const speed = leftIsOuter ? leftPercent : rightPercent;
    const rawSteering = leftIsOuter
      ? (1 - rightPercent / leftPercent) * 100
      : (leftPercent / rightPercent - 1) * 100;
    const steering = Math.max(-100, Math.min(100, Math.round(rawSteering * 1000) / 1000));
    return { block: { type: "ev3_move_start", fields: { STEERING: steering, SPEED: speed } }, consumed: 2 };
  }
  return { block: { type: "ev3_move_tank_start", fields: { LEFT: leftPercent, RIGHT: rightPercent } }, consumed: 2 };
}

function literalPrintBlock(expression: string): BlockModel | null {
  const message = stringLiteral(expression);
  if (message === null) return null;
  if (message.startsWith("Motores de movimento:")) return null;
  if (message === "Programa encerrado") return { type: "ev3_stop_program" };
  if (message === "Pilha encerrada") return { type: "ev3_stop_stack" };
  if (message === "▣ Monitor limpo") return { type: "ev3_display_clear" };
  if (message.startsWith("▣ Imagem: ")) return { type: "ev3_display_image", fields: { IMAGE: message.slice("▣ Imagem: ".length) } };
  if (message.startsWith("▣ ")) return { type: "ev3_display_write_line", fields: { TEXT: message.slice(2), LINE: 1 } };
  if (message.startsWith("🔊 Som: ")) return { type: "ev3_play_sound", fields: { SOUND: message.slice("🔊 Som: ".length) } };
  if (message.startsWith("🔇")) return { type: "ev3_stop_sounds" };
  if (message.startsWith("Mensagem: ")) return { type: "ev3_broadcast", fields: { MESSAGE: message.slice("Mensagem: ".length) } };
  if (message.startsWith("Ao parar: ")) return { type: "ev3_move_set_brake", fields: { BRAKE: message.slice("Ao parar: ".length) } };
  const motorBrake = message.match(/^Motor ([A-D]): (.+)$/);
  if (motorBrake) return { type: "ev3_motor_set_brake", fields: { PORT: motorBrake[1], BRAKE: motorBrake[2] } };
  return { type: "ev3_display_write_line", fields: { TEXT: message, LINE: 1 } };
}

function assignmentBlocks(nodes: ProgramNode[], index: number): { blocks: BlockModel[]; consumed: number } {
  const node = nodes[index];
  if (node.kind !== "assign") return { blocks: [], consumed: 0 };
  const motorSpeed = node.target.match(/^velocidade_motor_([A-D])$/);
  const numeric = numberLiteral(node.expression);
  if (motorSpeed && numeric !== null) return { blocks: [{ type: "ev3_motor_set_speed", fields: { PORT: motorSpeed[1], SPEED: numeric } }], consumed: 1 };
  if (node.target === "velocidade_movimento" && numeric !== null) return { blocks: [{ type: "ev3_move_set_speed", fields: { SPEED: numeric } }], consumed: 1 };
  if (node.target === "volume_ev3" && numeric !== null) return { blocks: [{ type: "ev3_set_volume", fields: { VOLUME: numeric } }], consumed: 1 };
  if (node.target === "graus_motor" && numeric === 0) return { blocks: [{ type: "ev3_motor_reset_degrees", fields: { PORT: "A" } }], consumed: 1 };
  if (node.target === "motor_movimento_esquerdo") {
    const right = nodes[index + 1];
    const leftChannel = numberLiteral(node.expression);
    const rightChannel = right?.kind === "assign" && right.target === "motor_movimento_direito" ? numberLiteral(right.expression) : null;
    if (leftChannel !== null && rightChannel !== null && channelPorts[leftChannel] && channelPorts[rightChannel]) return {
      blocks: [{ type: "ev3_move_set_motors", fields: { LEFT_PORT: channelPorts[leftChannel], RIGHT_PORT: channelPorts[rightChannel] } }],
      consumed: 2,
    };
  }
  throw new PythonBlocksError(`a atribuição “${node.target} = ${node.expression}” não possui um bloco equivalente.`);
}

function convertSequence(sourceNodes: ProgramNode[], inheritedBindings = new Map<string, SensorBinding>()): BlockModel[] {
  const bindings = new Map(inheritedBindings);
  const result: BlockModel[] = [];
  for (let index = 0; index < sourceNodes.length;) {
    const node = sourceNodes[index];
    if (node.kind === "ev3Sensor") {
      bindings.set(node.target, { sensor: node.sensor, port: node.port });
      index += 1;
      continue;
    }
    if (node.kind === "sensor") {
      throw new PythonBlocksError("a leitura ultrassônica Arduino ainda não possui um bloco EV3 equivalente; use ev3.distance_cm(porta).");
    }
    if (node.kind === "assign") {
      const converted = assignmentBlocks(sourceNodes, index);
      result.push(...converted.blocks);
      index += converted.consumed;
      continue;
    }
    if (node.kind === "setPower") {
      const movement = movementPair(sourceNodes, index);
      if (movement) {
        result.push(movement.block);
        index += movement.consumed;
      } else {
        result.push(motorPowerBlock(node));
        index += 1;
      }
      continue;
    }
    if (node.kind === "sleep") {
      const seconds = numberLiteral(node.seconds);
      if (seconds === null) throw new PythonBlocksError(`a espera “${node.seconds}” precisa ser um número para virar bloco.`);
      result.push({ type: "ev3_wait", fields: { SECONDS: seconds } });
      index += 1;
      continue;
    }
    if (node.kind === "if") {
      const body = convertSequence(node.body, bindings);
      const otherwise = convertSequence(node.otherwise, bindings);
      if (!body.length) throw new PythonBlocksError(`o if da linha ${node.line} precisa conter ao menos um comando representável.`);
      result.push({
        type: otherwise.length ? "ev3_if_else" : "ev3_if",
        values: { CONDITION: expressionBlock(node.condition, bindings) },
        statements: { DO: body, ...(otherwise.length ? { ELSE: otherwise } : {}) },
      });
      index += 1;
      continue;
    }
    if (node.kind === "for") {
      const count = numberLiteral(node.count);
      if (count === null) throw new PythonBlocksError(`o range “${node.count}” precisa ser numérico para virar bloco.`);
      const body = convertSequence(node.body, bindings);
      if (!body.length) throw new PythonBlocksError(`o for da linha ${node.line} precisa conter ao menos um comando representável.`);
      result.push(node.variable.startsWith("sempre_") && count === 100
        ? { type: "ev3_forever", statements: { DO: body } }
        : { type: "ev3_repeat", fields: { TIMES: Math.max(1, Math.min(100, Math.round(count))) }, statements: { DO: body } });
      index += 1;
      continue;
    }
    if (node.kind === "ev3Command") {
      result.push({ type: node.command === "reset_timer" ? "ev3_timer_reset" : "ev3_gyro_reset", ...(node.command === "reset_gyro" ? { fields: { PORT: "2" } } : {}) });
      index += 1;
      continue;
    }
    if (node.kind === "led") {
      const rgb = [numberLiteral(node.red), numberLiteral(node.green), numberLiteral(node.blue)];
      const colours: Record<string, string> = { "48,180,90": "verde", "240,157,32": "laranja", "235,62,55": "vermelho", "0,0,0": "apagada" };
      const colour = rgb.every((value) => value !== null) ? colours[rgb.join(",")] : undefined;
      if (!colour) throw new PythonBlocksError("essa combinação RGB não possui uma cor equivalente no bloco de luz de status.");
      result.push({ type: "ev3_status_light", fields: { COLOR: colour } });
      index += 1;
      continue;
    }
    if (node.kind === "print") {
      const converted = literalPrintBlock(node.expression);
      if (converted) result.push(converted);
      else if (stringLiteral(node.expression) === null) throw new PythonBlocksError(`o print da linha ${node.line} precisa usar um texto fixo para virar bloco.`);
      index += 1;
      continue;
    }
    const exhaustive: never = node;
    throw new PythonBlocksError(`o comando ${(exhaustive as ProgramNode).kind} ainda não possui um bloco equivalente.`);
  }
  return result;
}

/** Convert the Python subset executed by the simulator into editable Blockly XML. */
export function pythonToBlocks(code: string): string {
  const hasCommand = code.split("\n").some((line) => {
    const trimmed = line.trim();
    return trimmed !== "" && !trimmed.startsWith("#");
  });
  if (!hasCommand) return createEmptyBlocks();

  try {
    const nodes = withoutGeneratedHeader(parseProgram(code));
    const blocks = convertSequence(nodes);
    if (!blocks.length) return createEmptyBlocks();
    return `<xml xmlns="https://developers.google.com/blockly/xml"><block type="ev3_start" x="34" y="32"><next>${serializeSequence(blocks)}</next></block></xml>`;
  } catch (error) {
    if (error instanceof PythonBlocksError) throw error;
    if (error instanceof ProgramError) throw new PythonBlocksError(error.message);
    throw error;
  }
}
