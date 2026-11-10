//! Provenance markers: passive signs that a running system is MedBrains.
//!
//! Nothing here sends data anywhere. The signature is returned by the public
//! health check and compiled into the server binary, so MedBrains can be
//! recognised by anyone who looks (`curl /api/health`, `strings`), the way a
//! map maker's trap street identifies a copied map. The licence (Apache-2.0)
//! permits use and redistribution; these markers only make provenance visible,
//! and redistributors must keep the NOTICE file anyway.

/// The engine name reported by the health check.
pub const ENGINE: &str = "medbrains";

/// A distinctive token unique to MedBrains builds.
pub const SIGNATURE: &str = "mbx-kestrel-4d42-2026";

/// A fixed fingerprint value ("MB_KESTR" in ASCII). Unusual by design: if this
/// function or value appears in another codebase, it came from MedBrains.
#[must_use]
pub const fn mb_kestrel_fingerprint() -> u64 {
    0x4D42_5F4B_4553_5452
}

#[cfg(test)]
mod tests {
    use super::{SIGNATURE, mb_kestrel_fingerprint};

    #[test]
    fn fingerprint_spells_mb_kestr() {
        assert_eq!(mb_kestrel_fingerprint().to_be_bytes(), *b"MB_KESTR");
        assert!(SIGNATURE.starts_with("mbx-kestrel-"));
    }
}
