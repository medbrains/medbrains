//! Notifiable-disease detection, from every place a disease is concluded.
//!
//! The decision -- is this notifiable for this hospital, and is there already
//! a worklist row for this patient's episode -- lives in Postgres
//! (`notifiable_detect*`, migration 1230) so every caller shares it: a coded
//! diagnosis on any encounter, the diagnosis text of a discharge summary, and a
//! verified lab result. This module is the one Rust door to it, and raises the
//! "statutory report due" notification when a row is opened or a presumptive
//! case becomes lab-confirmed.

use medbrains_notifications::{NewNotification, create_notification};
use medbrains_server_core::error::AppError;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// What the conclusion was drawn from.
#[derive(Debug, Clone, Copy)]
pub enum Signal<'a> {
    /// A coded diagnosis. `system` is `icd10` or `icd11`.
    Code {
        code: &'a str,
        system: &'a str,
        source: &'a str,
    },
    /// A written diagnosis (admission, ER or discharge summary).
    Text { text: &'a str, source: &'a str },
    /// A verified lab order: its results are matched against the lab rules.
    LabOrder { order_id: Uuid },
}

/// Who and what the signal is about.
#[derive(Debug, Clone, Copy)]
pub struct Context {
    pub tenant_id: Uuid,
    pub patient_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    /// The person whose act raised the signal.
    pub actor: Uuid,
    /// Who is told a report is due; the actor when `None`.
    pub notify: Option<Uuid>,
}

/// One worklist row the signal touched.
#[derive(Debug, sqlx::FromRow)]
pub struct Detection {
    pub report_id: Uuid,
    pub disease_code: String,
    pub disease_name: String,
    pub reporting_body: Option<String>,
    /// `created`, `upgraded` (presumptive became lab-confirmed) or `existing`.
    pub outcome: String,
}

/// Run detection for one signal inside the caller's transaction, and notify
/// for every row it opened or confirmed.
///
/// # Errors
/// A database fault. A signal that names nothing notifiable is `Ok(vec![])`.
pub async fn detect(
    tx: &mut Transaction<'_, Postgres>,
    ctx: Context,
    signal: Signal<'_>,
) -> Result<Vec<Detection>, AppError> {
    let rows =
        match signal {
            Signal::Code {
                code,
                system,
                source,
            } => sqlx::query_as::<_, Detection>(
                "SELECT * FROM notifiable_detect($1, $2, $3, $4, $5, 'presumptive', $6, $7, NULL)",
            )
            .bind(ctx.tenant_id)
            .bind(ctx.patient_id)
            .bind(ctx.encounter_id)
            .bind(code)
            .bind(system)
            .bind(source)
            .bind(ctx.actor)
            .fetch_all(&mut **tx)
            .await?,
            Signal::Text { text, source } => {
                sqlx::query_as::<_, Detection>(
                    "SELECT * FROM notifiable_detect_text($1, $2, $3, $4, $5, $6)",
                )
                .bind(ctx.tenant_id)
                .bind(ctx.patient_id)
                .bind(ctx.encounter_id)
                .bind(text)
                .bind(source)
                .bind(ctx.actor)
                .fetch_all(&mut **tx)
                .await?
            }
            Signal::LabOrder { order_id } => {
                sqlx::query_as::<_, Detection>("SELECT * FROM notifiable_detect_lab($1, $2, $3)")
                    .bind(ctx.tenant_id)
                    .bind(order_id)
                    .bind(ctx.actor)
                    .fetch_all(&mut **tx)
                    .await?
            }
        };
    notify_due(tx, &ctx, &rows).await?;
    Ok(rows)
}

async fn notify_due(
    tx: &mut Transaction<'_, Postgres>,
    ctx: &Context,
    rows: &[Detection],
) -> Result<(), AppError> {
    let mut told = Vec::with_capacity(rows.len());
    for row in rows {
        if row.outcome == "existing" || told.contains(&row.report_id) {
            continue;
        }
        told.push(row.report_id);
        let body = report_due_message(row);
        let title = if row.outcome == "upgraded" {
            "Notifiable disease lab-confirmed — L-form due"
        } else {
            "Notifiable disease — statutory report due"
        };
        create_notification(
            tx,
            ctx.tenant_id,
            NewNotification {
                user_id: ctx.notify.unwrap_or(ctx.actor),
                kind: "warning",
                title,
                body: Some(&body),
                category: Some("Notifiable Disease"),
                entity_type: Some("notifiable_disease_reports"),
                entity_id: Some(row.report_id),
                action_url: Some("/clinical-kb#reports"),
            },
        )
        .await?;
    }
    Ok(())
}

/// The sentence the reporter reads.
fn report_due_message(row: &Detection) -> String {
    let body = row.reporting_body.as_deref().unwrap_or("IDSP");
    if row.outcome == "upgraded" {
        format!(
            "{} ({}) is now lab-confirmed. Submit the lab-confirmed (L) report to {body}.",
            row.disease_name, row.disease_code
        )
    } else {
        format!(
            "{} ({}) requires {body} reporting.",
            row.disease_name, row.disease_code
        )
    }
}

#[cfg(test)]
mod tests {
    use super::{Detection, report_due_message};
    use uuid::Uuid;

    fn row(outcome: &str, body: Option<&str>) -> Detection {
        Detection {
            report_id: Uuid::nil(),
            disease_code: "A90".to_owned(),
            disease_name: "Dengue fever".to_owned(),
            reporting_body: body.map(str::to_owned),
            outcome: outcome.to_owned(),
        }
    }

    #[test]
    fn a_new_case_names_its_reporting_body() {
        assert_eq!(
            report_due_message(&row("created", Some("IDSP"))),
            "Dengue fever (A90) requires IDSP reporting."
        );
        assert_eq!(
            report_due_message(&row("created", None)),
            "Dengue fever (A90) requires IDSP reporting."
        );
    }

    #[test]
    fn a_confirmed_case_asks_for_the_l_form() {
        assert!(report_due_message(&row("upgraded", Some("IDSP"))).contains("(L) report to IDSP"));
    }
}
