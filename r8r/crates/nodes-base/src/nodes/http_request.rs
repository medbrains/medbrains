use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::pagination::{MAX_PAGES, NextPage, Pagination, Position, next_page};
use r8r_core::{BinaryMeta, CoreError, ExecuteContext, NodeExecutor, NodeOutcome, Result};
use r8r_workflow::node_helpers::{get_path, millis};
use r8r_workflow::stringify;
use r8r_workflow::{
    NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription, PropertyOption,
};
use reqwest::{Method, RequestBuilder, Response};
use serde_json::{Map, Value, json};
use std::time::Duration;

/// Makes one HTTP request per incoming item.
#[derive(Debug)]
pub struct HttpRequestNode;

const MAX_TIMEOUT_MS: u64 = 300_000;
const DEFAULT_TIMEOUT_MS: f64 = 30_000.0;
/// How much of a failing response body to quote back in the error.
const ERROR_EXCERPT_CHARS: usize = 400;
/// What to ask for per page when the workflow does not say.
const DEFAULT_PAGE_SIZE: usize = 100;
/// Beyond this a "page size" is really a request to download everything at
/// once, which most servers refuse and no server enjoys.
const MAX_PAGE_SIZE: f64 = 10_000.0;
/// A `Retry-After` beyond this is a service telling us to come back tomorrow.
/// It is still reported, but as a bounded number rather than one that could
/// overflow the arithmetic downstream of it.
const MAX_RETRY_AFTER_SECS: u64 = 86_400;
const MAX_RETRY_AFTER_SECS_SIGNED: i64 = 86_400;

#[async_trait]
impl NodeExecutor for HttpRequestNode {
    fn description(&self) -> NodeTypeDescription {
        NodeTypeDescription {
            name: "httpRequest".into(),
            display_name: "HTTP Request".into(),
            group: NodeGroup::Output,
            description: "Call any HTTP API, once per item".into(),
            icon: "🌐".into(),
            color: "#6366f1".into(),
            properties: properties(),
            outputs: vec!["main".into()],
            inputs: vec!["main".into()],
            ..NodeTypeDescription::default()
        }
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let mut out = Vec::with_capacity(ctx.input.len());
        for idx in 0..ctx.input.len() {
            let params = ctx.params(idx)?;
            let url = ctx.require_str(&params, "url")?;
            collect_pages(ctx, &params, url, &mut out).await?;
        }
        Ok(main_output(out).into())
    }
}

/// Request `url`, then keep requesting while the API says there is more.
///
/// With pagination off this is one request and one output item, which is what
/// it has always been. With pagination on, every page is fetched before the
/// node finishes — a workflow that asks for "all patients" gets all of them
/// rather than the first hundred and no indication that the rest exist.
async fn collect_pages(
    ctx: &ExecuteContext<'_>,
    params: &Value,
    first_url: String,
    out: &mut Vec<Value>,
) -> Result<()> {
    let pagination = pagination_of(ctx, params);
    let ceiling = page_ceiling(ctx, params);
    let items_path = ctx.str_param(params, "itemsPath", "");

    let mut url = first_url;
    let mut overrides: Vec<(String, String)> = first_query(&pagination);
    let mut at = Position::default();

    loop {
        let response = build_request(ctx, params, &url, &overrides)?
            .send()
            .await
            .map_err(|e| CoreError::Node(format!("request to {url} failed: {e}")))?;
        let link = header(&response, reqwest::header::LINK);

        let page = read_response(ctx, params, &url, response).await?;
        let records = emit_page(&page, &items_path, out);

        at.pages = at.pages.saturating_add(1);
        at.collected = at.collected.saturating_add(records);

        if at.pages >= ceiling {
            return Ok(());
        }
        let body = page.get("body").unwrap_or(&Value::Null);
        match next_page(&pagination, body, link.as_deref(), records, at) {
            None => return Ok(()),
            Some(NextPage::Url(next)) => {
                // A `Link` header may name a path rather than a whole URL, and
                // "/patients?from=100" is not somewhere reqwest can send a
                // request. Resolve it against the page it arrived on.
                url = resolve(&url, &next)?;
                overrides.clear();
            }
            Some(NextPage::Query(query)) => overrides = query,
        }
    }
}

