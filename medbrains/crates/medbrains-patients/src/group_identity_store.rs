//! The SQL behind group identity (`group_identity`): the group, the links
//! and candidates of a patient, the scan, decisions and unlinking. Every
//! query runs in a transaction with the tenant set, so row level security
//! limits it to the hospitals the session may see — the whole group only
//! where it shares records.

use medbrains_core::patient::Gender;
use medbrains_server_core::error::AppError;
use medbrains_server_services::patient_match::{self, MatchQuery, MatchResult};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::group_identity::{GroupCandidate, GroupRecord, ScanOutcome};

type Tx<'a> = Transaction<'a, Postgres>;

/// Probable matches kept per scan, at most.
const QUEUED_PER_SCAN: usize = 10;
/// Rows a list returns, at most.
const LIST_LIMIT: i64 = 200;

#[derive(Debug, sqlx::FromRow)]
pub(crate) struct Group {
    pub(crate) id: Uuid,
    pub(crate) name: String,
    pub(crate) share_clinical_records: bool,
}

/// The patient a scan is for, at this hospital.
pub(crate) struct Local {
    pub(crate) group_id: Uuid,
    pub(crate) tenant_id: Uuid,
    pub(crate) patient_id: Uuid,
    pub(crate) user_id: Uuid,
}

const PATIENT_COLS: &str = "p.id, p.uhid, p.first_name, p.last_name, p.date_of_birth, p.phone, \
     p.gender, 1.0::float8 AS score, p.pharmacy_customer";

