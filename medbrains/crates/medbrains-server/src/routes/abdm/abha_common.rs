//! Shared by "Verify ABHA" and "Create ABHA": the person-token cache, the
//! profile shape the desk sees, and recording a finished verification.

use std::{
    collections::HashMap,
    sync::{LazyLock, Mutex, PoisonError},
    time::{Duration, Instant},
};

use axum::Json;
use medbrains_abdm::{
    AbhaProfile,
    rules::{AADHAAR_INVALID, MOBILE_INVALID, RESEND_LOCKED, RESEND_LOCKOUT_MINUTES},
};
use serde::Serialize;
use uuid::Uuid;

use super::abha::Abdm;
use crate::{error::AppError, middleware::auth::Claims, state::AppState};

/// ABDM will not send another OTP sooner; the screen counts this down.
pub(crate) const RESEND_AFTER_SECONDS: i64 = 60;
/// "Resend OTP" at most twice per OTP (M1 test cases `CRT_ABHA_106` and
/// `VRFY_ABHA_405`, official M1 test sheet on sandboxcms.abdm.gov.in).
pub(crate) const MAX_RESENDS: i32 = 2;
/// Longest life of an OTP transaction (verification, search or enrolment).
pub(crate) const OTP_TRANSACTION_MINUTES: i32 = 30;
// `check_resend` relies on this: a transaction never outlives the lockout.
const _: () = assert!(OTP_TRANSACTION_MINUTES <= RESEND_LOCKOUT_MINUTES);
/// ABDM's person tokens live at most 30 minutes.
const USER_TOKEN_TTL: Duration = Duration::from_secs(25 * 60);
/// Bound on tokens held at once; expired ones are dropped first.
const MAX_USER_TOKENS: usize = 2_000;

static USER_TOKENS: LazyLock<Mutex<HashMap<Uuid, (String, Instant)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub(crate) fn keep_token(verification: Uuid, token: &str) {
    let mut tokens = USER_TOKENS.lock().unwrap_or_else(PoisonError::into_inner);
    let now = Instant::now();
    tokens.retain(|_, (_, until)| *until > now);
    if tokens.len() >= MAX_USER_TOKENS {
        // ponytail: drop the oldest when full; a desk that loses one restarts.
        if let Some(oldest) = tokens
            .iter()
            .min_by_key(|(_, (_, until))| *until)
            .map(|(k, _)| *k)
        {
            tokens.remove(&oldest);
        }
    }
    tokens.insert(verification, (token.to_owned(), now + USER_TOKEN_TTL));
}

/// The person's token, left in place — the ABHA card can be printed more than once.
pub(crate) fn peek_token(verification: Uuid) -> Option<String> {
    let tokens = USER_TOKENS.lock().unwrap_or_else(PoisonError::into_inner);
    tokens
        .get(&verification)
        .filter(|(_, until)| *until > Instant::now())
        .map(|(token, _)| token.clone())
}

pub(crate) fn take_token(verification: Uuid) -> Option<String> {
    let mut tokens = USER_TOKENS.lock().unwrap_or_else(PoisonError::into_inner);
    tokens
        .remove(&verification)
        .filter(|(_, until)| *until > Instant::now())
        .map(|(token, _)| token)
}

#[derive(Debug, Serialize)]
pub struct AccountChoice {
    pub abha_number: String,
    pub abha_address: Option<String>,
    pub name: Option<String>,
    pub gender: Option<String>,
    pub year_of_birth: Option<String>,
}

