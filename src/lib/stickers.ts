// Free sticker packs using open-source emoji/sticker sets (OpenMoji-based URLs)
export interface Sticker {
  id: string;
  url: string;
  label: string;
  pack: string;
}

export const STICKER_PACKS: { name: string; stickers: Sticker[] }[] = [
  {
    name: "Reações",
    stickers: [
      { id: "thumbsup", url: "👍", label: "Joinha", pack: "Reações" },
      { id: "clap", url: "👏", label: "Palmas", pack: "Reações" },
      { id: "fire", url: "🔥", label: "Fogo", pack: "Reações" },
      { id: "100", url: "💯", label: "100", pack: "Reações" },
      { id: "trophy", url: "🏆", label: "Troféu", pack: "Reações" },
      { id: "star", url: "⭐", label: "Estrela", pack: "Reações" },
      { id: "rocket", url: "🚀", label: "Foguete", pack: "Reações" },
      { id: "lightning", url: "⚡", label: "Raio", pack: "Reações" },
      { id: "muscle", url: "💪", label: "Força", pack: "Reações" },
      { id: "brain", url: "🧠", label: "Cérebro", pack: "Reações" },
      { id: "party", url: "🎉", label: "Festa", pack: "Reações" },
      { id: "crown", url: "👑", label: "Coroa", pack: "Reações" },
    ],
  },
  {
    name: "Engraçados",
    stickers: [
      { id: "laugh", url: "😂", label: "Rindo", pack: "Engraçados" },
      { id: "skull", url: "💀", label: "Morto", pack: "Engraçados" },
      { id: "clown", url: "🤡", label: "Palhaço", pack: "Engraçados" },
      { id: "monkey", url: "🙈", label: "Macaco", pack: "Engraçados" },
      { id: "poop", url: "💩", label: "Cocô", pack: "Engraçados" },
      { id: "ghost", url: "👻", label: "Fantasma", pack: "Engraçados" },
      { id: "alien", url: "👽", label: "Alien", pack: "Engraçados" },
      { id: "nerd", url: "🤓", label: "Nerd", pack: "Engraçados" },
      { id: "monocle", url: "🧐", label: "Curioso", pack: "Engraçados" },
      { id: "sunglasses", url: "😎", label: "Estiloso", pack: "Engraçados" },
      { id: "upsidedown", url: "🙃", label: "De cabeça", pack: "Engraçados" },
      { id: "wink", url: "😜", label: "Piscadinha", pack: "Engraçados" },
    ],
  },
  {
    name: "Competição",
    stickers: [
      { id: "bicycle", url: "🚴", label: "Ciclista", pack: "Competição" },
      { id: "keyboard", url: "⌨️", label: "Teclado", pack: "Competição" },
      { id: "speedboat", url: "🏎️", label: "Corrida", pack: "Competição" },
      { id: "medal_gold", url: "🥇", label: "Ouro", pack: "Competição" },
      { id: "medal_silver", url: "🥈", label: "Prata", pack: "Competição" },
      { id: "medal_bronze", url: "🥉", label: "Bronze", pack: "Competição" },
      { id: "target", url: "🎯", label: "Alvo", pack: "Competição" },
      { id: "timer", url: "⏱️", label: "Cronômetro", pack: "Competição" },
      { id: "flag", url: "🏁", label: "Bandeira", pack: "Competição" },
      { id: "boom", url: "💥", label: "Boom", pack: "Competição" },
      { id: "dash", url: "💨", label: "Rápido", pack: "Competição" },
      { id: "eyes", url: "👀", label: "Olhos", pack: "Competição" },
    ],
  },
];
