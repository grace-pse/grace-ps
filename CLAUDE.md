# CLAUDE.md — csmp_v2

Standalone project. GitHub: https://github.com/mtspl/csmp_v2 (private, owner `mtspl`).

## Stack

- **Backend**: Fastify (TS) + Prisma + PostgreSQL. Zod at HTTP boundary, OpenAPI via `fastify-type-provider-zod`, Swagger UI at `/api/docs`. Pino logging.
- **Frontend**: Vite + React 19 + TanStack Router + Zustand + ky + Tailwind v3 + Hi-Fi design tokens (warm-slate `n-*`, indigo `a-*`, risk heat `r-*`).
- **Shared**: `@csmp/shared` workspace package — cross-wire TS types.
- **Workspace**: pnpm workspace at repo root.

## Layout

```
csmp_v2/
├── client/   # Vite + React app (:5173 dev, :80 in nginx container)
├── server/   # Fastify API (:3001)
├── shared/   # TS types
└── docker/   # docker-compose for self-host
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

## Reference codebases (outside this repo)

Frozen reference material lives in a sibling workspace at `C:\Users\marek\Documents\Claude\Projects\Physical Security Risk Assesment app - CSMP Compliant\`:

| Folder         | Purpose                                           | Rule               |
| -------------- | ------------------------------------------------- | ------------------ |
| `csmp-run/`    | Frozen production build (FastAPI + React 19) — live at https://csmp.marekmalczewski.pl/ | Read-only reference |
| `csmp-app/`    | Legacy Express+Prisma scaffold (superseded)       | Read-only reference |
| `CSMP Physical Security Risk Manager/` | Hi-Fi design handoff (HTML/JSX) | Read-only reference |
| `scripts/`     | Shared infra helpers (`ovh_dns.py`)               | Used for deploys   |

When porting features, read from those folders — **never modify them**.

## Deployment — OVH VPS

VPS: `vps-c1113ded.vps.ovh.net` (146.59.33.182), Ubuntu 24.04. SSH: `ssh -i ~/.ssh/id_ed25519_ovh ubuntu@146.59.33.182` — `sudo` password-less, no agent forwarding.

| URL                                      | Source on VPS    | Containers                   | Postgres DB |
| ---------------------------------------- | ---------------- | ---------------------------- | ----------- |
| `https://csmp.marekmalczewski.pl/`       | `/opt/csmp/`     | `csmp-*` (csmp-run)          | `csmp` (in `csmp-postgres-1`) |
| `https://react.csmp.marekmalczewski.pl/` | `/opt/csmp-v2/`  | `csmp-v2-{api,web,postgres}` | `csmp_v2` (in `csmp-v2-postgres`) |

### Deploy this repo

From the repo root:

```bash
tar --exclude='**/node_modules' --exclude='**/dist' --exclude='**/.env' \
    -czf /tmp/csmp-v2.tgz .
scp -i ~/.ssh/id_ed25519_ovh /tmp/csmp-v2.tgz ubuntu@146.59.33.182:/tmp/
ssh -i ~/.ssh/id_ed25519_ovh ubuntu@146.59.33.182 \
  'sudo rm -rf /opt/csmp-v2.new && sudo mkdir /opt/csmp-v2.new && \
   sudo tar -xzf /tmp/csmp-v2.tgz -C /opt/csmp-v2.new && \
   sudo rsync -a --delete --exclude=".env" --exclude="node_modules" \
     /opt/csmp-v2.new/ /opt/csmp-v2/ && \
   sudo rm -rf /opt/csmp-v2.new && \
   cd /opt/csmp-v2/docker && sudo docker compose build web api && \
   sudo docker compose up -d'
```

nginx vhost at `/etc/nginx/sites-enabled/react.csmp.marekmalczewski.pl` proxies to `127.0.0.1:${WEB_HOST_PORT}` (default 8080).

### DNS + TLS

DNS is automated via `ovh_dns.py` in the sibling workspace's `scripts/` dir. Certbot:

```bash
ssh -i ~/.ssh/id_ed25519_ovh ubuntu@146.59.33.182 \
  'sudo certbot --nginx -n --agree-tos --redirect --email mac.damian@gmail.com -d <subdomain>'
```

## Conventions

- **Zod first**: every request body/response goes through Zod schemas in `server/src/modules/*/schema.ts`.
- **Module folders, not monolith files**: `modules/auth/{routes,schema}.ts`, etc.
- **RBAC**: `server/src/lib/rbac.ts` — `requirePermission('assets:write')` as Fastify `onRequest` hook.
- **Prisma snake_case**: all models use `@@map("snake_case")`. Migrations are source of truth.
- **Hi-Fi components**: `client/src/components/hifi/` primitives only. Anything page-specific goes in `pages/` or a module folder.
- **Tailwind tokens only**: no hardcoded hex. Use `n-500`, `a-600`, `r-high`, etc.
- **No Express patterns in Fastify**: `reply.code(401).send(...)` not `res.status(401).json(...)`. No `next()`.

## Roadmap

- **Phase 1** — Assets, Clusters, Relationships, 7-step wizard, Risk Engine, DBT, Template Library, Countermeasures, Action Plans. Currently **1.4 complete** (wizard + CASCADE_DOWN + template suggestions + autosave + Hi-Fi scaffold nav).
- **Phase 2** — Gap-close vs csmp-run: Incidents + IncidentLink, AuditLog, Comments, Questionnaires, AssessmentSnapshot, AssessmentTemplate. Admin console. Review workflow.
- **Phase 3** — Enterprise polish: Postgres RLS, SSO/SAML, webhooks, PDF export, csmp-run data migration tool.

At Phase 2 completion, flip `csmp.marekmalczewski.pl` from csmp-run → csmp_v2. csmp-run stays in git forever as reference.

## What NOT to do

- Don't add Express libs. This is Fastify.
- Don't bypass Zod — all routes must validate.
- Don't hardcode hex colors — use Tailwind tokens.
- Don't modify the sibling reference folders (`csmp-run/`, `csmp-app/`, design handoff).
