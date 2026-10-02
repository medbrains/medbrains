//! Where a punch was made, and whether that is on site.
//!
//! A facility's fence is a circle: its location and a radius. A punch
//! carries the device's fix and how accurate the device says it is. A fix
//! looser than [`MAX_ACCURACY_M`] cannot place anyone inside a fence, so it
//! is "imprecise" rather than in or out; a punch with no fix at all is
//! "no location". Whether a punch that is not inside is refused or only
//! flagged for HR is the hospital's [`GeofenceMode`].

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The loosest fix that can still say someone is on site, in metres. Indoor
/// GPS in a concrete building is often 30–80 m; Wi-Fi-only fixes run to
/// several hundred.
pub const MAX_ACCURACY_M: f64 = 150.0;
/// Mean Earth radius, metres (IUGG).
const EARTH_RADIUS_M: f64 = 6_371_008.8;

/// What a hospital does with a punch from outside its fences.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GeofenceMode {
    /// Locations are not asked for or checked.
    #[default]
    Off,
    /// The punch is kept and marked for HR to review.
    Flag,
    /// The punch is refused.
    Enforce,
}

/// A device's position at the punch.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Fix {
    pub latitude: f64,
    pub longitude: f64,
    /// The device's own estimate, metres.
    pub accuracy_m: f64,
}

/// A facility's fence.
#[derive(Clone, Debug, PartialEq)]
pub struct Fence {
    pub facility_id: Uuid,
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub radius_m: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PunchPlace {
    Inside,
    Outside,
    NoLocation,
    Imprecise,
    /// Geofencing is off, or no facility has a fence.
    NotChecked,
}

/// The verdict on a punch, kept with it.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct PunchCheck {
    pub place: PunchPlace,
    pub fix: Option<Fix>,
    /// The nearest fenced facility, when there was a fix to measure from.
    pub facility_id: Option<Uuid>,
    pub facility_name: Option<String>,
    pub distance_m: Option<f64>,
}

