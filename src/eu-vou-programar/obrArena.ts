export interface ArenaPoint { x: number; y: number }
export interface ArenaRect { x: number; y: number; width: number; height: number }

export type ArenaLevel = "easy" | "medium" | "hard";
export type OBRHazardKind = "gap" | "bump" | "ramp" | "intersection" | "obstacle" | "passage" | "checkpoint";
export type GreenRule = "left" | "right" | "straight" | "dead-end";
export type ArenaMarkerColour = "azul" | "amarelo" | "vermelho" | "verde" | "prata" | "preto";

export interface OBRGreenMarker extends ArenaRect { id: string; rule: GreenRule }
export interface OBRFloorMarker extends ArenaRect { id: string; label: string; colour: ArenaMarkerColour }
export interface OBRArenaObstacle extends ArenaRect { colour?: string; sensorColour?: string }
export interface OBRHazard {
  id: string; kind: OBRHazardKind; label: string; points: number; x: number; y: number; radius: number;
  requiredHeading?: number; rect?: ArenaRect;
}
export interface OBRStart extends ArenaPoint { angle: number }
export interface OBRChallengeGoal extends ArenaPoint { radius: number; holdSeconds: number; label: string; requiredHeading?: number }
export interface OBRChallenge {
  number: number; title: string; objective: string; hint: string; successMessage: string;
  requiredHazards: string[]; requireHazardOrder?: boolean; maxCollisions?: number; timeLimit: number; goal: OBRChallengeGoal;
}
export interface OBRLayout {
  id: string; name: string; level: ArenaLevel; challenge: OBRChallenge; mainPath: ArenaPoint[]; exitPath: ArenaPoint[];
  branches: ArenaPoint[][]; gaps: ArenaRect[]; floorMarkers: OBRFloorMarker[]; greenMarkers: OBRGreenMarker[];
  hazards: OBRHazard[]; obstacles: OBRArenaObstacle[]; start: OBRStart; rescueRoom: ArenaRect;
  silverGate: ArenaRect; blackGate: ArenaRect; finishStripe: ArenaRect;
}

export const OBR_TILE_SIZE = 100;
export const ARENA_CHALLENGE_COUNT = 10;

const common = {
  rescueRoom: { x: 650, y: 55, width: 280, height: 285 },
  silverGate: { x: 642, y: 195, width: 16, height: 50 },
  blackGate: { x: 790, y: 332, width: 50, height: 16 },
  finishStripe: { x: 670, y: 488, width: 16, height: 44 },
  exitPath: [{ x: 815, y: 340 }, { x: 815, y: 510 }, { x: 680, y: 510 }],
};
const levelNames: Record<ArenaLevel, string> = { easy: "Fácil", medium: "Médio", hard: "Avançado" };
const goal = (x: number, y: number, label: string, holdSeconds = 2, requiredHeading?: number): OBRChallengeGoal => ({ x, y, radius: 27, holdSeconds, label, requiredHeading });
const finishGoal = (holdSeconds = 5) => goal(678, 510, `Pare ${holdSeconds} segundos na faixa vermelha`, holdSeconds);
const m = (id: string, label: string, colour: ArenaMarkerColour, x: number, y: number, width = 28, height = 30): OBRFloorMarker => ({ id, label, colour, x: x - width / 2, y: y - height / 2, width, height });
const h = (id: string, label: string, x: number, y: number, points = 10, requiredHeading?: number): OBRHazard => ({ id, kind: "checkpoint", label, points, x, y, radius: 28, requiredHeading });
const ev = (id: string, kind: OBRHazardKind, label: string, x: number, y: number, points = 10, requiredHeading?: number, rect?: ArenaRect): OBRHazard => ({ id, kind, label, points, x, y, radius: kind === "obstacle" ? 42 : 30, requiredHeading, rect });
const leftGreen = (id: string, x: number, y: number): OBRGreenMarker => ({ id, rule: "left", x: x - 17, y: y - 17, width: 13, height: 13 });
const rightGreen = (id: string, x: number, y: number): OBRGreenMarker => ({ id, rule: "right", x: x + 4, y: y + 4, width: 13, height: 13 });

