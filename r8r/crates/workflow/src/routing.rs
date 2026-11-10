//! Declarative request routing — the reason one small file can add a whole
//! integration.
//!
//! Mirrors n8n's `routing` block on an operation. Instead of writing Rust for
//! every endpoint, an integration declares *which* request an operation makes
//! and *where* in the response the useful data lives. The engine in
//! `r8r-core::declarative` turns that into real HTTP calls.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// HTTP verbs r8r will issue. A closed set, so a manifest cannot ask for
/// something the engine has not been taught to send.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum HttpMethod {
    #[default]
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Head,
}

impl HttpMethod {
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            HttpMethod::Get => "GET",
            HttpMethod::Post => "POST",
            HttpMethod::Put => "PUT",
            HttpMethod::Patch => "PATCH",
            HttpMethod::Delete => "DELETE",
            HttpMethod::Head => "HEAD",
        }
    }
}

/// How a request body is encoded.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BodyType {
    #[default]
    None,
    Json,
    Form,
    Raw,
}

/// One HTTP request, with every string field a `{{ }}` template evaluated
/// against the node's parameters, the current item and the credential.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestRouting {
    #[serde(default)]
    pub method: HttpMethod,
    /// Appended to the integration's base URL unless it is already absolute.
    #[serde(default)]
    pub url: String,
    #[serde(default, skip_serializing_if = "Map::is_empty")]
    pub headers: Map<String, Value>,
    #[serde(default, skip_serializing_if = "Map::is_empty")]
    pub query: Map<String, Value>,
    #[serde(default)]
    pub body_type: BodyType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
}

impl RequestRouting {
    #[must_use]
    pub fn new(method: HttpMethod, url: &str) -> Self {
        RequestRouting {
            method,
            url: url.to_owned(),
            ..Self::default()
        }
    }

    #[must_use]
    pub fn with_json_body(mut self, body: Value) -> Self {
        self.body_type = BodyType::Json;
        self.body = Some(body);
        self
    }

    #[must_use]
    pub fn with_query(mut self, query: Value) -> Self {
        if let Value::Object(map) = query {
            self.query = map;
        }
        self
    }

    #[must_use]
    pub fn with_headers(mut self, headers: Value) -> Self {
        if let Value::Object(map) = headers {
            self.headers = map;
        }
        self
    }
}

/// What to do with the response before it becomes items.
///
/// Applied in order, so an integration can pluck a nested array and then trim
/// it without a line of imperative code.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PostReceive {
    /// Take a (possibly dotted) property as the payload — `data.items`.
    RootProperty { property: String },
    /// Emit one item per element when the payload is an array.
    Split,
    /// Keep at most `count` items.
    Limit { count: usize },
    /// Add fixed fields to every item, e.g. the resource that produced it.
    Set { fields: Map<String, Value> },
    /// Replace the item with `{ success: true }` — for endpoints with no body.
    Acknowledge,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputRouting {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub post_receive: Vec<PostReceive>,
}

impl OutputRouting {
    /// The common case: pluck an array property and fan it out into items.
    #[must_use]
    pub fn list(property: &str) -> Self {
        OutputRouting {
            post_receive: vec![
                PostReceive::RootProperty {
                    property: property.to_owned(),
                },
                PostReceive::Split,
            ],
        }
    }

    /// A single object response, passed through as one item.
    #[must_use]
    pub fn single() -> Self {
        OutputRouting::default()
    }

    #[must_use]
    pub fn acknowledge() -> Self {
        OutputRouting {
            post_receive: vec![PostReceive::Acknowledge],
        }
    }
}

/// A complete operation: the request to make and how to read the answer.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Routing {
    pub request: RequestRouting,
    #[serde(default)]
    pub output: OutputRouting,
}

impl Routing {
    #[must_use]
    pub fn new(method: HttpMethod, url: &str) -> Self {
        Routing {
            request: RequestRouting::new(method, url),
            output: OutputRouting::default(),
        }
    }

    #[must_use]
    pub fn returning(mut self, output: OutputRouting) -> Self {
        self.output = output;
        self
    }

    #[must_use]
    pub fn with_request(mut self, request: RequestRouting) -> Self {
        self.request = request;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn methods_round_trip_through_json_as_uppercase_verbs() {
        let json = serde_json::to_value(HttpMethod::Patch).expect("serialises");
        assert_eq!(json, json!("PATCH"));
        let back: HttpMethod = serde_json::from_value(json).expect("deserialises");
        assert_eq!(back, HttpMethod::Patch);
    }

    #[test]
    fn an_unknown_method_is_rejected_rather_than_guessed() {
        assert!(serde_json::from_value::<HttpMethod>(json!("TELEPORT")).is_err());
    }

    #[test]
    fn list_output_plucks_then_splits() {
        let output = OutputRouting::list("channels");
        assert_eq!(output.post_receive.len(), 2);
        assert!(matches!(
            output.post_receive.first(),
            Some(PostReceive::RootProperty { property }) if property == "channels"
        ));
        assert!(matches!(
            output.post_receive.get(1),
            Some(PostReceive::Split)
        ));
    }

    #[test]
    fn a_routing_survives_a_json_round_trip() {
        let routing = Routing::new(HttpMethod::Post, "/chat.postMessage")
            .with_request(
                RequestRouting::new(HttpMethod::Post, "/chat.postMessage")
                    .with_json_body(json!({ "channel": "{{ $parameter.channel }}" })),
            )
            .returning(OutputRouting::single());

        let encoded = serde_json::to_string(&routing).expect("serialises");
        let decoded: Routing = serde_json::from_str(&encoded).expect("deserialises");

        assert_eq!(decoded.request.method, HttpMethod::Post);
        assert_eq!(decoded.request.body_type, BodyType::Json);
    }
}
