"use client";

import { useState } from "react";
import type { DragEvent } from "react";
import {
  cloneHardware,
  defaultSensorMount,
  DEFAULT_HARDWARE,
  EMPTY_HARDWARE,
  hardwareCount,
  HardwareConfig,
  isRobotComplete,
  isRobotReady,
  MOTOR_DEFINITIONS,
  MOTOR_PORTS,
  MotorKind,
  MotorPort,
  MotorRole,
  SENSOR_DEFINITIONS,
  SENSOR_POSITION_DEFINITIONS,
  SENSOR_POSITIONS,
  SENSOR_PORTS,
  SensorAim,
  SensorKind,
  SensorMount,
  SensorPort,
  SensorPosition,
} from "./hardware";

interface RobotBuilderProps {
  config: HardwareConfig;
  onChange: (config: HardwareConfig) => void;
  onProgram: () => void;
}

type PieceSelection =
  | { type: "motor"; kind: MotorKind; sourcePort?: MotorPort }
  | { type: "sensor"; kind: SensorKind; sourcePort?: SensorPort };

type SensorPieceSelection = Extract<PieceSelection, { type: "sensor" }>;
type MotorPieceSelection = Extract<PieceSelection, { type: "motor" }>;

interface MotorPlacement {
  port: MotorPort;
  piece: MotorPieceSelection;
  role: MotorRole;
}

interface SensorPlacement {
  port: SensorPort;
  piece: SensorPieceSelection;
  mount: SensorMount;
}

const DRAG_TYPE = "application/x-euvou-ev3-piece";
const MOTOR_ROLE_OPTIONS: Array<{ role: MotorRole; icon: string; name: string; description: string }> = [
  { role: "left-wheel", icon: "←", name: "Roda esquerda", description: "Move o lado esquerdo do carrinho." },
  { role: "right-wheel", icon: "→", name: "Roda direita", description: "Move o lado direito e fica espelhado." },
  { role: "accessory", icon: "⚙", name: "Acessório", description: "Funciona pelo código sem mover as rodas." },
  { role: "unassigned", icon: "○", name: "Sem função", description: "Fica conectado para você definir depois." },
];

function parsePiece(event: DragEvent): PieceSelection | null {
  try {
    return JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as PieceSelection;
  } catch {
    return null;
  }
}

function MotorPiece({ kind, compact = false }: { kind: MotorKind; compact?: boolean }) {
  return (
    <span className={`hardware-piece-visual motor-piece-visual motor-${kind} ${compact ? "compact" : ""}`} aria-hidden="true">
      <i className="motor-hub">＋</i><i className="motor-cable" />
    </span>
  );
}
function SensorPiece({ kind, compact = false }: { kind: SensorKind; compact?: boolean }) {
  const sensor = SENSOR_DEFINITIONS[kind];
  return (
    <span className={`hardware-piece-visual sensor-piece-visual sensor-${kind} ${compact ? "compact" : ""}`} style={{ "--piece-colour": sensor.colour } as React.CSSProperties} aria-hidden="true">
      <i>{sensor.icon}</i><b />
    </span>
  );
}

