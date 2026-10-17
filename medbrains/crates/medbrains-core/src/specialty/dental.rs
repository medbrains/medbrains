use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A dental exam (the visit) — carries the tooth-wise chart via `dental_chart_entries`.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DentalExam {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub chief_complaint: Option<String>,
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
    pub examined_by: Option<Uuid>,
    pub examined_at: Option<DateTime<Utc>>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// One tooth's finding on a dental exam (FDI numbering).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DentalChartEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub exam_id: Uuid,
    pub tooth_number: String,
    pub condition: String,
    pub surface: Option<String>,
    pub treatment_planned: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// One procedure on a dental treatment plan.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DentalTreatmentItem {
    pub id: Uuid,
    pub exam_id: Uuid,
    pub tooth_number: Option<String>,
    pub procedure: String,
    pub charge_code: Option<String>,
    pub price: rust_decimal::Decimal,
    pub status: String,
    pub done_at: Option<DateTime<Utc>>,
    pub done_by: Option<Uuid>,
    pub invoice_id: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Whether `tooth` is an FDI tooth: permanent 11-18, 21-28, 31-38, 41-48 or
/// deciduous 51-55, 61-65, 71-75, 81-85.
#[must_use]
pub fn is_fdi_tooth(tooth: &str) -> bool {
    let mut digits = tooth.chars();
    let (Some(q), Some(t), None) = (digits.next(), digits.next(), digits.next()) else {
        return false;
    };
    let (Some(q), Some(t)) = (q.to_digit(10), t.to_digit(10)) else {
        return false;
    };
    match q {
        1..=4 => (1..=8).contains(&t),
        5..=8 => (1..=5).contains(&t),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::is_fdi_tooth;

    #[test]
    fn fdi_numbers_cover_both_dentitions_and_nothing_else() {
        for ok in ["11", "18", "28", "36", "48", "51", "55", "65", "85"] {
            assert!(is_fdi_tooth(ok), "{ok}");
        }
        for bad in ["10", "19", "56", "86", "91", "1", "111", "ab", ""] {
            assert!(!is_fdi_tooth(bad), "{bad}");
        }
    }
}
