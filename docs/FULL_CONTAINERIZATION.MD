# Full Containerization Runbook

This runbook starts the complete containerized stack (`postgres`, `api`, `worker`, `web`).

## 1) Build images

```bash
docker compose -f docker-compose.full.yml build
```

## 2) Start stack

```bash
docker compose -f docker-compose.full.yml up -d
```

Services:

- Web: `http://localhost:5173`
- API health: `http://localhost:8000/health`
- Postgres host port: `${AIIC_POSTGRES_PORT:-55432}`

## 3) Run migrations (once per schema change)

```bash
docker compose -f docker-compose.full.yml run --rm api \
  uv run alembic -c apps/api/alembic.ini upgrade head
```

## 4) Stop stack

```bash
docker compose -f docker-compose.full.yml down
```

## Notes

- API and worker share artifact volume `artifacts_data`.
- Environment defaults are sourced from `.env`/`.env.example`.
- For production hardening, set:
  - `AIIC_ENV=production`
  - `AIIC_APP_SECRET_KEY=<strong secret>`
