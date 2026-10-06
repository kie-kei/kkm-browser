---
name: kkm-browser
description: Site-as-CLI adapters over agent-browser — uniform `kkm-browser <site> <command>` surface, trace-on-failure debugging, result validators, adding new site adapters. Load when running `kkm-browser ...` commands, fixing a broken adapter, or writing a new adapter for a site.
---

# kkm-browser

Sites exposed as CLI commands on top of `agent-browser`. An adapter is a TS module at `~/.kkm-browser/adapters/<site>/<command>.ts` (default export = async fn). The dispatcher is `src/cli.ts`, exposed globally as `kkm-browser` via `npm link` / `npm i -g`. Failures automatically dump a trace; successful runs can be traced with `--trace`. Node ≥24 (native TS stripping, no build step).

## Usage

```bash
kkm-browser list                          # all adapters
kkm-browser <site> <command> [args]       # invoke
kkm-browser <site> <command> --trace      # invoke + keep trace even on success
```

Strategies (visible in adapter code, no tags):
- **public** — `open()` + `evalJs()`, no login
- **cookie** — `connect()` to Chrome with `--remote-debugging-port=9222`, falls back to managed agent-browser profile if CDP is absent
- **ui** — `ab("snapshot")` / `ab("click", sel)` / `ab("fill", sel, text)` — raw agent-browser primitives
- **intercept** — `evalJs()` running `fetch()` inside the page — the site signs the request itself

## Adapter contract

```ts
// ~/.kkm-browser/adapters/<site>/<cmd>.ts
export default async function ({ args, open, connect, evalJs, sleep, close, ab }: any) {
  // args: positional CLI args after <cmd>
  // return value → stdout as pretty JSON
  return data;
}

// REQUIRED validator — dispatcher runs it on the result;
// false → throw + trace dump (catches silent selector drift: [] or null fields)
export const validate = (data: any): boolean => ...
```

No imports from the package — every helper arrives through `ctx`. Validator is **required**, not optional: write it so it fails loudly when the site changes shape, not just checks "did we get anything".

## Validators — be strict, not shallow

A weak validator (`data.length > 0`) passes on `[{title: null, url: null}]` — silent garbage, the exact thing we're defending against. Write validators that check the *fields you actually use*:

```ts
export const validate = (posts: any[]) =>
  Array.isArray(posts) &&
  posts.length > 0 &&
  posts.every(p => typeof p.id === "string" && p.title?.length > 0 && p.url?.startsWith("http"));
```

Good targets to check: required keys present, non-null, right types, plausible formats (URLs start with http, scores are numeric-ish). The validator is your regression detector — a site redesign that returns empty-shaped data must trip it.

## Autofix — adapter failed

Any throw (including `validate failed`) → `~/.kkm-browser/traces/<ts>-<site>_<cmd>/` with `error.txt`, `a11y.txt`, `meta.json`, `page.png`.

Repair protocol (≤3 rounds):
1. `cat traces/<latest>/error.txt` — what broke
2. `a11y.txt` + `page.png` — what's actually on the page now
3. `meta.json` — which URL (login redirect = auth problem, not adapter)
4. Fix `~/.kkm-browser/adapters/<site>/<cmd>.ts` (selectors, evalJs JS)
5. `kkm-browser <site> <cmd>` — retry

**Stop conditions** (don't patch code):
- `meta.json` shows login/QR redirect → tell the user to log in
- CAPTCHA → not an adapter bug
- `connect()` can't find Chrome → suggest launching Chrome with `--remote-debugging-port=9222 --user-data-dir=~/agent-cli/chrome-profile`

## Authoring a new adapter

1. Recon: `agent-browser open <url>` + `snapshot` / `eval` — find data selectors
2. Template: `references/adapter-template.ts` (full public adapter). Skeleton:
   ```ts
   export default async function ({ args, open, evalJs, close }: any) { ...; return data; }
   export const validate = (d: any) => /* strict field checks */;
   ```
3. For login-gated sites: detect auth by *content presence*, not URL redirects (sites redirect inconsistently)
4. Invoke via `kkm-browser` — failure trace is automatic

Selectors: cast wide (`[class*=post], [data-post-id]` in one query) — sites rename classes more often than they change data. Pair with a strict validator so drift trips loudly.

## Helpers (src/browser.ts → ctx)

```ts
ab("snapshot")          // any agent-browser command, --json envelope unwrapped
open(url)
connect()               // AB_CDP_PORT or 9222; catch → managed profile
evalJs("...")           // eval + JSON parse of result
close()                 // managed browser only; never call in connect mode
sleep(ms)

// network capture (DevTools Network tab)
requests({filter?, type?, method?, status?, clear?})  // captured requests list
request(requestId)      // full request/response with headers+body
harStart("text|all|none") / harStop(path)             // HAR recording
```

## Don't

- Don't hardcode adapter lists — `kkm-browser list` is the source of truth
- Don't build a registry/plugin system — `~/.kkm-browser/adapters/` is the registry
- Don't `close()` in connect mode — that's the user's Chrome
- Don't add a build step — Node 24 eats .ts natively
- Don't write an adapter without `validate` — silent selector drift is the #1 failure mode
