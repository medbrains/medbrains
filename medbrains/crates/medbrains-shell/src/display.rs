//! Picks the display's scale. On a high-density screen an unscaled desktop is tiny, and in a VM
//! the host then blurs it. `cage` has no scale option of its own, but it speaks
//! wlr-output-management, so `wlr-randr` can set one before GTK draws anything.

use gtk4::glib;

use crate::child;

/// Above this density a screen gets double scale, and above the lower one, one and a half.
const DOUBLE_PPI: f64 = 180.0;
const ONE_AND_HALF_PPI: f64 = 140.0;
/// Where the density is unknown, a width this large can only be a high-density panel.
const DOUBLE_WIDTH_UNKNOWN_SIZE: u32 = 2880;
/// The desktop's layout needs this much logical width, so scale never goes below it.
const MIN_LOGICAL_WIDTH: f64 = 1280.0;
const MM_PER_INCH: f64 = 25.4;

/// The display as `wlr-randr` reports it.
#[derive(Debug, PartialEq)]
struct Output {
    name: String,
    width_px: u32,
    width_mm: u32,
}

/// Reads the first enabled output from `wlr-randr`'s text.
fn parse_outputs(text: &str) -> Option<Output> {
    let name = text.lines().next()?.split_whitespace().next()?.to_owned();
    let width_mm = text
        .lines()
        .find_map(|line| line.trim().strip_prefix("Physical size: "))
        .and_then(|size| size.split('x').next()?.parse().ok())
        .unwrap_or(0);
    let width_px = text
        .lines()
        .find(|line| line.contains("current"))
        .and_then(|line| line.trim().split('x').next()?.parse().ok())?;
    Some(Output {
        name,
        width_px,
        width_mm,
    })
}

/// The scale for a display.
fn scale_for(width_px: u32, width_mm: u32) -> f64 {
    let wanted: f64 = if width_mm > 0 {
        let ppi = f64::from(width_px) / (f64::from(width_mm) / MM_PER_INCH);
        if ppi >= DOUBLE_PPI {
            2.0
        } else if ppi >= ONE_AND_HALF_PPI {
            1.5
        } else {
            1.0
        }
    } else if width_px >= DOUBLE_WIDTH_UNKNOWN_SIZE {
        2.0
    } else {
        1.0
    };
    wanted.min(f64::from(width_px) / MIN_LOGICAL_WIDTH).max(1.0)
}

/// Sets the scale. Failing leaves a sharp but small desktop, so it is logged and not fatal.
pub(crate) fn set_scale() {
    let Some(listing) = child::run("wlr-randr", &[], child::USUAL_LIMIT) else {
        glib::g_warning!(
            "medbrains-shell",
            "wlr-randr did not run; leaving the scale alone"
        );
        return;
    };
    let Some(output) = parse_outputs(&String::from_utf8_lossy(&listing.stdout)) else {
        return;
    };
    let scale = scale_for(output.width_px, output.width_mm);
    glib::g_message!(
        "medbrains-shell",
        "display {}: {} px, {} mm wide, scale {scale}",
        output.name,
        output.width_px,
        output.width_mm
    );
    if scale > 1.0 {
        let scale = scale.to_string();
        let args = ["--output", output.name.as_str(), "--scale", scale.as_str()];
        let done = child::run("wlr-randr", &args, child::USUAL_LIMIT);
        if !done.is_some_and(|done| done.success) {
            glib::g_warning!("medbrains-shell", "could not set the display's scale");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Output, parse_outputs, scale_for};

    #[test]
    fn the_output_is_read_from_wlr_randr() {
        let text = "Virtual-1 \"Red Hat, Inc. QEMU Monitor\"\n  Physical size: 0x0 mm\n  Enabled: yes\n  Modes:\n    1024x768 px, 75.000000 Hz\n    2880x1800 px, 75.000000 Hz (preferred, current)\n";
        let wanted = Output {
            name: "Virtual-1".to_owned(),
            width_px: 2880,
            width_mm: 0,
        };
        assert_eq!(parse_outputs(text), Some(wanted));
        assert_eq!(parse_outputs(""), None);
    }

    #[test]
    fn density_decides_the_scale_and_small_screens_stay_at_one() {
        assert_eq!(scale_for(1366, 0), 1.0);
        assert_eq!(scale_for(1280, 0), 1.0);
        assert_eq!(scale_for(1920, 0), 1.0);
        assert_eq!(scale_for(1920, 510), 1.0);
        assert_eq!(scale_for(2880, 0), 2.0);
        assert_eq!(scale_for(2880, 340), 2.0);
        assert_eq!(scale_for(3840, 600), 1.5);
        assert_eq!(scale_for(1920, 280), 1.5);
    }
}
