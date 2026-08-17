import { describe, expect, it } from "vitest";
import { aggregateProgrammingScores } from "./programmingRanking";

describe("ranking do Eu Vou Programar", () => {
  it("soma os recordes dos desafios sem misturar jogadores", () => {
    const ranking = aggregateProgrammingScores([
      { player_name: "Ana", player_code: "111111", score: 40, arena_level: "easy", challenge_number: 1 },
      { player_name: "Ana", player_code: "111111", score: 65, arena_level: "easy", challenge_number: 2 },
      { player_name: "Beto", player_code: "222222", score: 80, arena_level: "easy", challenge_number: 1 },
    ]).sort((left, right) => right.totalScore - left.totalScore);

    expect(ranking[0]).toMatchObject({ playerName: "Ana", totalScore: 105, bestScore: 65, challengesCompleted: 2 });
    expect(ranking[1]).toMatchObject({ playerName: "Beto", totalScore: 80, bestScore: 80, challengesCompleted: 1 });
  });
});
