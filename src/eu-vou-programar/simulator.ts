import { cloneHardware, DEFAULT_HARDWARE, getDriveMotorPorts, SENSOR_DEFINITIONS, SENSOR_POSITION_DEFINITIONS, SENSOR_PORTS } from "./hardware";
import type { HardwareConfig, MotorPort, SensorKind, SensorPort } from "./hardware";
import { createOBRLayout, OBR_TILE_SIZE } from "./obrArena";
import type { ArenaLevel, ArenaPoint, ArenaRect, OBRLayout } from "./obrArena";

export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 600;
const WALL_MARGIN = 18;
const ROBOT_RADIUS = 21;
const MAX_SENSOR_DISTANCE = 420;

function tileKeyAt(x: number, y: number) {
  return `${Math.floor(x / OBR_TILE_SIZE)}:${Math.floor(y / OBR_TILE_SIZE)}`;
}

export type LogLevel = "info" | "success" | "warning" | "error";

export interface GameLog {
  id: number;
  level: LogLevel;
  message: string;
}

export interface RobotState {
  x: number;
  y: number;
  angle: number;
  leftPower: number;
  rightPower: number;
  motorPowers: Record<MotorPort, number>;
  led: string;
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  sensorColor: string;
}

export interface FloorZone {
  x: number;
  y: number;
  radius: number;
  color: string;
  fill: string;
}

export interface Victim extends ArenaPoint {
  id: string;
  type: "alive" | "dead";
  rescued: boolean;
  touched: boolean;
}

export interface CompetitionState {
  level: ArenaLevel;
  elapsed: number;
  remaining: number;
  tilePoints: number;
  challengePoints: number;
  scoredTiles: string[];
  scoredHazards: string[];
  hazardHoldTimes: Record<string, number>;
  collisionCount: number;
  victimTouches: number;
  lastEvent: string;
  finishStopped: number;
  roundOver: boolean;
}

export interface WorldState {
  robot: RobotState;
  obstacles: Obstacle[];
  floorZones: FloorZone[];
  goal: { x: number; y: number; radius: number };
  bumped: boolean;
  collisionAngle?: number;
  success: boolean;
  collisionReported: boolean;
  hardware: HardwareConfig;
  layout: OBRLayout;
  victims: Victim[];
  competition: CompetitionState;
}

export type ProgramNode =
  | { kind: "setPower"; line: number; channel: string; power: string }
  | { kind: "sleep"; line: number; seconds: string }
  | { kind: "sensor"; line: number; target: string; trigger: string; echo: string; divisor?: string }
  | { kind: "ev3Sensor"; line: number; target: string; sensor: string; port?: string }
  | { kind: "ev3Command"; line: number; command: "reset_timer" | "reset_gyro" }
  | { kind: "assign"; line: number; target: string; expression: string }
  | { kind: "print"; line: number; expression: string }
  | { kind: "led"; line: number; red: string; green: string; blue: string }
  | { kind: "for"; line: number; variable: string; count: string; body: ProgramNode[] }
  | { kind: "if"; line: number; condition: string; body: ProgramNode[]; otherwise: ProgramNode[] };

interface SourceLine {
  line: number;
  indent: number;
  text: string;
}

interface RunnerFrame {
  nodes: ProgramNode[];
  index: number;
  repeat: number;
  iteration: number;
  variable?: string;
  forever?: boolean;
}

export interface RunnerState {
  frames: RunnerFrame[];
  variables: Record<string, number | string | boolean | null>;
  wait: number;
  executed: number;
  finished: boolean;
  elapsed: number;
  timerOffset: number;
  gyroOffset: number;
}

export class ProgramError extends Error {
  constructor(message: string, line?: number) {
    super(line ? `Linha ${line}: ${message}` : message);
    this.name = "ProgramError";
  }
}

export function createWorld(hardware: HardwareConfig = DEFAULT_HARDWARE, layoutIndex?: number, level: ArenaLevel = "beginner"): WorldState {
  const layout = createOBRLayout(layoutIndex, level);
  const start = layout.start;
  const startTile = tileKeyAt(start.x, start.y);
  return {
    robot: {
      x: start.x,
      y: start.y,
      angle: start.angle,
      leftPower: 0,
      rightPower: 0,
      motorPowers: { A: 0, B: 0, C: 0, D: 0 },
      led: "#df9920",
    },
    obstacles: layout.obstacles.map((obstacle) => ({
      x: obstacle.x,
      y: obstacle.y,
      width: obstacle.width,
      height: obstacle.height,
      color: obstacle.colour ?? "#e56d43",
      sensorColor: obstacle.sensorColour ?? "vermelho",
    })),
    floorZones: [],
    goal: { x: layout.challenge.goal.x, y: layout.challenge.goal.y, radius: layout.challenge.goal.radius },
    bumped: false,
    success: false,
    collisionReported: false,
    hardware: cloneHardware(hardware),
    layout,
    victims: layout.arenaStyle === "white" ? [] : [
      { id: "alive-1", type: "alive", x: layout.rescueRoom.x + 90, y: layout.rescueRoom.y + 90, rescued: false, touched: false },
      { id: "alive-2", type: "alive", x: layout.rescueRoom.x + 185, y: layout.rescueRoom.y + 105, rescued: false, touched: false },
      { id: "dead-1", type: "dead", x: layout.rescueRoom.x + 145, y: layout.rescueRoom.y + 205, rescued: false, touched: false },
    ],
    competition: {
      level,
      elapsed: 0,
      remaining: layout.challenge.timeLimit,
      tilePoints: 5,
      challengePoints: 0,
      scoredTiles: [startTile],
      scoredHazards: [],
      hazardHoldTimes: {},
      collisionCount: 0,
      victimTouches: 0,
      lastEvent: layout.arenaStyle === "white" ? "Ponto de partida: +5 pontos" : "Ladrilho de partida: +5 pontos",
      finishStopped: 0,
      roundOver: false,
    },
  };
}

export function hasActiveDrivePower(world: WorldState) {
  return Math.abs(world.robot.leftPower) > 0.001 || Math.abs(world.robot.rightPower) > 0.001;
}

function countIndent(value: string) {
  return value.match(/^ */)?.[0].length ?? 0;
}

function splitArguments(value: string): string[] {
  const args: string[] = [];
  let current = "";
  let depth = 0;
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      current += char;
      if (char === quote && value[index - 1] !== "\\") quote = "";
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      current += char;
    } else if (char === "(") {
      depth += 1;
      current += char;
    } else if (char === ")") {
      depth -= 1;
      current += char;
    } else if (char === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function parseSimpleLine(source: SourceLine): ProgramNode | null {
  const { text, line } = source;
  if (/^(from\s+\S+\s+import\s+.+|import\s+.+)$/.test(text) || text === "pass") return null;

  let match = text.match(/^motors\.set_power\((.*)\)$/);
  if (match) {
    const args = splitArguments(match[1]);
    if (args.length !== 2) throw new ProgramError("set_power precisa de canal e potência.", line);
    return { kind: "setPower", line, channel: args[0], power: args[1] };
  }

  match = text.match(/^utils\.sleep\((.*)\)$/);
  if (match) return { kind: "sleep", line, seconds: match[1].trim() };

  match = text.match(/^(\w+)\s*=\s*arduino\.measure_ultrasound_distance\(([^)]*)\)(?:\s*\/\s*(.+))?$/);
  if (match) {
    const args = splitArguments(match[2]);
    if (args.length !== 2) throw new ProgramError("O ultrassom precisa dos pinos trigger e echo.", line);
    return { kind: "sensor", line, target: match[1], trigger: args[0], echo: args[1], divisor: match[3]?.trim() };
  }

  match = text.match(/^(\w+)\s*=\s*ev3\.(touch_pressed|gyro_angle|gyro_speed|timer|color|light_reflected|light_ambient|distance_cm|motor_degrees|motor_speed)\(([^)]*)\)$/);
  if (match) {
    const args = splitArguments(match[3]);
    if (args.length > 1) throw new ProgramError("o sensor EV3 aceita somente uma porta.", line);
    return { kind: "ev3Sensor", line, target: match[1], sensor: match[2], port: args[0] };
  }

  match = text.match(/^ev3\.(reset_timer|reset_gyro)\(\)$/);
  if (match) return { kind: "ev3Command", line, command: match[1] as "reset_timer" | "reset_gyro" };

  match = text.match(/^leds\.set_rgb\((.*)\)$/);
  if (match) {
    const args = splitArguments(match[1]);
    const colors = args.length === 4 ? args.slice(1) : args;
    if (colors.length !== 3) throw new ProgramError("set_rgb precisa dos valores vermelho, verde e azul.", line);
    return { kind: "led", line, red: colors[0], green: colors[1], blue: colors[2] };
  }

  match = text.match(/^print\((.*)\)$/);
  if (match) return { kind: "print", line, expression: match[1].trim() };

  match = text.match(/^(\w+)\s*=\s*(.+)$/);
  if (match) return { kind: "assign", line, target: match[1], expression: match[2] };

  if (/^(while|def|class)\b/.test(text)) {
    throw new ProgramError("este comando ainda não faz parte desta missão. Use for e if.", line);
  }
  throw new ProgramError(`não reconheci o comando “${text}”.`, line);
}

