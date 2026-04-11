// Word-level difficulty system

const RARE_LETTERS = new Set(["k", "w", "y", "x", "z", "q"]);
const SYMBOLS = /[^a-zA-ZÀ-ÿ0-9\s]/;
const NUMBERS = /[0-9]/;

export interface ScoredWord {
  word: string;
  difficulty: number;
}

export interface WordResult {
  word: string;
  difficulty: number;
  wpm: number;
  accuracy: number;
  score: number;
}

export interface MatchResult {
  totalScore: number;
  averageDifficulty: number;
  wpm: number;
  accuracy: number;
  wordResults: WordResult[];
}

/**
 * Calculate difficulty for a single word based on multiple factors.
 * Returns a value typically between 0.5 and 3.0.
 */
export function calculateWordDifficulty(word: string): number {
  if (!word || word.trim().length === 0) return 1.0;

  let diff = 1.0;

  const len = word.length;
  if (len <= 3) diff *= 0.8;
  else if (len <= 5) diff *= 1.0;
  else if (len <= 8) diff *= 1.2;
  else if (len <= 12) diff *= 1.5;
  else diff *= 1.8;

  const lowerWord = word.toLowerCase();
  let rareCount = 0;
  for (const ch of lowerWord) {
    if (RARE_LETTERS.has(ch)) rareCount++;
  }
  if (rareCount > 0) diff *= 1 + rareCount * 0.15;

  if (NUMBERS.test(word)) diff *= 1.3;
  if (SYMBOLS.test(word)) diff *= 1.4;

  const uppercaseCount = (word.slice(1).match(/[A-ZÀ-Ý]/g) || []).length;
  if (uppercaseCount > 0) diff *= 1 + uppercaseCount * 0.1;

  if (word[0] && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
    diff *= 1.05;
  }

  const accentCount = (word.match(/[àáâãäéèêëíìîïóòôõöúùûüçñ]/gi) || []).length;
  if (accentCount > 0) diff *= 1 + accentCount * 0.08;

  return Math.round(diff * 100) / 100;
}

export function analyzeText(text: string): ScoredWord[] {
  return text.split(/\s+/).filter(Boolean).map((word) => ({
    word,
    difficulty: calculateWordDifficulty(word),
  }));
}

export function getTextDifficulty(text: string): number {
  const words = analyzeText(text);
  if (words.length === 0) return 1.0;
  const sum = words.reduce((acc, w) => acc + w.difficulty, 0);
  return Math.round((sum / words.length) * 100) / 100;
}

export function calculateWordScore(wpm: number, accuracy: number, difficulty: number): number {
  return Math.round(wpm * (accuracy / 100) * difficulty);
}

/**
 * 5 difficulty tiers: Muito Fácil, Fácil, Médio, Difícil, Insano
 */
export type DifficultyTier = "Muito Fácil" | "Fácil" | "Médio" | "Difícil" | "Insano";

export interface DifficultyInfo {
  tier: DifficultyTier;
  color: string;
  emoji: string;
}

export function classifyDifficulty(avgDifficulty: number): DifficultyInfo {
  if (avgDifficulty < 1.0) return { tier: "Muito Fácil", color: "emerald", emoji: "🟢" };
  if (avgDifficulty < 1.3) return { tier: "Fácil", color: "green", emoji: "🟡" };
  if (avgDifficulty < 1.6) return { tier: "Médio", color: "yellow", emoji: "🟠" };
  if (avgDifficulty < 2.0) return { tier: "Difícil", color: "orange", emoji: "🔴" };
  return { tier: "Insano", color: "red", emoji: "💀" };
}

/**
 * Map round number to a difficulty tier label for display.
 * Uses the distribution: 1-3 muito fácil, 4-6 fácil, 7-9 médio, 10-12 difícil, 13+ insano
 */
