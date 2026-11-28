//! Which side of the hospital a gateway callback is addressed to.
//!
//! The campus is both the HIP and the HIU, but `X-HIP-ID` names the HIP and
//! `X-HIU-ID` the HIU: a callback addressed to one must not drive the other's
//! handlers (#5711).

use axum::http::HeaderMap;

/// A header's trimmed value, when it has one.
pub(super) fn header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_owned)
}

/// Which side of the hospital a callback is addressed to, by its header.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Addressee {
    /// `X-HIP-ID` only: M2 callbacks.
    Hip,
    /// `X-HIU-ID` only: M3 callbacks.
    Hiu,
    /// Either: the cloud relay, which stores any callback for the on-prem server.
    Either,
}

impl Addressee {
    /// The facility id the callback names, from the header this side reads.
    pub(super) fn facility_id(self, headers: &HeaderMap) -> Option<String> {
        match self {
            Self::Hip => header(headers, "x-hip-id"),
            Self::Hiu => header(headers, "x-hiu-id"),
            Self::Either => header(headers, "x-hip-id").or_else(|| header(headers, "x-hiu-id")),
        }
    }
}

#[cfg(test)]
mod tests {
    use axum::http::{HeaderMap, HeaderValue};

    use super::Addressee;

    /// An HIP callback reads only `X-HIP-ID`, an HIU callback only
    /// `X-HIU-ID`: the two headers are not interchangeable (#5711).
    #[test]
    fn each_side_reads_only_its_own_header() {
        let mut hip_only = HeaderMap::new();
        hip_only.insert("x-hip-id", HeaderValue::from_static("IN1410000232"));
        let mut hiu_only = HeaderMap::new();
        hiu_only.insert("x-hiu-id", HeaderValue::from_static("IN1410000232"));
        assert_eq!(
            Addressee::Hip.facility_id(&hip_only).as_deref(),
            Some("IN1410000232")
        );
        assert_eq!(Addressee::Hip.facility_id(&hiu_only), None);
        assert_eq!(
            Addressee::Hiu.facility_id(&hiu_only).as_deref(),
            Some("IN1410000232")
        );
        assert_eq!(Addressee::Hiu.facility_id(&hip_only), None);
        assert!(Addressee::Either.facility_id(&hip_only).is_some());
        assert!(Addressee::Either.facility_id(&hiu_only).is_some());
        assert_eq!(Addressee::Hip.facility_id(&HeaderMap::new()), None);
    }
}
