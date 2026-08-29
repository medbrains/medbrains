mod common;

use uuid::Uuid;

/// An enquiry cohort resolves its members instead of reporting zero.
///
/// The criteria were stored and never run: `create_enquiry_cohort` wrote the
/// filter into `mkt_cohorts.criteria` and inserted nothing into
/// `mkt_cohort_members`, so `member_count` was 0 and `refreshed_at` NULL for
/// every enquiry cohort that had ever been made. A list that reports itself
/// as empty on the screen whose whole purpose is to send to it.
#[tokio::test]
async fn an_enquiry_cohort_counts_the_people_it_matched() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    // A source nothing else in the database uses, so the count is exact
    // rather than "at least".
    let source = format!("src-{}", &Uuid::new_v4().to_string()[..8]);
    for _ in 0..3 {
        sqlx::query(
            "INSERT INTO mkt_contacts (tenant_id, primary_phone, source) \
             VALUES ($1, $2, $3)",
        )
        .bind(tenant_id)
        .bind(format!("91{}", &Uuid::new_v4().as_u128().to_string()[..8]))
        .bind(&source)
        .execute(&app.db)
        .await
        .expect("insert contact");
    }

    let cohort: serde_json::Value = app
        .client
        .post(app.url("/api/marketing/cohorts"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "name": format!("cohort-{}", &Uuid::new_v4().to_string()[..8]),
            "criteria": { "source": source },
        }))
        .send()
        .await
        .expect("create cohort")
        .json()
        .await
        .expect("cohort json");

    assert_eq!(
        cohort["member_count"].as_i64(),
        Some(3),
        "the cohort must count the enquiries its own filter matches"
    );
    assert!(
        !cohort["refreshed_at"].is_null(),
        "a resolved cohort has been run, and must say when"
    );
}

/// Re-running a cohort replaces its membership rather than adding to it.
///
/// Appending would make the cohort the union of every filter it has ever
/// had — it would grow and never shrink, and a contact who has moved out of
/// the stage would stay on the recall list permanently.
///
/// The scenario moves a contact out of scope between two runs, so a union
/// would leave the count unchanged and a replacement drops it.
#[tokio::test]
async fn re_running_a_cohort_drops_members_who_no_longer_match() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let source = format!("src-{}", &Uuid::new_v4().to_string()[..8]);
    let mut contacts = Vec::new();
    for _ in 0..2 {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO mkt_contacts (tenant_id, primary_phone, source) \
             VALUES ($1, $2, $3) RETURNING id",
        )
        .bind(tenant_id)
        .bind(format!("90{}", &Uuid::new_v4().as_u128().to_string()[..8]))
        .bind(&source)
        .fetch_one(&app.db)
        .await
        .expect("insert contact");
        contacts.push(id);
    }

    let cohort: serde_json::Value = app
        .client
        .post(app.url("/api/marketing/cohorts"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "name": format!("cohort-{}", &Uuid::new_v4().to_string()[..8]),
            "criteria": { "source": source },
        }))
        .send()
        .await
        .expect("create cohort")
        .json()
        .await
        .expect("cohort json");
    assert_eq!(cohort["member_count"].as_i64(), Some(2));
    let cohort_id = cohort["id"].as_str().expect("cohort id");

    // One of them is re-sourced — it no longer matches the stored filter.
    sqlx::query("UPDATE mkt_contacts SET source = 'moved-away' WHERE id = $1")
        .bind(contacts[0])
        .execute(&app.db)
        .await
        .expect("re-source contact");

    let refreshed: serde_json::Value = app
        .client
        .post(app.url(&format!("/api/marketing/cohorts/{cohort_id}/refresh")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("refresh cohort")
        .json()
        .await
        .expect("refresh json");

    assert_eq!(
        refreshed["member_count"].as_i64(),
        Some(1),
        "the contact that stopped matching must leave the list — a union \
         would still report 2 and would keep calling them forever"
    );

    let rows: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_cohort_members WHERE cohort_id = $1::uuid AND tenant_id = $2",
    )
    .bind(cohort_id)
    .bind(tenant_id)
    .fetch_one(&app.db)
    .await
    .expect("count members");
    assert_eq!(rows, 1, "the stored membership must match the reported count");
}

