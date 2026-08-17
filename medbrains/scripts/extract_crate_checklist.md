# Moving a module out of a crate — the three reference forms

Written after `authz_patient` broke twice on the same move. Each failure was a
reference form the previous pass could not see.

1. **Qualified external** — `medbrains_server_core::authz_patient::foo()`
   Found by a name grep. This is the obvious one, and the only one I did first.

2. **Internal `crate::`** — `crate::middleware::authorization::authz_context()`
   *Inside the moved file.* Invisible to a name grep precisely because it does
   not name the crate; `crate::` silently re-points at the new crate the moment
   the file changes home. Rewrite each to the old crate's name.

3. **Grouped `use`** — `pub use medbrains_server_core::{a, authz_patient, b};`
   The path is split across braces, so `medbrains_server_core::authz_patient`
   never appears as a contiguous string. Search for the bare module name inside
   `use ... { ... }` blocks.

   **Two shapes, and the second defeats naive regex.** A bare entry
   (`notifications,`) is easy. A *nested* entry is not:

       use medbrains_server_core::{
           error::AppError,
           middleware::{ auth::Claims, authorization::{...} },   <- nested
           notifications::{NewNotification, create_notification},
           state::AppState,
       };

   `\{[^}]*?notifications` stops dead at the first `}` of the nested group and
   reports no match — which is exactly what happened, and the build found it
   instead. **Regex cannot parse nested braces.** Walk the block counting depth
   from the opening `{` until it returns to zero, then search inside it.

Also: a `pub use` is a **re-export** other crates may rely on. Removing it
breaks them silently at their call sites, not here — keep it pointing at the new
crate (`pub use medbrains_authz_gate as authz_patient;`) unless every consumer
is updated in the same pass.

4. **A re-export chain that hides the crate name.**
   `medbrains-server` had `pub use medbrains_server_core::notifications;`, so
   downstream code says `crate::routes::notifications::…` — which mentions
   neither the old crate nor the new one. Invisible to every grep above; only
   the compiler finds it.

   Worse, the naive rewrite makes it *silently wrong*:

       pub use medbrains_server_core::notifications;   ->
       pub use medbrains_notifications;                 <- renames the export!

   The module was exported as `notifications`; now it is exported as
   `medbrains_notifications`, and every `routes::notifications::…` breaks.
   **Preserve the exported name:** `pub use medbrains_notifications as
   notifications;`. The same latent bug was sitting in the nabh move and
   compiled only because nothing happened to reference `routes::nabh_evidence`.

5. **Missing dependencies** — not a reference problem at all.
   The moved code uses crates the *old* crate declared and the new one does
   not: `medbrains_crypto`, `reqwest`, `url`. Nothing in the source changes,
   so no rewrite pass can find it — the file is correct and simply cannot
   resolve its imports.

   `nabh_evidence` survived this only because I happened to read its imports
   first and it needed just sqlx + uuid. That was luck, not method.

   Extract every `foo::` prefix from the moved file, drop the std/self/crate
   noise, and diff against the new crate's `[dependencies]`:

       grep -oE '\b[a-z][a-z0-9_]{2,}::' <moved file> | sort -u
       # then copy each missing one from the OLD crate's Cargo.toml,
       # preserving `workspace = true` or the path — never re-invent the version

## The assertions that would have caught all four

    grep -c "crate::"        <moved file>          # must be 0
    grep -rn "<module_name>" crates --include=*.rs # only comments should remain
    cargo check -p <the crate that re-exports it>  # catches grouped-use breakage
    cargo check -p <the new crate>                 # catches missing dependencies

The last one is the only check that finds form 4, and it is the cheapest of
the four to run — check the new crate alone before wiring up any consumers.

Comments referencing the old path are harmless but should move too — a comment
pointing at a crate that no longer holds the code is a small lie that costs the
next reader real time.
