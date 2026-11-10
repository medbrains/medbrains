//! The DPDP / CERT-In compliance dashboard and breach-response drills.
//!
//! Each gap names what is missing, the rule that requires it, and where to
//! fix it. The figures come from one query each over data the hospital
//! already keeps: the officers, the policy pack, drills, the privacy-request
//! register, the processor register and the breach register.

use axum::{Extension, Json, extract::State};
use chrono::{NaiveDate, Utc};
use medbrains_core::permissions;
use serde::Serialize;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct Gap {
    pub code: &'static str,
    /// `critical` (a legal duty unmet) or `warning` (good practice, or due soon).
    pub severity: &'static str,
    pub title: String,
    pub basis: &'static str,
    /// Where in the app to fix it.
    pub fix: &'static str,
}

#[derive(Debug, Default, sqlx::FromRow)]
pub struct Facts {
    pub officers_set: Vec<String>,
    pub officers_published: Vec<String>,
    pub published_kinds: Vec<String>,
    pub published_notice_languages: Vec<String>,
    pub last_drill_next_due: Option<NaiveDate>,
    pub requests_open: i64,
    pub requests_overdue: i64,
    pub processors_active: i64,
    pub processors_without_contract: i64,
    pub breaches_cert_in_overdue: i64,
    pub breaches_board_overdue: i64,
}

#[derive(Debug, Serialize)]
pub struct Dashboard {
    pub gaps: Vec<Gap>,
    pub requests_open: i64,
    pub requests_overdue: i64,
    pub processors_active: i64,
    pub published_policies: i64,
    pub next_drill_due: Option<NaiveDate>,
}

fn gap(
    code: &'static str,
    severity: &'static str,
    title: &str,
    basis: &'static str,
    fix: &'static str,
) -> Gap {
    Gap {
        code,
        severity,
        title: title.to_owned(),
        basis,
        fix,
    }
}

