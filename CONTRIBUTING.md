# Contributing to GRACE

First — **thank you**. GRACE is a small project that exists because contributors take time to make it better. This guide covers the ground rules and the practical workflow.

## TL;DR

```bash
# 1. Fork + clone
git clone git@github.com:<your-user>/grace.git && cd grace

# 2. Install + run
pnpm install
docker compose up -d db    # Postgres only
pnpm db:migrate dev
pnpm db:seed               # Nordica demo data
pnpm dev                   # api + web concurrent

# 3. Work on your branch
git checkout -b feat/your-feature

# 4. Commit with DCO sign-off — this is required
git commit -s -m "feat: add useful thing"

# 5. Push + open PR
git push origin feat/your-feature
# → Open PR on github.com/grace-pse/grace, fill the template
```

---

## Developer Certificate of Origin (DCO) — Required

Every commit must be signed off using `git commit -s` (or `--signoff`). This adds a `Signed-off-by:` line to your commit message, which is your assertion that:

> By making a contribution to this project, I certify that:
>
> (a) The contribution was created in whole or in part by me and I have the right to submit it under the open source license indicated in the file; or
>
> (b) The contribution is based upon previous work that, to the best of my knowledge, is covered under an appropriate open source license and I have the right under that license to submit that work with modifications, whether created in whole or in part by me, under the same open source license (unless I am permitted to submit under a different license), as indicated in the file; or
>
> (c) The contribution was provided directly to me by some other person who certified (a), (b) or (c) and I have not modified it.
>
> (d) I understand and agree that this project and the contribution are public and that a record of the contribution (including all personal information I submit with it, including my sign-off) is maintained indefinitely and may be redistributed consistent with this project or the open source license(s) involved.

Full text: <https://developercertificate.org/>

**Why DCO instead of CLA?** We follow the Linux kernel / GitLab / Chef / Docker approach — zero friction for contributors, no separate signing process. Just `git commit -s`.

Configure your name + email once:

```bash
git config --global user.name "Your Real Name"
git config --global user.email "your@email"
```

Forgot `-s` on a commit? Amend it: `git commit --amend -s` (or `git rebase -i` + edit pick → reword for multiple commits).

---

## Development setup

### Requirements

- **Node 22 LTS** (use `nvm install 22` or `fnm use 22`)
- **pnpm 9+** (`npm install -g pnpm` or via Corepack: `corepack enable && corepack prepare pnpm@9 --activate`)
- **Docker** + Docker Compose (for Postgres locally — or bring your own Postgres 16)
- **Git** with DCO sign-off configured (see above)

### Install + run

```bash
pnpm install                  # workspace install (api + web + shared)
docker compose up -d db       # Postgres on :5432
cp api/.env.example api/.env  # adjust if needed
cp client/.env.example client/.env

pnpm db:migrate dev           # apply Prisma migrations
pnpm db:seed                  # Nordica demo data (3 sites, 8 assets, sample assessment)

pnpm dev                      # starts api (fastify :3001) + client (vite :5173) in parallel
```

Login: `admin@nordica.demo` / `demo123`

### Project layout (monorepo)

```
.
├── api/                  Fastify backend (TypeScript)
│   ├── src/
│   │   ├── routes/       — feature modules (RBAC + handler + zod schemas)
│   │   ├── services/     — business logic
│   │   ├── plugins/      — fastify plugins (auth, prisma, error handler)
│   │   └── lib/          — shared utilities
│   ├── prisma/           — schema + migrations + seed
│   └── tests/            — vitest specs
├── client/               Vite + React 19 SPA
│   └── src/
│       ├── routes/       — TanStack Router file-based
│       ├── components/   — feature components (hifi/) + ui/ shadcn
│       ├── hooks/        — useQueries, useMutations
│       └── lib/          — api client (orval/zod-fetch), utils
├── shared/               Cross-package types (zod schemas, enums)
├── docker/               Dockerfiles, compose files
├── docs/                 Methodology, install, architecture
├── demo/                 Screenshots, brand assets
└── .github/              CI, templates, workflows
```

### Module pattern (when adding a new feature)

A feature has 4 layers; each PR ideally touches all four with vertical slice:

1. **Prisma schema** — model + relations + indices (`api/prisma/schema.prisma`)
2. **API route module** — `api/src/routes/<feature>/` with `index.ts` (router), `handlers.ts`, `service.ts`, `schemas.ts` (zod)
3. **Client components** — `client/src/components/hifi/<feature>/`
4. **Tests** — vitest for service, integration tests for route, Playwright for E2E if user-visible

---

## Commit conventions

