# Security policy

## Supported versions

CSMP Risk Manager is in active development (pre-1.0). Only the latest `main` branch and the most recent tagged release receive security fixes.

| Version                  | Supported   |
| ------------------------ | ----------- |
| `main` (development)     | ✅          |
| Latest tagged release    | ✅          |
| Older releases           | ❌          |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report responsibly to **contact@grace-ps.io** with:

- A description of the issue and its impact.
- Reproduction steps or a minimal proof-of-concept.
- The affected version (commit SHA or release tag).
- Whether the issue is already public or you are its discoverer.

If possible, please PGP-encrypt sensitive material; the maintainer's key is available on request.

## What to expect

- **Acknowledgement** within 72 hours.
- **Initial assessment** within 7 days (severity, reproducibility, scope).
- **Fix targeted** within 90 days of acknowledgement for high/critical severity. Lower-severity issues may take longer; timelines will be communicated.
- **Coordinated disclosure**: we agree on a public-disclosure date with you before publishing. Credit in the changelog unless you prefer to stay anonymous.

## In scope

- Authentication, authorization, and tenancy bypass (cross-org data leakage).
- Injection (SQL, command, template) in server or client.
- CSRF / XSS / SSRF / open redirect.
- Cryptographic mistakes (JWT handling, password hashing, TLS config on our reference deployment).
- Docker image hardening issues, including exposed debug ports or embedded secrets.
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

Thanks for helping keep CSMP Risk Manager safe.
