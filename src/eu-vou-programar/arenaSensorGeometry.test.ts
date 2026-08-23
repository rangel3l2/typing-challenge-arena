import { describe, expect, it } from "vitest";
import { cloneHardware, EMPTY_HARDWARE } from "./hardware";
import { ARENA_CHALLENGE_COUNT, createOBRLayout } from "./obrArena";
import type { ArenaLevel, ArenaPoint, ArenaRect, OBRLayout } from "./obrArena";
import { arenaColorAt, createWorld, sensorColor } from "./simulator";

const LEVELS: ArenaLevel[] = ["beginner", "easy", "medium", "hard"];
const MIN_FLOOR_MARKER_SIZE = 40;
const MIN_GREEN_MARKER_SIZE = 20;
const DUAL_SENSOR_STATION_SPAN = 80;
const GROUND_SENSOR_POINTS = [{ x: 41, y: -18 }, { x: 41, y: 18 }];

function layouts() {
  return LEVELS.flatMap((level) => Array.from(
    { length: ARENA_CHALLENGE_COUNT },
    (_, index) => createOBRLayout(index, level),
  ));
}

function rectangleContains(rectangle: ArenaRect, point: ArenaPoint) {
  return point.x >= rectangle.x && point.x <= rectangle.x + rectangle.width
    && point.y >= rectangle.y && point.y <= rectangle.y + rectangle.height;
}

function sensorPoints(robot: ArenaPoint, angle: number) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return GROUND_SENSOR_POINTS.map((point) => ({
    x: robot.x + point.x * cosine - point.y * sine,
    y: robot.y + point.x * sine + point.y * cosine,
  }));
}

function coursePaths(layout: OBRLayout) {
  return [layout.mainPath, layout.exitPath, ...layout.branches].filter((path) => path.length >= 2);
}

function readableFromCourse(layout: OBRLayout, rectangle: ArenaRect, requireBoth = false) {
  for (const path of coursePaths(layout)) {
    for (let index = 1; index < path.length; index += 1) {
      for (const [start, end] of [[path[index - 1], path[index]], [path[index], path[index - 1]]] as const) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (!length) continue;
        const unitX = dx / length;
        const unitY = dy / length;
        const angle = Math.atan2(dy, dx);

        for (let distance = -50; distance <= length + 50; distance += 1) {
          const points = sensorPoints({ x: start.x + unitX * distance, y: start.y + unitY * distance }, angle);
          const detected = points.map((point) => rectangleContains(rectangle, point));
          if (requireBoth ? detected.every(Boolean) : detected.some(Boolean)) return true;
        }
      }
    }
  }
  return false;
}

function markerCentre(marker: ArenaRect) {
  return { x: marker.x + marker.width / 2, y: marker.y + marker.height / 2 };
}

function distanceToSegment(point: ArenaPoint, start: ArenaPoint, end: ArenaPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + amount * dx), point.y - (start.y + amount * dy));
}

function distanceToCourse(layout: OBRLayout, point: ArenaPoint) {
  return Math.min(...coursePaths(layout).flatMap((path) => path.slice(1)
    .map((end, index) => distanceToSegment(point, path[index], end))));
}

function readableWhileInsideGoal(layout: OBRLayout, rectangle: ArenaRect) {
  const goal = layout.challenge.goal;
  const angles = goal.requiredHeading === undefined
    ? Array.from({ length: 16 }, (_, index) => index * Math.PI / 8)
    : [goal.requiredHeading];

  for (const angle of angles) {
    for (let x = goal.x - goal.radius; x <= goal.x + goal.radius; x += 2) {
      for (let y = goal.y - goal.radius; y <= goal.y + goal.radius; y += 2) {
        if (Math.hypot(x - goal.x, y - goal.y) > goal.radius) continue;
        if (sensorPoints({ x, y }, angle).some((point) => rectangleContains(rectangle, point))) return true;
      }
    }
  }
  return false;
}

