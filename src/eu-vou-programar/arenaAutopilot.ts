import { cloneHardware, EMPTY_HARDWARE } from "./hardware";
import type { HardwareConfig, SensorPort } from "./hardware";
import type { ArenaPoint, ArenaRect, OBRHazard } from "./obrArena";
import {
  advanceWorld,
  createRunner,
  parseProgram,
  robotPositionIsClear,
  sensorColor,
  stepRunner,
} from "./simulator";
import type { LogLevel, WorldState } from "./simulator";

const GRID_SIZE = 6;
const MOVE_SPEED = 105;
const GROUND_SENSOR_PORT: SensorPort = "3";

export type AuditDriveMode = "movement" | "motor";

export const AUDIT_DRIVE_MODES: { id: AuditDriveMode; label: string; shortLabel: string }[] = [
  { id: "movement", label: "Movimento (bloco rosa)", shortLabel: "Rosa · Movimento" },
  { id: "motor", label: "Motor (bloco azul)", shortLabel: "Azul · Motor" },
];

export interface AuditPose extends ArenaPoint { angle: number }

interface AuditAction {
  id: string;
  label: string;
  pose: AuditPose;
  holdSeconds: number;
  kind: "hazard" | "goal";
}

export interface ArenaAutopilotState {
  status: "running" | "passed" | "failed";
  driveMode: AuditDriveMode;
  driveChecks: number;
  lastDriveCommand: string;
  actions: AuditAction[];
  actionIndex: number;
  route: ArenaPoint[];
  routeIndex: number;
  holdElapsed: number;
  message: string;
  error: string;
}

function powerLiteral(power: number) {
  return String(Math.round(Math.max(-1, Math.min(1, power)) * 100) / 100);
}

export function auditDriveProgram(mode: AuditDriveMode, leftPower: number, rightPower: number) {
  const left = powerLiteral(leftPower);
  const right = powerLiteral(rightPower);
  if (mode === "movement") {
    return [
      "motor_movimento_esquerdo = 1",
      "motor_movimento_direito = 2",
      `motors.set_power(motor_movimento_esquerdo, ${left})`,
      `motors.set_power(motor_movimento_direito, ${right})`,
    ].join("\n");
  }
  return [
    `motors.set_power(1, ${left})`,
    `motors.set_power(2, ${right})`,
  ].join("\n");
}

function executeDriveCommand(world: WorldState, mode: AuditDriveMode, leftPower: number, rightPower: number) {
  const code = auditDriveProgram(mode, leftPower, rightPower);
  const runner = createRunner(parseProgram(code));
  stepRunner(runner, world, 0, () => undefined);
  const expectedLeft = Number(powerLiteral(leftPower));
  const expectedRight = Number(powerLiteral(rightPower));
  const valid = runner.finished
    && Math.abs(world.robot.leftPower - expectedLeft) < 0.001
    && Math.abs(world.robot.rightPower - expectedRight) < 0.001
    && Math.abs(world.robot.motorPowers.B - expectedLeft) < 0.001
    && Math.abs(world.robot.motorPowers.C - expectedRight) < 0.001;
  return { valid, code };
}

function verifyDriveBlocks(world: WorldState, state: ArenaAutopilotState) {
  const checks = [
    { left: 0.5, right: 0.5, label: "avançar" },
    { left: -0.35, right: 0.35, label: "girar" },
    { left: 0, right: 0, label: "parar" },
  ];
  for (const check of checks) {
    const result = executeDriveCommand(world, state.driveMode, check.left, check.right);
    state.lastDriveCommand = `${check.label}: ${result.code.split("\n").slice(-2).join(" | ")}`;
    if (!result.valid) {
      fail(state, `${AUDIT_DRIVE_MODES.find((mode) => mode.id === state.driveMode)?.label} não comandou corretamente as duas rodas ao ${check.label}.`);
      return false;
    }
    state.driveChecks += 1;
  }
  return true;
}

interface HeapEntry { key: string; score: number }

class MinHeap {
  private entries: HeapEntry[] = [];

  get size() { return this.entries.length; }

  push(entry: HeapEntry) {
    this.entries.push(entry);
    let index = this.entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.entries[parent].score <= entry.score) break;
      this.entries[index] = this.entries[parent];
      index = parent;
    }
    this.entries[index] = entry;
  }

  pop() {
    if (!this.entries.length) return undefined;
    const first = this.entries[0];
    const last = this.entries.pop()!;
    if (this.entries.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.entries.length) break;
        const smallest = right < this.entries.length && this.entries[right].score < this.entries[left].score ? right : left;
        if (this.entries[smallest].score >= last.score) break;
        this.entries[index] = this.entries[smallest];
        index = smallest;
      }
      this.entries[index] = last;
    }
    return first;
  }
}

