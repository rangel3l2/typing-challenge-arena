import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pages = [
  { file: "index.html", canonical: "https://euvoujogar.com.br/" },
  { file: "game/index.html", canonical: "https://euvoujogar.com.br/game" },
  { file: "acertar/index.html", canonical: "https://euvoujogar.com.br/acertar" },
  { file: "eu-vou-programar/index.html", canonical: "https://euvoujogar.com.br/eu-vou-programar/" },
  { file: "ranking/index.html", canonical: "https://euvoujogar.com.br/ranking" },
  { file: "sobre/index.html", canonical: "https://euvoujogar.com.br/sobre" },
];

const read = (file: string) => readFileSync(file, "utf8");
const match = (html: string, expression: RegExp) => html.match(expression)?.[1]?.trim() ?? "";

describe("indexação pública do site", () => {
  it("entrega título, descrição e canonical exclusivos para cada página", () => {
    const titles = new Set<string>();

    for (const page of pages) {
      const html = read(page.file);
      const title = match(html, /<title>([^<]+)<\/title>/i);
      const description = match(html, /<meta name="description" content="([^"]+)"/i);
      const canonical = match(html, /<link rel="canonical" href="([^"]+)"/i);

      expect(title.length).toBeGreaterThan(25);
      expect(description.length).toBeGreaterThan(70);
      expect(canonical).toBe(page.canonical);
      expect(html).toContain("index, follow");
      titles.add(title);
    }

    expect(titles.size).toBe(pages.length);
  });

  it("mantém todos os dados estruturados como JSON válido", () => {
    for (const page of pages) {
      const html = read(page.file);
      const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
      expect(scripts.length).toBeGreaterThan(0);
      for (const script of scripts) expect(() => JSON.parse(script[1])).not.toThrow();
    }
  });

  it("libera os rastreadores documentados e mantém fallback para os demais", () => {
    const robots = read("public/robots.txt");
    for (const crawler of ["Googlebot", "Google-Extended", "Bingbot", "OAI-SearchBot", "GPTBot", "ChatGPT-User", "*"]) {
      expect(robots).toContain(`User-agent: ${crawler}`);
    }
    expect(robots).toContain("Sitemap: https://euvoujogar.com.br/sitemap.xml");
  });

  it("lista todas as páginas canônicas no sitemap e na referência para IAs", () => {
    const sitemap = read("public/sitemap.xml");
    const llms = read("public/llms.txt");
    for (const page of pages) expect(sitemap).toContain(`<loc>${page.canonical}</loc>`);
    for (const page of pages.slice(1)) expect(llms).toContain(page.canonical);
  });
});
