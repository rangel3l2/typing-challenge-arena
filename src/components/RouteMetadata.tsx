import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface PageMetadata {
  title: string;
  description: string;
  canonical: string;
  index?: boolean;
}

const SITE_URL = "https://euvoujogar.com.br";

const pageMetadata: Record<string, PageMetadata> = {
  "/": {
    title: "Eu Vou Jogar | Jogos educacionais grátis de digitação, matemática e robótica",
    description: "Jogue e aprenda grátis: digitação multiplayer, desafios de matemática e simulador de programação e robótica educacional para treinamento da OBR.",
    canonical: `${SITE_URL}/`,
  },
  "/game": {
    title: "Jogo de digitação online grátis | Eu Vou Digitar",
    description: "Treine velocidade e precisão de digitação gratuitamente no Eu Vou Digitar, um jogo educacional online com partidas e ranking.",
    canonical: `${SITE_URL}/game`,
  },
  "/acertar": {
    title: "Jogo de matemática infantil grátis | Eu Vou Acertar",
    description: "Pratique matemática grátis em seis fases de dificuldade crescente no jogo educacional Eu Vou Acertar.",
    canonical: `${SITE_URL}/acertar`,
  },
  "/ranking": {
    title: "Ranking dos jogos educacionais | Eu Vou Jogar",
    description: "Consulte as melhores pontuações do Eu Vou Digitar, Eu Vou Acertar e Eu Vou Programar.",
    canonical: `${SITE_URL}/ranking`,
  },
  "/sobre": {
    title: "Sobre o Eu Vou Jogar | Plataforma de jogos educacionais",
    description: "Conheça a plataforma brasileira gratuita para aprender digitação, matemática, programação e robótica por meio de jogos.",
    canonical: `${SITE_URL}/sobre`,
  },
  "/provisionamento": {
    title: "Provisionamento | Eu Vou Jogar",
    description: "Área operacional do Eu Vou Jogar.",
    canonical: `${SITE_URL}/provisionamento`,
    index: false,
  },
};

function upsertMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export default function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const isJoinPage = pathname.startsWith("/join/");
    const metadata = pageMetadata[pathname] ?? {
      title: isJoinPage ? "Entrar em uma partida | Eu Vou Jogar" : "Página não encontrada | Eu Vou Jogar",
      description: isJoinPage ? "Entre em uma partida do Eu Vou Digitar." : "A página solicitada não foi encontrada.",
      canonical: isJoinPage ? `${SITE_URL}/game` : `${SITE_URL}${pathname}`,
      index: false,
    };
    const robots = metadata.index === false
      ? "noindex, follow"
      : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

    document.title = metadata.title;
    upsertMeta('meta[name="description"]', "name", "description", metadata.description);
    upsertMeta('meta[name="robots"]', "name", "robots", robots);
    upsertMeta('meta[property="og:title"]', "property", "og:title", metadata.title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", metadata.description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", metadata.canonical);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", metadata.title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", metadata.description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = metadata.canonical;
  }, [pathname]);

  return null;
}
