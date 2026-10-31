# Security policy

MedBrains handles patient data, so we ask everyone who deploys or contributes to it to treat security with care.

## Reporting a vulnerability

**Do not report security vulnerabilities in public GitHub issues, discussions or pull requests.**

Use one of these private channels instead:

- **GitHub Security Advisories:** [report a vulnerability](https://github.com/medbrains/medbrains/security/advisories/new). This is the preferred route. It lets us work with you privately and credit you.
- **Email:** the repository owner's published contact address, with the subject `SECURITY: MedBrains`.

Please include:

- the affected component or endpoint, and the version or commit
- what an attacker could do with it
- steps to reproduce, or a proof of concept
- a suggested fix, if you have one

## What to expect

- **Acknowledgement** within 3 business days.
- An initial assessment and severity rating within 7 business days.
- Coordinated disclosure: we agree a timeline with you, fix the issue and credit you, unless you prefer to stay anonymous.

We will not pursue legal action against good-faith security research that respects this policy and does not access, modify, or exfiltrate real patient data.

## Scope

In scope: the MedBrains backend (Rust/Axum), the web, mobile and TV clients, the database schema and RLS policies, authentication (JWT/Argon2), the permission system, and the deployment and infrastructure code in this repository.

Out of scope: third-party services, misconfiguration of your own deployment, and social engineering.

## Deploying MedBrains securely

If you host MedBrains yourself, at a minimum:

- Set `MEDBRAINS_ENV=production`, provide real Ed25519 JWT keys, and set `MEDBRAINS_SEED_ADMIN_PASSWORD` (the server refuses default credentials in production).
- Keep PostgreSQL Row-Level Security enabled; never disable tenant context.
- Terminate TLS in front of the server; do not expose the database publicly.
- Store DICOM/scans/PDFs in access-controlled object storage, not on the app host.
- Apply security updates promptly. Watch [Releases](https://github.com/medbrains/medbrains/releases).
- The repository runs a dependency audit in CI (`cargo audit` and `pnpm audit`). Keep your fork's dependencies patched.

## Data protection

MedBrains is designed to help operators comply with health-data regulations, including India's IT Act and the DPDP Act. Operators remain responsible for their own legal obligations: consent, retention, breach notification and access logging. The system provides audit trails, field-level redaction and RBAC to support this. Using them correctly is the operator's responsibility.
