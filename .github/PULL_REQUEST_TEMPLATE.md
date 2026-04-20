## Summary

<!-- What does this PR do and why? One short paragraph. -->

## Changes

- <!-- bullet list of concrete changes -->

## Test plan

- [ ] `pnpm exec tsc --noEmit` passes (server + client)
- [ ] `pnpm test` passes
- [ ] Tested the affected flow manually (describe steps)
- [ ] Migrations, if any, applied cleanly against a fresh DB **and** against one with existing seed data

## Screenshots / recordings

<!-- For UI changes. Delete section if not applicable. -->

## Checklist

- [ ] Commits are signed off (`git commit -s`) — DCO compliance
- [ ] Added / updated Zod schemas for any new HTTP boundary
- [ ] Updated `CHANGELOG.md` under `[Unreleased]` if user-visible
- [ ] No hardcoded hex colours on the client — Tailwind tokens only
- [ ] Did **not** modify the sibling reference folders (`csmp-run/`, `csmp-app/`, design handoff)

## Related issues

<!-- Fixes #123, Refs #456 -->