/// Add this page to the output, and report how many records it held.
///
/// Without an items path a page is one output item, body and all. With one,
/// the records inside are unwrapped so that downstream nodes see records
/// rather than pages — the difference between iterating patients and
/// iterating HTTP responses.
fn emit_page(page: &Value, items_path: &str, out: &mut Vec<Value>) -> usize {
    if items_path.is_empty() {
        out.push(page.clone());
        return 1;
    }
    let body = page.get("body").unwrap_or(&Value::Null);
    match get_path(body, items_path) {
        Some(Value::Array(records)) => {
            out.extend(records.iter().cloned());
            records.len()
        }
        // A path that names one object is a page of one, not a mistake worth
        // failing over — some APIs return a bare object on the last page.
        Some(other) if !other.is_null() => {
            out.push(other.clone());
            1
        }
        // A mistyped path, or a page that genuinely holds no records. Both
        // mean nothing to pass on; neither is worth failing the run over.
        Some(_) | None => 0,
    }
}

/// The first request may already need pagination parameters: an API paged by
/// offset or page number wants a page size from the very first call, or it
/// picks its own and the size we compute the next offset from is wrong.
fn first_query(pagination: &Pagination) -> Vec<(String, String)> {
    match pagination {
        Pagination::Offset {
            offset_param,
            limit_param,
            page_size,
        } => vec![
            (offset_param.clone(), "0".to_owned()),
            (limit_param.clone(), page_size.to_string()),
        ],
        Pagination::Page {
            page_param,
            size_param,
            page_size,
            start,
        } => vec![
            (page_param.clone(), start.to_string()),
            (size_param.clone(), page_size.to_string()),
        ],
        Pagination::None | Pagination::Cursor { .. } | Pagination::Link => Vec::new(),
    }
}

fn pagination_of(ctx: &ExecuteContext<'_>, params: &Value) -> Pagination {
    let path = ctx.str_param(params, "paginationPath", "");
    let param = ctx.str_param(params, "paginationParam", "cursor");
    let size = page_size(ctx, params);

    match ctx.str_param(params, "paginationMode", "off").as_str() {
        "cursor" => Pagination::Cursor { path, param },
        "offset" => Pagination::Offset {
            offset_param: param,
            limit_param: ctx.str_param(params, "paginationSizeParam", "limit"),
            page_size: size,
        },
        "page" => Pagination::Page {
            page_param: param,
            size_param: ctx.str_param(params, "paginationSizeParam", "per_page"),
            page_size: size,
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
            start: ctx.num_param(params, "paginationStart", 1.0).max(0.0) as usize,
        },
        "link" => Pagination::Link,
        _ => Pagination::None,
    }
}

/// A page size of zero would make every page "short" and stop after one, so
/// an unset or nonsensical value falls back to something a server will accept.
fn page_size(ctx: &ExecuteContext<'_>, params: &Value) -> usize {
    #[allow(clippy::cast_precision_loss)]
    let asked = ctx.num_param(params, "paginationPageSize", DEFAULT_PAGE_SIZE as f64);
    if !asked.is_finite() || asked < 1.0 {
        return DEFAULT_PAGE_SIZE;
    }
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let size = asked.min(MAX_PAGE_SIZE) as usize;
    size
}

/// How many pages this node will fetch, never above the engine's own ceiling.
fn page_ceiling(ctx: &ExecuteContext<'_>, params: &Value) -> usize {
    #[allow(clippy::cast_precision_loss)]
    let asked = ctx.num_param(params, "maxPages", MAX_PAGES as f64);
    if !asked.is_finite() || asked < 1.0 {
        return MAX_PAGES;
    }
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let ceiling = asked as usize;
    ceiling.min(MAX_PAGES)
}

/// Turn a possibly-relative next-page link into an absolute URL.
fn resolve(current: &str, next: &str) -> Result<String> {
    let base = reqwest::Url::parse(current)
        .map_err(|e| CoreError::Node(format!("cannot page on from `{current}`: {e}")))?;
    base.join(next)
        .map(String::from)
        .map_err(|e| CoreError::Node(format!("next page link `{next}` is not a URL: {e}")))
}

fn header(response: &Response, name: reqwest::header::HeaderName) -> Option<String> {
    response
        .headers()
        .get(name)?
        .to_str()
        .ok()
        .map(ToOwned::to_owned)
}

