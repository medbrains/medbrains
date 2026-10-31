//! Slack, as a manifest.
//!
//! Every operation below is data: no HTTP code, no error handling, no retry
//! logic. Compare with `nodes/http_request.rs` — that node exists so users can
//! call *any* API; this file exists so they do not have to for this one.

use super::Integration;
use super::builder::{
    acknowledge, field, get_list, multiline_field, operations, required_field, resource, send_json,
};
use r8r_workflow::credentials::{AuthMethod, CredentialTest, CredentialTypeDescription};
use r8r_workflow::interfaces::{
    CredentialRequirement, NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription,
    PropertyOption,
};
use r8r_workflow::routing::{HttpMethod, RequestRouting};
use serde_json::json;

const BASE_URL: &str = "https://slack.com/api";

pub fn integration() -> Integration {
    Integration {
        node: node(),
        credential: credential(),
    }
}

/// A Slack bot or user token.
fn credential() -> CredentialTypeDescription {
    CredentialTypeDescription {
        name: "slackApi".into(),
        display_name: "Slack".into(),
        documentation_url: Some("https://api.slack.com/authentication/token-types".into()),
        base_url: Some(BASE_URL.into()),
        properties: vec![
            NodeProperty::new(
                "accessToken",
                "Access Token",
                NodePropertyKind::String,
                json!(""),
            )
            .required()
            .secret()
            .placeholder("xoxb-…")
            .describe("A bot token from your Slack app's OAuth & Permissions page"),
        ],
        authenticate: AuthMethod::Bearer {
            field: "accessToken".into(),
        },
        // Slack answers 200 even for a bad token, with `ok: false` in the body,
        // so the status code alone is not proof the credential works.
        test: Some(CredentialTest {
            request: RequestRouting::new(HttpMethod::Post, "auth.test"),
            expect: Some("item.body.ok == true".into()),
        }),
    }
}

fn node() -> NodeTypeDescription {
    NodeTypeDescription {
        name: "slack".into(),
        display_name: "Slack".into(),
        group: NodeGroup::Output,
        description: "Post messages and read channels in Slack".into(),
        icon: "💬".into(),
        color: "#4a154b".into(),
        properties: properties(),
        outputs: vec!["main".into()],
        inputs: vec!["main".into()],
        credentials: vec![CredentialRequirement::required("slackApi")],
        base_url: Some(BASE_URL.into()),
    }
}

fn properties() -> Vec<NodeProperty> {
    let mut all = vec![resource(vec![
        PropertyOption::new("Message", "message"),
        PropertyOption::new("Channel", "channel"),
        PropertyOption::new("User", "user"),
    ])];
    all.extend(message_properties());
    all.extend(channel_properties());
    all.extend(user_properties());
    all
}

fn message_properties() -> Vec<NodeProperty> {
    vec![
        operations(
            "message",
            vec![
                send_json(
                    "Send",
                    "send",
                    HttpMethod::Post,
                    "chat.postMessage",
                    json!({
                        "channel": "{{ parameter.channel }}",
                        "text": "{{ parameter.text }}"
                    }),
                    "Post a message to a channel",
                ),
                send_json(
                    "Update",
                    "update",
                    HttpMethod::Post,
                    "chat.update",
                    json!({
                        "channel": "{{ parameter.channel }}",
                        "ts": "{{ parameter.timestamp }}",
                        "text": "{{ parameter.text }}"
                    }),
                    "Edit a message you already sent",
                ),
                acknowledge(
                    "Delete",
                    "delete",
                    HttpMethod::Post,
                    "chat.delete?channel={{ parameter.channel }}&ts={{ parameter.timestamp }}",
                    "Delete a message",
                ),
            ],
        ),
        required_field(
            "channel",
            "Channel",
            "message",
            &["send", "update", "delete"],
        )
        .placeholder("#general or C0123456789"),
        multiline_field("text", "Message Text", "message", &["send", "update"])
            .describe("Supports Slack markdown and {{ item.field }} expressions"),
        required_field(
            "timestamp",
            "Message Timestamp",
            "message",
            &["update", "delete"],
        )
        .describe("The `ts` value Slack returned when the message was posted"),
    ]
}

fn channel_properties() -> Vec<NodeProperty> {
    vec![
        operations(
            "channel",
            vec![
                get_list(
                    "List",
                    "list",
                    "conversations.list",
                    "channels",
                    json!({ "limit": "{{ parameter.limit }}", "exclude_archived": "true" }),
                    "List the channels in the workspace",
                ),
                send_json(
                    "Create",
                    "create",
                    HttpMethod::Post,
                    "conversations.create",
                    json!({ "name": "{{ parameter.name }}" }),
                    "Create a channel",
                ),
            ],
        ),
        super::builder::number_field("limit", "Limit", 100, "channel", &["list"])
            .describe("How many channels to return"),
        required_field("name", "Channel Name", "channel", &["create"])
            .placeholder("project-apollo"),
    ]
}

fn user_properties() -> Vec<NodeProperty> {
    vec![
        operations(
            "user",
            vec![
                get_list(
                    "List",
                    "list",
                    "users.list",
                    "members",
                    json!({ "limit": "{{ parameter.limit }}" }),
                    "List the members of the workspace",
                ),
                super::builder::get(
                    "Get",
                    "get",
                    "users.info?user={{ parameter.userId }}",
                    "Look up one user",
                ),
            ],
        ),
        super::builder::number_field("limit", "Limit", 100, "user", &["list"]),
        field("userId", "User ID", "user", &["get"]).placeholder("U0123456789"),
    ]
}
