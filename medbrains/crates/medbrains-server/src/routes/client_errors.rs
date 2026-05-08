use axum::{Extension, Json};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{error::AppError, middleware::auth::Claims};

#[derive(Debug, Deserialize)]
pub struct ClientErrorReportRequest {
    route: String,
    name: Option<String>,
    message: String,
    stack: Option<String>,
    component_stack: Option<String>,
    method: Option<String>,
    source: Option<String>,
    status: Option<i32>,
    user_agent: Option<String>,
    occurred_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ClientErrorReportResponse {
    accepted: bool,
    delivered_to_github: bool,
    issue_number: Option<i64>,
}

#[derive(Serialize)]
struct GithubIssueRequest {
    title: String,
    body: String,
    labels: Vec<String>,
}

#[derive(Deserialize)]
struct GithubIssueResponse {
    number: i64,
}

#[derive(Deserialize)]
struct GithubIssueListItem {
    number: i64,
    title: String,
}

#[derive(Serialize)]
struct GithubIssueCommentRequest {
    body: String,
}

pub async fn report_client_error(
    Extension(claims): Extension<Claims>,
    Json(body): Json<ClientErrorReportRequest>,
) -> Result<Json<ClientErrorReportResponse>, AppError> {
    let report = SanitizedClientErrorReport::from_request(&claims, &body);

    tracing::error!(
        route = %report.route,
        error_name = %report.name,
        error_message = %report.message,
        user_id = %claims.sub,
        tenant_id = %claims.tenant_id,
        "client screen crash"
    );

    let issue_number = match create_github_issue(&report).await {
        Ok(number) => number,
        Err(err) => {
            tracing::warn!(error = %err, "client crash report accepted but GitHub delivery failed");
            None
        }
    };

    Ok(Json(ClientErrorReportResponse {
        accepted: true,
        delivered_to_github: issue_number.is_some(),
        issue_number,
    }))
}

struct SanitizedClientErrorReport {
    fingerprint: String,
    route: String,
    name: String,
    message: String,
    stack: Option<String>,
    component_stack: Option<String>,
    method: Option<String>,
    source: String,
    status: Option<i32>,
    user_agent: String,
    occurred_at: String,
    user_id: Uuid,
    tenant_id: Uuid,
}

impl SanitizedClientErrorReport {
    fn from_request(claims: &Claims, body: &ClientErrorReportRequest) -> Self {
        let route_without_query = body.route.split('?').next().unwrap_or("/");
        let route = redact_uuid_path_segments(route_without_query);
        let name = truncate(body.name.as_deref().unwrap_or("Error"), 80);
        let message = truncate(&body.message, 500);
        let method = body.method.as_deref().map(|value| truncate(value, 12));
        let source = truncate(body.source.as_deref().unwrap_or("ui"), 24);
        let fingerprint = build_fingerprint(
            &source,
            method.as_deref(),
            body.status,
            &route,
            &name,
            &message,
        );

        Self {
            fingerprint,
            route: truncate(&route, 256),
            name,
            message,
            stack: body.stack.as_deref().map(|value| truncate(value, 4_000)),
            component_stack: body
                .component_stack
                .as_deref()
                .map(|value| truncate(value, 3_000)),
            method,
            source,
            status: body.status,
            user_agent: truncate(body.user_agent.as_deref().unwrap_or("unknown"), 300),
            occurred_at: truncate(body.occurred_at.as_deref().unwrap_or("unknown"), 64),
            user_id: claims.sub,
            tenant_id: claims.tenant_id,
        }
    }

    fn github_title(&self) -> String {
        truncate(
            &format!(
                "[{}:{}] {} on {}",
                self.source, self.fingerprint, self.name, self.route
            ),
            240,
        )
    }

    fn github_body(&self) -> String {
        let include_stack = std::env::var("GITHUB_ISSUES_INCLUDE_CLIENT_STACK")
            .ok()
            .as_deref()
            == Some("true");

        let mut lines = vec![
            "Automated MedBrains client crash report.".to_owned(),
            String::new(),
            format!("Fingerprint: `{}`", self.fingerprint),
            format!("Source: `{}`", self.source),
            format!("Route: `{}`", self.route),
            format!("Method: `{}`", self.method.as_deref().unwrap_or("-")),
            format!(
                "Status: `{}`",
                self.status
                    .map(|status| status.to_string())
                    .unwrap_or_else(|| "-".to_owned())
            ),
            format!("Occurred at: `{}`", self.occurred_at),
            format!("Error: `{}`", self.name),
            format!("Message: `{}`", self.message),
            format!("Browser: `{}`", self.user_agent),
            String::new(),
            format!("Tenant ID: `{}`", self.tenant_id),
            format!("User ID: `{}`", self.user_id),
        ];

        if include_stack {
            if let Some(stack) = &self.stack {
                lines.push(String::new());
                lines.push("Stack:".to_owned());
                lines.push(format!("```text\n{stack}\n```"));
            }

            if let Some(component_stack) = &self.component_stack {
                lines.push(String::new());
                lines.push("React component stack:".to_owned());
                lines.push(format!("```text\n{component_stack}\n```"));
            }
        }

        lines.join("\n")
    }

