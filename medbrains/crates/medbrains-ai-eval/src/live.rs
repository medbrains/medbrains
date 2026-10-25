//! Asking a real model — synthetic cases only.
//!
//! Two providers, chosen by what credentials exist:
//! - **Bedrock, ap-south-1** (the production path): the operator's AWS
//!   credentials through the `aws` CLI. The region is fixed, not configured.
//! - **Anthropic API**: `ANTHROPIC_API_KEY`, sent to `curl` on stdin so it is
//!   never in argv, a log or a file. A non-India endpoint, which is why
//!   [`crate::Case::load_all`] refuses any case not marked synthetic.
//!
//! The text sent is the [`Request`] the redactor produced, read through
//! `Redacted::for_model()` upstream; nothing else is added.

use std::io::Write as _;
use std::process::{Command, Stdio};

use serde_json::{Value, json};

use crate::{Answer, Request};

/// India (DPDP s.16). Not configurable on purpose.
const BEDROCK_REGION: &str = "ap-south-1";
const BEDROCK_MODEL: &str = "openai.gpt-oss-120b-1:0";
const ANTHROPIC_MODEL: &str = "claude-sonnet-4-6";
const MAX_TOKENS: u32 = 4000;

/// USD per million (input, output) tokens, for the cost column.
// ponytail: list prices as of 2026-10; EVAL_AI_PRICE="in,out" overrides.
fn price(model: &str) -> (f64, f64) {
    if let Some((i, o)) = std::env::var("EVAL_AI_PRICE")
        .ok()
        .and_then(|v| {
            v.split_once(',')
                .map(|(a, b)| (a.trim().parse(), b.trim().parse()))
        })
        .and_then(|(a, b)| Some((a.ok()?, b.ok()?)))
    {
        return (i, o);
    }
    match model {
        ANTHROPIC_MODEL => (3.0, 15.0),
        _ => (0.15, 0.60),
    }
}

/// Estimated USD for an answer.
#[must_use]
pub fn cost(a: &Answer) -> f64 {
    let (i, o) = price(&a.model);
    let (tin, tout) = (a.input_tokens as f64, a.output_tokens as f64);
    tin.mul_add(i, tout * o) / 1_000_000.0
}

/// A provider that can be called now, or why none can.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    Bedrock,
    Anthropic,
}

impl Provider {
    /// `EVAL_AI_PROVIDER` if set, else Bedrock when AWS credentials work,
    /// else Anthropic when its key is set.
    ///
    /// # Errors
    /// No usable credentials — the caller skips the live run.
    pub fn detect() -> Result<Self, String> {
        match std::env::var("EVAL_AI_PROVIDER").ok().as_deref() {
            Some("bedrock") => return Ok(Self::Bedrock),
            Some("anthropic") => return Ok(Self::Anthropic),
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
        } else if std::env::var("ANTHROPIC_API_KEY").is_ok_and(|k| !k.is_empty()) {
            Ok(Self::Anthropic)
        } else {
            Err("no AWS credentials and no ANTHROPIC_API_KEY".to_owned())
        }
    }

    /// Ask the model one request.
    ///
    /// # Errors
    /// The call failed or its answer could not be read.
    pub fn ask(self, request: &Request) -> Result<Answer, String> {
        let (model, body) = match self {
            Self::Bedrock => (BEDROCK_MODEL, bedrock(request)?),
            Self::Anthropic => (ANTHROPIC_MODEL, anthropic(request)?),
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
            model: model.to_owned(),
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

fn anthropic(request: &Request) -> Result<String, String> {
    let key = std::env::var("ANTHROPIC_API_KEY").map_err(|_| "ANTHROPIC_API_KEY unset")?;
    let body = json!({
        "model": ANTHROPIC_MODEL,
        "max_tokens": MAX_TOKENS,
        "temperature": 0,
        "system": request.system.for_model(),
        "messages": [{ "role": "user", "content": request.user.for_model() }],
    });
    // The key is a header read from stdin (`-H @-`), never argv; the body
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
        Some(format!("x-api-key: {key}\n")),
    )
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
        // stderr from the CLI carries no key (it was never in argv).
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_owned());
    }
    String::from_utf8(out.stdout).map_err(|e| e.to_string())
}
