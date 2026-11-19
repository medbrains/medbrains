//! The front desk's one search box: name, phone, UHID or Aadhaar, the server decides.
//!
//! Both patient searches (`GET /api/patients` and `GET /api/patients/find`)
//! match through the SQL built here, so the desk gets the same answer from
//! the directory and the lookup.
//!
//! - **Name**: every word must appear in the first, middle, last or local name,
//!   so "asha sample", "sample asha" and "ash sam" all find Asha Sample.
//! - **Phone**: a query of mostly digits (at least four) is compared digits
//!   only, without a leading `91` or `0`, against the phone and the second phone.
//! - **UHID**: contains, case-insensitive; an exact UHID ranks first.
//! - **Aadhaar**: twelve digits are fingerprinted exactly as registration does
//!   (`identifier_key::keyed_fingerprint`) and matched against
//!   `patient_identifiers.id_number_hash`. The number itself is never bound,
//!   stored or logged; only the keyed fingerprint reaches the database.
//!
//! Ranking: exact UHID, exact phone or Aadhaar first, then names, then partial
//! UHID / phone matches.

use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use uuid::Uuid;

use crate::identifier_key;
use crate::local_name;

/// How many bind parameters [`where_sql`] and [`rank_sql`] use, from the first one.
pub(crate) const BINDS: usize = 5;

/// A stored phone column as digits only, without a leading `91` (12 digits) or `0` (11 digits).
fn phone_digits(column: &str) -> String {
    format!(
        r"regexp_replace(regexp_replace(COALESCE({column}, ''), '\D', '', 'g'), '^(?:91|0)(\d{{10}})$', '\1')"
    )
}

/// What one search box was given, as the values the SQL binds. No `Debug`:
/// nothing here should be printed, though the raw Aadhaar is already gone.
pub(crate) struct PatientSearch {
    /// The query, words single-spaced, for the exact-UHID rank and fuzzy names.
    exact: String,
    /// The words, LIKE-escaped, space separated.
    words: String,
    /// A query typed in an Indian script, LIKE-escaped; empty otherwise.
    local: String,
    /// Phone digits, normalised like [`phone_digits`]; empty when not a phone.
    digits: String,
    /// The Aadhaar fingerprint; empty when the query is not twelve digits.
    aadhaar: String,
}

impl PatientSearch {
    /// Parse the request's query, fetching the fingerprint key only for an Aadhaar-shaped one.
    pub(crate) async fn for_request(
        state: &AppState,
        tenant_id: Uuid,
        query: Option<&str>,
    ) -> Result<Option<Self>, AppError> {
        let Some(query) = query else {
            return Ok(None);
        };
        let key = if aadhaar_digits(query).is_some() {
            Some(identifier_key::identifier_key(state).await?)
        } else {
            None
        };
        Ok(Self::parse(query, key.as_deref(), tenant_id))
    }

    /// Split a query into what each column is matched with; `None` for a blank one.
    /// `key` is the identifier fingerprint key, needed only for an Aadhaar query.
    pub(crate) fn parse(query: &str, key: Option<&[u8]>, tenant_id: Uuid) -> Option<Self> {
        let (latin, native) = local_name::search_terms(query.trim());
        let exact = latin.split_whitespace().collect::<Vec<_>>().join(" ");
        if exact.is_empty() {
            return None;
        }
        // Twelve bare digits are an Aadhaar number and only that: binding them
        // as a name, UHID or phone would hand the number itself to the
        // database (and to any statement log). A phone with its country code
        // is typed with `+91`, which is not Aadhaar-shaped.
        if let Some(digits) = aadhaar_digits(query) {
            let aadhaar = key.map_or_else(String::new, |key| {
                identifier_key::keyed_fingerprint(key, tenant_id, "aadhaar", &digits)
            });
            return Some(Self {
                exact: String::new(),
                words: String::new(),
                local: String::new(),
                digits: String::new(),
                aadhaar,
            });
        }
        Some(Self {
            words: like_escape(&exact),
            local: native.as_deref().map(like_escape).unwrap_or_default(),
            digits: phone_query_digits(query).unwrap_or_default(),
            aadhaar: String::new(),
            exact,
        })
    }