export function parseProgram(code: string): ProgramNode[] {
  const lines: SourceLine[] = code
    .replace(/\t/g, "    ")
    .split(/\r?\n/)
    .map((raw, index) => ({ line: index + 1, indent: countIndent(raw), text: raw.trim() }))
    .filter((line) => line.text && !line.text.startsWith("#"));

  if (!lines.length) throw new ProgramError("escreva pelo menos um comando para o robô.");

  function parseIf(headerIndex: number, indent: number, condition: string): [ProgramNode, number] {
    const source = lines[headerIndex];
    const firstBodyLine = lines[headerIndex + 1];
    if (!firstBodyLine || firstBodyLine.indent <= indent) throw new ProgramError("adicione comandos dentro deste bloco.", source.line);
    const [body, afterBody] = parseBlock(headerIndex + 1, firstBodyLine.indent);
    let otherwise: ProgramNode[] = [];
    let nextCursor = afterBody;
    const alternative = lines[afterBody];
    const elifMatch = alternative?.indent === indent ? alternative.text.match(/^elif\s+(.+):$/) : null;
    if (elifMatch) {
      const [nestedIf, afterAlternative] = parseIf(afterBody, indent, elifMatch[1]);
      otherwise = [nestedIf];
      nextCursor = afterAlternative;
    } else if (alternative?.indent === indent && alternative.text === "else:") {
      const firstElseLine = lines[afterBody + 1];
      if (!firstElseLine || firstElseLine.indent <= indent) throw new ProgramError("adicione comandos dentro do else.", alternative.line);
      [otherwise, nextCursor] = parseBlock(afterBody + 1, firstElseLine.indent);
    }
    return [{ kind: "if", line: source.line, condition, body, otherwise }, nextCursor];
  }

  function parseBlock(start: number, indent: number): [ProgramNode[], number] {
    const nodes: ProgramNode[] = [];
    let cursor = start;
    while (cursor < lines.length) {
      const source = lines[cursor];
      if (source.indent < indent) break;
      if (source.indent > indent) throw new ProgramError("recuo inesperado.", source.line);
      if (source.text === "else:" || /^elif\s+.+:$/.test(source.text)) break;

      const forMatch = source.text.match(/^for\s+(\w+)\s+in\s+range\((.+)\):$/);
      const ifMatch = source.text.match(/^if\s+(.+):$/);
      const foreverMatch = source.text.match(/^while\s+True:$/);
      if (forMatch || ifMatch || foreverMatch) {
        if (ifMatch) {
          const [conditional, nextCursor] = parseIf(cursor, indent, ifMatch[1]);
          nodes.push(conditional);
          cursor = nextCursor;
          continue;
        }
        const next = lines[cursor + 1];
        if (!next || next.indent <= indent) throw new ProgramError("adicione comandos dentro deste bloco.", source.line);
        const [body, afterBody] = parseBlock(cursor + 1, next.indent);
        if (forMatch || foreverMatch) {
          nodes.push({
            kind: "for",
            line: source.line,
            variable: foreverMatch ? `sempre_while_${source.line}` : forMatch![1],
            count: foreverMatch ? "100" : forMatch![2],
            body,
          });
          cursor = afterBody;
          continue;
        }
      }

      const node = parseSimpleLine(source);
      if (node) nodes.push(node);
      cursor += 1;
    }
    return [nodes, cursor];
  }

  const [nodes, cursor] = parseBlock(0, lines[0].indent);
  if (cursor !== lines.length) throw new ProgramError("verifique a organização dos blocos.", lines[cursor].line);
  return nodes;
}

type Token = { type: "number" | "string" | "identifier" | "operator" | "eof"; value: string };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    if (/\s/.test(expression[index])) { index += 1; continue; }
    const rest = expression.slice(index);
    const number = rest.match(/^\d+(?:\.\d+)?/);
    if (number) { tokens.push({ type: "number", value: number[0] }); index += number[0].length; continue; }
    const identifier = rest.match(/^[A-Za-z_]\w*/);
    if (identifier) { tokens.push({ type: "identifier", value: identifier[0] }); index += identifier[0].length; continue; }
    const quote = expression[index];
    if (quote === "\"" || quote === "'") {
      let value = "";
      index += 1;
      while (index < expression.length && expression[index] !== quote) {
        if (expression[index] === "\\" && index + 1 < expression.length) {
          const escaped = expression[index + 1];
          value += escaped === "n" ? "\n" : escaped;
          index += 2;
        } else { value += expression[index]; index += 1; }
      }
      if (expression[index] !== quote) throw new ProgramError("texto sem aspas de fechamento.");
      index += 1;
      tokens.push({ type: "string", value });
      continue;
    }
    const operator = rest.match(/^(==|!=|<=|>=|[()+\-*/%<>])/);
    if (operator) { tokens.push({ type: "operator", value: operator[0] }); index += operator[0].length; continue; }
    throw new ProgramError(`expressão inválida perto de “${rest.slice(0, 8)}”.`);
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

function numeric(value: unknown): number {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new ProgramError("era esperado um número.");
  return result;
}

