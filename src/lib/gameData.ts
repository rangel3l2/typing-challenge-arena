export interface TypingChallenge {
  id: number;
  round: number;
  text: string;
  difficulty: string;
  label: string;
}

export const challenges: TypingChallenge[] = [
  {
    id: 1,
    round: 1,
    difficulty: "Iniciante",
    label: "Teclas Base",
    text: "asdf jklç asdf jklç asdf jklç",
  },
  {
    id: 2,
    round: 2,
    difficulty: "Fácil",
    label: "Palavras Simples",
    text: "casa mesa sala porta lado fada gato rato bola mola",
  },
  {
    id: 3,
    round: 3,
    difficulty: "Médio",
    label: "Frases Curtas",
    text: "O gato pulou a cerca e correu pelo jardim verde e bonito.",
  },
  {
    id: 4,
    round: 4,
    difficulty: "Difícil",
    label: "Frases Longas",
    text: "A prática constante da digitação melhora a velocidade e a precisão dos dedos no teclado todos os dias.",
  },
  {
    id: 5,
    round: 5,
    difficulty: "Expert",
    label: "Texto Completo",
    text: "Quanto mais você pratica a digitação, mais rápido e preciso você se torna. A chave para o sucesso é a consistência e a dedicação diária aos exercícios de digitação no teclado.",
  },
];

export interface Player {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  isOwner: boolean;
}

export interface PlayerResult {
  playerId: string;
  wpm: number;
  accuracy: number;
  timeMs: number;
}

export interface RoundResult {
  round: number;
  results: PlayerResult[];
}

const botNames = ["Ana", "Carlos", "Maria", "Pedro", "Julia", "Lucas", "Beatriz", "Rafael"];
const playerColors = [
  "hsl(0 75% 55%)",
  "hsl(170 70% 45%)",
  "hsl(210 80% 55%)",
  "hsl(45 95% 55%)",
  "hsl(270 60% 55%)",
  "hsl(330 70% 55%)",
  "hsl(25 90% 55%)",
  "hsl(142 70% 45%)",
];

export function generateBotPlayers(count: number): Player[] {
  const shuffled = [...botNames].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((name, i) => ({
    id: `bot-${i}`,
    name,
    color: playerColors[(i + 1) % playerColors.length],
    isBot: true,
    isOwner: false,
  }));
}

export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function simulateBotResult(textLength: number): PlayerResult {
  const wpm = 25 + Math.random() * 55; // 25-80 WPM
  const accuracy = 75 + Math.random() * 25; // 75-100%
  const charsPerMin = wpm * 5;
  const timeMs = (textLength / charsPerMin) * 60 * 1000;
  return {
    playerId: "",
    wpm: Math.round(wpm),
    accuracy: Math.round(accuracy),
    timeMs: Math.round(timeMs),
  };
}
