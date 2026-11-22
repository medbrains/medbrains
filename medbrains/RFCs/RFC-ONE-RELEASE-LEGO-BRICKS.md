# RFC: One signed release for every hospital, bricks picked in core

**Status:** Plan (owner, 2026-11-22: top priority) · **Replaces:** the compile-time profile plan (SM2) in
`RFC-HOSPITAL-OS.md` · **Related:** `docs/architecture/MODULE-BRICKS.md`, `docs/SECURITY-RELEASE-PROCESS.md`

## The rule

There is **one signed release, and every hospital gets the same one**. We never build per hospital. A
hospital's modules are a list in its own database; core reads that list and snaps in those bricks.
Every brick is a Lego piece with the same studs, so the build, the tests, the release and the update
are made of the same pieces as the running app.

## The problem, measured (2026-11-22, release v3.35.5)

| What | Measured |
|---|---|
| PR CI for a 12-line header fix (Rust already skipped by path filters) | 7.5 min |
| PR E2E for the same fix: no rule covers `apps/web/src/**`, so all 12 projects ran, after a 7-10 min debug server build | 81 min |
| Slowest E2E shard, always the same one (one file takes 29 min) | 48-67 min, ideal ~36 |
| Release-branch push re-runs CI with no cache, and E2E with every project | 37-62 min, 65-110 min |
| `release.yml` on the tag: 9 binaries × 2 architectures, OS images, iOS, Android, desktop | 87 min |
| The web build, which is all the header fix changed | 1 min |
| Server tarball (x86-64) / `medbrains-server` ELF | 119 MB / 232 MB, 131 crates linked in |
| Bricks that can be switched off / permission groups that cannot | 26 / 34 |
| Route groups gated by brick in `routes/mod.rs` | 31 of 167 |
| Migrations / tables / cross-module foreign keys | 355 files / 1,072 / 1,633 |
| Idle memory and boot time with bricks off | never measured |

So a UI fix takes about two hours to reach a hospital, and a Registration + OPD hospital still downloads,
boots and runs all 67 modules.

## The studs: what every brick carries

| Stud | What it holds | Today |
|---|---|---|
| Manifest | name, version, the bricks it needs, the core version it fits | `BRICK_MANIFESTS` (generated), partial |
| Permissions | its codes, defined in Rust, granted to roles | done for the 26 bricks |
| Server part | its routes and background jobs, mounted only when on | jobs done (`BRICK_JOBS`); routes 31 of 167 gated |
| Data | its tables and seeds; seeds run when first switched on; data kept when off | tables always exist; seeding is not brick-aware |
| Screens | its web chunks and launcher tile | done: switched-off bricks' chunks are never fetched |
| Tests | its unit tests and its tagged E2E set | not tagged |
| Docs | its RFC, user-guide pages and SOPs | partial |

`scripts/check_bricks.py` grows into the check that refuses a brick missing a stud, so no brick ships
half-shaped.

## Three lanes

### Lane A: web-only patches (2-4 days, low risk)

A change that touches only screen files ships as a signed web bundle on the same release line, for
every hospital. The bundle states the server version it fits, and the installer refuses one that does not.

1. **Groundwork (first PR):** the web app reloads once when a lazy chunk fails to load
   (`vite:preloadError`), and an admin can see the server version beside the web build version.
2. **Asset retention:** install unpacks to a new tree, carries the previous `assets/` forward (hashed
   names never clash), and swaps in one rename; `.prev` stays for rollback. No restart, no migration.
3. **Scope gate:** a check refuses the lane if the diff from the base server tag touches anything
   outside `apps/web/src` screens, styles, locales and `apps/web/public`: never `packages/api`,
   generated types, crates, `.sqlx` or migrations.
4. **Workflow:** a `web-v*` tag builds only the web bundle with its manifest
   (`web_version`, `server_version`, `commit`, `sha256`), SHA256SUMS, cosign and provenance, into a draft.
   About 3 min instead of 87.
5. **Install command:** root-only, verifies cosign (exact identity) and sha256, checks the server
   version, swaps, records the install in the release history.

### Lane B: CI that runs what a change touches (1-3 days, low risk)

