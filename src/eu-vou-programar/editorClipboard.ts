import type * as Blockly from "blockly";

export type ImageCopyResult = "clipboard" | "shared" | "downloaded";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const STYLE_PROPERTIES = [
  "fill", "fill-opacity", "stroke", "stroke-opacity", "stroke-width", "opacity",
  "font-family", "font-size", "font-style", "font-weight", "letter-spacing",
  "text-anchor", "dominant-baseline", "display", "visibility",
];

function inlineSvgStyles(source: Element, clone: Element) {
  const computed = window.getComputedStyle(source);
  for (const property of STYLE_PROPERTIES) {
    const value = computed.getPropertyValue(property);
    if (value) (clone as SVGElement).style.setProperty(property, value);
  }
  const sourceChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);
  sourceChildren.forEach((child, index) => {
    if (cloneChildren[index]) inlineSvgStyles(child, cloneChildren[index]);
  });
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível criar a imagem dos blocos.")), "image/png");
  });
}

function loadSvgImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível preparar a imagem dos blocos."));
    };
    image.src = url;
  });
}

export async function renderWorkspacePng(workspace: Blockly.WorkspaceSvg) {
  if (!workspace.getAllBlocks(false).length) throw new Error("Adicione pelo menos um bloco antes de copiar a imagem.");

  const bounds = workspace.getBlocksBoundingBox();
  const margin = 24;
  const width = Math.max(1, bounds.right - bounds.left + margin * 2);
  const height = Math.max(1, bounds.bottom - bounds.top + margin * 2);
  const sourceCanvas = workspace.getCanvas();
  const blockCanvas = sourceCanvas.cloneNode(true) as SVGGElement;
  blockCanvas.removeAttribute("transform");
  blockCanvas.querySelectorAll(".blocklyInsertionMarker,.blocklyDragging").forEach((element) => element.remove());
  inlineSvgStyles(sourceCanvas, blockCanvas);

  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("xmlns", SVG_NAMESPACE);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `${bounds.left - margin} ${bounds.top - margin} ${width} ${height}`);
  const defs = workspace.getParentSvg().querySelector("defs")?.cloneNode(true);
  if (defs) svg.appendChild(defs);
  svg.appendChild(blockCanvas);

  const image = await loadSvgImage(new XMLSerializer().serializeToString(svg));
  const scale = Math.min(2, 4096 / width, 4096 / height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este navegador não conseguiu criar a imagem dos blocos.");
  context.scale(scale, scale);
  context.fillStyle = "#fbfcfd";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvasToPng(canvas);
}

export async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("O navegador não permitiu copiar o código.");
}

async function copyImageElement(blob: Blob) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const container = document.createElement("div");
  const image = document.createElement("img");
  container.contentEditable = "true";
  container.style.position = "fixed";
  container.style.left = "-10000px";
  image.src = dataUrl;
  container.appendChild(image);
  document.body.appendChild(container);
  await image.decode().catch(() => undefined);
  const range = document.createRange();
  range.selectNode(image);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  const copied = document.execCommand("copy");
  selection?.removeAllRanges();
  container.remove();
  return copied;
}

export async function copyWorkspaceImage(workspace: Blockly.WorkspaceSvg): Promise<ImageCopyResult> {
  const blobPromise = renderWorkspacePng(workspace);
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
      return "clipboard";
    } catch {
      // Alguns navegadores móveis expõem a API, mas bloqueiam imagens nela.
    }
  }

  const blob = await blobPromise;
  if (document.queryCommandSupported?.("copy") && await copyImageElement(blob)) return "clipboard";

  const file = new File([blob], "blocos-ev3.png", { type: "image/png" });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share({ files: [file], title: "Blocos EV3" });
    return "shared";
  }

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