export default function RobotBuilder({ config, onChange, onProgram }: RobotBuilderProps) {
  const [selected, setSelected] = useState<PieceSelection | null>(null);
  const [motorPlacement, setMotorPlacement] = useState<MotorPlacement | null>(null);
  const [sensorPlacement, setSensorPlacement] = useState<SensorPlacement | null>(null);
  const ready = isRobotReady(config);
  const complete = isRobotComplete(config);
  const pieceCount = hardwareCount(config);
  const motorCount = MOTOR_PORTS.filter((port) => config.motors[port]).length;
  const needsWheelRoles = motorCount >= 2 && !ready;

  const startMotorPlacement = (port: MotorPort, piece: PieceSelection | null) => {
    const installed = config.motors[port];
    const motorPiece = piece?.type === "motor" ? piece : installed ? { type: "motor" as const, kind: installed, sourcePort: port } : null;
    if (!motorPiece) return;
    const existingRole = motorPiece.sourcePort ? config.motorMounts[motorPiece.sourcePort]?.role : config.motorMounts[port]?.role;
    const role = existingRole
      ?? (!MOTOR_PORTS.some((item) => config.motorMounts[item]?.role === "left-wheel")
        ? "left-wheel"
        : !MOTOR_PORTS.some((item) => config.motorMounts[item]?.role === "right-wheel")
          ? "right-wheel"
          : "accessory");
    setMotorPlacement({ port, piece: motorPiece, role });
  };

  const confirmMotorPlacement = () => {
    if (!motorPlacement) return;
    const { port, piece, role } = motorPlacement;
    const next = cloneHardware(config);
    const replaced = next.motors[port];
    const replacedMount = next.motorMounts[port];
    if (piece.sourcePort && piece.sourcePort !== port) {
      next.motors[piece.sourcePort] = replaced;
      next.motorMounts[piece.sourcePort] = replaced ? replacedMount ?? { role: "unassigned" } : null;
    }
    next.motors[port] = piece.kind;
    next.motorMounts[port] = { role };
    if (role === "left-wheel" || role === "right-wheel") {
      for (const otherPort of MOTOR_PORTS) {
        if (otherPort !== port && next.motorMounts[otherPort]?.role === role) next.motorMounts[otherPort] = { role: "unassigned" };
      }
    }
    onChange(next);
    setMotorPlacement(null);
    setSelected(null);
  };

  const startSensorPlacement = (port: SensorPort, piece: PieceSelection | null) => {
    if (!piece || piece.type !== "sensor") return;
    const existingMount = piece.sourcePort ? config.sensorMounts[piece.sourcePort] : config.sensorMounts[port];
    const fallback = existingMount ?? defaultSensorMount(piece.kind, port);
    const occupied = new Set(SENSOR_PORTS
      .filter((item) => item !== piece.sourcePort && item !== port && config.sensors[item])
      .map((item) => config.sensorMounts[item]?.position)
      .filter((position): position is SensorPosition => Boolean(position)));
    const position = occupied.has(fallback.position) ? SENSOR_POSITIONS.find((item) => !occupied.has(item)) ?? fallback.position : fallback.position;
    setSensorPlacement({ port, piece, mount: { position, aim: piece.kind === "color" ? fallback.aim : "outward" } });
  };

  const confirmSensorPlacement = () => {
    if (!sensorPlacement) return;
    const { port, piece, mount } = sensorPlacement;
    const next = cloneHardware(config);
    const replacedSensor = next.sensors[port];
    const replacedMount = next.sensorMounts[port];
    if (piece.sourcePort && piece.sourcePort !== port) {
      next.sensors[piece.sourcePort] = replacedSensor;
      next.sensorMounts[piece.sourcePort] = replacedSensor ? replacedMount : null;
    }
    next.sensors[port] = piece.kind;
    next.sensorMounts[port] = { ...mount };
    onChange(next);
    setSensorPlacement(null);
    setSelected(null);
  };

  const removeMotor = (port: MotorPort) => {
    const next = cloneHardware(config);
    next.motors[port] = null;
    next.motorMounts[port] = null;
    onChange(next);
  };

  const removeSensor = (port: SensorPort) => {
    const next = cloneHardware(config);
    next.sensors[port] = null;
    next.sensorMounts[port] = null;
    onChange(next);
  };

  const beginDrag = (event: DragEvent, piece: PieceSelection) => {
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(piece));
    const movingExistingPiece = piece.type === "sensor" ? piece.sourcePort : piece.sourcePort;
    event.dataTransfer.effectAllowed = movingExistingPiece ? "move" : "copy";
    setSelected(piece);
  };

  return (
    <div className="robot-builder">
      <div className="builder-heading">
        <div>
          <span className="builder-kicker">Laboratório de montagem</span>
          <h2>Monte como peças de robótica</h2>
          <p>Arraste uma peça ou toque nela e depois no encaixe do robô.</p>
        </div>
        <div className={`builder-readiness ${ready ? "ready" : "incomplete"}`}>
          <span>{ready ? "✓" : pieceCount}</span>
          <div>
            <strong>{complete ? "Robô completo" : ready ? "Pronto para movimentar" : needsWheelRoles ? "Defina as duas rodas" : `${pieceCount} peça${pieceCount === 1 ? "" : "s"} conectada${pieceCount === 1 ? "" : "s"}`}</strong>
            <small>{complete ? "Todas as funções disponíveis" : ready ? "Rodas esquerda e direita configuradas" : needsWheelRoles ? "Escolha uma roda esquerda e uma direita" : "Cada peça libera apenas a sua própria função"}</small>
          </div>
        </div>
      </div>

      <div className="builder-layout">
        <aside className="parts-tray" aria-label="Bandeja de peças">
          <header><span>▦</span><div><strong>Peças disponíveis</strong><small>4 saídas + 4 sensores</small></div></header>

          {(Object.keys(MOTOR_DEFINITIONS) as MotorKind[]).map((kind) => {
            const motor = MOTOR_DEFINITIONS[kind];
            const installed = MOTOR_PORTS.filter((port) => config.motors[port] === kind).length;
            return <button
              type="button"
              key={kind}
              className={`tray-piece motor-tray-piece ${selected?.type === "motor" && selected.kind === kind ? "selected" : ""}`}
              draggable
              onDragStart={(event) => beginDrag(event, { type: "motor", kind })}
              onClick={() => setSelected({ type: "motor", kind })}
              aria-pressed={selected?.type === "motor" && selected.kind === kind}
            >
              <MotorPiece kind={kind} compact />
              <span><strong>{motor.name}</strong><small>{motor.description}</small></span>
              <b className={installed ? "installed" : ""}>×{installed}</b>
            </button>;
          })}

          <div className="tray-divider"><span>Sensores</span></div>
          {(Object.keys(SENSOR_DEFINITIONS) as SensorKind[]).map((kind) => {
            const sensor = SENSOR_DEFINITIONS[kind];
            const installed = SENSOR_PORTS.filter((port) => config.sensors[port] === kind).length;
            return (
              <button
                type="button"
                key={kind}
                className={`tray-piece ${selected?.type === "sensor" && selected.kind === kind ? "selected" : ""}`}
                draggable
                onDragStart={(event) => beginDrag(event, { type: "sensor", kind })}
                onClick={() => setSelected({ type: "sensor", kind })}
                aria-pressed={selected?.type === "sensor" && selected.kind === kind}
              >
                <SensorPiece kind={kind} compact />
                <span><strong>{sensor.shortName}</strong><small>Porta sugerida {sensor.recommendedPort}</small></span>
                <b className={installed ? "installed" : ""}>{installed ? `×${installed}` : "+"}</b>
              </button>
            );
          })}

          <div className="builder-touch-tip"><span>☝</span><p><strong>No celular:</strong> toque na peça e depois no encaixe.</p></div>
        </aside>

        <section className="robot-build-stage" aria-label="Área de montagem do robô">
          <div className="stage-grid" aria-hidden="true" />
          <div className="ev3-chassis">
            <div className="brick-screen"><span>EV</span><i className={ready ? "on" : ""} /></div>
            <div className="brick-buttons"><i /><i /><i /><i /><b>●</b></div>
            <div className="chassis-studs" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>

            {MOTOR_PORTS.map((port) => {
              const installed = config.motors[port];
              const role = config.motorMounts[port]?.role;
              const portName = !installed ? "Saída de motor" : role === "left-wheel" ? "Tração esquerda" : role === "right-wheel" ? "Tração direita" : role === "accessory" ? "Acessório" : "Sem função";
              return (
                <div
                  key={port}
                  className={`motor-slot motor-slot-${port.toLowerCase()} ${installed ? "filled" : "empty"} ${selected?.type === "motor" ? "can-drop" : ""}`}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
                  onDrop={(event) => { event.preventDefault(); startMotorPlacement(port, parsePiece(event)); }}
                  onClick={() => startMotorPlacement(port, selected)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") startMotorPlacement(port, selected); }}
                  aria-label={`Saída de motor ${port}, ${portName}${installed ? `, ${MOTOR_DEFINITIONS[installed].name}` : ", vazia"}`}
                >
                  <span className="slot-label"><b>{port}</b>{portName}</span>
                  {installed ? (
                    <div className="installed-piece" draggable onDragStart={(event) => beginDrag(event, { type: "motor", kind: installed, sourcePort: port })}>
                      <MotorPiece kind={installed} />
                      <strong>{MOTOR_DEFINITIONS[installed].shortName}</strong>
                      <button type="button" onClick={(event) => { event.stopPropagation(); removeMotor(port); }} aria-label={`Retirar motor da saída ${port}`}>×</button>
                    </div>
                  ) : <div className="empty-slot-mark"><span>＋</span><small>encaixe o motor</small></div>}
                </div>
              );
            })}

            <div className="sensor-rack">
              {SENSOR_PORTS.map((port) => {
                const sensorKind = config.sensors[port];
                const sensor = sensorKind ? SENSOR_DEFINITIONS[sensorKind] : null;
                const recommended = sensor?.recommendedPort === port;
                return (
                  <div
                    key={port}
                    className={`sensor-slot ${sensorKind ? "filled" : "empty"} ${selected?.type === "sensor" ? "can-drop" : ""}`}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
                    onDrop={(event) => { event.preventDefault(); startSensorPlacement(port, parsePiece(event)); }}
                    onClick={() => startSensorPlacement(port, selected)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") startSensorPlacement(port, selected); }}
                    aria-label={`Porta de sensor ${port}${sensor ? `, ${sensor.name}` : ", vazia"}`}
                  >
                    <span className="sensor-port-number">{port}</span>
                    {sensorKind && sensor ? (
                      <div className="installed-piece" draggable onDragStart={(event) => beginDrag(event, { type: "sensor", kind: sensorKind, sourcePort: port })}>
                        <SensorPiece kind={sensorKind} />
                        <strong>{sensor.shortName}</strong>
                        <small className="sensor-mount-note">{SENSOR_POSITION_DEFINITIONS[config.sensorMounts[port]?.position ?? defaultSensorMount(sensorKind, port).position].shortName} · {(config.sensorMounts[port]?.aim ?? "outward") === "ground" ? "chão" : "para fora"}</small>
                        {!recommended && <small className="port-note">porta alternativa</small>}
                        <button className="sensor-position-button" type="button" onClick={(event) => { event.stopPropagation(); startSensorPlacement(port, { type: "sensor", kind: sensorKind, sourcePort: port }); }} aria-label={`Alterar posição de ${sensor.name}`}>⌖</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); removeSensor(port); }} aria-label={`Retirar ${sensor.name}`}>×</button>
                      </div>
                    ) : <div className="empty-slot-mark"><span>＋</span><small>sensor</small></div>}
                  </div>
                );
              })}
            </div>
            <div className="robot-front-label">FRENTE DO ROBÔ <span>↑</span></div>
          </div>
        </section>

        <aside className="assembly-guide">
          <div className="guide-card guide-ready-card">
            <span>★</span><div><strong>Quer só programar?</strong><p>O robô já começa completo. Restaure todas as peças quando quiser.</p></div>
            <button type="button" onClick={() => { onChange(cloneHardware(DEFAULT_HARDWARE)); setSelected(null); }}>Usar robô pronto</button>
          </div>
          <div className="guide-card">
            <strong>Conexões recomendadas</strong>
            <ul>
              <li><b>A</b> servo médio</li><li><b>B</b> servo grande</li><li><b>C</b> servo grande</li><li><b>D</b> servo médio</li>
              {(Object.keys(SENSOR_DEFINITIONS) as SensorKind[]).map((kind) => <li key={kind}><b>{SENSOR_DEFINITIONS[kind].recommendedPort}</b> {SENSOR_DEFINITIONS[kind].shortName}</li>)}
            </ul>
          </div>
          <div className="builder-actions">
            <button type="button" className="clear-robot-button" onClick={() => { onChange(cloneHardware(EMPTY_HARDWARE)); setSelected(null); }}>Desmontar tudo</button>
            <button type="button" className="program-robot-button" onClick={onProgram}>Ir para os blocos<span>→</span></button>
          </div>
        </aside>
      </div>

      {motorPlacement && (() => {
        const motor = MOTOR_DEFINITIONS[motorPlacement.piece.kind];
        const occupiedBy = (role: MotorRole) => role === "left-wheel" || role === "right-wheel"
          ? MOTOR_PORTS.find((port) => port !== motorPlacement.piece.sourcePort && port !== motorPlacement.port && config.motors[port] && config.motorMounts[port]?.role === role)
          : undefined;
        return (
          <div className="sensor-placement-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMotorPlacement(null); }}>
            <section className="sensor-placement-dialog motor-placement-dialog" role="dialog" aria-modal="true" aria-labelledby="motor-placement-title">
              <header>
                <MotorPiece kind={motorPlacement.piece.kind} compact />
                <div><span>Motor na porta {motorPlacement.port}</span><h3 id="motor-placement-title">Qual será a função do {motor.shortName}?</h3><p>A porta não determina a posição: você escolhe o que este motor fará.</p></div>
                <button type="button" onClick={() => setMotorPlacement(null)} aria-label="Cancelar função do motor">×</button>
              </header>

              <div className="motor-role-picker" aria-label="Funções disponíveis para o motor">
                {MOTOR_ROLE_OPTIONS.map((option) => {
                  const occupiedPort = occupiedBy(option.role);
                  const active = motorPlacement.role === option.role;
                  return <button
                    type="button"
                    key={option.role}
                    className={active ? "active" : ""}
                    onClick={() => setMotorPlacement((current) => current ? { ...current, role: option.role } : current)}
                    aria-pressed={active}
                  >
                    <span>{option.icon}</span><b>{option.name}</b><small>{occupiedPort ? `Substitui a porta ${occupiedPort} nesta função.` : option.description}</small>
                  </button>;
                })}
              </div>

              <div className="sensor-behaviour-note motor-role-note"><span>✓</span><p>Motor grande ou médio funciona em qualquer porta. Para o carrinho andar, escolha exatamente uma roda esquerda e uma roda direita.</p></div>
              <footer><button type="button" onClick={() => setMotorPlacement(null)}>Cancelar</button><button type="button" onClick={confirmMotorPlacement}>Confirmar função <span>→</span></button></footer>
            </section>
          </div>
        );
      })()}

      {sensorPlacement && (() => {
        const sensor = SENSOR_DEFINITIONS[sensorPlacement.piece.kind];
        const occupiedBy = (position: SensorPosition) => SENSOR_PORTS.find((port) => port !== sensorPlacement.piece.sourcePort && port !== sensorPlacement.port && config.sensors[port] && config.sensorMounts[port]?.position === position);
        const arrows: Record<SensorPosition, string> = { "front-left": "↖", "front-center": "↑", "front-right": "↗", left: "←", center: "EV", right: "→", "rear-left": "↙", "rear-center": "↓", "rear-right": "↘" };
        return (
          <div className="sensor-placement-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSensorPlacement(null); }}>
            <section className="sensor-placement-dialog" role="dialog" aria-modal="true" aria-labelledby="sensor-placement-title">
              <header>
                <SensorPiece kind={sensorPlacement.piece.kind} compact />
                <div><span>Sensor na porta {sensorPlacement.port}</span><h3 id="sensor-placement-title">Onde o {sensor.shortName} ficará?</h3><p>A posição muda o que o programa consegue perceber.</p></div>
                <button type="button" onClick={() => setSensorPlacement(null)} aria-label="Cancelar posicionamento">×</button>
              </header>

              <div className="sensor-position-map" aria-label="Posições disponíveis no robô">
                {SENSOR_POSITIONS.map((position) => {
                  const occupiedPort = occupiedBy(position);
                  const active = sensorPlacement.mount.position === position;
                  return <button
                    type="button"
                    key={position}
                    className={active ? "active" : ""}
                    disabled={Boolean(occupiedPort)}
                    onClick={() => setSensorPlacement((current) => current ? { ...current, mount: { ...current.mount, position } } : current)}
                    aria-pressed={active}
                  >
                    <b>{arrows[position]}</b><span>{SENSOR_POSITION_DEFINITIONS[position].name}</span><small>{occupiedPort ? `ocupado pela porta ${occupiedPort}` : active ? "posição escolhida" : "toque para escolher"}</small>
                  </button>;
                })}
                <div className="sensor-map-robot" aria-hidden="true"><span>FRENTE</span><strong>EV</strong><i /></div>
              </div>

              {sensorPlacement.piece.kind === "color" ? (
                <div className="sensor-aim-picker">
                  <div><strong>Para onde ele vai olhar?</strong><small>Isso muda a cor devolvida ao bloco.</small></div>
                  <button type="button" className={sensorPlacement.mount.aim === "ground" ? "active" : ""} onClick={() => setSensorPlacement((current) => current ? { ...current, mount: { ...current.mount, aim: "ground" as SensorAim } } : current)}><span>✦</span><b>Para o chão</b><small>Lê somente o piso sob essa posição.</small></button>
                  <button type="button" className={sensorPlacement.mount.aim === "outward" ? "active" : ""} onClick={() => setSensorPlacement((current) => current ? { ...current, mount: { ...current.mount, aim: "outward" as SensorAim } } : current)}><span>⌁</span><b>Para fora</b><small>Enxerga o primeiro objeto nessa direção.</small></button>
                </div>
              ) : (
                <div className="sensor-behaviour-note"><span>{sensorPlacement.piece.kind === "gyro" ? "↻" : sensorPlacement.piece.kind === "touch" ? "●" : "◔"}</span><p>{sensorPlacement.piece.kind === "gyro" ? "O giroscópio mede o giro do robô inteiro, mas a posição escolhida continua aparecendo na montagem." : sensorPlacement.piece.kind === "touch" ? "O toque só será acionado quando o robô encostar do lado onde ele foi instalado." : "A distância será medida para fora, exatamente na direção dessa posição."}</p></div>
              )}

              <footer><button type="button" onClick={() => setSensorPlacement(null)}>Cancelar</button><button type="button" onClick={confirmSensorPlacement}>Confirmar posição <span>→</span></button></footer>
            </section>
          </div>
        );
      })()}
    </div>
  );
}
