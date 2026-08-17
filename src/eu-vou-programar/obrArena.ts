export interface ArenaPoint { x: number; y: number }
export interface ArenaRect { x: number; y: number; width: number; height: number }

export type ArenaLevel = "easy" | "medium" | "hard";
export type OBRHazardKind = "gap" | "bump" | "ramp" | "intersection" | "obstacle" | "passage";
export type GreenRule = "left" | "right" | "straight" | "dead-end";

export interface OBRGreenMarker extends ArenaRect {
  id: string;
  rule: GreenRule;
}

export interface OBRHazard {
  id: string;
  kind: OBRHazardKind;
  label: string;
  points: number;
  x: number;
  y: number;
  radius: number;
  requiredHeading?: number;
  rect?: ArenaRect;
}

export interface OBRStart extends ArenaPoint {
  angle: number;
}

export interface OBRLayout {
  id: string;
  name: string;
  level: ArenaLevel;
  mainPath: ArenaPoint[];
  exitPath: ArenaPoint[];
  branches: ArenaPoint[][];
  gaps: ArenaRect[];
  greenMarkers: OBRGreenMarker[];
  hazards: OBRHazard[];
  start: OBRStart;
  obstacle?: ArenaRect;
  rescueRoom: ArenaRect;
  silverGate: ArenaRect;
  blackGate: ArenaRect;
  finishStripe: ArenaRect;
}

export const OBR_TILE_SIZE = 100;

const common = {
  rescueRoom: { x: 650, y: 55, width: 280, height: 285 },
  silverGate: { x: 642, y: 195, width: 16, height: 50 },
  blackGate: { x: 790, y: 332, width: 50, height: 16 },
  finishStripe: { x: 670, y: 488, width: 16, height: 44 },
  exitPath: [{ x: 815, y: 340 }, { x: 815, y: 510 }, { x: 680, y: 510 }],
};

const easyLayouts: OBRLayout[] = [
  {
    ...common,
    id: "facil-curvas-a",
    name: "Fácil - Curvas variadas",
    level: "easy",
    mainPath: [{ x: 70, y: 510 }, { x: 165, y: 510 }, { x: 220, y: 455 }, { x: 220, y: 385 }, { x: 285, y: 330 }, { x: 365, y: 330 }, { x: 425, y: 275 }, { x: 505, y: 275 }, { x: 570, y: 220 }, { x: 650, y: 220 }],
    branches: [], gaps: [], greenMarkers: [], hazards: [],
    start: { x: 70, y: 510, angle: 0 },
  },
  {
    ...common,
    id: "facil-curvas-b",
    name: "Fácil - Curvas em sequência",
    level: "easy",
    mainPath: [{ x: 70, y: 510 }, { x: 145, y: 510 }, { x: 195, y: 465 }, { x: 195, y: 390 }, { x: 270, y: 390 }, { x: 335, y: 325 }, { x: 420, y: 325 }, { x: 485, y: 260 }, { x: 565, y: 260 }, { x: 610, y: 220 }, { x: 650, y: 220 }],
    branches: [], gaps: [], greenMarkers: [], hazards: [],
    start: { x: 70, y: 510, angle: 0 },
  },
];

const mediumLayouts: OBRLayout[] = [
  {
    ...common,
    id: "medio-obstaculo-a",
    name: "Médio - Curvas, gap e obstáculo",
    level: "medium",
    mainPath: [{ x: 70, y: 510 }, { x: 185, y: 510 }, { x: 235, y: 465 }, { x: 185, y: 420 }, { x: 235, y: 375 }, { x: 190, y: 335 }, { x: 300, y: 330 }, { x: 445, y: 330 }, { x: 525, y: 220 }, { x: 650, y: 220 }],
    branches: [], gaps: [{ x: 115, y: 497, width: 40, height: 26 }], greenMarkers: [],
    obstacle: { x: 455, y: 286, width: 38, height: 54 },
    hazards: [
      { id: "gap-medium-a", kind: "gap", label: "Gap superado", points: 10, x: 175, y: 510, radius: 27 },
      { id: "obstacle-medium-a", kind: "obstacle", label: "Obstáculo desviado", points: 20, x: 525, y: 250, radius: 42 },
    ],
    start: { x: 70, y: 510, angle: 0 },
  },
  {
    ...common,
    id: "medio-obstaculo-b",
    name: "Médio - Zigue-zague com gap",
    level: "medium",
    mainPath: [{ x: 70, y: 510 }, { x: 175, y: 510 }, { x: 225, y: 465 }, { x: 175, y: 420 }, { x: 225, y: 375 }, { x: 180, y: 335 }, { x: 300, y: 300 }, { x: 455, y: 300 }, { x: 455, y: 220 }, { x: 650, y: 220 }],
    branches: [], gaps: [{ x: 110, y: 497, width: 42, height: 26 }], greenMarkers: [],
    obstacle: { x: 505, y: 196, width: 42, height: 48 },
    hazards: [
      { id: "gap-medium-b", kind: "gap", label: "Gap superado", points: 10, x: 170, y: 510, radius: 27 },
      { id: "obstacle-medium-b", kind: "obstacle", label: "Obstáculo desviado", points: 20, x: 565, y: 220, radius: 40 },
    ],
    start: { x: 70, y: 510, angle: 0 },
  },
];