    fn github_comment_body(&self) -> String {
        [
            "Another occurrence was captured for this fingerprint.".to_owned(),
            String::new(),
            format!("Occurred at: `{}`", self.occurred_at),
            format!("Route: `{}`", self.route),
            format!("Method: `{}`", self.method.as_deref().unwrap_or("-")),
            format!(
                "Status: `{}`",
                self.status
                    .map(|status| status.to_string())
                    .unwrap_or_else(|| "-".to_owned())
            ),
            format!("Tenant ID: `{}`", self.tenant_id),
            format!("User ID: `{}`", self.user_id),
        ]
        .join("\n")
    }
}

async fn create_github_issue(report: &SanitizedClientErrorReport) -> Result<Option<i64>, String> {
    let token = match std::env::var("GITHUB_ISSUES_TOKEN") {
        Ok(token) if !token.trim().is_empty() => token,
        _ => return Ok(None),
    };

    let repo = match std::env::var("GITHUB_ISSUES_REPO") {
        Ok(repo) if !repo.trim().is_empty() => repo,
        _ => return Ok(None),
    };

    let labels = std::env::var("GITHUB_ISSUES_LABELS")
        .unwrap_or_else(|_| "bug,client-error".to_owned())
        .split(',')
        .map(str::trim)
        .filter(|label| !label.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();

    let api_base = std::env::var("GITHUB_ISSUES_API_URL")
        .unwrap_or_else(|_| "https://api.github.com".to_owned());
    let client = reqwest::Client::new();

    if let Some(existing_issue_number) =
        find_existing_github_issue(&client, &api_base, &repo, &token, &report.fingerprint).await?
    {
        add_github_issue_comment(
            &client,
            &api_base,
            &repo,
            &token,
            existing_issue_number,
            &report.github_comment_body(),
        )
        .await?;
        return Ok(Some(existing_issue_number));
    }

    let url = format!("{}/repos/{}/issues", api_base.trim_end_matches('/'), repo);
    let payload = GithubIssueRequest {
        title: report.github_title(),
        body: report.github_body(),
        labels,
    };

    let response = client
        .post(url)
        .bearer_auth(token)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::USER_AGENT, "MedBrains-HMS")
        .json(&payload)
        .send()
        .await
        .map_err(|err| err.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GitHub issue create failed with {status}: {body}"));
    }

    let issue = response
        .json::<GithubIssueResponse>()
        .await
        .map_err(|err| err.to_string())?;

    Ok(Some(issue.number))
}

async fn find_existing_github_issue(
    client: &reqwest::Client,
    api_base: &str,
    repo: &str,
    token: &str,
    fingerprint: &str,
) -> Result<Option<i64>, String> {
    let url = format!("{}/repos/{}/issues", api_base.trim_end_matches('/'), repo);
    let response = client
        .get(url)
        .bearer_auth(token)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::USER_AGENT, "MedBrains-HMS")
        .query(&[("state", "open"), ("per_page", "100")])
        .send()
        .await
        .map_err(|err| err.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GitHub issue list failed with {status}: {body}"));
    }

    let result = response
        .json::<Vec<GithubIssueListItem>>()
        .await
        .map_err(|err| err.to_string())?;

    Ok(result
        .into_iter()
        .find(|item| item.title.contains(fingerprint))
        .map(|item| item.number))
}

async fn add_github_issue_comment(
    client: &reqwest::Client,
    api_base: &str,
    repo: &str,
    token: &str,
    issue_number: i64,
    body: &str,
) -> Result<(), String> {
    let url = format!(
        "{}/repos/{}/issues/{}/comments",
        api_base.trim_end_matches('/'),
        repo,
        issue_number
    );
    let response = client
        .post(url)
        .bearer_auth(token)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::USER_AGENT, "MedBrains-HMS")
        .json(&GithubIssueCommentRequest {
            body: body.to_owned(),
        })
        .send()
        .await
        .map_err(|err| err.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GitHub issue comment failed with {status}: {body}"));
    }

    Ok(())
}

fn redact_uuid_path_segments(route: &str) -> String {
    route
        .split('/')
        .map(|segment| {
            if Uuid::parse_str(segment).is_ok() {
                ":id"
            } else {
                segment
            }
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn build_fingerprint(
    source: &str,
    method: Option<&str>,
    status: Option<i32>,
    route: &str,
    name: &str,
    message: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(source.as_bytes());
    hasher.update(method.unwrap_or("").as_bytes());
    hasher.update(status.unwrap_or_default().to_string().as_bytes());
    hasher.update(route.as_bytes());
    hasher.update(name.as_bytes());
    hasher.update(message.as_bytes());
    truncate(&hex::encode(hasher.finalize()), 16)
}

fn truncate(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}