/// Assemble the request: method, timeout, headers, query and body.
fn build_request(
    ctx: &ExecuteContext<'_>,
    params: &Value,
    url: &str,
    overrides: &[(String, String)],
) -> Result<RequestBuilder> {
    let method_str = ctx.str_param(params, "method", "GET").to_uppercase();
    let method = Method::from_bytes(method_str.as_bytes())
        .map_err(|_| CoreError::Node(format!("unsupported HTTP method `{method_str}`")))?;
    let timeout = millis(
        ctx.num_param(params, "timeoutMs", DEFAULT_TIMEOUT_MS),
        MAX_TIMEOUT_MS,
    )
    .max(1);

    let mut req = ctx
        .http
        .request(method, url)
        .timeout(Duration::from_millis(timeout));

    for (key, value) in ctx.object_param(params, "headers") {
        req = req.header(key, stringify(&value));
    }

    // Overrides replace rather than append: re-sending `cursor` on every page
    // would build up a query string of every cursor the run has ever seen.
    let mut query = pairs(ctx.object_param(params, "query"));
    for (key, value) in overrides {
        query.retain(|(existing, _)| existing != key);
        query.push((key.clone(), value.clone()));
    }
    if !query.is_empty() {
        req = req.query(&query);
    }

    attach_body(ctx, params, req)
}

fn attach_body(
    ctx: &ExecuteContext<'_>,
    params: &Value,
    req: RequestBuilder,
) -> Result<RequestBuilder> {
    Ok(match ctx.str_param(params, "bodyType", "none").as_str() {
        "json" => {
            let body = match params.get("body") {
                Some(Value::String(raw)) => serde_json::from_str::<Value>(raw)
                    .map_err(|e| CoreError::Node(format!("invalid JSON body: {e}")))?,
                Some(other) => other.clone(),
                None => json!({}),
            };
            req.json(&body)
        }
        "form" => req.form(&pairs(ctx.object_param(params, "formBody"))),
        "raw" => req.body(ctx.str_param(params, "rawBody", "")),
        _ => req,
    })
}

/// Turn the response into one item, or into an error when the status says so.
async fn read_response(
    ctx: &ExecuteContext<'_>,
    params: &Value,
    url: &str,
    response: Response,
) -> Result<Value> {
    let status = response.status();
    let headers: Map<String, Value> = response
        .headers()
        .iter()
        .map(|(name, value)| (name.to_string(), json!(value.to_str().unwrap_or_default())))
        .collect();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_owned();

    let retry_after = header(&response, reqwest::header::RETRY_AFTER)
        .as_deref()
        .and_then(parse_retry_after);

    let disposition = header(&response, reqwest::header::CONTENT_DISPOSITION);

    let bytes = response
        .bytes()
        .await
        .map(|body| body.to_vec())
        .map_err(|e| CoreError::Node(format!("could not read response body from {url}: {e}")))?;

    let format = ctx.str_param(params, "responseFormat", "auto");
    let body = read_body(ctx, &format, &content_type, disposition.as_deref(), bytes).await?;

    if !status.is_success() && !ctx.bool_param(params, "neverError", false) {
        let message = format!(
            "{url} responded {}: {}",
            status.as_u16(),
            truncate(&stringify(&body), ERROR_EXCERPT_CHARS)
        );
        // A service that told us how long to wait gets to set the pace of the
        // retry. Ignoring it turns a brief throttle into a longer one.
        return Err(match retry_after {
            Some(wait) if is_throttled(status) => CoreError::RateLimited {
                message,
                retry_after: wait,
            },
            _ => CoreError::Node(message),
        });
    }

    Ok(json!({ "statusCode": status.as_u16(), "headers": headers, "body": body }))
}

/// Turn a response body into something an item can hold.
///
/// Read as bytes rather than text, because `String::from_utf8_lossy` on a PDF
/// does not fail — it silently replaces every byte it cannot read, and the
/// file arrives corrupted with nothing to say so.
async fn read_body(
    ctx: &ExecuteContext<'_>,
    format: &str,
    content_type: &str,
    disposition: Option<&str>,
    bytes: Vec<u8>,
) -> Result<Value> {
    if format == "base64" || (format == "auto" && is_binary(content_type)) {
        let meta = BinaryMeta {
            file_name: file_name_from(disposition),
            mime_type: first_word(content_type).to_owned(),
        };
        return ctx.carry_file(&meta, bytes).await;
    }

    let text = String::from_utf8_lossy(&bytes).into_owned();
    if format == "json" || (format == "auto" && content_type.contains("json")) {
        return Ok(serde_json::from_str::<Value>(&text).unwrap_or(Value::String(text)));
    }
    Ok(Value::String(text))
}