interface LayoutOptions {
  branches?: ArenaPoint[][]; gaps?: ArenaRect[]; floorMarkers?: OBRFloorMarker[]; greenMarkers?: OBRGreenMarker[];
  hazards?: OBRHazard[]; obstacles?: OBRArenaObstacle[]; start?: OBRStart; exitPath?: ArenaPoint[];
  requiredHazards?: string[]; requireHazardOrder?: boolean; maxCollisions?: number; timeLimit?: number;
  goal?: OBRChallengeGoal; successMessage?: string;
}

function makeLayout(level: ArenaLevel, number: number, title: string, objective: string, hint: string, mainPath: ArenaPoint[], options: LayoutOptions = {}): OBRLayout {
  const slug = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return {
    ...common, id: `${level}-${String(number).padStart(2, "0")}-${slug}`, name: `${levelNames[level]} ${number} · ${title}`, level,
    challenge: {
      number, title, objective, hint, successMessage: options.successMessage ?? `${title} concluído!`,
      requiredHazards: options.requiredHazards ?? [], requireHazardOrder: options.requireHazardOrder,
      maxCollisions: options.maxCollisions, timeLimit: options.timeLimit ?? 300, goal: options.goal ?? finishGoal(),
    },
    mainPath, exitPath: options.exitPath ?? common.exitPath, branches: options.branches ?? [], gaps: options.gaps ?? [],
    floorMarkers: options.floorMarkers ?? [], greenMarkers: options.greenMarkers ?? [], hazards: options.hazards ?? [],
    obstacles: options.obstacles ?? [], start: options.start ?? { x: mainPath[0].x, y: mainPath[0].y, angle: 0 },
  };
}

