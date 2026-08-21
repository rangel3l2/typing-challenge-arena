import { describe, expect, it } from "vitest";
import { parsePlayerRecoveryCode } from "./playerCode";

describe("código de recuperação do jogador", () => {
  it("aceita os formatos de seis números e nome com código", () => {
    expect(parsePlayerRecoveryCode("123456")).toBe("123456");
    expect(parsePlayerRecoveryCode("  Maria#654321  ")).toBe("654321");
  });

  it("recusa valores que não sejam um código de recuperação válido", () => {
    expect(parsePlayerRecoveryCode("12345")).toBeNull();
    expect(parsePlayerRecoveryCode("Maria123456")).toBeNull();
    expect(parsePlayerRecoveryCode("Maria#1234567")).toBeNull();
    expect(parsePlayerRecoveryCode("Maria#Outro#123456")).toBeNull();
  });
});
