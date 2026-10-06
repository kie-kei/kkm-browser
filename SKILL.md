---
name: kkm-browser
description: Site-as-CLI adapters over agent-browser — uniform `kkm-browser <site> <command>` surface, trace-on-failure debugging, adding new site adapters. Load when running `kkm-browser ...` commands, fixing a broken adapter, or writing a new adapter for a site.
---

# kkm-browser

Сайты как CLI-команды поверх `agent-browser`. Адаптер = TS-модуль `src/adapters/<site>/<command>.ts` (default export async fn), диспетчер `src/cli.ts` (npm-link → `kkm-browser`), трейс при падении автоматически. Node ≥24 (type stripping, сборки нет).

## Usage

```bash
kkm-browser list                    # все адаптеры
kkm-browser <site> <command> [args] # вызов
```

Стратегии (видно по коду адаптера):
- **public** — `open()` + `evalJs()`, без логина
- **cookie** — `connect()` к Chrome с `--remote-debugging-port=9222`, либо managed-профиль agent-browser если CDP нет
- **ui** — `ab("snapshot")` / `ab("click", sel)` / `ab("fill", sel, text)` — сырые примитивы
- **intercept** — `evalJs()` с fetch внутри страницы — сайт сам подписывает запрос

## Autofix — адаптер упал

Диспетчер ловит throw в адаптере и дампит в `traces/<ts>-<site>_<cmd>/`: `error.txt`, `a11y.txt`, `meta.json`, `page.png`.

Протокол ремонта (≤3 раунда):
1. `cat traces/<latest>/error.txt` — что сломалось
2. `cat traces/<latest>/a11y.txt` + `page.png` — что сейчас на странице
3. `cat traces/<latest>/meta.json` — на каком URL (редирект на логин = проблема авторизации, не адаптера)
4. Правим `src/adapters/<site>/<cmd>.ts` (селекторы, JS в evalJs)
5. `kkm-browser <site> <cmd>` — retry

**Стоп-условия** (не чинить код):
- в `meta.json` редирект на логин / QR → скажи пользователю залогиниться
- CAPTCHA → не адаптер
- `connect()` не находит Chrome → подсказать запуск Chrome с CDP

## Author — новый адаптер

1. `agent-browser open <url>` + `snapshot`/`eval` — recon: найти селекторы данных
2. Шаблон — `references/reddit-frontpage.ts` (public-адаптер целиком). Общая форма:
   ```ts
   import { open, connect, evalJs, sleep } from "../../browser.ts";
   export default async function ({ args }: { args: string[] }) { ...; return data; }
   ```
   Возвращаемое значение уходит в stdout как pretty JSON.
3. Если нужен логин — проверяй по наличию контентных элементов, не по URL-редиректу (сайты редиректят по-разному)
4. Вызов через `kkm-browser` — трейс уже включён

Селекторы кладём максимально широко (`[class*=post], [data-post-id]` в одном query) — сайты чаще меняют классы, чем данные.

## Хелперы (src/browser.ts)

```ts
import { ab, open, close, connect, evalJs, sleep } from "../../browser.ts";

ab("snapshot")          // любая команда agent-browser, --json обёртка внутри
open(url)
connect()               // AB_CDP_PORT или 9222; catch → managed-профиль
evalJs("...")           // eval + JSON-разбор результата
close()                 // managed-браузер; в connect-режиме не звать
```

## Не делать

- Не хардкодить список адаптеров — `kkm-browser list` источник истины
- Не писать реестр/плагины — `src/adapters/` и есть реестр
- Не звать `close()` в connect-режиме — это чужой Chrome
- Не добавлять сборку — Node 24 ест .ts напрямую
