import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const host = "127.0.0.1";
const port = 3000;
const url = `http://${host}:${port}/eu-vou-programar/?audit=1`;
const noOpen = process.argv.includes("--no-open");

async function serverIsReady() {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

if (!await serverIsReady()) {
  const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", host, "--port", String(port)], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  vite.unref();

  for (let attempt = 0; attempt < 40 && !await serverIsReady(); attempt += 1) await wait(250);
  if (!await serverIsReady()) throw new Error(`O servidor não iniciou em ${url}`);
}

if (!noOpen) {
  const command = process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const browser = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  browser.unref();
}

console.log(`Auditoria automática disponível em ${url}`);
