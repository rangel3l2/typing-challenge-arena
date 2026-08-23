import { useCallback, useEffect, useRef, useState } from "react";
import {
  createArenaAutopilot,
  createAuditHardware,
  stepArenaAutopilot,
} from "./arenaAutopilot";
import type { ArenaAutopilotState } from "./arenaAutopilot";
import { ARENA_CHALLENGE_COUNT } from "./obrArena";
import type { ArenaLevel } from "./obrArena";
import { createWorld, drawWorld, sensorColor } from "./simulator";
import type { WorldState } from "./simulator";

const LEVELS: { id: ArenaLevel; name: string }[] = [
  { id: "beginner", name: "Muito Fácil" },
  { id: "easy", name: "Fácil" },
  { id: "medium", name: "Médio" },
  { id: "hard", name: "Avançado" },
];

interface MissionResult {
  key: string;
  cycle: number;
  level: ArenaLevel;
  challenge: number;
  title: string;
  status: "passed" | "failed";
  elapsed: number;
  error: string;
}

interface AuditView {
  levelIndex: number;
  challengeIndex: number;
  cycle: number;
  action: string;
  status: ArenaAutopilotState["status"];
  elapsed: number;
  remaining: number;
  hazardsDone: number;
  hazardsTotal: number;
  lastEvent: string;
  groundColour: string;
  error: string;
}

const hardware = createAuditHardware();

function createMission(levelIndex: number, challengeIndex: number) {
  const world = createWorld(hardware, challengeIndex, LEVELS[levelIndex].id);
  return { world, autopilot: createArenaAutopilot(world) };
}

function initialView(world: WorldState, autopilot: ArenaAutopilotState): AuditView {
  return {
    levelIndex: 0,
    challengeIndex: 0,
    cycle: 1,
    action: autopilot.message,
    status: autopilot.status,
    elapsed: 0,
    remaining: world.competition.remaining,
    hazardsDone: 0,
    hazardsTotal: world.layout.challenge.requiredHazards.length,
    lastEvent: world.competition.lastEvent,
    groundColour: sensorColor(world, "3"),
    error: autopilot.error,
  };
}

