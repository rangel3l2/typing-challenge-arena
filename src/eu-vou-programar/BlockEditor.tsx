"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as Blockly from "blockly";
import * as locale from "blockly/msg/pt-br";
import { EV3_BLOCK_COLORS, EV3_TOOLBOX, generatePython, hasExecutableProgram, registerEV3Blocks } from "./blocks";
import { copyWorkspaceImage } from "./editorClipboard";
import type { ImageCopyResult } from "./editorClipboard";
import type { MotorPort } from "./hardware";

interface BlockEditorProps {
  programXml: string;
  leftMotorPort: MotorPort;
  rightMotorPort: MotorPort;
  onChange: (programXml: string, python: string, executable: boolean) => void;
}

export interface BlockEditorHandle {
  copyBlocksImage: () => Promise<ImageCopyResult>;
}

const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(function BlockEditor({ programXml, leftMotorPort, rightMotorPort, onChange }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const lastSerializedRef = useRef("");
  const onChangeRef = useRef(onChange);
  const movementMotorsRef = useRef({ left: leftMotorPort, right: rightMotorPort });
  const [loadError, setLoadError] = useState("");

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let errorTimer = 0;

    try {
      if (!hostRef.current) return;
      const localeMessages = Object.fromEntries(Object.entries(locale).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
      Blockly.setLocale(localeMessages);
      registerEV3Blocks(Blockly);

      const theme = Blockly.Theme.defineTheme("ev3-classroom-br", {
        name: "ev3-classroom-br",
        base: Blockly.Themes.Zelos,
        startHats: true,
        blockStyles: {
          event_blocks: { colourPrimary: EV3_BLOCK_COLORS.events, colourSecondary: "#d99f00", colourTertiary: "#b78200" },
          motor_blocks: { colourPrimary: EV3_BLOCK_COLORS.motor, colourSecondary: "#0076c2", colourTertiary: "#005f9e" },
          movement_blocks: { colourPrimary: EV3_BLOCK_COLORS.movement, colourSecondary: "#c72f98", colourTertiary: "#a91f7e" },
          display_blocks: { colourPrimary: EV3_BLOCK_COLORS.display, colourSecondary: "#7441c4", colourTertiary: "#5e31a5" },
          control_blocks: { colourPrimary: EV3_BLOCK_COLORS.control, colourSecondary: "#db8d0c", colourTertiary: "#b97600" },
          sensor_blocks: { colourPrimary: EV3_BLOCK_COLORS.sensors, colourSecondary: "#0d9dbd", colourTertiary: "#087f9a" },
          operator_blocks: { colourPrimary: EV3_BLOCK_COLORS.operators, colourSecondary: "#07963d", colourTertiary: "#067c34" },
        },
        componentStyles: {
          workspaceBackgroundColour: "#fbfcfd",
          toolboxBackgroundColour: "#ffffff",
          toolboxForegroundColour: "#2f3540",
          flyoutBackgroundColour: "#f5f7f9",
          flyoutForegroundColour: "#2f3540",
          flyoutOpacity: 1,
          scrollbarColour: "#aeb7c3",
          scrollbarOpacity: 0.65,
          insertionMarkerColour: "#309151",
          insertionMarkerOpacity: 0.45,
          selectedGlowColour: "#309151",
          selectedGlowOpacity: 0.35,
        },
        fontStyle: { family: "Nunito, sans-serif", weight: "700", size: 11 },
      });

      const workspace = Blockly.inject(hostRef.current, {
        toolbox: EV3_TOOLBOX,
        renderer: "zelos",
        theme,
        trashcan: true,
        sounds: true,
        move: { scrollbars: true, drag: true, wheel: true },
        zoom: { controls: true, wheel: true, startScale: 0.72, maxScale: 1.4, minScale: 0.42, scaleSpeed: 1.12, pinch: true },
        grid: { spacing: 24, length: 2, colour: "#d7dde4", snap: false },
      });

      const loadXml = (source: string) => {
        workspace.clear();
        const dom = Blockly.utils.xml.textToDom(source);
        Blockly.Xml.domToWorkspace(dom, workspace);
        lastSerializedRef.current = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace));
        workspace.scrollCenter();
      };

      loadXml(programXml);
      onChangeRef.current(lastSerializedRef.current, generatePython(workspace, movementMotorsRef.current), hasExecutableProgram(workspace));
      workspace.addChangeListener((event) => {
        if (event.isUiEvent || workspace.isDragging()) return;
        const xmlText = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace));
        lastSerializedRef.current = xmlText;
        onChangeRef.current(xmlText, generatePython(workspace, movementMotorsRef.current), hasExecutableProgram(workspace));
      });

      workspaceRef.current = workspace;
      resizeObserver = new ResizeObserver(() => Blockly.svgResize(workspace));
      resizeObserver.observe(hostRef.current);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível abrir os blocos.";
      errorTimer = window.setTimeout(() => setLoadError(message), 0);
    }

    return () => {
      resizeObserver?.disconnect();
      window.clearTimeout(errorTimer);
      workspaceRef.current?.dispose();
      workspaceRef.current = null;
    };
  // O editor Blockly deve ser criado apenas uma vez; mudanças externas são tratadas abaixo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || programXml === lastSerializedRef.current) return;
    workspace.clear();
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(programXml), workspace);
    lastSerializedRef.current = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace));
    workspace.scrollCenter();
    onChangeRef.current(lastSerializedRef.current, generatePython(workspace, movementMotorsRef.current), hasExecutableProgram(workspace));
  }, [programXml]);

  useEffect(() => {
    movementMotorsRef.current = { left: leftMotorPort, right: rightMotorPort };
    const workspace = workspaceRef.current;
    if (!workspace) return;
    onChangeRef.current(lastSerializedRef.current, generatePython(workspace, movementMotorsRef.current), hasExecutableProgram(workspace));
  }, [leftMotorPort, rightMotorPort]);

  const centerBlocks = () => workspaceRef.current?.scrollCenter();
  const undo = (redo = false) => workspaceRef.current?.undo(redo);
  useImperativeHandle(ref, () => ({
    copyBlocksImage: async () => {
      const workspace = workspaceRef.current;
      if (!workspace) throw new Error("O editor de blocos ainda está carregando.");
      Blockly.hideChaff(true);
      return copyWorkspaceImage(workspace);
    },
  }), []);

  return (
    <div className="ev3-editor-shell">
      <div className="ev3-editor-guide">
        <div><span className="ev3-guide-dot" /> Arraste um bloco da categoria e encaixe na pilha</div>
        <div className="ev3-editor-actions">
          <button type="button" onClick={() => undo(false)} title="Desfazer" aria-label="Desfazer">↶</button>
          <button type="button" onClick={() => undo(true)} title="Refazer" aria-label="Refazer">↷</button>
          <button type="button" onClick={centerBlocks} title="Centralizar blocos">Centralizar</button>
        </div>
      </div>
      <div className="ev3-blockly-host" ref={hostRef} aria-label="Editor de blocos EV3 Classroom em português" />
      {loadError && <div className="ev3-editor-error"><strong>Não foi possível abrir o editor.</strong><small>{loadError}</small></div>}
    </div>
  );
});

export default BlockEditor;