export function evaluateExpression(expression: string, variables: RunnerState["variables"]): number | string | boolean | null {
  const tokens = tokenize(expression.trim());
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const matches = (value: string) => peek().value === value;

  const parsePrimary = (): number | string | boolean | null => {
    const token = take();
    if (token.type === "number") return Number(token.value);
    if (token.type === "string") return token.value;
    if (token.type === "identifier") {
      if (token.value === "True") return true;
      if (token.value === "False") return false;
      if (token.value === "None") return null;
      if (!(token.value in variables)) throw new ProgramError(`a variável “${token.value}” ainda não tem valor.`);
      return variables[token.value];
    }
    if (token.value === "(") {
      const value = parseOr();
      if (!matches(")")) throw new ProgramError("faltou fechar o parêntese.");
      take();
      return value;
    }
    throw new ProgramError("expressão incompleta.");
  };

  const parseUnary = (): number | string | boolean | null => {
    if (matches("-")) { take(); return -numeric(parseUnary()); }
    if (matches("not")) { take(); return !parseUnary(); }
    return parsePrimary();
  };
  const parseMultiply = (): number | string | boolean | null => {
    let value = parseUnary();
    while (["*", "/", "%"].includes(peek().value)) {
      const operator = take().value;
      const right = numeric(parseUnary());
      const left = numeric(value);
      value = operator === "*" ? left * right : operator === "/" ? left / right : left % right;
    }
    return value;
  };
  const parseAdd = (): number | string | boolean | null => {
    let value = parseMultiply();
    while (["+", "-"].includes(peek().value)) {
      const operator = take().value;
      const right = parseMultiply();
      value = operator === "+" && (typeof value === "string" || typeof right === "string")
        ? String(value) + String(right)
        : operator === "+" ? numeric(value) + numeric(right) : numeric(value) - numeric(right);
    }
    return value;
  };
  const parseComparison = (): number | string | boolean | null => {
    let value = parseAdd();
    while (["==", "!=", "<", ">", "<=", ">="].includes(peek().value)) {
      const operator = take().value;
      const right = parseAdd();
      if (operator === "==") value = value === right;
      else if (operator === "!=") value = value !== right;
      else if (operator === "<") value = numeric(value) < numeric(right);
      else if (operator === ">") value = numeric(value) > numeric(right);
      else if (operator === "<=") value = numeric(value) <= numeric(right);
      else value = numeric(value) >= numeric(right);
    }
    return value;
  };
  const parseAnd = (): number | string | boolean | null => {
    let value = parseComparison();
    while (matches("and")) {
      take();
      // The parser must always consume the right-hand side. Using JavaScript's
      // short-circuit expression here left its tokens unread whenever `value`
      // was false, which later surfaced as the misleading "missing )" error.
      const right = parseComparison();
      value = Boolean(value) && Boolean(right);
    }
    return value;
  };
  const parseOr = (): number | string | boolean | null => {
    let value = parseAnd();
    while (matches("or")) {
      take();
      const right = parseAnd();
      value = Boolean(value) || Boolean(right);
    }
    return value;
  };

  const result = parseOr();
  if (peek().type !== "eof") throw new ProgramError(`não entendi “${peek().value}” nesta expressão.`);
  return result;
}

function formatPrint(expression: string, variables: RunnerState["variables"]): string {
  const formatted = expression.match(/^f(["'])(.*)\1$/);
  if (formatted) {
    return formatted[2].replace(/\{([^{}]+)\}/g, (_, inner: string) => String(evaluateExpression(inner, variables)));
  }
  return String(evaluateExpression(expression, variables));
}

export function createRunner(nodes: ProgramNode[]): RunnerState {
  return {
    frames: [{ nodes, index: 0, repeat: 1, iteration: 0 }],
    variables: {},
    wait: 0,
    executed: 0,
    finished: false,
    elapsed: 0,
    timerOffset: 0,
    gyroOffset: 0,
  };
}

function finishFrame(runner: RunnerState) {
  const frame = runner.frames[runner.frames.length - 1];
  if (frame.repeat > 1) {
    frame.repeat -= 1;
    frame.iteration += 1;
    frame.index = 0;
    if (frame.variable) runner.variables[frame.variable] = frame.iteration;
    return true;
  } else {
    runner.frames.pop();
    return false;
  }
}

function colorChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function stepRunner(
  runner: RunnerState,
  world: WorldState,
  delta: number,
  emit: (message: string, level?: LogLevel) => void,
) {
  if (runner.finished) return;
  runner.elapsed += delta;
  if (runner.wait > 0) {
    runner.wait = Math.max(0, runner.wait - delta);
    return;
  }

  let immediateBudget = 80;
  while (immediateBudget > 0 && runner.frames.length) {
    immediateBudget -= 1;
    const frame = runner.frames[runner.frames.length - 1];
    if (frame.index >= frame.nodes.length) {
      // Yield once per loop iteration so sensors are read again only after the
      // physics advances. Without this, a line follower evaluated every repeat
      // at the starting position and then kept the final motor command forever.
      if (finishFrame(runner)) return;
      continue;
    }
    const node = frame.nodes[frame.index++];
    runner.executed += 1;
    if (runner.executed > 800 && !runner.frames.some((item) => item.forever)) throw new ProgramError("o programa executou comandos demais. Reduza as repetições.", node.line);

    if (node.kind === "setPower") {
      const channel = Math.round(numeric(evaluateExpression(node.channel, runner.variables)));
      const power = Math.max(-1, Math.min(1, numeric(evaluateExpression(node.power, runner.variables))));
      const motorPorts: MotorPort[] = ["A", "B", "C", "D"];
      const port = motorPorts[channel];
      if (!port) throw new ProgramError("use os canais 0, 1, 2 ou 3 para as portas A, B, C e D.", node.line);
      if (!world.hardware.motors[port]) emit(`Não há servomotor encaixado na saída ${port}.`, "warning");
      else {
        world.robot.motorPowers[port] = power;
        const movementChannel = node.channel.trim();
        if (movementChannel === "motor_movimento_esquerdo") world.robot.leftPower = power;
        else if (movementChannel === "motor_movimento_direito") world.robot.rightPower = power;
        else {
          const driveMotors = getDriveMotorPorts(world.hardware);
          if (port === driveMotors?.left) world.robot.leftPower = power;
          // Os dois motores de tração ficam espelhados no robô físico. Por
          // isso, o mesmo sentido de giro dos dois eixos move uma roda para a
          // frente e a outra para trás. Os blocos diretos de Motor representam
          // o giro do eixo; já os blocos de Movimento acima representam o
          // sentido do carrinho e não precisam desta conversão.
          if (port === driveMotors?.right) world.robot.rightPower = -power;
        }
      }
    } else if (node.kind === "sleep") {
      runner.wait = Math.max(0, Math.min(30, numeric(evaluateExpression(node.seconds, runner.variables))));
      return;
    } else if (node.kind === "sensor") {
      const trigger = numeric(evaluateExpression(node.trigger, runner.variables));
      const echo = numeric(evaluateExpression(node.echo, runner.variables));
      const ultrasonicInstalled = Object.values(world.hardware.sensors).includes("ultrasonic");
      if (!ultrasonicInstalled) emit("O sensor de distância não está encaixado no robô.", "warning");
      const millimetres = ultrasonicInstalled ? Math.round(sensorDistance(world, trigger, echo) * 5) : MAX_SENSOR_DISTANCE * 5;
      const divisor = node.divisor ? numeric(evaluateExpression(node.divisor, runner.variables)) : 1;
      runner.variables[node.target] = millimetres / divisor;
    } else if (node.kind === "ev3Sensor") {
      const port = node.port ? String(evaluateExpression(node.port, runner.variables)) : undefined;
      const angle = world.robot.angle * 180 / Math.PI;
      const selectedMotorPort = port && ["A", "B", "C", "D"].includes(port) ? port as MotorPort : undefined;
      const selectedMotorPower = selectedMotorPort ? Math.abs(world.robot.motorPowers[selectedMotorPort]) : (Math.abs(world.robot.leftPower) + Math.abs(world.robot.rightPower)) / 2;
      const requiredSensor: Partial<Record<string, SensorKind>> = {
        touch_pressed: "touch",
        gyro_angle: "gyro",
        gyro_speed: "gyro",
        color: "color",
        light_reflected: "color",
        light_ambient: "color",
        distance_cm: "ultrasonic",
      };
      const required = requiredSensor[node.sensor];
      const motorReading = node.sensor === "motor_degrees" || node.sensor === "motor_speed";
      const selectedSensorPort = required
        ? (port && SENSOR_PORTS.includes(port as SensorPort) ? port as SensorPort : SENSOR_PORTS.find((item) => world.hardware.sensors[item] === required))
        : undefined;
      const correctPort = motorReading
        ? Boolean(selectedMotorPort && world.hardware.motors[selectedMotorPort])
        : !required || Boolean(selectedSensorPort && world.hardware.sensors[selectedSensorPort] === required);
      if (!correctPort) emit(motorReading ? `Não há servomotor na saída ${port ?? "selecionada"}.` : `O sensor do bloco não está conectado à porta ${port ?? "selecionada"}.`, "warning");
      const colorReading = selectedSensorPort ? sensorColor(world, selectedSensorPort) : "branco";
      const values: Record<string, number | string | boolean> = {
        touch_pressed: correctPort && selectedSensorPort ? touchPressed(world, selectedSensorPort) : false,
        gyro_angle: correctPort ? Math.round(angle - runner.gyroOffset) : 0,
        gyro_speed: correctPort ? Math.round((world.robot.rightPower - world.robot.leftPower) * 180) : 0,
        timer: Math.max(0, runner.elapsed - runner.timerOffset),
        color: correctPort ? colorReading : "branco",
        light_reflected: correctPort ? reflectedLightForColor(colorReading) : 0,
        light_ambient: correctPort ? 50 : 0,
        distance_cm: correctPort && selectedSensorPort ? Math.round(sensorDistance(world, 2, 3, selectedSensorPort) * 0.5) : MAX_SENSOR_DISTANCE,
        motor_degrees: correctPort ? Math.round(runner.elapsed * selectedMotorPower * 360) : 0,
        motor_speed: correctPort ? Math.round(selectedMotorPower * 100) : 0,
      };
      runner.variables[node.target] = values[node.sensor] ?? 0;
    } else if (node.kind === "ev3Command") {
      if (node.command === "reset_timer") runner.timerOffset = runner.elapsed;
      else runner.gyroOffset = world.robot.angle * 180 / Math.PI;
    } else if (node.kind === "assign") {
      runner.variables[node.target] = evaluateExpression(node.expression, runner.variables);
    } else if (node.kind === "print") {
      emit(formatPrint(node.expression, runner.variables));
    } else if (node.kind === "led") {
      const red = colorChannel(numeric(evaluateExpression(node.red, runner.variables)));
      const green = colorChannel(numeric(evaluateExpression(node.green, runner.variables)));
      const blue = colorChannel(numeric(evaluateExpression(node.blue, runner.variables)));
      world.robot.led = `rgb(${red}, ${green}, ${blue})`;
    } else if (node.kind === "for") {
      const forever = node.variable.startsWith("sempre_");
      const repeat = forever ? Number.POSITIVE_INFINITY : Math.max(0, Math.min(100, Math.floor(numeric(evaluateExpression(node.count, runner.variables)))));
      if (repeat) {
        runner.variables[node.variable] = 0;
        runner.frames.push({ nodes: node.body, index: 0, repeat, iteration: 0, variable: node.variable, forever });
      }
    } else if (node.kind === "if") {
      const branch = evaluateExpression(node.condition, runner.variables) ? node.body : node.otherwise;
      if (branch.length) runner.frames.push({ nodes: branch, index: 0, repeat: 1, iteration: 0 });
    }
  }

  if (!runner.frames.length) runner.finished = true;
}

function pointInsideObstacle(x: number, y: number, obstacle: Obstacle) {
  return x >= obstacle.x && x <= obstacle.x + obstacle.width && y >= obstacle.y && y <= obstacle.y + obstacle.height;
}

function pointInsideRect(x: number, y: number, rectangle: ArenaRect) {
  return x >= rectangle.x && x <= rectangle.x + rectangle.width && y >= rectangle.y && y <= rectangle.y + rectangle.height;
}

function distanceToSegment(point: ArenaPoint, start: ArenaPoint, end: ArenaPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + amount * dx), point.y - (start.y + amount * dy));
}

function distanceToPath(point: ArenaPoint, path: ArenaPoint[]) {
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) closest = Math.min(closest, distanceToSegment(point, path[index - 1], path[index]));
  return closest;
}