pub(crate) async fn group(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<Option<Group>, AppError> {
    Ok(sqlx::query_as::<_, Group>(
        "SELECT g.id, g.name, COALESCE(g.share_clinical_records, false) AS share_clinical_records \
           FROM tenants t JOIN hospital_groups g ON g.id = t.group_id AND g.deleted_at IS NULL \
          WHERE t.id = $1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?)
}

#[derive(sqlx::FromRow)]
struct LinkRow {
    link_id: Uuid,
    hospital: String,
    match_method: String,
    linked_at: chrono::DateTime<chrono::Utc>,
    #[sqlx(flatten)]
    patient: MatchResult,
}

/// The other records linked to the same person as `patient_id`.
pub(crate) async fn links_of(
    tx: &mut Tx<'_>,
    patient_id: Uuid,
) -> Result<Vec<GroupRecord>, AppError> {
    let rows = sqlx::query_as::<_, LinkRow>(&format!(
        "SELECT l.id AS link_id, t.name AS hospital, l.match_method, l.linked_at, {PATIENT_COLS} \
           FROM group_patient_links me \
           JOIN group_patient_links l ON l.person_id = me.person_id AND l.patient_id <> me.patient_id \
                AND l.unlinked_at IS NULL AND l.deleted_at IS NULL \
           JOIN patients p ON p.id = l.patient_id \
           JOIN tenants t ON t.id = l.tenant_id \
          WHERE me.patient_id = $1 AND me.unlinked_at IS NULL AND me.deleted_at IS NULL \
          ORDER BY l.linked_at LIMIT {LIST_LIMIT}"
    ))
    .bind(patient_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| GroupRecord {
            link_id: r.link_id,
            hospital: r.hospital,
            match_method: r.match_method,
            linked_at: r.linked_at,
            patient: r.patient,
        })
        .collect())
}

#[derive(sqlx::FromRow)]
struct CandidateRow {
    cid: Uuid,
    hospital: String,
    status: String,
    created_at: chrono::DateTime<chrono::Utc>,
    local_patient_id: Uuid,
    cscore: f64,
    band: String,
    reasons: Vec<String>,
    #[sqlx(flatten)]
    patient: MatchResult,
}

fn candidate(r: CandidateRow) -> GroupCandidate {
    let mut patient = r.patient;
    patient.score = r.cscore;
    patient.band = match r.band.as_str() {
        "likely" => Some(patient_match::MatchBand::Likely),
        _ => Some(patient_match::MatchBand::Review),
    };
    patient.reasons = r.reasons;
    GroupCandidate {
        candidate_id: r.cid,
        hospital: r.hospital,
        status: r.status,
        created_at: r.created_at,
        local_patient_id: r.local_patient_id,
        patient,
    }
}

/// Candidates, each shown from this hospital's side: the record elsewhere.
const CANDIDATE_SELECT: &str = "SELECT c.id AS cid, t.name AS hospital, c.status, c.created_at, \
       CASE WHEN c.tenant_id = $1 THEN c.patient_id ELSE c.other_patient_id END AS local_patient_id, \
       c.score AS cscore, c.band, c.reasons, \
       p.id, p.uhid, p.first_name, p.last_name, p.date_of_birth, p.phone, p.gender, \
       1.0::float8 AS score, p.pharmacy_customer \
  FROM group_identity_candidates c \
  JOIN patients p ON p.id = CASE WHEN c.tenant_id = $1 THEN c.other_patient_id ELSE c.patient_id END \
  JOIN tenants t ON t.id = p.tenant_id \
 WHERE c.deleted_at IS NULL AND (c.tenant_id = $1 OR c.other_tenant_id = $1)";

pub(crate) async fn candidates_of(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Vec<GroupCandidate>, AppError> {
    let rows = sqlx::query_as::<_, CandidateRow>(&format!(
        "{CANDIDATE_SELECT} AND c.status = 'pending' \
           AND (c.patient_id = $2 OR c.other_patient_id = $2) \
         ORDER BY c.score DESC LIMIT {LIST_LIMIT}"
    ))
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().map(candidate).collect())
}

pub(crate) async fn queue(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    status: &str,
) -> Result<Vec<GroupCandidate>, AppError> {
    let rows = sqlx::query_as::<_, CandidateRow>(&format!(
        "{CANDIDATE_SELECT} AND c.status = $2 ORDER BY c.created_at DESC LIMIT {LIST_LIMIT}"
    ))
    .bind(tenant_id)
    .bind(status)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().map(candidate).collect())
}

/// What the scan compares: this hospital's patient.
#[derive(sqlx::FromRow)]
struct Me {
    first_name: String,
    last_name: String,
    date_of_birth: Option<chrono::NaiveDate>,
    phone: String,
    gender: Gender,
}

/// Link the certain matches (verified ABHA, group-keyed Aadhaar), queue the
/// probable ones. One statement per kind; bounded.
pub(crate) async fn scan(tx: &mut Tx<'_>, me: &Local) -> Result<ScanOutcome, AppError> {
    let certain: Vec<(Uuid, Uuid, String)> = sqlx::query_as(
        "SELECT DISTINCT ON (o.patient_id) o.tenant_id, o.patient_id, o.method FROM ( \
           SELECT l2.tenant_id, l2.patient_id, 'abha' AS method, 1 AS rank \
             FROM patient_abha_links l1 \
             JOIN patient_abha_links l2 \
               ON regexp_replace(l2.abha_number, '[^0-9]', '', 'g') \
                = regexp_replace(l1.abha_number, '[^0-9]', '', 'g') \
              AND l2.tenant_id <> l1.tenant_id \
              AND l2.verified_at IS NOT NULL AND l2.unlinked_at IS NULL AND l2.deleted_at IS NULL \
            WHERE l1.patient_id = $1 AND l1.verified_at IS NOT NULL \
              AND l1.unlinked_at IS NULL AND l1.deleted_at IS NULL \
           UNION ALL \
           SELECT f2.tenant_id, f2.patient_id, 'aadhaar', 2 \
             FROM patient_group_fingerprints f1 \
             JOIN patient_group_fingerprints f2 \
               ON f2.group_id = f1.group_id AND f2.kind = f1.kind \
              AND f2.fingerprint = f1.fingerprint AND f2.tenant_id <> f1.tenant_id \
              AND f2.deleted_at IS NULL \
            WHERE f1.patient_id = $1 AND f1.group_id = $2 AND f1.deleted_at IS NULL \
         ) o JOIN tenants t ON t.id = o.tenant_id AND t.group_id = $2 \
         ORDER BY o.patient_id, o.rank LIMIT 20",
    )
    .bind(me.patient_id)
    .bind(me.group_id)
    .fetch_all(&mut **tx)
    .await?;
    let mut linked = 0;
    for (tenant_id, patient_id, method) in &certain {
        if link_pair(tx, me, (*tenant_id, *patient_id), (method, None)).await? {
            linked += 1;
        }
    }
    let queued = queue_probable(tx, me).await?;
    Ok(ScanOutcome { linked, queued })
}

async fn queue_probable(tx: &mut Tx<'_>, me: &Local) -> Result<usize, AppError> {
    let mine: Me = sqlx::query_as(
        "SELECT first_name, last_name, date_of_birth, phone, gender FROM patients WHERE id = $1",
    )
    .bind(me.patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let others = sqlx::query_as::<_, MatchResult>(&format!(
        "SELECT {PATIENT_COLS} FROM patients p JOIN tenants t ON t.id = p.tenant_id \
          WHERE t.group_id = $1 AND p.tenant_id <> $2 \
            AND p.is_merged = false AND p.is_active = true AND p.deleted_at IS NULL \
            AND NOT EXISTS (SELECT 1 FROM group_patient_links a \
                              JOIN group_patient_links b ON b.person_id = a.person_id \
                             WHERE a.patient_id = $3 AND b.patient_id = p.id \
                               AND a.unlinked_at IS NULL AND b.unlinked_at IS NULL \
                               AND a.deleted_at IS NULL AND b.deleted_at IS NULL) \
            AND (similarity(p.first_name, $4) > 0.3 OR similarity(p.last_name, $5) > 0.3 \
                 OR p.date_of_birth = $6 \
                 OR (length($7) = 10 AND right(regexp_replace(p.phone, '[^0-9]', '', 'g'), 10) = $7)) \
          LIMIT 100"
    ))
    .bind(me.group_id)
    .bind(me.tenant_id)
    .bind(me.patient_id)
    .bind(&mine.first_name)
    .bind(&mine.last_name)
    .bind(mine.date_of_birth)
    .bind(last10(&mine.phone))
    .fetch_all(&mut **tx)
    .await?;
    let sex = match mine.gender {
        Gender::Male => Some("male".to_owned()),
        Gender::Female => Some("female".to_owned()),
        Gender::Other | Gender::Unknown => None,
    };
    let q = MatchQuery {
        first_name: mine.first_name,
        last_name: mine.last_name,
        date_of_birth: mine.date_of_birth,
        phone: mine.phone,
        sex,
    };
    let ranked = patient_match::rank(&q, others);
    let mut queued = 0;
    for m in ranked.iter().take(QUEUED_PER_SCAN) {
        let band = match m.band {
            Some(patient_match::MatchBand::Likely) => "likely",
            _ => "review",
        };
        let reasons: Vec<String> = m.reasons.iter().map(|r| (*r).to_owned()).collect();
        let inserted = sqlx::query(
            "INSERT INTO group_identity_candidates \
               (group_id, tenant_id, patient_id, other_tenant_id, other_patient_id, score, band, \
                reasons, found_by) \
             SELECT $1, $2, $3, p.tenant_id, p.id, $5, $6, $7, $8 FROM patients p WHERE p.id = $4 \
             ON CONFLICT DO NOTHING",
        )
        .bind(me.group_id)
        .bind(me.tenant_id)
        .bind(me.patient_id)
        .bind(m.id)
        .bind(m.score)
        .bind(band)
        .bind(&reasons)
        .bind(me.user_id)
        .execute(&mut **tx)
        .await?;
        queued += usize::try_from(inserted.rows_affected()).unwrap_or(0);
    }
    Ok(queued)
}

fn last10(phone: &str) -> String {
    let d: String = phone.chars().filter(char::is_ascii_digit).collect();
    d[d.len().saturating_sub(10)..].to_owned()
}

/// Link `other` to the same person as `me`'s patient: an existing person on
/// either side is reused, and two persons meet as one (their links join).
/// Returns whether anything changed (false: already the same person).
async fn link_pair(
    tx: &mut Tx<'_>,
    me: &Local,
    (other_tenant, other_patient): (Uuid, Uuid),
    (method, score): (&str, Option<f64>),
) -> Result<bool, AppError> {
    let persons: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT patient_id, person_id FROM group_patient_links \
          WHERE patient_id = ANY($1) AND unlinked_at IS NULL AND deleted_at IS NULL",
    )
    .bind(vec![me.patient_id, other_patient])
    .fetch_all(&mut **tx)
    .await?;
    let of = |p: Uuid| {
        persons
            .iter()
            .find(|(id, _)| *id == p)
            .map(|(_, person)| *person)
    };
    let (mine, theirs) = (of(me.patient_id), of(other_patient));
    if mine.is_some() && mine == theirs {
        return Ok(false);
    }
    let person = mine.or(theirs).unwrap_or_else(Uuid::new_v4);
    if let (Some(a), Some(b)) = (mine, theirs)
        && a != b
    {
        sqlx::query(
                "UPDATE group_patient_links SET person_id = $1 \
                  WHERE person_id = $2 AND group_id = $3 AND unlinked_at IS NULL AND deleted_at IS NULL",
            )
            .bind(a)
            .bind(b)
            .bind(me.group_id)
            .execute(&mut **tx)
            .await?;
    }
    for (tenant, patient, how, s) in [
        (me.tenant_id, me.patient_id, method, score),
        (other_tenant, other_patient, method, score),
    ] {
        if of(patient).is_some() {
            continue;
        }
        sqlx::query(
            "INSERT INTO group_patient_links \
               (group_id, person_id, tenant_id, patient_id, match_method, score, linked_by) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(me.group_id)
        .bind(person)
        .bind(tenant)
        .bind(patient)
        .bind(how)
        .bind(s)
        .bind(me.user_id)
        .execute(&mut **tx)
        .await?;
    }
    Ok(true)
}

pub(crate) async fn decide(
    tx: &mut Tx<'_>,
    (group_id, user_id, viewer): (Uuid, Uuid, Uuid),
    id: Uuid,
    link: bool,
    reason: Option<&str>,
) -> Result<GroupCandidate, AppError> {
    let row: (Uuid, Uuid, Uuid, Uuid, f64, String) = sqlx::query_as(
        "SELECT tenant_id, patient_id, other_tenant_id, other_patient_id, score, status \
           FROM group_identity_candidates WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let (tenant_id, patient_id, other_tenant, other_patient, score, status) = row;
    if status != "pending" {
        return Err(AppError::Conflict(format!(
            "This match was already {status}"
        )));
    }
    if link {
        let me = Local {
            group_id,
            tenant_id,
            patient_id,
            user_id,
        };
        link_pair(
            tx,
            &me,
            (other_tenant, other_patient),
            ("probabilistic", Some(score)),
        )
        .await?;
    }
    sqlx::query(
        "UPDATE group_identity_candidates SET status = $2, decided_by = $3, decided_at = now(), \
                decision_reason = $4 WHERE id = $1",
    )
    .bind(id)
    .bind(if link { "linked" } else { "rejected" })
    .bind(user_id)
    .bind(reason)
    .execute(&mut **tx)
    .await?;
    let decided = sqlx::query_as::<_, CandidateRow>(&format!("{CANDIDATE_SELECT} AND c.id = $2"))
        .bind(viewer)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(candidate(decided))
}

pub(crate) async fn unlink(
    tx: &mut Tx<'_>,
    id: Uuid,
    user_id: Uuid,
    reason: &str,
) -> Result<(), AppError> {
    let done = sqlx::query(
        "UPDATE group_patient_links SET unlinked_at = now(), unlinked_by = $2, unlink_reason = $3 \
          WHERE id = $1 AND unlinked_at IS NULL AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(user_id)
    .bind(reason)
    .execute(&mut **tx)
    .await?;
    if done.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
