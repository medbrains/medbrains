//! DHIS (Digital Health Incentive Scheme) — the one place its rules live.
//!
//! DHIS pays for ABDM Milestone 2/3 transactions only, never for creating or
//! verifying an ABHA:
//! - as an HIP, per record linked to an ABHA: ₹10 for category 1 (diagnostic
//!   report, discharge summary), ₹5 for category 2 (consultation,
//!   prescription and the rest) — `abdm_care_contexts.dhis_category`;
//! - as an HIU, ₹10 per granted consent that brought records from another
//!   facility.
//!
//! A transaction counts only when the ABHA is KYC-verified, at most once per
//! ABHA per day (a category-1 record wins the day) and five times per ABHA per
//! month, and nothing is paid until the month's eligible links pass
//! [`THRESHOLD`]. KYC is read as it stands now, which is DHIS's "on the last
//! day of the month" for the current month and an approximation for past ones.

use chrono::NaiveDate;
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// DHIS pays only once a month's eligible links pass this many.
pub const THRESHOLD: i64 = 100;
const RATE_CATEGORY_1: i64 = 10;
const RATE_CATEGORY_2: i64 = 5;
/// Every HIU request here is patient-granted through the consent manager, so
/// none is an auto-consent.
const RATE_HIU_CONSENT: i64 = 10;

/// One month's DHIS counts.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DhisMonth {
    pub month: NaiveDate,
    /// Every record linked to a verified ABHA this month, by category.
    pub linked_category_1: i64,
    pub linked_category_2: i64,
    /// What DHIS would count: KYC-verified, 1 per ABHA a day, 5 a month.
    pub eligible_category_1: i64,
    pub eligible_category_2: i64,
    /// Granted HIU consents that brought records from another facility,
    /// under the same KYC and per-ABHA caps.
    pub hiu_eligible_consents: i64,
}

/// What a month would earn. Always an estimate: NHA settles the claim.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct DhisEstimate {
    pub threshold: i64,
    pub eligible_links: i64,
    pub threshold_met: bool,
    /// Earned by the eligible links whether or not the threshold is met.
    pub hip_inr: i64,
    pub hiu_inr: i64,
    /// `hip_inr + hiu_inr` once the threshold is met, else 0.
    pub payable_inr: i64,
}

impl DhisMonth {
    #[must_use]
    pub const fn estimate(&self) -> DhisEstimate {
        let eligible_links = self.eligible_category_1 + self.eligible_category_2;
        let hip_inr =
            self.eligible_category_1 * RATE_CATEGORY_1 + self.eligible_category_2 * RATE_CATEGORY_2;
        let hiu_inr = self.hiu_eligible_consents * RATE_HIU_CONSENT;
        let threshold_met = eligible_links > THRESHOLD;
        DhisEstimate {
            threshold: THRESHOLD,
            eligible_links,
            threshold_met,
            hip_inr,
            hiu_inr,
            payable_inr: if threshold_met { hip_inr + hiu_inr } else { 0 },
        }
    }
}

