//! More than one r8r against one database.
//!
//! Two failures this guards against, both silent. A second worker's scheduler
//! firing every cron a second time — for a nightly patient sync, importing the
//! same records twice. And a starting worker closing another worker's live
//! runs, reporting a healthy execution as dead while it carries on writing.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use serde_json::{Value, json};
use support::{TestServer, greeting_workflow};

fn echoing_workflow() -> Value {
    json!({
        "name": "Echo",
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "say", "type": "set", "name": "Say",
              "parameters": { "mode": "fields", "keepOnlySet": true, "fields": { "ok": "yes" } },
              "position": [200, 0] }
        ],
        "connections": [{ "from": "t", "to": "say", "port": "main" }]
    })
}

fn statuses(server: &TestServer) -> Vec<String> {
    server.raw_column("SELECT status FROM execution_entity ORDER BY started_at")
}

// ================================================================ ownership

#[tokio::test]
async fn a_run_records_which_worker_is_running_it() {
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;
    server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();

    let owners = server.raw_column("SELECT worker_id FROM execution_entity");

    assert_eq!(owners.len(), 1);
    assert!(!owners[0].is_empty(), "a run belongs to somebody");
}

#[tokio::test]
async fn a_worker_announces_itself() {
    let server = TestServer::start();

    let workers = server.raw_column("SELECT id FROM worker_entity");

    assert_eq!(workers.len(), 1);
}

#[tokio::test]
async fn a_second_worker_joins_rather_than_replacing_the_first() {
    let server = TestServer::start();
    let _second = server.second_worker("ward-b");

    let workers = server.raw_column("SELECT id FROM worker_entity ORDER BY id");

    assert_eq!(workers.len(), 2);
    assert!(workers.contains(&"ward-b".to_owned()));
}

// ================================================================= recovery

#[tokio::test]
async fn a_worker_closes_its_own_runs_when_it_comes_back() {
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;
    server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();

    // Stand in for a crash: put the row back the way it looked mid-run.
    server.execute_sql(
        "UPDATE execution_entity SET status = 'running', finished_at = NULL, error = NULL",
    );

    let restarted = server.restart();

    // A worker keeps its name across a restart, which is what lets it
    // recognise its own interrupted runs immediately rather than waiting out
    // the heartbeat timeout for somebody else to notice.
    assert_eq!(statuses(&restarted), ["error"]);
}

#[tokio::test]
async fn a_starting_worker_leaves_another_worker_s_live_run_alone() {
    // The failure this exists for. Worker A is halfway through importing a
    // ward's admissions; worker B starts. Closing A's run would report a
    // healthy execution as dead while it carried on writing — and would send
    // somebody looking for a crash that never happened.
    let first = TestServer::start();
    let id = first.create(echoing_workflow()).await;
    first
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();
    first.execute_sql(
        "UPDATE execution_entity SET status = 'running', finished_at = NULL, error = NULL",
    );

    let _second = first.second_worker("ward-b");

    assert_eq!(statuses(&first), ["running"], "still theirs, still running");
}

#[tokio::test]
async fn a_run_left_by_a_worker_that_never_named_itself_is_closed() {
    // Rows written before workers had names. Whatever was running them is long
    // gone, so whoever notices first closes them.
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;
    server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();
    server.execute_sql(
        "UPDATE execution_entity
            SET status = 'running', finished_at = NULL, error = NULL, worker_id = NULL",
    );

    let joining = server.second_worker("ward-b");

    assert_eq!(statuses(&joining), ["error"]);
}

#[tokio::test]
async fn an_interrupted_run_says_it_was_interrupted_rather_than_that_it_failed() {
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;
    server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();
    server.execute_sql(
        "UPDATE execution_entity SET status = 'running', finished_at = NULL, error = NULL",
    );

    let restarted = server.restart();
    let executions = restarted.get("/rest/executions").await.expect_ok();

    // "Failed" would send somebody looking for a bug in the workflow, when
    // what happened is that the process stopped underneath it.
    let error = executions[0]["error"].as_str().unwrap_or_default();
    assert!(error.contains("interrupted"), "{error}");
}

// ================================================================== leases

#[tokio::test]
async fn exactly_one_worker_holds_a_lease() {
    let first = TestServer::start();
    let second = first.second_worker("ward-b");

    // Both ask at once, as two schedulers ticking would.
    let first_holds = first.claim_lease("scheduler");
    let second_holds = second.claim_lease("scheduler");

    assert!(
        first_holds != second_holds,
        "one of them leads and the other does not"
    );
}

