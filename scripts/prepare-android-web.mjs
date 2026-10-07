import { cp, mkdir, rm, copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve("dist");
const target = resolve("dist-mobile");

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
// APK downloads from public/ must never be embedded back inside the APK.
await rm(resolve(target, "app-admin.apk"), { force: true });
await rm(resolve(target, "eu-vou-programar.apk"), { force: true });
await copyFile(resolve(source, "eu-vou-programar", "index.html"), resolve(target, "index.html"));
