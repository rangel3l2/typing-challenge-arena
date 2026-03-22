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

/** Generate 8 balloons for equation phase: includes the correct num1, operator, num2 + 5 distractors */
export function generateEquationBalloons(round: MathRound, difficulty: number): BalloonItem[] {
  const ops: Operator[] = ['+', '-', '×'];
  const items: BalloonItem[] = [];
  let id = 0;

  // Add correct pieces
  items.push({ id: id++, label: String(round.num1), type: 'number', value: round.num1 });
  items.push({ id: id++, label: String(round.num2), type: 'number', value: round.num2 });
  items.push({ id: id++, label: round.operator, type: 'operator', value: round.operator });

  // Add distractor numbers (3 of them)
  const usedNums = new Set([round.num1, round.num2, round.answer]);
  while (items.filter(i => i.type === 'number').length < 5) {
    const max = difficulty <= 2 ? 20 : difficulty <= 4 ? 50 : 99;
    const n = randInt(1, max);
    if (!usedNums.has(n)) {
      usedNums.add(n);
      items.push({ id: id++, label: String(n), type: 'number', value: n });
    }
  }

  // Add distractor operators (2 of them)
  const otherOps = ops.filter(o => o !== round.operator);
  for (const op of otherOps) {
    items.push({ id: id++, label: op, type: 'operator', value: op });
  }

  // Shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }

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
  { level: 1, label: 'Devagar', durationMs: 12000 },
  { level: 2, label: 'Normal', durationMs: 9000 },
  { level: 3, label: 'Rápido', durationMs: 7000 },
  { level: 4, label: 'Muito Rápido', durationMs: 5000 },
  { level: 5, label: 'Ultra', durationMs: 3500 },
  { level: 6, label: 'Insano!', durationMs: 2500 },
];

export const ROUNDS_PER_SPEED = 3;
export const TOTAL_ROUNDS = SPEED_LEVELS.length * ROUNDS_PER_SPEED;