/// Whether a content type names something that is not text.
///
/// The list is short and the fallback is text, because guessing wrong towards
/// binary is the worse mistake: a JSON body turned into a file is unreadable
/// by every node downstream, while a small binary read as text is at least
/// visible in the log as nonsense.
fn is_binary(content_type: &str) -> bool {
    let kind = first_word(content_type).to_ascii_lowercase();

    if kind.starts_with("text/") || kind.is_empty() {
        return false;
    }
    if kind.starts_with("image/") || kind.starts_with("audio/") || kind.starts_with("video/") {
        return true;
    }
    matches!(
        kind.as_str(),
        "application/pdf"
            | "application/zip"
            | "application/gzip"
            | "application/octet-stream"
            | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            | "application/vnd.ms-excel"
    )
}

/// The type without its parameters: `text/csv; charset=utf-8` is `text/csv`.
fn first_word(content_type: &str) -> &str {
    content_type.split(';').next().unwrap_or_default().trim()
}

/// The name a server suggested for a download.
///
/// Worth keeping: a workflow that saves an attachment somewhere else needs
/// something to call it, and `3f1a9c02.bin` is not it.
fn file_name_from(disposition: Option<&str>) -> Option<String> {
    let value = disposition?;
    let start = value.to_ascii_lowercase().find("filename=")?;
    let name = value.get(start.saturating_add("filename=".len())..)?;
    let name = name.split(';').next()?.trim().trim_matches('"');

    // A server that sends a path is either careless or hostile; either way,
    // only the last component is a file name.
    let name = name.rsplit(['/', '\\']).next()?.trim();
    (!name.is_empty()).then(|| name.to_owned())
}

/// Statuses where `Retry-After` means "you are going too fast", rather than
/// "come back when the maintenance window closes".
fn is_throttled(status: reqwest::StatusCode) -> bool {
    status == reqwest::StatusCode::TOO_MANY_REQUESTS
        || status == reqwest::StatusCode::SERVICE_UNAVAILABLE
}

/// `Retry-After` is either a number of seconds or an HTTP date, and which one
/// a service sends is not a thing you get to choose. Both are read; anything
/// else is treated as absent, because guessing a wait is worse than using the
/// node's own.
fn parse_retry_after(header: &str) -> Option<Duration> {
    let header = header.trim();

    if let Ok(seconds) = header.parse::<u64>() {
        return Some(Duration::from_secs(seconds.min(MAX_RETRY_AFTER_SECS)));
    }

    // HTTP-date, e.g. `Wed, 21 Oct 2015 07:28:00 GMT`.
    let at = chrono::DateTime::parse_from_rfc2822(header).ok()?;
    // A date already past means "now" — some services send one that has
    // expired by the time the response reaches us, and a negative wait is not
    // a wait.
    let seconds = at
        .signed_duration_since(chrono::Utc::now())
        .num_seconds()
        .clamp(0, MAX_RETRY_AFTER_SECS_SIGNED);
    #[allow(clippy::cast_sign_loss)]
    Some(Duration::from_secs(seconds as u64))
}

fn pairs(map: Map<String, Value>) -> Vec<(String, String)> {
    map.into_iter()
        .map(|(key, value)| (key, stringify(&value)))
        .collect()
}

/// Keep a failing response readable in the execution log without dumping a
/// whole HTML error page into it.
fn truncate(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_owned();
    }
    let cut: String = text.chars().take(max).collect();
    format!("{cut}…")
}

fn properties() -> Vec<NodeProperty> {
    let mut all = request_properties();
    all.extend(body_properties());
    all.extend(pagination_properties());
    all.extend(pagination_shape_properties());
    all.extend(response_properties());
    all
}

/// Method, URL, headers and query — what identifies the call.
fn request_properties() -> Vec<NodeProperty> {
    vec![
        NodeProperty::new("method", "Method", NodePropertyKind::Options, json!("GET"))
            .with_options(vec![
                PropertyOption::new("GET", "GET"),
                PropertyOption::new("POST", "POST"),
                PropertyOption::new("PUT", "PUT"),
                PropertyOption::new("PATCH", "PATCH"),
                PropertyOption::new("DELETE", "DELETE"),
                PropertyOption::new("HEAD", "HEAD"),
            ]),
        NodeProperty::new("url", "URL", NodePropertyKind::String, json!(""))
            .required()
            .placeholder("https://api.example.com/users/{{ item.id }}"),
        NodeProperty::new("headers", "Headers", NodePropertyKind::KeyValue, json!({}))
            .describe("Secrets belong in env vars: Authorization: Bearer {{ env.API_TOKEN }}"),
        NodeProperty::new(
            "query",
            "Query Parameters",
            NodePropertyKind::KeyValue,
            json!({}),
        ),
    ]
}