function rescueWallRectangles(layout: OBRLayout): ArenaRect[] {
  if (layout.arenaStyle === "white") return [];
  const room = layout.rescueRoom;
  const wall = 8;
  return [
    { x: room.x - wall / 2, y: room.y - wall / 2, width: room.width + wall, height: wall },
    { x: room.x + room.width - wall / 2, y: room.y, width: wall, height: room.height },
    { x: room.x - wall / 2, y: room.y, width: wall, height: layout.silverGate.y - room.y },
    { x: room.x - wall / 2, y: layout.silverGate.y + layout.silverGate.height, width: wall, height: room.y + room.height - layout.silverGate.y - layout.silverGate.height },
    { x: room.x, y: room.y + room.height - wall / 2, width: layout.blackGate.x - room.x, height: wall },
    { x: layout.blackGate.x + layout.blackGate.width, y: room.y + room.height - wall / 2, width: room.x + room.width - layout.blackGate.x - layout.blackGate.width, height: wall },
  ];
}

function rescueAreaColor(world: WorldState, x: number, y: number) {
  if (world.layout.arenaStyle === "white") return null;
  const room = world.layout.rescueRoom;
  const size = 72;
  const greenLocalX = x - (room.x + 10);
  const greenLocalY = y - (room.y + 10);
  if (greenLocalX >= 0 && greenLocalY >= 0 && greenLocalX + greenLocalY <= size) return "verde";
  const redLocalX = room.x + room.width - 10 - x;
  const redLocalY = y - (room.y + 10);
  if (redLocalX >= 0 && redLocalY >= 0 && redLocalX + redLocalY <= size) return "vermelho";
  return null;
}

export function arenaColorAt(world: WorldState, x: number, y: number) {
  if (pointInsideRect(x, y, world.layout.finishStripe)) return "vermelho";
  if (pointInsideRect(x, y, world.layout.silverGate)) return "prata";
  if (pointInsideRect(x, y, world.layout.blackGate)) return "preto";
  const floorMarker = world.layout.floorMarkers.find((marker) => pointInsideRect(x, y, marker));
  if (floorMarker) return floorMarker.colour;
  if (world.layout.greenMarkers.some((marker) => pointInsideRect(x, y, marker))) return "verde";
  const rescueColor = rescueAreaColor(world, x, y);
  if (rescueColor) return rescueColor;
  if (world.layout.gaps.some((gap) => pointInsideRect(x, y, gap))) return "branco";
  if (world.layout.arenaStyle === "white") return "branco";
  const paths = [world.layout.mainPath, world.layout.exitPath, ...world.layout.branches];
  if (paths.some((path) => distanceToPath({ x, y }, path) <= 5)) return "preto";
  return "branco";
}

export interface SensorPose {
  x: number;
  y: number;
  direction: number;
}

export function sensorPose(world: WorldState, port: SensorPort): SensorPose {
  const mount = world.hardware.sensorMounts[port];
  const definition = SENSOR_POSITION_DEFINITIONS[mount?.position ?? "front-center"];
  const cosine = Math.cos(world.robot.angle);
  const sine = Math.sin(world.robot.angle);
  return {
    x: world.robot.x + definition.x * cosine - definition.y * sine,
    y: world.robot.y + definition.x * sine + definition.y * cosine,
    direction: world.robot.angle + definition.angle,
  };
}

function rayHit(world: WorldState, pose: SensorPose, maximum = MAX_SENSOR_DISTANCE) {
  for (let distance = 0; distance <= maximum; distance += 2) {
    const x = pose.x + Math.cos(pose.direction) * distance;
    const y = pose.y + Math.sin(pose.direction) * distance;
    if (x <= WALL_MARGIN || x >= WORLD_WIDTH - WALL_MARGIN || y <= WALL_MARGIN || y >= WORLD_HEIGHT - WALL_MARGIN) return { distance, color: "preto", obstacle: false };
    if (rescueWallRectangles(world.layout).some((wall) => pointInsideRect(x, y, wall))) return { distance, color: "branco", obstacle: true };
    const obstacle = world.obstacles.find((item) => pointInsideObstacle(x, y, item));
    if (obstacle) return { distance, color: obstacle.sensorColor, obstacle: true };
  }
  return { distance: maximum, color: "branco", obstacle: false };
}