    /// The bind values in placeholder order, [`BINDS`] of them.
    pub(crate) fn binds(&self) -> [String; BINDS] {
        [
            self.exact.clone(),
            self.words.clone(),
            self.local.clone(),
            self.digits.clone(),
            self.aadhaar.clone(),
        ]
    }

    /// The query as typed (words single-spaced), for a fuzzy name match.
    pub(crate) fn exact(&self) -> &str {
        &self.exact
    }
}

/// Twelve digits, spaces or hyphens allowed between them, is an Aadhaar number.
fn aadhaar_digits(query: &str) -> Option<String> {
    let shaped = query
        .trim()
        .chars()
        .all(|c| c.is_ascii_digit() || c == ' ' || c == '-');
    // Reuses registration's normaliser, so search and registration agree on the digits.
    shaped
        .then(|| crate::normalize_aadhaar_number(query))
        .flatten()
}

/// A phone-shaped query (at least four digits; otherwise only spaces, `+`, `-`,
/// brackets) as digits, without a leading `91` (12 digits) or `0` (11 digits).
fn phone_query_digits(query: &str) -> Option<String> {
    let query = query.trim();
    let shaped = query
        .chars()
        .all(|c| c.is_ascii_digit() || " +-()".contains(c));
    let digits: String = query.chars().filter(char::is_ascii_digit).collect();
    if !shaped || digits.len() < 4 {
        return None;
    }
    let national = match digits.len() {
        12 => digits.strip_prefix("91"),
        11 => digits.strip_prefix('0'),
        _ => None,
    };
    Some(national.unwrap_or(&digits).to_owned())
}

/// Escape LIKE's wildcards so a typed `%` or `_` matches itself.
fn like_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

/// The three tiers of a match, as SQL over `patients`, binds from `$first`.
struct Tiers {
    strong: String,
    name: String,
    partial: String,
}

/// Build the tiers. Placeholders: exact, words, local, digits, aadhaar.
fn tiers(first: usize) -> Tiers {
    let (e, w, l, d, a) = (first, first + 1, first + 2, first + 3, first + 4);
    let (phone, phone2) = (phone_digits("phone"), phone_digits("phone_secondary"));
    let strong = format!(
        "(lower(uhid) = lower(${e}) \
          OR (${d} <> '' AND ({phone} = ${d} OR {phone2} = ${d})) \
          OR (${a} <> '' AND EXISTS (SELECT 1 FROM patient_identifiers pi \
               WHERE pi.tenant_id = patients.tenant_id AND pi.patient_id = patients.id \
                 AND pi.id_type = 'aadhaar' AND pi.deleted_at IS NULL \
                 AND pi.id_number_hash = ${a})))"
    );
    // ponytail: per-row word scan, no index; fine at a few lakh patients,
    // a trigram index on the concatenated name if the register outgrows it.
    let name = format!(
        "((${w} <> '' AND NOT EXISTS (SELECT 1 FROM unnest(string_to_array(${w}, ' ')) AS sw(t) \
            WHERE concat_ws(' ', first_name, middle_name, last_name, full_name_local) \
                  NOT ILIKE '%' || sw.t || '%')) \
          OR (${l} <> '' AND full_name_local LIKE '%' || ${l} || '%'))"
    );
    let raw = |c: &str| format!(r"regexp_replace(COALESCE({c}, ''), '\D', '', 'g')");
    let partial = format!(
        "((${w} <> '' AND uhid ILIKE '%' || ${w} || '%') \
          OR (${d} <> '' AND ({} LIKE '%' || ${d} || '%' OR {} LIKE '%' || ${d} || '%')))",
        raw("phone"),
        raw("phone_secondary"),
    );
    Tiers {
        strong,
        name,
        partial,
    }
}

