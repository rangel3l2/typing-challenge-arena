import { beforeEach, describe, expect, it } from "vitest";
import {
  migrateLegacyProgrammingStorage,
  PROGRAMMING_STORAGE_KEYS,
  programmingStorageKey,
  readProgrammingStorage,
  writeProgrammingStorage,
} from "./programmingStorage";

describe("armazenamento separado do Eu Vou Programar", () => {
  beforeEach(() => window.localStorage.clear());

  it("mantém fase, desbloqueios e código independentes para cada jogador", () => {
    writeProgrammingStorage("jogador-a", "challenge", "7");
    writeProgrammingStorage("jogador-a", "unlockedMissions", JSON.stringify({ beginner: 7 }));
    writeProgrammingStorage("jogador-a", "code", "print('A')");
    writeProgrammingStorage("jogador-b", "challenge", "2");
    writeProgrammingStorage("jogador-b", "unlockedMissions", JSON.stringify({ beginner: 2 }));
    writeProgrammingStorage("jogador-b", "code", "print('B')");

    expect(readProgrammingStorage("jogador-a", "challenge")).toBe("7");
    expect(readProgrammingStorage("jogador-a", "code")).toBe("print('A')");
    expect(readProgrammingStorage("jogador-b", "challenge")).toBe("2");
    expect(readProgrammingStorage("jogador-b", "code")).toBe("print('B')");
  });

  it("migra o progresso antigo somente para o jogador atual", () => {
    window.localStorage.setItem(PROGRAMMING_STORAGE_KEYS.challenge, "5");
    window.localStorage.setItem(PROGRAMMING_STORAGE_KEYS.code, "print('legado')");

    migrateLegacyProgrammingStorage("jogador-atual");

    expect(readProgrammingStorage("jogador-atual", "challenge")).toBe("5");
    expect(readProgrammingStorage("jogador-atual", "code")).toBe("print('legado')");
    expect(readProgrammingStorage("outro-jogador", "challenge")).toBeNull();
    expect(window.localStorage.getItem(PROGRAMMING_STORAGE_KEYS.challenge)).toBeNull();
  });

  it("não substitui dados já separados durante a migração", () => {
    window.localStorage.setItem(PROGRAMMING_STORAGE_KEYS.challenge, "4");
    window.localStorage.setItem(programmingStorageKey("jogador-atual", "challenge"), "8");

    migrateLegacyProgrammingStorage("jogador-atual");

    expect(readProgrammingStorage("jogador-atual", "challenge")).toBe("8");
  });
});