function groundPoint(world: WorldState, port: SensorPort) {
  const pose = sensorPose(world, port);
  return { x: pose.x + Math.cos(pose.direction) * 12, y: pose.y + Math.sin(pose.direction) * 12 };
}

export function sensorColor(world: WorldState, port: SensorPort) {
  if (world.hardware.sensors[port] !== "color") return "branco";
  const mount = world.hardware.sensorMounts[port];
  if (mount?.aim === "outward") return rayHit(world, sensorPose(world, port), 190).color;
  const point = groundPoint(world, port);
  return arenaColorAt(world, point.x, point.y);
}

function sideColourDetected(world: WorldState, side: "left" | "right", colour: string) {
  return SENSOR_PORTS.some((port) => {
    const mount = world.hardware.sensorMounts[port];
    return world.hardware.sensors[port] === "color"
      && mount?.position === side
      && mount.aim === "outward"
      && sensorColor(world, port) === colour;
  });
}

function sensorGateDetected(world: WorldState, colour: string) {
  return sideColourDetected(world, "left", colour) && sideColourDetected(world, "right", colour);
}

function groundColourDetected(world: WorldState, colour: string) {
  return SENSOR_PORTS.some((port) => world.hardware.sensors[port] === "color"
    && world.hardware.sensorMounts[port]?.aim === "ground"
    && sensorColor(world, port) === colour);
}

function reflectedLightForColor(color: string) {
  return ({ preto: 8, marrom: 20, azul: 28, vermelho: 42, verde: 48, prata: 70, amarelo: 72, branco: 88 } as Record<string, number>)[color] ?? 50;
}

function angleDifference(left: number, right: number) {
  return Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)));
}

function touchPressed(world: WorldState, port: SensorPort) {
  if (!world.bumped || world.collisionAngle === undefined) return false;
  return angleDifference(sensorPose(world, port).direction, world.collisionAngle) <= Math.PI / 3;
}

export function sensorDistance(world: WorldState, trigger = 2, echo = 3, selectedPort?: SensorPort) {
  const port = selectedPort ?? SENSOR_PORTS.find((item) => world.hardware.sensors[item] === "ultrasonic");
  if (!port || world.hardware.sensors[port] !== "ultrasonic") return MAX_SENSOR_DISTANCE;
  const mount = world.hardware.sensorMounts[port];
  const pose = sensorPose(world, port);
  if (!mount) {
    let offset = 0;
    if (trigger === 4 || echo === 5) offset = -Math.PI / 2;
    else if (trigger === 6 || echo === 7) offset = Math.PI / 2;
    else if (trigger === 8 || echo === 9) offset = Math.PI;
    pose.direction += offset;
  }
  return rayHit(world, pose).distance;
}

function circleHitsRectangle(x: number, y: number, radius: number, rectangle: Obstacle) {
  const closestX = Math.max(rectangle.x, Math.min(x, rectangle.x + rectangle.width));
  const closestY = Math.max(rectangle.y, Math.min(y, rectangle.y + rectangle.height));
  return (x - closestX) ** 2 + (y - closestY) ** 2 < radius ** 2;
}

function circleHitsArenaRect(x: number, y: number, radius: number, rectangle: ArenaRect) {
  const closestX = Math.max(rectangle.x, Math.min(x, rectangle.x + rectangle.width));
  const closestY = Math.max(rectangle.y, Math.min(y, rectangle.y + rectangle.height));
  return (x - closestX) ** 2 + (y - closestY) ** 2 < radius ** 2;
}

function robotIsInsideRoom(world: WorldState) {
  if (world.layout.arenaStyle === "white") return false;
  const room = world.layout.rescueRoom;
  return world.robot.x > room.x && world.robot.x < room.x + room.width && world.robot.y > room.y && world.robot.y < room.y + room.height;
}

function headingMatches(current: number, required?: number) {
  if (required === undefined) return true;
  const difference = Math.atan2(Math.sin(current - required), Math.cos(current - required));
  return Math.abs(difference) <= Math.PI / 3;
}

function updateCompetition(world: WorldState, delta: number) {
  const competition = world.competition;
  if (competition.roundOver) return;
  const challenge = world.layout.challenge;
  competition.elapsed = Math.min(challenge.timeLimit, competition.elapsed + delta);
  competition.remaining = Math.max(0, challenge.timeLimit - competition.elapsed);

  const paths = [world.layout.mainPath, world.layout.exitPath, ...world.layout.branches];
  const distanceFromLine = Math.min(...paths.map((path) => distanceToPath(world.robot, path)));
  const currentTile = tileKeyAt(world.robot.x, world.robot.y);
  if (!robotIsInsideRoom(world) && distanceFromLine <= 42 && !competition.scoredTiles.includes(currentTile)) {
    competition.scoredTiles.push(currentTile);
    competition.tilePoints += 5;
    competition.lastEvent = world.layout.arenaStyle === "white" ? "Novo trecho percorrido: +5 pontos" : "Novo ladrilho percorrido: +5 pontos";
  }

  const stopped = Math.abs(world.robot.leftPower) < 0.02 && Math.abs(world.robot.rightPower) < 0.02;

  for (const hazard of world.layout.hazards) {
    if (competition.scoredHazards.includes(hazard.id)) continue;

    if (challenge.requireHazardOrder && challenge.requiredHazards.includes(hazard.id)) {
      const nextRequired = challenge.requiredHazards.find((id) => !competition.scoredHazards.includes(id));
      if (nextRequired !== hazard.id) {
        if (hazard.kind === "timed-stop" || hazard.requiredSeconds) competition.hazardHoldTimes[hazard.id] = 0;
        continue;
      }
    }

    let reached = false;
    if (hazard.kind === "sensor-gate") {
      const atGate = Math.hypot(world.robot.x - hazard.x, world.robot.y - hazard.y) <= hazard.radius
        && sensorGateDetected(world, hazard.requiredColour ?? "vermelho");
      if (hazard.requiredSeconds) {
        if (atGate && stopped) {
          competition.hazardHoldTimes[hazard.id] = (competition.hazardHoldTimes[hazard.id] ?? 0) + delta;
          const heldSeconds = Math.min(hazard.requiredSeconds, competition.hazardHoldTimes[hazard.id]);
          competition.lastEvent = `${hazard.label}: ${heldSeconds.toFixed(1)} de ${hazard.requiredSeconds} s`;
          reached = competition.hazardHoldTimes[hazard.id] >= hazard.requiredSeconds;
        } else {
          competition.hazardHoldTimes[hazard.id] = 0;
        }
      } else {
        reached = atGate;
      }
    } else if (hazard.kind === "timed-stop") {
      const onStation = Math.hypot(world.robot.x - hazard.x, world.robot.y - hazard.y) <= hazard.radius
        && headingMatches(world.robot.angle, hazard.requiredHeading)
        && groundColourDetected(world, hazard.requiredColour ?? "branco");
      if (onStation && stopped) {
        const requiredSeconds = hazard.requiredSeconds ?? 1;
        competition.hazardHoldTimes[hazard.id] = (competition.hazardHoldTimes[hazard.id] ?? 0) + delta;
        const heldSeconds = Math.min(requiredSeconds, competition.hazardHoldTimes[hazard.id]);
        competition.lastEvent = `${hazard.label}: ${heldSeconds.toFixed(1)} de ${requiredSeconds} s`;
        reached = competition.hazardHoldTimes[hazard.id] >= requiredSeconds;
      } else {
        competition.hazardHoldTimes[hazard.id] = 0;
      }
    } else {
      reached = Math.hypot(world.robot.x - hazard.x, world.robot.y - hazard.y) <= hazard.radius
        && headingMatches(world.robot.angle, hazard.requiredHeading);
    }

    if (reached) {
      competition.scoredHazards.push(hazard.id);
      competition.challengePoints += hazard.points;
      competition.lastEvent = hazard.points ? `${hazard.label}: +${hazard.points} pontos` : hazard.label;
    }
  }

  const challengeGoal = challenge.goal;
  const insideGoal = Math.hypot(world.robot.x - challengeGoal.x, world.robot.y - challengeGoal.y) <= challengeGoal.radius;
  const onFinish = insideGoal && (challengeGoal.requiredColour === undefined || groundColourDetected(world, challengeGoal.requiredColour));
  const headingReady = headingMatches(world.robot.angle, challengeGoal.requiredHeading);
  const hazardsReady = challenge.requiredHazards.every((id) => competition.scoredHazards.includes(id));
  const collisionsReady = challenge.maxCollisions === undefined || competition.collisionCount <= challenge.maxCollisions;
  const victimsReady = challenge.maxVictimTouches === undefined || competition.victimTouches <= challenge.maxVictimTouches;
  const motionReady = challengeGoal.stopRequired === false || stopped;
  const finishReady = onFinish && motionReady && headingReady && hazardsReady && collisionsReady && victimsReady;
  competition.finishStopped = finishReady ? competition.finishStopped + delta : 0;
  if (onFinish && stopped && !hazardsReady) {
    const missing = challenge.requiredHazards.filter((id) => !competition.scoredHazards.includes(id)).length;
    competition.lastEvent = `Objetivo encontrado, mas ainda faltam ${missing} etapa${missing === 1 ? "" : "s"}`;
  } else if (onFinish && stopped && !headingReady) {
    competition.lastEvent = "Posição correta, mas a orientação do robô ainda não confere";
  } else if (onFinish && stopped && !collisionsReady) {
    competition.lastEvent = "Este desafio exige reiniciar e completar sem colisões";
  } else if (onFinish && !victimsReady) {
    competition.lastEvent = "Uma bolinha foi tocada; reinicie para tentar a travessia novamente";
  }
  if (finishReady && competition.finishStopped >= challengeGoal.holdSeconds && !world.success) {
    competition.lastEvent = challenge.successMessage;
    competition.roundOver = true;
    world.success = true;
  }

  if (competition.remaining <= 0) {
    competition.roundOver = true;
    competition.lastEvent = "Tempo encerrado: reinicie para tentar novamente";
    world.robot.leftPower = 0;
    world.robot.rightPower = 0;
  }
}

