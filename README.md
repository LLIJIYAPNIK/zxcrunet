# zxcrunet

Платформа сайтов-визиток: бизнес и личные визитки из готовых блоков, на поддомене `имя.zxc.ru.net` или на своём домене.

Правила проекта, стек и этапы описаны в [CLAUDE.md](CLAUDE.md). Макеты лежат в [design/](design/).

## Что нужно установить

- Python 3.13 и [uv](https://docs.astral.sh/uv/)
- Node.js 22 и pnpm 10 (`npm i -g pnpm@10`)
- Docker с Compose

## Запуск для разработки

```bash
# 1. Postgres, Redis и Mailpit
docker compose -f infra/docker-compose.dev.yml up -d

# 2. Бэкенд: http://localhost:8000/api/docs
cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run uvicorn --factory zxcrunet.main:create_app --reload
# в отдельных терминалах: фоновые задачи (письма, проверка доменов) и расписание
uv run taskiq worker zxcrunet.worker:broker
uv run taskiq scheduler zxcrunet.worker:scheduler
# владелец продукта (роль owner): создать или повысить существующего пользователя
uv run python -m zxcrunet.cli create-owner you@example.com

# 3. Фронтенд: http://localhost:3000
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

Mailpit (письма из локальной среды): http://localhost:8025.

### Готовые визитки для проверки

При запущенных бэкенде и фронтенде скрипт заполнит существующую учётку двумя опубликованными визитками из примеров `/ui/sample`. Бизнес-визитка откроется на `anna.localhost:3000`, личная с полками, серией Dark Souls и постами — на `sasha.localhost:3000`. При повторном запуске визитки пересоздаются, а тайтлы и посты не дублируются.

```bash
cd frontend
pnpm seed:demo --email you@example.com --password '…'
```

### Без Docker (Windows)

Postgres можно взять системный (поменяйте порт в `ZXC_DATABASE_URL`). Redis для Windows: сборка [redis-windows](https://github.com/redis-windows/redis-windows) версии 7.x. Сборка 5.x не подходит: в ней нет `GETDEL`. Положите её в `infra/.local/` (папка в `.gitignore`) и запустите `redis-server.exe --port 6379`. Mailpit необязателен: без него письма не уходят, а владелец из `create-owner` уже с подтверждённой почтой.

### Свои домены

Пользователь подключает домен в настройках визитки и добавляет у регистратора две записи: TXT `_zxc-verify.<домен>` с токеном и A `<домен>` на IP сервера (для `www` вместо A нужна CNAME на основной домен). Воркер проверяет записи сразу, потом с backoff в течение 48 часов, подтверждённые и активные домены — раз в сутки. Расписание ведёт `taskiq scheduler`: без него проверки идут только по кнопке «Проверить сейчас».

Настройки бэкенда:

- `ZXC_DOMAINS_SERVER_IPV4` и `ZXC_DOMAINS_SERVER_IPV6` — публичные IP сервера, куда должны указывать записи;
- `ZXC_DNS_NAMESERVERS` — DNS-серверы для проверки (по умолчанию 1.1.1.1 и 8.8.8.8);
- `ZXC_TLS_PROBE_VERIFY` — проверять сертификат при HTTPS-пробе (локально `false`).

Caddy выдаёт сертификаты своим доменам по запросу (on-demand TLS) и перед выпуском спрашивает `GET /internal/tls/ask?domain=`. Этот путь отвечает только на прямые запросы из приватной сети, публичный прокси его не пропускает. Конфиги лежат в `infra/caddy`: `Caddyfile` для продакшна (wildcard `*.zxc.ru.net` через Cloudflare DNS-01, нужен образ из `infra/caddy/Dockerfile`) и `Caddyfile.dev` для локальной проверки:

```bash
docker compose -f infra/docker-compose.dev.yml --profile caddy up -d caddy
```

## Проверки

```bash
# бэкенд
cd backend
uv run ruff format --check . && uv run ruff check . && uv run mypy && uv run pytest
ZXC_RUN_INTEGRATION=1 uv run pytest   # с запущенными Postgres и Redis

# фронтенд
cd frontend
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test

pnpm e2e                               # лендинг; полный путь аккаунта — с E2E_FULL=1 и запущенным стеком

# типы API для фронтенда после изменения эндпоинтов
cd backend && uv run python -m zxcrunet.openapi > ../frontend/src/lib/api/openapi.json
cd frontend && pnpm api:types
```