/// The search's WHERE predicate over `patients`, binding [`BINDS`] values from `$first`.
pub(crate) fn where_sql(first: usize) -> String {
    let t = tiers(first);
    format!("({} OR {} OR {})", t.strong, t.name, t.partial)
}

/// The search's rank over `patients`: 0 exact UHID / phone / Aadhaar, 1 name,
/// 2 partial UHID / phone, 3 not matched here. Same binds as [`where_sql`].
pub(crate) fn rank_sql(first: usize) -> String {
    let t = tiers(first);
    format!(
        "(CASE WHEN {} THEN 0 WHEN {} THEN 1 WHEN {} THEN 2 ELSE 3 END)",
        t.strong, t.name, t.partial
    )
}

#[cfg(test)]
mod tests {
    #![allow(clippy::panic)]
    use super::{PatientSearch, aadhaar_digits, phone_query_digits, where_sql};
    use uuid::Uuid;

    /// Every way the desk types a phone number comes down to the same ten digits.
    #[test]
    fn phone_forms_normalise() {
        for q in [
            "9000012345",
            "90000 12345",
            "+919000012345",
            "+91 90000 12345",
            "09000012345",
        ] {
            assert_eq!(phone_query_digits(q).as_deref(), Some("9000012345"), "{q}");
        }
        assert_eq!(phone_query_digits("12345").as_deref(), Some("12345"));
        assert_eq!(phone_query_digits("123"), None);
        assert_eq!(phone_query_digits("asha 12345"), None);
    }

    /// Only twelve digits (spaces allowed) is an Aadhaar; a `+91` phone is not.
    #[test]
    fn aadhaar_shape() {
        assert!(aadhaar_digits("1234 5678 9012").is_some());
        assert!(aadhaar_digits("123456789012").is_some());
        assert!(aadhaar_digits("+919000012345").is_none());
        // Without the `+`, twelve digits are taken as an Aadhaar number.
        assert!(aadhaar_digits("919000012345").is_some());
        assert!(aadhaar_digits("12345678901").is_none());
        assert!(aadhaar_digits("abcd12345678901").is_none());
    }

    /// Without the key, an Aadhaar-shaped query binds no fingerprint; with it,
    /// the fingerprint is registration's and the digits are never bound.
    #[test]
    fn aadhaar_binds_only_the_fingerprint() {
        let tenant = Uuid::nil();
        let q = "1234 5678 9012";
        let without = PatientSearch::parse(q, None, tenant).map(|s| s.aadhaar);
        assert_eq!(without.as_deref(), Some(""));
        let key = b"search-test-key";
        let Some(with) = PatientSearch::parse(q, Some(key), tenant) else {
            panic!("a twelve-digit query is a search");
        };
        let expected =
            crate::identifier_key::keyed_fingerprint(key, tenant, "aadhaar", "123456789012");
        assert_eq!(with.aadhaar, expected);
        let binds = with.binds();
        assert!(
            binds
                .iter()
                .all(|b| !b.contains("5678") && !b.contains("9012"))
        );
    }

    /// Blank queries are no search; words are single-spaced and LIKE-escaped.
    #[test]
    fn words_and_escapes() {
        assert!(PatientSearch::parse("   ", None, Uuid::nil()).is_none());
        let Some(s) = PatientSearch::parse("  Asha   50%_ ", None, Uuid::nil()) else {
            panic!("a search");
        };
        assert_eq!(s.exact, "Asha 50%_");
        assert_eq!(s.words, "Asha 50\\%\\_");
    }

    /// The predicate uses exactly its five placeholders, so a caller's bind
    /// count cannot drift from the SQL.
    #[test]
    fn placeholders_are_contiguous() {
        let sql = where_sql(7);
        for n in 7..12 {
            assert!(sql.contains(&format!("${n}")), "${n}");
        }
        assert!(!sql.contains("$6") && !sql.contains("$12"));
    }
}

