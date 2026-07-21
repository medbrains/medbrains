//! Native function-calling decision for the simulator agent.
//!
//! Instead of one free-form `extract` (where weak models like gpt-oss return no
//! tool call at all → "No data extracted"), present each endpoint as a real
//! chat-completions **function tool** with its typed argument schema (from
//! `tool_shapes.json`). The model does concrete function-calling — reliable, and
//! it can only fill contract fields. Requires an OpenAI-compatible provider
//! (bedrock / openrouter); anthropic-native returns a clear error.

use serde_json::{Value, json};
use uuid::Uuid;

use medbrains_server_core::state::AppState;
use medbrains_server_services::llm;

use super::agent_tools::ToolDef;
use crate::error::AppError;

/// The model's chosen call: a tool name + its (parsed) argument object.
#[derive(Debug)]
pub struct ToolCall {
    pub name: String,
    pub arguments: Value,
}

/// Ask the model to pick ONE tool and fill its typed arguments. `None` means the
/// model returned no tool call (treated as "give up" by the caller).
pub async fn choose_action(
    state: &AppState,
    tenant_id: &Uuid,
    system: &str,
    user: &str,
    tools: &[ToolDef],
) -> Result<Option<ToolCall>, AppError> {
    let cfg = llm::resolve_config(state, tenant_id).await?;
    let base = llm::openai_compat_base_url(&cfg.provider).ok_or_else(|| {
        AppError::BadRequest(format!(
            "simulator native tool-calling needs an OpenAI-compatible provider \
             (bedrock/openrouter); '{}' is not supported",
            cfg.provider
        ))
    })?;
    let url = format!("{base}/chat/completions");

    let tool_json: Vec<Value> = tools
        .iter()
        .map(|t| {
            json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                }
            })
        })
        .collect();

    let body = json!({
        "model": cfg.model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user },
        ],
        "tools": tool_json,
        "tool_choice": "required",
        "max_tokens": 900,
    });

    let resp = reqwest::Client::new()
        .post(&url)
        .bearer_auth(&cfg.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::BadRequest(format!("AI request failed: {e}")))?;
    let status = resp.status();
    let payload: Value = resp
        .json()
        .await
        .map_err(|e| AppError::BadRequest(format!("AI response parse failed: {e}")))?;
    if !status.is_success() {
        let msg = payload
            .get("message")
            .or_else(|| payload.pointer("/error/message"))
            .and_then(Value::as_str)
            .unwrap_or("unknown error");
        return Err(AppError::BadRequest(format!("AI call failed ({status}): {msg}")));
    }

    let Some(tc) = payload.pointer("/choices/0/message/tool_calls/0") else {
        return Ok(None);
    };
    let name = tc
        .pointer("/function/name")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();
    if name.is_empty() {
        return Ok(None);
    }
    // OpenAI-style: arguments is a JSON string. Tolerate an already-parsed object.
    let arguments = match tc.pointer("/function/arguments") {
        Some(Value::String(s)) => serde_json::from_str(s).unwrap_or_else(|_| json!({})),
        Some(other) => other.clone(),
        None => json!({}),
    };
    Ok(Some(ToolCall { name, arguments }))
}

/// Ask the model for a few realistic, role-appropriate test goals, given the
/// role and the tool catalog it may use.
///
/// A plain completion (no tools) — robust on weak models — returning a parsed
/// line-list. Errors bubble up so the caller can fall back to a static set.
pub async fn generate_goals(
    state: &AppState,
    tenant_id: &Uuid,
    role: &str,
    tool_catalog: &str,
) -> Result<Vec<String>, AppError> {
    let system = "You design end-to-end test goals for a hospital management system. A goal is \
                  one concrete task a real staff member of the given role would accomplish using \
                  ONLY the listed tools, within their own permissions. One sentence each.";
    let user = format!(
        "Role: {role}.\nAvailable tools:\n{tool_catalog}\n\n\
         List 3 realistic, varied goals this role would pursue using only these tools. \
         One goal per line. No numbering, no preamble."
    );
    let text = complete_text(state, tenant_id, system, &user).await?;
    // gpt-oss may prefix a <reasoning>…</reasoning> block; keep what follows.
    let cleaned = text
        .rfind("</reasoning>")
        .map_or(text.as_str(), |i| &text[i + "</reasoning>".len()..]);
    let goals: Vec<String> = cleaned
        .lines()
        .map(|l| l.trim().trim_start_matches(['-', '*', '•', '·', ' ']).trim().to_owned())
        .filter(|l| l.len() >= 12)
        .take(3)
        .collect();
    Ok(goals)
}

/// A plain chat completion (no tools) returning the assistant's text.
async fn complete_text(
    state: &AppState,
    tenant_id: &Uuid,
    system: &str,
    user: &str,
) -> Result<String, AppError> {
    let cfg = llm::resolve_config(state, tenant_id).await?;
    let base = llm::openai_compat_base_url(&cfg.provider).ok_or_else(|| {
        AppError::BadRequest(format!(
            "simulator goal generation needs an OpenAI-compatible provider; '{}' is not",
            cfg.provider
        ))
    })?;
    let url = format!("{base}/chat/completions");
    let body = json!({
        "model": cfg.model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user },
        ],
        "max_tokens": 400,
    });
    let resp = reqwest::Client::new()
        .post(&url)
        .bearer_auth(&cfg.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::BadRequest(format!("AI request failed: {e}")))?;
    let status = resp.status();
    let payload: Value = resp
        .json()
        .await
        .map_err(|e| AppError::BadRequest(format!("AI response parse failed: {e}")))?;
    if !status.is_success() {
        let msg = payload
            .get("message")
            .or_else(|| payload.pointer("/error/message"))
            .and_then(Value::as_str)
            .unwrap_or("unknown error");
        return Err(AppError::BadRequest(format!("AI call failed ({status}): {msg}")));
    }
    Ok(payload
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned())
}
