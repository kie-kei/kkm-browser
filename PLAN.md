# agent-cli — план

Механика opencli-адаптеров поверх agent-browser. Без registry, без сборки,
без npm-пакета — папка скриптов + один диспетчер.

## Архитектура (одна страница)

```
agent-cli/
  bin/cli                  # диспетчер: cli <site> <command> [args]
  lib/trace.sh             # обёртка запуска с retain-on-failure
  lib/browser.sh           # хелперы: connect/open/close, json-вывод
  adapters/<site>/<cmd>.sh # адаптеры — обычные bash-скрипты
  traces/<ts>/             # дампы при падении (screenshot, a11y, stderr)
```

## Контракт адаптера

Файл `adapters/<site>/<command>.sh`, исполняемый. На stdin — JSON с аргументами
(или просто `$@`, решим по первому адаптеру — не надо усложнять заранее).
На stdout — JSON-результат. Exit code != 0 = падение → трейс.

`lib/browser.sh` экспортирует:
- `ab_open <url>` / `ab_connect` (к живому Chrome по CDP, аналог COOKIE)
- `ab_json <js>` — eval + парсинг результата
- `ab_close`

## Стратегии → реализация

| opencli | agent-cli |
|---------|-----------|
| PUBLIC  | `curl`/`read` — без браузера вообще |
| COOKIE  | `agent-browser connect <port>` к Chrome с профилем |
| INTERCEPT | `eval` — инжект перехватчика fetch → дергаем API внутри страницы, сайт сам подписывает |
| UI      | snapshot/click/fill — сырые примитивы уже есть |

## --trace

`lib/trace.sh`: `run || { screenshot, snapshot, eval meta, stderr }` —
~30 строк, уже обсуждали.

## План по шагам

1. [ ] Установить agent-browser: `npm i -g agent-browser && agent-browser install`
2. [ ] `bin/cli` — диспетчер (resolve adapters/$1/$2.sh, exec с аргументами)
3. [ ] `lib/browser.sh` — хелперы поверх agent-browser
4. [ ] `lib/trace.sh` — retain-on-failure обёртка
5. [ ] Первый адаптер-пробник: hn/frontpage (PUBLIC через eval, без логина)
6. [ ] Второй адаптер: что-нибудь за логином через `connect` — проверить COOKIE-путь
7. [ ] По необходимости: fetch-инжект для INTERCEPT

## Сознательно пропускаем

- Реестр/`list -f json` — `ls adapters/` покрывает
- Плагины, validate/verify, publish
- Стратегии как поле — видно по коду адаптера
