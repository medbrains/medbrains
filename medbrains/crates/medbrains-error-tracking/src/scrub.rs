//! What may leave the server in an error report: the shape of the failure,
//! never the patient it happened to.
//!
//! Text goes through the AI redactor first (`medbrains_core::ai_redact`, the
//! same patterns that keep identifiers out of model calls), then through three
//! rules of our own that suit error messages, where words are lower case and
//! values are not: anything quoted goes, two or more capitalised words in a
//! row go (a name with no "Mr" in front of it), and any run of four or more
//! digits goes (a UHID with no "UHID" in front of it). A lone capitalised word
//! is not caught — it is also how every sentence starts.

use std::sync::LazyLock;

use medbrains_core::ai_redact::redact_for_record;
use regex::Regex;
use sentry::protocol::{
    Breadcrumb, Context, Event, Exception, Map, Request, Span, Transaction, Url, User,
};

/// Error text with identifiers and values removed.
#[must_use]
pub(crate) fn scrub_text(text: &str) -> String {
    let redacted = redact_for_record(text, chrono::Utc::now().date_naive());
    let Some([quoted, names, digits]) = rules() else {
        // A rule that does not compile withholds the text rather than send it.
        return "[withheld]".to_owned();
    };
    let text = quoted.replace_all(&redacted, "[value]");
    let text = names.replace_all(&text, "[name]");
    digits.replace_all(&text, "[n]").into_owned()
}

/// A URL or path with its query, fragment and record ids removed.
#[must_use]
pub(crate) fn scrub_url(raw: &str) -> String {
    let without_query = raw.split(['?', '#']).next().unwrap_or_default();
    let (origin, path) = split_origin(without_query);
    let path = path
        .split('/')
        .map(|segment| {
            if is_identifier(segment) {
                ":id"
            } else {
                segment
            }
        })
        .collect::<Vec<_>>()
        .join("/");
    format!("{origin}{path}")
}

/// `true` for a user id that is already an opaque hash (32 hex digits).
#[must_use]
pub(crate) fn is_opaque_user_id(id: &str) -> bool {
    id.len() == 32 && id.bytes().all(|b| b.is_ascii_hexdigit())
}

pub(crate) fn scrub_event(event: &mut Event<'static>) {
    event.message = event.message.as_deref().map(scrub_text);
    if let Some(entry) = event.logentry.as_mut() {
        entry.message = scrub_text(&entry.message);
        entry.params.clear();
    }
    event.culprit = event.culprit.as_deref().map(scrub_value);
    event.transaction = event.transaction.as_deref().map(scrub_value);
    event.exception.values.iter_mut().for_each(scrub_exception);
    if let Some(trace) = event.stacktrace.as_mut() {
        trace.frames.iter_mut().for_each(|f| f.vars.clear());
    }
    event.threads.values.clear();
    event
        .breadcrumbs
        .values
        .iter_mut()
        .for_each(scrub_breadcrumb);
    event.user = event.user.take().and_then(scrub_user);
    event.request = event.request.take().map(scrub_request);
    event.extra.clear();
    event.modules.clear();
    scrub_tags(&mut event.tags);
    keep_safe_contexts(&mut event.contexts);
}

pub(crate) fn scrub_transaction(tx: &mut Transaction<'static>) {
    tx.name = tx.name.as_deref().map(scrub_value);
    tx.user = tx.user.take().and_then(scrub_user);
    tx.request = tx.request.take().map(scrub_request);
    tx.extra.clear();
    scrub_tags(&mut tx.tags);
    keep_safe_contexts(&mut tx.contexts);
    tx.spans.iter_mut().for_each(scrub_span);
}

fn scrub_exception(exception: &mut Exception) {
    exception.value = exception.value.as_deref().map(scrub_text);
    for trace in [
        exception.stacktrace.as_mut(),
        exception.raw_stacktrace.as_mut(),
    ]
    .into_iter()
    .flatten()
    {
        trace.frames.iter_mut().for_each(|f| f.vars.clear());
    }
}

/// A breadcrumb keeps its kind and a scrubbed message. Of its data, only the
/// fields that say what kind of request it was survive.
fn scrub_breadcrumb(crumb: &mut Breadcrumb) {
    crumb.message = crumb.message.as_deref().map(scrub_value);
    let kept: Vec<(String, serde_json::Value)> = ["method", "status_code", "url", "from", "to"]
        .into_iter()
        .filter_map(|key| crumb.data.get(key).map(|v| (key.to_owned(), scrub_json(v))))
        .collect();
    crumb.data.clear();
    crumb.data.extend(kept);
}

