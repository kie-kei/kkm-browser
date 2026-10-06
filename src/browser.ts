import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

// Одна команда agent-browser, stdout → распарсенный JSON-конверт
export async function ab(...args: string[]): Promise<any> {
  const { stdout } = await run("agent-browser", ["--json", ...args], {
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, AGENT_BROWSER_JSON: "1" },
  });
  let env: any;
  try {
    env = JSON.parse(stdout);
  } catch {
    throw new Error(`agent-browser ${args[0]}: non-JSON output: ${stdout.slice(0, 300)}`);
  }
  if (!env.success) throw new Error(env.error?.message ?? `agent-browser ${args[0]} failed`);
  return env.data;
}

export const open = (url: string) => ab("open", url);
export const close = () => ab("close").catch(() => {});
export const connect = (port = process.env.AB_CDP_PORT ?? "9222") =>
  ab("connect", port);

// eval JS-выражения в странице
export async function evalJs(expr: string): Promise<any> {
  const data = await ab("eval", `JSON.stringify((${expr}))`);
  const raw = typeof data === "string" ? data : data?.result ?? data;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return raw; // eval вернул не-JSON — отдаём как есть
  }
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
