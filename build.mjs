#!/usr/bin/env node
/**
 * Build script: reads macros.json + .js source files, generates a LevelDB
 * compendium pack in packs/macros/ ready for distribution.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { resolve } from "path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const macros = JSON.parse(readFileSync("macros/macros.json", "utf8"));
const srcDir = resolve("src/packs/macros");
const outDir = resolve("packs/macros");

// Write intermediate JSON source files that the CLI expects.
mkdirSync(srcDir, { recursive: true });
for (const macro of macros) {
  const source = readFileSync(macro.file, "utf8");
  const command = `// v${version}\n${source}`;
  const safeName = macro.name.replace(/[^a-zA-Z0-9]/g, "_");
  const doc = {
    _key: `!macros!${macro.id}`,
    _id: macro.id,
    name: macro.name,
    type: "script",
    scope: "global",
    command,
    img: macro.icon ?? "modules/foundry-homebrew/assets/images/minotaur256.png",
    ownership: { default: 3 },
    flags: {},
  };
  writeFileSync(`${srcDir}/${safeName}_${macro.id}.json`, JSON.stringify(doc, null, 2));
}

// Compile intermediate JSON → LevelDB pack.
mkdirSync(outDir, { recursive: true });
await compilePack(srcDir, outDir, { log: true });

// Remove intermediate files — the .js files are the source of truth.
rmSync(resolve("src"), { recursive: true, force: true });

console.log("Pack built in packs/macros/");
