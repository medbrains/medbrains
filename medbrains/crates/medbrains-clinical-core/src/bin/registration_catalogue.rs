//! Writes the registration catalogue or its fixtures as JSON, for
//! `scripts/generate_registration_catalogue.py`.
//!
//! ```text
//! registration_catalogue catalogue   # steps, fields, options, rules
//! registration_catalogue fixtures    # drafts with the problems the rules find
//! ```

use std::io::Write;

use medbrains_clinical_core::registration::{catalogue_json, fixtures::fixtures_json};

fn main() -> std::io::Result<()> {
    let which = std::env::args().nth(1).unwrap_or_default();
    let json = match which.as_str() {
        "catalogue" => catalogue_json(),
        "fixtures" => fixtures_json(),
        _ => {
            return Err(std::io::Error::other(
                "usage: registration_catalogue catalogue|fixtures",
            ));
        }
    };
    std::io::stdout().lock().write_all(json.as_bytes())
}
