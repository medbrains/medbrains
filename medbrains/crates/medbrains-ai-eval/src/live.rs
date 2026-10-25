//! Asking a real model — synthetic cases only.
//!
//! Two providers, chosen by what credentials exist:
//! - **Bedrock, ap-south-1** (the production path): the Converse API through
//!   the `aws` CLI, SigV4-signed with the operator's ambient AWS credentials.
//!   The region is fixed, not configured. `EVAL_AI_MODEL` may name an
//!   India-only (`in.`) inference profile, e.g. Claude Haiku 4.5
//!   ([`BEDROCK_HAIKU_4_5`]); anything else is refused ([`bedrock_model`]).
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
use std::time::{Duration, Instant};

use medbrains_anthropic_auth::{AccessToken, FederationConfig};
use serde_json::{Value, json};

use crate::{Answer, Request, Role};

/// India (DPDP s.16). Not configurable on purpose.
const BEDROCK_REGION: &str = "ap-south-1";
const BEDROCK_MODEL: &str = "openai.gpt-oss-120b-1:0";
/// The weakest India-only Claude: routed only to ap-south-1/ap-south-2.
pub const BEDROCK_HAIKU_4_5: &str = "in.anthropic.claude-haiku-4-5-20251001-v1:0";
/// The Anthropic model unless `EVAL_AI_MODEL` names another.
pub const ANTHROPIC_MODEL: &str = "claude-sonnet-4-6";
use medbrains_core::ai_guard::MAX_ANSWER_TOKENS as MAX_TOKENS;

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
        // ponytail: regional/`in.` profiles carry +10% over the $1/$5 list
        // price (Anthropic pricing page; not stated on an AWS page).
        BEDROCK_HAIKU_4_5 => Some((1.10, 5.50)),
        "claude-sonnet-4-6" => Some((3.0, 15.0)),
        "claude-haiku-5-5" => Some((0.10, 0.50)),
        "claude-sonnet-5-5" => Some((2.0, 10.0)),
        "claude-opus-5-5" => Some((4.0, 20.0)),
        _ => None,
    }
}

/// Estimated USD for an answer, if its model's price is known: uncached
/// input at the list price, cache writes at 1.25x (5-minute TTL), cache
/// reads at 0.1x.
#[must_use]
pub fn cost(a: &Answer) -> Option<f64> {
    let (i, o) = price(&a.model)?;
    let input = (a.cache_read_tokens as f64).mul_add(
        0.1,
        (a.cache_write_tokens as f64).mul_add(1.25, a.input_tokens as f64),
    );
    Some(input.mul_add(i, a.output_tokens as f64 * o) / 1_000_000.0)
}

/// The Bedrock model to ask: `EVAL_AI_MODEL` if it is an India-only (`in.`)
/// profile, else [`BEDROCK_MODEL`] (served in ap-south-1 itself).
///
/// # Errors
/// `EVAL_AI_MODEL` names a model that could route outside India.
pub fn bedrock_model(named: Option<&str>) -> Result<String, String> {
    match named.map(str::trim).filter(|m| !m.is_empty()) {
        None => Ok(BEDROCK_MODEL.to_owned()),
        Some(m) if m == BEDROCK_MODEL || m.starts_with("in.") => Ok(m.to_owned()),
        Some(m) => Err(format!(
            "Bedrock model {m:?} is not India-only; use an `in.` inference profile"
        )),
    }
}