/// A clinical cohort refuses to refresh, and says why.
///
/// `mkt_cohorts_clinical_opaque` forbids a clinical cohort from carrying its
/// criteria, so there is genuinely nothing to re-run — the dormancy window
/// and department are not recoverable from this schema, deliberately, so that
/// marketing staff cannot read "this list is diabetics" out of it.
///
/// The refusal is therefore the constraint working rather than a gap, and it
/// must be a distinct answer: silently returning the stale list would be
/// worse than either refreshing or failing.
#[tokio::test]
async fn a_clinical_cohort_cannot_be_refreshed_from_the_marketing_side() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    // Inserted directly: creating one through the API needs
    // `cohorts.clinical_define`, and what is under test is the refresh path.
    let cohort_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_cohorts (tenant_id, name, criteria_kind, criteria_label, refreshed_at) \
         VALUES ($1, $2, 'clinical', 'Annual review due', now()) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("recall-{}", &Uuid::new_v4().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("insert clinical cohort");

    let res = app
        .client
        .post(app.url(&format!("/api/marketing/cohorts/{cohort_id}/refresh")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("refresh clinical cohort");

    assert_eq!(
        res.status().as_u16(),
        409,
        "refusing is the constraint working — not 200, which would imply the \
         list was brought up to date, and not 404, which would deny it exists"
    );
}

/// The criteria that turn a list into a worklist.
///
/// Source and stage were the only filters, so "everyone from the Gandhipuram
/// pamphlet run who is still not a patient and nobody has rung in a fortnight"
/// — the campaign a hospital actually wants to send — could not be expressed.
///
/// The fixture makes every exclusion distinct so a regression names itself:
/// one already converted, one contacted yesterday, one in the wrong ward, one
/// in the right ward but converted. Only the two who are unconverted, in the
/// ward, and cold should survive — and one of those has never been contacted
/// at all, which must count as cold rather than being dropped for having no
/// date.
#[tokio::test]
async fn a_cohort_can_ask_for_cold_unconverted_enquiries_from_one_ward() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    let patient_id: Uuid = sqlx::query_scalar("SELECT id FROM patients WHERE tenant_id = $1 LIMIT 1")
        .bind(tenant_id)
        .fetch_one(&app.db)
        .await
        .expect("a seeded patient");

    let ward = format!("Ward-{}", &Uuid::new_v4().to_string()[..8]);
    let mut wanted = Vec::new();

    // (converted, last_contacted_days_ago, in_ward, should_match)
    let cases: [(bool, Option<i32>, bool, bool); 5] = [
        (true, None, true, false),        // already a patient
        (false, Some(1), true, false),    // rung yesterday
        (false, None, false, false),      // wrong ward
        (true, Some(40), true, false),    // in ward and cold, but converted
        (false, Some(30), true, true),    // in ward, cold, unconverted
    ];

    for (i, (converted, contacted_days, in_ward, should_match)) in cases.iter().enumerate() {
        let contact_id: Uuid = sqlx::query_scalar(
            "INSERT INTO mkt_contacts \
                (tenant_id, primary_phone, source, patient_id, last_contacted_at) \
             VALUES ($1, $2, 'test', $3, \
                     CASE WHEN $4::int IS NULL THEN NULL \
                          ELSE now() - make_interval(days => $4) END) \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
        .bind(if *converted { Some(patient_id) } else { None })
        .bind(contacted_days)
        .fetch_one(&app.db)
        .await
        .unwrap_or_else(|e| panic!("insert contact {i}: {e}"));

        sqlx::query(
            "INSERT INTO mkt_touchpoints (tenant_id, contact_id, kind, area_label) \
             VALUES ($1, $2, 'pamphlet', $3)",
        )
        .bind(tenant_id)
        .bind(contact_id)
        .bind(if *in_ward { ward.clone() } else { "Elsewhere".to_owned() })
        .execute(&app.db)
        .await
        .expect("insert touchpoint");

        if *should_match {
            wanted.push(contact_id);
        }
    }

    // One more: in the ward, unconverted, never contacted at all. Cold by any
    // reading, and the NULL is the case a naive `<` comparison silently drops.
    let never_contacted: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_contacts (tenant_id, primary_phone, source) \
         VALUES ($1, $2, 'test') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("insert never-contacted contact");
    sqlx::query(
        "INSERT INTO mkt_touchpoints (tenant_id, contact_id, kind, area_label) \
         VALUES ($1, $2, 'pamphlet', $3)",
    )
    .bind(tenant_id)
    .bind(never_contacted)
    .bind(&ward)
    .execute(&app.db)
    .await
    .expect("insert touchpoint");
    wanted.push(never_contacted);

    let cohort: serde_json::Value = app
        .client
        .post(app.url("/api/marketing/cohorts"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "name": format!("cold-{}", &Uuid::new_v4().to_string()[..8]),
            "criteria": {
                "area": ward,
                "channel": "pamphlet",
                "not_contacted_days": 14,
                "unconverted_only": true,
            },
        }))
        .send()
        .await
        .expect("create cohort")
        .json()
        .await
        .expect("cohort json");

    assert_eq!(
        cohort["member_count"].as_i64(),
        Some(wanted.len() as i64),
        "exactly the unconverted, cold, in-ward enquiries — got {}",
        cohort["member_count"]
    );

    let members: Vec<Uuid> = sqlx::query_scalar(
        "SELECT contact_id FROM mkt_cohort_members \
         WHERE cohort_id = $1::uuid AND tenant_id = $2",
    )
    .bind(cohort["id"].as_str().expect("cohort id"))
    .bind(tenant_id)
    .fetch_all(&app.db)
    .await
    .expect("read members");

    for id in &wanted {
        assert!(members.contains(id), "a matching enquiry was left out: {id}");
    }
    assert!(
        members.contains(&never_contacted),
        "an enquiry nobody has ever rung is the coldest of all and must not be \
         dropped for having no last_contacted_at"
    );
}