/// The gaps, from the facts. Pure, so every rule is tested without a database.
#[must_use]
pub fn gaps(f: &Facts, today: NaiveDate) -> Vec<Gap> {
    let mut g = Vec::new();
    let has = |v: &[String], k: &str| v.iter().any(|x| x == k);
    let contact_set = has(&f.officers_set, "grievance_officer") || has(&f.officers_set, "dpo");
    if !contact_set {
        g.push(gap(
            "contact_not_set",
            "critical",
            "No Data Protection Officer or grievance officer is named",
            "DPDP Rules 2025 r.9, r.14(3)",
            "officers",
        ));
    } else if !(has(&f.officers_published, "grievance_officer")
        || has(&f.officers_published, "dpo"))
    {
        g.push(gap(
            "contact_not_published",
            "critical",
            "The privacy contact is not published to patients",
            "DPDP Rules 2025 r.9",
            "officers",
        ));
    }
    if !has(&f.officers_set, "certin_poc") {
        g.push(gap(
            "certin_poc_not_set",
            "critical",
            "No CERT-In point of contact is named",
            "CERT-In Directions 2022 (iii)",
            "officers",
        ));
    }
    let policy = |kind: &str| has(&f.published_kinds, kind);
    if !policy("privacy_notice") || !has(&f.published_notice_languages, "en") {
        g.push(gap(
            "notice_not_published",
            "critical",
            "The privacy notice is not published",
            "DPDP Act 2023 s.5; Rules 2025 r.3",
            "policies",
        ));
    }
    for lang in ["hi", "ta"] {
        if policy("privacy_notice") && !has(&f.published_notice_languages, lang) {
            let name = if lang == "hi" { "Hindi" } else { "Tamil" };
            g.push(gap(
                if lang == "hi" {
                    "notice_hi_missing"
                } else {
                    "notice_ta_missing"
                },
                "warning",
                &format!("No published {name} privacy notice"),
                "DPDP Act 2023 s.5(3)",
                "policies",
            ));
        }
    }
    for (kind, code, title, basis) in [
        (
            "retention_schedule",
            "retention_not_configured",
            "No data retention schedule is published",
            "DPDP Act 2023 s.8(7); Rules 2025 r.8",
        ),
        (
            "breach_response_plan",
            "breach_plan_missing",
            "No breach response plan is published",
            "DPDP Rules 2025 r.7; CERT-In Directions 2022 (ii)",
        ),
        (
            "processor_policy",
            "processor_policy_missing",
            "No data processor policy is published",
            "DPDP Act 2023 s.8(2)",
        ),
        (
            "children_data_policy",
            "children_policy_missing",
            "No children's data policy is published",
            "DPDP Act 2023 s.9; Rules 2025 r.10",
        ),
        (
            "confidentiality_undertaking",
            "undertaking_missing",
            "No staff confidentiality undertaking is published",
            "DPDP Act 2023 s.8(5)",
        ),
    ] {
        if !policy(kind) {
            g.push(gap(code, "critical", title, basis, "policies"));
        }
    }
    match f.last_drill_next_due {
        None => g.push(gap(
            "drill_never",
            "critical",
            "The breach response plan has never been drilled",
            "DPDP Rules 2025 r.6(1)(g)",
            "drills",
        )),
        Some(due) if due < today => g.push(gap(
            "drill_overdue",
            "critical",
            &format!("Breach drill overdue since {due}"),
            "DPDP Rules 2025 r.6(1)(g)",
            "drills",
        )),
        Some(due) if (due - today).num_days() <= 30 => g.push(gap(
            "drill_due_soon",
            "warning",
            &format!("Breach drill due on {due}"),
            "DPDP Rules 2025 r.6(1)(g)",
            "drills",
        )),
        Some(_) => {}
    }
    if f.requests_overdue > 0 {
        g.push(gap(
            "requests_overdue",
            "critical",
            &format!(
                "{} privacy request(s) past the 90-day deadline",
                f.requests_overdue
            ),
            "DPDP Rules 2025 r.14(3)",
            "grievances",
        ));
    }
    if f.processors_active == 0 {
        g.push(gap(
            "processors_empty",
            "warning",
            "The data processor register is empty",
            "DPDP Act 2023 s.8(2)",
            "processors",
        ));
    } else if f.processors_without_contract > 0 {
        g.push(gap(
            "processors_without_contract",
            "critical",
            &format!(
                "{} processor(s) without a current contract",
                f.processors_without_contract
            ),
            "DPDP Act 2023 s.8(2); Rules 2025 r.6(1)(f)",
            "processors",
        ));
    }
    if f.breaches_cert_in_overdue > 0 {
        g.push(gap(
            "cert_in_overdue",
            "critical",
            &format!(
                "{} incident(s) past the 6-hour CERT-In deadline",
                f.breaches_cert_in_overdue
            ),
            "CERT-In Directions 2022 (ii)",
            "breaches",
        ));
    }
    if f.breaches_board_overdue > 0 {
        g.push(gap(
            "board_report_overdue",
            "critical",
            &format!(
                "{} breach(es) past the 72-hour Board report",
                f.breaches_board_overdue
            ),
            "DPDP Rules 2025 r.7(2)(b)",
            "breaches",
        ));
    }
    g
}

const FACTS_SQL: &str = "SELECT \
   ARRAY(SELECT role FROM privacy_officers WHERE tenant_id = $1 AND deleted_at IS NULL) AS officers_set, \
   ARRAY(SELECT role FROM privacy_officers WHERE tenant_id = $1 AND deleted_at IS NULL \
          AND published_at IS NOT NULL) AS officers_published, \
   ARRAY(SELECT DISTINCT kind FROM compliance_policies WHERE tenant_id = $1 \
          AND status = 'published' AND deleted_at IS NULL) AS published_kinds, \
   ARRAY(SELECT language FROM compliance_policies WHERE tenant_id = $1 AND kind = 'privacy_notice' \
          AND status = 'published' AND deleted_at IS NULL) AS published_notice_languages, \
   (SELECT next_due_on FROM compliance_drills WHERE tenant_id = $1 AND deleted_at IS NULL \
     ORDER BY held_on DESC LIMIT 1) AS last_drill_next_due, \
   (SELECT count(*) FROM privacy_requests WHERE tenant_id = $1 AND deleted_at IS NULL \
     AND status = 'open') AS requests_open, \
   (SELECT count(*) FROM privacy_requests WHERE tenant_id = $1 AND deleted_at IS NULL \
     AND status = 'open' AND due_at < now()) AS requests_overdue, \
   (SELECT count(*) FROM data_processors WHERE tenant_id = $1 AND deleted_at IS NULL \
     AND status = 'active') AS processors_active, \
   (SELECT count(*) FROM data_processors WHERE tenant_id = $1 AND deleted_at IS NULL \
     AND status = 'active' AND (dpa_signed_on IS NULL \
          OR (dpa_expires_on IS NOT NULL AND dpa_expires_on < CURRENT_DATE))) \
     AS processors_without_contract, \
   (SELECT count(*) FROM security_incidents WHERE tenant_id = $1 AND deleted_at IS NULL \
     AND is_cert_in_reportable AND NOT cert_in_reported \
     AND discovered_at < now() - interval '6 hours') AS breaches_cert_in_overdue, \
   (SELECT count(*) FROM security_incidents WHERE tenant_id = $1 AND deleted_at IS NULL \
     AND is_personal_data_breach AND board_report_sent_at IS NULL \
     AND discovered_at < now() - interval '72 hours') AS breaches_board_overdue";

