// Emoticons e figurinhas TEMÁTICAS do "Eu Vou Jogar"
// Combinações criativas usando emojis Unicode (open-source / Twemoji compatível)
// Personagem principal: o menino digitador 🧒 + temas de digitação, matemática, balões e corrida
export interface Sticker {
  id: string;
  url: string;
  label: string;
  pack: string;
}

export const STICKER_PACKS: { name: string; stickers: Sticker[] }[] = [
  {
    name: "🧒 Menino",
    stickers: [
      { id: "boy_typing", url: "🧒⌨️", label: "Digitando", pack: "🧒 Menino" },
      { id: "boy_thinking", url: "🧒💭", label: "Pensando", pack: "🧒 Menino" },
      { id: "boy_winner", url: "🧒🏆", label: "Vencedor", pack: "🧒 Menino" },
      { id: "boy_genius", url: "🧒🧠", label: "Gênio", pack: "🧒 Menino" },
      { id: "boy_strong", url: "🧒💪", label: "Forte", pack: "🧒 Menino" },
      { id: "boy_party", url: "🧒🎉", label: "Comemora", pack: "🧒 Menino" },
      { id: "boy_cool", url: "🧒😎", label: "Estiloso", pack: "🧒 Menino" },
      { id: "boy_sad", url: "🧒😢", label: "Triste", pack: "🧒 Menino" },
      { id: "boy_angry", url: "🧒😤", label: "Bravo", pack: "🧒 Menino" },
      { id: "boy_surprised", url: "🧒😲", label: "Uau", pack: "🧒 Menino" },
      { id: "boy_sleep", url: "🧒💤", label: "Sono", pack: "🧒 Menino" },
      { id: "boy_love", url: "🧒❤️", label: "Amei", pack: "🧒 Menino" },
    ],
  },
  {
    name: "⌨️ Digitar",
    stickers: [
      { id: "type_fast", url: "⌨️💨", label: "Digitar rápido", pack: "⌨️ Digitar" },
      { id: "type_fire", url: "⌨️🔥", label: "Teclado pegando fogo", pack: "⌨️ Digitar" },
      { id: "type_lightning", url: "⌨️⚡", label: "Velocidade raio", pack: "⌨️ Digitar" },
      { id: "type_perfect", url: "⌨️💯", label: "Cem por cento", pack: "⌨️ Digitar" },
      { id: "type_brain", url: "⌨️🧠", label: "Mente afiada", pack: "⌨️ Digitar" },
      { id: "type_error", url: "⌨️❌", label: "Errei", pack: "⌨️ Digitar" },
      { id: "type_check", url: "⌨️✅", label: "Acertei", pack: "⌨️ Digitar" },
      { id: "type_finger", url: "👆⌨️", label: "Dedo no botão", pack: "⌨️ Digitar" },
      { id: "type_hands", url: "🙌⌨️", label: "Duas mãos", pack: "⌨️ Digitar" },
      { id: "type_word", url: "📝⚡", label: "Palavra rápida", pack: "⌨️ Digitar" },
      { id: "type_book", url: "📚💨", label: "Lendo veloz", pack: "⌨️ Digitar" },
      { id: "type_target", url: "🎯⌨️", label: "Mira certa", pack: "⌨️ Digitar" },
    ],
  },
  {
    name: "🎈 Acertar",
    stickers: [
      { id: "balloon_pop", url: "🎈💥", label: "Estourei!", pack: "🎈 Acertar" },
      { id: "balloon_red", url: "🎈❤️", label: "Vermelho", pack: "🎈 Acertar" },
      { id: "balloon_blue", url: "🎈💙", label: "Azul", pack: "🎈 Acertar" },
      { id: "balloon_yellow", url: "🎈💛", label: "Amarelo", pack: "🎈 Acertar" },
      { id: "math_plus", url: "➕🧠", label: "Soma", pack: "🎈 Acertar" },
      { id: "math_minus", url: "➖🧠", label: "Subtração", pack: "🎈 Acertar" },
      { id: "math_times", url: "✖️🔥", label: "Multiplicação", pack: "🎈 Acertar" },
      { id: "math_divide", url: "➗💯", label: "Divisão", pack: "🎈 Acertar" },
      { id: "math_correct", url: "🎈✅", label: "Certo!", pack: "🎈 Acertar" },
      { id: "math_wrong", url: "🎈❌", label: "Errado", pack: "🎈 Acertar" },
      { id: "math_count", url: "🔢🎯", label: "Contando", pack: "🎈 Acertar" },
      { id: "math_eureka", url: "💡🎈", label: "Eureka!", pack: "🎈 Acertar" },
    ],
  },
  {
    name: "🏁 Corrida",
    stickers: [
      { id: "race_car", url: "🏎️💨", label: "Acelera!", pack: "🏁 Corrida" },
      { id: "race_bike", url: "🚴‍♂️💨", label: "Bicicleta", pack: "🏁 Corrida" },
      { id: "race_gold", url: "🥇🏁", label: "Primeiro!", pack: "🏁 Corrida" },
      { id: "race_silver", url: "🥈🏁", label: "Segundo", pack: "🏁 Corrida" },
      { id: "race_bronze", url: "🥉🏁", label: "Terceiro", pack: "🏁 Corrida" },
      { id: "race_flag", url: "🏁🎉", label: "Cheguei!", pack: "🏁 Corrida" },
      { id: "race_trophy", url: "🏆✨", label: "Troféu", pack: "🏁 Corrida" },
      { id: "race_crown", url: "👑🏎️", label: "Rei da pista", pack: "🏁 Corrida" },
      { id: "race_fire", url: "🏎️🔥", label: "Pegando fogo", pack: "🏁 Corrida" },
      { id: "race_boom", url: "💥🏁", label: "Disparou", pack: "🏁 Corrida" },
      { id: "race_timer", url: "⏱️⚡", label: "Cronômetro", pack: "🏁 Corrida" },
      { id: "race_lap", url: "🔄🏎️", label: "Mais uma volta", pack: "🏁 Corrida" },
    ],
  },
  {
    name: "💬 Reações",
    stickers: [
      { id: "react_gg", url: "🎮👏", label: "Boa partida!", pack: "💬 Reações" },
      { id: "react_rematch", url: "🔄🎮", label: "Revanche!", pack: "💬 Reações" },
      { id: "react_easy", url: "😴💯", label: "Moleza", pack: "💬 Reações" },
      { id: "react_hard", url: "😰💦", label: "Difícil!", pack: "💬 Reações" },
      { id: "react_lucky", url: "🍀✨", label: "Sorte!", pack: "💬 Reações" },
      { id: "react_unlucky", url: "💔😩", label: "Que azar", pack: "💬 Reações" },
      { id: "react_lag", url: "🐌📡", label: "Tá lagando", pack: "💬 Reações" },
      { id: "react_clutch", url: "🧒⚡", label: "Salvou no fim!", pack: "💬 Reações" },
      { id: "react_close", url: "😱🔥", label: "Quase!", pack: "💬 Reações" },
      { id: "react_destroyed", url: "💀⌨️", label: "Detonado", pack: "💬 Reações" },
      { id: "react_respect", url: "🤝👑", label: "Respeito", pack: "💬 Reações" },
      { id: "react_cheers", url: "🎉🥳", label: "Festa!", pack: "💬 Reações" },
    ],
  },
];