#[cfg(test)]
mod db_tests {
    // The desk's search against a real database, as the request role under RLS:
    // name words, phone forms, UHID, Aadhaar, ranking, tenant wall, soft delete.
    //
    //   `make test-db && cargo test -p medbrains-patients search::db_tests`
    //
    // Patients are planted as the owner; the Aadhaar goes in through
    // registration's own `persist_registration_identifiers` with registration's
    // fingerprint, so search is proved against what registration stores.
    #![allow(clippy::expect_used, clippy::panic)]

    use medbrains_db_migrations::testing::{APP_ROLE, TestDb, add_tenant, fresh_db};
    use uuid::Uuid;

    use crate::identifier_key::keyed_fingerprint;
    use crate::search::PatientSearch;
    use crate::{MatchResult, find_matches, persist_registration_identifiers};

    /// The fingerprint key for this test; production reads it from the secret store.
    const KEY: &[u8] = b"search-db-test-identifier-key";
    const AADHAAR: &str = "123456789012";

    /// One hospital's planted rows: Asha Sample, plus the patients that test her rank.
    struct Plant {
        tenant: Uuid,
        asha: Uuid,
    }

    /// Insert a patient as the owner and return its id.
    async fn add(
        db: &sqlx::PgPool,
        tenant: Uuid,
        row: (&str, &str, &str, &str),
        deleted: bool,
    ) -> Uuid {
        let (uhid, first, last, phone) = row;
        let id = Uuid::new_v4();
        let deleted_at = if deleted { "now()" } else { "NULL" };
        sqlx::raw_sql(&format!(
            "INSERT INTO patients (id, tenant_id, uhid, first_name, last_name, gender, phone, deleted_at) \
             VALUES ('{id}', '{tenant}', '{uhid}', '{first}', '{last}', 'female', '{phone}', {deleted_at})"
        ))
        .execute(db)
        .await
        .expect("insert patient");
        id
    }

    /// Store the Aadhaar exactly as registration does: masked number, keyed fingerprint.
    async fn add_aadhaar(app: &sqlx::PgPool, tenant: Uuid, patient: Uuid) {
        let mut tx = app.begin().await.expect("tx");
        medbrains_kernel::enter_scope(&mut tx, &tenant, &[])
            .await
            .expect("context");
        let fp = keyed_fingerprint(KEY, tenant, "aadhaar", AADHAAR);
        persist_registration_identifiers(
            &mut tx,
            tenant,
            patient,
            None,
            None,
            Some(AADHAAR),
            Some(&fp),
        )
        .await
        .expect("identifiers");
        tx.commit().await.expect("commit");
    }

    /// A hospital with Asha (with Aadhaar), a deleted Asha twin, and two near misses.
    async fn plant(db: &TestDb, code: &str) -> Plant {
        let owner = db.owner().await.expect("owner");
        let app = db.connect(APP_ROLE).await.expect("app");
        let tenant = add_tenant(&owner, code).await.expect("tenant");
        let asha = add(
            &owner,
            tenant,
            (
                &format!("{code}-000101"),
                "Asha",
                "Sample",
                "+91 90000 12345",
            ),
            false,
        )
        .await;
        add_aadhaar(&app, tenant, asha).await;
        let twin = add(
            &owner,
            tenant,
            (
                &format!("{code}-000102"),
                "Asha",
                "Sample",
                "+91 90000 12345",
            ),
            true,
        )
        .await;
        add_aadhaar(&app, tenant, twin).await;
        // Contains Asha's UHID and her phone digits: a partial match, ranked below her.
        add(
            &owner,
            tenant,
            (&format!("{code}-0001010"), "Ravi", "Kumar", "890000123456"),
            false,
        )
        .await;
        add(
            &owner,
            tenant,
            (&format!("{code}-000200"), "Meena", "Iyer", "9800011111"),
            false,
        )
        .await;
        Plant { tenant, asha }
    }