/// What ABDM holds for the person, in our shape. Stored with the verification
/// without the photo; the photo travels only in this response.
#[derive(Debug, Clone, Default, Serialize)]
pub struct VerifiedProfile {
    pub abha_number: String,
    pub abha_address: Option<String>,
    pub full_name: Option<String>,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    /// `YYYY-MM-DD` when ABDM has the full date.
    pub date_of_birth: Option<String>,
    pub year_of_birth: Option<String>,
    /// `male`, `female` or `other` — our patient values.
    pub gender: Option<String>,
    pub mobile_masked: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub pincode: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub kyc_verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub photo: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LinkedPatient {
    pub patient_id: Uuid,
    pub uhid: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct VerificationStep {
    pub id: Uuid,
    pub stage: &'static str,
    pub message: Option<String>,
    pub resend_after_seconds: Option<i64>,
    /// Resends still allowed for this OTP; `None` when no OTP is waiting.
    pub resends_left: Option<i32>,
    pub accounts: Vec<AccountChoice>,
    pub profile: Option<VerifiedProfile>,
    /// Another patient here already carries this ABHA.
    pub already_linked: Option<LinkedPatient>,
    /// ABHA addresses ABDM suggests, when creating an ABHA.
    pub suggestions: Vec<String>,
    /// The masked mobile the OTP went to (`******1234`), when known
    /// (`CRT_ABHA_105`).
    pub sent_to: Option<String>,
    /// `sbx` or `abdm`: what follows the `@` of a new ABHA address, so the
    /// screen can count it into the 8–18 characters (`CRT_ABHA_112`).
    pub address_domain: Option<&'static str>,
}

impl VerificationStep {
    /// An OTP is waiting: the pause, both resends, and where it went.
    pub(crate) fn otp_sent(id: Uuid, message: Option<String>) -> Self {
        Self {
            id,
            stage: "otp_sent",
            sent_to: message.as_deref().and_then(masked_mobile_in),
            address_domain: None,
            message,
            resend_after_seconds: Some(RESEND_AFTER_SECONDS),
            resends_left: Some(MAX_RESENDS),
            accounts: Vec::new(),
            profile: None,
            already_linked: None,
            suggestions: Vec::new(),
        }
    }

    /// After a resend: the pause again, and what is left of the cap.
    pub(crate) fn resent(self, used: i32) -> Self {
        Self {
            resends_left: Some(MAX_RESENDS.saturating_sub(used)),
            ..self
        }
    }
}

/// Refuse a resend inside the pause or past the cap. Past the cap the answer
/// is NHA's 30-minute message (`CRT_ABHA_106`): every OTP transaction lives
/// at most 30 minutes from its start (asserted beside [`OTP_TRANSACTION_MINUTES`]), so it
/// ends before 30 minutes pass from its last send — the refusal holds for
/// the whole lockout without a second timestamp.
///
/// # Errors
/// 429 either way, with what to do.
pub(crate) fn check_resend(ready: bool, used: i32) -> Result<(), AppError> {
    if used >= MAX_RESENDS {
        return Err(AppError::TooManyRequests(RESEND_LOCKED.to_owned()));
    }
    if !ready {
        return Err(AppError::TooManyRequests(
            "wait a minute before asking ABDM for another OTP".to_owned(),
        ));
    }
    Ok(())
}

/// `******1234`: a mobile as the screen may show it.
pub(crate) fn mask_mobile(mobile: &str) -> String {
    let d = digits(mobile);
    format!("******{}", &d[d.len().saturating_sub(4)..])
}

/// The masked mobile in ABDM's "OTP sent to … ending with ******1234" or
/// "…XXXXXX1234", masked our way.
pub(crate) fn masked_mobile_in(message: &str) -> Option<String> {
    let chars: Vec<char> = message.chars().collect();
    let masked = |c: char| matches!(c, '*' | 'X' | 'x');
    (0..chars.len().saturating_sub(5)).find_map(|i| {
        let tail: String = chars[i + 2..].iter().take(4).collect();
        (masked(chars[i])
            && masked(chars[i + 1])
            && tail.len() == 4
            && tail.chars().all(|c| c.is_ascii_digit())
            && chars.get(i + 6).is_none_or(|c| !c.is_ascii_digit()))
        .then(|| format!("******{tail}"))
    })
}

/// `91-1234-5678-9012` from any spacing of 14 digits.
pub(crate) fn abha_number_display(value: &str) -> Option<String> {
    let d: String = value.chars().filter(char::is_ascii_digit).collect();
    (d.len() == 14).then(|| format!("{}-{}-{}-{}", &d[..2], &d[2..6], &d[6..10], &d[10..]))
}

pub(crate) const fn env_name(abdm: &Abdm) -> &'static str {
    match abdm.environment {
        medbrains_abdm::AbdmEnvironment::Sandbox => "sandbox",
        medbrains_abdm::AbdmEnvironment::Production => "production",
    }
}

/// The 12 digits of a valid Aadhaar number (length and Verhoeff check
/// digit), else NHA's exact refusal (`CRT_ABHA_104`) — before any OTP.
pub(crate) fn aadhaar_digits(aadhaar: &str) -> Result<String, AppError> {
    medbrains_abdm::rules::aadhaar(aadhaar)
        .ok_or_else(|| AppError::BadRequest(AADHAAR_INVALID.to_owned()))
}

/// The 10 digits of a valid mobile, else NHA's exact refusal
/// (`VRFY_ABHA_301`) — before any search or OTP.
pub(crate) fn mobile_digits(mobile: &str) -> Result<String, AppError> {
    medbrains_abdm::rules::mobile(mobile)
        .ok_or_else(|| AppError::BadRequest(MOBILE_INVALID.to_owned()))
}

/// Only the ASCII digits of `value`.
pub(crate) fn digits(value: &str) -> String {
    value.chars().filter(char::is_ascii_digit).collect()
}

/// Apply one `SET` to the caller's verification.
pub(crate) async fn update(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    set: impl FnOnce(&mut sqlx::QueryBuilder<'_, sqlx::Postgres>),
) -> Result<(), AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let mut q = sqlx::QueryBuilder::new("UPDATE abha_verifications SET ");
    set(&mut q);
    q.push(" WHERE id = ").push_bind(id);
    q.push(" AND tenant_id = ").push_bind(claims.tenant_id);
    q.push(" AND created_by = ").push_bind(claims.sub);
    q.build().execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}

/// Record the verification as done and say whether the ABHA is already on a
/// patient here.
pub(crate) async fn record_verified(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    profile: VerifiedProfile,
) -> Result<Json<VerificationStep>, AppError> {
    let number = digits(&profile.abha_number);
    // The photo is shown to staff in this response and never stored.
    let stored = serde_json::to_value(VerifiedProfile {
        photo: None,
        ..profile.clone()
    })
    .map_err(|e| AppError::Internal(format!("profile json: {e}")))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "UPDATE abha_verifications SET stage = 'verified', verified_at = now(), \
           abha_number = $4, abha_address = $5, profile = $6, accounts = NULL \
         WHERE id = $1 AND tenant_id = $2 AND created_by = $3",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(&number)
    .bind(&profile.abha_address)
    .bind(stored)
    .execute(&mut *tx)
    .await?;
    let already_linked = sqlx::query_as::<_, (Uuid, String, String)>(
        "SELECT p.id, p.uhid, concat_ws(' ', p.first_name, p.last_name) \
         FROM patient_abha_links l JOIN patients p ON p.id = l.patient_id \
         WHERE l.tenant_id = $1 AND l.abha_number = $2 AND l.deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(&number)
    .fetch_optional(&mut *tx)
    .await?
    .map(|(patient_id, uhid, name)| LinkedPatient {
        patient_id,
        uhid,
        name,
    });
    tx.commit().await?;

    Ok(Json(VerificationStep {
        id,
        stage: "verified",
        message: None,
        resend_after_seconds: None,
        resends_left: None,
        accounts: Vec::new(),
        profile: Some(profile),
        already_linked,
        suggestions: Vec::new(),
        sent_to: None,
        address_domain: None,
    }))
}

pub(crate) fn gender_name(code: &str) -> &'static str {
    match code.trim().to_ascii_uppercase().as_str() {
        "M" | "MALE" => "male",
        "F" | "FEMALE" => "female",
        _ => "other",
    }
}

pub(crate) fn to_profile(raw: AbhaProfile) -> Result<VerifiedProfile, AppError> {
    let abha_number = raw
        .abha_number
        .ok_or_else(|| AppError::ServiceUnavailable("ABDM returned no ABHA number".to_owned()))?;
    let part = |v: Option<String>| v.filter(|s| !s.trim().is_empty());
    let date_of_birth = match (&raw.year_of_birth, &raw.month_of_birth, &raw.day_of_birth) {
        (Some(y), Some(m), Some(d)) => {
            match (y.parse::<i32>(), m.parse::<u32>(), d.parse::<u32>()) {
                (Ok(y), Ok(m), Ok(d)) => {
                    chrono::NaiveDate::from_ymd_opt(y, m, d).map(|x| x.to_string())
                }
                _ => None,
            }
        }
        _ => None,
    };
    Ok(VerifiedProfile {
        abha_number,
        abha_address: part(raw.preferred_abha_address),
        full_name: part(raw.name),
        first_name: part(raw.first_name),
        middle_name: part(raw.middle_name),
        last_name: part(raw.last_name),
        date_of_birth,
        year_of_birth: part(raw.year_of_birth),
        gender: raw.gender.as_deref().map(gender_name).map(str::to_owned),
        mobile_masked: part(raw.mobile),
        email: part(raw.email),
        address: part(raw.address),
        pincode: part(raw.pincode),
        state: part(raw.state_name),
        district: part(raw.district_name),
        kyc_verified: raw.kyc_verified.unwrap_or(false),
        photo: part(raw.profile_photo),
    })
}

#[cfg(test)]
mod tests {
    use super::{abha_number_display, gender_name, mask_mobile, masked_mobile_in, to_profile};
    use medbrains_abdm::AbhaProfile;

