//! Who an emergency code pages.
//!
//! The code blue page used to go to every active doctor and nurse in the
//! hospital, up to five hundred people, and the floor codes (Code Pink, Red,
//! Yellow, …) paged nobody at all. Paging everyone is not a code team: it is
//! noise that teaches people to ignore the next one.
//!
//! Code blue, round 1:
//! 1. the code team on `code_blue_team_members` (tier 1);
//! 2. otherwise the on-call doctor for the patient's department and the
//!    ward's nurses on the shift working now;
//! 3. only when neither resolves, every clinician — and the screen says so.
//!
//! Each later round re-pages the team and adds the next tier from the roster:
//! round 2 the duty medical officer, round 3 onwards the medical
//! superintendent too.
//!
//! A floor code pages that code's own responders (tier 1 of its roster).
//! With none, it pages the duty medical officer and security, and says so.

use std::collections::HashSet;

use chrono::{Duration, NaiveDate, NaiveDateTime, NaiveTime};
use sqlx::PgConnection;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

/// Ceiling on everyone paged in one round, whichever way they were chosen.
const PAGE_LIMIT: i64 = 500;
/// The code whose roster carries the duty medical officer (tier 2).
pub const CODE_BLUE: &str = "code_blue";

/// How the responders for a round were found.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TeamSource {
    /// Tier 1 of the hospital's roster for this code.
    Roster,
    /// The on-call doctor and the ward's shift nurses (code blue).
    WardShift,
    /// Nobody resolved: every active doctor and nurse (code blue).
    AllClinicians,
    /// No roster for a floor code: the duty medical officer and security.
    DutyMoAndSecurity,
    /// Nobody at all could be found.
    Nobody,
}

impl TeamSource {
    /// The value stored in `code_blue_pages.routing`.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Roster => "roster",
            Self::WardShift => "ward_shift",
            Self::AllClinicians => "all_clinicians",
            Self::DutyMoAndSecurity => "duty_mo_and_security",
            Self::Nobody => "nobody",
        }
    }
}

/// One person to page and the tier they are paged as.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Recipient {
    pub user_id: Uuid,
    pub tier: i16,
}

/// Everyone a round pages, and what the screen is told about it.
#[derive(Debug)]
pub struct Routing {
    pub source: TeamSource,
    pub recipients: Vec<Recipient>,
    pub note: String,
}

/// Where the code is, as far as the record knows.
#[derive(Debug, Default, Clone, Copy)]
pub struct Place {
    pub ward_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
}

/// The tiers a round reaches: 1 for the first round, 1-2 for the second,
/// all three from the third on.
pub fn top_tier(round: i16) -> i16 {
    round.clamp(1, 3)
}

/// The hospital's wall-clock time now, in its own timezone.
pub async fn tenant_local_now(
    tx: &mut PgConnection,
    tenant_id: Uuid,
) -> Result<NaiveDateTime, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT (now() AT TIME ZONE COALESCE( \
                  (SELECT timezone FROM tenants WHERE id = $1), 'Asia/Kolkata'))",
    )
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?)
}

/// The ward shift (`nurse_shift_assignments` date and type) working at
/// `local`: day 07-15, evening 15-23, night 23-07. A night shift belongs to
/// the date it started, so at 02:00 it is yesterday's night.
pub fn current_shift(local: NaiveDateTime) -> (NaiveDate, &'static str) {
    // ponytail: fixed hours; read them per ward once wards record their shift
    // times (`nurse_shift_assignments` has only the shift name).
    let at = |h| NaiveTime::from_hms_opt(h, 0, 0).unwrap_or(NaiveTime::MIN);
    let (date, time) = (local.date(), local.time());
    if time < at(7) {
        (date - Duration::days(1), "night")
    } else if time < at(15) {
        (date, "day")
    } else if time < at(23) {
        (date, "evening")
    } else {
        (date, "night")
    }
}

/// Resolve everyone round `round` of a `code_type` page reaches,
/// deduplicated (lowest tier wins).
pub async fn resolve(
    tx: &mut PgConnection,
    tenant_id: Uuid,
    (code_type, place): (&str, Place),
    round: i16,
) -> Result<Routing, AppError> {
    let roster = roster(tx, tenant_id, code_type, top_tier(round)).await?;
    let tier_one: Vec<Uuid> = roster
        .iter()
        .filter(|(_, t)| *t == 1)
        .map(|(u, _)| *u)
        .collect();
    let (source, team) = if !tier_one.is_empty() {
        (TeamSource::Roster, tier_one)
    } else if code_type == CODE_BLUE {
        code_blue_fallback(tx, tenant_id, place).await?
    } else {
        let people = duty_mo_and_security(tx, tenant_id).await?;
        let source = if people.is_empty() {
            TeamSource::Nobody
        } else {
            TeamSource::DutyMoAndSecurity
        };
        (source, people)
    };
    let higher: Vec<(Uuid, i16)> = roster.into_iter().filter(|(_, t)| *t > 1).collect();
    let tiers_found: HashSet<i16> = higher.iter().map(|(_, t)| *t).collect();
    let recipients = merge(&team, &higher);
    let note = note((code_type, round), source, recipients.len(), &tiers_found);
    Ok(Routing {
        source,
        recipients,
        note,
    })
}