export function getRoundDifficultyTier(round: number, totalRounds: number): DifficultyTier {
  const ratio = (round - 1) / Math.max(totalRounds - 1, 1);
  if (ratio < 0.2) return "Muito Fácil";
  if (ratio < 0.4) return "Fácil";
  if (ratio < 0.6) return "Médio";
  if (ratio < 0.85) return "Difícil";
  return "Insano";
}

// ─── Challenge generation with progressive difficulty ───

interface GeneratedChallenge {
  id: number;
  round: number;
  text: string;
  difficulty: number;
  tier: DifficultyInfo;
  label: string;
  words: ScoredWord[];
}

const WORD_POOLS = {
  veryEasy: [
    "casa", "mesa", "sala", "porta", "lado", "gato", "rato", "bola", "vida", "fogo",
    "lua", "sol", "mar", "rio", "dia", "pé", "mão", "pai", "mãe", "luz",
    "ar", "eu", "tu", "nós", "ele", "ela", "sim", "não", "bem", "mal",
    "cor", "dor", "flor", "som", "tom", "dom", "mel", "pão", "céu", "chão",
    "rua", "ovo", "asa", "ave", "fim", "lei", "rei", "voz", "paz", "vez",
  ],
  easy: [
    "campo", "terra", "água", "pedra", "folha", "planta", "animal", "livro", "escola",
    "carro", "barco", "ponte", "cidade", "praia", "noite", "mundo", "tempo", "verde",
    "doce", "forte", "grande", "brilho", "alegre", "amigo", "bonito", "branco", "claro",
    "fruta", "nuvem", "sombra", "vento", "chuva", "trilha", "festa", "dança", "canto",
    "papel", "lápis", "janela", "jardim", "musica", "pintar", "correr", "saltar", "nadar",
    "dormir", "comer", "beber", "ler", "falar", "ouvir", "pensar", "sonhar",
  ],
  medium: [
    "computador", "educação", "informação", "organização", "desenvolvimento", "apresentação",
    "comunicação", "experiência", "importante", "necessário", "consequência", "oportunidade",
    "transformação", "conhecimento", "responsável", "interessante", "biblioteca", "universidade",
    "tecnologia", "fundamental", "crescimento", "aprendizado", "criatividade", "inteligência",
    "velocidade", "dificuldade", "imaginação", "perseverança", "independência", "profissional",
    "eficiência", "estratégia", "perspectiva", "significado", "curiosidade", "diversidade",
  ],
  hard: [
    "extraordinário", "incompreensível", "responsabilidade", "inconstitucional",
    "desenvolvimento", "telecomunicações", "paralelepípedo", "constitucionalidade",
    "descaracterização", "internacionalização", "desproporcionalidade", "multidisciplinar",
    "anticonstitucional", "eletroencefalograma", "otorrinolaringologia", "superintendência",
    "imprescindível", "excepcionalidade", "inconstitucionalidade",
  ],
  withNumbers: [
    "2024", "R$150", "100%", "3.14", "1080p", "Wi-Fi", "5G", "MP3", "4K",
    "8.515.767", "215M", "km²", "24h", "360°", "50kg", "1.5L", "7zip",
    "99,9%", "2.0", "500MB", "10x", "15min", "30seg", "120bpm",
  ],
  withSymbols: [
    "user@email.com", "https://", "www.exemplo.com.br", "(acesso)", "e-mail",
    "C++", "C#", "#hashtag", "@usuario", "R$", "50%", "{}", "[]", "()",
    "calc(x)", "func()", "true/false", "on/off", "sim/não", "input=>output",
    "key:value", "a+b=c", "x>0", "n<=100", "if(x)", "&&", "||", "!=",
  ],
  technical: [
    "function", "return", "boolean", "string", "number", "interface", "const",
    "export", "import", "default", "typeof", "instanceof", "undefined", "null",
    "async", "await", "Promise", "callback", "parameter", "argument",
    "variable", "component", "useState", "useEffect", "className", "onClick",
    "innerHTML", "querySelector", "addEventListener", "getAttribute",
  ],
};

