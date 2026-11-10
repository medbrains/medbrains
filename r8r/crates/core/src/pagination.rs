//! Fetching a list that arrives a page at a time.
//!
//! Without this a workflow sees the first hundred records and believes that is
//! all of them — which is worse than failing, because nothing looks wrong. Every
//! API paginates differently, so what varies is only *where the next page is
//! named*: a cursor in the body, an offset to advance, a `Link` header.
//!
//! Deciding that is a pure function of the response, which is why it lives here
//! rather than inside the node: the awkward part is testable without a server.

use r8r_workflow::node_helpers::get_path;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// How many pages will be fetched before r8r stops.
///
/// A vendor whose "next" link always points somewhere would otherwise be an
/// infinite loop that looks like a slow workflow.
pub const MAX_PAGES: usize = 200;

/// How an API says there is more.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum Pagination {
    /// One request; whatever came back is all of it.
    #[default]
    None,

    /// The response carries a token for the next page.
    Cursor {
        /// Dot path to the token, e.g. `meta.next_cursor`.
        path: String,
        /// Query parameter to send it back as.
        param: String,
    },

    /// Advance a numeric offset until a page comes back short.
    Offset {
        offset_param: String,
        limit_param: String,
        page_size: usize,
    },

    /// Ask for page 1, 2, 3 … until one comes back short.
    Page {
        page_param: String,
        size_param: String,
        page_size: usize,
        /// Some APIs count from 0, most from 1.
        start: usize,
    },

    /// Follow `Link: <…>; rel="next"`, as GitHub and others do.
    Link,
}

/// What to send to get the next page.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NextPage {
    /// Add or replace these query parameters on the same URL.
    Query(Vec<(String, String)>),
    /// Request this URL instead.
    Url(String),
}

/// Where the last request was in the sequence.
#[derive(Debug, Clone, Copy, Default)]
pub struct Position {
    /// Pages already fetched.
    pub pages: usize,
    /// Records already collected, for offset-based APIs.
    pub collected: usize,
}

/// Work out how to ask for the next page, or that there is not one.
///
/// `body` is the parsed response and `link_header` its `Link` header. Both are
/// passed rather than a response type so this stays free of the HTTP client.
#[must_use]
pub fn next_page(
    pagination: &Pagination,
    body: &Value,
    link_header: Option<&str>,
    page_items: usize,
    at: Position,
) -> Option<NextPage> {
    if at.pages >= MAX_PAGES {
        return None;
    }

    match pagination {
        Pagination::None => None,

        Pagination::Cursor { path, param } => {
            let token = get_path(body, path)?;
            let token = match token {
                Value::String(text) if !text.is_empty() => text.clone(),
                Value::Number(number) => number.to_string(),
                // Null, empty string or absent all mean the same thing: the
                // last page has been reached.
                _ => return None,
            };
            Some(NextPage::Query(vec![(param.clone(), token)]))
        }

        Pagination::Offset {
            offset_param,
            limit_param,
            page_size,
        } => {
            // A short page is the end. Asking again would either repeat the
            // last records or return nothing forever.
            if page_items < *page_size || page_items == 0 {
                return None;
            }
            Some(NextPage::Query(vec![
                (offset_param.clone(), at.collected.to_string()),
                (limit_param.clone(), page_size.to_string()),
            ]))
        }

        Pagination::Page {
            page_param,
            size_param,
            page_size,
            start,
        } => {
            if page_items < *page_size || page_items == 0 {
                return None;
            }
            let next = start.saturating_add(at.pages);
            Some(NextPage::Query(vec![
                (page_param.clone(), next.to_string()),
                (size_param.clone(), page_size.to_string()),
            ]))
        }

        Pagination::Link => next_link(link_header?).map(NextPage::Url),
    }
}