/// Active roster members of a code up to `top` tier.
async fn roster(
    tx: &mut PgConnection,
    tenant_id: Uuid,
    code_type: &str,
    top: i16,
) -> Result<Vec<(Uuid, i16)>, AppError> {
    Ok(sqlx::query_as(
        "SELECT m.user_id, m.tier FROM code_blue_team_members m \
           JOIN users u ON u.id = m.user_id AND u.tenant_id = m.tenant_id \
          WHERE m.tenant_id = $1 AND m.code_type = $2 AND m.deleted_at IS NULL \
            AND m.tier <= $3 AND u.is_active = true AND u.deleted_at IS NULL \
          ORDER BY m.tier, m.user_id LIMIT $4",
    )
    .bind(tenant_id)
    .bind(code_type)
    .bind(top)
    .bind(PAGE_LIMIT)
    .fetch_all(&mut *tx)
    .await?)
}

/// Code blue without a team: the ward's shift and the on-call doctor, else
/// every clinician.
async fn code_blue_fallback(
    tx: &mut PgConnection,
    tenant_id: Uuid,
    place: Place,
) -> Result<(TeamSource, Vec<Uuid>), AppError> {
    let ward = ward_shift(tx, tenant_id, place).await?;
    if !ward.is_empty() {
        return Ok((TeamSource::WardShift, ward));
    }
    let all = all_clinicians(tx, tenant_id).await?;
    let source = if all.is_empty() {
        TeamSource::Nobody
    } else {
        TeamSource::AllClinicians
    };
    Ok((source, all))
}

/// The ward's nurses (charge nurse included) on the shift working now, and
/// the on-call doctor for the patient's department.
async fn ward_shift(
    tx: &mut PgConnection,
    tenant_id: Uuid,
    place: Place,
) -> Result<Vec<Uuid>, AppError> {
    let mut people = match place.ward_id {
        Some(ward_id) => {
            let (date, shift) = current_shift(tenant_local_now(tx, tenant_id).await?);
            ward_nurses(tx, tenant_id, ward_id, (date, shift)).await?
        }
        None => Vec::new(),
    };
    let on_call =
        medbrains_notifications::on_call::current_on_call(tx, tenant_id, place.department_id)
            .await?;
    if let Some(user_id) = on_call.and_then(|c| c.user_id)
        && !people.contains(&user_id)
    {
        people.push(user_id);
    }
    Ok(people)
}

/// Active nurses rostered on a ward for one shift.
pub async fn ward_nurses(
    tx: &mut PgConnection,
    tenant_id: Uuid,
    ward_id: Uuid,
    (date, shift): (NaiveDate, &str),
) -> Result<Vec<Uuid>, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT DISTINCT person FROM nurse_shift_assignments nsa \
         CROSS JOIN LATERAL unnest(ARRAY[nsa.nurse_user_id, nsa.charge_nurse_user_id]) AS person \
          JOIN users u ON u.id = person AND u.is_active = true AND u.deleted_at IS NULL \
         WHERE nsa.tenant_id = $1 AND nsa.ward_id = $2 AND nsa.deleted_at IS NULL \
           AND nsa.shift_date = $3 AND nsa.shift_type = $4 \
         ORDER BY person LIMIT $5",
    )
    .bind(tenant_id)
    .bind(ward_id)
    .bind(date)
    .bind(shift)
    .bind(PAGE_LIMIT)
    .fetch_all(&mut *tx)
    .await?)
}

/// Every active doctor and nurse: the last resort, never the default.
async fn all_clinicians(tx: &mut PgConnection, tenant_id: Uuid) -> Result<Vec<Uuid>, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT id FROM users \
          WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
            AND role::text IN ('doctor', 'nurse') \
          ORDER BY id LIMIT $2",
    )
    .bind(tenant_id)
    .bind(PAGE_LIMIT)
    .fetch_all(&mut *tx)
    .await?)
}