    /// Run the desk lookup's query as the request role in `tenant`.
    async fn find(db: &TestDb, tenant: Uuid, q: &str) -> Vec<MatchResult> {
        let app = db.connect(APP_ROLE).await.expect("app");
        let mut tx = app.begin().await.expect("tx");
        medbrains_kernel::enter_scope(&mut tx, &tenant, &[])
            .await
            .expect("context");
        let Some(matcher) = PatientSearch::parse(q, Some(KEY), tenant) else {
            return Vec::new();
        };
        find_matches(&mut tx, tenant, &matcher)
            .await
            .expect("search")
    }

    #[tokio::test]
    async fn search_db_finds_by_name_phone_uhid_and_aadhaar() {
        let db = fresh_db().await.expect("test database");
        let a = plant(&db, "SRA").await;
        let b = plant(&db, "SRB").await;
        let other_tenant_ids = [b.asha];

        for q in [
            "asha sample",
            "sample asha",
            "ash sam",
            "  ASHA   sample ",
            "9000012345",
            "90000 12345",
            "+919000012345",
            "09000012345",
            "12345",
            "sra-000101",
            "a-00010",
            "1234 5678 9012",
            "1234-5678-9012",
        ] {
            let rows = find(&db, a.tenant, q).await;
            assert!(rows.iter().any(|r| r.id == a.asha), "{q:?} finds Asha");
            assert!(
                rows.iter().all(|r| !other_tenant_ids.contains(&r.id)),
                "{q:?} stays in its hospital"
            );
            assert_eq!(
                rows.iter().filter(|r| r.first_name == "Asha").count(),
                1,
                "{q:?}: deleted twin hidden"
            );
            let body = serde_json::to_string(&rows).expect("json");
            assert!(
                !body.contains(AADHAAR) && !body.contains("5678"),
                "{q:?}: no Aadhaar in the response"
            );
        }
    }

    #[tokio::test]
    async fn search_db_ranks_exact_first_and_refuses_wrong_aadhaar() {
        let db = fresh_db().await.expect("test database");
        let a = plant(&db, "SRC").await;

        // Exact UHID and exact phone beat the patient whose UHID / phone contains them.
        for q in [
            "src-000101",
            "9000012345",
            "+91 90000 12345",
            "1234 5678 9012",
        ] {
            let rows = find(&db, a.tenant, q).await;
            assert_eq!(
                rows.first().map(|r| r.id),
                Some(a.asha),
                "{q:?} ranks Asha first"
            );
            assert!(
                rows.first().is_some_and(|r| (r.score - 1.0).abs() < 1e-9),
                "{q:?} exact"
            );
        }
        let partial = find(&db, a.tenant, "9000012345").await;
        assert!(
            partial.iter().any(|r| r.first_name == "Ravi"),
            "phone digits contained"
        );
        let names = find(&db, a.tenant, "sample asha").await;
        assert_eq!(names.first().map(|r| r.id), Some(a.asha));

        // A wrong Aadhaar, or a right one without the key, finds nobody.
        assert!(
            find(&db, a.tenant, "9999 8888 7777").await.is_empty(),
            "wrong Aadhaar"
        );
        let app = db.connect(APP_ROLE).await.expect("app");
        let mut tx = app.begin().await.expect("tx");
        medbrains_kernel::enter_scope(&mut tx, &a.tenant, &[])
            .await
            .expect("context");
        let keyless = PatientSearch::parse(AADHAAR, None, a.tenant).expect("search");
        let rows = find_matches(&mut tx, a.tenant, &keyless)
            .await
            .expect("search");
        assert!(rows.is_empty(), "no fingerprint, no match");
        // One shared word is not a name match: at most a fuzzy one, ranked below names.
        let mixed = find(&db, a.tenant, "asha kumar").await;
        assert!(mixed.iter().all(|r| r.score < 0.9), "every word must match");
    }
}
