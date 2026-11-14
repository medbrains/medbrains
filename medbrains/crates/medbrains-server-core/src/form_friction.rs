//! Form friction: refused saves counted per screen, never per person.
//!
//! A 400 or 422 usually means a form let a bad entry through — the server
//! knew a rule the screen did not check. One middleware ([`record_refusals`])
//! counts every such answer from the protected API in a bounded in-memory map
//! keyed by hospital, day, method, route template, status, role and the
//! refusal reason with every value scrubbed out ([`normalise`]). A background
//! task ([`spawn`]) adds the counts to `form_friction_daily` once a minute;
//! the admin "Form friction" report ranks them.
//!
//! Privacy is the hard rule: the route is axum's matched template (never the
//! path, which carries record ids), the reason goes through the error-report
//! scrubber and then loses every digit and non-ASCII letter, and no user id,
//! name, patient or submitted value is kept. Nothing touches the database on
//! the request path, and a flush that fails keeps its counts for the next one.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use axum::extract::{MatchedPath, Request};
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::Response;
use chrono::NaiveDate;
use sqlx::PgPool;
use uuid::Uuid;

use crate::middleware::auth::Claims;
use crate::scrub::scrub_text;

/// Distinct keys held between flushes; past this a refusal is counted as dropped.
/// ponytail: one process-wide cap; per-tenant caps if one hospital crowds the rest out.
pub const MAX_ENTRIES: usize = 10_000;

/// Longest refusal reason kept, in characters.
pub const MAX_MESSAGE: usize = 120;

/// Longest route template, method and role kept (the table's CHECKs).
const MAX_ROUTE: usize = 200;
const MAX_METHOD: usize = 10;
const MAX_ROLE: usize = 64;

/// How often the counts are written.
const FLUSH_SECS: u64 = 60;

/// What a refusal says when the handler gave no reason (a body axum could not parse).
pub const UNREAD_BODY: &str = "the request body did not match what the server expects";

/// What a reason becomes when it cannot be made safe to keep.
pub const OTHER: &str = "other";

/// A refusal's reason, as the handler wrote it, carried on the response so the
/// middleware can count it. Scrubbed by [`normalise`] before it is kept.
#[derive(Clone, Debug)]
pub struct Refusal(pub String);

/// One counted kind of refusal: a row of `form_friction_daily`.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Key {
    pub tenant_id: Uuid,
    pub day: NaiveDate,
    pub method: String,
    pub route: String,
    pub status: i16,
    pub role: String,
    pub message: String,
}

/// Counts waiting for the next flush, and refusals turned away by the cap.
#[derive(Debug, Default)]
pub struct Counter {
    counts: HashMap<Key, i64>,
    dropped: i64,
}

impl Counter {
    /// Add `n` refusals of `key`; a new key past [`MAX_ENTRIES`] is dropped and counted.
    pub fn add(&mut self, key: Key, n: i64) {
        if let Some(count) = self.counts.get_mut(&key) {
            *count += n;
        } else if self.counts.len() < MAX_ENTRIES {
            self.counts.insert(key, n);
        } else {
            self.dropped += n;
        }
    }

    /// Everything counted so far, leaving the counter empty.
    pub fn take(&mut self) -> (HashMap<Key, i64>, i64) {
        (
            std::mem::take(&mut self.counts),
            std::mem::take(&mut self.dropped),
        )
    }

    /// How many distinct keys are waiting.
    #[must_use]
    pub fn len(&self) -> usize {
        self.counts.len()
    }

    /// Whether nothing is waiting.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.counts.is_empty()
    }
}

static COUNTER: LazyLock<Mutex<Counter>> = LazyLock::new(Mutex::default);

/// The process-wide counter. A panic while it was held cannot have left a
/// count half-written (each update is one integer), so a poisoned lock is used.
fn counter() -> MutexGuard<'static, Counter> {
    COUNTER.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Count one refusal.
pub fn record(key: Key) {
    counter().add(key, 1);
}