/// How the request body is encoded, and what goes in it.
fn body_properties() -> Vec<NodeProperty> {
    vec![
        NodeProperty::new(
            "bodyType",
            "Body Type",
            NodePropertyKind::Options,
            json!("none"),
        )
        .with_options(vec![
            PropertyOption::new("None", "none"),
            PropertyOption::new("JSON", "json"),
            PropertyOption::new("Form URL-Encoded", "form"),
            PropertyOption::new("Raw", "raw"),
        ]),
        NodeProperty::new("body", "Body", NodePropertyKind::Json, json!("{}"))
            .show_when("bodyType", &["json"]),
        NodeProperty::new(
            "formBody",
            "Form Fields",
            NodePropertyKind::KeyValue,
            json!({}),
        )
        .show_when("bodyType", &["form"]),
        NodeProperty::new(
            "rawBody",
            "Raw Body",
            NodePropertyKind::MultilineString,
            json!(""),
        )
        .show_when("bodyType", &["raw"]),
    ]
}

/// How the response is decoded, and when a status code is fatal.
fn response_properties() -> Vec<NodeProperty> {
    vec![
        NodeProperty::new(
            "responseFormat",
            "Response Format",
            NodePropertyKind::Options,
            json!("auto"),
        )
        .with_options(vec![
            PropertyOption::new("Auto-detect", "auto"),
            PropertyOption::new("JSON", "json"),
            PropertyOption::new("Text", "text"),
            PropertyOption::new("Binary (base64)", "base64"),
        ]),
        NodeProperty::new(
            "timeoutMs",
            "Timeout (ms)",
            NodePropertyKind::Number,
            json!(30000),
        ),
        NodeProperty::new(
            "neverError",
            "Never Error on HTTP Status",
            NodePropertyKind::Boolean,
            json!(false),
        )
        .describe("Pass 4xx/5xx responses downstream instead of failing the node"),
    ]
}

/// How this API says there is another page — and where the records live.
fn pagination_properties() -> Vec<NodeProperty> {
    vec![
        NodeProperty::new(
            "paginationMode",
            "Pagination",
            NodePropertyKind::Options,
            json!("off"),
        )
        .with_options(vec![
            PropertyOption::new("Off — one request", "off"),
            PropertyOption::new("Cursor in the response", "cursor"),
            PropertyOption::new("Offset and limit", "offset"),
            PropertyOption::new("Page number", "page"),
            PropertyOption::new("Link header", "link"),
        ])
        .describe("Fetch every page, not just the first"),
        NodeProperty::new(
            "itemsPath",
            "Records Path",
            NodePropertyKind::String,
            json!(""),
        )
        .placeholder("data.results")
        .describe("Where the records sit in the response. Leave empty to pass whole pages on."),
        NodeProperty::new(
            "paginationPath",
            "Cursor Path",
            NodePropertyKind::String,
            json!(""),
        )
        .placeholder("meta.next_cursor")
        .show_when("paginationMode", &["cursor"]),
        NodeProperty::new(
            "paginationParam",
            "Page Parameter",
            NodePropertyKind::String,
            json!("cursor"),
        )
        .describe("Query parameter that carries the cursor, offset or page number")
        .show_when("paginationMode", &["cursor", "offset", "page"]),
    ]
}

/// The knobs each pagination style needs, hidden when it is not in use.
fn pagination_shape_properties() -> Vec<NodeProperty> {
    vec![
        NodeProperty::new(
            "paginationSizeParam",
            "Page Size Parameter",
            NodePropertyKind::String,
            json!("limit"),
        )
        .show_when("paginationMode", &["offset", "page"]),
        NodeProperty::new(
            "paginationPageSize",
            "Page Size",
            NodePropertyKind::Number,
            json!(100),
        )
        .show_when("paginationMode", &["offset", "page"]),
        NodeProperty::new(
            "paginationStart",
            "First Page Number",
            NodePropertyKind::Number,
            json!(1),
        )
        .describe("Most APIs count from 1, some from 0")
        .show_when("paginationMode", &["page"]),
        NodeProperty::new(
            "maxPages",
            "Maximum Pages",
            NodePropertyKind::Number,
            json!(200),
        )
        .describe("Stop after this many pages even if the API offers more")
        .show_when("paginationMode", &["cursor", "offset", "page", "link"]),
    ]
}
