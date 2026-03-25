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

function randomDirection(): BalloonDirection {
  const dirs: BalloonDirection[] = ['up', 'up', 'up', 'left', 'right'];
  return dirs[randInt(0, dirs.length - 1)];
}

function randomBalloonMovement(direction: BalloonDirection) {
  const swayAmount = randFloat(6, 18);
  const swaySpeed = randFloat(2, 5);
  const speedMultiplier = randFloat(0.7, 1.3);

  if (direction === 'up') {
    return { startX: randInt(12, 72), startY: randInt(-15, -5), swayAmount, swaySpeed, speedMultiplier };
  } else if (direction === 'left') {
    return { startX: 0, startY: randInt(25, 65), swayAmount, swaySpeed, speedMultiplier };
  } else {
    return { startX: 0, startY: randInt(25, 65), swayAmount, swaySpeed, speedMultiplier };
  }
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
  const ops: Operator[] = ['+', '-', '×'];
  const items: BalloonItem[] = [];
  let id = 0;

  function makeBalloon(label: string, type: 'number' | 'operator', value: number | Operator, wave: number): BalloonItem {
    const dir = randomDirection();
    const mov = randomBalloonMovement(dir);
    return {
      id: id++, label, type, value,
      direction: dir,
      startX: mov.startX, startY: mov.startY,
      swayAmount: mov.swayAmount, swaySpeed: mov.swaySpeed,
      speedMultiplier: mov.speedMultiplier,
      waveIndex: wave,
    };
  }

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

  // Distribute into waves of ~4 (total 18 → 5 waves: 4+4+4+4+2 or similar)
  // Mix numbers and operators in each wave
  // We'll interleave: put 1 operator per ~3 items
  const allItems: { label: string; type: 'number' | 'operator'; value: number | Operator }[] = [];
  
  let numIdx = 0;
  let opIdx = 0;
  // Pattern: 2 nums, 1 op, repeat 6 times = 12 nums + 6 ops = 18
  for (let i = 0; i < 6; i++) {
    allItems.push({ label: String(numbers[numIdx]), type: 'number', value: numbers[numIdx] });
    numIdx++;
    allItems.push({ label: String(numbers[numIdx]), type: 'number', value: numbers[numIdx] });
    numIdx++;
    allItems.push({ label: operators[opIdx], type: 'operator', value: operators[opIdx] });
    opIdx++;
  }

  // Shuffle all items
  shuffle(allItems);

  // Assign to waves of 4 (last wave has 2)
  const ITEMS_PER_WAVE = 4;
  for (let i = 0; i < allItems.length; i++) {
    const wave = Math.floor(i / ITEMS_PER_WAVE);
    const item = allItems[i];
    items.push(makeBalloon(item.label, item.type, item.value, wave));
  }

  return items;
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