/// Great-circle distance in metres (haversine).
#[must_use]
pub fn distance_m(a: (f64, f64), b: (f64, f64)) -> f64 {
    let (lat1, lat2) = (a.0.to_radians(), b.0.to_radians());
    let (dlat, dlon) = ((b.0 - a.0).to_radians(), (b.1 - a.1).to_radians());
    let h = (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS_M * h.sqrt().asin()
}

fn usable(fix: &Fix) -> bool {
    (-90.0..=90.0).contains(&fix.latitude)
        && (-180.0..=180.0).contains(&fix.longitude)
        && fix.accuracy_m.is_finite()
        && fix.accuracy_m > 0.0
}

/// Where a punch stands against the fences.
#[must_use]
pub fn check_punch(fix: Option<Fix>, fences: &[Fence]) -> PunchCheck {
    let not = |place| PunchCheck {
        place,
        fix,
        facility_id: None,
        facility_name: None,
        distance_m: None,
    };
    if fences.is_empty() {
        return not(PunchPlace::NotChecked);
    }
    let Some(f) = fix.filter(usable) else {
        return not(PunchPlace::NoLocation);
    };
    let nearest = fences
        .iter()
        .map(|fence| {
            (
                fence,
                distance_m((f.latitude, f.longitude), (fence.latitude, fence.longitude)),
            )
        })
        .min_by(|a, b| a.1.total_cmp(&b.1));
    let Some((fence, d)) = nearest else {
        return not(PunchPlace::NotChecked);
    };
    let place = if f.accuracy_m > MAX_ACCURACY_M {
        PunchPlace::Imprecise
    } else if d <= fence.radius_m {
        PunchPlace::Inside
    } else {
        PunchPlace::Outside
    };
    PunchCheck {
        place,
        fix,
        facility_id: Some(fence.facility_id),
        facility_name: Some(fence.name.clone()),
        distance_m: Some(d),
    }
}

/// "6.0 km", "240 m".
#[must_use]
pub fn describe_distance(metres: f64) -> String {
    if metres >= 1000.0 {
        format!("{:.1} km", metres / 1000.0)
    } else {
        format!("{metres:.0} m")
    }
}

impl GeofenceMode {
    /// The words a refused punch gets — what is wrong and what to do — or
    /// `None` when this mode accepts the punch.
    #[must_use]
    pub fn refusal(self, check: &PunchCheck) -> Option<String> {
        if self != Self::Enforce {
            return None;
        }
        match check.place {
            PunchPlace::Inside | PunchPlace::NotChecked => None,
            PunchPlace::NoLocation => Some(
                "Allow location access to clock in — this hospital checks that shifts start on site."
                    .to_owned(),
            ),
            PunchPlace::Imprecise => Some(format!(
                "Your location is too approximate (±{}) to confirm you are on site. \
                 Move near a window or outside and try again.",
                describe_distance(check.fix.map_or(0.0, |f| f.accuracy_m))
            )),
            PunchPlace::Outside => Some(format!(
                "You are {} from {}. Clock in on site.",
                describe_distance(check.distance_m.unwrap_or_default()),
                check.facility_name.as_deref().unwrap_or("the hospital")
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Fence, Fix, GeofenceMode, PunchPlace, check_punch, describe_distance, distance_m};
    use uuid::Uuid;

    fn fence() -> Fence {
        // Sunrise Hospital, Chennai.
        Fence {
            facility_id: Uuid::nil(),
            name: "Sunrise Hospital".to_owned(),
            latitude: 13.0827,
            longitude: 80.2707,
            radius_m: 300.0,
        }
    }

    fn fix(latitude: f64, longitude: f64, accuracy_m: f64) -> Option<Fix> {
        Some(Fix {
            latitude,
            longitude,
            accuracy_m,
        })
    }

    #[test]
    fn a_degree_of_latitude_is_about_111_km() {
        let d = distance_m((13.0, 80.0), (14.0, 80.0));
        assert!((d - 111_195.0).abs() < 50.0, "{d}");
    }

    #[test]
    fn a_punch_within_the_radius_is_inside() {
        // ~40 m north of the centre.
        let check = check_punch(fix(13.08306, 80.2707, 20.0), &[fence()]);
        assert_eq!(check.place, PunchPlace::Inside);
        assert_eq!(GeofenceMode::Enforce.refusal(&check), None);
    }

    #[test]
    fn a_punch_from_home_is_outside_and_enforce_says_how_far() {
        // ~6 km south.
        let check = check_punch(fix(13.0287, 80.2707, 15.0), &[fence()]);
        assert_eq!(check.place, PunchPlace::Outside);
        assert_eq!(
            GeofenceMode::Enforce.refusal(&check).as_deref(),
            Some("You are 6.0 km from Sunrise Hospital. Clock in on site.")
        );
        assert_eq!(
            GeofenceMode::Flag.refusal(&check),
            None,
            "flag keeps the punch for HR"
        );
    }

    #[test]
    fn a_loose_fix_cannot_say_inside_and_no_fix_is_no_location() {
        let loose = check_punch(fix(13.0827, 80.2707, 900.0), &[fence()]);
        assert_eq!(loose.place, PunchPlace::Imprecise, "even at the centre");
        assert_eq!(check_punch(None, &[fence()]).place, PunchPlace::NoLocation);
        assert_eq!(
            check_punch(fix(95.0, 80.0, 10.0), &[fence()]).place,
            PunchPlace::NoLocation
        );
    }

    #[test]
    fn without_fences_nothing_is_checked() {
        let check = check_punch(fix(13.0287, 80.2707, 15.0), &[]);
        assert_eq!(check.place, PunchPlace::NotChecked);
        assert_eq!(GeofenceMode::Enforce.refusal(&check), None);
    }

    #[test]
    fn distances_read_in_the_unit_people_use() {
        assert_eq!(describe_distance(240.4), "240 m");
        assert_eq!(describe_distance(6042.0), "6.0 km");
    }
}
