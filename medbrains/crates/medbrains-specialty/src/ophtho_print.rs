//! The spectacle prescription on paper (#231): distance and near lens for
//! each eye in the form an optician reads, the pupillary distance and lens
//! advised, and the prescriber's name, qualification and registration. An
//! unsigned exam prints, but as a DRAFT.

use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;

use crate::specialty_ophtho::load_exam;

/// A lens power as written on a prescription: signed, two places, plano at zero.
fn power(v: Option<Decimal>) -> String {
    match v {
        None => String::new(),
        Some(p) if p.is_zero() => "Plano".to_owned(),
        Some(p) if p > Decimal::ZERO => format!("+{p:.2}"),
        Some(p) => format!("−{:.2}", p.abs()),
    }
}

/// One eye as recorded: sphere, cylinder, axis, near add; distance and near acuity.
#[derive(Clone, Copy)]
struct Eye<'a> {
    sphere: Option<Decimal>,
    cyl: Option<Decimal>,
    axis: Option<i16>,
    add: Option<Decimal>,
    va: (Option<&'a str>, Option<&'a str>),
}

/// One eye's two rows: distance, and near (sphere plus the add) when there is one.
fn eye(label: &str, e: &Eye<'_>) -> Value {
    let Eye {
        sphere,
        cyl,
        axis,
        add,
        va,
    } = *e;
    let cylinder = cyl.filter(|c| !c.is_zero());
    let axis = cylinder
        .and(axis)
        .map(|a| format!("{a}°"))
        .unwrap_or_default();
    let near = add.map(|a| {
        json!({
            "sphere": power(Some(sphere.unwrap_or_default() + a)),
            "cylinder": power(cylinder), "axis": axis, "va": va.1.unwrap_or_default(), "add": power(Some(a)),
        })
    });
    json!({
        "label": label,
        "distance": { "sphere": power(sphere), "cylinder": power(cylinder), "axis": axis, "va": va.0.unwrap_or_default() },
        "near": near,
    })
}

#[derive(sqlx::FromRow)]
struct People {
    patient_name: String,
    uhid: String,
    gender: Option<String>,
    date_of_birth: Option<chrono::NaiveDate>,
    signer_name: Option<String>,
    qualification: Option<String>,
    registration: Option<String>,
}

/// The template context for `spectacle_prescription`.
pub async fn spectacle_rx_context(
    state: &AppState,
    claims: &Claims,
    exam_id: Uuid,
) -> Result<Value, AppError> {
    let exam = load_exam(state, claims, exam_id).await?;
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let people = sqlx::query_as::<_, People>(
        "SELECT concat_ws(' ', p.first_name, p.last_name) AS patient_name, p.uhid, p.gender::text AS gender, \
                p.date_of_birth, u.full_name AS signer_name, u.qualification, \
                u.medical_registration_number AS registration \
           FROM patients p LEFT JOIN users u ON u.id = $3 \
          WHERE p.id = $1 AND p.tenant_id = $2",
    )
    .bind(exam.patient_id)
    .bind(claims.tenant_id)
    .bind(exam.signed_by)
    .fetch_one(&mut *conn)
    .await?;
    let age = people.date_of_birth.map(|dob| {
        let today = chrono::Utc::now().date_naive();
        format!("{}y", today.years_since(dob).unwrap_or_default())
    });
    let signed = exam.signed_at.map(|at| {
        json!({
            "name": people.signer_name, "qualification": people.qualification,
            "registration": people.registration, "at": at.format("%d %b %Y %H:%M UTC").to_string(),
        })
    });
    let right = Eye {
        sphere: exam.sphere_od,
        cyl: exam.cylinder_od,
        axis: exam.axis_od,
        add: exam.add_od,
        va: (exam.bcva_od.as_deref(), exam.near_va_od.as_deref()),
    };
    let left = Eye {
        sphere: exam.sphere_os,
        cyl: exam.cylinder_os,
        axis: exam.axis_os,
        add: exam.add_os,
        va: (exam.bcva_os.as_deref(), exam.near_va_os.as_deref()),
    };
    let review = exam.review_after_months.map(|m| format!("{m} months"));
    let mut context = json!({
        "rx": {
            "patient_name": people.patient_name, "uhid": people.uhid, "gender": people.gender, "age": age,
            "date": exam.examined_at.unwrap_or(exam.created_at).format("%d %b %Y").to_string(),
            "eyes": [eye("Right (OD)", &right), eye("Left (OS)", &left)],
            "pd_mm": exam.pd_mm.map(|p| p.normalize().to_string()),
            "lens_type": exam.lens_type.as_deref().map(|t| t.replace('_', " ")),
            "no_glasses": exam.lens_type.as_deref() == Some("none"),
            "lens_advice": exam.lens_advice, "diagnosis": exam.diagnosis, "review": review,
            "signed": signed,
        },
    });
    // No signature list on a signed Rx (its block is the prescriber's own);
    // an empty one on an unsigned Rx, which the renderer marks DRAFT.
    if exam.signed_at.is_none()
        && let Some(obj) = context.as_object_mut()
    {
        obj.insert("signatures".to_owned(), json!([]));
    }
    Ok(context)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> Option<Decimal> {
        s.parse().ok()
    }

    #[test]
    fn powers_print_the_way_opticians_write_them() {
        assert_eq!(power(d("-1.25")), "−1.25");
        assert_eq!(power(d("2")), "+2.00");
        assert_eq!(power(d("0")), "Plano");
        assert_eq!(power(None), "");
    }

    #[test]
    fn the_near_row_is_the_distance_sphere_plus_the_add() {
        let e = eye(
            "Right",
            &Eye {
                sphere: d("-1.00"),
                cyl: d("-0.50"),
                axis: Some(180),
                add: d("2.00"),
                va: (Some("6/6"), Some("N6")),
            },
        );
        assert_eq!(e["distance"]["sphere"], "−1.00");
        assert_eq!(e["distance"]["axis"], "180°");
        assert_eq!(e["near"]["sphere"], "+1.00");
        assert_eq!(e["near"]["va"], "N6");
        let plain = eye(
            "Left",
            &Eye {
                sphere: d("0"),
                cyl: d("0"),
                axis: None,
                add: None,
                va: (None, None),
            },
        );
        assert_eq!(plain["distance"]["cylinder"], "");
        assert!(plain["near"].is_null());
    }
}
