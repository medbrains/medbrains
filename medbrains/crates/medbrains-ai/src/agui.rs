//! The assistant's stream as AG-UI events (docs.ag-ui.com/concepts/events):
//! a `SCREAMING_SNAKE` `type`, `camelCase` fields, one JSON object per SSE frame.
//!
//! What AG-UI has no event for travels as `CUSTOM` with a `medbrains.*` name:
//! the guard's notice (always before `RUN_FINISHED` — said, never silent), a
//! retry's reset, a widget, a cited source. No `MESSAGES_SNAPSHOT`: the server
//! owns history.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use serde::Serialize;
use serde_json::Value;

/// One AG-UI event.
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub(super) enum Agui<'a> {
    #[serde(rename_all = "camelCase")]
    RunStarted {
        thread_id: String,
        run_id: String,
    },
    #[serde(rename_all = "camelCase")]
    TextMessageStart {
        message_id: &'a str,
        role: &'static str,
    },
    #[serde(rename_all = "camelCase")]
    TextMessageContent {
        message_id: &'a str,
        delta: &'a str,
    },
    #[serde(rename_all = "camelCase")]
    TextMessageEnd {
        message_id: &'a str,
    },
    #[serde(rename_all = "camelCase")]
    ToolCallStart {
        tool_call_id: String,
        tool_call_name: String,
        parent_message_id: &'a str,
    },
    #[serde(rename_all = "camelCase")]
    ToolCallArgs {
        tool_call_id: String,
        delta: String,
    },
    #[serde(rename_all = "camelCase")]
    ToolCallEnd {
        tool_call_id: String,
    },
    #[serde(rename_all = "camelCase")]
    ToolCallResult {
        message_id: &'a str,
        tool_call_id: String,
        /// The tool's output read back for the user, as a JSON string.
        content: String,
    },
    Custom {
        name: &'static str,
        value: Value,
    },
    RunError {
        message: &'static str,
    },
    #[serde(rename_all = "camelCase")]
    RunFinished {
        thread_id: String,
        run_id: String,
        result: Value,
    },
}

/// The `CUSTOM` names this stream uses.
pub(super) const CUSTOM_GUARD: &str = "medbrains.guard";
pub(super) const CUSTOM_RESET: &str = "medbrains.reset";
pub(super) const CUSTOM_WIDGET: &str = "medbrains.widget";
pub(super) const CUSTOM_SOURCE: &str = "medbrains.source";

#[cfg(test)]
mod tests {
    use super::{Agui, CUSTOM_GUARD};
    use serde_json::json;

    #[test]
    fn events_use_ag_ui_names_and_camel_case_fields() {
        let start = json!(Agui::RunStarted {
            thread_id: "t".into(),
            run_id: "r".into()
        });
        assert_eq!(
            start,
            json!({"type": "RUN_STARTED", "threadId": "t", "runId": "r"})
        );
        let text = json!(Agui::TextMessageContent {
            message_id: "m",
            delta: "Hb 8.2."
        });
        assert_eq!(
            text,
            json!({"type": "TEXT_MESSAGE_CONTENT", "messageId": "m", "delta": "Hb 8.2."})
        );
        let guard = json!(Agui::Custom {
            name: CUSTOM_GUARD,
            value: json!({"notices": ["x"]})
        });
        assert_eq!(guard["type"], "CUSTOM");
        assert_eq!(guard["name"], "medbrains.guard");
        let end = json!(Agui::ToolCallEnd {
            tool_call_id: "c".into()
        });
        assert_eq!(end, json!({"type": "TOOL_CALL_END", "toolCallId": "c"}));
    }
}
