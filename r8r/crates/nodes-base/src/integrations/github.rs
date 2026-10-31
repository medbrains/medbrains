//! GitHub, as a manifest.

use super::Integration;
use super::builder::{
    field, get, get_list, multiline_field, number_field, operations, required_field, resource,
    send_json,
};
use r8r_workflow::credentials::{AuthMethod, CredentialTest, CredentialTypeDescription};
use r8r_workflow::interfaces::{
    CredentialRequirement, NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription,
    PropertyOption,
};
use r8r_workflow::routing::{HttpMethod, RequestRouting};
use serde_json::json;

const BASE_URL: &str = "https://api.github.com";

pub fn integration() -> Integration {
    Integration {
        node: node(),
        credential: credential(),
    }
}

fn credential() -> CredentialTypeDescription {
    CredentialTypeDescription {
        name: "githubApi".into(),
        display_name: "GitHub".into(),
        documentation_url: Some(
            "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens".into(),
        ),
        base_url: Some(BASE_URL.into()),
        properties: vec![
            NodeProperty::new("accessToken", "Personal Access Token", NodePropertyKind::String, json!(""))
                .required()
                .secret()
                .placeholder("ghp_…"),
            // Overriding the base URL is what makes one manifest serve both
            // github.com and GitHub Enterprise.
            NodeProperty::new("baseUrl", "API Base URL", NodePropertyKind::String, json!(BASE_URL))
                .describe("Change this for GitHub Enterprise"),
        ],
        authenticate: AuthMethod::Bearer { field: "accessToken".into() },
        test: Some(CredentialTest {
            request: RequestRouting::new(HttpMethod::Get, "user"),
            expect: None,
        }),
    }
}

fn node() -> NodeTypeDescription {
    NodeTypeDescription {
        name: "github".into(),
        display_name: "GitHub".into(),
        group: NodeGroup::Output,
        description: "Work with issues, repositories and users on GitHub".into(),
        icon: "🐙".into(),
        color: "#24292f".into(),
        properties: properties(),
        outputs: vec!["main".into()],
        inputs: vec!["main".into()],
        credentials: vec![CredentialRequirement::required("githubApi")],
        base_url: Some(BASE_URL.into()),
    }
}

fn properties() -> Vec<NodeProperty> {
    let mut all = vec![resource(vec![
        PropertyOption::new("Issue", "issue"),
        PropertyOption::new("Repository", "repository"),
        PropertyOption::new("User", "user"),
    ])];
    all.extend(issue_properties());
    all.extend(repository_properties());
    all.extend(user_properties());
    all
}

fn issue_properties() -> Vec<NodeProperty> {
    let mut all = vec![issue_operations()];
    all.extend(issue_fields());
    all
}

fn issue_operations() -> NodeProperty {
    operations(
        "issue",
        vec![
            send_json(
                "Create",
                "create",
                HttpMethod::Post,
                "repos/{{ parameter.owner }}/{{ parameter.repository }}/issues",
                json!({ "title": "{{ parameter.title }}", "body": "{{ parameter.body }}" }),
                "Open a new issue",
            ),
            get(
                "Get",
                "get",
                "repos/{{ parameter.owner }}/{{ parameter.repository }}/issues/{{ parameter.issueNumber }}",
                "Fetch one issue",
            ),
            get_list(
                "List",
                "list",
                "repos/{{ parameter.owner }}/{{ parameter.repository }}/issues",
                "",
                json!({ "state": "{{ parameter.state }}", "per_page": "{{ parameter.limit }}" }),
                "List the issues in a repository",
            ),
            send_json(
                "Comment",
                "comment",
                HttpMethod::Post,
                "repos/{{ parameter.owner }}/{{ parameter.repository }}/issues/{{ parameter.issueNumber }}/comments",
                json!({ "body": "{{ parameter.body }}" }),
                "Add a comment to an issue",
            ),
        ],
    )
}

fn issue_fields() -> Vec<NodeProperty> {
    vec![
        required_field(
            "owner",
            "Owner",
            "issue",
            &["create", "get", "list", "comment"],
        )
        .placeholder("n8n-io"),
        required_field(
            "repository",
            "Repository",
            "issue",
            &["create", "get", "list", "comment"],
        )
        .placeholder("n8n"),
        required_field("title", "Title", "issue", &["create"]),
        multiline_field("body", "Body", "issue", &["create", "comment"]),
        required_field("issueNumber", "Issue Number", "issue", &["get", "comment"]),
        NodeProperty::new("state", "State", NodePropertyKind::Options, json!("open"))
            .with_options(vec![
                PropertyOption::new("Open", "open"),
                PropertyOption::new("Closed", "closed"),
                PropertyOption::new("All", "all"),
            ])
            .show_when("resource", &["issue"])
            .show_when("operation", &["list"]),
        number_field("limit", "Limit", 30, "issue", &["list"]),
    ]
}

fn repository_properties() -> Vec<NodeProperty> {
    vec![
        operations(
            "repository",
            vec![
                get(
                    "Get",
                    "get",
                    "repos/{{ parameter.owner }}/{{ parameter.repository }}",
                    "Fetch repository metadata",
                ),
                get_list(
                    "List for User",
                    "listForUser",
                    "users/{{ parameter.owner }}/repos",
                    "",
                    json!({ "per_page": "{{ parameter.limit }}" }),
                    "List the repositories a user owns",
                ),
            ],
        ),
        required_field("owner", "Owner", "repository", &["get", "listForUser"]),
        required_field("repository", "Repository", "repository", &["get"]),
        number_field("limit", "Limit", 30, "repository", &["listForUser"]),
    ]
}

fn user_properties() -> Vec<NodeProperty> {
    vec![
        operations(
            "user",
            vec![
                get(
                    "Get",
                    "get",
                    "users/{{ parameter.username }}",
                    "Fetch a user's profile",
                ),
                get(
                    "Get Authenticated",
                    "getAuthenticated",
                    "user",
                    "Fetch the token's own user",
                ),
            ],
        ),
        field("username", "Username", "user", &["get"]).placeholder("octocat"),
    ]
}
