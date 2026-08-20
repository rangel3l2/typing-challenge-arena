export type SensorKind = "touch" | "gyro" | "color" | "ultrasonic";
export type SensorPort = "1" | "2" | "3" | "4";
export type MotorKind = "medium" | "large";
export type MotorPort = "A" | "B" | "C" | "D";
export type SensorPosition = "front-left" | "front-center" | "front-right" | "left" | "center" | "right" | "rear-left" | "rear-center" | "rear-right";
export type SensorAim = "ground" | "outward";

export interface SensorMount {
  position: SensorPosition;
  aim: SensorAim;
}

export interface HardwareConfig {
  motors: Record<MotorPort, MotorKind | null>;
  sensors: Record<SensorPort, SensorKind | null>;
  sensorMounts: Record<SensorPort, SensorMount | null>;
}

export interface SensorDefinition {
  kind: SensorKind;
  name: string;
  shortName: string;
  icon: string;
  colour: string;
  description: string;
  recommendedPort: SensorPort;
  blockNames: string;
}

export const SENSOR_PORTS: SensorPort[] = ["1", "2", "3", "4"];
export const MOTOR_PORTS: MotorPort[] = ["A", "B", "C", "D"];
export const SENSOR_POSITIONS: SensorPosition[] = ["front-left", "front-center", "front-right", "left", "center", "right", "rear-left", "rear-center", "rear-right"];

export const SENSOR_POSITION_DEFINITIONS: Record<SensorPosition, { name: string; shortName: string; x: number; y: number; angle: number }> = {
  "front-left": { name: "Frente esquerda", shortName: "Frente E", x: 29, y: -18, angle: 0 },
  "front-center": { name: "Frente central", shortName: "Frente", x: 32, y: 0, angle: 0 },
  "front-right": { name: "Frente direita", shortName: "Frente D", x: 29, y: 18, angle: 0 },
  left: { name: "Lateral esquerda", shortName: "Lado E", x: 0, y: -29, angle: -Math.PI / 2 },
  center: { name: "Centro do robô", shortName: "Centro", x: 0, y: 0, angle: 0 },
  right: { name: "Lateral direita", shortName: "Lado D", x: 0, y: 29, angle: Math.PI / 2 },
  "rear-left": { name: "Traseira esquerda", shortName: "Trás E", x: -29, y: -18, angle: Math.PI },
  "rear-center": { name: "Traseira central", shortName: "Trás", x: -32, y: 0, angle: Math.PI },
  "rear-right": { name: "Traseira direita", shortName: "Trás D", x: -29, y: 18, angle: Math.PI },
};

export const MOTOR_DEFINITIONS: Record<MotorKind, { name: string; shortName: string; description: string }> = {
  large: { name: "Motor servo grande", shortName: "Servo grande", description: "Mais torque para mover as rodas do robô." },
  medium: { name: "Motor servo médio", shortName: "Servo médio", description: "Mais compacto e rápido para acessórios." },
};

export const SENSOR_DEFINITIONS: Record<SensorKind, SensorDefinition> = {
  touch: {
    kind: "touch",
    name: "Sensor de toque",
    shortName: "Toque",
    icon: "●",
    colour: "#e9504f",
    description: "Percebe quando o robô encosta em algo.",
    recommendedPort: "1",
    blockNames: "pressionado e liberado",
  },
  gyro: {
    kind: "gyro",
    name: "Sensor giroscópio",
    shortName: "Giroscópio",
    icon: "↻",
    colour: "#f0a72b",
    description: "Mede o ângulo e a velocidade da curva.",
    recommendedPort: "2",
    blockNames: "ângulo e velocidade angular",
  },
  color: {
    kind: "color",
    name: "Sensor de cor e luz",
    shortName: "Cor e luz",
    icon: "◉",
    colour: "#31a7d5",
    description: "Reconhece cores e a intensidade da luz.",
    recommendedPort: "3",
    blockNames: "cor, luz refletida e ambiente",
  },
  ultrasonic: {
    kind: "ultrasonic",
    name: "Sensor de distância",
    shortName: "Distância",
    icon: "◔",
    colour: "#6b7c91",
    description: "Enxerga obstáculos usando ultrassom.",
    recommendedPort: "4",
    blockNames: "distância em centímetros",
  },
};

