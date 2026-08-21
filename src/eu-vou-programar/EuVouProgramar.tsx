import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import BlockEditor from "./BlockEditor";
import type { BlockEditorHandle } from "./BlockEditor";
import RobotBuilder from "./RobotBuilder";
import { createEmptyBlocks, createExampleBlocks, EMPTY_BLOCK_CODE } from "./blocks";
import { copyTextToClipboard } from "./editorClipboard";
import { pythonToBlocks, PythonBlocksError } from "./pythonBlocks";
import { ARENA_CHALLENGE_COUNT, getArenaChallenges } from "./obrArena";
import type { ArenaLevel, OBRChallenge } from "./obrArena";
import { initialMissionUnlocks, normalizeMissionUnlocks, unlockFromCompletedMissions, unlockMissionAfterSuccess } from "./missionProgress";
import {
  cloneHardware,
  createLineFollowerHardware,
  DEFAULT_HARDWARE,
  HardwareConfig,
  isRobotReady,
  MOTOR_DEFINITIONS,
  MOTOR_PORTS,
  normalizeHardware,
  SENSOR_DEFINITIONS,
  SENSOR_POSITION_DEFINITIONS,
  SENSOR_PORTS,
} from "./hardware";
import {
  advanceWorld,
  createRunner,
  createWorld,
  drawWorld,
  hasActiveDrivePower,
  parseProgram,
  ProgramError,
  restartRound,
  sensorDistance,
  stepRunner,
} from "./simulator";
import type { GameLog, LogLevel, RunnerState, WorldState } from "./simulator";

const STORAGE_KEY = "eu-vou-programar:robot-v2.py";
const BLOCKS_STORAGE_KEY = "eu-vou-programar:ev3-blocks-v2.xml";
const HARDWARE_STORAGE_KEY = "eu-vou-programar:ev3-hardware";
const MODE_STORAGE_KEY = "eu-vou-programar:editor-mode-v2";
const ARENA_STORAGE_KEY = "eu-vou-programar:arena-level";
const CHALLENGE_STORAGE_KEY = "eu-vou-programar:arena-challenge";
const UNLOCKED_MISSIONS_STORAGE_KEY = "eu-vou-programar:unlocked-missions-v1";
const DRAFT_UPDATED_STORAGE_KEY = "eu-vou-programar:draft-updated-at";
const examples = {
  avancar: `from sbot import motors, utils, leds

# Acenda o LED dourado
leds.set_rgb(0, 223, 153, 32)

# Os dois motores com a mesma força
motors.set_power(1, 0.6)
motors.set_power(2, 0.6)
utils.sleep(3.6)

# Pare ao chegar na estrela
motors.set_power(1, 0)
motors.set_power(2, 0)
print("Cheguei na estrela!")`,
  curva: `from sbot import motors, utils

# Potências diferentes fazem uma curva
motors.set_power(1, 0.35)
motors.set_power(2, 0.8)
utils.sleep(1.4)

motors.set_power(1, 0)
motors.set_power(2, 0)
print("Curva concluída!")`,
  sensor: `from sbot import arduino, motors, utils

# Pinos 2 e 3 medem a frente do robô
distancia = arduino.measure_ultrasound_distance(2, 3)
print(f"Distância: {distancia} mm")

if distancia > 500:
    motors.set_power(1, 0.5)
    motors.set_power(2, 0.5)
    utils.sleep(1)
else:
    print("Obstáculo muito perto!")

motors.set_power(1, 0)
motors.set_power(2, 0)`,
  seguidor: `from sbot import motors, utils, ev3

# Porta 4: sensor de cor da frente esquerda, apontado para o chão
# Porta 2: sensor de cor da frente direita, apontado para o chão
while True:
    cor_esquerda = ev3.color("4")
    cor_direita = ev3.color("2")

    if (cor_esquerda == "vermelho") or (cor_direita == "vermelho"):
        motors.set_power(1, 0.20)
        motors.set_power(2, 0.20)
        utils.sleep(1.5)
        motors.set_power(1, 0)
        motors.set_power(2, 0)
        utils.sleep(3.2)
    else:
        if (cor_esquerda == "preto") and (cor_direita == "branco"):
            motors.set_power(1, 0.42)
            motors.set_power(2, 0.08)
        else:
            if (cor_esquerda == "branco") and (cor_direita == "preto"):
                motors.set_power(1, 0.08)
                motors.set_power(2, 0.42)
            else:
                motors.set_power(1, 0.32)
                motors.set_power(2, 0.32)
    utils.sleep(0.02)`,
};

type Status = "ready" | "running" | "paused" | "complete" | "success" | "error";
type EditorTab = "blocks" | "code" | "console";
type ProgramMode = "blocks" | "code";
type SyncStatus = "loading" | "local" | "saving" | "saved" | "offline";
type CopyStatus = "idle" | "working" | "code" | "image" | "shared" | "downloaded" | "error";

const ARENA_LEVELS: Record<ArenaLevel, { number: number; name: string; short: string; description: string }> = {
  beginner: { number: 1, name: "Nível muito fácil", short: "Muito Fácil", description: "Pista branca sem linha-guia" },
  easy: { number: 2, name: "Nível fácil", short: "Fácil", description: "Linha preta com muitas curvas" },
  medium: { number: 3, name: "Nível médio", short: "Médio", description: "Curvas seguidas, gap e obstáculo" },
  hard: { number: 4, name: "Nível avançado", short: "Avançado", description: "Gap, sinais verdes, cruzamentos e lombada" },
};

const statusLabels: Record<Status, string> = {
  ready: "Pronto!",
  running: "Executando",
  paused: "Pausado",
  complete: "Concluído",
  success: "Missão cumprida!",
  error: "Revise o código",
};

function isArenaLevel(value: unknown): value is ArenaLevel {
  return value === "beginner" || value === "easy" || value === "medium" || value === "hard";
}

function isProgramMode(value: unknown): value is ProgramMode {
  return value === "blocks" || value === "code";
}

function hasChallengeHardware(config: HardwareConfig, requirement: OBRChallenge["hardwareRequirement"]) {
  if (requirement !== "dual-outward-colour") return true;
  return (["left", "right"] as const).every((side) => SENSOR_PORTS.some((port) => {
    const mount = config.sensorMounts[port];
    return config.sensors[port] === "color" && mount?.position === side && mount.aim === "outward";
  }));
}