fn scrub_span(span: &mut Span) {
    span.description = span.description.as_deref().map(scrub_value);
    span.data.clear();
    scrub_tags(&mut span.tags);
}

/// Only an opaque id hash survives: no email, name, address or IP.
fn scrub_user(user: User) -> Option<User> {
    let id = user.id.filter(|id| is_opaque_user_id(id))?;
    Some(User {
        id: Some(id),
        ..User::default()
    })
}

/// Method and a scrubbed URL. No body, query, cookies, headers or env.
fn scrub_request(request: Request) -> Request {
    Request {
        url: request
            .url
            .and_then(|u| Url::parse(&scrub_url(u.as_str())).ok()),
        method: request.method,
        ..Request::default()
    }
}

/// The tags we set ourselves keep their value when it has the expected shape
/// (a tenant UUID, a role code); every other tag value is scrubbed.
fn scrub_tags(tags: &mut Map<String, String>) {
    for (key, value) in tags.iter_mut() {
        let ours = match key.as_str() {
            "tenant_id" => uuid::Uuid::parse_str(value).is_ok(),
            "role" => value.bytes().all(|b| b.is_ascii_lowercase() || b == b'_'),
            _ => false,
        };
        if !ours {
            *value = scrub_value(value);
        }
    }
}

/// Device, OS, runtime, app, browser and trace contexts describe the machine
/// and the request's timing. Everything else — integration fields, tracing
/// fields, response bodies — is dropped.
fn keep_safe_contexts(contexts: &mut Map<String, Context>) {
    contexts.retain(|_, context| {
        matches!(
            context,
            Context::Device(_)
                | Context::Os(_)
                | Context::Runtime(_)
                | Context::App(_)
                | Context::Browser(_)
                | Context::Trace(_)
        )
    });
    for context in contexts.values_mut() {
        match context {
            Context::Trace(trace) => {
                trace.data.clear();
                trace.description = trace.description.as_deref().map(scrub_value);
            }
            Context::App(app) => app.other.clear(),
            _ => {}
        }
    }
}

/// A value that may be a URL or path is scrubbed as one, anything else as text.
fn scrub_value(value: &str) -> String {
    let path_like = value.contains("://") || value.starts_with('/');
    let method_path = value
        .split_once(' ')
        .filter(|(m, p)| m.bytes().all(|b| b.is_ascii_uppercase()) && p.starts_with('/'));
    match (path_like, method_path) {
        (_, Some((method, path))) => format!("{method} {}", scrub_url(path)),
        (true, None) => scrub_url(value),
        (false, None) => scrub_text(value),
    }
}

fn scrub_json(value: &serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::String(s) => serde_json::Value::String(scrub_value(s)),
        serde_json::Value::Number(n) => serde_json::Value::Number(n.clone()),
        _ => serde_json::Value::Null,
    }
}

fn split_origin(url: &str) -> (&str, &str) {
    url.find("://")
        .and_then(|scheme_end| {
            let after = scheme_end + 3;
            url[after..]
                .find('/')
                .map(|slash| url.split_at(after + slash))
        })
        .unwrap_or_else(|| {
            if url.contains("://") {
                (url, "")
            } else {
                ("", url)
            }
        })
}

/// A path segment that names a record: a UUID, or anything with four or more
/// digits in a row (a UHID, a bill number, a phone number).
fn is_identifier(segment: &str) -> bool {
    let uuid = segment.len() == 36 && uuid::Uuid::parse_str(segment).is_ok();
    let mut run = 0;
    let digits = segment.chars().any(|c| {
        run = if c.is_ascii_digit() { run + 1 } else { 0 };
        run >= 4
    });
    uuid || digits
}

fn rules() -> Option<[&'static Regex; 3]> {
    static RULES: LazyLock<Result<[Regex; 3], regex::Error>> = LazyLock::new(|| {
        Ok([
            Regex::new(r#"'[^'\n]{1,200}'|"[^"\n]{1,200}"|`[^`\n]{1,200}`"#)?,
            Regex::new(r"\b\p{Lu}\p{Ll}+(?:[ .'-]+\p{Lu}\p{Ll}+)+\b")?,
            Regex::new(r"\d{4,}")?,
        ])
    });
    let [quoted, names, digits] = RULES.as_ref().ok()?;
    Some([quoted, names, digits])
}
