# Security policy

MedBrains handles patient data. We take security reports seriously and ask the same care of anyone who deploys or contributes to it.

## Reporting a vulnerability

**Do not report a vulnerability in a public issue, discussion or pull request.**

Report it privately through **GitHub Security Advisories**: [report a vulnerability](https://github.com/medbrains/medbrains/security/advisories/new). This lets us work on the fix with you in private and credit you.

If you cannot use GitHub, email hello@medbrains.in with the subject `SECURITY: MedBrains` and we will move the conversation to a private advisory.

Please include:

- the affected component or endpoint, and the commit you tested;
- what an attacker could do with it;
- steps to reproduce, or a proof of concept;
- a suggested fix, if you have one.

Never include real patient data in a report. If you came across any while testing, tell us, stop, and do not keep a copy.

## What to expect

| Step | Target |
|---|---|
| Acknowledgement | within 3 working days |
| First assessment and severity | within 7 working days |
| Fix for a critical or high-severity issue | as fast as we can, aimed at 30 days |
| Public advisory | once a fix is available, on a date agreed with you |

We credit reporters in the advisory unless you would rather stay anonymous.

We will not pursue legal action over good-faith research that follows this policy and does not access, change or take real patient data.

## Supported versions

MedBrains has no versioned releases yet. Security fixes go to the `master` branch; deployments should track it. Once we publish releases, this section will list which ones receive fixes.

## Scope

In scope: the backend (`medbrains/crates`), the web, desktop and native apps, the database schema and row-level security policies, authentication and authorisation, and the deploy kits and infrastructure code in this repository.

Out of scope: third-party services, the configuration of your own deployment, denial of service by volume, and social engineering.

## Deploying MedBrains securely

If you run MedBrains yourself, at minimum:

- Set `MEDBRAINS_ENV=production`, provide your own Ed25519 JWT keys, and set `MEDBRAINS_SEED_ADMIN_PASSWORD`. The server refuses the development defaults in production.
- Connect the app with the database roles that row-level security applies to (see `medbrains/docs/ops/DB-ROLES.md`), never as the table owner.
- Terminate TLS in front of the server and never expose PostgreSQL publicly.
- Keep scans, images and PDFs in access-controlled object storage.
- Keep dependencies patched; CI runs `cargo audit` and `pnpm audit`.

## Data protection

MedBrains is designed to help hospitals meet health-data law, including India's DPDP Act: purpose-wise consent, a rights desk, audit trails, field redaction and role-based access. The hospital running it remains responsible for its own legal obligations — consent, retention, breach notification and access review.
