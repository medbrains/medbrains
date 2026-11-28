//! Every route the server mounts, and how it refuses a caller who should not get
//! through. The table must exist before any router moves (the mount registry,
//! the brick split): a move that changes nothing leaves the snapshot untouched,
//! and one that drops a guard changes exactly the lines it touched.
//!
//! Each line is `METHOD path anon=<status> nocsrf=<status>`:
//! - `anon` — no session at all.
//! - `nocsrf` — a signed-in admin's cookie session with no `x-csrf-token`.
//!   Only sent for methods CSRF guards; GET/HEAD/OPTIONS show `-` (CSRF does
//!   not apply, and running every read handler as an admin is a smoke test,
//!   not a guard check).
//!
//! Routes come from the router's `Debug` output (axum 0.8.9: `PathRouter`'s
//! `routes` map of `RouteId` → `MethodRouter`, and `node.paths` of `RouteId` →
//! path). A route on every method (`any`) is one `ANY` line.
//!
//! The live table must equal `tests/route_table.snapshot`. After an intended
//! change, rewrite it and commit the diff:
//!
//! ```text
//! UPDATE_ROUTE_SNAPSHOT=1 cargo test -p medbrains-server --test integration route_table_snapshot_test::
//! ```

use crate::common;

use std::collections::{BTreeMap, BTreeSet};
use std::time::Duration;

const SNAPSHOT: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/route_table.snapshot");
const METHODS: [&str; 9] = [
    "get", "head", "delete", "options", "patch", "post", "put", "trace", "connect",
];
/// A placeholder for every path parameter: a UUID parses where one is wanted.
const PARAM: &str = "00000000-0000-0000-0000-000000000000";

/// `(method, path)` for every route in `router`'s main path table. Panics if
/// the `Debug` layout is not the one this parser was written against.
fn parse_routes(debug: &str) -> Vec<(String, String)> {
    let main = debug
        .split_once(", fallback_router: ")
        .map(|(main, _)| main)
        .expect("Router Debug has no fallback_router field — axum's layout changed");
    let (routes, paths) = main
        .split_once("node: Node { paths: {")
        .expect("PathRouter Debug has no node.paths — axum's layout changed");
    let paths = route_paths(paths);
    let mut out = Vec::new();
    for chunk in routes.split("RouteId(").skip(1) {
        let (id, endpoint) = chunk.split_once("): ").expect("RouteId entry");
        let path = paths
            .get(id)
            .unwrap_or_else(|| panic!("RouteId({id}) has no path"));
        for method in endpoint_methods(endpoint) {
            out.push((method, path.clone()));
        }
    }
    assert_eq!(
        paths.len(),
        routes.matches("RouteId(").count(),
        "routes and paths differ"
    );
    out
}

/// `RouteId` number → path, from the `node.paths` map's `Debug` text.
fn route_paths(text: &str) -> BTreeMap<String, String> {
    text.split("RouteId(")
        .skip(1)
        .map(|chunk| {
            let (id, rest) = chunk.split_once("): \"").expect("path entry");
            let (path, _) = rest.split_once('"').expect("quoted path");
            (id.to_owned(), path.to_owned())
        })
        .collect()
}

/// The methods one endpoint answers: `ANY` for a service or an `any` route.
fn endpoint_methods(endpoint: &str) -> Vec<String> {
    if !endpoint.starts_with("MethodRouter(") {
        return vec!["ANY".to_owned()];
    }
    let set: Vec<String> = METHODS
        .iter()
        .filter(|m| !endpoint.contains(&format!(" {m}: None")))
        .map(|m| m.to_uppercase())
        .collect();
    if set.len() == METHODS.len() {
        vec!["ANY".to_owned()]
    } else {
        set
    }
}

/// `path` with every `{param}` and `{*rest}` filled in.
fn concrete(path: &str) -> String {
    path.split('/')
        .map(|seg| match seg.strip_prefix('{') {
            Some(rest) if rest.starts_with('*') => "x",
            Some(_) => PARAM,
            None => seg,
        })
        .collect::<Vec<_>>()
        .join("/")
}

/// The status `client` gets for `method path`, or `timeout`/`error`.
async fn status(
    app: &common::TestApp,
    client: &reqwest::Client,
    method: &str,
    path: &str,
) -> String {
    let method = if method == "ANY" { "GET" } else { method };
    let method = reqwest::Method::from_bytes(method.as_bytes()).expect("method");
    let request = client.request(method, app.url(&concrete(path))).send();
    match tokio::time::timeout(Duration::from_secs(15), request).await {
        Ok(Ok(resp)) => resp.status().as_u16().to_string(),
        Ok(Err(_)) => "error".to_owned(),
        Err(_) => "timeout".to_owned(),
    }
}

/// A client that records redirects instead of following them.
fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .cookie_store(true)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("client")
}

#[tokio::test]
async fn route_table_matches_snapshot() {
    let app = common::spawn_app().await;
    let debug = format!(
        "{:?}",
        medbrains_server::routes::build_router(app.state.clone())
    );
    // Sorted, so the probes run in the same order every time: `/api/auth/refresh` rotates the
    // session's cookies, and the router's maps iterate in a random order.
    let mut routes = parse_routes(&debug);
    routes.sort();
    assert!(
        routes.len() > 100,
        "parsed {} routes from Router Debug",
        routes.len()
    );

    let anon = client();
    let session = client();
    let login = session
        .post(app.url("/api/auth/login"))
        .json(&serde_json::json!({ "username": "admin", "password": "admin123" }))
        .send()
        .await
        .expect("login");
    assert!(
        login.status().is_success(),
        "admin login: {}",
        login.status()
    );

    let mut live = BTreeSet::new();
    for (method, path) in &routes {
        let anon_status = status(&app, &anon, method, path).await;
        let nocsrf = match method.as_str() {
            "GET" | "HEAD" | "OPTIONS" | "ANY" => "-".to_owned(),
            _ => status(&app, &session, method, path).await,
        };
        live.insert(format!(
            "{method} {path} anon={anon_status} nocsrf={nocsrf}"
        ));
    }
    let me = status(&app, &session, "GET", "/api/auth/me").await;
    assert_eq!(
        me, "200",
        "the session died mid-probe; later nocsrf statuses mean nothing"
    );

    let text = live
        .iter()
        .fold(String::new(), |text, line| text + line + "\n");
    if std::env::var_os("UPDATE_ROUTE_SNAPSHOT").is_some() {
        std::fs::write(SNAPSHOT, &text).expect("write snapshot");
        return;
    }
    let saved = std::fs::read_to_string(SNAPSHOT).unwrap_or_default();
    let saved: BTreeSet<String> = saved.lines().map(str::to_owned).collect();
    let mut diff: Vec<String> = saved.difference(&live).map(|l| format!("- {l}")).collect();
    diff.extend(live.difference(&saved).map(|l| format!("+ {l}")));
    assert!(
        diff.is_empty(),
        "route table differs from tests/route_table.snapshot ({} live lines):\n{}\n\
         If intended: UPDATE_ROUTE_SNAPSHOT=1 cargo test -p medbrains-server \
         --test integration route_table_snapshot_test::",
        live.len(),
        diff.join("\n")
    );
}
