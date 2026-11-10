//! The editor is embedded from `editor-ui/dist` at compile time. Create the
//! directory when it is missing so the server still builds in a fresh clone
//! that has not run `npm run build` yet.

use std::path::Path;

fn main() {
    let dist = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../editor-ui/dist");
    if !dist.exists() {
        let _ = std::fs::create_dir_all(&dist);
    }
    println!("cargo:rerun-if-changed=../../editor-ui/dist");
}