/// Middleware: count a 400 or 422 against its route, hospital and role.
///
/// Requests with no signed-in caller or no matched route are not counted.
/// Never changes the response.
pub async fn record_refusals(request: Request, next: Next) -> Response {
    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map(|p| p.as_str().to_owned());
    let caller = request
        .extensions()
        .get::<Claims>()
        .map(|c| (c.tenant_id, c.role.clone()));
    let method = request.method().as_str().to_owned();
    let response = next.run(request).await;
    let status = response.status();
    if status != StatusCode::BAD_REQUEST && status != StatusCode::UNPROCESSABLE_ENTITY {
        return response;
    }
    if let (Some(route), Some((tenant_id, role))) = (route, caller) {
        let reason = response
            .extensions()
            .get::<Refusal>()
            .map_or(UNREAD_BODY, |r| r.0.as_str());
        record(Key {
            tenant_id,
            day: chrono::Utc::now().date_naive(),
            method: cut(&method, MAX_METHOD),
            route: cut(&route, MAX_ROUTE),
            status: i16::try_from(status.as_u16()).unwrap_or(400),
            role: cut(&role, MAX_ROLE),
            message: normalise(reason),
        });
    }
    response
}

/// A refusal reason with nothing typed left in it, so it can be kept and shown.
///
/// The error-report scrubber takes out credentials, identifiers, anything
/// quoted, runs of capitalised words (names) and long digit runs; then each
/// remaining run of digits becomes one `#`, every non-ASCII character goes (a name in
/// another script is not caught by a capital-letter rule), whitespace
/// collapses and the result is cut to [`MAX_MESSAGE`] characters. A reason the
/// scrubber withholds, or that ends up empty, becomes [`OTHER`].
#[must_use]
pub fn normalise(message: &str) -> String {
    let scrubbed = scrub_text(message);
    if scrubbed.contains("[withheld") {
        return OTHER.to_owned();
    }
    let mut kept = String::with_capacity(scrubbed.len());
    for c in scrubbed.chars() {
        match c {
            // A run of digits is one `#`, so "dose 7" and "dose 12" count together.
            '0'..='9' if kept.ends_with('#') => {}
            '0'..='9' => kept.push('#'),
            c if c.is_ascii_graphic() => kept.push(c),
            c if c.is_whitespace() => kept.push(' '),
            _ => {}
        }
    }
    let words = kept.split_whitespace().collect::<Vec<_>>().join(" ");
    if words.is_empty() {
        return OTHER.to_owned();
    }
    cut(&words, MAX_MESSAGE)
}

/// `text` cut to at most `max` characters, on a character boundary.
fn cut(text: &str, max: usize) -> String {
    text.chars().take(max).collect()
}

/// Write the counts once a minute for the life of the server.
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(FLUSH_SECS)).await;
            flush(&pool).await;
        }
    });
}

/// Add every waiting count to `form_friction_daily`, one statement per hospital.
///
/// A hospital whose write fails gets its counts back for the next flush (still
/// under the cap); the failure is logged and never reaches a request. Also
/// called once at shutdown.
pub async fn flush(pool: &PgPool) {
    let (counts, dropped) = counter().take();
    if dropped > 0 {
        tracing::warn!(dropped, "form friction: refusals not counted, counter full");
    }
    let mut by_tenant: HashMap<Uuid, Vec<(Key, i64)>> = HashMap::new();
    for (key, n) in counts {
        by_tenant.entry(key.tenant_id).or_default().push((key, n));
    }
    for (tenant_id, rows) in by_tenant {
        if let Err(error) = write_tenant(pool, tenant_id, &rows).await {
            tracing::error!(%error, %tenant_id, "form friction: flush failed, retrying next tick");
            let mut waiting = counter();
            for (key, n) in rows {
                waiting.add(key, n);
            }
        }
    }
}

