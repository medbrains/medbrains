mod common;

use uuid::Uuid;

/// Withdrawing consent appends a row; it does not erase the grant.
///
/// DPDP §6 asks what the consent was AT THE MOMENT OF SEND. A boolean flipped
/// to false answers "what is it now" and destroys the only evidence of what it
/// was — so a message sent lawfully in March becomes indistinguishable from
/// one sent unlawfully, and the hospital cannot show which it was.
#[tokio::test]
async fn a_withdrawal_is_a_new_row_and_the_grant_survives_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let contact_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_contacts (tenant_id, primary_phone, source) \
         VALUES ($1, $2, 'test') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("86{}", &Uuid::new_v4().as_u128().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("insert contact");

    let body = serde_json::json!({
        "channel": "sms", "purpose": "promotional", "source": "front_desk",
    });

    for path in ["consent", "consent/withdraw"] {
        let res = app
            .client
            .post(app.url(&format!("/api/marketing/contacts/{contact_id}/{path}")))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
            .await
            .expect("consent write");
        assert!(res.status().is_success(), "{path} rejected: {:?}", res.status());
    }

    let actions: Vec<String> = sqlx::query_scalar(
        "SELECT action FROM mkt_consents \
         WHERE contact_id = $1 AND tenant_id = $2 AND channel = 'sms' \
         ORDER BY occurred_at, id",
    )
    .bind(contact_id)
    .bind(tenant_id)
    .fetch_all(&app.db)
    .await
    .expect("read ledger");

    assert_eq!(
        actions,
        vec!["granted".to_owned(), "withdrawn".to_owned()],
        "both rows must survive — the grant is what proves an earlier send \
         was lawful, and an UPDATE would have destroyed it"
    );

    // The legacy boolean is a cache of the ledger, written in the same
    // transaction so the two cannot disagree about who may be messaged.
    let cached: bool = sqlx::query_scalar("SELECT consent_sms FROM mkt_contacts WHERE id = $1")
        .bind(contact_id)
        .fetch_one(&app.db)
        .await
        .expect("read cached flag");
    assert!(!cached, "the denormalised flag must follow the latest ledger row");
}

/// A suppression outlives the contact it was recorded against.
///
/// This is the whole reason suppression is keyed on the phone number and does
/// not cascade. Retention deletes a contact; the next inbound call runs
/// `resolve_or_create` and manufactures a fresh one with `consent_* = false`,
/// which reads as "not yet asked" and is indistinguishable from "asked and
/// refused". Somebody who said never again would start receiving offers again.
#[tokio::test]
async fn a_suppression_survives_the_contact_being_deleted_and_recreated() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let phone = format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let contact_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_contacts (tenant_id, primary_phone, source) \
         VALUES ($1, $2, 'test') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("+91{phone}"))
    .fetch_one(&app.db)
    .await
    .expect("insert contact");

    let res = app
        .client
        .post(app.url("/api/marketing/suppressions"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "channel": "phone", "value": phone, "reason": "opted_out",
            "note": "Asked at the front desk never to be called again",
        }))
        .send()
        .await
        .expect("add suppression");
    assert!(res.status().is_success(), "suppression rejected: {:?}", res.status());

    // Retention comes round and the enquiry record goes.
    sqlx::query("DELETE FROM mkt_contacts WHERE id = $1")
        .bind(contact_id)
        .execute(&app.db)
        .await
        .expect("delete contact");

    let survived: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_suppressions \
         WHERE tenant_id = $1 AND channel = 'phone' AND value = $2",
    )
    .bind(tenant_id)
    .bind(format!("+91{phone}"))
    .fetch_one(&app.db)
    .await
    .expect("count suppressions");

    assert_eq!(
        survived, 1,
        "the opt-out must outlive the record it was recorded against — \
         otherwise deleting the contact quietly makes them contactable again"
    );
}

/// Suppressing the same number twice is the desk doing its job, not an error.
///
/// Two agents told the same thing by the same patient should both be able to
/// record it. The second write updates the reason rather than failing on the
/// unique index and showing somebody a database error.
#[tokio::test]
async fn suppressing_the_same_number_twice_is_not_an_error() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let phone = format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let body = serde_json::json!({
        "channel": "phone", "value": phone, "reason": "opted_out",
    });

    for attempt in 0..2 {
        let res = app
            .client
            .post(app.url("/api/marketing/suppressions"))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
            .await
            .expect("add suppression");
        assert!(
            res.status().is_success(),
            "attempt {attempt} rejected: {:?}",
            res.status()
        );
    }
}
