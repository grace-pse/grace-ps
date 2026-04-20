# Contributing to CSMP Risk Manager

Thanks for your interest in contributing. This document explains how to propose changes and what we expect from contributors.

## Quick checklist

1. Open an issue first for non-trivial changes — alignment before implementation saves everyone time.
2. Fork the repo, create a feature branch off `main`.
3. Keep PRs focused; one concern per PR.
4. Run `pnpm lint`, `pnpm test`, and `pnpm -C server build` / `pnpm -C client build` before pushing.
5. Sign off each commit (see DCO below).
6. Open a PR with a clear description — what the change does, why, and any migration/deployment notes.

## Developer Certificate of Origin (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/), not a CLA. Every commit must carry a `Signed-off-by` line that matches the author:

```
Signed-off-by: Jane Doe <jane@example.com>
```

The easy way: `git commit -s`. This tells us you have the right to submit the patch under the project licence (AGPL-3.0) — you wrote it, or you got it from somewhere that permits re-licensing, and so on. Read the DCO text for the full terms; it is two paragraphs long.

Unsigned commits will be rejected by CI.

## Development setup

See [README.md](./README.md) and [CLAUDE.md](./CLAUDE.md). Briefly:

```bash
pnpm install
cp server/.env.example server/.env
pnpm db:generate && pnpm db:migrate
pnpm dev
```

## Conventions

- **Zod at every HTTP boundary.** No route bypasses the schema.
- **Prisma models are `snake_case`** in Postgres, `camelCase` in TS. Migrations are source of truth — don't hand-edit the schema without running `prisma migrate`.
- **Tailwind tokens only** on the client — `n-*` (neutral), `a-*` (accent), `r-*` (risk heat). No raw hex.
- **Module folders, not monolith files** on the server (`modules/<domain>/{routes,schema}.ts`).
- **Fastify idioms** — `reply.code(n).send(...)`, not Express patterns.
- **Tests**: Vitest. Every new route should have at least a happy-path test.
- **Commits**: Conventional-commit style prefixes are encouraged (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).

## What counts as out-of-scope?

This is a physical security risk assessment platform. PRs that drift into unrelated domains (generic project management, IT asset inventory, ticketing, etc.) will be redirected. If unsure, open an issue before coding.

## Licensing of contributions

By submitting a contribution you agree it is licensed under the project's AGPL-3.0 licence and, if a commercial licence is granted to a downstream user under the dual-licence arrangement, under that licence too. The DCO sign-off is your acknowledgement of this.

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md). Report concerns privately to **mac.damian@gmail.com**.

## Security issues

Do **not** open public issues for security problems — use the responsible-disclosure channel in [SECURITY.md](./SECURITY.md).
