# CSMP Risk Manager — v2 (active)

> **This is `csmp-v2/` — the active, target-architecture codebase.**
>
> | Folder         | Status                                   | Stack                                               |
> | -------------- | ---------------------------------------- | --------------------------------------------------- |
> | **`csmp-v2/`** | **Active — build here**                  | **Fastify + Prisma + Postgres / Vite + React 19**   |
> | `csmp-run/`    | Frozen reference (do not modify)         | FastAPI + SQLAlchemy / React 19 + Hi-Fi tokens      |
> | `csmp-app/`    | Legacy/archived (do not modify)          | Express + Prisma / React 18 (basic UI)              |
>
> GitHub repo name: **`csmp-v2`** (matches this folder).

Self-hostable physical security risk assessment platform built on the CSMP (Critical Site Management Programme) methodology. Open-source, API-first, scalable from single-team self-host to enterprise SaaS.

## Quick start (self-host)

```bash
git clone <repo-url>
cd csmp-v2
cp docker/.env.example docker/.env   # edit secrets
docker compose -f docker/docker-compose.yml up -d
```

Open http://localhost:8080 and register. First user becomes the organization admin.

## Stack

- **Backend**: Fastify + Prisma + PostgreSQL (TypeScript)
- **Frontend**: Vite + React 19 + TanStack Router + Zustand + ky + Tailwind
- **Design system**: Hi-Fi tokens (warm-slate neutrals, indigo accent, CSMP risk heat)

## Layout

```
csmp-v2/
├── client/    # Vite + React app
├── server/    # Fastify + Prisma API
├── shared/    # TypeScript types shared across the wire
├── docker/    # docker-compose for self-host
└── scripts/   # seed + maintenance helpers
```

## Development

```bash
pnpm install
pnpm db:migrate        # create schema
pnpm db:seed           # load Banking & Finance template pack (Phase 1+)
pnpm dev               # start api on :3001 and web on :5173
```

API docs: `http://localhost:3001/api/docs` (Swagger UI).

## Status

**Phase 0 — scaffold.** Auth + org + user only. Domain features land in Phase 1+.

See `CLAUDE.md` for architecture notes and the roadmap.
