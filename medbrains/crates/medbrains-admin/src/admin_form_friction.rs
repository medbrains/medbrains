//! `GET /api/admin/form-friction` — which forms the server refuses most.
//!
//! Reads `form_friction_daily` (written by `medbrains_server_core::form_friction`)
//! for the last 7, 30 or 90 days and the same span before it, and ranks routes
//! by refusals with their most common reasons. Counts only: no patient, no
//! staff member, no submitted value is stored, so none can be shown.

use std::collections::HashMap;

use axum::extract::{Query, State};
use axum::{Extension, Json};
use chrono::{Days, NaiveDate};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, Claims, require_permission};
use medbrains_server_core::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};

/// Periods the report offers, in days.
const PERIODS: [u64; 3] = [7, 30, 90];

/// Routes shown, most refused first.
const MAX_ROUTES: usize = 50;

/// Reasons shown per route, most common first.
const MAX_MESSAGES: usize = 5;

/// Rows read: (route, reason) pairs over both periods.
const MAX_ROWS: i64 = 2_000;

#[derive(Debug, Deserialize)]
pub struct FrictionQuery {
    pub days: Option<u64>,
}

/// One refusal reason on a route, and the roles that met it this period.
#[derive(Debug, Serialize)]
pub struct FrictionMessage {
    pub message: String,
    pub count: i64,
    pub roles: Vec<String>,
}

/// One route's refusals this period and the period before.
#[derive(Debug, Serialize)]
pub struct FrictionRoute {
    pub method: String,
    pub route: String,
    pub count: i64,
    pub previous: i64,
    pub messages: Vec<FrictionMessage>,
}

/// The report: totals for both periods and the ranked routes.
#[derive(Debug, Serialize)]
pub struct FormFrictionReport {
    pub days: u64,
    pub since: NaiveDate,
    pub total: i64,
    pub previous_total: i64,
    pub routes: Vec<FrictionRoute>,
}

/// `GET /api/admin/form-friction?days=30` — refusals ranked by route.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn get_form_friction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<FrictionQuery>,
) -> Result<Json<FormFrictionReport>, AppError> {
    require_permission(&claims, permissions::admin::form_friction::VIEW)?;
    let days = query.days.unwrap_or(30);
    if !PERIODS.contains(&days) {
        return Err(AppError::BadRequest("days must be 7, 30 or 90".to_owned()));
    }
    let today = chrono::Utc::now().date_naive();
    let since = today - Days::new(days - 1);
    let earliest = since - Days::new(days);

    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let rows = sqlx::query!(
        r#"SELECT method, route, message,
                  COALESCE(SUM(count) FILTER (WHERE day >= $2), 0)::int8 AS "current!",
                  COALESCE(SUM(count) FILTER (WHERE day < $2), 0)::int8 AS "previous!",
                  COALESCE(array_agg(DISTINCT role ORDER BY role)
                           FILTER (WHERE day >= $2), '{}') AS "roles!"
             FROM form_friction_daily
            WHERE tenant_id = $1 AND day >= $3
            GROUP BY method, route, message
            ORDER BY 4 DESC, 5 DESC
            LIMIT $4"#,
        claims.tenant_id,
        since,
        earliest,
        MAX_ROWS,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let rows = rows
        .into_iter()
        .map(|r| Row {
            method: r.method,
            route: r.route,
            message: r.message,
            current: r.current,
            previous: r.previous,
            roles: r.roles,
        })
        .collect();
    Ok(Json(rank(days, since, rows)))
}

/// One (route, reason) count as read.
#[derive(Debug)]
struct Row {
    method: String,
    route: String,
    message: String,
    current: i64,
    previous: i64,
    roles: Vec<String>,
}

/// Group reasons under their route, rank routes by this period's refusals
/// (then the previous period's), and keep the top routes and reasons.
fn rank(days: u64, since: NaiveDate, rows: Vec<Row>) -> FormFrictionReport {
    let mut routes: HashMap<(String, String), FrictionRoute> = HashMap::new();
    for row in rows {
        let entry = routes
            .entry((row.method.clone(), row.route.clone()))
            .or_insert_with(|| FrictionRoute {
                method: row.method,
                route: row.route,
                count: 0,
                previous: 0,
                messages: Vec::new(),
            });
        entry.count += row.current;
        entry.previous += row.previous;
        if row.current > 0 {
            entry.messages.push(FrictionMessage {
                message: row.message,
                count: row.current,
                roles: row.roles,
            });
        }
    }
    let mut ranked: Vec<FrictionRoute> = routes.into_values().collect();
    let total = ranked.iter().map(|r| r.count).sum();
    let previous_total = ranked.iter().map(|r| r.previous).sum();
    ranked.sort_by(|a, b| {
        (b.count, b.previous, &a.route, &a.method).cmp(&(a.count, a.previous, &b.route, &b.method))
    });
    ranked.truncate(MAX_ROUTES);
    for route in &mut ranked {
        route
            .messages
            .sort_by(|a, b| b.count.cmp(&a.count).then(a.message.cmp(&b.message)));
        route.messages.truncate(MAX_MESSAGES);
    }
    FormFrictionReport {
        days,
        since,
        total,
        previous_total,
        routes: ranked,
    }
}

#[cfg(test)]
mod tests {
    use super::{MAX_MESSAGES, Row, rank};

    /// A reason count on `route`.
    fn row(route: &str, message: &str, current: i64, previous: i64) -> Row {
        Row {
            method: "POST".to_owned(),
            route: route.to_owned(),
            message: message.to_owned(),
            current,
            previous,
            roles: vec!["doctor".to_owned()],
        }
    }

    /// The most refused route comes first with its reasons summed; a route
    /// refused only last period still shows, so a fix can be seen to work.
    #[test]
    fn routes_rank_by_this_periods_refusals() {
        let mut rows = vec![
            row("/api/a", "x", 2, 0),
            row("/api/b", "y", 3, 1),
            row("/api/b", "z", 4, 0),
            row("/api/c", "w", 0, 9),
        ];
        rows.extend((0..8).map(|i| row("/api/b", &format!("m{i}"), 1, 0)));
        let report = rank(30, chrono::NaiveDate::MIN, rows);
        let order: Vec<&str> = report.routes.iter().map(|r| r.route.as_str()).collect();
        assert_eq!(order, ["/api/b", "/api/a", "/api/c"]);
        assert_eq!(report.total, 2 + 3 + 4 + 8);
        assert_eq!(report.previous_total, 10);
        let b = &report.routes[0];
        assert_eq!((b.count, b.previous), (15, 1));
        assert_eq!(b.messages.len(), MAX_MESSAGES);
        assert_eq!(b.messages[0].message, "z");
        assert!(report.routes[2].messages.is_empty());
    }
}
