# Contributing to GRACE Engine

Thanks for your interest in contributing. This document explains how to propose changes and what we expect from contributors.

## Quick checklist

1. Open an issue first for non-trivial changes — alignment before implementation saves everyone time.
2. Fork the repo, create a feature branch off `main`.
3. Keep PRs focused; one concern per PR.
4. Run `pnpm lint`, `pnpm test`, and `pnpm -C server build` / `pnpm -C client build` before pushing.
5. Sign off each commit (see DCO below).
6. Open a PR with a clear description — what, why, and any migration/deployment notes.

## Developer Certificate of Origin (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/), not a CLA. The DCO is a simple, machine-checkable statement that you have the right to submit the patch under the project's licence — you wrote it, or you got it from somewhere that permits re-licensing.

Every commit must carry a `Signed-off-by` line that matches the commit author:

```
Signed-off-by: Jane Doe <jane@example.com>
```

The easy way:

```bash
git commit -s -m "feat(assets): add bulk import"
```

The `-s` flag appends the trailer for you. Unsigned commits will be rejected by the DCO check in CI.

## Development setup

```bash
pnpm install
cp server/.env.example server/.env       # edit JWT_SECRET, DATABASE_URL
pnpm db:generate && pnpm db:migrate
pnpm dev                                  # api on :3001, web on :5173
```

### Module structure

```
grace/
├── api/        # Fastify API (:3001) — also referenced as server/ in code
├── client/     # Vite + React app (:5173)
├── prisma/     # Prisma schema and migrations (lives under server/prisma)
├── shared/     # TS types shared across the wire
└── docker/     # docker-compose for self-host
```

Server modules live in `server/src/modules/<domain>/{routes,schema,service}.ts`. The client uses TanStack Router file-based routes under `client/src/routes/`.

## Conventions

- **Zod at every HTTP boundary.** No route bypasses the schema.
- **Prisma models are `snake_case`** in Postgres, `camelCase` in TS. Migrations are source of truth — never hand-edit the schema without running `prisma migrate`.
- **Tailwind tokens only** on the client — `n-*` (neutral), `a-*` (accent), `r-*` (risk heat). No raw hex.
- **Module folders, not monolith files** on the server.
- **Fastify idioms** — `reply.code(n).send(...)`, not Express patterns. No `next()`.
- **Tests**: Vitest. Every new route should have at least a happy-path test.

## Conventional commits

We use [Conventional Commits](https://www.conventionalcommits.org/) for the commit subject:

```
feat(assets): add bulk import
fix(wizard): step 4 autosave race condition
docs: clarify DCO sign-off
chore(deps): bump prisma to 6.2.1
refactor(api): extract risk engine to shared package
```

## PR process

- We **squash-merge** to `main`. The PR title becomes the squash commit message — make it readable.
- At least one approving review is required.
- CI (lint, typecheck, prisma validate, docker build, DCO) must be green.
- We do not maintain release branches; cut tags off `main`.

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md). Report concerns privately to **contact@grace-ps.io**.

## Security issues

Do **not** open public issues for security problems — use the responsible-disclosure channel in [SECURITY.md](./SECURITY.md).

## Licensing of contributions

By submitting a contribution you agree it is licensed under AGPL-3.0 and, under the project's dual-licence arrangement, may also be granted to downstream commercial-licence customers. The DCO sign-off is your acknowledgement of this. If this conflicts with your employer's policy, please open an issue before contributing.