export function restartRound(world: WorldState) {
  const start = world.layout.start;
  world.robot.x = start.x;
  world.robot.y = start.y;
  world.robot.angle = start.angle;
  world.robot.leftPower = 0;
  world.robot.rightPower = 0;
  world.robot.motorPowers = { A: 0, B: 0, C: 0, D: 0 };
  world.bumped = false;
  world.success = false;
  world.collisionReported = false;
  world.collisionAngle = undefined;
  for (const victim of world.victims) {
    victim.rescued = false;
    victim.touched = false;
  }
  world.competition = {
    level: world.competition.level,
    elapsed: 0,
    remaining: world.layout.challenge.timeLimit,
    tilePoints: 5,
    challengePoints: 0,
    scoredTiles: [tileKeyAt(start.x, start.y)],
    scoredHazards: [],
    hazardHoldTimes: {},
    collisionCount: 0,
    victimTouches: 0,
    lastEvent: world.layout.arenaStyle === "white" ? "Ponto de partida: +5 pontos" : "Ladrilho de partida: +5 pontos",
    finishStopped: 0,
    roundOver: false,
  };
}

export function advanceWorld(world: WorldState, delta: number, emit: (message: string, level?: LogLevel) => void) {
  const robot = world.robot;
  const linearVelocity = ((robot.leftPower + robot.rightPower) / 2) * 112;
  const angularVelocity = (robot.rightPower - robot.leftPower) * 2.25;
  const nextAngle = robot.angle + angularVelocity * delta;
  const nextX = robot.x + Math.cos(nextAngle) * linearVelocity * delta;
  const nextY = robot.y + Math.sin(nextAngle) * linearVelocity * delta;
  const touchedVictim = world.victims.find((victim) => !victim.rescued && Math.hypot(nextX - victim.x, nextY - victim.y) < ROBOT_RADIUS + 10);
  const hitsWall = nextX - ROBOT_RADIUS < WALL_MARGIN || nextX + ROBOT_RADIUS > WORLD_WIDTH - WALL_MARGIN
    || nextY - ROBOT_RADIUS < WALL_MARGIN || nextY + ROBOT_RADIUS > WORLD_HEIGHT - WALL_MARGIN;
  const hitsObstacle = world.obstacles.some((obstacle) => circleHitsRectangle(nextX, nextY, ROBOT_RADIUS, obstacle))
    || rescueWallRectangles(world.layout).some((wall) => circleHitsArenaRect(nextX, nextY, ROBOT_RADIUS, wall))
    || Boolean(touchedVictim);

  robot.angle = nextAngle;
  if (hitsWall || hitsObstacle) {
    world.bumped = true;
    world.collisionAngle = linearVelocity < 0 ? nextAngle + Math.PI : nextAngle;
    if (!world.collisionReported) {
      world.collisionReported = true;
      world.competition.collisionCount += 1;
      if (touchedVictim) {
        if (!touchedVictim.touched) {
          touchedVictim.touched = true;
          world.competition.victimTouches += 1;
          world.competition.lastEvent = "Bolinha tocada: a travessia precisa ser reiniciada";
        }
        emit("O robô tocou em uma bolinha da sala de resgate.", "warning");
      } else {
        emit("O robô encostou em um obstáculo.", "warning");
      }
    }
  } else {
    robot.x = nextX;
    robot.y = nextY;
    world.bumped = false;
    world.collisionAngle = undefined;
    world.collisionReported = false;
  }

  updateCompetition(world, delta);
}

