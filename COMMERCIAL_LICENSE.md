# Commercial / Enterprise License

GRACE is dual-licensed: **AGPLv3 (default open-source)** or a **commercial license** for organizations that don't want AGPLv3 obligations.

## Why dual licensing?

AGPLv3 is great for open-source ecosystems but imposes specific obligations on organizations that modify GRACE and **expose it as a network service** to third parties (or internally outside the licensee's "private use"):

- You must release your modifications under AGPLv3
- Users of your service must be able to access the corresponding source code
- The license must travel with the software

This is the right model for an open, auditable, security-critical tool. But it doesn't fit every organization — especially **commercial vendors integrating GRACE into proprietary platforms** or **enterprises with strict legal/IP policies** that can't accept copyleft obligations.

That's where the commercial license comes in.

## What the commercial license gives you

- **No AGPLv3 obligations** — use, modify, embed GRACE without copyleft propagation
- **Proprietary derivative works** allowed — package GRACE inside your own product
- **Indemnification** — we indemnify you against IP claims on the original code
- **Priority support** — SLA-backed (depending on tier)
- **Roadmap influence** — Enterprise customers get input into the roadmap
- **Enterprise-only modules** (see below)

## Enterprise modules (not in OSS)

The Enterprise tier adds modules out of scope for the OSS edition:

| Module                        | OSS | Enterprise |
| ----------------------------- | --- | ---------- |
| Risk assessment (7-step)      | ✅   | ✅          |
| Asset inventory + graph       | ✅   | ✅          |
| 5-role RBAC                   | ✅   | ✅          |
| Multi-tenant                  | ✅   | ✅          |
| PDF reporting                 | ✅   | ✅          |
| Reviewer workflow             | ✅   | ✅          |
| Audit log                     | ✅   | ✅          |
| Compliance matrix (NIS2/ISO)  | ✅   | ✅          |
| **Incident management**       | ❌   | ✅          |
| **Continuous monitoring / SIEM webhooks** | ❌ | ✅ |
| **SSO** (SAML, OIDC)          | ❌   | ✅          |
| **SCIM** user provisioning    | ❌   | ✅          |
| **Full API** (write + webhooks) | partial (read) | ✅ |
| **Multi-region / HA deploy**  | ❌   | ✅          |
| **Custom methodology consulting** | ❌ | ✅          |
| **Priority SLA support**      | ❌   | ✅          |
| **Indemnification**           | ❌   | ✅          |

## Pricing

Pricing is **case-by-case** depending on:

- Number of users / seats
- Number of tenants (if you're a consultancy)
- Modules required
- Support tier (Standard / Premium)
- Deployment model (self-hosted / managed)

**Range:** typically EUR 5k–50k/year for SMB, custom enterprise pricing for larger. We're committed to staying accessible for sub-50-person teams; talk to us.

## How to get a quote

1. Email **[contact@grace-ps.io](mailto:contact@grace-ps.io)** with:
   - Company name, country, sector
   - Approximate user count / tenant count
   - Modules of interest
   - Deployment preference
   - Timeline
2. We respond within 2 business days with a discovery call.
3. After the call: written proposal + pricing within a week.

Or fill the [**Enterprise Waitlist Form**](#) <!-- Phase 7 — Google Forms link goes here --> if you want to be contacted when we open Enterprise sales formally.

## Already running GRACE under AGPLv3 and want to switch?

Easy. Same code, different license terms. We sign a license agreement, your obligations under AGPLv3 are replaced by the commercial terms. Contact us.

## Frequently asked questions

**Q: I'm a consultant using GRACE for client assessments. Do I need a commercial license?**
A: Probably not. AGPLv3 covers your use as long as you're not exposing GRACE to your client as a network service in a way that modifies the code. Read AGPLv3 §13 carefully or ask us.

**Q: I want to fork GRACE and rename it.**
A: Allowed under AGPLv3. You must keep the AGPLv3 license, release source for your fork, and not use the GRACE trademark or logos for your fork's name/branding. Pick a different name.

**Q: I want to integrate GRACE as a backend behind my proprietary SaaS.**
A: This is exactly the AGPLv3 §13 case. Either release your SaaS code under AGPLv3, or get a commercial license. We'll work with you on the latter.

**Q: I just want to deploy GRACE internally for my own company. AGPLv3 OK?**
A: Yes. Pure internal use without third-party network exposure doesn't trigger §13. AGPLv3 is fine.

---

Questions: [contact@grace-ps.io](mailto:contact@grace-ps.io)