/// Upsert one hospital's counts in a single statement under its own RLS context.
async fn write_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
    rows: &[(Key, i64)],
) -> Result<(), medbrains_db::pool::DbError> {
    let days: Vec<NaiveDate> = rows.iter().map(|(k, _)| k.day).collect();
    let methods: Vec<String> = rows.iter().map(|(k, _)| k.method.clone()).collect();
    let routes: Vec<String> = rows.iter().map(|(k, _)| k.route.clone()).collect();
    let statuses: Vec<i16> = rows.iter().map(|(k, _)| k.status).collect();
    let roles: Vec<String> = rows.iter().map(|(k, _)| k.role.clone()).collect();
    let messages: Vec<String> = rows.iter().map(|(k, _)| k.message.clone()).collect();
    let counts: Vec<i64> = rows.iter().map(|(_, n)| *n).collect();
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    sqlx::query!(
        "INSERT INTO form_friction_daily \
             (tenant_id, day, method, route, status, role, message, count) \
         SELECT $1, r.day, r.method, r.route, r.status, r.role, r.message, r.count \
           FROM UNNEST($2::date[], $3::text[], $4::text[], $5::int2[], $6::text[], \
                       $7::text[], $8::int8[]) \
                AS r(day, method, route, status, role, message, count) \
         ON CONFLICT (tenant_id, day, method, route, status, role, message) \
         DO UPDATE SET count = form_friction_daily.count + EXCLUDED.count",
        tenant_id,
        &days,
        &methods,
        &routes,
        &statuses,
        &roles,
        &messages,
        &counts,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{Counter, Key, MAX_ENTRIES, MAX_MESSAGE, OTHER, normalise};
    use uuid::Uuid;

    /// A key differing only in its message.
    fn key(message: &str) -> Key {
        Key {
            tenant_id: Uuid::nil(),
            day: chrono::NaiveDate::MIN,
            method: "POST".to_owned(),
            route: "/api/specialty/ophthalmology/exams".to_owned(),
            status: 400,
            role: "doctor".to_owned(),
            message: message.to_owned(),
        }
    }

    /// Whatever a clinician typed, nothing of it survives into the count.
    #[test]
    fn a_reason_keeps_no_value_typed_into_the_form() {
        let cases = [
            ("Patient Ravi Kumar not found", "Ravi"),
            ("UHID 202611140042 is not registered", "2026"),
            (
                "invalid patient 550e8400-e29b-41d4-a716-446655440000",
                "550e8400",
            ),
            ("contact ravi.kumar@example.com is taken", "example.com"),
            ("mobile +91 98765 43210 already used", "98765"),
            ("drug 'Paracetamol 500mg' is out of stock", "Paracetamol"),
            ("dose 7 exceeds the maximum of 4", "7"),
            ("रवि कुमार का पता गलत है", "रवि"),
        ];
        for (raw, leaked) in cases {
            let kept = normalise(raw);
            assert!(!kept.contains(leaked), "{raw:?} kept {leaked:?}: {kept:?}");
            assert!(!kept.chars().any(|c| c.is_ascii_digit()), "{kept:?}");
        }
    }

    /// The rule a refusal names stays readable, so the form can be fixed.
    #[test]
    fn a_reason_keeps_the_rule_it_names() {
        assert_eq!(
            normalise("Right eye axis given without a cylinder"),
            "Right eye axis given without a cylinder"
        );
        assert_eq!(
            normalise("days must be 7, 30 or 90"),
            "days must be #, # or #"
        );
        assert_eq!(
            normalise("validation failed: right_eye_axis"),
            "validation failed: right_eye_axis"
        );
    }

    /// A long reason is cut; an empty or unscrubbable one is "other".
    #[test]
    fn a_reason_is_bounded_and_never_empty() {
        assert_eq!(normalise(&"a ".repeat(500)).chars().count(), MAX_MESSAGE);
        assert_eq!(normalise(""), OTHER);
        assert_eq!(normalise("कुछ गलत"), OTHER);
    }

    /// The same refusal adds up; a new one past the cap is counted as dropped.
    #[test]
    fn the_counter_is_bounded() {
        let mut counter = Counter::default();
        counter.add(key("a"), 1);
        counter.add(key("a"), 2);
        for i in 1..MAX_ENTRIES {
            counter.add(key(&i.to_string()), 1);
        }
        assert_eq!(counter.len(), MAX_ENTRIES);
        counter.add(key("one too many"), 5);
        counter.add(key("a"), 1);
        let (counts, dropped) = counter.take();
        assert_eq!(dropped, 5);
        assert_eq!(counts.get(&key("a")), Some(&4));
        assert!(counter.is_empty());
    }
}