describe("geometria das arenas para os sensores do EV3", () => {
  it("mantém todas as marcações de chão grandes o bastante para uma leitura confiável", () => {
    const undersized = layouts().flatMap((layout) => layout.floorMarkers
      .filter((marker) => marker.width < MIN_FLOOR_MARKER_SIZE || marker.height < MIN_FLOOR_MARKER_SIZE)
      .map((marker) => `${layout.id}/${marker.id}:${marker.width}x${marker.height}`));

    expect(undersized).toEqual([]);
  });

  it("mantém as marcações sobre a pista ao alcance de pelo menos um sensor", () => {
    const unreachable = layouts().flatMap((layout) => layout.floorMarkers
      .filter((marker) => distanceToCourse(layout, markerCentre(marker)) <= 30 && !readableFromCourse(layout, marker))
      .map((marker) => `${layout.id}/${marker.id}`));

    expect(unreachable).toEqual([]);
  });

  it("permite ler a cor do objetivo sem deixar a área válida de parada", () => {
    const unreachable = layouts().flatMap((layout) => layout.floorMarkers
      .filter((marker) => {
        const centre = markerCentre(marker);
        return Math.hypot(centre.x - layout.challenge.goal.x, centre.y - layout.challenge.goal.y) < 2
          && !readableWhileInsideGoal(layout, marker);
      })
      .map((marker) => `${layout.id}/${marker.id}`));

    expect(unreachable).toEqual([]);
  });

  it("mantém os sinais verdes visíveis e alcançáveis pelos sensores seguindo a pista", () => {
    const invalid = layouts().flatMap((layout) => layout.greenMarkers
      .filter((marker) => marker.width < MIN_GREEN_MARKER_SIZE
        || marker.height < MIN_GREEN_MARKER_SIZE
        || !readableFromCourse(layout, marker))
      .map((marker) => `${layout.id}/${marker.id}:${marker.width}x${marker.height}`));

    expect(invalid).toEqual([]);
  });

  it("mantém os gaps largos o bastante para saírem da leitura da linha preta", () => {
    const undersized = layouts().flatMap((layout) => layout.gaps
      .filter((gap) => gap.width < MIN_FLOOR_MARKER_SIZE
        || gap.height < MIN_FLOOR_MARKER_SIZE
        || !readableFromCourse(layout, gap))
      .map((gap, index) => `${layout.id}/gap-${index + 1}:${gap.width}x${gap.height}`));

    expect(undersized).toEqual([]);
  });

  it("dá margem para os dois sensores nas estações vermelhas finais", () => {
    const invalid: string[] = [];

    for (const layout of layouts()) {
      const goal = layout.challenge.goal;
      const redGoalMarkers = layout.floorMarkers.filter((marker) => {
        const centre = markerCentre(marker);
        return marker.colour === "vermelho" && Math.hypot(centre.x - goal.x, centre.y - goal.y) < 2;
      });
      for (const marker of redGoalMarkers) {
        if (Math.max(marker.width, marker.height) < DUAL_SENSOR_STATION_SPAN
          || !readableFromCourse(layout, marker, true)) invalid.push(`${layout.id}/${marker.id}:${marker.width}x${marker.height}`);
      }

      if (layout.finishStripe.width > 0 && layout.finishStripe.height > 0) {
        if (Math.max(layout.finishStripe.width, layout.finishStripe.height) < DUAL_SENSOR_STATION_SPAN
          || !readableFromCourse(layout, layout.finishStripe, true)) {
          invalid.push(`${layout.id}/finish:${layout.finishStripe.width}x${layout.finishStripe.height}`);
        }
      }
    }

    expect(invalid).toEqual([]);
  });

  it("mantém faixas e estações obrigatórias na cor realmente cobrada pela missão", () => {
    const invalid: string[] = [];

    for (const level of LEVELS) {
      for (let index = 0; index < ARENA_CHALLENGE_COUNT; index += 1) {
        const layout = createOBRLayout(index, level);
        const world = createWorld(EMPTY_HARDWARE, index, level);
        for (const hazard of layout.hazards.filter((item) => item.requiredColour && item.kind !== "sensor-gate")) {
          if (arenaColorAt(world, hazard.x, hazard.y) !== hazard.requiredColour) invalid.push(`${layout.id}/${hazard.id}`);
        }
        const goal = layout.challenge.goal;
        if (goal.requiredColour && arenaColorAt(world, goal.x, goal.y) !== goal.requiredColour) invalid.push(`${layout.id}/goal`);
      }
    }

    expect(invalid).toEqual([]);
  });

  it("permite que os dois sensores laterais leiam todos os portais", () => {
    const hardware = cloneHardware(EMPTY_HARDWARE);
    hardware.sensors["1"] = "color";
    hardware.sensorMounts["1"] = { position: "left", aim: "outward" };
    hardware.sensors["2"] = "color";
    hardware.sensorMounts["2"] = { position: "right", aim: "outward" };
    const invalid: string[] = [];

    for (const level of LEVELS) {
      for (let index = 0; index < ARENA_CHALLENGE_COUNT; index += 1) {
        const layout = createOBRLayout(index, level);
        const world = createWorld(hardware, index, level);
        for (const portal of layout.hazards.filter((hazard) => hazard.kind === "sensor-gate")) {
          world.robot.x = portal.x;
          world.robot.y = portal.y;
          world.robot.angle = portal.requiredHeading ?? 0;
          const expected = portal.requiredColour ?? "vermelho";
          if (sensorColor(world, "1") !== expected || sensorColor(world, "2") !== expected) invalid.push(`${layout.id}/${portal.id}`);
        }
      }
    }

    expect(invalid).toEqual([]);
  });
});