1. Refresh E2E timings, split `role-access.spec.ts`, rebalance the six shards (15-30 min off every run).
2. Fix the Rust cache key (include `Cargo.lock`, add restore keys).
3. Map E2E specs to bricks (tags) and run the touched bricks plus a smoke set; unknown paths still run all.
4. Reuse the compiled test server when no Rust changed.
5. Rust tests for changed crates and their reverse dependencies (`nextest` filtersets).
6. Safety net: the full suite runs nightly and on every release tag. A release is never cut from a
   partial run.

### Lane C: bricks picked in core (weeks, medium-high risk; in slices)

One binary with a brick registry in core: each brick declares its routes, jobs, permissions, screens,
seeds and dependencies. Core mounts and starts only the enabled ones.

1. **C1 measure first** (a few hours): idle RSS, boot time and wakeups with 2 bricks against all, on a
   small server. It tells us what the rest is worth.
2. **C2** gate every brick's route group (or build the router from enabled bricks only) (~1 week).
3. **C3** brick-aware, idempotent seeding: a brick's masters are seeded when it is first switched on (~1 week).
4. **C4** turn the 34 always-on groups into bricks with every stud, one group at a time (3-5 weeks).
5. Smaller downloads come from the dependency diet and delta updates (`zstd --patch-from`, verified
   against the signed full-file hash), never from per-brick binaries.

## What we avoid, and why

| Option | Why not |
|---|---|
| Per-hospital builds, or Cargo-feature profiles (SM2) | Breaks the one-release rule; multiplies the test matrix, signatures and support |
| A dynamic library per brick | Rust has no stable ABI; needs `unsafe`, breaks across compiler versions |
| A process per module | Too much memory for 67 modules on a 2 GB server |
| WASM for our own modules | Right later for untrusted vendor apps; needless cost for first-party code |
| Deleting data when a brick is switched off | Records must survive; only a rare, audited uninstall removes data |
| Splitting the migrations folder per brick now | 1,633 cross-module foreign keys; brick-aware seeding gets the benefit at far less risk |
| A release cut from a partial CI run | Releases always get the full suite |

## Safety additions

- **Monotonic release counter and expiry** in the signed manifest: the updater refuses a release older
  than the installed one (rollback attack) and one past its expiry (freeze attack). These are the two
  cheapest TUF protections; full TUF waits until vendors sign their own components.
- **Exact signer identity:** `cosign verify-blob` pins `--certificate-identity` to the release workflow
  and tag ref, with the GitHub OIDC issuer. Never `--certificate-identity-regexp`, which would accept
  branch builds.
- **Two append-only history tables:** `release_history` (release id, component digests, signer
  identity, installed at, by whom) and `brick_enablement_history` (brick, on or off, at, by whom,
  reason). They answer "what ran here, and what was switched on, on this date" for NABH audits,
  incident review and IEC 62304 configuration status accounting.
- **The update mechanism changes rarely, and alone:** a change to the installer or verifier never ships
  in the same release as other changes, because regulators treat it as a significant change.

## Decided 2026-11-22 (owner defaults, reversible)

| Question | Default |
|---|---|
| Who publishes a web patch? | The owner, exactly like a full release. No self-deploying patches. |
| May release-branch pushes skip the re-run of an identical tree? | Not yet: the release-branch re-run stays unchanged for now. |
| Tables for switched-off bricks | Every brick's tables always exist; only behaviour is gated. |
| SM2 compile-time profiles | Retired: they contradict the one-release rule. |

## Order and effort

| Step | Effort | Win |
|---|---|---|
| B1 rebalance E2E shards, fix the cache key | ½ day | 15-30 min off every run |
| A1 chunk-load recovery + server version on screen | ½ day | prerequisite for any web patch |
| A2-A5 retention, scope gate, `web-v*` workflow, install command, release counter, history table | 2-3 days | UI fixes reach a hospital in ~20 min |
| B2-B5 E2E and Rust tests scoped by change | 1-3 days | most PR checks in ~10 min |
| C1 measure 2 bricks against all | a few hours | sizes lane C |
| C2-C4 registry, gated routers, brick-aware seeding, the 34 groups | 3-5 weeks | a 2-brick hospital starts only 2 bricks |