export function createAuditHardware(): HardwareConfig {
  const hardware = cloneHardware(EMPTY_HARDWARE);
  hardware.motors.B = "large";
  hardware.motors.C = "large";
  hardware.motorMounts.B = { role: "left-wheel" };
  hardware.motorMounts.C = { role: "right-wheel" };
  hardware.sensors["1"] = "color";
  hardware.sensorMounts["1"] = { position: "left", aim: "outward" };
  hardware.sensors["2"] = "color";
  hardware.sensorMounts["2"] = { position: "right", aim: "outward" };
  hardware.sensors[GROUND_SENSOR_PORT] = "color";
  hardware.sensorMounts[GROUND_SENSOR_PORT] = { position: "front-left", aim: "ground" };
  hardware.sensors["4"] = "ultrasonic";
  hardware.sensorMounts["4"] = { position: "front-center", aim: "outward" };
  return hardware;
}

function rectangleContains(rectangle: ArenaRect, point: ArenaPoint) {
  return point.x >= rectangle.x && point.x <= rectangle.x + rectangle.width
    && point.y >= rectangle.y && point.y <= rectangle.y + rectangle.height;
}

function markerCentre(marker: ArenaRect) {
  return { x: marker.x + marker.width / 2, y: marker.y + marker.height / 2 };
}

function markerAt(world: WorldState, x: number, y: number) {
  return world.layout.floorMarkers.find((marker) => {
    const centre = markerCentre(marker);
    return Math.hypot(centre.x - x, centre.y - y) <= 2;
  });
}

function goalColourTarget(world: WorldState) {
  const goal = world.layout.challenge.goal;
  const marker = markerAt(world, goal.x, goal.y);
  if (marker) return marker.colour;
  if (rectangleContains(world.layout.finishStripe, goal)) return "vermelho";
  if (rectangleContains(world.layout.silverGate, goal)) return "prata";
  if (rectangleContains(world.layout.blackGate, goal)) return "preto";
  if (goal.requiredColour) return goal.requiredColour;
  return undefined;
}

function findPose(
  world: WorldState,
  target: ArenaPoint,
  radius: number,
  requiredHeading?: number,
  requiredColour?: string,
): AuditPose | undefined {
  const original = { x: world.robot.x, y: world.robot.y, angle: world.robot.angle };
  const angles = requiredHeading === undefined
    ? Array.from({ length: 16 }, (_, index) => index * Math.PI / 8)
    : [requiredHeading];
  let best: AuditPose | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const angle of angles) {
    for (let x = target.x - radius; x <= target.x + radius; x += 3) {
      for (let y = target.y - radius; y <= target.y + radius; y += 3) {
        const targetDistance = Math.hypot(x - target.x, y - target.y);
        if (targetDistance > radius || !robotPositionIsClear(world, x, y)) continue;
        world.robot.x = x;
        world.robot.y = y;
        world.robot.angle = angle;
        if (requiredColour && sensorColor(world, GROUND_SENSOR_PORT) !== requiredColour) continue;
        const routeDistance = Math.hypot(x - original.x, y - original.y) + targetDistance * 0.2;
        if (routeDistance < bestDistance) {
          best = { x, y, angle };
          bestDistance = routeDistance;
        }
      }
    }
  }

  world.robot.x = original.x;
  world.robot.y = original.y;
  world.robot.angle = original.angle;
  return best;
}

function nearbyClearPose(world: WorldState, target: ArenaPoint, radius: number, requiredHeading?: number) {
  if (robotPositionIsClear(world, target.x, target.y)) return { ...target, angle: requiredHeading ?? world.robot.angle };
  return findPose(world, target, radius, requiredHeading);
}

function hazardAction(world: WorldState, hazard: OBRHazard): AuditAction | undefined {
  const holdSeconds = hazard.requiredSeconds ?? 0.12;
  if (hazard.kind === "sensor-gate") {
    const pose = nearbyClearPose(world, hazard, hazard.radius, hazard.requiredHeading ?? 0);
    return pose ? { id: hazard.id, label: hazard.label, pose, holdSeconds, kind: "hazard" } : undefined;
  }
  const requiredColour = hazard.kind === "timed-stop" ? hazard.requiredColour ?? "branco" : undefined;
  const pose = requiredColour
    ? findPose(world, hazard, hazard.radius, hazard.requiredHeading, requiredColour)
    : nearbyClearPose(world, hazard, hazard.radius, hazard.requiredHeading);
  return pose ? { id: hazard.id, label: hazard.label, pose, holdSeconds, kind: "hazard" } : undefined;
}

