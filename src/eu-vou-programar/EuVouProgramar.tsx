import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import BlockEditor from "./BlockEditor";
import RobotBuilder from "./RobotBuilder";
import { createEmptyBlocks, createExampleBlocks } from "./blocks";
import type { ArenaLevel } from "./obrArena";
import {
  cloneHardware,
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
const DRAFT_UPDATED_STORAGE_KEY = "eu-vou-programar:draft-updated-at";
const EMPTY_BLOCK_CODE = "# Arraste um bloco de evento e encaixe seus comandos abaixo.";

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
};

type Status = "ready" | "running" | "paused" | "complete" | "success" | "error";
type EditorTab = "blocks" | "code" | "console";
type ProgramMode = "blocks" | "code";
type SyncStatus = "loading" | "local" | "saving" | "saved" | "offline";

const ARENA_LEVELS: Record<ArenaLevel, { name: string; short: string; description: string }> = {
  easy: { name: "Nível fácil", short: "Fácil", description: "Linha preta com muitas curvas" },
  medium: { name: "Nível médio", short: "Médio", description: "Curvas seguidas, gap e obstáculo" },
  hard: { name: "Nível avançado", short: "Avançado", description: "Gap, sinais verdes, cruzamentos e lombada" },
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
  return value === "easy" || value === "medium" || value === "hard";
}

function isProgramMode(value: unknown): value is ProgramMode {
  return value === "blocks" || value === "code";
}