/// `$1` tenant, `$2` first month, `$3` last month (both first-of-month): one
/// row per month, oldest first, zero-filled.
const MONTHS_SQL: &str = "WITH months AS ( \
       SELECT generate_series($2::date, $3::date, interval '1 month')::date AS month), \
     linked AS ( \
       SELECT cc.dhis_month AS month, cc.dhis_category AS cat, l.kyc_verified, \
              regexp_replace(l.abha_number, '\\D', '', 'g') AS abha, \
              timezone('Asia/Kolkata', cc.linked_at)::date AS day \
         FROM abdm_care_contexts cc \
         JOIN patient_abha_links l ON l.tenant_id = cc.tenant_id AND l.patient_id = cc.patient_id \
              AND l.verified_at IS NOT NULL AND l.deleted_at IS NULL \
        WHERE cc.tenant_id = $1 AND cc.link_status = 'linked' AND cc.deleted_at IS NULL \
          AND cc.dhis_month BETWEEN $2 AND $3), \
     hip_day AS (SELECT month, abha, day, min(cat) AS cat FROM linked WHERE kyc_verified \
                  GROUP BY month, abha, day), \
     hip_ranked AS (SELECT month, cat, \
                    row_number() OVER (PARTITION BY month, abha ORDER BY cat, day) AS rn FROM hip_day), \
     hiu_consent AS ( \
       SELECT date_trunc('month', timezone('Asia/Kolkata', x.received_at))::date AS month, \
              x.consent_artefact_id, x.patient_id, \
              min(timezone('Asia/Kolkata', x.received_at)::date) AS day \
         FROM abdm_received_records x \
         JOIN abdm_consent_artefacts a ON a.id = x.consent_artefact_id \
        WHERE x.tenant_id = $1 AND x.deleted_at IS NULL \
          AND x.source_hip_id IS DISTINCT FROM a.hiu_id \
          AND date_trunc('month', timezone('Asia/Kolkata', x.received_at))::date BETWEEN $2 AND $3 \
        GROUP BY 1, 2, 3), \
     hiu_day AS ( \
       SELECT DISTINCT c.month, regexp_replace(l.abha_number, '\\D', '', 'g') AS abha, c.day \
         FROM hiu_consent c \
         JOIN patient_abha_links l ON l.tenant_id = $1 AND l.patient_id = c.patient_id \
              AND l.verified_at IS NOT NULL AND l.deleted_at IS NULL AND l.kyc_verified), \
     hiu_ranked AS (SELECT month, row_number() OVER (PARTITION BY month, abha ORDER BY day) AS rn \
                      FROM hiu_day) \
     SELECT m.month, \
            coalesce(l.c1, 0) AS linked_category_1, coalesce(l.c2, 0) AS linked_category_2, \
            coalesce(e.c1, 0) AS eligible_category_1, coalesce(e.c2, 0) AS eligible_category_2, \
            coalesce(h.n, 0) AS hiu_eligible_consents \
       FROM months m \
       LEFT JOIN (SELECT month, count(*) FILTER (WHERE cat = 1) AS c1, \
                         count(*) FILTER (WHERE cat = 2) AS c2 FROM linked GROUP BY month) l \
              ON l.month = m.month \
       LEFT JOIN (SELECT month, count(*) FILTER (WHERE cat = 1) AS c1, \
                         count(*) FILTER (WHERE cat = 2) AS c2 \
                    FROM hip_ranked WHERE rn <= 5 GROUP BY month) e ON e.month = m.month \
       LEFT JOIN (SELECT month, count(*) AS n FROM hiu_ranked WHERE rn <= 5 GROUP BY month) h \
              ON h.month = m.month \
      ORDER BY m.month";

/// DHIS counts for every month from `from` to `to`, oldest first.
///
/// # Errors
/// Any database error.
pub async fn months(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    from: NaiveDate,
    to: NaiveDate,
) -> Result<Vec<DhisMonth>, sqlx::Error> {
    sqlx::query_as::<_, DhisMonth>(MONTHS_SQL)
        .bind(tenant_id)
        .bind(from)
        .bind(to)
        .fetch_all(&mut **tx)
        .await
}

#[cfg(test)]
mod tests {
    use super::{DhisMonth, THRESHOLD};
    use chrono::NaiveDate;

    fn month(c1: i64, c2: i64, hiu: i64) -> DhisMonth {
        DhisMonth {
            month: NaiveDate::MIN,
            linked_category_1: c1,
            linked_category_2: c2,
            eligible_category_1: c1,
            eligible_category_2: c2,
            hiu_eligible_consents: hiu,
        }
    }

    #[test]
    fn rates_are_ten_and_five_and_ten_for_an_hiu_consent() {
        let e = month(3, 4, 2).estimate();
        assert_eq!(e.hip_inr, 3 * 10 + 4 * 5);
        assert_eq!(e.hiu_inr, 20);
        assert_eq!(e.eligible_links, 7);
    }

    #[test]
    fn nothing_is_payable_until_the_threshold_is_passed() {
        let at = month(THRESHOLD, 0, 3).estimate();
        assert!(!at.threshold_met, "exactly the threshold does not pass it");
        assert_eq!(at.payable_inr, 0);
        assert_eq!(
            at.hip_inr,
            THRESHOLD * 10,
            "what it would earn is still shown"
        );
        let past = month(THRESHOLD, 1, 3).estimate();
        assert!(past.threshold_met);
        assert_eq!(past.payable_inr, THRESHOLD * 10 + 5 + 30);
    }

    #[test]
    fn hiu_consents_do_not_count_towards_the_link_threshold() {
        assert!(!month(0, 0, THRESHOLD * 2).estimate().threshold_met);
    }
}
