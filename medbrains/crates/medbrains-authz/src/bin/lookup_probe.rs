//! Diagnostic probe — call list_accessible directly against SpiceDB.
//!
//! Usage: cargo run -p medbrains-authz --bin lookup-probe -- <user_uuid>

use medbrains_authz::backend_spicedb::SpiceDbBackend;
use medbrains_authz::{AuthzBackend, AuthzContext, relations::Relation};
use uuid::Uuid;

#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    let user_id: Uuid = std::env::args()
        .nth(1)
        .ok_or_else(|| anyhow::anyhow!("usage: lookup-probe <user_uuid>"))?
        .parse()?;

    let endpoint = std::env::var("SPICEDB_ENDPOINT")
        .unwrap_or_else(|_| "http://localhost:50051".to_owned());
    let token = std::env::var("SPICEDB_TOKEN").unwrap_or_else(|_| "devsecret".to_owned());

    println!("connecting to {endpoint}…");
    let backend = SpiceDbBackend::connect(&endpoint, &token).await?;
    println!("connected");

    let ctx = AuthzContext {
        user_id,
        tenant_id: Uuid::nil(),
        role: "doctor".to_owned(),
        is_bypass: false,
        department_ids: vec![],
    };

    for object_type in ["patient", "encounter", "admission", "lab_order"] {
        match backend
            .list_accessible(&ctx, object_type, Relation::Viewer)
            .await
        {
            Ok(ids) => println!("{object_type}: {} ids", ids.len()),
            Err(e) => println!("{object_type}: ERROR {e}"),
        }
    }

    Ok(())
}
