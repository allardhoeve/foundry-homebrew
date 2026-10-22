#!/usr/bin/env node
/**
 * Build script: reads macros.json + .js source files and the roll table JSON
 * in module/tables/, generates LevelDB compendium packs in packs/ ready for
 * distribution.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { resolve } from "path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const macros = JSON.parse(readFileSync("module/macros/macros.json", "utf8"));
const srcDir = resolve(".build-tmp/packs/macros");
const outDir = resolve("module/packs/macros");

// Write intermediate JSON source files that the CLI expects.
mkdirSync(srcDir, { recursive: true });
for (const macro of macros) {
  const source = readFileSync(`module/${macro.file}`, "utf8");
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

// Roll tables: one JSON file per table, results listed in order. Result n
// covers range [n, n]. Result IDs derive from the table ID so rebuilds are
// stable.
const tablesSrcDir = resolve(".build-tmp/packs/tables");
const tablesOutDir = resolve("module/packs/tables");
mkdirSync(tablesSrcDir, { recursive: true });
for (const file of readdirSync("module/tables").filter(f => f.endsWith(".json"))) {
  const table = JSON.parse(readFileSync(`module/tables/${file}`, "utf8"));
  const results = table.results.map((text, i) => {
    const _id = `${table.id.slice(0, 10)}${String(i + 1).padStart(6, "0")}`;
    return {
      _key: `!tables.results!${table.id}.${_id}`,
      _id,
      type: "text",
      name: "",
      description: text,
      weight: 1,
      range: [i + 1, i + 1],
      drawn: false,
      flags: {},
    };
  });
  const doc = {
    _key: `!tables!${table.id}`,
    _id: table.id,
    name: table.name,
    img: "icons/svg/d20-grey.svg",
    description: table.description,
    results,
    formula: table.formula,
    replacement: true,
    displayRoll: true,
    ownership: { default: 0 },
    flags: {},
  };
  writeFileSync(`${tablesSrcDir}/${file}`, JSON.stringify(doc, null, 2));
}
mkdirSync(tablesOutDir, { recursive: true });
await compilePack(tablesSrcDir, tablesOutDir, { log: true });

// Remove intermediate files — the .js and table .json files are the source of truth.
rmSync(resolve(".build-tmp"), { recursive: true, force: true });

console.log("Packs built in module/packs/macros/ and module/packs/tables/");
