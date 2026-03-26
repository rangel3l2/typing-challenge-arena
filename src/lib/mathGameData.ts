import type { BalloonDirection } from "@/components/Balloon";

export type Operator = '+' | '-' | '×';

export interface BalloonItem {
  id: number;
  label: string;
  type: 'number' | 'operator';
  value: number | Operator;
  direction: BalloonDirection;
  startX: number;
  startY: number;
  swayAmount: number;
  swaySpeed: number;
  speedMultiplier: number;
  waveIndex: number;
  /** Bézier curve amplitude – how much the path bends perpendicular to travel */
  curveAmplitude: number;
  /** Phase offset (radians) for the sine perturbation layered on top */
  sinePhase: number;
  /** Sine frequency multiplier for organic wobble */
  sineFreq: number;
  /** Delay in ms within the wave so balloons don't launch at exact same instant */
  staggerMs: number;
}

export interface AnswerBalloon {
  id: number;
  label: string;
  value: number;
  direction: BalloonDirection;
  startX: number;
  startY: number;
  swayAmount: number;
  swaySpeed: number;
  speedMultiplier: number;
  curveAmplitude: number;
  sinePhase: number;
  sineFreq: number;
  staggerMs: number;
}

function evaluate(a: number, b: number, op: Operator): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
  }
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

// ─── Advanced Flight Physics ───────────────────────────────────────────
// Balloons come from bottom, left, and right (never from above).
// Each balloon gets a Bézier-curved path with sine perturbation for organic motion.
// Within each wave, balloons are placed in non-overlapping "lanes" along the
// perpendicular axis to their travel direction, guaranteeing ≥50% overlap-free travel.

/** Weighted random direction: 50% up, 25% left-to-right, 25% right-to-left */
function randomDirection(): BalloonDirection {
  const r = Math.random();
  if (r < 0.50) return 'up';
  if (r < 0.75) return 'right'; // enters from left, moves right
  return 'left';                // enters from right, moves left
}

/**
 * Distribute `count` items into evenly-spaced lanes within [min, max].
 * Each lane gets a small random jitter so positions look natural but never overlap.
 * The minimum guaranteed gap ≈ laneWidth * 0.6 (enough to keep balloons apart for ≥50% of travel).
 */
function assignLanes(count: number, min: number, max: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.round((min + max) / 2 + randFloat(-3, 3))];
  const laneWidth = (max - min) / count;
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    const center = min + laneWidth * (i + 0.5);
    // Jitter up to ±15% of lane width keeps balloons within their lane
    const jitter = randFloat(-laneWidth * 0.15, laneWidth * 0.15);
    positions.push(Math.round(Math.max(min, Math.min(max, center + jitter))));
  }
  return shuffle(positions);
}

