export type Operator = '+' | '-' | '×';

export interface MathRound {
  num1: number;
  num2: number;
  operator: Operator;
  answer: number;
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

  // Ensure subtraction doesn't go negative
  if (operator === '-' && num2 > num1) [num1, num2] = [num2, num1];

  return { num1, num2, operator, answer: evaluate(num1, num2, operator) };
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

export const SPEED_LEVELS = [
  { level: 1, label: 'Devagar', durationMs: 12000 },
  { level: 2, label: 'Normal', durationMs: 9000 },
  { level: 3, label: 'Rápido', durationMs: 7000 },
  { level: 4, label: 'Muito Rápido', durationMs: 5000 },
  { level: 5, label: 'Ultra', durationMs: 3500 },
  { level: 6, label: 'Insano!', durationMs: 2500 },
];

export const ROUNDS_PER_SPEED = 3;
export const TOTAL_ROUNDS = SPEED_LEVELS.length * ROUNDS_PER_SPEED; // 18 rounds
