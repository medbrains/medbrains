//! Asking a real model — synthetic cases only.
//!
//! Two providers, chosen by what credentials exist:
//! - **Bedrock, ap-south-1** (the production path): the operator's AWS
//!   credentials through the `aws` CLI. The region is fixed, not configured.
//! - **Anthropic API** (`EVAL_AI_PROVIDER=anthropic`, dev/eval only): no API
//!   key — the AWS identity is exchanged for a short-lived access token
//!   ([`medbrains_anthropic_auth`]), sent to `curl` on stdin so it is never in
//!   argv, a log or a file. A non-India endpoint, which is why
//!   [`crate::Case::load_all`] refuses any case not marked synthetic.
//!   `EVAL_AI_MODEL` picks the model (default [`ANTHROPIC_MODEL`]).
//!
//! The text sent is the [`Request`] the redactor produced, read through
//! `Redacted::for_model()` upstream; nothing else is added.

use std::io::Write as _;
use std::process::{Command, Stdio};

use medbrains_anthropic_auth::{AccessToken, FederationConfig};
use serde_json::{Value, json};

use crate::{Answer, Request};

/// India (DPDP s.16). Not configurable on purpose.
const BEDROCK_REGION: &str = "ap-south-1";
const BEDROCK_MODEL: &str = "openai.gpt-oss-120b-1:0";
/// The Anthropic model unless `EVAL_AI_MODEL` names another.
pub const ANTHROPIC_MODEL: &str = "claude-sonnet-4-6";
const MAX_TOKENS: u32 = 4000;

/// USD per million (input, output) tokens, for the cost column; `None` for
/// a model whose price is not known here (the report says "unknown").
// ponytail: Anthropic list prices as of 2026-10 (Haiku 5.5 is the <=100K-prompt
// rate); EVAL_AI_PRICE="in,out" overrides.
fn price(model: &str) -> Option<(f64, f64)> {
    if let Some(p) = std::env::var("EVAL_AI_PRICE")
        .ok()
        .and_then(|v| {
            v.split_once(',')
                .map(|(a, b)| (a.trim().parse(), b.trim().parse()))
        })
        .and_then(|(a, b)| Some((a.ok()?, b.ok()?)))
    {
        return Some(p);
    }
    match model {
        BEDROCK_MODEL => Some((0.15, 0.60)),
        "claude-sonnet-4-6" => Some((3.0, 15.0)),
        "claude-haiku-5-5" => Some((0.10, 0.50)),
        "claude-sonnet-5-5" => Some((2.0, 10.0)),
        "claude-opus-5-5" => Some((4.0, 20.0)),
        _ => None,
    }
}

/// Estimated USD for an answer, if its model's price is known.
#[must_use]
pub fn cost(a: &Answer) -> Option<f64> {
    let (i, o) = price(&a.model)?;
    let (tin, tout) = (a.input_tokens as f64, a.output_tokens as f64);
    Some(tin.mul_add(i, tout * o) / 1_000_000.0)
}

/// The Anthropic model to ask: `EVAL_AI_MODEL`, else [`ANTHROPIC_MODEL`].
fn anthropic_model() -> String {
    std::env::var("EVAL_AI_MODEL")
        .ok()
        .map(|m| m.trim().to_owned())
        .filter(|m| !m.is_empty())
        .unwrap_or_else(|| ANTHROPIC_MODEL.to_owned())
}

/// A provider that can be called now, or why none can.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    Bedrock,
    Anthropic,
}

