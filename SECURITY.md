# Security policy

## Reporting a vulnerability

Please report security issues privately to **security@norbix.ai** (or open a
GitHub security advisory). Do not open a public issue for vulnerabilities.

We aim to acknowledge reports within 3 business days.

## How we keep this project secure

- **Minimal dependencies.** The Admin Portal intentionally ships a very small
  runtime dependency set (React, Redux Toolkit, React Router, redux-persist).
  Fewer dependencies means a smaller attack surface and fewer supply-chain
  risks. Please avoid adding new runtime dependencies without discussion.
- **Automated dependency updates** via Dependabot (npm, GitHub Actions, Docker
  base image), grouped weekly.
- **CI gates:** lint, typecheck, tests, build, and `npm audit --omit=dev
  --audit-level=high` run on every PR.
- **Static analysis:** CodeQL (security-and-quality queries) on push, PR, and
  weekly schedule.
- **Container scanning:** Trivy scans the built image for HIGH/CRITICAL CVEs.
- **No secrets in the SPA.** The portal is a static bundle; it holds no server
  secrets. End-user tokens live only in the browser session.

## Supported versions

The `main` branch is supported. Security fixes are applied there and released
in the next image build.
