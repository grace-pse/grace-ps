# Security policy

## Supported versions

GRACE is in active development (pre-1.0). Only the latest `main` branch and the most recent tagged release receive security fixes.

| Version              | Supported |
| -------------------- | --------- |
| `main` (development) | ✅        |
| `0.1.x`              | ✅        |
| Older releases       | ❌        |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Preferred: open a [private security advisory](https://github.com/grace-pse/grace/security/advisories/new) on this repository.

Alternative: email **contact@grace-ps.io** with subject line `SECURITY: [short description]`.

Please include:

- A **description** of the issue and its real-world impact.
- **Reproduction steps** or a minimal proof-of-concept.
- The **affected version** (commit SHA or release tag).
- Whether the issue is already public or you are its discoverer.
- Your preferred credit handle (or "anonymous").

If possible, PGP-encrypt sensitive material; the maintainer's key is available on request.

## Coordinated disclosure

We follow a **90-day coordinated disclosure** policy:

- **Acknowledgement** within 72 hours of report.
- **Initial assessment** (severity, reproducibility, scope) within 7 days.
- **Fix targeted within 90 days** of acknowledgement for high/critical severity. Lower-severity issues may take longer; timelines will be communicated.
- We agree on a public-disclosure date with the reporter before publishing. You will be credited in the advisory and changelog unless you prefer to stay anonymous.

If we cannot meet the 90-day window, we will tell you and propose an extension with reasoning. Researchers retain the right to disclose after the window expires.

## In scope

- Authentication, authorization, and tenancy bypass (cross-org data leakage).
- Injection (SQL, command, template) in server or client.
- CSRF / XSS / SSRF / open redirect.
- Cryptographic mistakes (JWT handling, password hashing, TLS config on reference deployments).
- Docker image hardening issues — exposed debug ports, embedded secrets, world-readable volumes.
- Vulnerabilities in third-party dependencies that meaningfully affect this project.

## Out of scope

- Denial-of-service that requires sustained, unrealistic volume on a self-hosted instance.
- Findings only reproducible in a configuration that contradicts documented hardening guidance (e.g. running with the default `JWT_SECRET`).
- Social engineering of the maintainer or contributors.
- Issues in unsupported older releases.

## Safe-harbour

We will not pursue legal action against researchers who:

- Act in good faith.
- Avoid privacy violations, degradation of live services, destruction of data, and interruption of production use.
- Give us a reasonable time to fix the issue before public disclosure.

Thanks for helping keep GRACE safe.