/// `GET /api/regulatory/dpdp/dashboard`
pub async fn dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Dashboard>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let f = sqlx::query_as::<_, Facts>(FACTS_SQL)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(Dashboard {
        gaps: gaps(&f, Utc::now().date_naive()),
        requests_open: f.requests_open,
        requests_overdue: f.requests_overdue,
        processors_active: f.processors_active,
        published_policies: i64::try_from(f.published_kinds.len()).unwrap_or(0),
        next_drill_due: f.last_drill_next_due,
    }))
}

#[cfg(test)]
mod tests {
    use super::{Facts, gaps};
    use crate::dpdp_drills::next_due;
    use chrono::NaiveDate;

    fn day(s: &str) -> NaiveDate {
        s.parse().expect("date")
    }

    fn complete() -> Facts {
        Facts {
            officers_set: vec![
                "dpo".into(),
                "grievance_officer".into(),
                "certin_poc".into(),
            ],
            officers_published: vec!["grievance_officer".into()],
            published_kinds: crate::dpdp_templates::KINDS
                .iter()
                .map(|k| (*k).to_owned())
                .collect(),
            published_notice_languages: vec!["en".into(), "hi".into(), "ta".into()],
            last_drill_next_due: Some(day("2027-06-01")),
            processors_active: 3,
            ..Facts::default()
        }
    }

    fn codes(f: &Facts) -> Vec<&'static str> {
        gaps(f, day("2026-10-26"))
            .into_iter()
            .map(|g| g.code)
            .collect()
    }

    #[test]
    fn a_complete_pack_has_no_gaps() {
        assert!(codes(&complete()).is_empty());
    }

    #[test]
    fn a_new_hospital_sees_every_missing_duty() {
        let c = codes(&Facts::default());
        for code in [
            "contact_not_set",
            "certin_poc_not_set",
            "notice_not_published",
            "retention_not_configured",
            "breach_plan_missing",
            "drill_never",
            "processors_empty",
        ] {
            assert!(c.contains(&code), "{code} in {c:?}");
        }
    }

    #[test]
    fn a_contact_named_but_not_published_is_a_gap() {
        let mut f = complete();
        f.officers_published.clear();
        assert_eq!(codes(&f), vec!["contact_not_published"]);
    }

    #[test]
    fn drills_overdue_and_due_soon() {
        let mut f = complete();
        f.last_drill_next_due = Some(day("2026-10-25"));
        assert_eq!(codes(&f), vec!["drill_overdue"]);
        f.last_drill_next_due = Some(day("2026-11-20"));
        assert_eq!(codes(&f), vec!["drill_due_soon"]);
        assert_eq!(next_due(day("2026-03-31"), None), Some(day("2027-03-31")));
    }

    #[test]
    fn overdue_requests_breaches_and_contracts_are_named() {
        let mut f = complete();
        f.requests_overdue = 2;
        f.breaches_cert_in_overdue = 1;
        f.breaches_board_overdue = 1;
        f.processors_without_contract = 1;
        assert_eq!(
            codes(&f),
            vec![
                "requests_overdue",
                "processors_without_contract",
                "cert_in_overdue",
                "board_report_overdue"
            ]
        );
    }

    #[test]
    fn a_missing_translation_is_a_warning_not_a_failure() {
        let mut f = complete();
        f.published_notice_languages = vec!["en".into()];
        let g = gaps(&f, day("2026-10-26"));
        assert_eq!(
            g.iter().map(|x| (x.code, x.severity)).collect::<Vec<_>>(),
            vec![
                ("notice_hi_missing", "warning"),
                ("notice_ta_missing", "warning")
            ]
        );
    }
}
