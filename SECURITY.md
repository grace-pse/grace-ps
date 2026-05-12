# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅ (current development line) |
| < 0.1   | ❌ |

Until we cut a stable `v1.0`, **the `main` branch is the security-supported version**. Tagged releases are snapshots; we patch forward, not backward (yet).

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

### Preferred channel

Email **[contact@grace-ps.io](mailto:contact@grace-ps.io)** with:

- A clear description of the vulnerability
- Steps to reproduce (or a minimal proof of concept)
- Affected version / commit
- Your assessment of impact
- Optional: suggested fix or mitigation
- Optional: how you'd like to be credited in the advisory

You can encrypt sensitive details with our PGP key (publishing soon — for now, contact us first and we'll share via secure channel).

### What to expect

| When                  | What we commit to                                          |
| --------------------- | ---------------------------------------------------------- |
| Within **48 hours**   | Acknowledgement of your report                             |
| Within **7 days**     | Initial assessment + severity classification                |
| Within **30 days**    | Fix in a private branch (or a clear plan if more complex)  |
| Within **90 days**    | Public disclosure (or earlier with your consent)           |

We follow **coordinated disclosure** with a default 90-day embargo, in line with industry practice (Google Project Zero, CERT/CC). We will negotiate the timeline with you in good faith.

### Severity classification

We use the following bands (CVSS-inspired):

- **Critical** (RCE, auth bypass, mass data exfil) — drop everything; fix in days; hotfix release
- **High** (privilege escalation, partial auth bypass, IDOR with sensitive data) — fix in weeks
- **Medium** (info disclosure, DoS with auth) — fix in the next release cycle
- **Low** (defense-in-depth missing, hardening) — fix when convenient

### What's in scope

- **Code in this repository** (`grace-pse/grace`)
- **Docker images** published from this repo to `ghcr.io/grace-pse/`
- **Default configuration / install docs** (insecure defaults shipped by us)

### What's out of scope

- Vulnerabilities requiring physical access to the running instance
- Self-XSS without other vectors
- Missing security headers without demonstrated impact (we'll fix anyway, but it's not "critical")
- Third-party dependencies — please report upstream first; we'll respond to advisories that affect us
- The demo instance at `https://demo.grace-ps.io` (it's a public sandbox with seed data; treat it as fair game *for non-destructive testing only*)
- Social engineering of maintainers

### Bug bounty

We don't have a paid bounty program right now. We do offer:

- **Acknowledgement in our advisory + CHANGELOG** (with your preferred name/handle)
- **Hall of fame** entry once we publish one (Phase 11)
- **Swag** if you want it (stickers, T-shirts) once we have any
- **Reference** if you're job-hunting in security and want a public statement from us

## Public Advisories

Past advisories are published as [GitHub Security Advisories](https://github.com/grace-pse/grace/security/advisories) and announced in [Discussions › Announcements](https://github.com/grace-pse/grace/discussions/categories/announcements).

## Hardening recommendations

If you self-host GRACE, please follow [`docs/installation.md#hardening`](./docs/installation.md) (publishing Phase 2). Quick checklist:

- Always run behind HTTPS (use Caddy / nginx / Traefik with Let's Encrypt)
- Set `JWT_SECRET` to a high-entropy random value (e.g., `openssl rand -hex 32`)
- Don't expose Postgres port `5432` to the internet; keep it on the Docker internal network
- Run Docker images as non-root (we do this by default)
- Enable rate limiting on `/api/auth/*` if exposed publicly
- Audit your tenants, users, and roles regularly
- Subscribe to security advisories on this repo (Watch → Custom → Security alerts)

Thank you for helping keep GRACE secure.
