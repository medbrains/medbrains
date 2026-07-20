//! Adversarial verifier for agent findings.
//!
//! A synthetic agent's self-reported findings ("this screen confused me") are
//! noisy — the agent can misunderstand the UI or invent a problem. This runs a
//! second, skeptical LLM pass that tries to REJECT each subjective finding, so
//! only defects that survive scrutiny are marked `confirmed`. Objective
//! failures (a 5xx, a permission-denied) are auto-confirmed by the caller and
//! never reach here.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use medbrains_server_core::state::AppState;
use medbrains_server_services::llm;

const PREAMBLE: &str = "You are a skeptical QA verifier reviewing a defect a synthetic test agent \
reported while driving a hospital app. Decide whether it is a REAL product defect or the agent \
misunderstanding the system. Be adversarial: default to 'rejected' unless the report clearly \
describes a genuine bug, confusing flow, missing translation, or wrong behaviour. Return: \
verdict = 'confirmed' (clearly a real defect), 'plausible' (could be real, needs a human), or \
'rejected' (agent error / not a real problem); and a one-line rationale.";

#[derive(Debug, Deserialize, Serialize, schemars::JsonSchema)]
struct VerifyResult {
    /// confirmed | plausible | rejected
    verdict: String,
    rationale: String,
}

/// Verify one subjective finding. Returns a verdict string clamped to the DB
/// CHECK set; on any model/parse error falls back to `plausible` (don't silently
/// drop a possible defect, but don't claim it's confirmed either).
pub async fn verify(state: &AppState, tenant_id: &Uuid, kind: &str, message: &str, cell: &Value) -> String {
    let prompt = serde_json::json!({
        "reported_kind": kind,
        "reported_finding": message,
        "context": cell,
    })
    .to_string();

    match llm::extract::<VerifyResult>(state, tenant_id, PREAMBLE, &prompt).await {
        Ok(result) => {
            tracing::debug!(verdict = %result.verdict, rationale = %result.rationale, "simulator verifier verdict");
            sanitize_verdict(&result.verdict)
        }
        Err(err) => {
            tracing::debug!(error = %err, "simulator verifier: model call failed, defaulting plausible");
            "plausible".to_owned()
        }
    }
}

fn sanitize_verdict(verdict: &str) -> String {
    match verdict.trim().to_ascii_lowercase().as_str() {
        "confirmed" => "confirmed".to_owned(),
        "rejected" => "rejected".to_owned(),
        _ => "plausible".to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_verdict;

    #[test]
    fn clamps_verdict_to_check_set() {
        assert_eq!(sanitize_verdict("Confirmed"), "confirmed");
        assert_eq!(sanitize_verdict("REJECTED"), "rejected");
        assert_eq!(sanitize_verdict("maybe-ish"), "plausible");
        assert_eq!(sanitize_verdict(""), "plausible");
    }
}
