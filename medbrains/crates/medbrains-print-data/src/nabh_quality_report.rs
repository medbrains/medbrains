//! Print data for the NABH quality indicators report.
//!
//! The latest recorded value per indicator in the period, each marked met or not
//! met in its own direction (#6021). The report goes to accreditation assessors.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_core::print_data::{NabhQualityReportPrintData, QualityIndicator, QualitySummary};
use medbrains_core::quality_target::{IndicatorDirection, TargetStatus};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::regulatory::period_bounds;

struct QualityIndicatorRow {
    indicator_code: String,
    indicator_name: String,
    category: String,
    numerator: Option<i32>,
    denominator: Option<i32>,
    rate: f64,
    benchmark: Option<f64>,
    target: Option<f64>,
    direction: Option<IndicatorDirection>,
}

impl QualityIndicatorRow {
    /// The printed row. "Met" follows the indicator's direction, so a fall rate
    /// above its target prints as not met.
    fn into_print(self) -> QualityIndicator {
        let status = TargetStatus::of(self.direction, self.rate, self.target);
        QualityIndicator {
            indicator_code: self.indicator_code,
            indicator_name: self.indicator_name,
            category: self.category,
            numerator: self.numerator,
            denominator: self.denominator,
            rate: self.rate,
            benchmark: self.benchmark,
            status: status.code().to_owned(),
        }
    }
}

/// Counts the printed rows per status for the report's summary box.
fn summarise(indicators: &[QualityIndicator]) -> QualitySummary {
    let count = |status: TargetStatus| {
        let n = indicators
            .iter()
            .filter(|i| i.status == status.code())
            .count();
        i32::try_from(n).unwrap_or(i32::MAX)
    };
    QualitySummary {
        total_indicators: i32::try_from(indicators.len()).unwrap_or(i32::MAX),
        met_benchmark: count(TargetStatus::Met),
        not_met: count(TargetStatus::NotMet),
        not_applicable: count(TargetStatus::NotApplicable),
        direction_not_set: count(TargetStatus::DirectionNotSet),
    }
}

/// Latest `quality_indicator_values` row per indicator inside the period, each
/// marked met or not met in its own direction.
pub async fn get_nabh_quality_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<NabhQualityReportPrintData>, AppError> {
    require_permission(&claims, permissions::quality::indicators::LIST)?;
    let (start, end) = period_bounds(&period)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let indicators = sqlx::query_as!(
        QualityIndicatorRow,
        r#"SELECT indicator_code AS "indicator_code!", indicator_name AS "indicator_name!",
                  category AS "category!", numerator AS "numerator?", denominator AS "denominator?",
                  rate AS "rate!", benchmark AS "benchmark?", target AS "target?",
                  direction AS "direction?: IndicatorDirection"
           FROM (
             SELECT DISTINCT ON (qi.id)
               COALESCE(qi.indicator_code, qi.code) AS indicator_code,
               COALESCE(qi.indicator_name, qi.name) AS indicator_name,
               qi.category, qi.display_order,
               ROUND(v.numerator_value)::int AS numerator,
               ROUND(v.denominator_value)::int AS denominator,
               v.calculated_value::float8 AS rate,
               COALESCE(qi.benchmark, qi.benchmark_national::float8) AS benchmark,
               qi.target_value::float8 AS target, qi.direction
             FROM quality_indicator_values v
             JOIN quality_indicators qi ON qi.id = v.indicator_id
               AND qi.tenant_id = v.tenant_id AND qi.deleted_at IS NULL
             WHERE v.deleted_at IS NULL AND v.calculated_value IS NOT NULL
               AND v.period_start >= $1 AND v.period_end < $2 AND v.tenant_id = $3
             ORDER BY qi.id, v.period_end DESC
           ) latest
           ORDER BY category, display_order, indicator_code LIMIT 1000"#,
        start,
        end,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query!(
        r#"SELECT name, logo_url, nabh_certificate_number,
                  nabh_valid_until::text AS "nabh_valid_until?"
           FROM tenants WHERE id = $1"#,
        claims.tenant_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    let action_items = sqlx::query_scalar!(
        r#"SELECT description AS "description!" FROM quality_action_items
           WHERE tenant_id = $1 AND deleted_at IS NULL AND status <> 'closed'
             AND completed_at IS NULL AND NULLIF(description, '') IS NOT NULL
           ORDER BY due_date NULLS LAST, created_at LIMIT 100"#,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let indicators: Vec<QualityIndicator> = indicators
        .into_iter()
        .map(QualityIndicatorRow::into_print)
        .collect();
    let summary = summarise(&indicators);

    Ok(Json(NabhQualityReportPrintData {
        report_period: period,
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        hospital_name: tenant.name,
        nabh_certificate_number: tenant.nabh_certificate_number,
        accreditation_valid_until: tenant.nabh_valid_until,
        indicators,
        summary,
        action_items,
        prepared_by: None,
        reviewed_by: None,
        hospital_logo_url: tenant.logo_url,
    }))
}

#[cfg(test)]
mod tests {
    use super::{IndicatorDirection, QualityIndicatorRow, summarise};

    /// A printed row for an indicator in `direction` with `rate` against `target`.
    fn row(direction: Option<IndicatorDirection>, rate: f64, target: f64) -> QualityIndicatorRow {
        QualityIndicatorRow {
            indicator_code: "NABH-FALL".to_owned(),
            indicator_name: "Patient falls per 1000 patient-days".to_owned(),
            category: "patient_safety".to_owned(),
            numerator: Some(7),
            denominator: Some(2000),
            rate,
            benchmark: None,
            target: Some(target),
            direction,
        }
    }

    #[test]
    fn the_report_prints_a_fall_rate_above_target_as_not_met() {
        let falls = row(Some(IndicatorDirection::LowerBetter), 3.5, 2.0).into_print();
        assert_eq!(falls.status, "not_met");
        let hygiene = row(Some(IndicatorDirection::HigherBetter), 3.5, 2.0).into_print();
        assert_eq!(hygiene.status, "met");
        let unset = row(None, 3.5, 2.0).into_print();
        let summary = summarise(&[falls, hygiene, unset]);
        assert_eq!(
            (
                summary.met_benchmark,
                summary.not_met,
                summary.direction_not_set
            ),
            (1, 1, 1)
        );
    }
}