    /// ABDM's day/month/year become one date; a partial date stays absent
    /// rather than becoming 1 January.
    #[test]
    fn the_profile_date_is_whole_or_absent() {
        let full = AbhaProfile {
            abha_number: Some("91-4173-3253-1234".to_owned()),
            year_of_birth: Some("1991".to_owned()),
            month_of_birth: Some("10".to_owned()),
            day_of_birth: Some("9".to_owned()),
            gender: Some("F".to_owned()),
            ..AbhaProfile::default()
        };
        let p = to_profile(full).ok();
        assert_eq!(
            p.as_ref().and_then(|p| p.date_of_birth.as_deref()),
            Some("1991-10-09")
        );
        assert_eq!(p.and_then(|p| p.gender).as_deref(), Some("female"));

        let year_only = AbhaProfile {
            abha_number: Some("91-4173-3253-1234".to_owned()),
            year_of_birth: Some("1991".to_owned()),
            ..AbhaProfile::default()
        };
        assert_eq!(
            to_profile(year_only).ok().and_then(|p| p.date_of_birth),
            None
        );
    }

    #[test]
    fn an_abha_number_is_sent_in_abdm_display_form() {
        assert_eq!(
            abha_number_display("91 4173 3253 1234").as_deref(),
            Some("91-4173-3253-1234")
        );
        assert_eq!(abha_number_display("9141733253123"), None);
    }

    /// `CRT_ABHA_105`: the masked mobile is found in ABDM's sentence, however
    /// ABDM masks it, and never taken from a longer number.
    #[test]
    fn the_masked_mobile_is_read_from_abdms_message() {
        assert_eq!(
            masked_mobile_in("OTP sent to Aadhaar registered mobile number ending with ******3210")
                .as_deref(),
            Some("******3210")
        );
        assert_eq!(
            masked_mobile_in("We just sent an OTP on the Mobile Number XXXXXX3210").as_deref(),
            Some("******3210")
        );
        assert_eq!(masked_mobile_in("OTP sent"), None);
        assert_eq!(masked_mobile_in("**123456"), None);
        assert_eq!(mask_mobile("9876543210"), "******3210");
    }

    #[test]
    fn genders_map_to_ours() {
        assert_eq!(gender_name("M"), "male");
        assert_eq!(gender_name("T"), "other");
    }
}
