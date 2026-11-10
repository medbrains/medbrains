//! In-process harness: a real router over a real (temporary) `SQLite` file.
//! No ports are bound, so the suite runs fast and in parallel.

// Each test binary compiles this module separately and uses a different
// slice of it, so unused-helper warnings here are noise, not signal.
#![allow(
    dead_code,
    unreachable_pub,
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use axum::Router;
use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use r8r_cli::config::Config;
use r8r_cli::{build_state, server};
use serde_json::{Value, json};
use tower::ServiceExt;

pub struct TestServer {
    router: Router,
    /// The database every worker in this test shares. Held explicitly rather
    /// than derived from `dir`, because a second worker has no directory of
    /// its own — it joins the first one's.
    db_path: std::path::PathBuf,
    db: std::sync::Arc<r8r_cli::databases::Database>,
    /// Kept so a test can run the scheduler exactly as the binary does.
    state: r8r_cli::server::AppState,
    /// What this particular worker calls itself.
    worker_id: String,
    /// Shared so the temporary directory outlives every worker using it.
    dir: std::sync::Arc<tempfile::TempDir>,
}

pub struct ApiResponse {
    pub status: StatusCode,
    pub body: Value,
    pub headers: axum::http::HeaderMap,
}

impl ApiResponse {
    /// One response header, as text.
    pub fn header(&self, name: &str) -> Option<String> {
        self.headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned)
    }
}

impl ApiResponse {
    pub fn expect_ok(self) -> Value {
        assert!(
            self.status.is_success(),
            "expected 2xx, got {}: {}",
            self.status,
            self.body
        );
        self.body
    }

    pub fn expect_status(self, status: StatusCode) -> Value {
        assert_eq!(self.status, status, "body was {}", self.body);
        self.body
    }

    /// The `{ "error": "..." }` message the API returns on failure.
    pub fn error_message(&self) -> String {
        self.body
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned()
    }
}

impl TestServer {
    pub fn start() -> Self {
        let dir = std::sync::Arc::new(tempfile::tempdir().expect("temp dir"));
        let db_path = dir.path().join("test.sqlite");
        Self::build(dir, db_path, None)
    }

    fn build(
        dir: std::sync::Arc<tempfile::TempDir>,
        db_path: std::path::PathBuf,
        worker_id: Option<String>,
    ) -> Self {
        let config = Config {
            host: "127.0.0.1".into(),
            port: 0,
            database_path: db_path.to_string_lossy().into_owned(),
            ui_dir: None,
            execution_history_limit: 5,
            worker_id,
        };
        let state = build_state(config).expect("state should build");
        let db = state.db.clone();
        let worker_id = state.worker.id.clone();
        TestServer {
            router: server::router(state.clone()),
            db_path,
            db,
            state,
            worker_id,
            dir,
        }
    }

    pub async fn request(&self, method: Method, uri: &str, body: Option<Value>) -> ApiResponse {
        let builder = Request::builder()
            .method(method)
            .uri(uri)
            .header("content-type", "application/json");
        let request = match body {
            Some(value) => builder.body(Body::from(value.to_string())),
            None => builder.body(Body::empty()),
        }
        .expect("request should build");

        let response = self
            .router
            .clone()
            .oneshot(request)
            .await
            .expect("router should respond");
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should read");
        let body = serde_json::from_slice(&bytes)
            .unwrap_or_else(|_| json!(String::from_utf8_lossy(&bytes)));

        ApiResponse {
            status,
            body,
            headers,
        }
    }

    pub async fn get(&self, uri: &str) -> ApiResponse {
        self.request(Method::GET, uri, None).await
    }
    pub async fn post(&self, uri: &str, body: Value) -> ApiResponse {
        self.request(Method::POST, uri, Some(body)).await
    }
    pub async fn patch(&self, uri: &str, body: Value) -> ApiResponse {
        self.request(Method::PATCH, uri, Some(body)).await
    }
    pub async fn delete(&self, uri: &str) -> ApiResponse {
        self.request(Method::DELETE, uri, None).await
    }

    /// Send a webhook request with arbitrary headers. Passing `Value::Null`
    /// sends a genuinely empty body rather than the four bytes `null`.
    pub async fn webhook(
        &self,
        method: Method,
        path: &str,
        headers: &[(&str, &str)],
        body: Value,
    ) -> ApiResponse {
        let mut builder = Request::builder()
            .method(method)
            .uri(format!("/webhook/{path}"))
            .header("content-type", "application/json");
        for (name, value) in headers {
            builder = builder.header(*name, *value);
        }
        let payload = if body.is_null() {
            Body::empty()
        } else {
            Body::from(body.to_string())
        };
        let request = builder.body(payload).expect("request should build");

        let response = self
            .router
            .clone()
            .oneshot(request)
            .await
            .expect("router should respond");
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should read");
        let body = serde_json::from_slice(&bytes)
            .unwrap_or_else(|_| json!(String::from_utf8_lossy(&bytes)));

        ApiResponse {
            status,
            body,
            headers,
        }
    }

