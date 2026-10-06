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

// --- network capture (DevTools Network) ---
// Список запросов; opts: {filter?, type?, method?, status?}
export async function requests(opts: {
  filter?: string; type?: string; method?: string; status?: string; clear?: boolean;
} = {}): Promise<any[]> {
  const args = ["requests"];
  if (opts.filter) args.push("--filter", opts.filter);
  if (opts.type) args.push("--type", opts.type);
  if (opts.method) args.push("--method", opts.method);
  if (opts.status) args.push("--status", opts.status);
  if (opts.clear) args.push("--clear");
  const data = await ab("network", ...args);
  return data?.requests ?? data ?? [];
}

// Полный request/response одного запроса (headers + body)
export const request = (id: string) => ab("network", "request", id);

// HAR-запись: start → работа адаптера → stop(path)
export const harStart = (content: "text" | "all" | "none" = "text") =>
  ab("network", "har", "start", "--content", content);
export const harStop = (path: string) => ab("network", "har", "stop", path);
