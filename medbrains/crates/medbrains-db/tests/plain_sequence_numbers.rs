//! Plain sequence numbers: an empty prefix and a pad width of 0 give
//! `1`, `2`, `10`, never zero-padded and never empty.
//!
//!   `make test-db && cargo test -p medbrains-db --test plain_sequence_numbers`
//!
//! PostgreSQL's `lpad('8', 0, '0')` is `''`, and `lpad('10', 1, '0')` is
//! `'1'`: lpad truncates to the width. So every SQL formatter must pad to
//! `GREATEST(pad_width, length(n))`. The scan at the bottom keeps it so.

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use std::path::{Path, PathBuf};

use medbrains_db::sequence::next_sequence;
use medbrains_db_migrations::testing::{add_tenant, fresh_db};
use uuid::Uuid;

async fn next(owner: &sqlx::PgPool, tenant: Uuid) -> String {
    let mut tx = owner.begin().await.expect("tx");
    let v = next_sequence(&mut tx, tenant, "PLAIN_TEST", "", 0)
        .await
        .expect("next value");
    tx.commit().await.expect("commit");
    v
}

#[tokio::test]
async fn empty_prefix_and_pad_zero_give_plain_numbers() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let tenant = add_tenant(&owner, "PLAIN").await.expect("tenant");

    assert_eq!(next(&owner, tenant).await, "1");
    assert_eq!(next(&owner, tenant).await, "2");
    sqlx::query(
        "UPDATE sequences SET current_val = 9 WHERE tenant_id = $1 AND seq_type = 'PLAIN_TEST'",
    )
    .bind(tenant)
    .execute(&owner)
    .await
    .expect("jump");
    assert_eq!(next(&owner, tenant).await, "10");

    // The SQL-side formatter, at pad 0, is not empty either. Its first call
    // creates the row (pad 6); then the hospital makes it plain.
    sqlx::query("SELECT public.next_sequence_number($1, 'MLC_NUMBER', 'MLC-')")
        .bind(tenant)
        .execute(&owner)
        .await
        .expect("create the MLC series");
    sqlx::query("UPDATE sequences SET prefix = '', pad_width = 0, current_val = 7 WHERE tenant_id = $1 AND seq_type = 'MLC_NUMBER'")
        .bind(tenant)
        .execute(&owner)
        .await
        .expect("plain MLC series");
    let mlc: String =
        sqlx::query_scalar("SELECT public.next_sequence_number($1, 'MLC_NUMBER', '')")
            .bind(tenant)
            .fetch_one(&owner)
            .await
            .expect("next MLC number");
    assert_eq!(mlc, "8");
}

#[tokio::test]
async fn the_check_accepts_zero_to_ten_only() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let tenant = add_tenant(&owner, "PADCHK").await.expect("tenant");
    next(&owner, tenant).await;

    for (pad, ok) in [(-1, false), (0, true), (10, true), (11, false)] {
        let res = sqlx::query(
            "UPDATE sequences SET pad_width = $2 WHERE tenant_id = $1 AND seq_type = 'PLAIN_TEST'",
        )
        .bind(tenant)
        .bind(pad)
        .execute(&owner)
        .await;
        assert_eq!(res.is_ok(), ok, "pad_width {pad}: {res:?}");
    }
}

fn sources(dir: &Path, found: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for path in entries.flatten().map(|e| e.path()) {
        if path.is_dir() {
            if path.file_name().is_some_and(|n| n == "target") {
                continue;
            }
            sources(&path, found);
        } else if path.extension().is_some_and(|e| e == "rs" || e == "sql") {
            found.push(path);
        }
    }
}

#[test]
fn every_lpad_of_a_sequence_value_keeps_its_digits() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let mut found = Vec::new();
    sources(root, &mut found);
    assert!(!found.is_empty(), "found no sources to scan");

    let mut bad = Vec::new();
    for path in &found {
        // The archive and oracle are frozen history, not run.
        let shown = path.strip_prefix(root).unwrap().display().to_string();
        if shown.contains("migrations-archive") || shown.contains("/oracle/") {
            continue;
        }
        let Ok(src) = std::fs::read_to_string(path) else {
            continue;
        };
        for (at, _) in src.match_indices("lpad(") {
            let call: String = src[at..(at + 200).min(src.len())]
                .lines()
                .next()
                .unwrap_or("")
                .to_owned();
            if call.contains("pad_width") && !call.contains("GREATEST(") {
                bad.push(format!("{shown}: {}", call.trim()));
            }
        }
    }
    assert!(
        bad.is_empty(),
        "lpad to pad_width alone is empty at pad 0 and truncates longer numbers; \
         pad to GREATEST(pad_width, length(n)):\n  {}",
        bad.join("\n  ")
    );
}
