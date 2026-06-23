# Security Policy

MedBrains handles patient data. We take security extremely seriously and ask the same of anyone who deploys or contributes to it.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, use one of these private channels:

- **GitHub Security Advisories** — [Report a vulnerability](https://github.com/DomnicAmalan/MedBrains/security/advisories/new) (preferred; lets us collaborate privately and credit you).
- **Email** — the repository owner's published contact address, with subject `SECURITY: MedBrains`.

Please include:

- the affected component/endpoint and version/commit,
- a description and impact assessment (what an attacker could do),
- reproduction steps or a proof of concept,
- any suggested remediation.

## What to expect

- **Acknowledgement** within 3 business days.
- An initial assessment and severity rating within 7 business days.
- Coordinated disclosure: we'll agree a timeline with you, fix the issue, and credit you (unless you prefer to remain anonymous).

We will not pursue legal action against good-faith security research that respects this policy and does not access, modify, or exfiltrate real patient data.

## Scope

In scope: the MedBrains backend (Rust/Axum), web/mobile/TV clients, database schema and RLS policies, auth (JWT/Argon2), permission system, and deployment/IaC in this repository.

Out of scope: third-party services, your own deployment's misconfiguration, and social engineering.

## Deploying MedBrains securely

If you self-host, at minimum:

- Set `MEDBRAINS_ENV=production`, provide real Ed25519 JWT keys, and set `MEDBRAINS_SEED_ADMIN_PASSWORD` (the server refuses default credentials in production).
- Keep PostgreSQL Row-Level Security enabled; never disable tenant context.
- Terminate TLS in front of the server; do not expose the database publicly.
- Store DICOM/scans/PDFs in access-controlled object storage, not on the app host.
- Apply security updates promptly — watch [Releases](https://github.com/DomnicAmalan/MedBrains/releases).
- The repository runs a dependency-audit CI gate (`cargo audit` + `pnpm audit`); keep your fork's dependencies patched.

## Data protection

MedBrains is designed for compliance with health-data regulations (and India's IT Act / DPDP context). Operators remain responsible for their own legal obligations (consent, retention, breach notification, access logging). The system provides audit trails, field-level redaction, and RBAC to support this — using them correctly is the deployer's responsibility.
