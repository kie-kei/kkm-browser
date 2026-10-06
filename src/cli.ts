#!/usr/bin/env node
// kkm-browser — диспетчер: kkm-browser <site> <command> [args...]
// Адаптеры в ~/.kkm-browser/adapters/<site>/<command>.ts.
// Контракт: default async fn(ctx) → данные; хелперы приходят в ctx —
//   ctx.ab(cmd,...), ctx.open(url), ctx.evalJs(expr), ctx.connect(), ctx.sleep(ms), ctx.close()
// Импорты из пакета не нужны — адаптер не в node_modules.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";

export const KKM_HOME = join(homedir(), ".kkm-browser");
const ADAPTERS = join(KKM_HOME, "adapters");

async function list(): Promise<string[]> {
  const out: string[] = [];
  try {
    for (const site of await readdir(ADAPTERS, { withFileTypes: true })) {
      if (!site.isDirectory()) continue;
      for (const f of await readdir(join(ADAPTERS, site.name))) {
        if (f.endsWith(".ts")) out.push(`${site.name}/${f.slice(0, -3)}`);
      }
    }
  } catch { /* ~/.kkm-browser/adapters/ ещё нет */ }
  return out.sort();
}

const argv = process.argv.slice(2);
const traceFlag = argv.includes("--trace");
const [site, cmd, ...args] = argv.filter(a => a !== "--trace");

if (!site || site === "list" || site === "--help" || site === "-h") {
  console.log((await list()).join("\n") || `no adapters — put them in ${ADAPTERS}/<site>/<cmd>.ts`);
  process.exit(0);
}

const file = join(ADAPTERS, site, `${cmd}.ts`);
let mod: any;
try {
  mod = await import(pathToFileURL(file).href);
} catch (e) {
  console.error(`no adapter ${site}/${cmd} at ${file}`);
  console.error((e as Error).message);
  process.exit(2);
}

try {
  const browser = await import("./browser.ts");
  const ctx = { args, site, cmd, ...browser };
  const result = await mod.default(ctx);
  if (mod.validate && !mod.validate(result)) {
    throw new Error(
      `validate failed: ${site}/${cmd} returned unexpected shape — selectors likely drifted`
    );
  }
  if (result !== undefined) console.log(JSON.stringify(result, null, 2));
  if (traceFlag) {
    const { dumpTrace } = await import("./trace.ts");
    const dir = await dumpTrace(`${site}/${cmd}`, null);
    console.error(`trace: ${dir}`);
  }
} catch (err) {
  const { dumpTrace } = await import("./trace.ts");
  const dir = await dumpTrace(`${site}/${cmd}`, err);
  console.error(`FAILED: ${site}/${cmd} — trace: ${dir}`);
  console.error(String((err as Error).message ?? err));
  process.exit(1);
}
