//! Every permission code, as one list, read from `permissions.rs` itself.
//!
//! The constants are typed paths (`permissions::opd::queue::LIST`), which is
//! right for handlers and gives no way to ask "every code in module `opd`".
//! A grant scoped to modules needs exactly that question answered on the
//! server, so the codes are taken from the source file the compiler already
//! checked — the same file `scripts/generate_permissions_ts.py` reads, so the
//! web catalogue and this list cannot disagree.

use std::sync::LazyLock;

/// The source of the constants, embedded at compile time.
const SOURCE: &str = include_str!("../permissions.rs");

/// Every code, sorted and without duplicates.
static CODES: LazyLock<Vec<&'static str>> = LazyLock::new(|| {
    let mut codes: Vec<&'static str> = SOURCE.lines().filter_map(code_on_line).collect();
    codes.sort_unstable();
    codes.dedup();
    codes
});

/// The code a `pub const NAME: &str = "a.b";` line declares, if it is one.
fn code_on_line(line: &'static str) -> Option<&'static str> {
    let rest = line.trim_start().strip_prefix("pub const ")?;
    let (_, value) = rest.split_once(": &str = \"")?;
    let code = value.strip_suffix("\";")?;
    code.contains('.').then_some(code)
}

/// Every permission code the server defines.
#[must_use]
pub fn all_codes() -> &'static [&'static str] {
    &CODES
}

/// The module a code belongs to: the part before the first dot.
#[must_use]
pub fn module_of(code: &str) -> &str {
    code.split_once('.').map_or(code, |(module, _)| module)
}

#[cfg(test)]
mod tests {
    use super::{all_codes, module_of};
    use crate::permissions;

    /// The list is the constants: known ones are in it, and it is not a stub.
    #[test]
    fn the_list_holds_the_real_constants() {
        let codes = all_codes();
        assert!(codes.len() > 1000, "only {} codes read", codes.len());
        assert!(codes.contains(&permissions::opd::queue::LIST));
        assert!(codes.contains(&permissions::security::vendor_access::GRANT));
        assert!(codes.iter().all(|c| c.contains('.') && !c.contains(' ')));
    }

    #[test]
    fn a_module_is_the_first_segment() {
        assert_eq!(module_of("admin.users.create"), "admin");
        assert_eq!(module_of("dashboard"), "dashboard");
    }
}
