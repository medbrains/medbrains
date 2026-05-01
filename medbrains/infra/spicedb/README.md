# SpiceDB Schema

`schema.zed` defines the ReBAC permission model — every clinical and
administrative resource, the relations they participate in, and the
permissions that resolve via SpiceDB's `Check` / `LookupResources` /
`BulkCheckPermission` APIs.

The schema is the contract between the cloud (`medbrains-server`,
`medbrains-authz`) and the on-prem edge (`medbrains-edge::authz_cache`).
Both sides assume the same definition names and relation arities, so a
schema change is a coordinated rollout — never a one-sided edit.

## Conventions

- `tenant` is the multi-tenant boundary. Every object carries
  `tenant: tenant`.
- `dept_member` derives department-scoped visibility from the user's
  department list rather than per-resource grants. Backfilled at
  tenant onboarding.
- `attending` / `ordering_provider` / `prescriber` come from FK
  columns in Postgres (e.g. `encounters.doctor_id`) and are written
  via the rebac-backfill CLI.
- `viewer` / `editor` / `consultant` are the only manually-managed
  relations — granted via the sharing API.
- Permission names mirror the dotted permission codes the app uses
  (`module.resource.action`) wherever possible, so cache keys map
  cleanly across SpiceDB and the JWT fallback path.

## Landing a schema change

1. Edit `schema.zed`.
2. Run `zed validate --schema-file schema.zed` locally — the CI gate
   will reject the PR otherwise.
3. Open a PR. The `SpiceDB Schema Validate` workflow runs on every
   change to this file (`.github/workflows/spicedb-validate.yml`).
4. Get review from someone who can speak to the impact on the edge
   cache — adding a new permission or relation may require a matching
   change in `medbrains-edge::authz_cache::ONLINE_REQUIRED_ACTIONS` if
   the new permission is high-risk (controlled-substance-level
   actions must always demand cloud consensus).
5. Once merged, the `dev-cluster-sync` job writes the schema to the
   dev cluster. Until Phase 5 of the hybrid roadmap is applied this
   step is a no-op (the secrets aren't configured); once the dev
   cluster is up, it auto-applies.
6. For prod: schema rollout is a manual `zed schema write` against
   the prod cluster. Schedule alongside the next medbrains-server
   release so the app and the schema bump together.

## Cadence

- **Operator-driven changes** (new module, new sharing surface) land
  whenever the corresponding feature ships.
- **Periodic audits** every quarter — verify every relation is still
  consumed by at least one Check call in the codebase. Dead relations
  invite drift.
- **Cluster reboot for breaking changes** — removing a relation or
  renaming a definition requires the cluster to drain its Watch
  buffers first. Coordinate with edge teams (the AuthzCache TTL
  defaults to 5 minutes, so 15 minutes of soak between schema-write
  and the breaking-change deploy is enough).

## Related code

- Cloud: `crates/medbrains-authz/src/backend_spicedb.rs`
- Edge: `crates/medbrains-edge/src/authz_cache.rs`
- Wire: `crates/medbrains-server/src/services/spicedb_watch.rs`
- Module: `infra/terraform/modules/spicedb/`
