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

Also: a `pub use` is a **re-export** other crates may rely on. Removing it
breaks them silently at their call sites, not here — keep it pointing at the new
crate (`pub use medbrains_authz_gate as authz_patient;`) unless every consumer
is updated in the same pass.

## The assertions that would have caught all three

    grep -c "crate::"        <moved file>          # must be 0
    grep -rn "<module_name>" crates --include=*.rs # only comments should remain
    cargo check -p <the crate that re-exports it>  # catches grouped-use breakage

Comments referencing the old path are harmless but should move too — a comment
pointing at a crate that no longer holds the code is a small lie that costs the
next reader real time.
