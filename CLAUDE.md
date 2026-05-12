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

### When SSH/HTTPS to OVH stops responding (fail2ban escalation)

Symptoms: `ping` works, but TCP/22 *and* TCP/443 from your egress IP either time out or get reset on banner exchange. This usually means rapid SSH retries during a session triggered fail2ban on the VPS and your egress IP is jailed; the ban bantime can escalate to many hours on repeats.

Recovery: reboot the VPS via the OVH management API (containers come back via Docker `restart: unless-stopped`):

```bash
# One-time CK setup — opens an OVH validation URL, click accept:
python scripts/ovh-vps-reboot.py request-ck

# Sanity check (optional):
python scripts/ovh-vps-reboot.py whoami

# The actual unblock — ~30s API task + ~1 min boot:
python scripts/ovh-vps-reboot.py reboot
```

Helper at [scripts/ovh-vps-reboot.py](scripts/ovh-vps-reboot.py) reuses the OVH app key/secret from the sibling `ovh_dns.py`. CK is saved to `~/.ovh-csmp-ck-vps` with scope `GET /vps/*` + `POST /vps/*` only. Reboot flushes in-memory iptables / fail2ban state.

**To avoid getting jailed in the first place:**
- Batch SSH calls (one big `ssh ... 'cmd1 && cmd2 && cmd3'` instead of three separate connections).
- Don't retry an SSH that fails with `Connection reset` — that's the ban tightening; back off ≥10 min before the next attempt.
- For diagnostics, prefer `curl https://react.csmp.marekmalczewski.pl/...` (web tier) over `ssh ... docker logs` when you can.

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

## Working style

Adapted from [Karpathy guidelines](https://github.com/multica-ai/andrej-karpathy-skills) ([source tweet](https://x.com/karpathy/status/2015883857489522876)). Bias toward caution over speed; use judgment for trivial tasks.

- **Surface assumptions before coding.** If multiple interpretations exist, name them and ask — don't pick silently. If something simpler would work, say so before writing.
- **Minimum code that solves the problem.** No speculative flexibility, no abstractions for single-use code, no error handling for impossible scenarios. If 200 lines could be 50, rewrite.
- **Surgical edits only.** Every changed line should trace to the request. Don't "improve" adjacent code, don't refactor what isn't broken, match existing style. Remove orphans your change creates — leave pre-existing dead code alone (just mention it).
- **Define success before declaring done.** Translate "fix the bug" → "test that reproduces it, then make it pass"; "add validation" → "tests for invalid inputs, then green". For multi-step work, state the plan with a verify check per step.

## What NOT to do

- Don't add Express libs. This is Fastify.
- Don't bypass Zod — all routes must validate.
- Don't hardcode hex colors — use Tailwind tokens.
- Don't modify the sibling reference folders (`csmp-run/`, `csmp-app/`, design handoff).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