/// A floor code with no roster: the duty medical officer (tier 2 of the code
/// blue roster, and the hospital-wide on-call) plus every active security
/// guard.
async fn duty_mo_and_security(
    tx: &mut PgConnection,
    tenant_id: Uuid,
) -> Result<Vec<Uuid>, AppError> {
    let mut people: Vec<Uuid> = sqlx::query_scalar(
        "SELECT m.user_id FROM code_blue_team_members m \
           JOIN users u ON u.id = m.user_id AND u.is_active = true AND u.deleted_at IS NULL \
          WHERE m.tenant_id = $1 AND m.code_type = $2 AND m.tier = 2 AND m.deleted_at IS NULL \
         UNION \
         SELECT id FROM users WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
            AND role::text = 'security_guard' \
         LIMIT $3",
    )
    .bind(tenant_id)
    .bind(CODE_BLUE)
    .bind(PAGE_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    let on_call = medbrains_notifications::on_call::current_on_call(tx, tenant_id, None).await?;
    if let Some(user_id) = on_call.and_then(|c| c.user_id)
        && !people.contains(&user_id)
    {
        people.push(user_id);
    }
    Ok(people)
}

/// Team at tier 1 then the higher tiers, each person once.
fn merge(team: &[Uuid], higher: &[(Uuid, i16)]) -> Vec<Recipient> {
    let mut seen = HashSet::new();
    team.iter()
        .map(|u| (*u, 1))
        .chain(higher.iter().copied())
        .filter(|(u, _)| seen.insert(*u))
        .map(|(user_id, tier)| Recipient { user_id, tier })
        .collect()
}

/// A code type in words: `code_pink` → "code pink".
pub fn code_words(code_type: &str) -> String {
    code_type.replace('_', " ")
}

/// What the code screen says about who this round reached.
pub fn note(
    (code_type, round): (&str, i16),
    source: TeamSource,
    count: usize,
    tiers: &HashSet<i16>,
) -> String {
    let code = code_words(code_type);
    let team = match source {
        TeamSource::Roster if code_type == CODE_BLUE => format!("Paged the code team ({count})"),
        TeamSource::Roster => format!("Paged the {code} responders ({count})"),
        TeamSource::WardShift => format!(
            "No code team on the roster: paged the on-call doctor and the ward's shift team ({count})"
        ),
        TeamSource::AllClinicians => {
            format!("No code team on the roster: alerting all clinicians ({count})")
        }
        TeamSource::DutyMoAndSecurity => {
            format!("No {code} roster: alerting the duty medical officer and security ({count})")
        }
        TeamSource::Nobody => {
            return format!("No {code} roster and nobody else to alert: nobody was paged");
        }
    };
    if round <= 1 {
        return team;
    }
    let mut missing = Vec::new();
    if !tiers.contains(&2) {
        missing.push("no duty medical officer on the roster");
    }
    if round >= 3 && !tiers.contains(&3) {
        missing.push("no medical superintendent on the roster");
    }
    let escalated = if round >= 3 {
        "the duty medical officer and the medical superintendent"
    } else {
        "the duty medical officer"
    };
    let gaps = if missing.is_empty() {
        String::new()
    } else {
        format!(" ({})", missing.join(", "))
    };
    format!("No response: round {round} re-paged the team and {escalated}{gaps}. {team}.")
}

#[cfg(test)]
mod tests {
    use super::{HashSet, Recipient, TeamSource, current_shift, merge, note, top_tier};
    use chrono::NaiveDate;
    use uuid::Uuid;

    fn at(day: u32, h: u32, m: u32) -> chrono::NaiveDateTime {
        NaiveDate::from_ymd_opt(2026, 11, day)
            .and_then(|d| d.and_hms_opt(h, m, 0))
            .unwrap_or_default()
    }

    #[test]
    fn the_fallback_says_it_is_alerting_everyone() {
        let none = HashSet::new();
        assert_eq!(
            note(("code_blue", 1), TeamSource::AllClinicians, 42, &none),
            "No code team on the roster: alerting all clinicians (42)"
        );
        assert_eq!(
            note(("code_blue", 1), TeamSource::Roster, 4, &none),
            "Paged the code team (4)"
        );
        assert_eq!(
            note(("code_pink", 1), TeamSource::DutyMoAndSecurity, 3, &none),
            "No code pink roster: alerting the duty medical officer and security (3)"
        );
    }

    #[test]
    fn a_later_round_names_the_tier_it_added_and_the_one_missing() {
        let tiers: HashSet<i16> = [2].into_iter().collect();
        let text = note(("code_blue", 3), TeamSource::Roster, 6, &tiers);
        assert!(text.contains("round 3"), "{text}");
        assert!(
            text.contains("no medical superintendent on the roster"),
            "{text}"
        );
        assert!(!text.contains("no duty medical officer"), "{text}");
    }

    #[test]
    fn at_two_in_the_morning_the_night_shift_is_yesterdays() {
        assert_eq!(current_shift(at(8, 2, 0)), (at(7, 0, 0).date(), "night"));
        assert_eq!(current_shift(at(8, 23, 30)), (at(8, 0, 0).date(), "night"));
        assert_eq!(current_shift(at(8, 7, 0)), (at(8, 0, 0).date(), "day"));
        assert_eq!(current_shift(at(8, 18, 0)), (at(8, 0, 0).date(), "evening"));
    }

    #[test]
    fn tiers_grow_with_the_round_and_stop_at_three() {
        assert_eq!([0, 1, 2, 3, 9].map(top_tier), [1, 1, 2, 3, 3]);
    }

    #[test]
    fn a_person_on_two_tiers_is_paged_once_at_the_lowest() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let out = merge(&[a], &[(a, 2), (b, 3)]);
        assert_eq!(
            out,
            vec![
                Recipient {
                    user_id: a,
                    tier: 1
                },
                Recipient {
                    user_id: b,
                    tier: 3
                }
            ]
        );
    }
}