#[tokio::test]
async fn the_holder_keeps_the_lease_while_it_keeps_asking() {
    let first = TestServer::start();
    let second = first.second_worker("ward-b");

    assert!(first.claim_lease("scheduler"));

    // Renewing is the same call. A leader that keeps working keeps leading —
    // otherwise leadership would flap every tick and the in-memory schedule
    // would be thrown away with it.
    for _ in 0..5 {
        assert!(first.claim_lease("scheduler"));
        assert!(!second.claim_lease("scheduler"));
    }
}

#[tokio::test]
async fn leadership_moves_on_when_the_leader_lets_go() {
    let first = TestServer::start();
    let second = first.second_worker("ward-b");

    assert!(first.claim_lease("scheduler"));
    assert!(!second.claim_lease("scheduler"));

    first.release_lease("scheduler");

    // Nobody had to notice the failure or agree on a successor: the next
    // worker to ask simply gets it.
    assert!(second.claim_lease("scheduler"));
}

#[tokio::test]
async fn an_expired_lease_is_taken_by_whoever_asks_next() {
    let first = TestServer::start();
    let second = first.second_worker("ward-b");

    assert!(first.claim_lease("scheduler"));
    // Stand in for the leader dying without tidying up — the reason a lease
    // expires rather than being held by a connection.
    first.execute_sql("UPDATE lease_entity SET expires_at = '2020-01-01T00:00:00Z'");

    assert!(second.claim_lease("scheduler"));
    assert!(!first.claim_lease("scheduler"), "the old leader stood down");
}

#[tokio::test]
async fn two_different_jobs_are_led_independently() {
    let first = TestServer::start();
    let second = first.second_worker("ward-b");

    assert!(first.claim_lease("scheduler"));
    assert!(second.claim_lease("pruning"));

    // A lease names a job, not a leader. Nothing says one worker has to do
    // everything that must happen once.
    assert!(first.claim_lease("scheduler"));
}

#[tokio::test]
async fn a_lease_survives_a_restart_of_the_worker_holding_it() {
    let first = TestServer::start();
    assert!(first.claim_lease("scheduler"));

    let restarted = first.restart();

    // Same name, so it is the same leader as far as the lease is concerned —
    // which is what stops a rolling restart handing leadership around.
    assert!(restarted.claim_lease("scheduler"));
}

// ============================================================ still working

#[tokio::test]
async fn a_second_worker_serves_the_same_workflows() {
    // The point of running two: both answer. Nothing about workers changes
    // what the API does.
    let first = TestServer::start();
    let id = first.create(greeting_workflow("hello")).await;

    let second = first.second_worker("ward-b");
    let seen = second
        .get(&format!("/rest/workflows/{id}"))
        .await
        .expect_ok();

    assert_eq!(seen["name"], json!("Greeter"));
}

// =================================================================== fleet

#[tokio::test]
async fn an_operator_can_see_who_is_running() {
    let first = TestServer::start();
    let second = first.second_worker("ward-b");

    let fleet = second.get("/rest/workers").await.expect_ok();

    // Asked from somewhere that is not the worker in trouble, which is where
    // the question usually comes from.
    assert_eq!(fleet["this"], json!("ward-b"));
    assert_eq!(fleet["workers"].as_array().expect("a list").len(), 2);
}

#[tokio::test]
async fn the_fleet_says_which_worker_is_scheduling() {
    let first = TestServer::start();
    let second = first.second_worker("ward-b");
    assert!(second.claim_lease("scheduler"));

    let fleet = first.get("/rest/workers").await.expect_ok();

    // "Are my schedules firing, and from where" is the first question when a
    // nightly job does not run.
    assert_eq!(fleet["scheduler"], json!("ward-b"));
}

#[tokio::test]
async fn the_fleet_says_nobody_is_scheduling_when_nobody_is() {
    let server = TestServer::start();

    let fleet = server.get("/rest/workers").await.expect_ok();

    assert_eq!(fleet["scheduler"], Value::Null);
}

#[tokio::test]
async fn a_worker_that_has_just_reported_reads_as_alive() {
    let server = TestServer::start();

    let fleet = server.get("/rest/workers").await.expect_ok();

    assert_eq!(fleet["workers"][0]["alive"], json!(true));
}

#[tokio::test]
async fn a_worker_that_stopped_reporting_reads_as_gone() {
    let server = TestServer::start();
    // Stand in for a worker that died without tidying up.
    server.execute_sql("UPDATE worker_entity SET seen_at = '2020-01-01T00:00:00Z'");

    let fleet = server.get("/rest/workers").await.expect_ok();

    assert_eq!(fleet["workers"][0]["alive"], json!(false));
}

// ============================================================== scheduling