export const DEFAULT_HARDWARE: HardwareConfig = {
  motors: { A: "medium", B: "large", C: "large", D: "medium" },
  sensors: { "1": "touch", "2": "gyro", "3": "color", "4": "ultrasonic" },
  sensorMounts: {
    "1": { position: "front-center", aim: "outward" },
    "2": { position: "center", aim: "outward" },
    "3": { position: "front-left", aim: "ground" },
    "4": { position: "front-right", aim: "outward" },
  },
};

export const EMPTY_HARDWARE: HardwareConfig = {
  motors: { A: null, B: null, C: null, D: null },
  sensors: { "1": null, "2": null, "3": null, "4": null },
  sensorMounts: { "1": null, "2": null, "3": null, "4": null },
};

export function cloneHardware(config: HardwareConfig): HardwareConfig {
  return {
    motors: { ...config.motors },
    sensors: { ...config.sensors },
    sensorMounts: Object.fromEntries(SENSOR_PORTS.map((port) => [port, config.sensorMounts[port] ? { ...config.sensorMounts[port] } : null])) as HardwareConfig["sensorMounts"],
  };
}

export function createLineFollowerHardware(base: HardwareConfig = DEFAULT_HARDWARE): HardwareConfig {
  const config = cloneHardware(base);
  config.motors.B = "large";
  config.motors.C = "large";
  config.sensors["4"] = "color";
  config.sensorMounts["4"] = { position: "front-left", aim: "ground" };
  config.sensors["2"] = "color";
  config.sensorMounts["2"] = { position: "front-right", aim: "ground" };
  return config;
}

export function defaultSensorMount(kind: SensorKind, port: SensorPort): SensorMount {
  const positions: Record<SensorPort, SensorPosition> = { "1": "front-center", "2": "center", "3": "front-left", "4": "front-right" };
  return { position: positions[port], aim: kind === "color" ? "ground" : "outward" };
}

export function normalizeHardware(value: unknown): HardwareConfig {
  if (!value || typeof value !== "object") return cloneHardware(DEFAULT_HARDWARE);
  const candidate = value as Partial<HardwareConfig>;
  const validSensors = new Set<SensorKind>(["touch", "gyro", "color", "ultrasonic"]);
  const validPositions = new Set<SensorPosition>(SENSOR_POSITIONS);
  const candidateMotors = candidate.motors as unknown as Record<string, unknown> | undefined;
  const legacyMotors = candidateMotors && ("left" in candidateMotors || "right" in candidateMotors);
  const validMotors = new Set<MotorKind>(["medium", "large"]);
  const sensors = Object.fromEntries(SENSOR_PORTS.map((port) => {
    const sensor = candidate.sensors?.[port];
    return [port, sensor && validSensors.has(sensor) ? sensor : null];
  })) as HardwareConfig["sensors"];
  return {
    motors: legacyMotors
      ? { A: "medium", B: candidateMotors?.left === false ? null : "large", C: candidateMotors?.right === false ? null : "large", D: "medium" }
      : Object.fromEntries(MOTOR_PORTS.map((port) => {
          const motor = candidateMotors?.[port];
          return [port, typeof motor === "string" && validMotors.has(motor as MotorKind) ? motor : null];
        })) as HardwareConfig["motors"],
    sensors,
    sensorMounts: Object.fromEntries(SENSOR_PORTS.map((port) => {
      const sensor = sensors[port];
      const mount = candidate.sensorMounts?.[port];
      if (!sensor) return [port, null];
      if (mount && validPositions.has(mount.position) && (mount.aim === "ground" || mount.aim === "outward")) return [port, { position: mount.position, aim: mount.aim }];
      return [port, defaultSensorMount(sensor, port)];
    })) as HardwareConfig["sensorMounts"],
  };
}

export function isRobotReady(config: HardwareConfig) {
  return MOTOR_PORTS.filter((port) => config.motors[port]).length >= 2;
}

export function isRobotComplete(config: HardwareConfig) {
  return MOTOR_PORTS.every((port) => config.motors[port]) && SENSOR_PORTS.every((port) => config.sensors[port]);
}

export function hardwareCount(config: HardwareConfig) {
  return MOTOR_PORTS.filter((port) => config.motors[port]).length + SENSOR_PORTS.filter((port) => config.sensors[port]).length;
}
