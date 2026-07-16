use axum::http::{HeaderName, HeaderValue, Request};
use tower_http::request_id::{MakeRequestId, RequestId};

/// Generates a unique request ID (UUID v4) for every incoming request.
/// Used for distributed tracing and log correlation.
#[derive(Debug, Clone, Copy)]
pub struct MakeRequestUuid;

impl MakeRequestId for MakeRequestUuid {
    fn make_request_id<B>(&mut self, _request: &Request<B>) -> Option<RequestId> {
        let id = uuid::Uuid::new_v4().to_string();
        HeaderValue::from_str(&id).ok().map(RequestId::new)
    }
}

/// The header name used for request IDs.
pub const fn request_id_header() -> HeaderName {
    HeaderName::from_static("x-request-id")
}