const SENTENCE_TEMPLATES = [
  (words: string[]) => words.join(" "),
  (words: string[]) => `${words[0]} ${words.slice(1).join(" ")}.`,
  (words: string[]) => `O ${words[0]} é ${words[1]} e ${words[2]} para ${words[3]}.`,
];

function pickRandom<T>(arr: T[], count: number, exclude: Set<string> = new Set()): T[] {
  const filtered = arr.filter((item) => !exclude.has(String(item)));
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function generateProgressiveChallenges(totalRounds: number): GeneratedChallenge[] {
  const usedWords = new Set<string>();
  const challenges: GeneratedChallenge[] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const progress = (round - 1) / Math.max(totalRounds - 1, 1);

    let words: string[] = [];

    if (progress < 0.15) {
      words = pickRandom(WORD_POOLS.veryEasy, 10 + Math.floor(Math.random() * 4), usedWords);
    } else if (progress < 0.3) {
      words = [
        ...pickRandom(WORD_POOLS.veryEasy, 4, usedWords),
        ...pickRandom(WORD_POOLS.easy, 6 + Math.floor(Math.random() * 3), usedWords),
      ];
    } else if (progress < 0.5) {
      words = [
        ...pickRandom(WORD_POOLS.easy, 3, usedWords),
        ...pickRandom(WORD_POOLS.medium, 6 + Math.floor(Math.random() * 3), usedWords),
      ];
    } else if (progress < 0.65) {
      words = [
        ...pickRandom(WORD_POOLS.medium, 5, usedWords),
        ...pickRandom(WORD_POOLS.withNumbers, 3, usedWords),
        ...pickRandom(WORD_POOLS.easy, 2, usedWords),
      ];
    } else if (progress < 0.8) {
      words = [
        ...pickRandom(WORD_POOLS.medium, 3, usedWords),
        ...pickRandom(WORD_POOLS.hard, 3, usedWords),
        ...pickRandom(WORD_POOLS.withSymbols, 2, usedWords),
        ...pickRandom(WORD_POOLS.withNumbers, 2, usedWords),
      ];
    } else if (progress < 0.9) {
      words = [
        ...pickRandom(WORD_POOLS.hard, 3, usedWords),
        ...pickRandom(WORD_POOLS.technical, 4, usedWords),
        ...pickRandom(WORD_POOLS.withSymbols, 3, usedWords),
      ];
    } else {
      words = [
        ...pickRandom(WORD_POOLS.hard, 2, usedWords),
        ...pickRandom(WORD_POOLS.technical, 3, usedWords),
        ...pickRandom(WORD_POOLS.withSymbols, 3, usedWords),
        ...pickRandom(WORD_POOLS.withNumbers, 2, usedWords),
      ];
    }

    words = words.sort(() => Math.random() - 0.5);
    words.forEach((w) => usedWords.add(w));

    const text = words.join(" ");
    const scoredWords = analyzeText(text);
    const avgDiff = scoredWords.length > 0
      ? scoredWords.reduce((sum, w) => sum + w.difficulty, 0) / scoredWords.length
      : 1.0;
    const tier = classifyDifficulty(avgDiff);

    const labels = [
      "Teclas Base", "Palavras Simples", "Vocabulário", "Textos Curtos",
      "Números e Datas", "Pontuação", "Acentuação", "Palavras Longas",
      "Símbolos Especiais", "Texto Técnico", "Frases Complexas", "Texto Misto",
      "Desafio Avançado", "Teste Expert",
    ];

    challenges.push({
      id: round,
      round,
      text,
      difficulty: Math.round(avgDiff * 100) / 100,
      tier,
      label: labels[Math.min(round - 1, labels.length - 1)],
      words: scoredWords,
    });
  }

  return challenges;
}

export const DEFAULT_ROUNDS = 14;
