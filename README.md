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
# в отдельном терминале: фоновые задачи (отправка писем)
uv run taskiq worker zxcrunet.worker:broker
# владелец продукта (роль owner): создать или повысить существующего пользователя
uv run python -m zxcrunet.cli create-owner you@example.com

# 3. Фронтенд: http://localhost:3000
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

Mailpit (письма из локальной среды): http://localhost:8025.

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
