import { beforeEach, describe, expect, it } from "vitest";
import {
  getOrCreatePlayerSessionId,
  PLAYER_SESSION_KEYS,
  readPlayerSession,
  writePlayerSession,
} from "./playerSession";

function clearSessionCookies() {
  Object.values(PLAYER_SESSION_KEYS).forEach((key) => {
    document.cookie = `${key}=; Max-Age=0; Path=/`;
  });
}

describe("playerSession", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearSessionCookies();
  });

  it("espelha os dados do jogador em localStorage e cookie temporário", () => {
    writePlayerSession("playerName", "Ana Maria");

    expect(window.localStorage.getItem(PLAYER_SESSION_KEYS.playerName)).toBe("Ana Maria");
    expect(document.cookie).toContain(`${PLAYER_SESSION_KEYS.playerName}=Ana%20Maria`);
  });

  it("recupera do cookie quando o rascunho local não está disponível", () => {
    document.cookie = `${PLAYER_SESSION_KEYS.playerCode}=123456; Path=/; SameSite=Lax`;

    expect(readPlayerSession("playerCode")).toBe("123456");
    expect(window.localStorage.getItem(PLAYER_SESSION_KEYS.playerCode)).toBe("123456");
  });

  it("mantém o mesmo identificador durante a sessão", () => {
    const first = getOrCreatePlayerSessionId();
    const second = getOrCreatePlayerSessionId();

    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(second).toBe(first);
  });
});
