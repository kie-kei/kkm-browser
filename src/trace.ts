import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const TRACES = join(homedir(), ".kkm-browser", "traces");

// Дамп состояния браузера в ~/.kkm-browser/traces/<ts>-<name>/
// err === null → успешный прогон (ручной --trace), иначе retain-on-failure.
export async function dumpTrace(name: string, err: unknown): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(TRACES, `${ts}-${name.replace("/", "_")}`);
  await mkdir(dir, { recursive: true });
  if (err != null) {
    await writeFile(join(dir, "error.txt"), String((err as Error)?.stack ?? err));
  }

  const safe = async (file: string, fn: () => Promise<any>) => {
    try {
      const v = await fn();
      await writeFile(join(dir, file), typeof v === "string" ? v : JSON.stringify(v, null, 2));
    } catch (e) {
      // браузер мог умереть — не фейлим сам дамп
      await writeFile(join(dir, file + ".err"), String(e)).catch(() => undefined);
    }
  };

  const { ab } = await import("./browser.ts");
  await safe("a11y.txt", () => ab("snapshot"));
  await safe("meta.json", () =>
    ab("eval", "JSON.stringify({url:location.href,title:document.title})"));
  try {
    const { execFileSync } = await import("node:child_process");
    execFileSync("agent-browser", ["screenshot", join(dir, "page.png")], { stdio: "ignore" });
  } catch {
    // скриншот best-effort
  }
  return dir;
}
