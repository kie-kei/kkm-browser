#!/usr/bin/env node
// agent-cli — диспетчер: cli <site> <command> [args...]
// Адаптер = src/adapters/<site>/<command>.ts, экспортирует default async fn(ctx).
// ctx = { args, browser } — импортируют * из ../browser.ts.
import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ADAPTERS = join(ROOT, "src", "adapters");

async function list(): Promise<string[]> {
  const out: string[] = [];
  try {
    for (const site of await readdir(ADAPTERS, { withFileTypes: true })) {
      if (!site.isDirectory()) continue;
      for (const f of await readdir(join(ADAPTERS, site.name))) {
        if (f.endsWith(".ts")) out.push(`${site.name}/${f.slice(0, -3)}`);
      }
    }
  } catch { /* adapters/ ещё нет */ }
  return out.sort();
}

const [site, cmd, ...args] = process.argv.slice(2);

if (!site || site === "list" || site === "--help") {
  console.log((await list()).join("\n") || "no adapters");
  process.exit(0);
}

const file = join(ADAPTERS, site, `${cmd}.ts`);
let mod: any;
try {
  mod = await import(pathToFileURL(file).href);
} catch (e) {
  console.error(`no adapter ${site}/${cmd} (${(e as Error).message})`);
  process.exit(2);
}

try {
  const result = await mod.default({ args, site, cmd });
  if (result !== undefined) console.log(JSON.stringify(result, null, 2));
} catch (err) {
  const { dumpTrace } = await import("./trace.ts");
  const dir = await dumpTrace(`${site}/${cmd}`, err);
  console.error(`FAILED: ${site}/${cmd} — trace: ${dir}`);
  console.error(String((err as Error).message ?? err));
  process.exit(1);
}
