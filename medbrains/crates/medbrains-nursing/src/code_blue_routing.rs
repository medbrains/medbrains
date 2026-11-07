//! Who a code blue pages.
//!
//! The page used to go to every active doctor and nurse in the hospital, up
//! to five hundred people, because the attendance table was empty and an
//! on-duty filter would have paged nobody. Paging everyone is not a code
//! team: it is noise that teaches people to ignore the next one.
//!
//! The order now, for round 1:
//! 1. the code team on `code_blue_team_members` (tier 1);
//! 2. otherwise the on-call doctor for the patient's department and the
//!    ward's nurses on today's shift;
//! 3. only when neither resolves, every clinician — and the screen says so.
//!
//! Each later round re-pages the team and adds the next tier from the roster:
//! round 2 the duty medical officer, round 3 onwards the medical
//! superintendent too.

use std::collections::HashSet;

use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::error::AppError;

/// Ceiling on everyone paged in one round, whichever way they were chosen.
const PAGE_LIMIT: i64 = 500;

/// How the code team for a round was found.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TeamSource {
    /// Tier 1 of the hospital's code-blue roster.
    Roster,
    /// The on-call doctor and the ward's shift nurses.
    WardShift,
    /// Nobody resolved: every active doctor and nurse.
    AllClinicians,
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

/// Where the arrest is, as far as the record knows.
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

/// Resolve everyone round `round` pages, deduplicated (lowest tier wins).
pub async fn resolve(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    place: Place,
    round: i16,
) -> Result<Routing, AppError> {
    let roster: Vec<(Uuid, i16)> = sqlx::query_as(
        "SELECT m.user_id, m.tier FROM code_blue_team_members m \
           JOIN users u ON u.id = m.user_id AND u.tenant_id = m.tenant_id \
          WHERE m.tenant_id = $1 AND m.deleted_at IS NULL AND m.tier <= $2 \
            AND u.is_active = true AND u.deleted_at IS NULL \
          ORDER BY m.tier LIMIT $3",
    )
    .bind(tenant_id)
    .bind(top_tier(round))
    .bind(PAGE_LIMIT)
    .fetch_all(&mut **tx)
    .await?;

    let tier_one: Vec<Uuid> = roster
        .iter()
        .filter(|(_, t)| *t == 1)
        .map(|(u, _)| *u)
        .collect();
    let (source, team) = if tier_one.is_empty() {
        let ward = ward_shift(tx, tenant_id, place).await?;
        if ward.is_empty() {
            let all = all_clinicians(tx, tenant_id).await?;
            let source = if all.is_empty() {
                TeamSource::Nobody
            } else {
                TeamSource::AllClinicians
            };
            (source, all)
        } else {
            (TeamSource::WardShift, ward)
        }
    } else {
        (TeamSource::Roster, tier_one)
    };

    let higher: Vec<(Uuid, i16)> = roster.into_iter().filter(|(_, t)| *t > 1).collect();
    let tiers_found: HashSet<i16> = higher.iter().map(|(_, t)| *t).collect();
    let recipients = merge(&team, &higher);
    let note = note(round, source, recipients.len(), &tiers_found);
    Ok(Routing {
        source,
        recipients,
        note,
    })
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

/// The on-call doctor for the patient's department and the ward's nurses on
/// today's roster (charge nurse included).
// ponytail: the whole of today's ward roster, not the current shift's window;
// narrow by `shift_type` once wards record their shift hours.
async fn ward_shift(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    place: Place,
) -> Result<Vec<Uuid>, AppError> {
    let mut people: Vec<Uuid> = match place.ward_id {
        Some(ward_id) => {
            sqlx::query_scalar(
                "SELECT DISTINCT person FROM nurse_shift_assignments nsa \
             CROSS JOIN LATERAL unnest(ARRAY[nsa.nurse_user_id, nsa.charge_nurse_user_id]) \
                  AS person \
              JOIN users u ON u.id = person AND u.is_active = true \
             WHERE nsa.tenant_id = $1 AND nsa.ward_id = $2 AND nsa.deleted_at IS NULL \
               AND nsa.shift_date = (now() AT TIME ZONE COALESCE( \
                     (SELECT timezone FROM tenants WHERE id = $1), 'Asia/Kolkata'))::date \
             LIMIT $3",
            )
            .bind(tenant_id)
            .bind(ward_id)
            .bind(PAGE_LIMIT)
            .fetch_all(&mut **tx)
            .await?
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

/// Every active doctor and nurse: the last resort, never the default.
async fn all_clinicians(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<Vec<Uuid>, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT id FROM users \
          WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
            AND role::text IN ('doctor', 'nurse') \
          ORDER BY id LIMIT $2",
    )
    .bind(tenant_id)
    .bind(PAGE_LIMIT)
    .fetch_all(&mut **tx)
    .await?)
}

/// What the code-blue screen says about who this round reached.
pub fn note(round: i16, source: TeamSource, count: usize, tiers: &HashSet<i16>) -> String {
    let team = match source {
        TeamSource::Roster => format!("Paged the code team ({count})"),
        TeamSource::WardShift => format!(
            "No code team on the roster: paged the on-call doctor and the ward's shift team ({count})"
        ),
        TeamSource::AllClinicians => {
            format!("No code team on the roster: alerting all clinicians ({count})")
        }
        TeamSource::Nobody => {
            return "No code team on the roster and no clinician to alert: nobody was paged"
                .to_owned();
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
    use super::{HashSet, Recipient, TeamSource, merge, note, top_tier};
    use uuid::Uuid;

    #[test]
    fn the_fallback_says_it_is_alerting_everyone() {
        let text = note(1, TeamSource::AllClinicians, 42, &HashSet::new());
        assert_eq!(
            text,
            "No code team on the roster: alerting all clinicians (42)"
        );
        assert_eq!(
            note(1, TeamSource::Roster, 4, &HashSet::new()),
            "Paged the code team (4)"
        );
    }

    #[test]
    fn a_later_round_names_the_tier_it_added_and_the_one_missing() {
        let tiers: HashSet<i16> = [2].into_iter().collect();
        let text = note(3, TeamSource::Roster, 6, &tiers);
        assert!(text.contains("round 3"), "{text}");
        assert!(text.contains("medical superintendent"), "{text}");
        assert!(
            text.contains("no medical superintendent on the roster"),
            "{text}"
        );
        assert!(!text.contains("no duty medical officer"), "{text}");
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
