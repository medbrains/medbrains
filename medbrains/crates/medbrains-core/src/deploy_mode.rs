//! Deploy mode — selects the runtime substrate trait-object impls.
//!
//! Read once at server boot from `MEDBRAINS_DEPLOY_MODE`. Decides which
//! `SecretResolver`, `AuditSink`, `ObjectStore`, and `JwtSigner` impls
//! the binary instantiates. Same code path; substrate differs.
//!
//! - `saas` — fully cloud (AWS Secrets Manager, S3 audit, KMS JWT)
//! - `hybrid` — PHI-on-prem + cloud control plane; on-prem nodes use
//!   local-FS sinks but reach cloud for analytics + admin via the
//!   bridge tailnet
//! - `onprem` — fully air-gapped (no cloud calls, sops-encrypted
//!   secrets, local-FS audit/object store, local Ed25519 JWT signer)

use serde::{Deserialize, Serialize};
use std::env;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeployMode {
    Saas,
    Hybrid,
    Onprem,
}

impl DeployMode {
    /// Read from `MEDBRAINS_DEPLOY_MODE`. Defaults to `saas` so existing
    /// deployments keep working without the env var.
    pub fn from_env() -> Self {
        env::var("MEDBRAINS_DEPLOY_MODE")
            .ok()
            .and_then(|s| Self::from_code(&s))
            .unwrap_or(Self::Saas)
    }

    pub fn from_code(s: &str) -> Option<Self> {
        Some(match s.trim().to_ascii_lowercase().as_str() {
            "saas" => Self::Saas,
            "hybrid" => Self::Hybrid,
            "onprem" | "on-prem" | "on_prem" => Self::Onprem,
            _ => return None,
        })
    }

    pub fn as_code(self) -> &'static str {
        match self {
            Self::Saas => "saas",
            Self::Hybrid => "hybrid",
            Self::Onprem => "onprem",
        }
    }

    /// Whether this mode allows reaching cloud-only resources
    /// (Secrets Manager, S3, KMS).
    pub fn cloud_reachable(self) -> bool {
        matches!(self, Self::Saas | Self::Hybrid)
    }

    /// Whether this mode requires the boundary-filter middleware on
    /// the egress path of the outbox worker.
    pub fn requires_boundary_filter(self) -> bool {
        matches!(self, Self::Hybrid)
    }
}

impl fmt::Display for DeployMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_code())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_known_codes() {
        assert_eq!(DeployMode::from_code("saas"), Some(DeployMode::Saas));
        assert_eq!(DeployMode::from_code("Hybrid"), Some(DeployMode::Hybrid));
        assert_eq!(DeployMode::from_code("on-prem"), Some(DeployMode::Onprem));
        assert_eq!(DeployMode::from_code("onprem"), Some(DeployMode::Onprem));
        assert_eq!(DeployMode::from_code("on_prem"), Some(DeployMode::Onprem));
        assert!(DeployMode::from_code("nonsense").is_none());
    }

    #[test]
    fn cloud_reachable() {
        assert!(DeployMode::Saas.cloud_reachable());
        assert!(DeployMode::Hybrid.cloud_reachable());
        assert!(!DeployMode::Onprem.cloud_reachable());
    }

    #[test]
    fn boundary_filter_only_in_hybrid() {
        assert!(!DeployMode::Saas.requires_boundary_filter());
        assert!(DeployMode::Hybrid.requires_boundary_filter());
        assert!(!DeployMode::Onprem.requires_boundary_filter());
    }
}
