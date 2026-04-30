//! Smoke test against a live SpiceDB instance.
//!
//! Run only when `SPICEDB_TEST=1` so CI without a SpiceDB sidecar
//! doesn't fail. Locally:
//!
//!     docker compose up -d spicedb
//!     SPICEDB_TEST=1 cargo test -p medbrains-authz --test spicedb_smoke
//!
//! Verifies write → check → list_accessible → revoke against the
//! schema in `infra/spicedb/schema.zed`.

use medbrains_authz::{
    AuthzBackend, AuthzContext, Subject, backend_spicedb::SpiceDbBackend, relations::Relation,
};
use uuid::Uuid;

fn skip_if_no_spicedb() -> bool {
    std::env::var("SPICEDB_TEST").ok().as_deref() != Some("1")
}

#[tokio::test]
async fn check_write_revoke_roundtrip() {
    if skip_if_no_spicedb() {
        eprintln!("skipping — set SPICEDB_TEST=1 with sidecar running");
        return;
    }

    let backend = SpiceDbBackend::connect("http://localhost:50051", "devsecret")
        .await
        .expect("connect to SpiceDB");

    let tenant_id = Uuid::new_v4();
    let user = Uuid::new_v4();
    let patient = Uuid::new_v4();

    let ctx = AuthzContext {
        tenant_id,
        user_id: user,
        role: "doctor".to_owned(),
        department_ids: vec![],
        is_bypass: false,
    };

    // No grant yet — check returns false.
    let before = backend
        .check(&ctx, Relation::Viewer, "patient", patient)
        .await
        .expect("initial check");
    assert!(!before, "no grant yet");

    // Write owner tuple → user should now have view + edit.
    backend
        .write_tuple(
            &ctx,
            "patient",
            patient,
            Relation::Owner,
            Subject::User(user),
            None,
            Some("test grant".to_owned()),
        )
        .await
        .expect("write owner");

    // Check view (granted via owner).
    let after = backend
        .check(&ctx, Relation::Viewer, "patient", patient)
        .await
        .expect("post-grant check");
    assert!(after, "owner implies view");

    // List accessible should include this patient now.
    let visible = backend
        .list_accessible(&ctx, "patient", Relation::Viewer)
        .await
        .expect("lookup_resources");
    assert!(visible.contains(&patient));

    // Revoke specifically (trait revoke_tuple isn't supported on
    // SpiceDB — must use revoke_specific).
    backend
        .revoke_specific("patient", patient, Relation::Owner, Subject::User(user))
        .await
        .expect("revoke");

    let after_revoke = backend
        .check(&ctx, Relation::Viewer, "patient", patient)
        .await
        .expect("post-revoke check");
    assert!(!after_revoke, "view denied after revoke");
}

#[tokio::test]
async fn list_filters_to_only_granted_resources() {
    if skip_if_no_spicedb() {
        eprintln!("skipping — set SPICEDB_TEST=1");
        return;
    }

    let backend = SpiceDbBackend::connect("http://localhost:50051", "devsecret")
        .await
        .expect("connect");

    let user = Uuid::new_v4();
    let granted_a = Uuid::new_v4();
    let granted_b = Uuid::new_v4();
    let not_granted = Uuid::new_v4();

    let ctx = AuthzContext {
        tenant_id: Uuid::new_v4(),
        user_id: user,
        role: "doctor".to_owned(),
        department_ids: vec![],
        is_bypass: false,
    };

    // Grant view on two patients only.
    for p in [granted_a, granted_b] {
        backend
            .write_tuple(
                &ctx,
                "patient",
                p,
                Relation::Viewer,
                Subject::User(user),
                None,
                None,
            )
            .await
            .expect("write viewer");
    }

    // List accessible patients — should include the two granted, not the third.
    let visible = backend
        .list_accessible(&ctx, "patient", Relation::Viewer)
        .await
        .expect("list_accessible");

    assert!(visible.contains(&granted_a), "granted_a missing from visible list");
    assert!(visible.contains(&granted_b), "granted_b missing");
    assert!(!visible.contains(&not_granted), "not_granted leaked into list");

    // Cleanup so this test is idempotent.
    for p in [granted_a, granted_b] {
        backend
            .revoke_specific("patient", p, Relation::Viewer, Subject::User(user))
            .await
            .ok();
    }
}

#[tokio::test]
async fn bypass_role_short_circuits() {
    if skip_if_no_spicedb() {
        eprintln!("skipping — set SPICEDB_TEST=1");
        return;
    }

    let backend = SpiceDbBackend::connect("http://localhost:50051", "devsecret")
        .await
        .expect("connect");

    let ctx = AuthzContext {
        tenant_id: Uuid::nil(),
        user_id: Uuid::nil(),
        role: "super_admin".to_owned(),
        department_ids: vec![],
        is_bypass: true,
    };

    // Even with no grants, bypass returns true.
    let allowed = backend
        .check(&ctx, Relation::Owner, "patient", Uuid::new_v4())
        .await
        .expect("check");
    assert!(allowed, "bypass role short-circuits");

    // list_accessible returns empty Vec for bypass — handler interprets
    // this as "no filter" by checking ctx.is_bypass.
    let visible = backend
        .list_accessible(&ctx, "patient", Relation::Viewer)
        .await
        .expect("lookup");
    assert!(visible.is_empty(), "bypass returns empty (caller skips filter)");
}
