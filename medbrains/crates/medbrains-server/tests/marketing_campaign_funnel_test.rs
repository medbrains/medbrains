mod common;

use uuid::Uuid;

/// Helper: unique 10-digit Indian mobile so parallel runs do not collide.
fn mobile() -> String {
    let digits: String = Uuid::new_v4()
        .as_u128()
        .to_string()
        .chars()
        .filter(char::is_ascii_digit)
        .take(8)
        .collect();
    format!("96{digits}")
}

/// A campaign that produced nothing still appears, with zeroes.
///
/// The counts are LEFT-joined for this reason. A campaign missing from the
/// funnel reads as an unmeasured campaign — the marketing head scrolls the
/// report, does not see last month's radio spend, and concludes the data is
/// incomplete rather than that the spend converted nobody. Being able to stop
/// paying for what does not convert is the entire point of the report, and it
/// only works if zero is shown rather than omitted.
///
/// It also checks that `won` follows the `is_won` flag rather than a stage
/// name. Stages are tenant-configurable data; a clinic renaming "Procedure"
/// must not silently break its own attribution.
#[tokio::test]
async fn a_campaign_with_no_enquiries_still_appears_and_won_follows_the_flag() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let barren_name = format!("radio-{}", &Uuid::new_v4().to_string()[..8]);
    let earning_name = format!("search-{}", &Uuid::new_v4().to_string()[..8]);

    let create_campaign = |name: String| {
        let client = app.client.clone();
        let url = app.url("/api/marketing/campaigns");
        let csrf = csrf.clone();
        async move {
            let resp = client
                .post(url)
                .header("x-csrf-token", &csrf)
                .json(&serde_json::json!({
                    "name": name,
                    "channel": "paid",
                    "source": "test",
                    "spend_minor": 500_000,
                }))
                .send()
                .await
                .expect("create campaign");
            assert_eq!(resp.status(), reqwest::StatusCode::OK, "create campaign");
            let body: serde_json::Value = resp.json().await.expect("campaign json");
            body["id"].as_str().unwrap_or_default().parse::<Uuid>().expect("campaign id")
        }
    };

    let barren = create_campaign(barren_name.clone()).await;
    let earning = create_campaign(earning_name.clone()).await;

    // One enquiry against the earning campaign, moved to the won stage.
    let phone = mobile();
    let contact_resp = app
        .client
        .post(app.url("/api/marketing/contacts"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "display_name": "Funnel Test",
            "phone": phone,
            "source": "test",
            "campaign_id": earning,
        }))
        .send()
        .await
        .expect("create contact");
    assert_eq!(contact_resp.status(), reqwest::StatusCode::OK, "create contact");
    let contact: serde_json::Value = contact_resp.json().await.expect("contact json");
    let contact_id: Uuid = contact["id"].as_str().unwrap_or_default().parse().expect("contact id");

    // The won stage is whichever one carries is_won — not a name.
    let stages: serde_json::Value = app
        .client
        .get(app.url("/api/marketing/stages"))
        .send()
        .await
        .expect("stages")
        .json()
        .await
        .expect("stages json");
    let won_stage = stages
        .as_array()
        .and_then(|rows| rows.iter().find(|s| s["is_won"].as_bool() == Some(true)))
        .and_then(|s| s["id"].as_str())
        .and_then(|s| s.parse::<Uuid>().ok())
        .expect("a stage flagged is_won");

    let moved = app
        .client
        .post(app.url(&format!("/api/marketing/contacts/{contact_id}/stage")))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "stage_id": won_stage }))
        .send()
        .await
        .expect("move stage");
    assert_eq!(moved.status(), reqwest::StatusCode::OK, "move stage");

    let funnel: serde_json::Value = app
        .client
        .get(app.url("/api/marketing/reports/campaign-funnel"))
        .send()
        .await
        .expect("funnel")
        .json()
        .await
        .expect("funnel json");
    let rows = funnel.as_array().expect("funnel rows");

    let find = |id: Uuid| {
        rows.iter()
            .find(|r| r["campaign_id"].as_str().and_then(|s| s.parse::<Uuid>().ok()) == Some(id))
            .unwrap_or_else(|| panic!("campaign {id} missing from the funnel"))
    };

    let barren_row = find(barren);
    assert_eq!(barren_row["enquiries"].as_i64(), Some(0), "barren campaign enquiries");
    assert_eq!(barren_row["won"].as_i64(), Some(0), "barren campaign won");

    let earning_row = find(earning);
    assert_eq!(earning_row["enquiries"].as_i64(), Some(1), "earning campaign enquiries");
    assert_eq!(
        earning_row["won"].as_i64(),
        Some(1),
        "a contact on the is_won stage counts as won"
    );
}

/// The enquiry audit reports "no data" rather than a perfect score.
///
/// A hospital that has sent no calls in the window must not be told it misses
/// none of them. The rate is null, not zero — the most flattering possible
/// lie is also the easiest to produce by dividing by an empty denominator.
#[tokio::test]
async fn the_enquiry_audit_reports_no_data_rather_than_a_perfect_rate() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;

    // A one-day window with no calls in it is the empty-denominator case.
    // (Any rows the other tests wrote are older than this window only if they
    //  are backdated, so assert on the shape rather than on emptiness.)
    let audit: serde_json::Value = app
        .client
        .get(app.url("/api/marketing/reports/enquiry-audit?days=1"))
        .send()
        .await
        .expect("audit")
        .json()
        .await
        .expect("audit json");

    assert_eq!(audit["window_days"].as_i64(), Some(1));

    let inbound = audit["inbound_calls"].as_i64().expect("inbound_calls");
    let rate = &audit["missed_call_rate_pct"];
    if inbound == 0 {
        assert!(rate.is_null(), "no calls must report a null rate, got {rate}");
    } else {
        assert!(rate.as_f64().is_some(), "with calls present the rate is a number");
    }

    // by_hour is a staffing view: it must be present even when empty, because
    // an absent array reads as "the report is broken" rather than "nobody
    // called".
    assert!(audit["by_hour"].is_array(), "by_hour must always be an array");
}