const easyLayouts: OBRLayout[] = [
  makeLayout("easy", 1, "Parada de precisão", "Siga a linha e pare completamente sobre a pequena estação vermelha por 3 segundos.", "Não use apenas tempo: leia a cor vermelha para decidir a hora de parar.",
    [{x:70,y:510},{x:230,y:510},{x:280,y:460},{x:280,y:370},{x:400,y:370},{x:455,y:315},{x:610,y:315}],
    { floorMarkers:[m("e1-red","PARE","vermelho",610,315,32,36)], goal:goal(610,315,"Pare 3 segundos na estação vermelha",3), timeLimit:90 }),
  makeLayout("easy", 2, "Duas cores, uma decisão", "Depois de ler o azul, escolha o ramo de cima na próxima bifurcação; quando a linha terminar, saia dela e encontre a ilha amarela.", "O azul não é a chegada: ele ativa uma etapa. Guarde essa informação para decidir no cruzamento e depois navegue fora da linha.",
    [{x:70,y:510},{x:350,y:510},{x:350,y:380},{x:480,y:380}],
    { branches:[[{x:350,y:510},{x:525,y:510}]], floorMarkers:[m("e2-blue","ATIVE","azul",180,510,36,30),m("e2-wrong","X","vermelho",525,510,32,36),m("e2-launch","SAIA","prata",480,380,38,34),m("e2-yellow","FIM","amarelo",585,275,44,44)], hazards:[h("e2-blue-check","Comando azul memorizado",180,510),h("e2-launch-check","Ramo correto concluído",480,380)], requiredHazards:["e2-blue-check","e2-launch-check"], requireHazardOrder:true, goal:goal(585,275,"Após o azul, saia da linha e pare na ilha amarela",3), timeLimit:130 }),
  makeLayout("easy", 3, "Travessia em campo aberto", "Siga a linha até a faixa prateada, atravesse a grande área branca na diagonal e reencontre a pista na faixa azul.", "Quando a linha acabar, memorize o ângulo e a distância com giroscópio e rotações; procurar preto girando não aponta para a saída.",
    [{x:70,y:500},{x:220,y:500},{x:450,y:350},{x:620,y:350}],
    { gaps:[{x:210,y:320,width:265,height:205}], floorMarkers:[m("e3-silver","PARTA","prata",205,500,40,32),m("e3-blue","ACHE","azul",490,350,38,32),m("e3-red","FIM","vermelho",620,350,32,36)], hazards:[h("e3-launch","Entrada do campo aberto",205,500),h("e3-rejoin","Linha reencontrada",490,350)], requiredHazards:["e3-launch","e3-rejoin"], requireHazardOrder:true, goal:goal(620,350,"Atravesse o branco, reencontre a linha e pare",3), maxCollisions:0, timeLimit:130 }),
  makeLayout("easy", 4, "Alvo fora da pista", "Siga todas as curvas até a plataforma azul; dali, abandone a linha preta e navegue pelo piso branco até o alvo vermelho isolado.", "A plataforma azul é o ponto de lançamento. Depois dela, use ângulo e rotações para alcançar o alvo que não está ligado à pista.",
    [{x:70,y:510},{x:165,y:510},{x:215,y:460},{x:165,y:410},{x:215,y:360},{x:165,y:310},{x:300,y:310},{x:355,y:365},{x:420,y:310}],
    { floorMarkers:[m("e4-launch","SAIA","azul",420,310,40,34),m("e4-red","ALVO","vermelho",600,185,48,48)], hazards:[h("e4-launch-check","Plataforma de lançamento alcançada",420,310)], requiredHazards:["e4-launch-check"], goal:goal(600,185,"Saia da linha e pare 3 segundos no alvo vermelho",3), maxCollisions:0, timeLimit:120 }),
  makeLayout("easy", 5, "Volta ao ponto de partida", "Confirme o ponto azul mais distante e retorne à estação amarela perto da partida.", "O alvo está perto desde o começo, mas só fica válido depois que o azul for visitado.",
    [{x:70,y:510},{x:300,y:510},{x:300,y:285},{x:105,y:285},{x:105,y:465}],
    { floorMarkers:[m("e5-blue","VOLTA","azul",300,285,34,34),m("e5-yellow","FIM","amarelo",105,465,32,36)], hazards:[h("e5-far","Ponto mais distante alcançado",300,285)], requiredHazards:["e5-far"], goal:goal(105,465,"Complete a volta e pare no amarelo"), timeLimit:120 }),
  makeLayout("easy", 6, "A bifurcação enganosa", "Ignore o caminho vermelho sem saída e encontre a chegada azul.", "Um sensor em cada lado permite perceber qual ramo continua depois do cruzamento.",
    [{x:70,y:510},{x:270,y:510},{x:270,y:350},{x:470,y:350},{x:570,y:250}],
    { branches:[[{x:270,y:510},{x:430,y:510}]], floorMarkers:[m("e6-wrong","X","vermelho",430,510,32,36),m("e6-right","FIM","azul",570,250,32,36)], hazards:[h("e6-correct","Ramo correto escolhido",420,350)], requiredHazards:["e6-correct"], goal:goal(570,250,"Escolha o ramo correto e pare no azul"), timeLimit:100 }),
  makeLayout("easy", 7, "Partida ao contrário", "O robô começa olhando para trás: alinhe-se antes de seguir até o alvo amarelo.", "Use o giroscópio ou uma rotação controlada; avançar imediatamente leva à borda.",
    [{x:70,y:510},{x:250,y:510},{x:320,y:440},{x:460,y:440},{x:540,y:360}],
    { start:{x:70,y:510,angle:Math.PI}, floorMarkers:[m("e7-yellow","FIM","amarelo",540,360,32,36)], hazards:[h("e7-align","Alinhamento inicial concluído",150,510,5,0)], requiredHazards:["e7-align"], goal:goal(540,360,"Corrija a orientação e pare no amarelo"), maxCollisions:0, timeLimit:100 }),
  makeLayout("easy", 8, "Oito completo", "Percorra os dois laços na ordem azul, amarelo e termine no vermelho.", "No cruzamento central, conte qual marcador já foi visto para escolher o próximo laço.",
    [{x:70,y:500},{x:230,y:500},{x:330,y:400},{x:430,y:300},{x:530,y:400},{x:430,y:500},{x:330,y:400},{x:230,y:300},{x:130,y:400},{x:230,y:500},{x:590,y:500}],
    { floorMarkers:[m("e8-blue","1","azul",430,300),m("e8-yellow","2","amarelo",230,300),m("e8-red","FIM","vermelho",590,500,32,36)], hazards:[h("e8-a","Primeiro laço concluído",430,300),h("e8-b","Segundo laço concluído",230,300)], requiredHazards:["e8-a","e8-b"], requireHazardOrder:true, goal:goal(590,500,"Complete os laços e pare no vermelho"), timeLimit:140 }),
  makeLayout("easy", 9, "Sequência cromática", "Leia azul, amarelo e azul novamente, nessa ordem, antes de parar no vermelho.", "A mesma cor azul aparece duas vezes: use uma etapa ou contador para saber em qual delas está.",
    [{x:70,y:510},{x:200,y:510},{x:255,y:455},{x:360,y:455},{x:415,y:400},{x:510,y:400},{x:565,y:345},{x:625,y:345}],
    { floorMarkers:[m("e9-a","1","azul",200,510),m("e9-b","2","amarelo",360,455),m("e9-c","3","azul",510,400),m("e9-end","FIM","vermelho",625,345,32,36)], hazards:[h("e9-ha","Primeiro azul",200,510),h("e9-hb","Amarelo",360,455),h("e9-hc","Segundo azul",510,400)], requiredHazards:["e9-ha","e9-hb","e9-hc"], requireHazardOrder:true, goal:goal(625,345,"Respeite a sequência e pare no vermelho"), timeLimit:100 }),
  makeLayout("easy", 10, "Linha fantasma", "Atravesse longos trechos sem linha usando memória de direção e reencontre o traçado três vezes.", "Quando ambos os sensores enxergarem branco, mantenha o rumo com o giroscópio.",
    [{x:70,y:510},{x:240,y:510},{x:310,y:440},{x:455,y:440},{x:525,y:370},{x:630,y:370}],
    { gaps:[{x:130,y:493,width:72,height:34},{x:335,y:423,width:78,height:34},{x:535,y:353,width:62,height:34}], floorMarkers:[m("e10-red","FIM","vermelho",630,370,32,36)], hazards:[ev("e10-a","gap","Primeiro trecho fantasma",220,510),ev("e10-b","gap","Segundo trecho fantasma",430,440),ev("e10-c","gap","Terceiro trecho fantasma",610,370)], requiredHazards:["e10-a","e10-b","e10-c"], goal:goal(630,370,"Reencontre a linha 3 vezes e pare"), maxCollisions:0, timeLimit:120 }),
];

