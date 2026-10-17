//! What an eye exam may record, and what a spectacle prescription needs
//! before it can be signed (#231). Ranges are the trial-lens set's: sphere
//! ±30 D and cylinder ±10 D in quarter-dioptre steps, axis 1–180° and only
//! with a cylinder, near add +0.25 to +4.00 D.

use rust_decimal::Decimal;
use serde::Deserialize;

/// The workup a clinician records; every field optional while in draft.
#[derive(Debug, Default, Deserialize)]
pub struct Workup {
    pub visual_acuity_od: Option<String>,
    pub visual_acuity_os: Option<String>,
    pub bcva_od: Option<String>,
    pub bcva_os: Option<String>,
    pub near_va_od: Option<String>,
    pub near_va_os: Option<String>,
    pub sphere_od: Option<Decimal>,
    pub sphere_os: Option<Decimal>,
    pub cylinder_od: Option<Decimal>,
    pub cylinder_os: Option<Decimal>,
    pub axis_od: Option<i16>,
    pub axis_os: Option<i16>,
    pub add_od: Option<Decimal>,
    pub add_os: Option<Decimal>,
    pub iop_od: Option<Decimal>,
    pub iop_os: Option<Decimal>,
    pub pd_mm: Option<Decimal>,
    pub lens_type: Option<String>,
    pub lens_advice: Option<String>,
    pub review_after_months: Option<i16>,
    pub slit_lamp: Option<String>,
    pub fundus: Option<String>,
    pub diagnosis: Option<String>,
    pub plan: Option<String>,
}

const LENS_TYPES: [&str; 4] = ["single_vision", "bifocal", "progressive", "none"];
/// Snellen `6/9`, `LogMAR` `0.2`, near `N6`, or `CF` / `HM` / `PL` / `NPL`.
const MAX_ACUITY_LEN: usize = 20;

fn quarter_step(v: Decimal) -> bool {
    (v * Decimal::from(4)).fract().is_zero()
}

fn in_range(v: Decimal, lo: i64, hi: i64) -> bool {
    v >= Decimal::from(lo) && v <= Decimal::from(hi)
}

fn check_eye(
    eye: &str,
    sphere: Option<Decimal>,
    cyl: Option<Decimal>,
    axis: Option<i16>,
    add: Option<Decimal>,
) -> Result<(), String> {
    if let Some(s) = sphere
        && !(in_range(s, -30, 30) && quarter_step(s))
    {
        return Err(format!("{eye} sphere must be −30 to +30 in 0.25 steps"));
    }
    let has_cyl = cyl.is_some_and(|c| !c.is_zero());
    if let Some(c) = cyl
        && !(in_range(c, -10, 10) && quarter_step(c))
    {
        return Err(format!("{eye} cylinder must be −10 to +10 in 0.25 steps"));
    }
    match (has_cyl, axis) {
        (true, None) => return Err(format!("{eye} axis is needed with a cylinder")),
        (true, Some(a)) if !(1..=180).contains(&a) => {
            return Err(format!("{eye} axis must be 1 to 180°"));
        }
        (false, Some(_)) => return Err(format!("{eye} axis given without a cylinder")),
        _ => {}
    }
    if let Some(a) = add
        && !(a > Decimal::ZERO && a <= Decimal::from(4) && quarter_step(a))
    {
        return Err(format!(
            "{eye} near add must be +0.25 to +4.00 in 0.25 steps"
        ));
    }
    Ok(())
}

/// Reject values no trial frame or tonometer produces.
pub fn validate(w: &Workup) -> Result<(), String> {
    check_eye("Right eye", w.sphere_od, w.cylinder_od, w.axis_od, w.add_od)?;
    check_eye("Left eye", w.sphere_os, w.cylinder_os, w.axis_os, w.add_os)?;
    for iop in [w.iop_od, w.iop_os].into_iter().flatten() {
        if !in_range(iop, 0, 80) {
            return Err("IOP must be 0 to 80 mmHg".to_owned());
        }
    }
    if let Some(pd) = w.pd_mm
        && !in_range(pd, 40, 80)
    {
        return Err("Pupillary distance must be 40 to 80 mm".to_owned());
    }
    if let Some(t) = w.lens_type.as_deref()
        && !LENS_TYPES.contains(&t)
    {
        return Err(format!("Unknown lens type '{t}'"));
    }
    if let Some(m) = w.review_after_months
        && !(1..=60).contains(&m)
    {
        return Err("Review must be 1 to 60 months".to_owned());
    }
    let acuities = [
        &w.visual_acuity_od,
        &w.visual_acuity_os,
        &w.bcva_od,
        &w.bcva_os,
        &w.near_va_od,
        &w.near_va_os,
    ];
    if acuities
        .iter()
        .filter_map(|a| a.as_deref())
        .any(|a| a.trim().len() > MAX_ACUITY_LEN)
    {
        return Err("Visual acuity is a short value such as 6/9, N6 or CF".to_owned());
    }
    Ok(())
}