function roundedRectangle(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawPath(context: CanvasRenderingContext2D, path: ArenaPoint[]) {
  if (!path.length) return;
  context.beginPath();
  context.moveTo(path[0].x, path[0].y);
  for (const point of path.slice(1)) context.lineTo(point.x, point.y);
  context.stroke();
}

export function fitWorldToViewport(viewportWidth: number, viewportHeight: number, requestedInset = 0) {
  const inset = Math.max(0, Math.min(requestedInset, viewportWidth / 4, viewportHeight / 4));
  const availableWidth = Math.max(1, viewportWidth - inset * 2);
  const availableHeight = Math.max(1, viewportHeight - inset * 2);
  const scale = Math.min(availableWidth / WORLD_WIDTH, availableHeight / WORLD_HEIGHT);
  return {
    scale,
    offsetX: (viewportWidth - WORLD_WIDTH * scale) / 2,
    offsetY: (viewportHeight - WORLD_HEIGHT * scale) / 2,
  };
}

export function drawWorld(canvas: HTMLCanvasElement, world: WorldState) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const desiredWidth = Math.floor(rect.width * dpr);
  const desiredHeight = Math.floor(rect.height * dpr);
  if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
    canvas.width = desiredWidth;
    canvas.height = desiredHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  const safeInset = canvas.dataset.arenaFit === "safe" ? Math.max(8, Math.min(rect.width, rect.height) * 0.018) : 0;
  const { scale, offsetX, offsetY } = fitWorldToViewport(rect.width, rect.height, safeInset);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#b9c2c7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);

  const whiteArena = world.layout.arenaStyle === "white";
  context.fillStyle = whiteArena ? "#fbfbf8" : "#c9d1d5";
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  if (whiteArena) {
    context.strokeStyle = "#d9ded9";
    context.lineWidth = 4;
    context.strokeRect(4, 4, WORLD_WIDTH - 8, WORLD_HEIGHT - 8);
  } else {
    for (let y = 6; y < WORLD_HEIGHT - 6; y += OBR_TILE_SIZE) {
      for (let x = 6; x < WORLD_WIDTH - 6; x += OBR_TILE_SIZE) {
        context.fillStyle = ((x + y) / OBR_TILE_SIZE) % 2 < 1 ? "#f5f3ec" : "#f1efe7";
        context.fillRect(x, y, OBR_TILE_SIZE - 4, OBR_TILE_SIZE - 4);
        context.strokeStyle = "rgba(74,82,87,.16)";
        context.lineWidth = 1;
        context.strokeRect(x, y, OBR_TILE_SIZE - 4, OBR_TILE_SIZE - 4);
      }
    }
  }

  const room = world.layout.rescueRoom;
  if (!whiteArena) {
    context.save();
    context.shadowColor = "rgba(39,48,54,.2)";
    context.shadowBlur = 15;
    context.fillStyle = "#f7f6f1";
    context.fillRect(room.x, room.y, room.width, room.height);
    context.restore();
  }

  for (const hazard of world.layout.hazards.filter((item) => item.kind === "ramp" && item.rect)) {
    const ramp = hazard.rect!;
    const rampGradient = context.createLinearGradient(ramp.x, ramp.y, ramp.x + ramp.width, ramp.y + ramp.height);
    rampGradient.addColorStop(0, "rgba(86,116,133,.08)");
    rampGradient.addColorStop(.5, "rgba(86,116,133,.32)");
    rampGradient.addColorStop(1, "rgba(86,116,133,.08)");
    context.fillStyle = rampGradient;
    context.fillRect(ramp.x, ramp.y, ramp.width, ramp.height);
    context.fillStyle = "#687983";
    context.font = "800 8px Nunito, sans-serif";
    context.fillText("RAMPA", ramp.x + 18, ramp.y + 13);
  }

  if (!whiteArena) {
    context.save();
    context.strokeStyle = "#15181b";
    context.lineWidth = 8;
    context.lineCap = "round";
    context.lineJoin = "round";
    drawPath(context, world.layout.mainPath);
    drawPath(context, world.layout.exitPath);
    context.lineWidth = 7;
    for (const branch of world.layout.branches) drawPath(context, branch);
    context.restore();
  }

  for (const gap of world.layout.gaps) {
    context.fillStyle = "#f4f2ea";
    context.fillRect(gap.x, gap.y, gap.width, gap.height);
    context.strokeStyle = "rgba(130,83,45,.18)";
    context.setLineDash([3, 3]);
    context.strokeRect(gap.x, gap.y, gap.width, gap.height);
    context.setLineDash([]);
  }

  const markerColours: Record<string, string> = {
    azul: "#2587d8", amarelo: "#f0be2f", vermelho: "#e23f3f", verde: "#2ea552", prata: "#c7cbd0", preto: "#171a1d",
  };
  for (const marker of world.layout.floorMarkers) {
    context.save();
    context.fillStyle = markerColours[marker.colour] ?? "#5d6870";
    context.fillRect(marker.x, marker.y, marker.width, marker.height);
    context.strokeStyle = "rgba(255,255,255,.75)";
    context.lineWidth = 1.5;
    context.strokeRect(marker.x + 2, marker.y + 2, marker.width - 4, marker.height - 4);
    context.fillStyle = marker.colour === "amarelo" || marker.colour === "prata" ? "#3c4247" : "#fff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "900 7px Nunito, sans-serif";
    context.fillText(marker.label, marker.x + marker.width / 2, marker.y + marker.height / 2);
    context.restore();
  }

  context.fillStyle = "#1f9a4a";
  for (const marker of world.layout.greenMarkers) context.fillRect(marker.x, marker.y, marker.width, marker.height);
  if (!whiteArena) {
    context.fillStyle = "#c7cbd0";
    context.fillRect(world.layout.silverGate.x, world.layout.silverGate.y, world.layout.silverGate.width, world.layout.silverGate.height);
    context.strokeStyle = "#8f969d";
    context.strokeRect(world.layout.silverGate.x, world.layout.silverGate.y, world.layout.silverGate.width, world.layout.silverGate.height);
    context.fillStyle = "#121519";
    context.fillRect(world.layout.blackGate.x, world.layout.blackGate.y, world.layout.blackGate.width, world.layout.blackGate.height);
    if (world.layout.finishStripe.width > 0 && world.layout.finishStripe.height > 0) {
      context.fillStyle = "#e23f3f";
      context.fillRect(world.layout.finishStripe.x, world.layout.finishStripe.y, world.layout.finishStripe.width, world.layout.finishStripe.height);
    }

    const areaSize = 72;
    context.fillStyle = "#2ea552";
    context.beginPath(); context.moveTo(room.x + 10, room.y + 10); context.lineTo(room.x + 10 + areaSize, room.y + 10); context.lineTo(room.x + 10, room.y + 10 + areaSize); context.closePath(); context.fill();
    context.fillStyle = "#d94743";
    context.beginPath(); context.moveTo(room.x + room.width - 10, room.y + 10); context.lineTo(room.x + room.width - 10 - areaSize, room.y + 10); context.lineTo(room.x + room.width - 10, room.y + 10 + areaSize); context.closePath(); context.fill();
  }

  for (const hazard of world.layout.hazards) {
    if (whiteArena && hazard.kind === "checkpoint") {
      const checkpointIndex = world.layout.challenge.requiredHazards.indexOf(hazard.id);
      const completed = world.competition.scoredHazards.includes(hazard.id);
      context.save();
      context.fillStyle = completed ? "rgba(48,145,81,.14)" : "rgba(48,129,181,.10)";
      context.strokeStyle = completed ? "#309151" : "#4a91bd";
      context.lineWidth = 3;
      context.setLineDash([6, 5]);
      context.beginPath();
      context.arc(hazard.x, hazard.y, 24, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = completed ? "#237842" : "#316d93";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "900 16px Nunito, sans-serif";
      context.fillText(completed ? "✓" : String(checkpointIndex + 1), hazard.x, hazard.y);
      context.font = "800 8px Nunito, sans-serif";
      context.fillText(`PONTO ${checkpointIndex + 1}`, hazard.x, hazard.y - 35);
      context.restore();
    }
    if (hazard.kind === "bump") {
      context.save();
      context.strokeStyle = "#d8d6ce";
      context.lineWidth = 5;
      context.shadowColor = "rgba(50,55,58,.25)";
      context.shadowBlur = 4;
      for (const offset of [-9, 0, 9]) { context.beginPath(); context.moveTo(hazard.x - 14, hazard.y + offset); context.lineTo(hazard.x + 14, hazard.y + offset); context.stroke(); }
      context.restore();
    }
    if (hazard.kind === "passage") {
      context.save();
      context.strokeStyle = "#ef8c2e";
      context.lineWidth = 7;
      context.beginPath(); context.moveTo(hazard.x - 18, hazard.y + 16); context.lineTo(hazard.x - 18, hazard.y - 17); context.lineTo(hazard.x + 18, hazard.y - 17); context.lineTo(hazard.x + 18, hazard.y + 16); context.stroke();
      context.restore();
    }
    if (hazard.kind === "sensor-gate") {
      context.save();
      context.strokeStyle = "#c83e3b";
      context.fillStyle = "#a9302e";
      context.lineWidth = 3;
      context.setLineDash([5, 4]);
      for (const offset of [-32, 32]) {
        context.beginPath();
        context.moveTo(hazard.x - 28, hazard.y + offset);
        context.lineTo(hazard.x + 28, hazard.y + offset);
        context.stroke();
      }
      context.setLineDash([]);
      context.textAlign = "center";
      context.font = "900 8px Nunito, sans-serif";
      context.fillText("PORTAL VERMELHO", hazard.x, hazard.y - 92);
      context.restore();
    }
  }

  context.fillStyle = "#40505a";
  context.font = "900 9px Nunito, sans-serif";
  if (whiteArena) {
    context.save();
    context.strokeStyle = "#66a97a";
    context.fillStyle = "rgba(48,145,81,.07)";
    context.lineWidth = 2;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.arc(world.layout.start.x, world.layout.start.y, 32, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#307d4a";
    context.textAlign = "center";
    context.fillText("PARTIDA", world.layout.start.x, world.layout.start.y + 45);
    context.textAlign = "left";
    context.fillStyle = "#7b8680";
    context.font = "800 10px Nunito, sans-serif";
    context.fillText("PISTA BRANCA · SEM LINHA-GUIA", 26, 32);
    context.restore();
  } else {
    context.fillText("PARTIDA", 38, 558);
    context.fillText("SALA DE RESGATE", room.x + 88, room.y + room.height - 14);
    if (world.layout.finishStripe.width > 0 && world.layout.finishStripe.height > 0) {
      context.fillStyle = "#b83232";
      context.fillText("CHEGADA", world.layout.finishStripe.x - 20, world.layout.finishStripe.y + 58);
    }
  }

  for (const obstacle of world.obstacles) {
    context.save();
    context.shadowColor = "rgba(55,49,42,.22)";
    context.shadowBlur = 12;
    context.shadowOffsetY = 8;
    roundedRectangle(context, obstacle.x, obstacle.y, obstacle.width, obstacle.height, 16);
    context.fillStyle = obstacle.color;
    context.fill();
    context.shadowColor = "transparent";
    context.strokeStyle = "rgba(75,55,40,.18)";
    context.lineWidth = 3;
    context.stroke();
    context.strokeStyle = "rgba(255,255,255,.38)";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(obstacle.x + 12, obstacle.y + 13);
    context.lineTo(obstacle.x + obstacle.width - 12, obstacle.y + 13);
    context.stroke();
    context.restore();
  }

  for (const victim of world.victims.filter((item) => !item.rescued)) {
    context.save();
    context.shadowColor = "rgba(35,40,44,.25)";
    context.shadowBlur = 7;
    const victimGradient = context.createRadialGradient(victim.x - 3, victim.y - 3, 2, victim.x, victim.y, 10);
    if (victim.type === "alive") { victimGradient.addColorStop(0, "#ffffff"); victimGradient.addColorStop(1, "#9ca5ac"); }
    else { victimGradient.addColorStop(0, "#555b61"); victimGradient.addColorStop(1, "#16191c"); }
    context.fillStyle = victimGradient;
    context.beginPath(); context.arc(victim.x, victim.y, 10, 0, Math.PI * 2); context.fill();
    if (victim.touched) {
      context.strokeStyle = "#e23f3f";
      context.lineWidth = 3;
      context.beginPath(); context.arc(victim.x, victim.y, 15, 0, Math.PI * 2); context.stroke();
    }
    context.restore();
  }

  if (!whiteArena) {
    context.fillStyle = "#e8ecee";
    for (const wall of rescueWallRectangles(world.layout)) context.fillRect(wall.x, wall.y, wall.width, wall.height);
    context.strokeStyle = "#69757d";
    context.lineWidth = 2;
    for (const wall of rescueWallRectangles(world.layout)) context.strokeRect(wall.x, wall.y, wall.width, wall.height);
  }

  context.save();
  context.strokeStyle = "#df9920";
  context.fillStyle = "rgba(255,241,181,.22)";
  context.lineWidth = 3;
  context.setLineDash([7, 5]);
  context.beginPath();
  context.arc(world.goal.x, world.goal.y, world.goal.radius + 7, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "#9b6511";
  context.textAlign = "center";
  context.font = "900 9px Nunito, sans-serif";
  context.fillText("★ OBJETIVO", world.goal.x, world.goal.y - world.goal.radius - 13);
  context.restore();

  for (const port of SENSOR_PORTS) {
    const kind = world.hardware.sensors[port];
    if (!kind) continue;
    if (whiteArena) continue;
    const mount = world.hardware.sensorMounts[port];
    const pose = sensorPose(world, port);
    if (kind === "color" && mount?.aim === "ground") {
      const point = groundPoint(world, port);
      const reading = sensorColor(world, port);
      const readingFill = ({ preto: "#202428", verde: "#2ea552", vermelho: "#e23f3f", prata: "#b8c0c7", branco: "#65d8f0" } as Record<string, string>)[reading] ?? "#65d8f0";
      context.save();
      context.strokeStyle = "rgba(49,167,213,.5)";
      context.setLineDash([3, 4]);
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(pose.x, pose.y);
      context.lineTo(point.x, point.y);
      context.stroke();
      context.shadowColor = readingFill;
      context.shadowBlur = 18;
      context.fillStyle = `${readingFill}66`;
      context.beginPath();
      context.arc(point.x, point.y, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "rgba(255,255,255,.95)";
      for (const [offsetX, offsetY, radius] of [[-6, -4, 2.2], [5, -7, 1.6], [7, 4, 2], [-4, 7, 1.4]] as const) {
        context.beginPath(); context.arc(point.x + offsetX, point.y + offsetY, radius, 0, Math.PI * 2); context.fill();
      }
      context.restore();
      continue;
    }
    if (kind !== "ultrasonic" && kind !== "color") continue;
    const distance = kind === "ultrasonic" ? sensorDistance(world, 2, 3, port) : rayHit(world, pose, 190).distance;
    const beamColour = kind === "ultrasonic" ? "48,145,81" : "49,167,213";
    context.save();
    context.translate(pose.x, pose.y);
    context.rotate(pose.direction);
    const sensorGradient = context.createLinearGradient(0, 0, Math.max(1, distance), 0);
    sensorGradient.addColorStop(0, `rgba(${beamColour},.3)`);
    sensorGradient.addColorStop(1, `rgba(${beamColour},0)`);
    context.fillStyle = sensorGradient;
    context.beginPath();
    context.moveTo(0, -4);
    context.lineTo(distance, kind === "ultrasonic" ? -18 : -8);
    context.lineTo(distance, kind === "ultrasonic" ? 18 : 8);
    context.lineTo(0, 4);
    context.closePath();
    context.fill();
    context.restore();
  }

  context.save();
  context.translate(world.robot.x, world.robot.y);
  context.rotate(world.robot.angle);
  context.shadowColor = "rgba(24,53,35,.28)";
  context.shadowBlur = 14;
  context.shadowOffsetY = 8;
  context.fillStyle = "#303944";
  roundedRectangle(context, -25, -33, 50, 66, 16);
  context.fill();
  context.shadowColor = "transparent";
  context.fillStyle = "#309151";
  roundedRectangle(context, -31, -27, 62, 54, 18);
  context.fill();
  context.strokeStyle = "#1b6135";
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = "#1f2e27";
  roundedRectangle(context, -17, -20, 38, 40, 13);
  context.fill();
  context.fillStyle = "white";
  context.beginPath(); context.arc(0, -9, 5, 0, Math.PI * 2); context.arc(0, 9, 5, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#21242c";
  context.beginPath(); context.arc(1, -9, 2.2, 0, Math.PI * 2); context.arc(1, 9, 2.2, 0, Math.PI * 2); context.fill();
  context.fillStyle = world.robot.led;
  context.shadowColor = world.robot.led;
  context.shadowBlur = 8;
  context.beginPath(); context.arc(-25, 0, 6, 0, Math.PI * 2); context.fill();
  context.shadowColor = "transparent";
  context.lineWidth = 2;
  for (const port of SENSOR_PORTS) {
    const kind = world.hardware.sensors[port];
    const mount = world.hardware.sensorMounts[port];
    if (!kind || !mount) continue;
    const position = SENSOR_POSITION_DEFINITIONS[mount.position];
    context.fillStyle = SENSOR_DEFINITIONS[kind].colour;
    context.strokeStyle = "white";
    context.beginPath();
    context.arc(position.x, position.y, kind === "color" ? 5 : 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.restore();
}
