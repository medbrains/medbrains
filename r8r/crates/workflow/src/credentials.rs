//! Credential *types* — the schema of a secret, not the secret itself.
//!
//! Mirrors n8n's `ICredentialType`. A credential type declares which fields it
//! holds and, declaratively, how those fields are attached to an outgoing
//! request. That means adding OAuth-style header auth for a new API is a data
//! change, not a code change, and the engine never needs to special-case a
//! vendor.

use crate::interfaces::{NodeProperty, NodePropertyKind};
use crate::routing::RequestRouting;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// How a credential is attached to a request.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AuthMethod {
    /// Nothing is attached — for public APIs.
    #[default]
    None,
    /// Merge these templated headers, query parameters and body fields into
    /// every request. Templates read `{{ credentials.<field> }}`.
    Generic {
        #[serde(default, skip_serializing_if = "Map::is_empty")]
        headers: Map<String, Value>,
        #[serde(default, skip_serializing_if = "Map::is_empty")]
        query: Map<String, Value>,
        #[serde(default, skip_serializing_if = "Map::is_empty")]
        body: Map<String, Value>,
    },
    /// `Authorization: Bearer <field>`.
    Bearer { field: String },
    /// `Authorization: Basic base64(user:password)`.
    Basic {
        username_field: String,
        password_field: String,
    },
}

impl AuthMethod {
    /// Sugar for the most common shape: one header carrying one field.
    #[must_use]
    pub fn header(name: &str, template: &str) -> Self {
        let mut headers = Map::new();
        headers.insert(name.to_owned(), Value::String(template.to_owned()));
        AuthMethod::Generic {
            headers,
            query: Map::new(),
            body: Map::new(),
        }
    }

    /// Sugar for APIs that take the key as a query parameter.
    #[must_use]
    pub fn query(name: &str, template: &str) -> Self {
        let mut query = Map::new();
        query.insert(name.to_owned(), Value::String(template.to_owned()));
        AuthMethod::Generic {
            headers: Map::new(),
            query,
            body: Map::new(),
        }
    }
}

/// A request that proves the credential works, shown as "Test" in the editor.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialTest {
    /// Absolute, or relative to `base_url`.
    pub request: RequestRouting,
    /// Optional expression that must be truthy for the test to pass — some
    /// APIs answer 200 with `{ "ok": false }`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expect: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialTypeDescription {
    /// Stable identifier referenced by nodes, e.g. `slackApi`.
    pub name: String,
    pub display_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub documentation_url: Option<String>,
    /// Base URL for this vendor, used by the test request and by any node that
    /// does not set its own.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    pub properties: Vec<NodeProperty>,
    #[serde(default)]
    pub authenticate: AuthMethod,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub test: Option<CredentialTest>,
}

impl CredentialTypeDescription {
    /// Field names that hold secrets, so callers can redact them.
    #[must_use]
    pub fn secret_fields(&self) -> Vec<&str> {
        self.properties
            .iter()
            .filter(|property| property.password)
            .map(|property| property.name.as_str())
            .collect()
    }

    /// The same data with every secret replaced by a placeholder — what the
    /// API returns to the editor, which must never receive the real values.
    #[must_use]
    pub fn redact(&self, data: &Value) -> Value {
        let Some(object) = data.as_object() else {
            return Value::Object(Map::new());
        };
        let secrets = self.secret_fields();

        let redacted = object
            .iter()
            .map(|(key, value)| {
                if secrets.contains(&key.as_str()) && !is_blank(value) {
                    (key.clone(), Value::String(REDACTED.to_owned()))
                } else {
                    (key.clone(), value.clone())
                }
            })
            .collect();
        Value::Object(redacted)
    }

    /// Merge an incoming edit over the stored data, keeping the existing secret
    /// wherever the editor sent back the placeholder rather than a new value.
    #[must_use]
    pub fn merge_secrets(&self, stored: &Value, incoming: &Value) -> Value {
        let empty = Map::new();
        let stored = stored.as_object().unwrap_or(&empty);
        let Some(incoming) = incoming.as_object() else {
            return Value::Object(stored.clone());
        };

        let merged = incoming
            .iter()
            .map(|(key, value)| {
                let unchanged = value.as_str() == Some(REDACTED);
                match stored.get(key).filter(|_| unchanged) {
                    Some(existing) => (key.clone(), existing.clone()),
                    None => (key.clone(), value.clone()),
                }
            })
            .collect();
        Value::Object(merged)
    }

    /// A convenient starting point for a token-in-a-header integration.
    #[must_use]
    pub fn bearer_token(name: &str, display_name: &str, base_url: &str) -> Self {
        CredentialTypeDescription {
            name: name.to_owned(),
            display_name: display_name.to_owned(),
            documentation_url: None,
            base_url: Some(base_url.to_owned()),
            properties: vec![
                NodeProperty::new(
                    "accessToken",
                    "Access Token",
                    NodePropertyKind::String,
                    Value::String(String::new()),
                )
                .required()
                .secret(),
            ],
            authenticate: AuthMethod::Bearer {
                field: "accessToken".to_owned(),
            },
            test: None,
        }
    }
}

/// What the API sends instead of a stored secret.
pub const REDACTED: &str = "__r8r_unchanged__";

fn is_blank(value: &Value) -> bool {
    matches!(value, Value::Null) || value.as_str().is_some_and(str::is_empty)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn slack() -> CredentialTypeDescription {
        CredentialTypeDescription::bearer_token("slackApi", "Slack", "https://slack.com/api")
    }

    #[test]
    fn secrets_are_replaced_by_a_placeholder_never_returned_raw() {
        let redacted = slack().redact(&json!({ "accessToken": "xoxb-real-secret" }));
        assert_eq!(redacted["accessToken"], json!(REDACTED));
        assert!(!redacted.to_string().contains("xoxb-real-secret"));
    }

    #[test]
    fn a_blank_secret_stays_blank_so_the_form_does_not_look_filled_in() {
        let redacted = slack().redact(&json!({ "accessToken": "" }));
        assert_eq!(redacted["accessToken"], json!(""));
    }

    #[test]
    fn non_secret_fields_are_returned_as_they_are() {
        let mut credential = slack();
        credential.properties.push(NodeProperty::new(
            "workspace",
            "Workspace",
            NodePropertyKind::String,
            json!(""),
        ));

        let redacted = credential.redact(&json!({ "accessToken": "s", "workspace": "acme" }));
        assert_eq!(redacted["workspace"], json!("acme"));
    }

    #[test]
    fn saving_without_retyping_the_secret_keeps_the_stored_one() {
        let stored = json!({ "accessToken": "xoxb-real-secret" });
        let edited = json!({ "accessToken": REDACTED });

        let merged = slack().merge_secrets(&stored, &edited);

        assert_eq!(merged["accessToken"], json!("xoxb-real-secret"));
    }

    #[test]
    fn typing_a_new_secret_replaces_the_stored_one() {
        let stored = json!({ "accessToken": "old" });
        let edited = json!({ "accessToken": "new" });

        assert_eq!(
            slack().merge_secrets(&stored, &edited)["accessToken"],
            json!("new")
        );
    }

    #[test]
    fn a_field_added_by_the_editor_survives_the_merge() {
        let merged = slack().merge_secrets(&json!({}), &json!({ "workspace": "acme" }));
        assert_eq!(merged["workspace"], json!("acme"));
    }
}