/// The `next` URL from an RFC 5988 `Link` header.
///
/// Parsed rather than pattern-matched because the header carries several
/// relations and their order is not promised — taking the first URL would
/// follow `prev` about as often as `next`.
#[must_use]
pub fn next_link(header: &str) -> Option<String> {
    for entry in header.split(',') {
        let mut parts = entry.split(';');

        let Some(url) = parts.next() else { continue };
        let url = url.trim();
        let Some(url) = url
            .strip_prefix('<')
            .and_then(|rest| rest.strip_suffix('>'))
        else {
            continue;
        };

        let is_next = parts.any(|parameter| {
            let parameter = parameter.trim().to_ascii_lowercase();
            parameter == "rel=\"next\"" || parameter == "rel=next"
        });

        if is_next {
            return Some(url.to_owned());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn at(pages: usize, collected: usize) -> Position {
        Position { pages, collected }
    }

    // ================================================================ cursor

    #[test]
    fn a_cursor_is_sent_back_as_the_named_parameter() {
        let pagination = Pagination::Cursor {
            path: "meta.next_cursor".into(),
            param: "cursor".into(),
        };
        let body = json!({ "meta": { "next_cursor": "abc123" } });

        let next = next_page(&pagination, &body, None, 100, at(1, 100));

        assert_eq!(
            next,
            Some(NextPage::Query(vec![("cursor".into(), "abc123".into())]))
        );
    }

    #[test]
    fn an_absent_empty_or_null_cursor_all_mean_the_end() {
        let pagination = Pagination::Cursor {
            path: "next".into(),
            param: "cursor".into(),
        };

        for body in [json!({}), json!({ "next": "" }), json!({ "next": null })] {
            assert_eq!(
                next_page(&pagination, &body, None, 100, at(1, 100)),
                None,
                "{body}"
            );
        }
    }

    #[test]
    fn a_numeric_cursor_is_sent_as_text() {
        let pagination = Pagination::Cursor {
            path: "next".into(),
            param: "since_id".into(),
        };
        let next = next_page(
            &pagination,
            &json!({ "next": 90210 }),
            None,
            100,
            at(1, 100),
        );

        assert_eq!(
            next,
            Some(NextPage::Query(vec![("since_id".into(), "90210".into())]))
        );
    }

    // ================================================================ offset

    #[test]
    fn an_offset_advances_by_what_has_been_collected() {
        let pagination = Pagination::Offset {
            offset_param: "offset".into(),
            limit_param: "limit".into(),
            page_size: 100,
        };

        let next = next_page(&pagination, &json!({}), None, 100, at(1, 100));

        assert_eq!(
            next,
            Some(NextPage::Query(vec![
                ("offset".into(), "100".into()),
                ("limit".into(), "100".into()),
            ]))
        );
    }

    #[test]
    fn a_short_page_is_the_last_one() {
        // Asking again would either repeat records or loop on an empty answer.
        let pagination = Pagination::Offset {
            offset_param: "offset".into(),
            limit_param: "limit".into(),
            page_size: 100,
        };

        assert_eq!(
            next_page(&pagination, &json!({}), None, 42, at(1, 42)),
            None
        );
        assert_eq!(next_page(&pagination, &json!({}), None, 0, at(1, 0)), None);
    }

    // ================================================================== page

    #[test]
    fn page_numbers_advance_from_wherever_the_api_starts_counting() {
        let from_one = Pagination::Page {
            page_param: "page".into(),
            size_param: "per_page".into(),
            page_size: 50,
            start: 1,
        };
        let next = next_page(&from_one, &json!({}), None, 50, at(1, 50));
        assert_eq!(
            next,
            Some(NextPage::Query(vec![
                ("page".into(), "2".into()),
                ("per_page".into(), "50".into()),
            ]))
        );

        let from_zero = Pagination::Page {
            page_param: "page".into(),
            size_param: "per_page".into(),
            page_size: 50,
            start: 0,
        };
        let next = next_page(&from_zero, &json!({}), None, 50, at(1, 50));
        assert_eq!(
            next,
            Some(NextPage::Query(vec![
                ("page".into(), "1".into()),
                ("per_page".into(), "50".into()),
            ]))
        );
    }

    // ================================================================== link

    #[test]
    fn the_next_link_is_taken_and_the_others_left() {
        // The relations are not in a promised order, so taking the first URL
        // would follow `prev` about as often as `next`.
        let header = r#"<https://api.example.com/x?page=1>; rel="prev", \
                        <https://api.example.com/x?page=3>; rel="next", \
                        <https://api.example.com/x?page=9>; rel="last""#
            .replace(" \\\n                        ", "");

        assert_eq!(
            next_link(&header).as_deref(),
            Some("https://api.example.com/x?page=3")
        );
    }

    #[test]
    fn a_link_header_without_a_next_relation_is_the_end() {
        let header = r#"<https://api.example.com/x?page=1>; rel="first""#;
        assert_eq!(next_link(header), None);
        assert_eq!(next_link(""), None);
    }

    #[test]
    fn an_unquoted_relation_is_understood() {
        assert_eq!(
            next_link("<https://api.example.com/x?page=2>; rel=next").as_deref(),
            Some("https://api.example.com/x?page=2")
        );
    }

    #[test]
    fn link_pagination_stops_when_the_header_is_missing() {
        assert_eq!(
            next_page(&Pagination::Link, &json!({}), None, 100, at(1, 100)),
            None
        );
    }

    // ================================================================= limits

    #[test]
    fn nothing_is_followed_past_the_page_ceiling() {
        // A vendor whose next link always points somewhere would otherwise be
        // an infinite loop that looks like a slow workflow.
        let pagination = Pagination::Cursor {
            path: "next".into(),
            param: "cursor".into(),
        };
        let body = json!({ "next": "always-more" });

        assert!(next_page(&pagination, &body, None, 100, at(MAX_PAGES - 1, 0)).is_some());
        assert!(next_page(&pagination, &body, None, 100, at(MAX_PAGES, 0)).is_none());
    }

    #[test]
    fn the_default_is_one_request() {
        assert_eq!(Pagination::default(), Pagination::None);
        assert_eq!(
            next_page(
                &Pagination::None,
                &json!({ "next": "x" }),
                None,
                100,
                at(1, 0)
            ),
            None
        );
    }

    #[test]
    fn a_pagination_setting_survives_the_json_it_is_stored_as() {
        let pagination = Pagination::Cursor {
            path: "meta.next".into(),
            param: "cursor".into(),
        };
        let encoded = serde_json::to_string(&pagination).expect("serialises");
        let decoded: Pagination = serde_json::from_str(&encoded).expect("deserialises");
        assert_eq!(decoded, pagination);
    }
}
