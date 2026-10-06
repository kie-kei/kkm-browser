---
name: agent-cli
description: Site-as-CLI adapters over agent-browser — uniform `cli <site> <command>` surface, trace-on-failure debugging, adding new site adapters. Load when running `cli ...` commands, fixing a broken adapter, or writing a new adapter for a site.
---

# agent-cli

`~/agent-cli` — сайты как CLI-команды поверх `agent-browser`. Адаптер = TS-модуль `src/adapters/<site>/<command>.ts` (default export async fn), диспетчер `src/cli.ts` (npm-link → `cli`), трейс при падении автоматически. Node ≥24 (type stripping, сборки нет).

## Usage

```bash
cli list                    # все адаптеры
cli <site> <command> [args] # вызов
```

Стратегии (как у opencli, но без тегов — видно по коду):
- **public** — `open()` + `evalJs()`, без логина
- **cookie** — `connect()` к Chrome с `--remote-debugging-port=9222` (профиль `~/agent-cli/chrome-profile`), либо managed-профиль agent-browser если CDP нет
- **ui** — `ab("snapshot")` / `ab("click", sel)` / `ab("fill", sel, text)` — сырые примитивы
- **intercept** — `evalJs()` с fetch внутри страницы — сайт сам подписывает запрос

## Autofix — адаптер упал

`cli` оборачивает запуск в `lib/trace.sh`: при exit≠0 в `traces/<ts>-<site>_<cmd>/` лежат `page.png`, `a11y.txt`, `meta.json`, `stderr.log`, `stdout.json`.

Протокол ремонта (≤3 раунда):
1. `cat traces/<latest>/error.txt` — что сломалось
2. `cat traces/<latest>/a11y.txt` + `page.png` — что сейчас на странице
3. `cat traces/<latest>/meta.json` — на каком URL (редирект на логин = проблема авторизации, не адаптера)
4. Правим `src/adapters/<site>/<cmd>.ts` (селекторы, JS в evalJs)
5. `cli <site> <cmd>` — retry

**Стоп-условия** (не чинить код):
- в `meta.json` виден редирект на логин / QR → скажи пользователю залогиниться
- CAPTCHA → не адаптер
- `ab_connect` не может найти Chrome → подсказать запуск Chrome с CDP

## Author — новый адаптер

1. `agent-browser open <url>` + `snapshot`/`eval` — recon: найти селекторы данных
2. Скелет: `src/adapters/<site>/<cmd>.ts`:
   ```ts
   import { open, connect, evalJs, sleep } from "../../browser.ts";
   export default async function ({ args }) { ...; return data; }
   ```
   Возвращаемое значение уходит в stdout как pretty JSON.
3. Если нужен логин — проверка как в `vk/feed.ts` (счётчик элементов, не редирект-URL — сайты редиректят по-разному)
4. Вызов через `cli` — трейс уже включён

Селекторы кладём максимально широко (`[class*=post], [data-post-id], .feed_row` в одном query) — сайты чаще меняют классы, чем данные.

## Хелперы (src/browser.ts)

```ts
import { ab, open, close, connect, evalJs, sleep } from "../../browser.ts";

ab("snapshot")          // любая команда agent-browser, --json обёртка уже внутри
open(url)
connect()               // AB_CDP_PORT или 9222; catch → managed-профиль
evalJs("[...document.querySelectorAll(...)]...") // eval + JSON-разбор
close()                 // managed-браузер; в connect-режиме не звать
```

## Не делать

- Не хардкодить список адаптеров — `cli list` источник истины
- Не писать реестр/плагины — `src/adapters/` и есть реестр
- Не звать `close()` в connect-режиме — это чужой Chrome
- Не добавлять сборку — Node 24 ест .ts напрямую