/** Generate organic flight parameters for a single balloon */
function generateFlightParams(direction: BalloonDirection, lanePos: number) {
  // Perpendicular sway (sine wobble layered on the Bézier curve)
  const swayAmount = randFloat(8, 20);
  const swaySpeed = randFloat(2.5, 5);

  // Speed variation: not too extreme so spacing holds
  const speedMultiplier = randFloat(0.82, 1.18);

  // Bézier curve amplitude: how far the path bends (in %) perpendicular to travel
  const curveAmplitude = randFloat(5, 18) * (Math.random() > 0.5 ? 1 : -1);

  // Sine perturbation params for micro-wobble
  const sinePhase = randFloat(0, Math.PI * 2);
  const sineFreq = randFloat(1.5, 3.5);

  let startX: number, startY: number;

  if (direction === 'up') {
    startX = lanePos;             // lane assigns horizontal position
    startY = randInt(-18, -8);    // starts below screen
  } else if (direction === 'left') {
    // Enters from right edge, travels left
    startX = 105;                 // off-screen right
    startY = lanePos;             // lane assigns vertical position
  } else {
    // Enters from left edge, travels right
    startX = -10;                 // off-screen left
    startY = lanePos;             // lane assigns vertical position
  }

  return { startX, startY, swayAmount, swaySpeed, speedMultiplier, curveAmplitude, sinePhase, sineFreq };
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Get max number value for a given phase (1-based). Phase 1 = 30, Phase 2 = 70, etc. */
export function getMaxValueForPhase(phase: number): number {
  return 30 + (phase - 1) * 40;
}

/** Generate 18 balloons: 12 numbers + 6 operators, spawned in waves of ~4 */
export function generatePhaseBalloons(phase: number): BalloonItem[] {
  const maxVal = getMaxValueForPhase(phase);
  const items: BalloonItem[] = [];
  let id = 0;

  // 12 unique numbers
  const usedNums = new Set<number>();
  const numbers: number[] = [];
  while (numbers.length < 12) {
    const n = randInt(1, maxVal);
    if (!usedNums.has(n)) {
      usedNums.add(n);
      numbers.push(n);
    }
  }
  shuffle(numbers);

  // 6 operators: 2 of each
  const operators: Operator[] = shuffle(['+', '+', '-', '-', '×', '×']);

  const allItems: { label: string; type: 'number' | 'operator'; value: number | Operator }[] = [];
  let numIdx = 0;
  let opIdx = 0;
  for (let i = 0; i < 6; i++) {
    allItems.push({ label: String(numbers[numIdx]), type: 'number', value: numbers[numIdx] });
    numIdx++;
    allItems.push({ label: String(numbers[numIdx]), type: 'number', value: numbers[numIdx] });
    numIdx++;
    allItems.push({ label: operators[opIdx], type: 'operator', value: operators[opIdx] });
    opIdx++;
  }

  shuffle(allItems);

  const ITEMS_PER_WAVE = 4;

  // Group into waves and assign directions + lanes per wave
  const totalWaves = Math.ceil(allItems.length / ITEMS_PER_WAVE);
  for (let w = 0; w < totalWaves; w++) {
    const waveItems = allItems.slice(w * ITEMS_PER_WAVE, (w + 1) * ITEMS_PER_WAVE);

    // Decide directions for this wave's balloons
    const directions: BalloonDirection[] = waveItems.map(() => randomDirection());

    // Group by direction to assign lanes per direction axis
    const byDir: Record<BalloonDirection, number[]> = { up: [], left: [], right: [] };
    directions.forEach((d, i) => byDir[d].push(i));

    // Assign lanes: 'up' gets horizontal lanes, 'left'/'right' get vertical lanes
    const upLanes = assignLanes(byDir.up.length, 8, 88);
    const leftLanes = assignLanes(byDir.left.length, 15, 75);
    const rightLanes = assignLanes(byDir.right.length, 15, 75);

    let upIdx = 0, leftIdx = 0, rightIdx = 0;

    for (let i = 0; i < waveItems.length; i++) {
      const dir = directions[i];
      let lanePos: number;
      if (dir === 'up') lanePos = upLanes[upIdx++];
      else if (dir === 'left') lanePos = leftLanes[leftIdx++];
      else lanePos = rightLanes[rightIdx++];

      const flight = generateFlightParams(dir, lanePos);
      const item = waveItems[i];

      items.push({
        id: id++,
        label: item.label,
        type: item.type,
        value: item.value,
        direction: dir,
        startX: flight.startX,
        startY: flight.startY,
        swayAmount: flight.swayAmount,
        swaySpeed: flight.swaySpeed,
        speedMultiplier: flight.speedMultiplier,
        curveAmplitude: flight.curveAmplitude,
        sinePhase: flight.sinePhase,
        sineFreq: flight.sineFreq,
        waveIndex: w,
        // Stagger within wave: 0–600ms offset so they don't launch simultaneously
        staggerMs: i * randInt(100, 200),
      });
    }
  }

  return items;
}

/** Generate answer balloons for the answer screen: 1 correct + 3 distractions */
export function generateAnswerBalloons(correctAnswer: number, count: number = 4): AnswerBalloon[] {
  const values = new Set<number>([correctAnswer]);
  const range = Math.max(10, Math.abs(correctAnswer));

  while (values.size < count) {
    const offset = randInt(1, range);
    const wrong = correctAnswer + (Math.random() > 0.5 ? offset : -offset);
    if (wrong !== correctAnswer && wrong >= 0) values.add(wrong);
  }

  const valuesArr = shuffle(Array.from(values));

  // Assign directions and lanes
  const directions: BalloonDirection[] = valuesArr.map(() => randomDirection());
  const byDir: Record<BalloonDirection, number[]> = { up: [], left: [], right: [] };
  directions.forEach((d, i) => byDir[d].push(i));

  const upLanes = assignLanes(byDir.up.length, 10, 85);
  const leftLanes = assignLanes(byDir.left.length, 20, 70);
  const rightLanes = assignLanes(byDir.right.length, 20, 70);
  let upIdx = 0, leftIdx = 0, rightIdx = 0;

  return valuesArr.map((val, idx) => {
    const dir = directions[idx];
    let lanePos: number;
    if (dir === 'up') lanePos = upLanes[upIdx++];
    else if (dir === 'left') lanePos = leftLanes[leftIdx++];
    else lanePos = rightLanes[rightIdx++];

    const flight = generateFlightParams(dir, lanePos);
    return {
      id: idx,
      label: String(val),
      value: val,
      direction: dir,
      startX: flight.startX,
      startY: flight.startY,
      swayAmount: flight.swayAmount,
      swaySpeed: flight.swaySpeed,
      speedMultiplier: flight.speedMultiplier,
      curveAmplitude: flight.curveAmplitude,
      sinePhase: flight.sinePhase,
      sineFreq: flight.sineFreq,
      staggerMs: idx * randInt(120, 250),
    };
  });
}

/** Check if a selection of 3 items is a valid trio: exactly 2 numbers + 1 operator */
export function isValidTrio(items: BalloonItem[]): boolean {
  if (items.length !== 3) return false;
  const numCount = items.filter(i => i.type === 'number').length;
  const opCount = items.filter(i => i.type === 'operator').length;
  return numCount === 2 && opCount === 1;
}

/** Compute result from a valid trio */
export function computeFromTrio(items: BalloonItem[]): { num1: number; num2: number; operator: Operator; answer: number } | null {
  if (!isValidTrio(items)) return null;
  const nums = items.filter(i => i.type === 'number').map(i => i.value as number);
  const op = items.find(i => i.type === 'operator')!.value as Operator;
  return { num1: nums[0], num2: nums[1], operator: op, answer: evaluate(nums[0], nums[1], op) };
}

/** Speed levels for balloon travel duration */
export const SPEED_LEVELS = [
  { level: 1, label: 'Devagar', durationMs: 14000 },
  { level: 2, label: 'Normal', durationMs: 11000 },
  { level: 3, label: 'Rápido', durationMs: 8500 },
  { level: 4, label: 'Muito Rápido', durationMs: 6500 },
  { level: 5, label: 'Ultra', durationMs: 4500 },
  { level: 6, label: 'Insano!', durationMs: 3000 },
];

/** Delay in seconds between waves */
export const WAVE_DELAY = 2.5;