export default function EuVouProgramar() {
  const { sessionId, playerCode, playerName } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const expandedCanvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<WorldState>(createWorld());
  const runnerRef = useRef<RunnerState | null>(null);
  const runningRef = useRef(false);
  const speedRef = useRef(1);
  const logCounterRef = useRef(0);
  const successHandledRef = useRef(false);
  const hardwareRef = useRef<HardwareConfig>(cloneHardware(DEFAULT_HARDWARE));

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
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [telemetry, setTelemetry] = useState({ left: 0, right: 0, ultrasound: 0, bumped: false });
  const [hardware, setHardware] = useState<HardwareConfig>(() => cloneHardware(DEFAULT_HARDWARE));
  const [builderOpen, setBuilderOpen] = useState(false);
  const [arenaExpanded, setArenaExpanded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [arenaLevel, setArenaLevel] = useState<ArenaLevel>("easy");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [competitionView, setCompetitionView] = useState({
    remaining: 300,
    tilePoints: 5,
    challengePoints: 0,
    scoredTileCount: 1,
    layoutName: "Fácil - Curvas variadas",
    lastEvent: "Ladrilho de partida: +5 pontos",
  });

  const addLog = useCallback((message: string, level: LogLevel = "info") => {
    logCounterRef.current += 1;
    const next = { id: logCounterRef.current, level, message };
    setLogs((current) => [...current.slice(-39), next]);
  }, []);

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
    let cancelled = false;

    const hydrateProgress = async () => {
      setStorageReady(false);
      setSyncStatus("loading");

      const savedBlocks = window.localStorage.getItem(BLOCKS_STORAGE_KEY);
      const savedCode = window.localStorage.getItem(STORAGE_KEY);
      const savedMode = window.localStorage.getItem(MODE_STORAGE_KEY);
      const savedHardware = window.localStorage.getItem(HARDWARE_STORAGE_KEY);
      const savedArena = window.localStorage.getItem(ARENA_STORAGE_KEY);
      const localUpdatedAt = Date.parse(window.localStorage.getItem(DRAFT_UPDATED_STORAGE_KEY) || "") || 0;

      let nextBlocks = savedBlocks?.startsWith("<xml") ? savedBlocks : createEmptyBlocks();
      let nextCode = savedCode || EMPTY_BLOCK_CODE;
      let nextMode: ProgramMode = isProgramMode(savedMode) ? savedMode : "blocks";
      let nextHardware = cloneHardware(DEFAULT_HARDWARE);
      let nextArena: ArenaLevel = isArenaLevel(savedArena) ? savedArena : "easy";

      if (savedHardware) {
        try {
          nextHardware = normalizeHardware(JSON.parse(savedHardware));
        } catch {
          window.localStorage.removeItem(HARDWARE_STORAGE_KEY);
        }
      }

      const { data, error } = await supabase
        .from("programming_progress")
        .select("program_xml, python_code, hardware_config, arena_level, program_mode, updated_at")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (cancelled) return;

      if (data && Date.parse(data.updated_at) > localUpdatedAt) {
        if (data.program_xml.startsWith("<xml")) nextBlocks = data.program_xml;
        nextCode = data.python_code || EMPTY_BLOCK_CODE;
        nextHardware = normalizeHardware(data.hardware_config as unknown as HardwareConfig);
        if (isArenaLevel(data.arena_level)) nextArena = data.arena_level;
        if (isProgramMode(data.program_mode)) nextMode = data.program_mode;
      }

      hardwareRef.current = nextHardware;
      setHardware(nextHardware);
      setProgramXml(nextBlocks);
      setCode(nextCode);
      setProgramMode(nextMode);
      setEditorTab(nextMode === "code" ? "code" : "blocks");
      setArenaLevel(nextArena);
      worldRef.current = createWorld(nextHardware, undefined, nextArena);
      setStorageReady(true);
      setSyncStatus(error ? "offline" : data ? "saved" : "local");
    };

    void hydrateProgress();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!storageReady) return;

    const updatedAt = new Date().toISOString();
    window.localStorage.setItem(STORAGE_KEY, code);
    window.localStorage.setItem(BLOCKS_STORAGE_KEY, programXml);
    window.localStorage.setItem(HARDWARE_STORAGE_KEY, JSON.stringify(hardware));
    window.localStorage.setItem(MODE_STORAGE_KEY, programMode);
    window.localStorage.setItem(ARENA_STORAGE_KEY, arenaLevel);
    window.localStorage.setItem(DRAFT_UPDATED_STORAGE_KEY, updatedAt);
    setSyncStatus("saving");

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const competition = worldRef.current.competition;
      const { error } = await supabase.from("programming_progress").upsert({
        session_id: sessionId,
        program_xml: programXml,
        python_code: code,
        hardware_config: hardware as unknown as Json,
        arena_level: arenaLevel,
        program_mode: programMode,
        tile_points: competition.tilePoints,
        challenge_points: competition.challengePoints,
        total_points: competition.tilePoints + competition.challengePoints,
        updated_at: updatedAt,
      });

      if (!cancelled) setSyncStatus(error ? "offline" : "saved");
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [arenaLevel, code, hardware, programMode, programXml, sessionId, status, storageReady]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
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
            addLog("Rodada concluída: o robô parou por 5 segundos na faixa vermelha.", "success");
          } else if (world.competition.roundOver) {
            runningRef.current = false;
            setRunning(false);
            setStatus("complete");
            addLog(world.competition.lastEvent, "warning");
          } else if (runner.finished) {
            world.robot.leftPower = 0;
            world.robot.rightPower = 0;
            runningRef.current = false;
            setRunning(false);
            setStatus(world.success ? "success" : "complete");
            addLog("Programa finalizado com segurança.", "success");
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
          layoutName: world.layout.name,
          lastEvent: world.competition.lastEvent,
        });
      }
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [addLog]);

  const resetSimulation = useCallback((showLog = true) => {
    runningRef.current = false;
    setRunning(false);
    runnerRef.current = null;
    worldRef.current = createWorld(hardwareRef.current, undefined, arenaLevel);
    successHandledRef.current = false;
    setCelebrating(false);
    setStatus("ready");
    if (showLog) {
      setLogs([]);
      addLog("Nova arena OBR gerada. O percurso mudou e o robô está na partida.");
    }
  }, [addLog, arenaLevel]);

  const changeArenaLevel = useCallback((nextLevel: ArenaLevel) => {
    if (nextLevel === arenaLevel) return;
    runningRef.current = false;
    setRunning(false);
    runnerRef.current = null;
    worldRef.current = createWorld(hardwareRef.current, undefined, nextLevel);
    successHandledRef.current = false;
    setCelebrating(false);
    setStatus("ready");
    setArenaLevel(nextLevel);
    setLogs([]);
    addLog(`${ARENA_LEVELS[nextLevel].name}: ${ARENA_LEVELS[nextLevel].description}.`);
  }, [addLog, arenaLevel]);

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
    if (status === "paused" || status === "complete" || status === "error") {
      runnerRef.current = null;
      setStatus("ready");
    }
  };

  const updateBlocks = (nextProgramXml: string, generatedPython: string, executable: boolean) => {
    setProgramXml(nextProgramXml);
    setCode(generatedPython);
    setBlockProgramReady(executable);
    if (status === "paused" || status === "complete" || status === "error" || status === "success") {
      runnerRef.current = null;
      setStatus("ready");
      setCelebrating(false);
    }
  };

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
    addLog(isRobotReady(normalized) ? "Robô completo e pronto para programar." : "Montagem atualizada. Confira as peças antes de executar.", isRobotReady(normalized) ? "success" : "warning");
  };

  const loadExample = (name: keyof typeof examples) => {
    resetSimulation(false);
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
  const profileName = playerName || "Explorador";
  const syncLabels: Record<SyncStatus, string> = {
    loading: "Carregando seu progresso",
    local: "Rascunho temporário pronto",
    saving: "Salvando progresso…",
    saved: "Progresso salvo na nuvem",
    offline: "Rascunho salvo neste navegador",
  };

  return (
    <main className={`app-shell ${builderOpen ? "builder-is-open" : ""}`}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Voltar ao início do Eu Vou Jogar">
          <span className="brand-mark">EV</span>
          <span><strong>Eu Vou</strong><b>Programar</b></span>
        </a>

        <div className="lesson-progress" aria-label="Progresso da missão">
          <span>Treino OBR</span>
          <div className="progress-track"><i className={status === "success" ? "done" : ""} /></div>
          <strong>{status === "success" ? "Rodada concluída!" : ARENA_LEVELS[arenaLevel].name}</strong>
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

      <section className="workspace">
        <aside className="mission-card">
          <span className="eyebrow">Robótica de Resgate 2026</span>
          <h1>Treine para a <em>OBR!</em></h1>
          <p>Siga uma linha desconhecida, reconheça os perigos e chegue à sala de resgate de forma autônoma.</p>

          <div className={`goal-card ${status === "success" ? "is-complete" : ""}`}>
            <span className="goal-icon">★</span>
            <div><strong>Seu objetivo</strong><small>{status === "success" ? "Rodada concluída!" : "Pare 5 segundos na faixa vermelha"}</small></div>
          </div>

          <div className="tip-card">
            <span>💡</span>
            <p><strong>Dica:</strong> use dois sensores de cor apontados para o chão para corrigir os lados da linha.</p>
          </div>

          <div className="mission-checks">
            <button className={isRobotReady(hardware) ? "check-done hardware-check" : "hardware-check"} onClick={() => setBuilderOpen(true)}><span>{isRobotReady(hardware) ? "✓" : "!"}</span> {isRobotReady(hardware) ? "Robô já está montado" : "Complete a montagem"}</button>
            <div className={competitionView.scoredTileCount > 1 ? "check-done" : ""}><span>{competitionView.scoredTileCount > 1 ? "✓" : "2"}</span> Percorra um novo ladrilho</div>
            <div className={status === "success" ? "check-done" : ""}><span>{status === "success" ? "✓" : "3"}</span> Finalize na faixa vermelha</div>
          </div>

          <div className="obr-rule-event"><span>⚑</span><div><strong>Último evento da prova</strong><small>{competitionView.lastEvent}</small></div></div>

          <button className="lesson-button" onClick={() => setCommandsOpen(true)}>Ver comandos disponíveis <span>→</span></button>
        </aside>

        <section className="code-panel" aria-label="Editor de código">
          <div className="panel-header editor-header">
            <div className="editor-tabs" role="tablist" aria-label="Editor e saída">
              <button role="tab" aria-selected={editorTab === "blocks"} className={editorTab === "blocks" ? "active" : ""} onClick={() => { setEditorTab("blocks"); setProgramMode("blocks"); }}><span>▦</span> Blocos</button>
              <button role="tab" aria-selected={editorTab === "code"} className={editorTab === "code" ? "active" : ""} onClick={() => { setEditorTab("code"); setProgramMode("code"); }}><span>🐍</span> robot.py</button>
              <button role="tab" aria-selected={editorTab === "console"} className={editorTab === "console" ? "active" : ""} onClick={() => setEditorTab("console")}><span>›_</span> Saída <i>{logs.length}</i></button>
            </div>
            <div className="editor-header-actions"><button className="assembly-mini-button" onClick={() => setBuilderOpen(true)}>⚙ Montagem</button><button className="examples-button" onClick={() => setCommandsOpen(true)}>Exemplos</button></div>
          </div>

          {editorTab === "blocks" ? (
            builderOpen ? <div className="block-editor-paused" aria-hidden="true" /> : <BlockEditor programXml={programXml} onChange={updateBlocks} />
          ) : editorTab === "code" ? (
            <div className="editor-wrap">
              <div className="line-numbers" aria-hidden="true">
                {code.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}
              </div>
              <textarea
                value={code}
                onChange={(event) => updateCode(event.target.value)}
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
                spellCheck={false}
              />
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
            <button className="reset-button" onClick={() => resetSimulation()}>↻ Nova arena</button>
            {running ? (
              <button className="pause-button" onClick={pauseProgram}><span>Ⅱ</span> Pausar</button>
            ) : (
              <button className="run-button" onClick={runProgram} disabled={programMode === "blocks" && !blockProgramReady}><span>▶</span> {status === "paused" ? "Continuar" : programMode === "blocks" && !blockProgramReady ? "Monte uma pilha" : "Executar código"}</button>
            )}
          </div>
        </section>

        <section className="arena-panel" aria-label="Arena do robô">
          <div className="arena-toolbar">
            <div><span className={`live-dot ${running ? "pulsing" : ""}`} /> Arena OBR <small>{competitionView.layoutName}</small></div>
            <div className="arena-toolbar-actions">
              <button className="expand-arena-button legend-arena-button" type="button" onClick={() => setLegendOpen(true)} aria-label="Abrir legenda da arena"><span>?</span> Legenda</button>
              <button className="expand-arena-button" type="button" onClick={() => setArenaExpanded(true)} aria-label="Abrir arena ampliada"><span>⛶</span> Ampliar</button>
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
                <span>{level === "easy" ? "1" : level === "medium" ? "2" : "3"}</span>
                <b>{ARENA_LEVELS[level].short}</b>
                <small>{ARENA_LEVELS[level].description}</small>
              </button>
            ))}
          </div>

          <div className="obr-scoreboard" aria-label="Placar da rodada OBR">
            <div><small>Tempo</small><strong>{Math.floor(competitionView.remaining / 60)}:{String(Math.ceil(competitionView.remaining % 60)).padStart(2, "0")}</strong></div>
            <div><small>Ladrilhos</small><strong>{competitionView.tilePoints} pts</strong></div>
            <div><small>Desafios</small><strong>{competitionView.challengePoints} pts</strong></div>
            <div><small>Total</small><strong>{competitionView.tilePoints + competitionView.challengePoints} pts</strong></div>
          </div>

          <div className="arena">
            <canvas ref={canvasRef} aria-label="Arena OBR: robô, linha, ladrilhos e desafios" />
            {celebrating && (
              <div className="success-pop" role="status">
                <div className="success-stars">★ <span>★</span> ★</div>
                <strong>Você conseguiu!</strong>
                <p>O robô completou a chegada conforme a regra da OBR.</p>
                <button onClick={() => { setCelebrating(false); setEditorTab("blocks"); setProgramMode("blocks"); }}>Continuar aprendendo</button>
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
        </section>
      </section>

      {arenaExpanded && (
        <div className="arena-expanded-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setArenaExpanded(false); }}>
          <section className="arena-expanded-dialog" role="dialog" aria-modal="true" aria-labelledby="expanded-arena-title">
            <header>
              <div><span className={`live-dot ${running ? "pulsing" : ""}`} /><span><strong id="expanded-arena-title">Arena OBR ampliada</strong><small>{competitionView.layoutName} · proporção original 960 × 600</small></span></div>
              <div><b>{competitionView.tilePoints + competitionView.challengePoints} pts</b><button type="button" onClick={() => setArenaExpanded(false)} aria-label="Fechar arena ampliada">×</button></div>
            </header>
            <div className="arena-expanded-stage">
              <canvas ref={expandedCanvasRef} aria-label="Arena OBR ampliada sem deformação" />
            </div>
            <footer>A arena mantém a mesma proporção em celular, tablet e computador. Pressione Esc para fechar.</footer>
          </section>
        </div>
      )}

      {legendOpen && (
        <div className="legend-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLegendOpen(false); }}>
          <section className="legend-dialog" role="dialog" aria-modal="true" aria-labelledby="arena-legend-title">
            <header><div><span>?</span><div><strong id="arena-legend-title">Legenda do nível {ARENA_LEVELS[arenaLevel].short.toLowerCase()}</strong><small>{ARENA_LEVELS[arenaLevel].description}</small></div></div><button type="button" onClick={() => setLegendOpen(false)} aria-label="Fechar legenda">×</button></header>
            <div className="arena-legend" aria-label="Elementos da arena">
              <div><i className="legend-tile" /><span><b>Ladrilho percorrido</b><small>+5 pontos</small></span></div>
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
