<!-- markdownlint-disable MD033 MD041 -->
<p align="center">
  <!-- Logo placeholder — finalize when Marek delivers grace-logo.svg/png -->
  <strong><span style="font-size:2em;">GRACE</span></strong><br/>
  <em>Governance · Risk Assessment · Compliance · Engine</em>
</p>

<p align="center">
  <a href="https://github.com/grace-pse/grace/blob/main/LICENSE"><img alt="License: AGPL v3" src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg"></a>
  <a href="#"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178c6.svg"></a>
  <a href="#"><img alt="Fastify" src="https://img.shields.io/badge/Fastify-5.x-000000.svg"></a>
  <a href="#"><img alt="React" src="https://img.shields.io/badge/React-19-61dafb.svg"></a>
  <a href="#"><img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-336791.svg"></a>
  <a href="#"><img alt="Prisma" src="https://img.shields.io/badge/Prisma-6-2D3748.svg"></a>
  <a href="https://github.com/grace-pse/grace/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/grace-pse/grace/actions/workflows/ci.yml/badge.svg"></a>
</p>

> **Open-source platform for physical security risk assessment, aligned with NIS2 and ISO/IEC 27001.**
> Built for compliance officers, security consultants, and CISOs who need defensible, auditable risk methodology — without the spreadsheets.

<p align="center">
  <!-- Hero image placeholder — see Phase 6 / Blok L -->
  <em>🎬 Live demo: <a href="https://demo.grace-ps.io">demo.grace-ps.io</a> · admin@nordica.demo / demo123</em>
</p>

---

## ✨ Quickstart (Docker, 3 lines)

```bash
git clone https://github.com/grace-pse/grace.git && cd grace
docker compose up -d
# Open http://localhost:8081 — login admin@nordica.demo / demo123
```

Full installation guide: [`docs/installation.md`](docs/installation.md) · System requirements: 2 vCPU / 2 GB RAM / 10 GB disk.

---

## 🎯 What's inside

GRACE is a complete risk assessment platform for **physical security** — the part of GRC that spreadsheets and generic GRC tools handle poorly:

- **Asset inventory** with hierarchical site/zone modeling and relationship graphs (React Flow)
- **Threat library** aligned to industry standards (ASIS, ISO 31000, sector-specific)
- **7-step assessment workflow** — scope → assets → threats → vulnerabilities → countermeasures → residual risk → report
- **TEAR + ALARP methodology** — Threat Event Annualized Rate + As Low As Reasonably Practicable, defensible math
- **Compliance matrix** — auto-mapped to NIS2 Annex IV, ISO 27001 Annex A, sector regs (NIS2 essential/important entities, RODO, GDPR)
- **PDF reporting** — pixel-perfect via Puppeteer, same CSS as the app, multi-page with exec summary + technical detail
- **Multi-tenant + RBAC** — 5 roles (Admin / Reviewer / Editor / Viewer / Auditor), tenant-scoped data, audit log
- **Reviewer workflow** — separation of duties, sign-off chain, change diff history

---

## 📐 Methodology teaser

GRACE implements a **defensible**, quantitative-leaning methodology designed for physical security where pure-cyber frameworks (CVSS, FAIR) don't fit:

- **TEAR** (Threat Event Annualized Rate) — frequency × likelihood × consequence
- **ALARP** check — every accepted residual risk passes "as low as reasonably practicable" gate
- **Site / Zone / Asset hierarchy** — risk inheritance + override
- **Countermeasure attribution** — explicit link between control and threat (no waving hands)
- **Audit-grade trail** — every state change is logged with actor + reason + timestamp

Detailed methodology: [`docs/methodology/`](docs/methodology/) (publishing soon, Phase 2).

---

## 👤 Who is GRACE for

**Compliance officers** at NIS2-essential / important entities (energy, water, transport, healthcare, digital infra, manufacturing) who need to prove physical security controls to regulators — not just check a box.

**Security consultants** running assessments for multiple clients, tired of bespoke spreadsheets, wanting one tool with audit trail and PDF deliverables.

**CISOs** integrating physical security into a unified GRC view — GRACE fits alongside cyber tools, not in their place.

---

## 🚫 What's NOT included (yet)

