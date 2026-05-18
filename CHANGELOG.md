# Changelog

All notable changes to this project will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-04-21

First public / OSS launch release. Everything below has been in the private tree during Phase 0 / Phase 1 bring-up; this is the tag at which the repository opens to the community.

### Added

- **Auth + multi-tenant org model** — JWT, 5-role RBAC (Admin, Lead Assessor, Assessor, Reviewer, Stakeholder), org-scoped resource queries.
- **Asset catalogue** — Site → Building → Floor → Room → Equipment hierarchy with tags, criticality (1–5), status, metadata, and `location { lat, lng, address }` for geocoded sites.
- **Asset relationships** — typed edges (DEPENDS_ON, PROTECTS, SERVES, CONTAINS, COMMUNICATES_WITH, ADJACENT_TO, SUPPLIES) with impact propagation.
- **Asset clusters** — OPERATIONAL / SPATIAL / LOGICAL / TEMPORAL with HIGHEST / AVERAGE / CUSTOM criticality derivation and configurable status propagation.
- **Template library** — Banking & Finance threat pack (8 modules, 106 assets, 86 threats, 422 correlations) with suggestion engine that maps templates to assets.
- **7-step assessment wizard** — Scope → Assets → Threats → Likelihood → Impact → IRV → Vulnerability → Treatment; CASCADE_DOWN asset resolution, autosave.
- **Risk engine** — 5×5 IRV matrix, 5×4 Priority matrix, vulnerability-weighted risk treatment priority.
- **TEAR strategies** — Transfer / Eliminate / Accept / Reduce with ALARP justification textarea.
- **Compliance tagging** — ISO 31000, NIS2 Art. 21, NIS2 Art. 23, CER Directive, ASIS SPC.1, ISO 28000.
- **Countermeasures catalogue** — SHAPE category (Security-Programme / Human / Architectural / Procedural / Equipment) × PPS functions (Deter / Detect / Delay / Deny / Disrupt / Defeat / Recover) × protection domain; cost estimate + annual cost + effectiveness rating + ALARP; assignable to asset and/or threat.
- **Action plans** — owner, target date, status (PENDING / IN_PROGRESS / COMPLETED / OVERDUE / CANCELLED), compliance tags, evidence.
- **Review queue** — PENDING → IN_REVIEW → APPROVED / REJECTED / REVISION_REQUESTED with audit-ready snapshots on every transition.
- **Assessment snapshots** — SUBMITTED_FOR_REVIEW / APPROVED / REJECTED / MANUAL_SAVE reasons with full payload of assessment + threats + action plans.
- **PDF export** of approved assessments (Puppeteer).
- **Site map** — Leaflet view of geocoded sites, driven by `asset.location`.
- **Relationship graph** — React Flow + dagre layout, filter by criticality.
- **Nordica demo seed** — 1 org, 4 demo users (admin/lead/assessor/reviewer @nordica.demo, password `Demo123!`), 3 sites (Warszawa / Hamburg / Oslo) with real coords, 17 child assets, 2 clusters, 5 relationships, 1 APPROVED assessment with 8 fully-scored threats, 5 countermeasures, 6 action plans, 3 snapshots.
- **OpenAPI / Swagger UI** at `/api/docs`.
- **Docker-compose self-host** stack — nginx + api + postgres, env-driven config.
- **AGPL-3.0** licence + dual-commercial-licence option.

### Documentation

- `README.md` rewrite with feature list, live demo link, and self-host quickstart.
- `CONTRIBUTING.md` with Developer Certificate of Origin sign-off flow.
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1 verbatim.
- `SECURITY.md` — responsible-disclosure policy with 90-day SLA for high/critical fixes.
- `COMMERCIAL_LICENSE.md` — dual-licence explanation.
- GitHub issue + discussion templates.

### Known gaps (planned post-launch)

- Incidents module + IncidentLink to threats (csmp-run parity).
- Audit log + per-entity comments.
- Admin console (users/sites/settings) — currently marked "soon" in the sidebar.
- Postgres row-level security for defence-in-depth tenant isolation.
- SSO/SAML — Enterprise only, see `COMMERCIAL_LICENSE.md`.
- Data migration tool from the legacy FastAPI build (`csmp-run`).

[Unreleased]: https://github.com/mtspl/csmp_v2/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mtspl/csmp_v2/releases/tag/v0.1.0
