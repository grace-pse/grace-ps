# CLAUDE.md — csmp-v2 (active codebase)

## Codebase orientation

This project contains **three** sibling folders at the workspace root. Know which is which:

| Folder         | Status                   | Stack                                             | Treat as...           |
| -------------- | ------------------------ | ------------------------------------------------- | --------------------- |
| **`csmp-v2/`** | **ACTIVE — build here**  | Fastify + Prisma + PG / Vite + React 19 + Hi-Fi   | Edit freely           |
| `csmp-run/`    | Frozen reference         | FastAPI + SQLAlchemy / React 19 + Hi-Fi tokens    | Read-only — DO NOT edit |
| `csmp-app/`    | Legacy/archived scaffold | Express + Prisma / React 18 (basic UI)            | Read-only — DO NOT edit |

If the user asks for a change, assume they mean **csmp-v2** unless they explicitly name one of the others.

## Stack

- **Backend**: Fastify (TS) + Prisma + PostgreSQL. Zod at HTTP boundary, OpenAPI via `fastify-type-provider-zod`, Swagger UI at `/api/docs`. Pino logging.
- **Frontend**: Vite + React 19 + TanStack Router + Zustand + ky + Tailwind v3 + Hi-Fi design tokens (warm-slate `n-*`, indigo `a-*`, risk heat `r-*`).
- **Shared**: `@csmp/shared` workspace package — cross-wire TS types.
- **Workspace**: pnpm workspace at repo root.

## Layout

```
csmp-v2/
├── client/       # Vite + React app (served at :5173 dev, :80 in nginx container)
├── server/       # Fastify API (:3001)
├── shared/       # TS types
├── docker/       # docker-compose for self-host
└── scripts/      # seed + ops helpers
```

## Quickstart

```bash
pnpm install
cp server/.env.example server/.env        # edit JWT_SECRET, DATABASE_URL
pnpm db:generate
pnpm db:migrate                           # creates schema
pnpm dev                                  # api on :3001, web on :5173
```

Self-host:
```bash
cd docker && cp .env.example .env && docker compose up -d
```

## Phase 0 scope (current)

Auth + Org + User only. Swagger lists `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /healthz`. Dashboard is a placeholder. Sidebar disables all feature routes with "soon" markers — they enable per-feature across Phase 1 and 2.

## Deployment (OVH VPS)

VPS: `vps-c1113ded.vps.ovh.net` (146.59.33.182). SSH: `ssh -i ~/.ssh/id_ed25519_ovh ubuntu@146.59.33.182`.

| URL                                     | Deployment       | Container prefix        |
| --------------------------------------- | ---------------- | ----------------------- |
| `csmp.marekmalczewski.pl`               | csmp-run (frozen) | `csmp-*` (existing)     |
| `react.csmp.marekmalczewski.pl`         | **csmp-v2**      | `csmp-v2-*`             |

Target dir on VPS: `/opt/csmp-v2/`. Phase 0.6 replaces the old `/opt/csmp-app/` deploy — rename that to `/opt/csmp-app.bak/` rather than deleting.

**DB sharing**: csmp-v2 uses a separate Postgres container `csmp-v2-postgres` (volume `csmp-v2-postgres-data`). Does NOT share csmp-run's DB. Phase 3 adds a migration tool.

**DNS automation**: use `../scripts/ovh_dns.py` (in repo root). Consumer key persisted at `~/.ovh-csmp-ck`. See memory/reference_ovh_api.md.

## Conventions

- **Zod first**: every request body/response goes through Zod schemas in `server/src/modules/*/schema.ts`. Types flow into shared via explicit re-export.
- **Module folders, not monolith files**: `modules/auth/{routes,schema}.ts`, `modules/users/`, etc.
- **RBAC**: `server/src/lib/rbac.ts` — `requirePermission('assets:write')` as Fastify `onRequest` hook.
- **Prisma snake_case**: all models use `@@map("snake_case")`. Migrations are source of truth.
- **Hi-Fi components**: `client/src/components/hifi/` primitives only. Anything page-specific goes in `pages/` or a module folder.
- **Tailwind tokens only**: no hardcoded hex in components. Use `n-500`, `a-600`, `r-high`, etc.
- **No Express patterns in Fastify**: `reply.code(401).send(...)` not `res.status(401).json(...)`. No `next()`.

## Roadmap

- **Phase 1** — port Assets, Clusters, Relationships, Assessments (7-step wizard), Threats, Risk Engine, DBT, Template Library, Countermeasures, Action Plans. Target: feature-parity with current csmp-app (in the new stack).
- **Phase 2** — gap close vs csmp-run: Incidents + IncidentLink, AuditLog, Comments, Questionnaires, AssessmentSnapshot, AssessmentTemplate. Admin console. Review workflow.
- **Phase 3** — enterprise polish: Postgres RLS, SSO/SAML, webhooks, PDF export, csmp-run data migration tool.

At Phase 2 completion, flip `csmp.marekmalczewski.pl` from csmp-run → csmp-v2. csmp-run stays in git forever as reference.

## What NOT to do

- Do not modify `csmp-run/` or `csmp-app/`. They are reference only.
- Do not add domain features to Phase 0. Auth + health only.
- Do not add Express libs. This is Fastify.
- Do not bypass Zod — all routes must validate.
- Do not hardcode hex colors — use Tailwind tokens.
