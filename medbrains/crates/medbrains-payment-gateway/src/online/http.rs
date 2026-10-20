//! One way to call a provider and read its answer: a definite answer, a
//! definite no, or "unknown" — never a guess between them.

use std::sync::LazyLock;
use std::time::Duration;

use serde_json::Value;

use super::ProviderError;

/// Inferred, not from any provider: long enough for a slow gateway, short
/// enough that a cashier is not left watching a spinner.
const CALL_TIMEOUT: Duration = Duration::from_secs(15);

static HTTP: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(CALL_TIMEOUT)
        .build()
        .unwrap_or_default()
});

pub(crate) fn client() -> &'static reqwest::Client {
    &HTTP
}

/// The provider's reason, wherever it puts it.
fn reason(answer: &Value) -> Option<String> {
    [
        &answer["error"]["description"],
        &answer["message"],
        &answer["msg"],
        &answer["error_description"],
    ]
    .into_iter()
    .find_map(|v| v.as_str().filter(|s| !s.is_empty()))
    .map(ToOwned::to_owned)
}

/// Send a request to `who` and read its JSON answer. No answer, a 429 or a
/// 5xx is [`ProviderError::Unavailable`]: whether it acted is unknown.
pub(crate) async fn send(
    request: reqwest::RequestBuilder,
    who: &str,
) -> Result<Value, ProviderError> {
    let response = request
        .send()
        .await
        .map_err(|e| ProviderError::Unavailable(format!("{who} did not answer: {e}")))?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    let answer: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    let why = reason(&answer).unwrap_or_else(|| {
        let short: String = text.chars().take(200).collect();
        if short.is_empty() {
            status.to_string()
        } else {
            short
        }
    });
    if status.as_u16() == 429 || status.is_server_error() {
        return Err(ProviderError::Unavailable(format!(
            "{who} is unavailable: {why}"
        )));
    }
    if !status.is_success() {
        return Err(ProviderError::Refused(why));
    }
    Ok(answer)
}

#[cfg(test)]
mod tests {
    use super::reason;
    use serde_json::json;

    #[test]
    fn each_providers_reason_is_found() {
        let razorpay = json!({ "error": { "description": "bad key" } });
        assert_eq!(reason(&razorpay).as_deref(), Some("bad key"));
        assert_eq!(
            reason(&json!({ "message": "order exists" })).as_deref(),
            Some("order exists")
        );
        assert_eq!(
            reason(&json!({ "msg": "Invalid Hash" })).as_deref(),
            Some("Invalid Hash")
        );
        assert_eq!(reason(&json!({})), None);
    }
}