const hardLayouts: OBRLayout[] = [
  {
    ...common,
    id: "avancado-verdes-a",
    name: "Avançado - Sinais verdes completos",
    level: "hard",
    mainPath: [{ x: 70, y: 510 }, { x: 220, y: 510 }, { x: 220, y: 420 }, { x: 500, y: 420 }, { x: 500, y: 300 }, { x: 545, y: 300 }, { x: 595, y: 220 }, { x: 650, y: 220 }],
    branches: [
      [{ x: 220, y: 510 }, { x: 305, y: 510 }],
      [{ x: 220, y: 420 }, { x: 220, y: 350 }],
      [{ x: 390, y: 420 }, { x: 390, y: 340 }],
      [{ x: 330, y: 340 }, { x: 450, y: 340 }],
    ],
    gaps: [{ x: 115, y: 497, width: 38, height: 26 }],
    greenMarkers: [
      { id: "green-left-a", rule: "left", x: 203, y: 493, width: 13, height: 13 },
      { id: "green-right-a", rule: "right", x: 224, y: 424, width: 13, height: 13 },
      { id: "green-straight-a", rule: "straight", x: 394, y: 403, width: 13, height: 13 },
      { id: "green-dead-left-a", rule: "dead-end", x: 373, y: 344, width: 13, height: 13 },
      { id: "green-dead-right-a", rule: "dead-end", x: 394, y: 344, width: 13, height: 13 },
    ],
    hazards: [
      { id: "gap-hard-a", kind: "gap", label: "Gap superado", points: 10, x: 172, y: 510, radius: 27 },
      { id: "green-left-rule-a", kind: "intersection", label: "Curva verde à esquerda concluída", points: 10, x: 220, y: 470, radius: 24, requiredHeading: -Math.PI / 2 },
      { id: "green-right-rule-a", kind: "intersection", label: "Curva verde à direita concluída", points: 10, x: 260, y: 420, radius: 24, requiredHeading: 0 },
      { id: "green-straight-rule-a", kind: "intersection", label: "Interseção reta concluída", points: 10, x: 430, y: 420, radius: 24, requiredHeading: 0 },
      { id: "green-dead-end-a", kind: "intersection", label: "Retorno do beco sem saída concluído", points: 10, x: 390, y: 380, radius: 24, requiredHeading: Math.PI / 2 },
      { id: "bump-hard-a", kind: "bump", label: "Lombada superada", points: 10, x: 545, y: 300, radius: 31 },
    ],
    start: { x: 70, y: 510, angle: 0 },
  },
  {
    ...common,
    id: "avancado-verdes-b",
    name: "Avançado - Cruzamentos e beco",
    level: "hard",
    mainPath: [{ x: 70, y: 510 }, { x: 180, y: 510 }, { x: 180, y: 390 }, { x: 500, y: 390 }, { x: 500, y: 300 }, { x: 575, y: 220 }, { x: 650, y: 220 }],
    branches: [
      [{ x: 180, y: 510 }, { x: 275, y: 510 }],
      [{ x: 180, y: 390 }, { x: 180, y: 320 }],
      [{ x: 350, y: 390 }, { x: 350, y: 305 }],
      [{ x: 290, y: 305 }, { x: 410, y: 305 }],
    ],
    gaps: [{ x: 110, y: 497, width: 40, height: 26 }],
    greenMarkers: [
      { id: "green-left-b", rule: "left", x: 163, y: 493, width: 13, height: 13 },
      { id: "green-right-b", rule: "right", x: 184, y: 394, width: 13, height: 13 },
      { id: "green-straight-b", rule: "straight", x: 354, y: 373, width: 13, height: 13 },
      { id: "green-dead-left-b", rule: "dead-end", x: 333, y: 309, width: 13, height: 13 },
      { id: "green-dead-right-b", rule: "dead-end", x: 354, y: 309, width: 13, height: 13 },
    ],
    hazards: [
      { id: "gap-hard-b", kind: "gap", label: "Gap superado", points: 10, x: 168, y: 510, radius: 27 },
      { id: "green-left-rule-b", kind: "intersection", label: "Curva verde à esquerda concluída", points: 10, x: 180, y: 470, radius: 24, requiredHeading: -Math.PI / 2 },
      { id: "green-right-rule-b", kind: "intersection", label: "Curva verde à direita concluída", points: 10, x: 220, y: 390, radius: 24, requiredHeading: 0 },
      { id: "green-straight-rule-b", kind: "intersection", label: "Interseção reta concluída", points: 10, x: 390, y: 390, radius: 24, requiredHeading: 0 },
      { id: "green-dead-end-b", kind: "intersection", label: "Retorno do beco sem saída concluído", points: 10, x: 350, y: 350, radius: 24, requiredHeading: Math.PI / 2 },
      { id: "bump-hard-b", kind: "bump", label: "Lombada superada", points: 10, x: 540, y: 260, radius: 31 },
    ],
    start: { x: 70, y: 510, angle: 0 },
  },
];

const layoutsByLevel: Record<ArenaLevel, OBRLayout[]> = { easy: easyLayouts, medium: mediumLayouts, hard: hardLayouts };
const nextLayout: Record<ArenaLevel, number> = { easy: 0, medium: 0, hard: 0 };

export function createOBRLayout(layoutIndex?: number, level: ArenaLevel = "easy"): OBRLayout {
  const layouts = layoutsByLevel[level];
  const index = layoutIndex === undefined ? nextLayout[level]++ % layouts.length : Math.abs(layoutIndex) % layouts.length;
  return structuredClone(layouts[index]);
}
