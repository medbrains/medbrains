//! Credential types for the generic HTTP Request node.
//!
//! These carry no vendor knowledge: they exist so a user calling an API r8r
//! has no manifest for can still keep the secret out of the workflow JSON.

use r8r_workflow::credentials::{AuthMethod, CredentialTypeDescription};
use r8r_workflow::interfaces::{NodeProperty, NodePropertyKind};
use serde_json::json;

pub fn all() -> Vec<CredentialTypeDescription> {
    vec![header_auth(), bearer_auth(), basic_auth()]
}

/// Any single header, e.g. `X-Api-Key: …`.
fn header_auth() -> CredentialTypeDescription {
    CredentialTypeDescription {
        name: "httpHeaderAuth".into(),
        display_name: "Header Auth".into(),
        documentation_url: None,
        base_url: None,
        properties: vec![
            NodeProperty::new(
                "name",
                "Header Name",
                NodePropertyKind::String,
                json!("X-Api-Key"),
            )
            .required(),
            NodeProperty::new("value", "Header Value", NodePropertyKind::String, json!(""))
                .required()
                .secret(),
        ],
        authenticate: AuthMethod::header("{{ credentials.name }}", "{{ credentials.value }}"),
        test: None,
    }
}

fn bearer_auth() -> CredentialTypeDescription {
    CredentialTypeDescription {
        name: "httpBearerAuth".into(),
        display_name: "Bearer Token".into(),
        documentation_url: None,
        base_url: None,
        properties: vec![
            NodeProperty::new("token", "Token", NodePropertyKind::String, json!(""))
                .required()
                .secret(),
        ],
        authenticate: AuthMethod::Bearer {
            field: "token".into(),
        },
        test: None,
    }
}

fn basic_auth() -> CredentialTypeDescription {
    CredentialTypeDescription {
        name: "httpBasicAuth".into(),
        display_name: "Basic Auth".into(),
        documentation_url: None,
        base_url: None,
        properties: vec![
            NodeProperty::new("username", "Username", NodePropertyKind::String, json!(""))
                .required(),
            NodeProperty::new("password", "Password", NodePropertyKind::String, json!(""))
                .required()
                .secret(),
        ],
        authenticate: AuthMethod::Basic {
            username_field: "username".into(),
            password_field: "password".into(),
        },
        test: None,
    }
}
