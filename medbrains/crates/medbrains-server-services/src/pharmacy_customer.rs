//! A pharmacy customer who is not yet a patient: a light record on
//! `patients` itself — name, mobile, address, and a customer number from
//! `sequences` in place of a clinical UHID — flagged `pharmacy_customer`.
//! Made when somebody new orders online after signing in with their mobile,
//! or buys a Schedule H/H1 medicine at the counter. The registration desk's
//! duplicate check finds it later and completes it into a full patient, so
//! their orders stay with the same row. Nothing clinical is made here.

use chrono::NaiveDate;
use medbrains_server_core::error::AppError;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::patient_match::{MatchQuery, fuzzy_matches};

/// The `sequences` row customer numbers come from, and how they read.
pub const CUSTOMER_SEQUENCE: &str = "PHARMACY_CUSTOMER";
pub const CUSTOMER_PREFIX: &str = "PC-";
const CUSTOMER_PAD: i32 = 6;
/// Digits in a mobile number, at least and at most.
const PHONE_DIGITS: std::ops::RangeInclusive<usize> = 10..=15;
/// Longest name kept.
const NAME_MAX: usize = 100;
/// Close matches remembered for the desk, at most.
const MATCHES_KEPT: usize = 5;

/// Where the person was first met.
#[derive(Debug, Clone, Copy)]
pub enum Channel {
    /// The online storefront (`registration_source = online_portal`).
    Online,
    /// The pharmacy counter (`walk_in`).
    Counter,
}

impl Channel {
    const fn source(self) -> &'static str {
        match self {
            Self::Online => "online_portal",
            Self::Counter => "walk_in",
        }
    }
}

/// What a new customer tells us.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct NewCustomer {
    pub name: String,
    pub address: Option<String>,
    pub pincode: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    /// `male`, `female` or `other`; unknown when absent.
    pub gender: Option<String>,
}

fn text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_owned)
}

/// Whether this is a mobile number worth sending a code to.
#[must_use]
pub fn valid_phone(phone: &str) -> bool {
    PHONE_DIGITS.contains(&phone.chars().filter(char::is_ascii_digit).count())
}

/// Somebody a mobile belongs to, as the person holding it is shown when a
/// family shares one number: enough to pick themselves, no more.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Person {
    pub id: Uuid,
    /// First name and the initial of the last.
    pub name: String,
    pub birth_year: Option<i32>,
}

/// People one mobile may name, at most.
const PEOPLE_PER_PHONE: i64 = 10;

/// Everyone registered under this exact mobile — full registrations first,
/// then the oldest. Never a near match.
pub async fn people_with_phone(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    phone: &str,
) -> Result<Vec<Person>, AppError> {
    Ok(sqlx::query_as::<_, Person>(
        "SELECT id, trim(first_name || ' ' || COALESCE(left(NULLIF(last_name, ''), 1), '')) AS name, \
                EXTRACT(YEAR FROM date_of_birth)::int AS birth_year \
           FROM patients \
          WHERE tenant_id = $1 AND phone = $2 AND is_active AND NOT is_merged \
            AND deleted_at IS NULL \
          ORDER BY pharmacy_customer, created_at LIMIT $3",
    )
    .bind(tenant_id)
    .bind(phone)
    .bind(PEOPLE_PER_PHONE)
    .fetch_all(&mut **tx)
    .await?)
}

/// Who a sign-in (or a counter sale) is for.
#[derive(Debug)]
pub enum Found {
    Patient(Uuid),
    /// Several people share this mobile: the holder picks one. Never chosen
    /// for them.
    Choose(Vec<Person>),
    /// Nobody has this mobile: their details make a light record.
    NeedsDetails,
}

/// The person this mobile belongs to; with several, the one `chosen` (which
/// must be one of them); with none, a new light record from `details`.
///
/// The duplicate check runs before a record is made. Somebody similar under
/// another mobile is not signed in as and not merged: the new record names
/// them, for the desk to resolve when the person registers.
pub async fn resolve(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    phone: &str,
    chosen: Option<Uuid>,
    details: Option<&NewCustomer>,
    channel: Channel,
) -> Result<Found, AppError> {
    let people = people_with_phone(tx, tenant_id, phone).await?;
    if let Some(id) = chosen {
        return if people.iter().any(|p| p.id == id) {
            Ok(Found::Patient(id))
        } else {
            Err(AppError::BadRequest(
                "Choose one of the people shown".to_owned(),
            ))
        };
    }
    if people.len() > 1 {
        return Ok(Found::Choose(people));
    }
    if let Some(only) = people.first() {
        return Ok(Found::Patient(only.id));
    }
    let Some(details) = details else {
        return Ok(Found::NeedsDetails);
    };
    create(tx, tenant_id, phone, details, channel)
        .await
        .map(Found::Patient)
}

/// A new light record, after the duplicate check.
pub async fn create(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    phone: &str,
    details: &NewCustomer,
    channel: Channel,
) -> Result<Uuid, AppError> {
    if !valid_phone(phone) {
        return Err(AppError::BadRequest(
            "Enter a 10-digit mobile number".to_owned(),
        ));
    }
    let name = text(Some(&details.name))
        .filter(|n| n.chars().count() <= NAME_MAX)
        .ok_or_else(|| AppError::BadRequest("Enter the name".to_owned()))?;
    let (first, last) = name
        .rsplit_once(' ')
        .map_or((name.as_str(), ""), |(f, l)| (f.trim(), l.trim()));
    let similar = fuzzy_matches(
        tx,
        tenant_id,
        &MatchQuery {
            first_name: first.to_owned(),
            last_name: last.to_owned(),
            date_of_birth: details.date_of_birth,
            phone: phone.to_owned(),
            sex: None,
        },
    )
    .await?;
    let possible: Vec<Uuid> = similar.iter().take(MATCHES_KEPT).map(|m| m.id).collect();
    let number = medbrains_db::sequence::next_sequence(
        tx,
        tenant_id,
        CUSTOMER_SEQUENCE,
        CUSTOMER_PREFIX,
        CUSTOMER_PAD,
    )
    .await?;
    let gender = details
        .gender
        .as_deref()
        .filter(|g| matches!(*g, "male" | "female" | "other"))
        .unwrap_or("unknown");
    Ok(sqlx::query_scalar(
        "INSERT INTO patients \
           (tenant_id, uhid, first_name, last_name, date_of_birth, gender, phone, address, \
            address_line1, registration_source, pharmacy_customer, attributes) \
         VALUES ($1, $2, $3, $4, $5, $6::gender, $7, \
                 jsonb_strip_nulls(jsonb_build_object('line1', $8::text, 'postal_code', $9::text)), \
                 $8, $10::registration_source, true, \
                 jsonb_build_object('pharmacy_customer', \
                     jsonb_build_object('possible_matches', to_jsonb($11::uuid[])))) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(number)
    .bind(first)
    .bind(last)
    .bind(details.date_of_birth)
    .bind(gender)
    .bind(phone)
    .bind(text(details.address.as_deref()))
    .bind(text(details.pincode.as_deref()))
    .bind(channel.source())
    .bind(&possible)
    .fetch_one(&mut **tx)
    .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_mobile_has_ten_to_fifteen_digits() {
        assert!(valid_phone("98400 12345"));
        assert!(valid_phone("+91 98400 12345"));
        assert!(!valid_phone("12345"));
    }
}
