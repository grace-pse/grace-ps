# Changelog

All notable changes to GRACE are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- _(features in development for the next release land here)_

### Changed

### Fixed

### Security

---

## [0.1.0] — 2026-05-19 — Initial OSS release

First public release. The core risk assessment workflow + multi-tenant + PDF.

### Added
- **Asset inventory** with site / zone / asset hierarchy and relationship graph (React Flow)
- **Threat library** seeded with ASIS + ISO 31000 + sector baseline threats
- **7-step assessment wizard** — scope, assets, threats, vulnerabilities, countermeasures, residual risk, report
- **TEAR + ALARP** methodology implementation with defensible math + audit trail
- **Compliance matrix** auto-mapped to NIS2 Annex IV + ISO 27001 Annex A
- **PDF report** via Puppeteer — pixel-perfect, multi-page with cover + executive summary + technical detail + compliance matrix
- **Multi-tenant** architecture with `tenantId` scoping on all queries
- **5-role RBAC** — Admin / Reviewer / Editor / Viewer / Auditor with permission-gated routes
- **Reviewer workflow** — separation of duties, sign-off chain, change diff history
- **Audit log** — every state-changing operation logged with actor + reason + timestamp
- **Template library editor** — admin-managed template catalog (threats, vulnerabilities, countermeasures)
- **Site map** with Leaflet — geographic visualization of multi-site deployments
- **Demo seed** — `Nordica` fictitious company with 3 sites (Warszawa, Hamburg, Oslo), 8 assets, sample assessment
- **Docker Compose** install path (3 lines)
- **AGPLv3** open-source license + dual-license option (commercial)

### Documentation
- README, CONTRIBUTING (with DCO), CODE_OF_CONDUCT (Contributor Covenant 2.1), SECURITY, COMMERCIAL_LICENSE
- Quickstart for Docker
- GitHub Discussions for community Q&A and feature requests

### Infrastructure
- CI workflow (lint, typecheck, test, build, prisma validate, docker build smoke)
- Docker images published to GHCR on tagged releases
- DCO sign-off check on every PR
- Dependabot weekly updates (pnpm, actions, docker base)

### Known limitations (in scope for later releases)
- Incident management — Enterprise tier only (out of OSS scope)
- Continuous monitoring / SIEM integration — Enterprise tier only
- SSO (SAML/OIDC), SCIM provisioning — Enterprise tier only
- Mobile app — not on the v0.1–v1.0 roadmap (community-driven candidate)
- Translation — English-only at v0.1; PL/DE/FR planned for v0.3

---

## Versioning policy

- **Major (`1.x.0` → `2.0.0`)** — breaking API changes, schema migrations that aren't auto-upgradeable, removed features
- **Minor (`0.1.0` → `0.2.0`)** — new features, additive schema changes, deprecations (warned)
- **Patch (`0.1.0` → `0.1.1`)** — bug fixes, security patches, doc fixes, dependency bumps

Until `1.0.0`, breaking changes may land in minor versions. See `0.x → 1.0` migration guide when published.
