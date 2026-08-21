mod common;

use uuid::Uuid;

/// A clinical cohort brings identities across and nothing else.
///
/// "Call everybody due for a retinopathy screen" is a list of people with
/// diabetes, which is why this is the feature that turns a marketing tool into
/// a processor of health data. The design keeps the criteria on the clinical
/// side and lets only contact ids cross into `mkt_*`.
///
/// This test asserts the three halves of that claim as they appear in the
/// database, not as they appear in a comment:
///
///   1. the cohort's `criteria` column is NULL — the dormancy window cannot be
///      read back out of the marketing schema;
///   2. `criteria_label` is the coarse clinician-written string the campaign
///      shows, and is the ONLY thing describing why the cohort exists;
///   3. a member row carries tenant, cohort, contact and a timestamp — there
///      is no column on `mkt_cohort_members` that could hold a reason, so
///      there is nowhere for one to be added by accident.
#[tokio::test]
async fn a_clinical_cohort_carries_identities_and_no_reason() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    // A patient who has never had an encounter is dormant by any window.
    let suffix = &Uuid::new_v4().to_string()[..8];
    let phone = format!("95{}", &Uuid::new_v4().as_u128().to_string()[..8]);
    let patient_id: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Cohort', 'Fixture', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("UH-{suffix}"))
    .bind(&phone)
    .fetch_one(&app.db)
    .await
    .expect("insert patient");

    // The enquiry side of that person. A patient with no marketing contact is
    // skipped rather than invented, so the fixture has to create one.
    let contact: serde_json::Value = app
        .client
        .post(app.url("/api/marketing/contacts"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "display_name": "Cohort Fixture",
            "phone": phone,
            "source": "test",
            "patient_id": patient_id,
        }))
        .send()
        .await
        .expect("create contact")
        .json()
        .await
        .expect("contact json");
    let contact_id: Uuid = contact["id"].as_str().unwrap_or_default().parse().expect("contact id");

    let cohort: serde_json::Value = app
        .client
        .post(app.url("/api/marketing/cohorts/clinical"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "name": format!("recall-{suffix}"),
            "criteria_label": "annual review due",
            "dormant_days": 30,
        }))
        .send()
        .await
        .expect("create clinical cohort")
        .json()
        .await
        .expect("cohort json");

    let cohort_id: Uuid = cohort["id"].as_str().unwrap_or_default().parse().expect("cohort id");
    assert_eq!(cohort["criteria_kind"].as_str(), Some("clinical"));
    assert!(
        cohort["criteria"].is_null(),
        "a clinical cohort must not carry its criteria into the marketing schema, got {}",
        cohort["criteria"]
    );
    assert_eq!(
        cohort["criteria_label"].as_str(),
        Some("annual review due"),
        "the label is the only thing that says why, and it is coarse on purpose"
    );

    // The database agrees, not just the serialiser.
    let stored_criteria: Option<serde_json::Value> =
        sqlx::query_scalar("SELECT criteria FROM mkt_cohorts WHERE id = $1")
            .bind(cohort_id)
            .fetch_one(&app.db)
            .await
            .expect("read cohort");
    assert!(stored_criteria.is_none(), "criteria is NULL in the row itself");

    let is_member: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mkt_cohort_members \
         WHERE cohort_id = $1 AND contact_id = $2)",
    )
    .bind(cohort_id)
    .bind(contact_id)
    .fetch_one(&app.db)
    .await
    .expect("membership");
    assert!(is_member, "a patient with no encounters is dormant by any window");

    // There is nowhere on the member row for a reason to live. If somebody
    // adds one, this fails before check-marketing-wall ever runs.
    let member_columns: Vec<String> = sqlx::query_scalar(
        "SELECT column_name::text FROM information_schema.columns \
         WHERE table_name = 'mkt_cohort_members' ORDER BY column_name",
    )
    .fetch_all(&app.db)
    .await
    .expect("member columns");
    assert_eq!(
        member_columns,
        vec!["added_at", "cohort_id", "contact_id", "id", "tenant_id"],
        "a member row is an identity and a timestamp — nothing about why"
    );
}

/// The size endpoint returns a number and not a membership list.
///
/// An endpoint that listed a clinical cohort's members alongside why they
/// qualified would be the wall with a door in it. `cohort_size` exists so the
/// marketing side can see how big a send is without learning who is in it or
/// what they have.
#[tokio::test]
async fn cohort_size_returns_a_count_and_not_the_people() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let created: serde_json::Value = app
        .client
        .post(app.url("/api/marketing/cohorts"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "name": format!("sized-{}", &Uuid::new_v4().to_string()[..8]),
            "criteria": { "source": "test" },
        }))
        .send()
        .await
        .expect("create cohort")
        .json()
        .await
        .expect("cohort json");
    let cohort_id = created["id"].as_str().unwrap_or_default();

    let size: serde_json::Value = app
        .client
        .get(app.url(&format!("/api/marketing/cohorts/{cohort_id}/size")))
        .send()
        .await
        .expect("size")
        .json()
        .await
        .expect("size json");

    assert!(size["size"].is_number(), "size is a number");
    let keys: Vec<&str> = size.as_object().map(|o| o.keys().map(String::as_str).collect())
        .unwrap_or_default();
    assert_eq!(
        keys,
        vec!["cohort_id", "size"],
        "the response is a count and an id — no members, no reasons"
    );
}
