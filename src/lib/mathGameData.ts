import type { BalloonDirection } from "@/components/Balloon";

export type Operator = '+' | '-' | '×';

export interface MathRound {
  num1: number;
  num2: number;
  operator: Operator;
  answer: number;
}

export interface BalloonItem {
  id: number;
  label: string;
  type: 'number' | 'operator';
  value: number | Operator;
  // Movement properties
  direction: BalloonDirection;
  startX: number;
  startY: number;
  swayAmount: number;
  swaySpeed: number;
  speedMultiplier: number;
  waveIndex: number; // which wave (0-3) this balloon belongs to
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

function randomBalloonMovement(direction: BalloonDirection): { startX: number; startY: number; swayAmount: number; swaySpeed: number; speedMultiplier: number } {
  const swayAmount = randFloat(8, 25);
  const swaySpeed = randFloat(2, 5);
  const speedMultiplier = randFloat(0.7, 1.3);

  if (direction === 'up') {
    return { startX: randInt(8, 88), startY: randInt(-15, -5), swayAmount, swaySpeed, speedMultiplier };
  } else if (direction === 'left') {
    return { startX: 0, startY: randInt(20, 70), swayAmount, swaySpeed, speedMultiplier };
  } else {
    return { startX: 0, startY: randInt(20, 70), swayAmount, swaySpeed, speedMultiplier };
  }
}

export function generateMathRound(difficulty: number): MathRound {
  let num1: number, num2: number;
  const ops: Operator[] = difficulty <= 2 ? ['+', '-'] : ['+', '-', '×'];
  const operator = ops[randInt(0, ops.length - 1)];

  if (difficulty <= 2) {
    num1 = randInt(1, 20);
    num2 = randInt(1, 20);
  } else if (difficulty <= 4) {
    num1 = randInt(5, 50);
    num2 = operator === '×' ? randInt(2, 12) : randInt(5, 50);
  } else {
    num1 = randInt(10, 99);
    num2 = operator === '×' ? randInt(2, 15) : randInt(10, 99);
  }

  if (operator === '-' && num2 > num1) [num1, num2] = [num2, num1];

  return { num1, num2, operator, answer: evaluate(num1, num2, operator) };
}

/** Generate 16 balloons: 4 operators + 12 numbers (4 tens, 4 hundreds, 4 random) */
export function generateEquationBalloons(round: MathRound, difficulty: number): BalloonItem[] {
  const ops: Operator[] = ['+', '-', '×'];
  const items: BalloonItem[] = [];
  let id = 0;

  const usedNums = new Set([round.answer]); // avoid answer in equation phase

  // Helper to create a balloon item with random movement
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

  // --- NUMBERS: 12 total ---
  // Ensure correct num1 and num2 are included
  usedNums.add(round.num1);
  usedNums.add(round.num2);

  // Wave 0: 4 numbers in tens (10-99), include one correct if in range
  const tensNums: number[] = [];
  if (round.num1 >= 10 && round.num1 <= 99) tensNums.push(round.num1);
  if (round.num2 >= 10 && round.num2 <= 99 && !tensNums.includes(round.num2)) tensNums.push(round.num2);
  while (tensNums.length < 4) {
    const n = randInt(10, 99);
    if (!usedNums.has(n) && !tensNums.includes(n)) {
      usedNums.add(n);
      tensNums.push(n);
    }
  }

  // Wave 1: 4 numbers in hundreds (100-999)
  const hundredsNums: number[] = [];
  if (round.num1 >= 100 && round.num1 <= 999) hundredsNums.push(round.num1);
  if (round.num2 >= 100 && round.num2 <= 999 && !hundredsNums.includes(round.num2)) hundredsNums.push(round.num2);
  while (hundredsNums.length < 4) {
    const n = randInt(100, 999);
    if (!usedNums.has(n) && !hundredsNums.includes(n)) {
      usedNums.add(n);
      hundredsNums.push(n);
    }
  }

  // Wave 2: 4 random numbers (mix of tens and hundreds)
  const randomNums: number[] = [];
  // Ensure correct numbers that weren't placed yet
  if (!tensNums.includes(round.num1) && !hundredsNums.includes(round.num1)) randomNums.push(round.num1);
  if (!tensNums.includes(round.num2) && !hundredsNums.includes(round.num2) && !randomNums.includes(round.num2)) randomNums.push(round.num2);
  while (randomNums.length < 4) {
    const n = Math.random() > 0.5 ? randInt(10, 99) : randInt(100, 999);
    if (!usedNums.has(n) && !randomNums.includes(n)) {
      usedNums.add(n);
      randomNums.push(n);
    }
  }

  // Shuffle within each wave
  const shuffle = <T,>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  shuffle(tensNums);
  shuffle(hundredsNums);
  shuffle(randomNums);

  // Add numbers to items
  for (const n of tensNums) items.push(makeBalloon(String(n), 'number', n, 0));
  for (const n of hundredsNums) items.push(makeBalloon(String(n), 'number', n, 1));
  for (const n of randomNums) items.push(makeBalloon(String(n), 'number', n, 2));

  // --- OPERATORS: 4 total (correct + 3 others, but we only have 3 unique ops so add a duplicate) ---
  const correctOp = round.operator;
  const otherOps = ops.filter(o => o !== correctOp);
  const allOps = shuffle([correctOp, ...otherOps, ops[randInt(0, ops.length - 1)]]);

  // Wave 3: operators
  for (const op of allOps) items.push(makeBalloon(op, 'operator', op, 3));

  return items;
}

export function generateWrongAnswers(correct: number, count: number): number[] {
  const wrongs = new Set<number>();
  const range = Math.max(10, Math.abs(correct));
  while (wrongs.size < count) {
    const offset = randInt(1, range);
    const wrong = correct + (Math.random() > 0.5 ? offset : -offset);
    if (wrong !== correct && wrong >= 0) wrongs.add(wrong);
  }
  return Array.from(wrongs).slice(0, count);
}

/** Check if selection forms a valid equation pattern: num+num+op, num+op+num, op+num+num */
export function isValidEquationSelection(items: BalloonItem[]): boolean {
  if (items.length !== 3) return false;
  const numCount = items.filter(i => i.type === 'number').length;
  const opCount = items.filter(i => i.type === 'operator').length;
  return numCount === 2 && opCount === 1;
}

/** Extract the equation from selected items and compute result */
export function computeFromSelection(items: BalloonItem[]): { num1: number; num2: number; operator: Operator; answer: number } | null {
  if (!isValidEquationSelection(items)) return null;
  const nums = items.filter(i => i.type === 'number').map(i => i.value as number);
  const op = items.find(i => i.type === 'operator')!.value as Operator;
  const [a, b] = nums;
  return { num1: a, num2: b, operator: op, answer: evaluate(a, b, op) };
}

export const SPEED_LEVELS = [
  { level: 1, label: 'Devagar', durationMs: 14000 },
  { level: 2, label: 'Normal', durationMs: 11000 },
  { level: 3, label: 'Rápido', durationMs: 8500 },
  { level: 4, label: 'Muito Rápido', durationMs: 6500 },
  { level: 5, label: 'Ultra', durationMs: 4500 },
  { level: 6, label: 'Insano!', durationMs: 3000 },
];

export const ROUNDS_PER_SPEED = 3;
export const TOTAL_ROUNDS = SPEED_LEVELS.length * ROUNDS_PER_SPEED;

/** Delay in seconds between waves */
export const WAVE_DELAY = 2.5;
/** Number of balloons per wave */
export const BALLOONS_PER_WAVE = 4;