    /// Read a column straight out of the database file, so a test can check
    /// what was actually written rather than what the API says it wrote.
    pub fn raw_column(&self, sql: &str) -> Vec<String> {
        let conn = rusqlite::Connection::open(&self.db_path).expect("open the database file");
        let mut stmt = conn.prepare(sql).expect("prepare");
        stmt.query_map([], |row| row.get::<_, String>(0))
            .expect("query")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect")
    }

    /// Run a statement against the database directly.
    ///
    /// Used to put a row into a state the API cannot produce — such as a run
    /// that was in flight when the process died.
    pub fn execute_sql(&self, sql: &str) {
        let conn = rusqlite::Connection::open(&self.db_path).expect("open the database file");
        conn.execute(sql, []).expect("statement should run");
    }

    /// Start a second server over the same database, as a restart would.
    ///
    /// Same worker name, because that is what a restart is.
    pub fn restart(&self) -> TestServer {
        Self::build(
            self.dir.clone(),
            self.db_path.clone(),
            Some(self.worker_id.clone()),
        )
    }

    /// Start a second server over the same database under a different name,
    /// as a second r8r process on another host would be.
    pub fn second_worker(&self, worker_id: &str) -> TestServer {
        Self::build(
            self.dir.clone(),
            self.db_path.clone(),
            Some(worker_id.to_owned()),
        )
    }

    /// Put a file beside the database as a run would, so a test about
    /// cleaning them up has something to clean up.
    pub async fn store_file(&self, execution_id: &str) -> String {
        use r8r_core::BinaryStore as _;
        let store = r8r_cli::binary_store::FileBinaryStore::beside(&self.db_path.to_string_lossy());
        store
            .put(
                execution_id,
                &r8r_core::BinaryMeta::default(),
                b"a scanned discharge summary".to_vec(),
            )
            .await
            .expect("store a file")
            .id
    }

    /// Which runs still have files beside the database.
    pub fn binary_dirs(&self) -> Vec<String> {
        let root = self
            .db_path
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .join(r8r_cli::binary_store::DIRECTORY);

        let Ok(entries) = std::fs::read_dir(root) else {
            return Vec::new();
        };
        entries
            .filter_map(|entry| Some(entry.ok()?.file_name().to_string_lossy().into_owned()))
            .collect()
    }

    /// This worker's state, for driving a real background task in a test.
    pub fn state(&self) -> r8r_cli::server::AppState {
        self.state.clone()
    }

    /// Ask for a named lease as this worker, as a scheduler tick would.
    pub fn claim_lease(&self, name: &str) -> bool {
        self.db
            .workers()
            .claim_lease(name, &self.worker_id)
            .expect("lease should be claimable")
    }

    pub fn release_lease(&self, name: &str) {
        self.db
            .workers()
            .release_lease(name, &self.worker_id)
            .expect("lease should be releasable");
    }

    /// Create a credential and return its id.
    pub async fn create_credential(&self, payload: Value) -> String {
        let created = self.post("/rest/credentials", payload).await.expect_ok();
        created["id"]
            .as_str()
            .expect("created credential has an id")
            .to_owned()
    }

    /// Create a workflow and return its id.
    pub async fn create(&self, workflow: Value) -> String {
        let created = self.post("/rest/workflows", workflow).await.expect_ok();
        created["id"]
            .as_str()
            .expect("created workflow has an id")
            .to_owned()
    }
}

/// A trigger → Edit Fields workflow that echoes a greeting, used all over.
pub fn greeting_workflow(path: &str) -> Value {
    json!({
        "name": "Greeter",
        "nodes": [
            { "id": "hook", "type": "webhook", "name": "Hook",
              "parameters": { "path": path, "method": "POST", "respond": "lastNode" },
              "position": [0, 0] },
            { "id": "reply", "type": "set", "name": "Reply",
              "parameters": { "mode": "fields", "keepOnlySet": true,
                              "fields": { "message": "hello {{ item.body.name }}" } },
              "position": [220, 0] }
        ],
        "connections": [{ "from": "hook", "to": "reply", "port": "main" }]
    })
}