GRACE OSS focuses on the core risk assessment workflow. Following are **deliberately scoped out** of v0.1 and live in the enterprise offering or future versions:

- ❌ **Incident management** — not in scope; see [Enterprise](#-commercial--enterprise)
- ❌ **Continuous monitoring / SIEM integration** — Enterprise
- ❌ **Multi-region deploy / SSO / SCIM** — Enterprise
- ❌ **Mobile apps** — roadmap candidate (community-driven)
- ❌ **API for external integrations** — partial (read-only Phase 2), full in Enterprise

[See full enterprise comparison →](./COMMERCIAL_LICENSE.md)

---

## 📸 Screenshots

<!-- Phase 6 / Blok L — finalize when screenshots are captured by Playwright automation -->

| Dashboard | Wizard (Step 2) | Relationship Graph |
|---|---|---|
| <em>placeholder</em> | <em>placeholder</em> | <em>placeholder</em> |
| **Site Map** | **PDF Report** | |
| <em>placeholder</em> | <em>placeholder</em> | |

---

## 🗺️ Roadmap

See [GitHub Projects](https://github.com/grace-pse/grace/projects) or [`ROADMAP.md`](./ROADMAP.md) (publishing Phase 2).

**Highlights:**
- **v0.1 (this release)** — core risk workflow, multi-tenant, PDF
- **v0.2** — methodology docs (full), API (read), template library expansion
- **v0.3** — translations (PL/DE/FR), regulator presets (NIS2 sector-specific)
- **v1.0** — production-ready, LTS branch, formal security audit

---

## 🤝 Contributing

We welcome contributions. Start here:

1. **First-time setup:** see [`CONTRIBUTING.md`](./CONTRIBUTING.md)
2. **Pick an issue** with [`good-first-issue`](https://github.com/grace-pse/grace/labels/good-first-issue) or [`help-wanted`](https://github.com/grace-pse/grace/labels/help-wanted)
3. **Discuss bigger ideas** in [GitHub Discussions](https://github.com/grace-pse/grace/discussions)
4. **Sign your commits** — DCO (`git commit -s`); details in CONTRIBUTING.md

We use **Conventional Commits**, **DCO** sign-off, and require CI green + 1 review on every PR.

---

## 📄 License

- **OSS code** — [AGPLv3](./LICENSE) (GNU Affero General Public License v3.0)
- **Commercial / Enterprise license** — available for organizations that prefer not to comply with AGPLv3 obligations. See [`COMMERCIAL_LICENSE.md`](./COMMERCIAL_LICENSE.md)

> *AGPLv3 specifically requires that organizations modifying GRACE and exposing it as a network service must release the modified source. If this doesn't fit your model — get the commercial license.*

---

## 🏢 Commercial / Enterprise

GRACE has a dual-license model. The Enterprise tier adds:

- Incident management module
- SSO (SAML, OIDC), SCIM provisioning
- API (full read/write, webhooks)
- Multi-region deploy, HA configuration
- SLA, dedicated support, custom methodology consulting
- Commercial license (no AGPLv3 obligations)

**Get in touch:** [contact@grace-ps.io](mailto:contact@grace-ps.io) or [request a demo / enterprise waitlist](#) <!-- Phase 7 enterprise form -->.

---

## 🛡️ Security

Found a vulnerability? Please disclose responsibly: see [`SECURITY.md`](./SECURITY.md).

**Do not** open public issues for security bugs.

---

## 🙏 Acknowledgements

GRACE builds on a generation of work in physical security risk management — ASIS International, ISO/IEC 27000-series, NIST SP 800-53 / 800-30, and the broader GRC community. Logos and trademarks belong to their respective owners.

Built by [Marek Malczewski](https://github.com/mtspl) and contributors. Sponsored builds welcome — see [`.github/FUNDING.yml`](./.github/FUNDING.yml).

---

<p align="center">
  <strong>GRACE</strong> · Open-source physical security risk assessment · Aligned with NIS2 + ISO 27001<br/>
  <a href="https://demo.grace-ps.io">demo</a> · <a href="https://github.com/grace-pse/grace/discussions">discussions</a> · <a href="mailto:contact@grace-ps.io">contact@grace-ps.io</a>
</p>
