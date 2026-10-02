//! Where on the body — shared by every record that carries a body site.

use serde::{Deserialize, Serialize};

/// Which side a body site is on. Stored as its lowercase name; the columns
/// carry a CHECK with the same four values.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Laterality {
    Left,
    Right,
    Bilateral,
    Midline,
}

impl Laterality {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Left => "left",
            Self::Right => "right",
            Self::Bilateral => "bilateral",
            Self::Midline => "midline",
        }
    }
}