function goalAction(world: WorldState): AuditAction | undefined {
  const goal = world.layout.challenge.goal;
  const colourTarget = goalColourTarget(world);
  const pose = colourTarget
    ? findPose(world, goal, goal.radius, goal.requiredHeading, colourTarget)
    : nearbyClearPose(world, goal, goal.radius, goal.requiredHeading);
  return pose ? {
    id: "goal",
    label: goal.label,
    pose,
    holdSeconds: Math.max(0.12, goal.holdSeconds + 0.12),
    kind: "goal",
  } : undefined;
}

function pointKey(x: number, y: number) {
  return `${x},${y}`;
}

function parseKey(key: string) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function nearestGridPoint(world: WorldState, point: ArenaPoint) {
  const baseX = Math.round(point.x / GRID_SIZE);
  const baseY = Math.round(point.y / GRID_SIZE);
  for (let radius = 0; radius <= 8; radius += 1) {
    for (let x = baseX - radius; x <= baseX + radius; x += 1) {
      for (let y = baseY - radius; y <= baseY + radius; y += 1) {
        if (Math.max(Math.abs(x - baseX), Math.abs(y - baseY)) !== radius) continue;
        const worldPoint = { x: x * GRID_SIZE, y: y * GRID_SIZE };
        if (robotPositionIsClear(world, worldPoint.x, worldPoint.y)) return { grid: { x, y }, world: worldPoint };
      }
    }
  }
  return undefined;
}

function segmentIsClear(world: WorldState, start: ArenaPoint, end: ArenaPoint) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  // Subpixel sampling matters in narrow passages: a 3 px stride could jump
  // over the tiny collision arc at the corner of a rectangular obstacle.
  const steps = Math.max(1, Math.ceil(distance / 0.5));
  for (let step = 0; step <= steps; step += 1) {
    const amount = step / steps;
    if (!robotPositionIsClear(world, start.x + (end.x - start.x) * amount, start.y + (end.y - start.y) * amount)) return false;
  }
  return true;
}

function simplifyRoute(world: WorldState, route: ArenaPoint[]) {
  if (route.length <= 2) return route;
  const simplified = [route[0]];
  let index = 0;
  while (index < route.length - 1) {
    let next = route.length - 1;
    while (next > index + 1 && !segmentIsClear(world, route[index], route[next])) next -= 1;
    simplified.push(route[next]);
    index = next;
  }
  return simplified;
}

