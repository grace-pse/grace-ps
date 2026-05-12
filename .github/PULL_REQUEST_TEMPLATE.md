<!--
Thanks for opening a PR. A few things before you submit:

1. PR title in Conventional Commits format: `feat(scope): subject`, `fix:`, `docs:`, etc.
2. Commits signed off with `git commit -s` (DCO required — CI will check).
3. CI must be green. Lint, typecheck, tests, prisma validate, docker build smoke.
4. One feature per PR — split refactors from features.
-->

## What this PR does

<!-- One paragraph. What changes and why. Link the issue/discussion this addresses. -->

Closes #

## Type of change

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation
- [ ] 🧹 Refactor (no functional change)
- [ ] 🔧 Build / CI / chore

## How was this tested?

<!--
Describe tests added or run manually. Include browser / OS / version for UI changes.
Example:
- Added unit tests for `service.calculateRisk()` covering ALARP edge cases
- Manually tested Wizard Step 4 on Chrome 130 macOS — happy path + back navigation
- All existing tests pass: `pnpm test` ✅
-->

## Screenshots (if UI)

<!-- Drag-drop images here. Before/after if applicable. -->

## Checklist

- [ ] My commits are signed off (DCO — `git commit -s`)
- [ ] PR title uses [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] My code follows the project style (`pnpm lint --fix` passes locally)
- [ ] Types are explicit; no `any` or `@ts-ignore` without justification
- [ ] Permissions / RBAC checks added if route is new or scope changed
- [ ] State-changing operations write to audit log
- [ ] Tests added (unit for logic, integration for routes, E2E for user-visible)
- [ ] CHANGELOG.md updated if user-visible change
- [ ] Documentation updated (`docs/` or inline JSDoc) where relevant
- [ ] No secrets / tokens / PII committed
- [ ] I've read [`CONTRIBUTING.md`](../CONTRIBUTING.md)
