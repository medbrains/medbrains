//! Credentials at runtime: the registry of credential *types*, and the
//! provider that hands a node the decrypted data for one stored credential.
//!
//! Mirrors `credentials.ts` + `credentials-helper.ts` in n8n. The engine never
//! reads the database itself — the server supplies a [`CredentialProvider`],
//! which keeps `r8r-core` free of storage concerns and makes credential
//! behaviour testable with a map in memory.

use crate::errors::{CoreError, Result};
use async_trait::async_trait;
use r8r_workflow::credentials::{AuthMethod, CredentialTypeDescription};
use serde_json::{Map, Value};
use std::collections::HashMap;

/// One credential, decrypted and ready to use.
#[derive(Debug, Clone)]
pub struct ResolvedCredential {
    pub id: String,
    pub name: String,
    /// The credential type name, matching a `CredentialTypeDescription`.
    pub type_name: String,
    /// Field values, including secrets. Never log this.
    pub data: Value,
}

impl ResolvedCredential {
    #[must_use]
    pub fn field(&self, name: &str) -> Option<&Value> {
        self.data.get(name)
    }

    #[must_use]
    pub fn field_str(&self, name: &str) -> String {
        match self.data.get(name) {
            Some(Value::String(s)) => s.clone(),
            Some(other) => other.to_string(),
            None => String::new(),
        }
    }
}

/// Where decrypted credentials come from. Implemented by the server against
/// its database, and by tests against a `HashMap`.
#[async_trait]
pub trait CredentialProvider: Send + Sync + std::fmt::Debug {
    async fn get(&self, id: &str) -> Result<ResolvedCredential>;
}

/// A provider for contexts with no credential store — the default, so the
/// engine still runs in tests and for workflows that need no authentication.
#[derive(Debug, Default, Clone, Copy)]
pub struct NoCredentials;

#[async_trait]
impl CredentialProvider for NoCredentials {
    async fn get(&self, id: &str) -> Result<ResolvedCredential> {
        Err(CoreError::Node(format!(
            "this workflow needs credential `{id}`, but no credential store is configured"
        )))
    }
}

/// Every credential type the build knows about.
#[derive(Debug, Default, Clone)]
pub struct CredentialRegistry {
    types: HashMap<String, CredentialTypeDescription>,
}

impl CredentialRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, description: CredentialTypeDescription) -> &mut Self {
        self.types.insert(description.name.clone(), description);
        self
    }

    #[must_use]
    pub fn get(&self, name: &str) -> Option<&CredentialTypeDescription> {
        self.types.get(name)
    }

    /// Sorted so the editor's credential-type list is stable between reloads.
    #[must_use]
    pub fn descriptions(&self) -> Vec<CredentialTypeDescription> {
        let mut all: Vec<_> = self.types.values().cloned().collect();
        all.sort_by(|a, b| a.display_name.cmp(&b.display_name));
        all
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.types.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.types.is_empty()
    }
}

/// Headers, query parameters and body fields a credential contributes to a
/// request. Produced from the credential type's declarative `authenticate`
/// block, so no vendor needs bespoke code in the engine.
#[derive(Debug, Default, Clone)]
pub struct AuthContribution {
    pub headers: Map<String, Value>,
    pub query: Map<String, Value>,
    pub body: Map<String, Value>,
}

impl AuthContribution {
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.headers.is_empty() && self.query.is_empty() && self.body.is_empty()
    }
}