/// What still stops a signature: a prescription states the lens for both
/// eyes, the distance between the pupils for the optician, and the lens kind.
/// "No glasses needed" (`none`) signs with no refraction.
pub fn ready_to_sign(
    lens_type: Option<&str>,
    sphere: (Option<Decimal>, Option<Decimal>),
    pd_mm: Option<Decimal>,
    add: (Option<Decimal>, Option<Decimal>),
) -> Result<(), String> {
    match lens_type {
        None => Err("Choose the lens type (or no glasses needed) before signing".to_owned()),
        Some("none") => Ok(()),
        Some(kind) => {
            if sphere.0.is_none() || sphere.1.is_none() {
                return Err(
                    "Record the sphere for both eyes before signing (0.00 for plano)".to_owned(),
                );
            }
            if pd_mm.is_none() {
                return Err("Record the pupillary distance before signing".to_owned());
            }
            if kind != "single_vision" && (add.0.is_none() || add.1.is_none()) {
                return Err(
                    "A bifocal or progressive prescription needs the near add for both eyes"
                        .to_owned(),
                );
            }
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> Decimal {
        s.parse().unwrap_or_default()
    }

    fn rx() -> Workup {
        Workup {
            sphere_od: Some(d("-1.25")),
            sphere_os: Some(d("-1.50")),
            cylinder_od: Some(d("-0.50")),
            axis_od: Some(180),
            add_od: Some(d("1.50")),
            add_os: Some(d("1.50")),
            pd_mm: Some(d("63")),
            ..Workup::default()
        }
    }

    #[test]
    fn a_normal_refraction_passes() {
        assert_eq!(validate(&rx()), Ok(()));
    }

    #[test]
    fn values_off_the_trial_set_are_refused() {
        let off = |f: fn(&mut Workup)| {
            let mut w = rx();
            f(&mut w);
            validate(&w).unwrap_err()
        };
        assert!(off(|w| w.sphere_od = Some(d("-1.30"))).contains("0.25 steps"));
        assert!(off(|w| w.sphere_os = Some(d("31"))).contains("sphere"));
        assert!(off(|w| w.axis_od = None).contains("axis is needed"));
        assert!(off(|w| w.axis_od = Some(181)).contains("1 to 180"));
        assert!(off(|w| w.axis_os = Some(90)).contains("without a cylinder"));
        assert!(off(|w| w.add_od = Some(d("4.25"))).contains("near add"));
        assert!(off(|w| w.iop_od = Some(d("95"))).contains("IOP"));
        assert!(off(|w| w.pd_mm = Some(d("90"))).contains("Pupillary"));
        assert!(off(|w| w.lens_type = Some("contact".into())).contains("lens type"));
    }

    #[test]
    fn signing_needs_what_the_optician_will_read() {
        let (s, a) = (
            (Some(d("-1")), Some(d("-1"))),
            (Some(d("1.5")), Some(d("1.5"))),
        );
        assert!(ready_to_sign(None, s, Some(d("63")), a).is_err());
        assert!(ready_to_sign(Some("none"), (None, None), None, (None, None)).is_ok());
        assert!(
            ready_to_sign(
                Some("single_vision"),
                (Some(d("-1")), None),
                Some(d("63")),
                a
            )
            .is_err()
        );
        assert!(ready_to_sign(Some("single_vision"), s, None, a).is_err());
        assert!(
            ready_to_sign(
                Some("progressive"),
                s,
                Some(d("63")),
                (Some(d("1.5")), None)
            )
            .is_err()
        );
        assert!(ready_to_sign(Some("progressive"), s, Some(d("63")), a).is_ok());
        assert!(ready_to_sign(Some("single_vision"), s, Some(d("63")), (None, None)).is_ok());
    }
}