We use **Conventional Commits**:

```
<type>(<scope>): <subject>

<body — optional>

Signed-off-by: Your Name <your@email>
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`, `build`, `style`.

Scope examples: `api/assessments`, `client/wizard`, `prisma`, `ci`, `docs`.

Subjects: imperative, lowercase, no period, < 72 chars.

Body: wrap at 72, motivation + what changes + what doesn't.

Examples:

```
feat(api/assessments): add countermeasure attachment endpoint

Adds POST /api/assessments/:id/countermeasures with zod validation.
Service layer + Prisma upsert in transaction. Reviewer-only.

Closes #142
Signed-off-by: Jane Doe <jane@example.com>
```

```
fix(client/wizard): preserve form state on step navigation

Step 2 wizard state was reset when user clicked "Back" after step 3.
Cause: form was unmounted. Fix: lift state to wizard parent.

Fixes #198
Signed-off-by: Jane Doe <jane@example.com>
```

---

## PR workflow

1. **Discuss first** for non-trivial changes — open a [Discussion](https://github.com/grace-pse/grace/discussions) or issue before coding. We don't want you to spend a weekend on something that won't land.
2. **One feature per PR** — keep it focused. Split refactors from features.
3. **Tests required** — at least unit tests for business logic, integration for API routes.
4. **CI must be green** — lint, typecheck, tests, prisma validate, docker build smoke.
5. **One reviewer approval** — currently @mtspl. Reviewer may suggest changes.
6. **DCO check must pass** — green checkmark on the PR. If red: `git commit --amend -s` + force push.
7. **Squash on merge** — we keep `main` linear. Your commit messages get squashed; final message is the PR title.

### What we look for in review

- **Tests.** A PR without tests is incomplete.
- **Names.** Functions, variables, files — speak human. `getRiskForAsset()`, not `getRfA()`.
- **No magic numbers.** Constants live in `shared/constants/` or feature-level constants file.
- **Error handling.** Don't catch + ignore. Either re-throw with context, or log + decide.
- **Types end-to-end.** Zod schema → Prisma type → API response type → client query → component prop. No `any`.
- **Permissions.** Every route handler explicit RBAC check via `requirePermission()`. No "we'll secure it later."
- **Audit.** State-changing operations log to audit log with actor + reason.

---

## Tests

```bash
pnpm test                  # all packages
pnpm --filter api test     # api only
pnpm --filter client test  # client only
pnpm test:watch            # watch mode
pnpm test:e2e              # Playwright (requires running app)
```

**Coverage target:** 70%+ on services / business logic. UI is tested via Playwright E2E rather than unit.

---

## Documentation

- **User docs** in `docs/`. Markdown, with diagrams in Mermaid where helpful.
- **API reference** auto-generated from Fastify schemas → `docs/api/`.
- **Architecture decisions** in `docs/adr/` (ADR format, numbered).
- **CHANGELOG.md** — your PR should update if user-visible. Format: Keep a Changelog.

---

## Code style

- **TypeScript strict mode.** No `any`, no `@ts-ignore` without comment explaining why.
- **ESLint + Prettier** — run `pnpm lint --fix` before commit. CI checks both.
- **Imports** — auto-organized by Prettier plugin. Absolute paths from package root (`@/...`).
- **CSS** — Tailwind utility-first, custom CSS only when Tailwind can't express it.

---

## Releasing (maintainer notes)

1. `pnpm changeset` (per significant change during cycle)
2. `pnpm changeset:version` → updates CHANGELOG + bumps version
3. `git tag v0.x.y && git push --tags` → triggers GHCR publish workflow
4. GitHub Release auto-drafted by `release-drafter` (maybe Phase 11)

---

## Reporting bugs

Use [GitHub Issues](https://github.com/grace-pse/grace/issues/new/choose) with the **Bug Report** template. Include:

- GRACE version (`git rev-parse HEAD` or release tag)
- Environment (Docker version, OS, browser if UI bug)
- Steps to reproduce, expected vs actual
- Logs (sanitize sensitive data)

For **security** vulnerabilities — do **not** open a public issue. See [`SECURITY.md`](./SECURITY.md).

---

## Code of Conduct

This project follows [Contributor Covenant v2.1](./CODE_OF_CONDUCT.md). By participating, you agree to abide by it. Report violations to `contact@grace-ps.io`.

---

## Questions?

- [GitHub Discussions](https://github.com/grace-pse/grace/discussions) — for design, methodology, use case questions
- [contact@grace-ps.io](mailto:contact@grace-ps.io) — for governance, sponsorship, commercial license

Thank you for contributing to GRACE.