/// Work out what a credential adds to a request.
///
/// Templates in the `Generic` variant are resolved by the caller, which owns
/// the expression engine; everything here is a pure data transformation.
#[must_use]
pub fn contribution(method: &AuthMethod, credential: &ResolvedCredential) -> AuthContribution {
    match method {
        AuthMethod::None => AuthContribution::default(),

        AuthMethod::Generic {
            headers,
            query,
            body,
        } => AuthContribution {
            headers: headers.clone(),
            query: query.clone(),
            body: body.clone(),
        },

        AuthMethod::Bearer { field } => {
            let token = credential.field_str(field);
            let mut headers = Map::new();
            headers.insert(
                "Authorization".into(),
                Value::String(format!("Bearer {token}")),
            );
            AuthContribution {
                headers,
                ..AuthContribution::default()
            }
        }

        AuthMethod::Basic {
            username_field,
            password_field,
        } => {
            use base64::Engine as _;
            let pair = format!(
                "{}:{}",
                credential.field_str(username_field),
                credential.field_str(password_field)
            );
            let encoded = base64::engine::general_purpose::STANDARD.encode(pair);
            let mut headers = Map::new();
            headers.insert(
                "Authorization".into(),
                Value::String(format!("Basic {encoded}")),
            );
            AuthContribution {
                headers,
                ..AuthContribution::default()
            }
        }
    }
}

/// A provider backed by an in-memory map, for tests and for embedding r8r as
/// a library.
#[derive(Debug, Default, Clone)]
pub struct StaticCredentials {
    entries: HashMap<String, ResolvedCredential>,
}

impl StaticCredentials {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn with(mut self, id: &str, type_name: &str, data: Value) -> Self {
        self.entries.insert(
            id.to_owned(),
            ResolvedCredential {
                id: id.to_owned(),
                name: id.to_owned(),
                type_name: type_name.to_owned(),
                data,
            },
        );
        self
    }
}

#[async_trait]
impl CredentialProvider for StaticCredentials {
    async fn get(&self, id: &str) -> Result<ResolvedCredential> {
        self.entries
            .get(id)
            .cloned()
            .ok_or_else(|| CoreError::Node(format!("credential `{id}` was not found")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn credential(data: Value) -> ResolvedCredential {
        ResolvedCredential {
            id: "c1".into(),
            name: "Test".into(),
            type_name: "testApi".into(),
            data,
        }
    }

    #[test]
    fn bearer_auth_becomes_an_authorization_header() {
        let method = AuthMethod::Bearer {
            field: "accessToken".into(),
        };
        let result = contribution(&method, &credential(json!({ "accessToken": "xoxb-1" })));

        assert_eq!(result.headers["Authorization"], json!("Bearer xoxb-1"));
        assert!(result.query.is_empty());
    }

    #[test]
    fn basic_auth_is_base64_encoded() {
        let method = AuthMethod::Basic {
            username_field: "user".into(),
            password_field: "pass".into(),
        };
        let result = contribution(
            &method,
            &credential(json!({ "user": "ada", "pass": "hunter2" })),
        );

        // "ada:hunter2" base64-encoded.
        assert_eq!(
            result.headers["Authorization"],
            json!("Basic YWRhOmh1bnRlcjI=")
        );
    }

    #[test]
    fn a_missing_field_yields_an_empty_credential_rather_than_panicking() {
        let method = AuthMethod::Bearer {
            field: "nope".into(),
        };
        let result = contribution(&method, &credential(json!({})));
        assert_eq!(result.headers["Authorization"], json!("Bearer "));
    }

    #[test]
    fn no_auth_contributes_nothing() {
        assert!(contribution(&AuthMethod::None, &credential(json!({}))).is_empty());
    }

    #[test]
    fn generic_auth_passes_its_templates_through_for_the_caller_to_resolve() {
        let method = AuthMethod::header("X-Api-Key", "{{ credentials.apiKey }}");
        let result = contribution(&method, &credential(json!({ "apiKey": "k" })));
        assert_eq!(
            result.headers["X-Api-Key"],
            json!("{{ credentials.apiKey }}")
        );
    }

    #[tokio::test]
    async fn the_empty_provider_explains_why_it_cannot_help() {
        let error = NoCredentials.get("c1").await.expect_err("should fail");
        assert!(error.to_string().contains("no credential store"));
    }

    #[tokio::test]
    async fn a_static_provider_returns_what_it_was_given() {
        let provider =
            StaticCredentials::new().with("c1", "slackApi", json!({ "accessToken": "t" }));

        let resolved = provider.get("c1").await.expect("found");
        assert_eq!(resolved.type_name, "slackApi");
        assert_eq!(resolved.field_str("accessToken"), "t");

        assert!(provider.get("missing").await.is_err());
    }
}
