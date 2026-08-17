export interface ProgrammingScoreRow {
  player_name: string;
  player_code: string;
  score: number;
  arena_level: string;
  challenge_number: number;
}

export interface ProgrammingRankingScore {
  playerName: string;
  playerCode: string;
  totalScore: number;
  bestScore: number;
  challengesCompleted: number;
}

export function aggregateProgrammingScores(rows: ProgrammingScoreRow[]): ProgrammingRankingScore[] {
  const players = new Map<string, ProgrammingRankingScore>();

  for (const row of rows) {
    const key = row.player_code || row.player_name.toLocaleLowerCase("pt-BR");
    const current = players.get(key) ?? {
      playerName: row.player_name,
      playerCode: row.player_code,
      totalScore: 0,
      bestScore: 0,
      challengesCompleted: 0,
    };
    current.playerName = row.player_name;
    current.totalScore += row.score;
    current.bestScore = Math.max(current.bestScore, row.score);
    current.challengesCompleted += 1;
    players.set(key, current);
  }

  return Array.from(players.values());
}