export function planAuditRoute(world: WorldState, start: ArenaPoint, target: ArenaPoint) {
  if (segmentIsClear(world, start, target)) return [start, target];
  const startGrid = nearestGridPoint(world, start);
  const targetGrid = nearestGridPoint(world, target);
  if (!startGrid || !targetGrid) return undefined;
  const startKey = pointKey(startGrid.grid.x, startGrid.grid.y);
  const targetKey = pointKey(targetGrid.grid.x, targetGrid.grid.y);
  const open = new MinHeap();
  const costs = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, string>();
  const visited = new Set<string>();
  open.push({ key: startKey, score: 0 });
  const neighbours = [-1, 0, 1].flatMap((x) => [-1, 0, 1]
    .filter((y) => x !== 0 || y !== 0)
    .map((y) => ({ x, y, cost: x && y ? Math.SQRT2 : 1 })));
  let iterations = 0;

  while (open.size && iterations < 40000) {
    iterations += 1;
    const current = open.pop()!;
    if (visited.has(current.key)) continue;
    if (current.key === targetKey) {
      const keys = [targetKey];
      while (previous.has(keys[keys.length - 1])) keys.push(previous.get(keys[keys.length - 1])!);
      keys.reverse();
      const route = [start, ...keys.map((key) => {
        const point = parseKey(key);
        return { x: point.x * GRID_SIZE, y: point.y * GRID_SIZE };
      }), target];
      return simplifyRoute(world, route);
    }
    visited.add(current.key);
    const point = parseKey(current.key);
    const currentCost = costs.get(current.key)!;

    for (const neighbour of neighbours) {
      const next = { x: point.x + neighbour.x, y: point.y + neighbour.y };
      const currentWorld = { x: point.x * GRID_SIZE, y: point.y * GRID_SIZE };
      const nextWorld = { x: next.x * GRID_SIZE, y: next.y * GRID_SIZE };
      if (!robotPositionIsClear(world, nextWorld.x, nextWorld.y)) continue;
      if (!segmentIsClear(world, currentWorld, nextWorld)) continue;
      const nextKey = pointKey(next.x, next.y);
      const nextCost = currentCost + neighbour.cost;
      if (nextCost >= (costs.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(nextKey, nextCost);
      previous.set(nextKey, current.key);
      const heuristic = Math.hypot(next.x - targetGrid.grid.x, next.y - targetGrid.grid.y);
      open.push({ key: nextKey, score: nextCost + heuristic });
    }
  }
  return undefined;
}

export function createArenaAutopilot(world: WorldState, driveMode: AuditDriveMode = "movement"): ArenaAutopilotState {
  const actions: AuditAction[] = [];
  for (const hazardId of world.layout.challenge.requiredHazards) {
    const hazard = world.layout.hazards.find((item) => item.id === hazardId);
    if (!hazard) return {
      status: "failed", driveMode, driveChecks: 0, lastDriveCommand: "", actions: [], actionIndex: 0, route: [], routeIndex: 0, holdElapsed: 0,
      message: "Falha de catálogo", error: `A etapa ${hazardId} não existe na arena.`,
    };
    const action = hazardAction(world, hazard);
    if (!action) return {
      status: "failed", driveMode, driveChecks: 0, lastDriveCommand: "", actions: [], actionIndex: 0, route: [], routeIndex: 0, holdElapsed: 0,
      message: "Alvo inalcançável", error: `Nenhuma posição válida permite concluir “${hazard.label}”.`,
    };
    actions.push(action);
  }
  const finish = goalAction(world);
  if (!finish) return {
    status: "failed", driveMode, driveChecks: 0, lastDriveCommand: "", actions, actionIndex: 0, route: [], routeIndex: 0, holdElapsed: 0,
    message: "Objetivo inalcançável", error: `Nenhuma posição válida permite concluir “${world.layout.challenge.goal.label}”.`,
  };
  actions.push(finish);
  return {
    status: "running",
    driveMode,
    driveChecks: 0,
    lastDriveCommand: "",
    actions,
    actionIndex: 0,
    route: [],
    routeIndex: 0,
    holdElapsed: 0,
    message: actions[0]?.label ?? "Preparando missão",
    error: "",
  };
}

function fail(state: ArenaAutopilotState, error: string) {
  state.status = "failed";
  state.error = error;
  state.message = "Auditoria interrompida nesta missão";
}

export function stepArenaAutopilot(
  world: WorldState,
  state: ArenaAutopilotState,
  delta: number,
  emit: (message: string, level?: LogLevel) => void = () => undefined,
) {
  if (state.status !== "running") return;
  if (world.success) {
    state.status = "passed";
    state.message = world.layout.challenge.successMessage;
    return;
  }
  if (world.competition.roundOver) {
    fail(state, world.competition.lastEvent);
    return;
  }

  const action = state.actions[state.actionIndex];
  if (!action) {
    fail(state, "O roteiro terminou sem a arena confirmar o objetivo.");
    return;
  }
  state.message = action.label;

  if (!state.route.length) {
    if (!verifyDriveBlocks(world, state)) return;
    const route = planAuditRoute(world, world.robot, action.pose);
    if (!route) {
      fail(state, `Não existe passagem física livre até “${action.label}”.`);
      return;
    }
    state.route = route;
    state.routeIndex = 1;
  }

  const routeTarget = state.route[state.routeIndex];
  if (routeTarget) {
    const dx = routeTarget.x - world.robot.x;
    const dy = routeTarget.y - world.robot.y;
    const distance = Math.hypot(dx, dy);
    const movement = Math.min(distance, MOVE_SPEED * delta);
    if (distance > 0.001) {
      world.robot.angle = Math.atan2(dy, dx);
      world.robot.x += dx / distance * movement;
      world.robot.y += dy / distance * movement;
    }
    world.robot.leftPower = 0;
    world.robot.rightPower = 0;
    advanceWorld(world, delta, emit);
    if (world.competition.collisionCount > 0 || world.competition.victimTouches > 0) {
      fail(state, `A rota automática colidiu em (${world.robot.x.toFixed(1)}, ${world.robot.y.toFixed(1)}) ao se aproximar de “${action.label}”.`);
      return;
    }
    if (movement >= distance - 0.001) state.routeIndex += 1;
    return;
  }

  world.robot.x = action.pose.x;
  world.robot.y = action.pose.y;
  world.robot.angle = action.pose.angle;
  world.robot.leftPower = 0;
  world.robot.rightPower = 0;
  state.holdElapsed += delta;
  advanceWorld(world, delta, emit);

  const actionComplete = action.kind === "goal"
    ? world.success
    : world.competition.scoredHazards.includes(action.id);
  if (actionComplete) {
    if (action.kind === "goal") {
      state.status = "passed";
      state.message = world.layout.challenge.successMessage;
      return;
    }
    state.actionIndex += 1;
    state.route = [];
    state.routeIndex = 0;
    state.holdElapsed = 0;
    return;
  }

  if (state.holdElapsed > action.holdSeconds + 1.5) {
    const ground = sensorColor(world, GROUND_SENSOR_PORT);
    fail(state, `“${action.label}” não confirmou após ${state.holdElapsed.toFixed(1)} s (sensor de chão: ${ground}; evento: ${world.competition.lastEvent}).`);
  }
}