const mediumLayouts: OBRLayout[] = [
  makeLayout("medium",1,"Desvio solitário","Detecte o bloco vermelho, contorne-o e retorne à linha antes da estação azul.","O ultrassom decide quando sair da linha; a cor ajuda a encontrá-la novamente.",[{x:70,y:510},{x:610,y:510}],{obstacles:[{x:315,y:486,width:46,height:48}],floorMarkers:[m("m1-end","FIM","azul",610,510,32,36)],hazards:[ev("m1-ob","obstacle","Obstáculo contornado",405,510,20)],requiredHazards:["m1-ob"],goal:goal(610,510,"Contorne o bloco e pare no azul"),maxCollisions:0,timeLimit:100}),
  makeLayout("medium",2,"Desvios alternados","Contorne dois blocos por lados opostos e confirme os dois portões amarelos.","O segundo desvio é o espelho do primeiro.",[{x:70,y:500},{x:625,y:500}],{obstacles:[{x:235,y:478,width:42,height:44},{x:425,y:478,width:42,height:44}],floorMarkers:[m("m2-a","1","amarelo",330,500),m("m2-b","2","amarelo",520,500),m("m2-end","FIM","azul",625,500,32,36)],hazards:[h("m2-ha","Primeiro desvio",330,500),h("m2-hb","Segundo desvio",520,500)],requiredHazards:["m2-ha","m2-hb"],requireHazardOrder:true,goal:goal(625,500,"Supere os dois blocos e pare no azul"),maxCollisions:0,timeLimit:120}),
  makeLayout("medium",3,"Túnel estreito","Atravesse o túnel laranja sem tocar nas laterais e pare na saída verde.","Dois sensores laterais permitem centralizar o robô pela diferença das leituras.",[{x:70,y:470},{x:620,y:470}],{obstacles:[{x:270,y:405,width:180,height:34,colour:"#596873",sensorColour:"branco"},{x:270,y:501,width:180,height:34,colour:"#596873",sensorColour:"branco"}],floorMarkers:[m("m3-end","FIM","verde",620,470,32,36)],hazards:[ev("m3-tunnel","passage","Túnel atravessado",470,470,20)],requiredHazards:["m3-tunnel"],goal:goal(620,470,"Atravesse sem colisão e pare no verde"),maxCollisions:0,timeLimit:90}),
  makeLayout("medium",4,"Navegação sem linha","Use a parede lateral como referência durante o grande trecho branco.","Mantenha a distância lateral constante até a linha reaparecer.",[{x:70,y:500},{x:620,y:500}],{gaps:[{x:185,y:478,width:300,height:44}],obstacles:[{x:170,y:390,width:350,height:30,colour:"#65737c",sensorColour:"branco"}],floorMarkers:[m("m4-end","FIM","vermelho",620,500,32,36)],hazards:[ev("m4-wall","gap","Trecho guiado pela parede",510,500,25)],requiredHazards:["m4-wall"],goal:goal(620,500,"Siga a parede e pare no vermelho"),maxCollisions:0,timeLimit:100}),
  makeLayout("medium",5,"Portão da cor certa","No cruzamento, escolha o ramo azul; o amarelo termina bloqueado.","Leia a faixa antes de comprometer a curva.",[{x:70,y:500},{x:280,y:500},{x:280,y:340},{x:560,y:340}],{branches:[[{x:280,y:500},{x:470,y:500}]],obstacles:[{x:470,y:478,width:42,height:44}],floorMarkers:[m("m5-blue","AZUL","azul",280,410,32,26),m("m5-yellow","X","amarelo",380,500),m("m5-end","FIM","verde",560,340,32,36)],hazards:[h("m5-right","Portão azul escolhido",280,390,20,-Math.PI/2)],requiredHazards:["m5-right"],goal:goal(560,340,"Escolha o azul e pare no verde"),maxCollisions:0,timeLimit:100}),
  makeLayout("medium",6,"Estacionamento de ré","Passe pelo azul e estacione de ré na vaga amarela, voltado para a esquerda.","Confirme 180° no giroscópio e use velocidade negativa.",[{x:70,y:500},{x:430,y:500},{x:520,y:410},{x:600,y:410}],{floorMarkers:[m("m6-blue","PORTÃO","azul",430,500,34,28),m("m6-yellow","VAGA","amarelo",600,410,44,50)],hazards:[h("m6-gate","Portão azul atravessado",430,500)],requiredHazards:["m6-gate"],goal:goal(600,410,"Estacione de ré na vaga amarela",3,Math.PI),maxCollisions:0,timeLimit:120}),
  makeLayout("medium",7,"Pare depois do desvio","Desvie do bloco e pare apenas na segunda faixa amarela.","Conte as faixas; a cor sozinha não distingue a primeira da segunda.",[{x:70,y:500},{x:625,y:500}],{obstacles:[{x:300,y:478,width:46,height:44}],floorMarkers:[m("m7-a","1","amarelo",180,500),m("m7-b","2","amarelo",570,500,32,36)],hazards:[h("m7-first","Primeira faixa ignorada",180,500),ev("m7-ob","obstacle","Bloco desviado",390,500,20)],requiredHazards:["m7-first","m7-ob"],requireHazardOrder:true,goal:goal(570,500,"Pare só na segunda faixa amarela"),maxCollisions:0,timeLimit:100}),
  makeLayout("medium",8,"Chicane de três blocos","Passe alternando esquerda, direita e esquerda sem encostar.","Divida a solução em três estados, um para cada bloco.",[{x:70,y:500},{x:630,y:500}],{obstacles:[{x:220,y:455,width:42,height:58},{x:370,y:487,width:42,height:58},{x:520,y:455,width:42,height:58}],floorMarkers:[m("m8-end","FIM","vermelho",630,500,32,36)],hazards:[h("m8-a","Primeiro bloco",295,500),h("m8-b","Segundo bloco",445,500),h("m8-c","Terceiro bloco",600,500)],requiredHazards:["m8-a","m8-b","m8-c"],requireHazardOrder:true,goal:goal(630,500,"Complete a chicane e pare"),maxCollisions:0,timeLimit:110}),
  makeLayout("medium",9,"Corredor de duas linhas","Mantenha o robô no espaço branco entre duas linhas paralelas.","Cada sensor vigia uma borda diferente.",[{x:70,y:470},{x:620,y:470}],{branches:[[{x:70,y:530},{x:620,y:530}]],start:{x:70,y:500,angle:0},floorMarkers:[m("m9-end","FIM","azul",620,500,32,42)],hazards:[ev("m9-corridor","passage","Corredor percorrido",500,500,20)],requiredHazards:["m9-corridor"],goal:goal(620,500,"Fique entre as linhas e pare no azul"),maxCollisions:0,timeLimit:90}),
  makeLayout("medium",10,"Entrega em ordem","Visite azul, amarelo e verde nessa ordem antes de entregar no vermelho.","Use estados: a próxima cor esperada determina o caminho.",[{x:70,y:510},{x:220,y:510},{x:220,y:380},{x:390,y:380},{x:390,y:260},{x:570,y:260}],{branches:[[{x:220,y:510},{x:390,y:510},{x:390,y:380}],[{x:390,y:380},{x:540,y:380}]],floorMarkers:[m("m10-a","1","azul",220,430),m("m10-b","2","amarelo",390,500),m("m10-c","3","verde",500,380),m("m10-end","FIM","vermelho",570,260,32,36)],hazards:[h("m10-ha","Entrega azul",220,430),h("m10-hb","Entrega amarela",390,500),h("m10-hc","Entrega verde",500,380)],requiredHazards:["m10-ha","m10-hb","m10-hc"],requireHazardOrder:true,goal:goal(570,260,"Complete as entregas e pare"),timeLimit:150}),
];