/// How long one call took, by stage.
#[derive(Debug, Clone, Copy, Default)]
pub struct Timing {
    /// Getting the federated access token (Anthropic only; cached after the first).
    pub auth: Duration,
    /// The provider call as the harness waited for it (CLI start included).
    pub model: Duration,
    /// The provider's own figure for the model call, where it gives one.
    pub provider: Option<Duration>,
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
            Some("bedrock") => {
                return bedrock_model(std::env::var("EVAL_AI_MODEL").ok().as_deref())
                    .map(|_| Self::Bedrock);
            }
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
    pub fn ask(self, request: &Request) -> Result<(Answer, Timing), String> {
        let mut timing = Timing::default();
        let (model, body) = match self {
            Self::Bedrock => {
                let model = bedrock_model(std::env::var("EVAL_AI_MODEL").ok().as_deref())?;
                let started = Instant::now();
                let body = bedrock(request, &model)?;
                timing.model = started.elapsed();
                (model, body)
            }
            Self::Anthropic => {
                let model = anthropic_model();
                let started = Instant::now();
                let token = anthropic_token()?;
                timing.auth = started.elapsed();
                let started = Instant::now();
                let body = anthropic(request, &model, &token)?;
                timing.model = started.elapsed();
                (model, body)
            }
        };
        let v: Value = serde_json::from_str(&body).map_err(|e| format!("bad response: {e}"))?;
        let u = &v["usage"];
        let n = |key: &str| u[key].as_u64().unwrap_or_default();
        let truncated = v["stopReason"] == "max_tokens" || v["stop_reason"] == "max_tokens";
        let (text, tin, tout, read, write) = match self {
            Self::Bedrock => {
                timing.provider = v["metrics"]["latencyMs"].as_u64().map(Duration::from_millis);
                // Like Anthropic's, Converse's inputTokens leaves out cached tokens
                // (AWS's caching example: total = input + output + cache read).
                (
                    texts(&v["output"]["message"]["content"]),
                    n("inputTokens"),
                    n("outputTokens"),
                    n("cacheReadInputTokens"),
                    n("cacheWriteInputTokens"),
                )
            }
            Self::Anthropic => (
                texts(&v["content"]),
                n("input_tokens"),
                n("output_tokens"),
                n("cache_read_input_tokens"),
                n("cache_creation_input_tokens"),
            ),
        };
        if text.is_empty() && v.get("error").is_some() {
            return Err(format!("provider error: {}", v["error"]));
        }
        let answer = Answer {
            provider: format!("{self:?}").to_lowercase(),
            model,
            system: request.system.for_model().to_owned(),
            history: request.history_lines(),
            user: request.user.for_model().to_owned(),
            output: text,
            input_tokens: tin,
            output_tokens: tout,
            cache_read_tokens: read,
            cache_write_tokens: write,
            truncated,
        };
        Ok((answer, timing))
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

fn bedrock(request: &Request, model: &str) -> Result<String, String> {
    let system = json!([{ "text": request.system.for_model() }]).to_string();
    let messages = Value::Array(messages(request, |text| json!([{ "text": text }]))).to_string();
    let config = json!({ "maxTokens": MAX_TOKENS, "temperature": 0 }).to_string();
    run(
        Command::new("aws").args([
            "bedrock-runtime",
            "converse",
            "--region",
            BEDROCK_REGION,
            "--model-id",
            model,
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

fn anthropic(request: &Request, model: &str, token: &AccessToken) -> Result<String, String> {
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
/// only the 4.x models get `temperature: 0`. The system block is the fixed
/// prefix and carries the cache breakpoint, as production's does (rig's
/// `with_prompt_caching`, 5-minute TTL); below the model's minimum (512
/// tokens on the 5.5 models, 4,096 on Haiku 4.5) the API silently skips it.
fn anthropic_body(request: &Request, model: &str) -> Value {
    let mut body = json!({
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": [{
            "type": "text",
            "text": request.system.for_model(),
            "cache_control": { "type": "ephemeral" },
        }],
        "messages": messages(request, |text| json!(text)),
    });
    if model.contains("-4-") {
        body["temperature"] = json!(0);
    }
    body
}

/// The earlier messages, then this turn's, each content shaped by `content`.
fn messages(request: &Request, content: impl Fn(&str) -> Value) -> Vec<Value> {
    request
        .history
        .iter()
        .map(|(role, m)| (*role, m))
        .chain(std::iter::once((Role::User, &request.user)))
        .map(|(role, m)| {
            let role = if role == Role::User { "user" } else { "assistant" };
            json!({ "role": role, "content": content(m.for_model()) })
        })
        .collect()
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
    use super::{Answer, BEDROCK_HAIKU_4_5, BEDROCK_MODEL, anthropic_body, bedrock_model, cost};
    use medbrains_core::ai_redact::Redacted;

    fn answer(model: &str) -> Answer {
        Answer {
            provider: "anthropic".to_owned(),
            model: model.to_owned(),
            system: String::new(),
            history: Vec::new(),
            user: String::new(),
            output: String::new(),
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            truncated: false,
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
    fn cache_reads_are_billed_at_a_tenth_and_writes_at_a_premium() {
        let mut a = answer("claude-haiku-5-5");
        (a.input_tokens, a.output_tokens) = (0, 0);
        a.cache_read_tokens = 1_000_000;
        let near = |got: Option<f64>, want: f64| got.is_some_and(|g| (g - want).abs() < 1e-9);
        assert!(near(cost(&a), 0.01), "{:?}", cost(&a));
        (a.cache_read_tokens, a.cache_write_tokens) = (0, 1_000_000);
        assert!(near(cost(&a), 0.125), "{:?}", cost(&a));
    }

    #[test]
    fn bedrock_asks_only_india_only_models() {
        assert_eq!(bedrock_model(None).as_deref(), Ok(BEDROCK_MODEL));
        assert_eq!(bedrock_model(Some(BEDROCK_HAIKU_4_5)).as_deref(), Ok(BEDROCK_HAIKU_4_5));
        assert!(bedrock_model(Some("global.anthropic.claude-haiku-5-5")).is_err());
        assert!(bedrock_model(Some("anthropic.claude-haiku-4-5-20251001-v1:0")).is_err());
    }

    #[test]
    fn the_fixed_prefix_carries_the_cache_breakpoint() {
        let request = crate::Request {
            system: Redacted::fixed("system"),
            history: Vec::new(),
            user: Redacted::fixed("question"),
            record: Redacted::fixed(""),
            question: Redacted::fixed("question"),
        };
        let body = anthropic_body(&request, "claude-haiku-5-5");
        assert_eq!(body["system"][0]["text"], "system");
        assert_eq!(body["system"][0]["cache_control"]["type"], "ephemeral");
        assert!(body["messages"][0].get("cache_control").is_none());
    }

    #[test]
    fn only_4x_models_get_a_temperature() {
        let request = crate::Request {
            system: Redacted::fixed("system"),
            history: Vec::new(),
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
