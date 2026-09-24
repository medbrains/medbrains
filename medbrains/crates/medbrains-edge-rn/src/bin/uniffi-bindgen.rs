//! The UniFFI binding generator for this crate's UDL: emits the Swift and
//! Kotlin packages the native apps import. Run from the workspace root:
//!
//! `cargo run -p medbrains-edge-rn --bin uniffi-bindgen -- generate
//!     --library target/<triple>/release/libmedbrains_edge_rn.dylib
//!     --language swift --out-dir apps/ios/Packages/MedBrainsCore/Generated`
fn main() {
    uniffi::uniffi_bindgen_main();
}