const hardLayouts: OBRLayout[] = [
  makeLayout("hard",1,"Verde manda à esquerda","Ao encontrar o verde no canto, abandone o ramo reto e vire à esquerda.","Leia o verde antes do centro e confirme a curva no giroscópio.",[{x:70,y:510},{x:280,y:510},{x:280,y:310},{x:560,y:310}],{branches:[[{x:280,y:510},{x:455,y:510}]],greenMarkers:[leftGreen("h1-green",280,510)],floorMarkers:[m("h1-end","FIM","vermelho",560,310,32,36)],hazards:[ev("h1-turn","intersection","Regra verde à esquerda",280,440,20,-Math.PI/2)],requiredHazards:["h1-turn"],goal:goal(560,310,"Vire à esquerda e pare"),timeLimit:100}),
  makeLayout("hard",2,"Verde manda à direita","No canto verde, escolha o ramo à direita e ignore a continuação vertical.","Interprete o lado em que o verde aparece antes da linha.",[{x:70,y:510},{x:250,y:510},{x:250,y:370},{x:560,y:370}],{branches:[[{x:250,y:370},{x:250,y:250}]],greenMarkers:[rightGreen("h2-green",250,370)],floorMarkers:[m("h2-end","FIM","azul",560,370,32,36)],hazards:[ev("h2-turn","intersection","Regra verde à direita",330,370,20,0)],requiredHazards:["h2-turn"],goal:goal(560,370,"Vire à direita e pare"),timeLimit:100}),
  makeLayout("hard",3,"Verde depois: siga reto","Atravesse em linha reta porque o verde aparece depois da linha preta.","Não reaja a qualquer verde: compare sua posição com o cruzamento.",[{x:70,y:470},{x:600,y:470}],{branches:[[{x:330,y:350},{x:330,y:540}]],greenMarkers:[{id:"h3-green",rule:"straight",x:338,y:478,width:13,height:13}],floorMarkers:[m("h3-end","FIM","vermelho",600,470,32,36)],hazards:[ev("h3-straight","intersection","Cruzamento reto concluído",400,470,20,0)],requiredHazards:["h3-straight"],goal:goal(600,470,"Siga reto e pare"),timeLimit:90}),
  makeLayout("hard",4,"Beco sem saída","Detecte verde dos dois lados, retorne 180° e volte à estação amarela.","Alcance o fundo antes de retornar e use o giroscópio.",[{x:70,y:500},{x:560,y:500}],{greenMarkers:[{id:"h4-a",rule:"dead-end",x:535,y:483,width:13,height:13},{id:"h4-b",rule:"dead-end",x:535,y:504,width:13,height:13}],floorMarkers:[m("h4-end","FIM","amarelo",110,500,32,36)],hazards:[h("h4-far","Fundo do beco alcançado",530,500),ev("h4-return","intersection","Retorno de 180 graus",440,500,20,Math.PI)],requiredHazards:["h4-far","h4-return"],requireHazardOrder:true,goal:goal(110,500,"Retorne e pare no amarelo",3,Math.PI),timeLimit:120}),
  makeLayout("hard",5,"As quatro regras verdes","Resolva esquerda, direita, reto e beco sem saída na mesma pista.","Crie uma decisão separada para cada posição possível do verde.",[{x:70,y:510},{x:220,y:510},{x:220,y:420},{x:500,y:420},{x:500,y:300},{x:575,y:220},{x:650,y:220}],{branches:[[{x:220,y:510},{x:310,y:510}],[{x:220,y:420},{x:220,y:345}],[{x:390,y:420},{x:390,y:335}],[{x:330,y:335},{x:450,y:335}]],greenMarkers:[leftGreen("h5-left",220,510),rightGreen("h5-right",220,420),{id:"h5-straight",rule:"straight",x:394,y:403,width:13,height:13},{id:"h5-dead-a",rule:"dead-end",x:373,y:339,width:13,height:13},{id:"h5-dead-b",rule:"dead-end",x:394,y:339,width:13,height:13}],hazards:[ev("h5-a","intersection","Verde à esquerda",220,470,10,-Math.PI/2),ev("h5-b","intersection","Verde à direita",270,420,10,0),ev("h5-c","intersection","Verde depois: reto",430,420,10,0),ev("h5-d","intersection","Beco sem saída",390,370,10,Math.PI/2)],requiredHazards:["h5-a","h5-b","h5-c","h5-d"],requireHazardOrder:true,goal:finishGoal(),timeLimit:180}),
  makeLayout("hard",6,"Labirinto de cores","Visite azul, amarelo e verde na ordem usando três cruzamentos.","Trate cada cor como instrução e avance o estado ao confirmar a estação.",[{x:70,y:510},{x:220,y:510},{x:220,y:370},{x:390,y:370},{x:390,y:240},{x:600,y:240}],{branches:[[{x:220,y:510},{x:400,y:510}],[{x:390,y:370},{x:550,y:370}],[{x:390,y:240},{x:260,y:240}]],floorMarkers:[m("h6-a","1","azul",220,430),m("h6-b","2","amarelo",500,370),m("h6-c","3","verde",310,240),m("h6-end","FIM","vermelho",600,240,32,36)],hazards:[h("h6-ha","Azul confirmado",220,430),h("h6-hb","Amarelo confirmado",500,370),h("h6-hc","Verde confirmado",310,240)],requiredHazards:["h6-ha","h6-hb","h6-hc"],requireHazardOrder:true,goal:goal(600,240,"Resolva o labirinto e pare"),timeLimit:180}),
  makeLayout("hard",7,"Desafio multissensor","Supere gap, obstáculo, sinal verde e lombada sem colisões.","Cores cuidam da pista, ultrassom do bloco e giroscópio das manobras.",[{x:70,y:510},{x:240,y:510},{x:300,y:450},{x:460,y:450},{x:520,y:390},{x:520,y:280},{x:650,y:220}],{gaps:[{x:125,y:495,width:55,height:30}],obstacles:[{x:340,y:425,width:44,height:50}],greenMarkers:[leftGreen("h7-green",520,390)],hazards:[ev("h7-gap","gap","Gap superado",205,510),ev("h7-ob","obstacle","Obstáculo desviado",420,450,20),ev("h7-rule","intersection","Sinal verde resolvido",520,335,15,-Math.PI/2),ev("h7-bump","bump","Lombada superada",585,250,10)],requiredHazards:["h7-gap","h7-ob","h7-rule","h7-bump"],requireHazardOrder:true,goal:finishGoal(),maxCollisions:0,timeLimit:180}),
  makeLayout("hard",8,"Entrada da sala","Encontre o portão prateado, entre sem bater e pare na área verde.","Dentro da sala combine giroscópio, distância e cor do chão.",[{x:70,y:510},{x:220,y:510},{x:300,y:430},{x:460,y:430},{x:540,y:350},{x:540,y:220},{x:650,y:220}],{floorMarkers:[m("h8-goal","RESGATE","verde",705,110,48,48)],hazards:[h("h8-silver","Portão prateado atravessado",675,220,20)],requiredHazards:["h8-silver"],goal:goal(705,110,"Entre e pare na área verde",3),maxCollisions:0,timeLimit:180}),
  makeLayout("hard",9,"Saída da sala","Partindo dentro da sala, localize o portão preto, saia e pare no vermelho.","Use distância para as paredes e preto para confirmar a saída.",[{x:760,y:180},{x:815,y:260},{x:815,y:340}],{start:{x:760,y:180,angle:Math.PI/2},hazards:[h("h9-black","Portão preto atravessado",815,370,20,Math.PI/2)],requiredHazards:["h9-black"],goal:finishGoal(),maxCollisions:0,timeLimit:120}),
  makeLayout("hard",10,"Missão final integrada","Complete gaps, verdes, obstáculo, lombada, sala de resgate e chegada.","Organize decisões pequenas e teste cada sensor; esta pista reúne tudo.",[{x:70,y:510},{x:190,y:510},{x:190,y:410},{x:360,y:410},{x:430,y:340},{x:520,y:340},{x:580,y:260},{x:650,y:220}],{branches:[[{x:190,y:510},{x:300,y:510}],[{x:360,y:410},{x:360,y:300}]],gaps:[{x:105,y:495,width:48,height:30}],obstacles:[{x:445,y:314,width:42,height:48}],greenMarkers:[leftGreen("h10-left",190,510),{id:"h10-straight",rule:"straight",x:364,y:393,width:13,height:13}],hazards:[ev("h10-gap","gap","Gap final",170,510),ev("h10-left","intersection","Curva verde",190,455,10,-Math.PI/2),ev("h10-st","intersection","Cruzamento reto",405,390,10,0),ev("h10-ob","obstacle","Obstáculo final",515,330,20),ev("h10-bump","bump","Lombada final",600,248,10),h("h10-silver","Sala alcançada",680,220,20),h("h10-black","Saída preta",815,370,20,Math.PI/2)],requiredHazards:["h10-gap","h10-left","h10-st","h10-ob","h10-bump","h10-silver","h10-black"],requireHazardOrder:true,goal:finishGoal(),maxCollisions:0,timeLimit:300,successMessage:"Missão final completa: todos os problemas foram resolvidos!"}),
];

const layoutsByLevel: Record<ArenaLevel, OBRLayout[]> = { easy: easyLayouts, medium: mediumLayouts, hard: hardLayouts };

export function getArenaChallenges(level: ArenaLevel): OBRChallenge[] {
  return layoutsByLevel[level].map((layout) => structuredClone(layout.challenge));
}

export function createOBRLayout(layoutIndex = 0, level: ArenaLevel = "easy"): OBRLayout {
  const layouts = layoutsByLevel[level];
  return structuredClone(layouts[Math.abs(Math.trunc(layoutIndex)) % layouts.length]);
}