export default function EuVouProgramar() {
  const { sessionId, playerCode, playerName, registerIdentity } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const expandedCanvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<WorldState>(createWorld());
  const runnerRef = useRef<RunnerState | null>(null);
  const runningRef = useRef(false);
  const speedRef = useRef(1);
  const logCounterRef = useRef(0);
  const successHandledRef = useRef(false);
  const hardwareRef = useRef<HardwareConfig>(cloneHardware(DEFAULT_HARDWARE));
  const bestProgressScoreRef = useRef({ tilePoints: 0, challengePoints: 0, totalPoints: 0 });
  const blockEditorRef = useRef<BlockEditorHandle>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const copyResetTimerRef = useRef(0);

  const [programXml, setProgramXml] = useState(() => createEmptyBlocks());
  const [code, setCode] = useState(EMPTY_BLOCK_CODE);
  const [storageReady, setStorageReady] = useState(false);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [status, setStatus] = useState<Status>("ready");
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [editorTab, setEditorTab] = useState<EditorTab>("blocks");
  const [programMode, setProgramMode] = useState<ProgramMode>("blocks");
  const [blockProgramReady, setBlockProgramReady] = useState(false);
  const [blockSyncError, setBlockSyncError] = useState("");
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [telemetry, setTelemetry] = useState({ left: 0, right: 0, ultrasound: 0, bumped: false });
  const [hardware, setHardware] = useState<HardwareConfig>(() => cloneHardware(DEFAULT_HARDWARE));
  const [builderOpen, setBuilderOpen] = useState(false);
  const [arenaHidden, setArenaHidden] = useState(false);
  const [arenaExpanded, setArenaExpanded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [arenaLevel, setArenaLevel] = useState<ArenaLevel>("beginner");
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [unlockedMissions, setUnlockedMissions] = useState(initialMissionUnlocks);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [identityName, setIdentityName] = useState(playerName || "");
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [competitionView, setCompetitionView] = useState({
    remaining: 90,
    tilePoints: 5,
    challengePoints: 0,
    scoredTileCount: 1,
    scoredHazards: [] as string[],
    collisionCount: 0,
    victimTouches: 0,
    layoutName: "Muito Fácil 1 · Primeiros metros",
    lastEvent: "Ponto de partida: +5 pontos",
  });

  const addLog = useCallback((message: string, level: LogLevel = "info") => {
    logCounterRef.current += 1;
    const next = { id: logCounterRef.current, level, message };
    setLogs((current) => [...current.slice(-39), next]);
  }, []);

  useEffect(() => {
    if (playerName) setIdentityName(playerName);
  }, [playerName]);

  const handleIdentitySubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = identityName.trim();
    if (name.length < 2) {
      setIdentityError("Digite um nome com pelo menos 2 caracteres.");
      return;
    }

    setIdentitySaving(true);
    setIdentityError("");
    try {
      await registerIdentity(name);
    } catch {
      setIdentityError("Não foi possível registrar agora. Verifique sua conexão e tente novamente.");
    } finally {
      setIdentitySaving(false);
    }
  }, [identityName, registerIdentity]);

  useEffect(() => {
    if (!arenaExpanded && !legendOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (legendOpen) setLegendOpen(false);
      else setArenaExpanded(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [arenaExpanded, legendOpen]);

  useEffect(() => {
    if (!playerName?.trim()) {
      setStorageReady(false);
      return;
    }

    let cancelled = false;

    const hydrateProgress = async () => {
      setStorageReady(false);
      setSyncStatus("loading");
      bestProgressScoreRef.current = { tilePoints: 0, challengePoints: 0, totalPoints: 0 };

      const savedBlocks = window.localStorage.getItem(BLOCKS_STORAGE_KEY);
      const savedCode = window.localStorage.getItem(STORAGE_KEY);
      const savedMode = window.localStorage.getItem(MODE_STORAGE_KEY);
      const savedHardware = window.localStorage.getItem(HARDWARE_STORAGE_KEY);
      const savedArena = window.localStorage.getItem(ARENA_STORAGE_KEY);
      const savedChallenge = Number.parseInt(window.localStorage.getItem(CHALLENGE_STORAGE_KEY) || "0", 10);
      const savedUnlocks = window.localStorage.getItem(UNLOCKED_MISSIONS_STORAGE_KEY);
      const localUpdatedAt = Date.parse(window.localStorage.getItem(DRAFT_UPDATED_STORAGE_KEY) || "") || 0;

      let nextBlocks = savedBlocks?.startsWith("<xml") ? savedBlocks : createEmptyBlocks();
      let nextCode = savedCode || EMPTY_BLOCK_CODE;
      let nextMode: ProgramMode = isProgramMode(savedMode) ? savedMode : "blocks";
      let nextHardware = cloneHardware(DEFAULT_HARDWARE);
      let nextArena: ArenaLevel = isArenaLevel(savedArena) ? savedArena : "beginner";
      const nextChallenge = Number.isFinite(savedChallenge) ? Math.max(0, Math.min(ARENA_CHALLENGE_COUNT - 1, savedChallenge)) : 0;
      let nextUnlocks = initialMissionUnlocks();

      if (savedUnlocks) {
        try {
          nextUnlocks = normalizeMissionUnlocks(JSON.parse(savedUnlocks), ARENA_CHALLENGE_COUNT);
        } catch {
          window.localStorage.removeItem(UNLOCKED_MISSIONS_STORAGE_KEY);
        }
      }

      if (savedHardware) {
        try {
          nextHardware = normalizeHardware(JSON.parse(savedHardware));
        } catch {
          window.localStorage.removeItem(HARDWARE_STORAGE_KEY);
        }
      }

      const [progressResult, scoresResult] = await Promise.all([
        supabase
          .from("programming_progress")
          .select("program_xml, python_code, hardware_config, arena_level, program_mode, tile_points, challenge_points, total_points, updated_at")
          .eq("session_id", sessionId)
          .maybeSingle(),
        supabase
          .from("programming_scores")
          .select("arena_level, challenge_number")
          .eq("session_id", sessionId),
      ]);
      const { data, error } = progressResult;
      nextUnlocks = unlockFromCompletedMissions(nextUnlocks, scoresResult.data ?? [], ARENA_CHALLENGE_COUNT);

      if (cancelled) return;

      if (data && Date.parse(data.updated_at) > localUpdatedAt) {
        if (data.program_xml.startsWith("<xml")) nextBlocks = data.program_xml;
        nextCode = data.python_code || EMPTY_BLOCK_CODE;
        nextHardware = normalizeHardware(data.hardware_config as unknown as HardwareConfig);
        if (isArenaLevel(data.arena_level)) nextArena = data.arena_level;
        if (isProgramMode(data.program_mode)) nextMode = data.program_mode;
      }
      if (data) {
        bestProgressScoreRef.current = {
          tilePoints: data.tile_points,
          challengePoints: data.challenge_points,
          totalPoints: data.total_points,
        };
      }

      if (nextMode === "code") {
        try {
          nextBlocks = pythonToBlocks(nextCode);
        } catch {
          // Preserve the last valid block workspace when a saved Python draft is
          // incomplete or uses a command that Blockly cannot represent yet.
        }
      }

      hardwareRef.current = nextHardware;
      const accessibleChallenge = Math.min(nextChallenge, nextUnlocks[nextArena]);
      setHardware(nextHardware);
      setProgramXml(nextBlocks);
      setCode(nextCode);
      setProgramMode(nextMode);
      setEditorTab(nextMode === "code" ? "code" : "blocks");
      setArenaLevel(nextArena);
      setChallengeIndex(accessibleChallenge);
      setUnlockedMissions(nextUnlocks);
      worldRef.current = createWorld(nextHardware, accessibleChallenge, nextArena);
      setStorageReady(true);
      setSyncStatus(error ? "offline" : data ? "saved" : "local");
    };

    void hydrateProgress();
    return () => {
      cancelled = true;
    };
  }, [playerName, sessionId]);

  useEffect(() => {
    if (!storageReady) return;

    const updatedAt = new Date().toISOString();
    window.localStorage.setItem(STORAGE_KEY, code);
    window.localStorage.setItem(BLOCKS_STORAGE_KEY, programXml);
    window.localStorage.setItem(HARDWARE_STORAGE_KEY, JSON.stringify(hardware));
    window.localStorage.setItem(MODE_STORAGE_KEY, programMode);
    window.localStorage.setItem(ARENA_STORAGE_KEY, arenaLevel);
    window.localStorage.setItem(CHALLENGE_STORAGE_KEY, String(challengeIndex));
    window.localStorage.setItem(UNLOCKED_MISSIONS_STORAGE_KEY, JSON.stringify(unlockedMissions));
    window.localStorage.setItem(DRAFT_UPDATED_STORAGE_KEY, updatedAt);
    setSyncStatus("saving");

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const competition = worldRef.current.competition;
      const currentTotal = competition.tilePoints + competition.challengePoints;
      if (status === "success" && currentTotal >= bestProgressScoreRef.current.totalPoints) {
        bestProgressScoreRef.current = {
          tilePoints: competition.tilePoints,
          challengePoints: competition.challengePoints,
          totalPoints: currentTotal,
        };
      }
      const bestScore = bestProgressScoreRef.current;
      const { error } = await supabase.from("programming_progress").upsert({
        session_id: sessionId,
        program_xml: programXml,
        python_code: code,
        hardware_config: hardware as unknown as Json,
        arena_level: arenaLevel,
        program_mode: programMode,
        tile_points: bestScore.tilePoints,
        challenge_points: bestScore.challengePoints,
        total_points: bestScore.totalPoints,
        updated_at: updatedAt,
      });

      if (!cancelled) setSyncStatus(error ? "offline" : "saved");
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [arenaLevel, challengeIndex, code, hardware, programMode, programXml, sessionId, status, storageReady, unlockedMissions]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const saveProgrammingScore = useCallback(async (world: WorldState) => {
    const name = playerName?.trim();
    if (!name) return;

    const score = world.competition.tilePoints + world.competition.challengePoints;
    const level = world.layout.level;
    const challengeNumber = world.layout.challenge.number;
    const tilePoints = world.competition.tilePoints;
    const challengePoints = world.competition.challengePoints;
    const elapsedSeconds = world.competition.elapsed;

    try {
      const code = playerCode || await registerIdentity(name);
      const { data: previous } = await supabase
        .from("programming_scores")
        .select("score, elapsed_seconds")
        .eq("session_id", sessionId)
        .eq("arena_level", level)
        .eq("challenge_number", challengeNumber)
        .maybeSingle();

      const isBetter = !previous
        || score > previous.score
        || (score === previous.score && elapsedSeconds < previous.elapsed_seconds);
      if (!isBetter) return;

      await supabase.from("programming_scores").upsert({
        session_id: sessionId,
        player_name: name,
        player_code: code,
        arena_level: level,
        challenge_number: challengeNumber,
        score,
        tile_points: tilePoints,
        challenge_points: challengePoints,
        elapsed_seconds: elapsedSeconds,
        completed_at: new Date().toISOString(),
      }, { onConflict: "session_id,arena_level,challenge_number" });

    } catch {
      // O progresso geral continua salvo em programming_progress como fallback.
    }
  }, [playerCode, playerName, registerIdentity, sessionId]);

  useEffect(() => {
    if (!playerName?.trim()) return;

    let animationFrame = 0;
    let previous = performance.now();
    let telemetryAt = 0;

    const animate = (now: number) => {
      const realDelta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const world = worldRef.current;
      const runner = runnerRef.current;

      if (runningRef.current && runner) {
        try {
          const simulationDelta = realDelta * speedRef.current;
          stepRunner(runner, world, simulationDelta, addLog);
          advanceWorld(world, simulationDelta, addLog);

          if (world.success && !successHandledRef.current) {
            successHandledRef.current = true;
            world.robot.leftPower = 0;
            world.robot.rightPower = 0;
            runningRef.current = false;
            setRunning(false);
            setStatus("success");
            setCelebrating(true);
            setUnlockedMissions((current) => unlockMissionAfterSuccess(current, world.layout.level, world.layout.challenge.number, ARENA_CHALLENGE_COUNT));
            addLog(world.layout.challenge.successMessage, "success");
            void saveProgrammingScore(world);
          } else if (world.competition.roundOver) {
            runningRef.current = false;
            setRunning(false);
            setStatus("complete");
            addLog(world.competition.lastEvent, "warning");
          } else if (runner.finished && !hasActiveDrivePower(world)) {
            world.robot.leftPower = 0;
            world.robot.rightPower = 0;
            runningRef.current = false;
            setRunning(false);
            setStatus(world.success ? "success" : "complete");
            addLog(world.success ? world.layout.challenge.successMessage : "O programa terminou antes de concluir o objetivo.", world.success ? "success" : "warning");
          }
        } catch (error) {
          world.robot.leftPower = 0;
          world.robot.rightPower = 0;
          runningRef.current = false;
          setRunning(false);
          setStatus("error");
          addLog(error instanceof Error ? error.message : "Ocorreu um erro durante a execução.", "error");
        }
      }

      if (canvasRef.current) drawWorld(canvasRef.current, world);
      if (expandedCanvasRef.current) drawWorld(expandedCanvasRef.current, world);
      if (now - telemetryAt > 120) {
        telemetryAt = now;
        setTelemetry({
          left: Math.round(world.robot.leftPower * 100),
          right: Math.round(world.robot.rightPower * 100),
          ultrasound: Math.round(sensorDistance(world) * 0.5),
          bumped: world.bumped,
        });
        setCompetitionView({
          remaining: world.competition.remaining,
          tilePoints: world.competition.tilePoints,
          challengePoints: world.competition.challengePoints,
          scoredTileCount: world.competition.scoredTiles.length,
          scoredHazards: [...world.competition.scoredHazards],
          collisionCount: world.competition.collisionCount,
          victimTouches: world.competition.victimTouches,
          layoutName: world.layout.name,
          lastEvent: world.competition.lastEvent,
        });
      }
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [addLog, playerName, saveProgrammingScore]);

  const resetSimulation = useCallback((showLog = true) => {
    runningRef.current = false;
    setRunning(false);
    runnerRef.current = null;
    worldRef.current = createWorld(hardwareRef.current, challengeIndex, arenaLevel);
    successHandledRef.current = false;
    setCelebrating(false);
    setStatus("ready");
    if (showLog) {
      setLogs([]);
      addLog("Desafio reiniciado. O robô voltou à posição de partida.");
    }
  }, [addLog, arenaLevel, challengeIndex]);

  const clearProgramForMissionChange = useCallback(() => {
    setProgramXml(createEmptyBlocks());
    setCode(EMPTY_BLOCK_CODE);
    setBlockProgramReady(false);
    setBlockSyncError("");
    setEditorTab("blocks");
    setProgramMode("blocks");
  }, []);

  const changeArenaLevel = useCallback((nextLevel: ArenaLevel) => {
    if (nextLevel === arenaLevel) return;
    runningRef.current = false;
    setRunning(false);
    runnerRef.current = null;
    worldRef.current = createWorld(hardwareRef.current, 0, nextLevel);
    successHandledRef.current = false;
    setCelebrating(false);
    setStatus("ready");
    clearProgramForMissionChange();
    setArenaLevel(nextLevel);
    setChallengeIndex(0);
    setLogs([]);
    addLog(`${ARENA_LEVELS[nextLevel].name}: ${ARENA_LEVELS[nextLevel].description}.`);
  }, [addLog, arenaLevel, clearProgramForMissionChange]);

  const changeArenaChallenge = useCallback((nextIndex: number) => {
    const normalized = Math.max(0, Math.min(unlockedMissions[arenaLevel], ARENA_CHALLENGE_COUNT - 1, Math.trunc(nextIndex)));
    if (normalized === challengeIndex) return;
    runningRef.current = false;
    setRunning(false);
    runnerRef.current = null;
    worldRef.current = createWorld(hardwareRef.current, normalized, arenaLevel);
    successHandledRef.current = false;
    setCelebrating(false);
    setStatus("ready");
    clearProgramForMissionChange();
    setChallengeIndex(normalized);
    setLogs([]);
    const nextChallenge = getArenaChallenges(arenaLevel)[normalized];
    addLog(`Desafio ${normalized + 1}: ${nextChallenge.title}. ${nextChallenge.objective}`);
  }, [addLog, arenaLevel, challengeIndex, clearProgramForMissionChange, unlockedMissions]);

  const runProgram = useCallback(() => {
    if (status === "paused" && runnerRef.current) {
      runningRef.current = true;
      setRunning(true);
      setStatus("running");
      addLog("Execução retomada.");
      return;
    }

    if (programMode === "blocks" && !blockProgramReady) {
      runningRef.current = false;
      setRunning(false);
      setStatus("error");
      setLogs([]);
      addLog("Comece com um bloco de evento e encaixe pelo menos um comando abaixo dele.", "warning");
      return;
    }

    try {
      const runnableCode = code;
      const program = parseProgram(runnableCode);
      restartRound(worldRef.current);
      runnerRef.current = createRunner(program);
      successHandledRef.current = false;
      setCelebrating(false);
      setLogs([]);
      addLog("Código carregado. Iniciando a rodada OBR de 5 minutos…");
      if (!hasChallengeHardware(hardwareRef.current, worldRef.current.layout.challenge.hardwareRequirement)) {
        addLog("O código será executado com a montagem atual. Para concluir este desafio, ainda serão necessários dois sensores de cor laterais olhando para fora.", "warning");
      }
      runningRef.current = true;
      setRunning(true);
      setStatus("running");
      setEditorTab("console");
    } catch (error) {
      setStatus("error");
      setRunning(false);
      runningRef.current = false;
      setEditorTab("console");
      setLogs([]);
      addLog(error instanceof ProgramError ? error.message : "Não foi possível ler o código.", "error");
    }
  }, [addLog, blockProgramReady, code, programMode, status]);

  const pauseProgram = () => {
    runningRef.current = false;
    setRunning(false);
    setStatus("paused");
    addLog("Execução pausada.", "warning");
  };

  const updateCode = (value: string) => {
    setCode(value);
    try {
      setProgramXml(pythonToBlocks(value));
      setBlockProgramReady(true);
      setBlockSyncError("");
    } catch (error) {
      setBlockSyncError(error instanceof PythonBlocksError ? error.message : "Não foi possível atualizar os blocos.");
    }
    if (status === "paused" || status === "complete" || status === "error") {
      runnerRef.current = null;
      setStatus("ready");
    }
  };

  const updateBlocks = (nextProgramXml: string, generatedPython: string, executable: boolean) => {
    setProgramXml(nextProgramXml);
    setCode(generatedPython);
    setBlockProgramReady(executable);
    setBlockSyncError("");
    if (status === "paused" || status === "complete" || status === "error" || status === "success") {
      runnerRef.current = null;
      setStatus("ready");
      setCelebrating(false);
    }
  };

  const openBlocks = () => {
    if (programMode === "code") {
      try {
        setProgramXml(pythonToBlocks(code));
        setBlockProgramReady(true);
        setBlockSyncError("");
      } catch (error) {
        const message = error instanceof PythonBlocksError ? error.message : "Não foi possível atualizar os blocos.";
        setBlockSyncError(message);
        setLogs([]);
        addLog(`Corrija o Python antes de abrir os blocos: ${message}`, "error");
        return;
      }
    }
    setEditorTab("blocks");
    setProgramMode("blocks");
  };

  const copyEditorContent = async () => {
    window.clearTimeout(copyResetTimerRef.current);
    setCopyStatus("working");
    try {
      if (editorTab === "blocks") {
        const result = await blockEditorRef.current?.copyBlocksImage();
        if (!result) throw new Error("O editor de blocos ainda está carregando.");
        setCopyStatus(result === "clipboard" ? "image" : result === "shared" ? "shared" : "downloaded");
      } else {
        await copyTextToClipboard(code);
        setCopyStatus("code");
      }
    } catch {
      setCopyStatus("error");
    }
    copyResetTimerRef.current = window.setTimeout(() => setCopyStatus("idle"), 2400);
  };

  const copyButtonLabel = copyStatus === "working" ? "Preparando…"
    : copyStatus === "code" || copyStatus === "image" ? "Copiado"
      : copyStatus === "shared" ? "Compartilhar"
        : copyStatus === "downloaded" ? "Salvo"
          : copyStatus === "error" ? "Erro"
            : editorTab === "blocks" ? "Print" : "Copiar";

  const updateHardware = (nextHardware: HardwareConfig) => {
    const normalized = normalizeHardware(nextHardware);
    hardwareRef.current = normalized;
    setHardware(normalized);
    runningRef.current = false;
    setRunning(false);
    runnerRef.current = null;
    worldRef.current.hardware = cloneHardware(normalized);
    restartRound(worldRef.current);
    successHandledRef.current = false;
    setCelebrating(false);
    setStatus("ready");
    setLogs([]);
    addLog(isRobotReady(normalized) ? "Dois motores conectados: o robô já pode se movimentar." : "Montagem atualizada. Cada peça conectada já pode cumprir a sua própria função.", isRobotReady(normalized) ? "success" : "info");
  };

  const loadExample = (name: keyof typeof examples) => {
    resetSimulation(false);
    if (name === "seguidor") updateHardware(createLineFollowerHardware(hardwareRef.current));
    const nextBlocks = createExampleBlocks(name);
    setProgramXml(nextBlocks);
    setCode(examples[name]);
    setEditorTab("blocks");
    setProgramMode("blocks");
    setBlockProgramReady(true);
    setCommandsOpen(false);
    setLogs([]);
    addLog("Exemplo carregado. Você pode editar e executar.");
  };

  const changeSpeed = (direction: number) => {
    const values = [0.5, 1, 2, 4];
    const current = values.indexOf(speed);
    setSpeed(values[Math.max(0, Math.min(values.length - 1, current + direction))]);
  };

  const telemetryUltrasonicPort = SENSOR_PORTS.find((port) => hardware.sensors[port] === "ultrasonic");
  const telemetryUltrasonicMount = telemetryUltrasonicPort ? hardware.sensorMounts[telemetryUltrasonicPort] : null;
  const challengeOptions = getArenaChallenges(arenaLevel);
  const activeChallenge = challengeOptions[challengeIndex] ?? challengeOptions[0];
  const challengeHardwareReady = hasChallengeHardware(hardware, activeChallenge.hardwareRequirement);
  const missionHardwareReady = activeChallenge.hardwareRequirement ? challengeHardwareReady : isRobotReady(hardware);
  const challengeStepsComplete = activeChallenge.requiredHazards.length
    ? activeChallenge.requiredHazards.every((id) => competitionView.scoredHazards.includes(id))
    : competitionView.scoredTileCount > 1;
  const profileName = playerName || "Explorador";
  const syncLabels: Record<SyncStatus, string> = {
    loading: "Carregando seu progresso",
    local: "Rascunho temporário pronto",
    saving: "Salvando progresso…",
    saved: "Progresso salvo na nuvem",
    offline: "Rascunho salvo neste navegador",
  };

  if (!playerName?.trim()) {
    return (
      <main className="programming-identity-shell">
        <a className="identity-brand" href="/" aria-label="Voltar ao início do Eu Vou Jogar">
          <span className="brand-mark">EV</span>
          <span><strong>Eu Vou</strong><b>Programar</b></span>
        </a>

        <section className="programming-identity-card" aria-labelledby="programming-identity-title">
          <div className="identity-robot" aria-hidden="true">⚙</div>
          <span className="identity-eyebrow">Antes de começar</span>
          <h1 id="programming-identity-title">Como devemos chamar você?</h1>
          <p>Seu nome identifica seu progresso, suas pontuações e seus troféus no ranking do Eu Vou Programar.</p>

          <form onSubmit={handleIdentitySubmit}>
            <label htmlFor="programming-player-name">Seu nome ou apelido</label>
            <div className="identity-input-row">
              <input
                id="programming-player-name"
                type="text"
                value={identityName}
                onChange={(event) => {
                  setIdentityName(event.target.value);
                  if (identityError) setIdentityError("");
                }}
                placeholder="Digite seu nome..."
                autoComplete="name"
                autoFocus
                maxLength={30}
                disabled={identitySaving}
                aria-describedby="programming-identity-help"
              />
              <button type="submit" disabled={identitySaving || identityName.trim().length < 2}>
                {identitySaving ? "Salvando…" : "Entrar"}<span aria-hidden="true">→</span>
              </button>
            </div>
            <small id="programming-identity-help">O mesmo perfil será usado nos outros jogos do Eu Vou Jogar.</small>
            {identityError && <div className="identity-error" role="alert">{identityError}</div>}
          </form>

          <div className="identity-benefits" aria-label="Benefícios do perfil">
            <span><b>★</b> Pontuação salva</span>
            <span><b>🏆</b> Ranking por jogo</span>
            <span><b>↻</b> Progresso recuperável</span>
          </div>
        </section>

        <a className="identity-back-link" href="/">← Voltar ao Eu Vou Jogar</a>
      </main>
    );
  }

  return (
    <main className={`app-shell ${builderOpen ? "builder-is-open" : ""}`}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Voltar ao início do Eu Vou Jogar">
          <span className="brand-mark">EV</span>
          <span><strong>Eu Vou</strong><b>Programar</b></span>
        </a>

        <div className="lesson-progress" aria-label="Progresso da missão">
          <span>Desafio {challengeIndex + 1} de {ARENA_CHALLENGE_COUNT}</span>
          <div className="progress-track"><i className={status === "success" ? "done" : ""} style={{ width: `${status === "success" ? 100 : (challengeIndex + 1) * 10}%` }} /></div>
          <strong>{status === "success" ? "Objetivo concluído!" : activeChallenge.title}</strong>
        </div>

        <nav className="top-actions" aria-label="Ações principais">
          <a className="back-home-button" href="/" aria-label="Voltar ao módulo Eu Vou Jogar">
            <span aria-hidden="true">←</span><b>Eu Vou Jogar</b>
          </a>
          <button className="assembly-top-button" onClick={() => setBuilderOpen(true)}><span>⚙</span> Montar robô</button>
          <button className="icon-button" onClick={() => setCommandsOpen(true)} aria-label="Abrir ajuda">?</button>
          <a className="profile-button" href="/" aria-label={`Perfil ${profileName}`} title="Usa o mesmo perfil dos outros jogos">
            <span>★</span> {profileName}{playerCode && <small>#{playerCode}</small>}
          </a>
        </nav>
      </header>

      <section className={`workspace ${arenaHidden ? "arena-is-hidden" : ""}`}>
        <aside className="mission-card">
          <span className="eyebrow">{ARENA_LEVELS[arenaLevel].name} · desafio {challengeIndex + 1}/{ARENA_CHALLENGE_COUNT}</span>
          <h1>{activeChallenge.title}</h1>
          <p>{activeChallenge.objective}</p>

          <section className="mission-criteria" aria-label="Regras exatas para concluir a missão">
            <strong>Para concluir, faça exatamente isto:</strong>
            <ol>
              {activeChallenge.successCriteria.map((criterion, index) => <li key={`${index}-${criterion}`}>{criterion}</li>)}
            </ol>
          </section>

          <div className={`goal-card ${status === "success" ? "is-complete" : ""}`}>
            <span className="goal-icon">★</span>
            <div><strong>{status === "success" ? "Objetivo concluído" : "Condição de vitória"}</strong><small>{status === "success" ? activeChallenge.successMessage : activeChallenge.goal.label}</small></div>
          </div>

          <div className="tip-card">
            <span>💡</span>
            <p><strong>Dica:</strong> {activeChallenge.hint}</p>
          </div>

          <div className="mission-checks">
            <button className={missionHardwareReady ? "check-done hardware-check" : "hardware-check"} onClick={() => setBuilderOpen(true)}><span>{missionHardwareReady ? "✓" : "!"}</span> {activeChallenge.hardwareRequirement === "dual-outward-colour" ? challengeHardwareReady ? "Sensores laterais configurados" : "Sensores laterais recomendados para concluir" : isRobotReady(hardware) ? "Dois motores: movimento liberado" : "Adicione apenas as peças que o código usar"}</button>
            <div className={challengeStepsComplete ? "check-done" : ""}><span>{challengeStepsComplete ? "✓" : "2"}</span> {activeChallenge.requiredHazards.length ? `Etapas da pista: ${activeChallenge.requiredHazards.filter((id) => competitionView.scoredHazards.includes(id)).length}/${activeChallenge.requiredHazards.length}` : "Entre no percurso"}</div>
            <div className={status === "success" ? "check-done" : ""}><span>{status === "success" ? "✓" : "3"}</span> Conclua a condição de vitória</div>
            {activeChallenge.maxCollisions !== undefined && <div className={competitionView.collisionCount <= activeChallenge.maxCollisions ? "check-done" : "check-failed"}><span>{competitionView.collisionCount <= activeChallenge.maxCollisions ? "✓" : "×"}</span> Colisões: {competitionView.collisionCount}/{activeChallenge.maxCollisions}</div>}
            {activeChallenge.maxVictimTouches !== undefined && <div className={competitionView.victimTouches <= activeChallenge.maxVictimTouches ? "check-done" : "check-failed"}><span>{competitionView.victimTouches <= activeChallenge.maxVictimTouches ? "✓" : "×"}</span> Bolinhas tocadas: {competitionView.victimTouches}/{activeChallenge.maxVictimTouches}</div>}
          </div>

          <div className="obr-rule-event"><span>⚑</span><div><strong>{arenaLevel === "beginner" ? "Último evento do percurso" : "Último evento da prova"}</strong><small>{competitionView.lastEvent}</small></div></div>

          <button className="lesson-button" onClick={() => setCommandsOpen(true)}>Ver comandos disponíveis <span>→</span></button>
        </aside>

        <section className="code-panel" aria-label="Editor de código">
          <div className="panel-header editor-header">
            <div className="editor-tabs" role="tablist" aria-label="Editor e saída">
              <button role="tab" aria-selected={editorTab === "blocks"} className={editorTab === "blocks" ? "active" : ""} onClick={openBlocks}><span>▦</span> Blocos</button>
              <button role="tab" aria-selected={editorTab === "code"} className={editorTab === "code" ? "active" : ""} onClick={() => { setEditorTab("code"); setProgramMode("code"); }}><span>🐍</span> robot.py</button>
              <button role="tab" aria-selected={editorTab === "console"} className={editorTab === "console" ? "active" : ""} onClick={() => setEditorTab("console")}><span>›_</span> Saída <i>{logs.length}</i></button>
            </div>
            <div className="editor-header-actions">
              {editorTab !== "console" && <button className={`copy-editor-button copy-${copyStatus}`} onClick={copyEditorContent} disabled={copyStatus === "working"} aria-live="polite" aria-label={editorTab === "blocks" ? "Copiar imagem dos blocos" : "Copiar código Python"} title={editorTab === "blocks" ? "Copia uma imagem PNG dos blocos" : "Copia todo o código Python"}><span aria-hidden="true">{copyStatus === "working" ? "…" : copyStatus === "error" ? "!" : copyStatus === "idle" ? editorTab === "blocks" ? "📷" : "📋" : "✓"}</span><b>{copyButtonLabel}</b></button>}
              <button className="assembly-mini-button" onClick={() => setBuilderOpen(true)} aria-label="Montagem" title="Montagem"><span aria-hidden="true">⚙</span></button>
              <button className="examples-button" onClick={() => setCommandsOpen(true)}>Exemplos</button>
            </div>
          </div>

          {editorTab === "blocks" ? (
            builderOpen ? <div className="block-editor-paused" aria-hidden="true" /> : <BlockEditor ref={blockEditorRef} programXml={programXml} onChange={updateBlocks} />
          ) : editorTab === "code" ? (
            <div className="editor-wrap">
              <div ref={lineNumbersRef} className="line-numbers" aria-hidden="true">
                {code.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}
              </div>
              <textarea
                value={code}
                onChange={(event) => updateCode(event.target.value)}
                onScroll={(event) => {
                  if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
                }}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    runProgram();
                  }
                  if (event.key === "Tab") {
                    event.preventDefault();
                    const target = event.currentTarget;
                    const next = `${code.slice(0, target.selectionStart)}    ${code.slice(target.selectionEnd)}`;
                    updateCode(next);
                    requestAnimationFrame(() => {
                      target.selectionStart = target.selectionEnd = target.selectionStart + 4;
                    });
                  }
                }}
                aria-label="Código Python do robô"
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {blockSyncError && <div className="code-block-sync-error" role="status">Blocos aguardando Python válido: {blockSyncError}</div>}
            </div>
          ) : (
            <div className="console-wrap" role="log" aria-live="polite">
              <div className="console-intro"><span>EV</span><div><strong>Console do robô</strong><small>Mensagens e erros aparecem aqui.</small></div></div>
              {logs.length ? logs.map((log) => (
                <p key={log.id} className={`log-${log.level}`}><span>{log.level === "error" ? "×" : log.level === "warning" ? "!" : log.level === "success" ? "✓" : "›"}</span>{log.message}</p>
              )) : <div className="empty-console"><b>▶</b><strong>Nada executado ainda</strong><small>Use Ctrl + Enter ou o botão abaixo.</small></div>}
            </div>
          )}

          <div className="run-bar">
            <span className={`saved-state sync-${syncStatus}`} title={programMode === "blocks" && !blockProgramReady ? "Comece com um bloco de evento e encaixe comandos abaixo dele." : undefined}><i /> {syncLabels[syncStatus]}</span>
            <button className="reset-button" onClick={() => resetSimulation()}>↻ Reiniciar desafio</button>
            {running ? (
              <button className="pause-button" onClick={pauseProgram}><span>Ⅱ</span> Pausar</button>
            ) : (
              <button className="run-button" onClick={runProgram} disabled={programMode === "blocks" && !blockProgramReady}><span>▶</span> {status === "paused" ? "Continuar" : programMode === "blocks" && !blockProgramReady ? "Monte uma pilha" : "Executar código"}</button>
            )}
          </div>
        </section>

        <div className={`arena-column ${arenaHidden ? "is-hidden" : ""}`}>
          <button
            className="arena-visibility-toggle"
            type="button"
            onClick={() => setArenaHidden((current) => !current)}
            aria-label={arenaHidden ? "Mostrar arena" : "Ocultar arena"}
            aria-expanded={!arenaHidden}
            data-label={arenaHidden ? "Mostrar arena" : "Ocultar arena"}
            title={arenaHidden ? "Mostrar arena" : "Ocultar arena"}
          >
            <span className="arena-toggle-icon arena-toggle-icon-desktop" aria-hidden="true">{arenaHidden ? "◀" : "▶"}</span>
            <span className="arena-toggle-icon arena-toggle-icon-mobile" aria-hidden="true">{arenaHidden ? "▼" : "▲"}</span>
          </button>

          {!arenaHidden && <section className="arena-panel" aria-label="Arena do robô">
          <div className="arena-toolbar">
            <div><span className={`live-dot ${running ? "pulsing" : ""}`} /> {arenaLevel === "beginner" ? "Pista de treino" : "Arena OBR"} <small>{competitionView.layoutName}</small></div>
            <div className="arena-toolbar-actions">
              <button className="expand-arena-button legend-arena-button" type="button" onClick={() => setLegendOpen(true)} aria-label="Abrir legenda da arena"><span>?</span> Legenda</button>
              <button className="expand-arena-button" type="button" onClick={() => setArenaExpanded(true)} aria-label="Abrir arena em tela cheia"><span>⛶</span> Tela cheia</button>
              <div className="speed-control" aria-label="Velocidade da simulação">
                <button onClick={() => changeSpeed(-1)} disabled={speed === 0.5} aria-label="Diminuir velocidade">−</button>
                <strong>{speed}×</strong>
                <button onClick={() => changeSpeed(1)} disabled={speed === 4} aria-label="Aumentar velocidade">＋</button>
              </div>
            </div>
          </div>

          <div className="arena-level-picker" role="group" aria-label="Escolha o nível da arena">
            {(Object.keys(ARENA_LEVELS) as ArenaLevel[]).map((level) => (
              <button key={level} type="button" className={arenaLevel === level ? `active level-${level}` : `level-${level}`} onClick={() => changeArenaLevel(level)} aria-pressed={arenaLevel === level}>
                <span>{ARENA_LEVELS[level].number}</span>
                <b>{ARENA_LEVELS[level].short}</b>
                <small>{ARENA_LEVELS[level].description}</small>
              </button>
            ))}
          </div>

          <div className="arena-challenge-picker" aria-label="Escolha o objetivo da arena">
            <button type="button" onClick={() => changeArenaChallenge(challengeIndex - 1)} disabled={challengeIndex === 0} aria-label="Objetivo anterior">‹</button>
            <label>
              <span>Objetivo {challengeIndex + 1} de {ARENA_CHALLENGE_COUNT}</span>
              <select value={challengeIndex} onChange={(event) => changeArenaChallenge(Number(event.target.value))} aria-label={`Objetivo do nível ${ARENA_LEVELS[arenaLevel].short}`}>
                {challengeOptions.map((challenge, index) => <option key={challenge.title} value={index} disabled={index > unlockedMissions[arenaLevel]}>{index > unlockedMissions[arenaLevel] ? "🔒 " : ""}{index + 1}. {challenge.title}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => changeArenaChallenge(challengeIndex + 1)} disabled={challengeIndex === ARENA_CHALLENGE_COUNT - 1 || challengeIndex >= unlockedMissions[arenaLevel]} aria-label="Próximo objetivo" title={challengeIndex >= unlockedMissions[arenaLevel] && challengeIndex < ARENA_CHALLENGE_COUNT - 1 ? "Conclua esta missão para liberar a próxima" : undefined}>›</button>
          </div>

          <div className="arena-mission-progress" role="navigation" aria-label="Progresso das missões">
            {challengeOptions.map((challenge, index) => {
              const locked = index > unlockedMissions[arenaLevel];
              const completed = index < unlockedMissions[arenaLevel];
              return (
                <button
                  key={challenge.title}
                  type="button"
                  className={`${index === challengeIndex ? "is-active" : ""} ${locked ? "is-locked" : ""} ${completed ? "is-complete" : ""}`.trim()}
                  disabled={locked}
                  onClick={() => changeArenaChallenge(index)}
                  aria-label={locked ? `Missão ${index + 1} bloqueada` : `Abrir missão ${index + 1}: ${challenge.title}`}
                  title={locked ? `🔒 Conclua a missão ${index} para liberar` : challenge.title}
                >
                  <span aria-hidden="true">{locked ? "🔒" : completed ? "✓" : "•"}</span>
                  <b>{index + 1}</b>
                </button>
              );
            })}
          </div>

          <div className="obr-scoreboard" aria-label={arenaLevel === "beginner" ? "Placar do percurso" : "Placar da rodada OBR"}>
            <div><small>Tempo</small><strong>{Math.floor(competitionView.remaining / 60)}:{String(Math.ceil(competitionView.remaining % 60)).padStart(2, "0")}</strong></div>
            <div><small>{arenaLevel === "beginner" ? "Percurso" : "Ladrilhos"}</small><strong>{competitionView.tilePoints} pts</strong></div>
            <div><small>Desafios</small><strong>{competitionView.challengePoints} pts</strong></div>
            <div><small>Total</small><strong>{competitionView.tilePoints + competitionView.challengePoints} pts</strong></div>
          </div>

          <div className="arena">
            <canvas ref={canvasRef} aria-label={arenaLevel === "beginner" ? "Pista branca sem linha: robô, pontos e objetivo" : "Arena OBR: robô, linha, ladrilhos e desafios"} />
            {celebrating && (
              <div className="success-pop" role="status">
                <div className="success-stars">★ <span>★</span> ★</div>
                <strong>{activeChallenge.title} concluído!</strong>
                <p>{activeChallenge.successMessage}</p>
                <button onClick={() => { setCelebrating(false); setEditorTab("blocks"); setProgramMode("blocks"); if (challengeIndex < ARENA_CHALLENGE_COUNT - 1) changeArenaChallenge(challengeIndex + 1); }}>{challengeIndex < ARENA_CHALLENGE_COUNT - 1 ? `Ir para a missão ${challengeIndex + 2}` : "Continuar aprendendo"}</button>
              </div>
            )}
          </div>

          <div className="status-strip">
            <div><span>⚙</span><small>Motor esquerdo</small><strong>{telemetry.left}%</strong></div>
            <div><span>⚙</span><small>Motor direito</small><strong>{telemetry.right}%</strong></div>
            <div><span>◔</span><small>{telemetryUltrasonicPort ? `Ultrassom P${telemetryUltrasonicPort}${telemetryUltrasonicMount ? ` · ${SENSOR_POSITION_DEFINITIONS[telemetryUltrasonicMount.position].shortName}` : ""}` : "Sem ultrassom"}</small><strong>{telemetryUltrasonicPort ? `${telemetry.ultrasound} cm` : "—"}</strong></div>
            <div><span>{telemetry.bumped ? "!" : "●"}</span><small>Estado</small><strong className={`status-${status}`}>{telemetry.bumped ? "Tocou!" : statusLabels[status]}</strong></div>
          </div>

          <section className="robot-connections" aria-label="Portas conectadas ao robô">
            <header>
              <div><strong>Conexões do robô</strong><small>Atualizadas pela montagem</small></div>
              <button type="button" onClick={() => setBuilderOpen(true)}>Alterar montagem</button>
            </header>

            <div className="connection-row motor-connections">
              <h3>Motores <span>letras A–D</span></h3>
              {MOTOR_PORTS.map((port) => {
                const motor = hardware.motors[port];
                return (
                  <div className={`connection-port connection-motor-${motor ?? "empty"}`} key={port}>
                    <b>{port}</b>
                    <span><small>Porta {port}</small><strong>{motor ? MOTOR_DEFINITIONS[motor].shortName : "Livre"}</strong></span>
                  </div>
                );
              })}
            </div>

            <div className="connection-row sensor-connections">
              <h3>Sensores <span>números 1–4</span></h3>
              {SENSOR_PORTS.map((port) => {
                const sensor = hardware.sensors[port];
                const mount = hardware.sensorMounts[port];
                return (
                  <div className={`connection-port connection-sensor-${sensor ?? "empty"}`} key={port}>
                    <b>{port}</b>
                    <span><small>Porta {port}{mount ? ` · ${SENSOR_POSITION_DEFINITIONS[mount.position].shortName}` : ""}</small><strong>{sensor ? `${SENSOR_DEFINITIONS[sensor].shortName}${sensor === "color" ? mount?.aim === "ground" ? " ↓ chão" : " → fora" : ""}` : "Livre"}</strong></span>
                  </div>
                );
              })}
            </div>
          </section>
          </section>}
        </div>
      </section>

      {arenaExpanded && (
        <div className="arena-expanded-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setArenaExpanded(false); }}>
          <section className="arena-expanded-dialog" role="dialog" aria-modal="true" aria-labelledby="expanded-arena-title">
            <header>
              <div><span className={`live-dot ${running ? "pulsing" : ""}`} /><span><strong id="expanded-arena-title">{activeChallenge.title}</strong><small>Objetivo {challengeIndex + 1}/{ARENA_CHALLENGE_COUNT} · proporção original 960 × 600</small></span></div>
              <div><b>{competitionView.tilePoints + competitionView.challengePoints} pts</b><button type="button" onClick={() => setArenaExpanded(false)} aria-label="Fechar arena ampliada">×</button></div>
            </header>
            <div className="arena-expanded-stage">
              <canvas ref={expandedCanvasRef} data-arena-fit="safe" aria-label="Arena OBR completa em tela cheia sem cortes nem deformação" />
            </div>
            <footer>
              <span>A arena mantém a mesma proporção em celular, tablet e computador. Pressione Esc para fechar.</span>
              <div className="arena-expanded-controls">
                <button className="reset-button" onClick={() => resetSimulation()}>↻ Reiniciar</button>
                {running ? (
                  <button className="pause-button" onClick={pauseProgram}><span>Ⅱ</span> Pausar</button>
                ) : (
                  <button className="run-button" onClick={runProgram} disabled={programMode === "blocks" && !blockProgramReady}><span>▶</span> {status === "paused" ? "Continuar" : programMode === "blocks" && !blockProgramReady ? "Monte uma pilha" : "Executar código"}</button>
                )}
                <button className="hide-expanded-arena-button" type="button" onClick={() => { setArenaExpanded(false); setArenaHidden(true); }}>Ocultar arena</button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {legendOpen && (
        <div className="legend-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLegendOpen(false); }}>
          <section className="legend-dialog" role="dialog" aria-modal="true" aria-labelledby="arena-legend-title">
            <header><div><span>?</span><div><strong id="arena-legend-title">Objetivo {challengeIndex + 1}: {activeChallenge.title}</strong><small>{activeChallenge.objective}</small></div></div><button type="button" onClick={() => setLegendOpen(false)} aria-label="Fechar legenda">×</button></header>
            <div className="arena-legend" aria-label="Elementos da arena">
              {arenaLevel === "beginner" ? (
                <>
                  <div><i className="legend-white" /><span><b>Pista branca</b><small>Sem linha para seguir</small></span></div>
                  <div><i className="legend-waypoint" /><span><b>Ponto numerado</b><small>Passe na ordem indicada</small></span></div>
                  <div><i className="legend-goal" /><span><b>Objetivo</b><small>Pare dentro da estrela</small></span></div>
                </>
              ) : <div><i className="legend-tile" /><span><b>Ladrilho percorrido</b><small>+5 pontos</small></span></div>}
              {arenaLevel === "easy" && <div><i className="legend-curve" /><span><b>Curvas seguidas</b><small>Siga a linha preta</small></span></div>}
              {arenaLevel === "medium" && (
                <>
                  <div><i className="legend-gap" /><span><b>Gap</b><small>Atravesse · +10 pontos</small></span></div>
                  <div><i className="legend-obstacle" /><span><b>Obstáculo</b><small>Desvie · +20 pontos</small></span></div>
                </>
              )}
              {arenaLevel === "hard" && (
                <>
                  <div><i className="legend-gap" /><span><b>Gap</b><small>Atravesse · +10 pontos</small></span></div>
                  <div><i className="legend-marker legend-green-left" /><span><b>Verde antes · esquerda</b><small>Vire à esquerda</small></span></div>
                  <div><i className="legend-marker legend-green-right" /><span><b>Verde antes · direita</b><small>Vire à direita</small></span></div>
                  <div><i className="legend-marker legend-green-straight" /><span><b>Verde depois da linha</b><small>Continue reto</small></span></div>
                  <div><i className="legend-marker legend-green-return" /><span><b>Verde nos dois lados</b><small>Retorne: beco sem saída</small></span></div>
                  <div><i className="legend-bump" /><span><b>Lombada</b><small>Visual · +10 pontos</small></span></div>
                </>
              )}
            </div>
            <footer>{arenaLevel === "hard" ? "O verde fica no canto interno e toca as duas linhas pretas que formam a decisão. " : ""}Cada elemento pontua apenas uma vez. Pressione Esc para fechar.</footer>
          </section>
        </div>
      )}

      {builderOpen && (
        <div className="builder-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBuilderOpen(false); }}>
          <section className="builder-modal" role="dialog" aria-modal="true" aria-label="Montagem do robô EV3">
            <button className="builder-close-button" onClick={() => setBuilderOpen(false)} aria-label="Fechar montagem">×</button>
            <RobotBuilder config={hardware} onChange={updateHardware} onProgram={() => setBuilderOpen(false)} />
          </section>
        </div>
      )}

      {commandsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandsOpen(false); }}>
          <section className="commands-modal" role="dialog" aria-modal="true" aria-labelledby="commands-title">
            <header><div><span>⌘</span><div><strong id="commands-title">Caixa de ferramentas</strong><small>Escolha um exemplo ou consulte os comandos.</small></div></div><button onClick={() => setCommandsOpen(false)} aria-label="Fechar">×</button></header>
            <div className="example-grid">
              <button onClick={() => loadExample("avancar")}><span>↑</span><strong>Seguir reto</strong><small>Controle os dois motores.</small></button>
              <button onClick={() => loadExample("curva")}><span>↗</span><strong>Fazer curva</strong><small>Use potências diferentes.</small></button>
              <button onClick={() => loadExample("sensor")}><span>◔</span><strong>Usar sensor</strong><small>Meça antes de avançar.</small></button>
              <button onClick={() => loadExample("seguidor")}><span>⌁</span><strong>Seguir linha</strong><small>Use dois sensores sem inverter os motores.</small></button>
            </div>
            <div className="command-list">
              <div><code>motors.set_power(1, 0.6)</code><span>Servo da porta B entre −1 e 1</span></div>
              <div><code>motors.set_power(2, 0.6)</code><span>Servo da porta C entre −1 e 1</span></div>
              <div><code>utils.sleep(2)</code><span>Espere pelo tempo da simulação</span></div>
              <div><code>arduino.measure_ultrasound_distance(2, 3)</code><span>Distância frontal em milímetros</span></div>
              <div><code>leds.set_rgb(0, 48, 145, 81)</code><span>Mude a luz do robô</span></div>
              <div><code>for passo in range(3):</code><span>Repita um bloco até 100 vezes</span></div>
            </div>
            <footer><span>Atalho para executar</span><kbd>Ctrl</kbd><b>+</b><kbd>Enter</kbd></footer>
          </section>
        </div>
      )}
    </main>
  );
}