impl Provider {
    /// `EVAL_AI_PROVIDER` if set, else Bedrock when AWS credentials work.
    /// Anthropic is only ever chosen by name, and needs its federation IDs.
    ///
    /// # Errors
    /// No usable credentials, or Anthropic chosen without its federation
    /// IDs — the caller skips the live run and prints why.
    pub fn detect() -> Result<Self, String> {
        match std::env::var("EVAL_AI_PROVIDER").ok().as_deref() {
            Some("bedrock") => return Ok(Self::Bedrock),
            Some("anthropic") => {
                return FederationConfig::from_env()
                    .map(|_| Self::Anthropic)
                    .map_err(|e| e.to_string());
            }
            _ => {}
        }
        let aws = Command::new("aws")
            .args(["sts", "get-caller-identity", "--output", "json"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|s| s.success());
        if aws {
            Ok(Self::Bedrock)
        } else {
            Err(
                "no AWS credentials (set EVAL_AI_PROVIDER=anthropic for the Anthropic API)"
                    .to_owned(),
            )
        }
    }

    /// Ask the model one request.
    ///
    /// # Errors
    /// The call failed or its answer could not be read.
    pub fn ask(self, request: &Request) -> Result<Answer, String> {
        let (model, body) = match self {
            Self::Bedrock => (BEDROCK_MODEL.to_owned(), bedrock(request)?),
            Self::Anthropic => {
                let model = anthropic_model();
                let body = anthropic(request, &model)?;
                (model, body)
            }
        };
        let v: Value = serde_json::from_str(&body).map_err(|e| format!("bad response: {e}"))?;
        let (text, tin, tout) = match self {
            Self::Bedrock => (
                texts(&v["output"]["message"]["content"]),
                &v["usage"]["inputTokens"],
                &v["usage"]["outputTokens"],
            ),
            Self::Anthropic => (
                texts(&v["content"]),
                &v["usage"]["input_tokens"],
                &v["usage"]["output_tokens"],
            ),
        };
        if text.is_empty() && v.get("error").is_some() {
            return Err(format!("provider error: {}", v["error"]));
        }
        Ok(Answer {
            provider: format!("{self:?}").to_lowercase(),
            model,
            system: request.system.for_model().to_owned(),
            user: request.user.for_model().to_owned(),
            output: text,
            input_tokens: tin.as_u64().unwrap_or_default(),
            output_tokens: tout.as_u64().unwrap_or_default(),
        })
    }
}

/// The visible text blocks (reasoning blocks are not the answer).
fn texts(content: &Value) -> String {
    content
        .as_array()
        .map(|blocks| {
            blocks
                .iter()
                .filter_map(|b| b.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default()
}

fn bedrock(request: &Request) -> Result<String, String> {
    let system = json!([{ "text": request.system.for_model() }]).to_string();
    let messages =
        json!([{ "role": "user", "content": [{ "text": request.user.for_model() }] }]).to_string();
    let config = json!({ "maxTokens": MAX_TOKENS, "temperature": 0 }).to_string();
    run(
        Command::new("aws").args([
            "bedrock-runtime",
            "converse",
            "--region",
            BEDROCK_REGION,
            "--model-id",
            BEDROCK_MODEL,
            "--system",
            &system,
            "--messages",
            &messages,
            "--inference-config",
            &config,
            "--output",
            "json",
        ]),
        None,
    )
}

fn anthropic(request: &Request, model: &str) -> Result<String, String> {
    let token = anthropic_token()?;
    let body = anthropic_body(request, model);
    // The token is a header read from stdin (`-H @-`), never argv; the body
    // in argv is synthetic text.
    run(
        Command::new("curl").args([
            "-sS",
            "-m",
            "120",
            "https://api.anthropic.com/v1/messages",
            "-H",
            "@-",
            "-H",
            "content-type: application/json",
            "-H",
            "anthropic-version: 2023-06-01",
            "--data-raw",
            &body.to_string(),
        ]),
        Some(format!("authorization: Bearer {}\n", token.expose())),
    )
}

/// The Messages body. The 5.x models refuse a non-default `temperature`, so
/// only the 4.x models get `temperature: 0`.
fn anthropic_body(request: &Request, model: &str) -> Value {
    let mut body = json!({
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": request.system.for_model(),
        "messages": [{ "role": "user", "content": request.user.for_model() }],
    });
    if model.contains("-4-") {
        body["temperature"] = json!(0);
    }
    body
}

/// A federated access token (cached in-process until shortly before expiry).
fn anthropic_token() -> Result<AccessToken, String> {
    let cfg = FederationConfig::from_env().map_err(|e| e.to_string())?;
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| format!("could not start the token runtime: {e}"))?
        .block_on(medbrains_anthropic_auth::access_token(&cfg))
        .map_err(|e| e.to_string())
}

fn run(cmd: &mut Command, stdin: Option<String>) -> Result<String, String> {
    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start provider CLI: {e}"))?;
    if let (Some(input), Some(mut pipe)) = (stdin, child.stdin.take()) {
        pipe.write_all(input.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        // stderr from the CLI carries no token (it was never in argv).
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_owned());
    }
    String::from_utf8(out.stdout).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::{Answer, anthropic_body, cost};
    use medbrains_core::ai_redact::Redacted;

    fn answer(model: &str) -> Answer {
        Answer {
            provider: "anthropic".to_owned(),
            model: model.to_owned(),
            system: String::new(),
            user: String::new(),
            output: String::new(),
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
        }
    }

    #[test]
    fn cost_is_known_or_unknown_never_guessed() {
        assert_eq!(cost(&answer("claude-haiku-5-5")), Some(0.60));
        assert_eq!(cost(&answer("claude-opus-5-5")), Some(24.0));
        assert_eq!(cost(&answer("claude-sonnet-5-5")), Some(12.0));
        assert_eq!(cost(&answer("claude-next-9")), None);
    }

    #[test]
    fn only_4x_models_get_a_temperature() {
        let request = crate::Request {
            system: Redacted::fixed("system"),
            user: Redacted::fixed("question"),
            record: Redacted::fixed(""),
            question: Redacted::fixed("question"),
        };
        assert!(
            anthropic_body(&request, "claude-haiku-5-5")
                .get("temperature")
                .is_none()
        );
        assert_eq!(
            anthropic_body(&request, "claude-sonnet-4-6")["temperature"],
            0
        );
        assert_eq!(
            anthropic_body(&request, "claude-haiku-5-5")["model"],
            "claude-haiku-5-5"
        );
    }
}