export default function ArenaAudit() {
  const initial = useRef(createMission(0, 0));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef(initial.current.world);
  const autopilotRef = useRef(initial.current.autopilot);
  const levelIndexRef = useRef(0);
  const challengeIndexRef = useRef(0);
  const cycleRef = useRef(1);
  const transitionAtRef = useRef(0);
  const resultRecordedRef = useRef(false);
  const pausedRef = useRef(false);
  const speedRef = useRef(2);
  const loopRef = useRef(true);
  const resultsRef = useRef<MissionResult[]>([]);
  const [view, setView] = useState(() => initialView(initial.current.world, initial.current.autopilot));
  const [results, setResults] = useState<MissionResult[]>([]);
  const [lastCycle, setLastCycle] = useState<MissionResult[]>([]);
  const [failureHistory, setFailureHistory] = useState<MissionResult[]>([]);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [loop, setLoop] = useState(true);

  const publishView = useCallback(() => {
    const world = worldRef.current;
    const autopilot = autopilotRef.current;
    setView({
      levelIndex: levelIndexRef.current,
      challengeIndex: challengeIndexRef.current,
      cycle: cycleRef.current,
      action: autopilot.message,
      status: autopilot.status,
      elapsed: world.competition.elapsed,
      remaining: world.competition.remaining,
      hazardsDone: world.competition.scoredHazards.length,
      hazardsTotal: world.layout.challenge.requiredHazards.length,
      lastEvent: world.competition.lastEvent,
      groundColour: sensorColor(world, "3"),
      error: autopilot.error,
    });
  }, []);

  const startMission = useCallback((levelIndex: number, challengeIndex: number) => {
    const next = createMission(levelIndex, challengeIndex);
    levelIndexRef.current = levelIndex;
    challengeIndexRef.current = challengeIndex;
    worldRef.current = next.world;
    autopilotRef.current = next.autopilot;
    transitionAtRef.current = 0;
    resultRecordedRef.current = false;
    publishView();
  }, [publishView]);

  const restartAudit = useCallback(() => {
    cycleRef.current = 1;
    resultsRef.current = [];
    setResults([]);
    setLastCycle([]);
    setFailureHistory([]);
    startMission(0, 0);
  }, [startMission]);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { loopRef.current = loop; }, [loop]);

  useEffect(() => {
    let animationFrame = 0;
    let previous = performance.now();
    let publishedAt = 0;

    const animate = (now: number) => {
      const realDelta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const world = worldRef.current;
      const autopilot = autopilotRef.current;

      if (!pausedRef.current) {
        if (transitionAtRef.current && now >= transitionAtRef.current) {
          const lastMission = challengeIndexRef.current === ARENA_CHALLENGE_COUNT - 1;
          const lastLevel = levelIndexRef.current === LEVELS.length - 1;
          if (lastMission && lastLevel) {
            if (loopRef.current) {
              setLastCycle(resultsRef.current);
              resultsRef.current = [];
              setResults([]);
              cycleRef.current += 1;
              startMission(0, 0);
            } else {
              transitionAtRef.current = Number.POSITIVE_INFINITY;
            }
          } else if (lastMission) {
            startMission(levelIndexRef.current + 1, 0);
          } else {
            startMission(levelIndexRef.current, challengeIndexRef.current + 1);
          }
        } else if (!transitionAtRef.current) {
          stepArenaAutopilot(world, autopilot, realDelta * speedRef.current);
          if (autopilot.status !== "running" && !resultRecordedRef.current) {
            resultRecordedRef.current = true;
            const result: MissionResult = {
              key: `${world.layout.level}-${world.layout.challenge.number}`,
              cycle: cycleRef.current,
              level: world.layout.level,
              challenge: world.layout.challenge.number,
              title: world.layout.challenge.title,
              status: autopilot.status,
              elapsed: world.competition.elapsed,
              error: autopilot.error,
            };
            resultsRef.current = [...resultsRef.current, result];
            setResults(resultsRef.current);
            if (result.status === "failed") {
              setFailureHistory((current) => [...current, result].slice(-20));
            }
            transitionAtRef.current = now + 850;
          }
        }
      }

      if (canvasRef.current) drawWorld(canvasRef.current, worldRef.current);
      if (now - publishedAt > 100) {
        publishedAt = now;
        publishView();
      }
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [publishView, startMission]);

  const currentWorld = worldRef.current;
  const passed = results.filter((result) => result.status === "passed").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const completed = passed + failed;
  const progress = (completed / (LEVELS.length * ARENA_CHALLENGE_COUNT)) * 100;
  const currentLevel = LEVELS[view.levelIndex];
  const displayedResults = results.length ? results : lastCycle;

  return (
    <main className="arena-audit-shell" data-audit-status={view.status}>
      <header className="arena-audit-header">
        <div>
          <span className="arena-audit-kicker">QA AUTOMÁTICO · CICLO {view.cycle}</span>
          <h1>Auditoria das 40 arenas</h1>
          <p>O robô percorre objetivos, sensores, gaps, portais e obstáculos usando as mesmas regras do jogo.</p>
        </div>
        <div className="arena-audit-controls">
          <label>Velocidade
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              <option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option><option value={8}>8×</option>
            </select>
          </label>
          <label className="arena-audit-loop"><input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} /> Repetir</label>
          <button type="button" onClick={() => setPaused((current) => !current)}>{paused ? "▶ Continuar" : "Ⅱ Pausar"}</button>
          <button type="button" className="secondary" onClick={restartAudit}>↻ Reiniciar</button>
          <a href="/eu-vou-programar/">Voltar ao jogo</a>
        </div>
      </header>

      <section className="arena-audit-progress" aria-label="Progresso da auditoria">
        <div><strong>{completed}/40</strong><span>testadas</span></div>
        <div><strong className="passed">{passed}</strong><span>aprovadas</span></div>
        <div><strong className={failed ? "failed" : ""}>{failed}</strong><span>falhas</span></div>
        <div className="arena-audit-progress-bar"><i style={{ width: `${progress}%` }} /></div>
      </section>

      <section className="arena-audit-main">
        <div className="arena-audit-canvas-card">
          <div className="arena-audit-mission-title">
            <span>{currentLevel.name} · missão {view.challengeIndex + 1}/10</span>
            <strong aria-label="Missão atual">{currentWorld.layout.challenge.title}</strong>
            <em className={`status-${view.status}`}>{view.status === "running" ? "EXECUTANDO" : view.status === "passed" ? "APROVADA" : "FALHOU"}</em>
          </div>
          <canvas ref={canvasRef} aria-label="Arena executada pelo robô de auditoria" />
        </div>

        <aside className="arena-audit-telemetry">
          <h2>Execução atual</h2>
          <dl>
            <div><dt>Ação</dt><dd>{view.action}</dd></div>
            <div><dt>Etapas</dt><dd>{view.hazardsDone}/{view.hazardsTotal}</dd></div>
            <div><dt>Tempo</dt><dd>{view.elapsed.toFixed(1)} s</dd></div>
            <div><dt>Restante</dt><dd>{view.remaining.toFixed(1)} s</dd></div>
            <div><dt>Sensor de chão</dt><dd>{view.groundColour}</dd></div>
          </dl>
          <div className="arena-audit-event"><span>Último evento</span><p>{view.lastEvent}</p></div>
          {view.error && <output aria-label="Resultado da auditoria" className="arena-audit-error">{view.error}</output>}
          {!view.error && <output aria-label="Resultado da auditoria" className="arena-audit-ok">Nenhum bloqueio detectado nesta missão.</output>}
        </aside>
      </section>

      <section className={`arena-audit-failures ${failureHistory.length ? "has-failures" : ""}`} aria-label="Histórico de falhas">
        <h2>Falhas encontradas</h2>
        {failureHistory.length === 0
          ? <output>Nenhuma falha encontrada desde o início desta auditoria.</output>
          : <ol>{failureHistory.map((result, index) => (
            <li key={`${result.cycle}-${result.key}-${index}`}>
              <strong>Ciclo {result.cycle} · {LEVELS.find((level) => level.id === result.level)?.name} {result.challenge}</strong>
              <span>{result.title}: {result.error || "a missão não foi concluída"}</span>
            </li>
          ))}</ol>}
      </section>

      <section className="arena-audit-results">
        <h2>Mapa das missões</h2>
        <div>
          {LEVELS.flatMap((level) => Array.from({ length: ARENA_CHALLENGE_COUNT }, (_, index) => {
            const key = `${level.id}-${index + 1}`;
            const result = displayedResults.find((item) => item.key === key);
            const active = level.id === currentLevel.id && index === view.challengeIndex;
            return <article key={key} className={`${result?.status ?? (active ? "active" : "pending")}`} title={result?.error || result?.title}>
              <span>{level.name}</span><strong>{index + 1}</strong><small>{result?.status === "passed" ? "✓" : result?.status === "failed" ? "!" : active ? "●" : "—"}</small>
            </article>;
          }))}
        </div>
      </section>
    </main>
  );
}
