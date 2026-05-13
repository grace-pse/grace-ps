# Commercial licence

GRACE Engine is distributed under a **dual-licence** model. Pick the option that fits how you use it.

## Tiers at a glance

| Capability                                   | OSS (AGPLv3) | Pro              | Enterprise        |
| -------------------------------------------- | :----------: | :--------------: | :---------------: |
| 7-step risk assessment wizard                | ✅           | ✅               | ✅                |
| Asset & relationship graph                   | ✅           | ✅               | ✅                |
| Site map + PDF export                        | ✅           | ✅               | ✅                |
| Template library (NIS2, ISO 27001)           | ✅           | ✅               | ✅                |
| Self-host with Docker Compose                | ✅           | ✅               | ✅                |
| AGPLv3 copyleft obligations                  | required     | waived           | waived            |
| Multi-tenant (multiple orgs per instance)    | ❌           | ✅               | ✅                |
| Custom branding / white-label                | ❌           | ✅               | ✅                |
| Priority engineering support                 | ❌           | ✅               | ✅                |
| Contractual SLA + indemnification            | ❌           | ❌               | ✅                |
| On-prem hardening + audit pack               | ❌           | ❌               | ✅                |
| Custom integrations (SSO/SAML, SCIM, ERP)    | ❌           | ❌               | ✅                |
| Guided onboarding + training                 | ❌           | ❌               | ✅                |
| Data migration from legacy risk registers    | ❌           | ❌               | ✅                |

## The open-source option — AGPLv3

The default licence is the [GNU Affero General Public License v3.0](./LICENSE). You may use, copy, modify, and redistribute this software freely provided you comply with the AGPL-3.0 terms. In particular:

- If you **run a modified version as a network service**, you must make the modified source available to the users of that service.
- Any software that links against this codebase in a way that creates a derivative work must also be AGPL-3.0.

For most self-hosters, consultancies, and internal-tools users, AGPLv3 is fine.

## When you need Pro or Enterprise

- You want to **embed GRACE inside a closed-source product** that you distribute or offer as SaaS.
- You need to run a **multi-tenant** instance for multiple organizations.
- Your organisation's policies prohibit AGPL-3.0 in production environments.
- You are an **MSP/MSSP** selling a white-labelled service built on this codebase and cannot release your modifications.
- You need **contractual warranties, indemnification, an SLA**, or long-term-support releases.
- You want **priority engineering support, onboarding, or custom integrations** (SSO/SAML, SCIM, custom compliance frameworks, data migration).

## How to get one

Email **contact@grace-ps.io** with:

- Your organisation and intended use case.
- Approximate number of end-users / assessors / tenants.
- Deployment model (self-hosted, managed by us, embedded, OEM).
- Whether you need support, SLA, indemnification, or additional services.

You'll get a reply within a few business days with pricing and contract terms.

## What the commercial licence does **not** do

- It does not remove the AGPL-3.0 licence from the public repository.
- It does not grant you trademark rights to "GRACE", "Governance Risk Assessment Compliance Engine", or related marks beyond what is needed to accurately describe the product.
- It does not transfer ownership of the codebase.

## Contributor licensing

Contributions are accepted under the Developer Certificate of Origin (see [CONTRIBUTING.md](./CONTRIBUTING.md)). By contributing, you agree that your work is licensed under AGPL-3.0 **and** may be granted under the commercial licence to downstream customers, on the terms the project maintainer sets, without additional compensation to you. This is what makes the dual-licence model work — the project can sell commercial licences for the whole codebase without having to track individual contributor consent on every deal.

If this conflicts with your employer's policy, please open an issue before contributing.