/// A workflow that fires every second, so a scheduler tick has something to do.
fn ticking_workflow() -> Value {
    json!({
        "name": "Every second",
        "nodes": [
            { "id": "t", "type": "schedule", "name": "Tick",
              "parameters": { "cron": "* * * * * *" }, "position": [0, 0] },
            { "id": "say", "type": "set", "name": "Say",
              "parameters": { "mode": "fields", "keepOnlySet": true,
                              "fields": { "ok": "yes" } },
              "position": [200, 0] }
        ],
        "connections": [{ "from": "t", "to": "say", "port": "main" }]
    })
}

async fn activate(server: &TestServer, workflow: Value) -> String {
    let id = server.create(workflow).await;
    server
        .patch(
            &format!("/rest/workflows/{id}/activate"),
            json!({ "active": true }),
        )
        .await
        .expect_ok();
    id
}

/// Long enough for several scheduler ticks, short enough to stay a test.
const SEVERAL_TICKS: std::time::Duration = std::time::Duration::from_millis(2_500);

#[tokio::test]
async fn a_scheduler_that_does_not_hold_the_lease_fires_nothing() {
    // The failure this whole thing exists for. When each cron is next due is
    // held in memory, so two schedulers each keep their own copy and fire
    // every scheduled workflow twice — for a nightly patient sync, that means
    // importing the same records twice.
    let first = TestServer::start();
    let second = first.second_worker("ward-b");
    activate(&first, ticking_workflow()).await;

    // The other worker is leading, and keeps leading for the whole test: a
    // lease is renewed by its holder, not contested every tick.
    assert!(second.claim_lease("scheduler"));

    tokio::spawn(r8r_cli::scheduling::run(first.state()));
    tokio::time::sleep(SEVERAL_TICKS).await;

    let runs = first.raw_column("SELECT id FROM execution_entity");
    assert!(
        runs.is_empty(),
        "a worker that is not leading fired {} times",
        runs.len()
    );
}

#[tokio::test]
async fn the_worker_holding_the_lease_does_fire() {
    // The other half of the same property: standing down when not leading is
    // only correct if leading means actually doing the work.
    let server = TestServer::start();
    activate(&server, ticking_workflow()).await;

    tokio::spawn(r8r_cli::scheduling::run(server.state()));
    tokio::time::sleep(SEVERAL_TICKS).await;

    let runs = server.raw_column("SELECT id FROM execution_entity");
    assert!(!runs.is_empty(), "the leader fired nothing");
}

#[tokio::test]
async fn leadership_is_taken_by_whoever_is_left_when_the_leader_goes() {
    let first = TestServer::start();
    let second = first.second_worker("ward-b");
    activate(&first, ticking_workflow()).await;

    assert!(second.claim_lease("scheduler"));
    tokio::spawn(r8r_cli::scheduling::run(first.state()));

    // Nothing fires while somebody else leads.
    tokio::time::sleep(std::time::Duration::from_millis(1_200)).await;
    assert!(
        first
            .raw_column("SELECT id FROM execution_entity")
            .is_empty()
    );

    // The leader stops. Nobody has to notice or agree on a successor.
    second.release_lease("scheduler");
    tokio::time::sleep(SEVERAL_TICKS).await;

    assert!(
        !first
            .raw_column("SELECT id FROM execution_entity")
            .is_empty(),
        "nothing took over when the leader let go"
    );
}

// ================================================================= cleanup

#[tokio::test]
async fn a_pruned_run_takes_its_files_with_it() {
    // The harness keeps five executions per workflow. Without this, the sixth
    // run's arrival would drop the first run's row and leave its attachment on
    // disk with nothing pointing at it — for ever, and once per run.
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;

    // Each run leaves a file behind, as a run that downloaded an attachment
    // would.
    for _ in 0..7 {
        server
            .post(&format!("/rest/workflows/{id}/run"), json!({}))
            .await
            .expect_ok();
        let newest =
            server.raw_column("SELECT id FROM execution_entity ORDER BY started_at DESC LIMIT 1");
        server.store_file(&newest[0]).await;
    }

    let kept = server.raw_column("SELECT id FROM execution_entity");
    assert_eq!(kept.len(), 5, "history is capped");

    let dirs = server.binary_dirs();
    assert_eq!(dirs.len(), 5, "two runs were pruned and took their files");
    for dir in &dirs {
        assert!(kept.contains(dir), "{dir} outlived its run");
    }
}

#[tokio::test]
async fn deleting_a_run_removes_the_files_it_produced() {
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;
    server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();

    let runs = server.raw_column("SELECT id FROM execution_entity");
    server.store_file(&runs[0]).await;
    assert_eq!(server.binary_dirs(), vec![runs[0].clone()]);

    server
        .delete(&format!("/rest/executions/{}", runs[0]))
        .await
        .expect_ok();

    assert!(
        server.binary_dirs().is_empty(),
        "the attachment outlived the run it belonged to"
    );
}
