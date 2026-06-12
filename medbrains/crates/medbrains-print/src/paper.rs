//! Paper geometry. Gotenberg takes inches; templates speak millimetres.

const MM_PER_INCH: f64 = 25.4;

#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum Paper {
    A4,
    A5,
    /// 80 mm thermal roll — height grows with content.
    Thermal80 {
        height_mm: f64,
    },
    /// Pharmacy/specimen label.
    Label50x25,
    /// Patient wristband strip.
    Wristband25x280,
    Custom {
        width_mm: f64,
        height_mm: f64,
    },
}

impl Paper {
    /// (width, height) in millimetres.
    #[must_use]
    pub fn size_mm(&self) -> (f64, f64) {
        match self {
            Self::A4 => (210.0, 297.0),
            Self::A5 => (148.0, 210.0),
            Self::Thermal80 { height_mm } => (80.0, height_mm.max(40.0)),
            Self::Label50x25 => (50.0, 25.0),
            Self::Wristband25x280 => (280.0, 25.0),
            Self::Custom {
                width_mm,
                height_mm,
            } => (*width_mm, *height_mm),
        }
    }

    /// (width, height) in inches — Gotenberg's unit.
    #[must_use]
    pub fn size_inches(&self) -> (f64, f64) {
        let (w, h) = self.size_mm();
        (w / MM_PER_INCH, h / MM_PER_INCH)
    }
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct MarginsMm {
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
    pub left: f64,
}

impl Default for MarginsMm {
    fn default() -> Self {
        Self {
            top: 12.0,
            right: 12.0,
            bottom: 12.0,
            left: 12.0,
        }
    }
}

impl MarginsMm {
    /// Edge-to-edge — labels and wristbands.
    #[must_use]
    pub const fn zero() -> Self {
        Self {
            top: 0.0,
            right: 0.0,
            bottom: 0.0,
            left: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a4_inches_round_trip() {
        let (w, h) = Paper::A4.size_inches();
        assert!((w - 8.267).abs() < 0.01);
        assert!((h - 11.69).abs() < 0.01);
    }

    #[test]
    fn label_size() {
        assert_eq!(Paper::Label50x25.size_mm(), (50.0, 25.0));
    }
}
