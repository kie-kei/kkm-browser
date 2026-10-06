import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// retain-on-failure: при ошибке адаптера дампим состояние браузера в traces/<ts>/
export async function dumpTrace(name: string, err: unknown): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(ROOT, "traces", `${ts}-${name.replace("/", "_")}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "error.txt"), String((err as Error)?.stack ?? err));

  const safe = async (file: string, fn: () => Promise<any>) => {
    try {
      const v = await fn();
      await writeFile(join(dir, file), typeof v === "string" ? v : JSON.stringify(v, null, 2));
    } catch (e) {
      // браузер мог умереть вместе с адаптером — не фейлим сам дамп
      await writeFile(join(dir, file + ".err"), String(e)).catch(() => undefined);
    }
  };

  const { ab } = await import("./browser.ts");
  await safe("a11y.txt", () => ab("snapshot"));
  await safe("meta.json", () =>
    ab("eval", "JSON.stringify({url:location.href,title:document.title})"));
  // скриншот — бинарный, сохраняем через прямой вызов
  try {
    const { execFileSync } = await import("node:child_process");
    execFileSync("agent-browser", ["screenshot", join(dir, "page.png")], { stdio: "ignore" });
  } catch {
    // то же: скриншот best-effort, при мёртвом браузере просто нет файла
  }
  return dir;
}

