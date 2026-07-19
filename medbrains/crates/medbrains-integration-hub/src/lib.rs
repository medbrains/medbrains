//! `MedBrains` Integration Hub
//!
//! One facade the rest of the code calls. Based on per-tenant setup it auto-picks
//! the provider(s) behind a capability, supports running **two providers at once**
//! (primary+fallback, fan-out, or read/write split), and — via `medbrains-adapter-sdk`
//! field mapping — normalizes each provider's different wire format to one neutral
//! shape. See `RFCs/RFC-INTEGRATION-WRAPPER.md`.
//!
//! P1 (this crate) is the **routing resolver**: the pure, tested logic that turns a
//! tenant's routing setup + an operation kind into the ordered set of providers to
//! call and how to combine them. The async `Connector` trait, `IntegrationHub`
//! facade, and adapter-sdk normalization wiring land in P2 alongside the first real
//! adapter (Frappe HR / Darwinbox).

use serde::{Deserialize, Serialize};

/// Stable code identifying a provider adapter (e.g. `frappe_hr`, `darwinbox`, `razorpay`).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ProviderCode(pub String);

impl ProviderCode {
    #[must_use]
    pub fn new(code: impl Into<String>) -> Self {
        Self(code.into())
    }

    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Whether a caller's operation reads from or writes to the external system. Drives
/// `read_write_split` and lets fan-out apply only where mirroring makes sense.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OpKind {
    Read,
    Write,
}

/// How the hub combines providers for one capability on one tenant — the
/// "dual providers / dual integrations" behaviour.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoutingMode {
    /// One provider only.
    Single,
    /// Try `primary`; on failure fall back to `secondary` (in order).
    PrimaryFallback,
    /// Send to both providers (e.g. mirror a write to two systems).
    FanOut,
    /// Reads go to `read`, writes go to `write`.
    ReadWriteSplit,
}

/// Per-tenant, per-capability routing setup, resolved from `tenant_settings`
/// (`integration.<domain>.<capability>`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RoutingConfig {
    pub mode: RoutingMode,
    /// Primary provider for `single` / `primary_fallback` / `fan_out`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary: Option<ProviderCode>,
    /// Secondary/mirror provider — the "dual" provider.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secondary: Option<ProviderCode>,
    /// Read side for `read_write_split`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub read: Option<ProviderCode>,
    /// Write side for `read_write_split`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub write: Option<ProviderCode>,
}

/// How the caller must combine the resolved providers' results.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Combine {
    /// Exactly one provider handles it (`Single`, `ReadWriteSplit`).
    One,
    /// Try providers in order; first success wins (`PrimaryFallback`).
    Sequential,
    /// Invoke all providers (`FanOut`); aggregate per capability policy.
    All,
}

/// The resolved plan: which providers to call, in order, and how to combine them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedRoute {
    pub providers: Vec<ProviderCode>,
    pub combine: Combine,
}

/// Why a routing setup could not produce a plan. A misconfigured tenant is a config
/// error surfaced to admins, never a panic.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum RoutingError {
    #[error("routing mode {mode:?} requires a `{field}` provider but none is set")]
    MissingProvider {
        mode: RoutingMode,
        field: &'static str,
    },
}

/// The heart of the wrapper: turn a tenant's routing setup + the operation kind into
/// the ordered provider plan. Pure and total — every branch resolves or returns a
/// typed config error.
///
/// # Errors
/// Returns [`RoutingError::MissingProvider`] when the mode needs a provider slot that
/// the config left empty.
pub fn resolve_route(cfg: &RoutingConfig, op: OpKind) -> Result<ResolvedRoute, RoutingError> {
    match cfg.mode {
        RoutingMode::Single => {
            let p = require(cfg.primary.as_ref(), RoutingMode::Single, "primary")?;
            Ok(ResolvedRoute {
                providers: vec![p],
                combine: Combine::One,
            })
        }
        RoutingMode::PrimaryFallback => {
            let primary = require(cfg.primary.as_ref(), RoutingMode::PrimaryFallback, "primary")?;
            let secondary = require(
                cfg.secondary.as_ref(),
                RoutingMode::PrimaryFallback,
                "secondary",
            )?;
            Ok(ResolvedRoute {
                providers: vec![primary, secondary],
                combine: Combine::Sequential,
            })
        }
        RoutingMode::FanOut => {
            let primary = require(cfg.primary.as_ref(), RoutingMode::FanOut, "primary")?;
            let secondary = require(cfg.secondary.as_ref(), RoutingMode::FanOut, "secondary")?;
            Ok(ResolvedRoute {
                providers: vec![primary, secondary],
                combine: Combine::All,
            })
        }
        RoutingMode::ReadWriteSplit => {
            let slot = match op {
                OpKind::Read => cfg.read.as_ref(),
                OpKind::Write => cfg.write.as_ref(),
            };
            let field = match op {
                OpKind::Read => "read",
                OpKind::Write => "write",
            };
            let p = require(slot, RoutingMode::ReadWriteSplit, field)?;
            Ok(ResolvedRoute {
                providers: vec![p],
                combine: Combine::One,
            })
        }
    }
}

fn require(
    slot: Option<&ProviderCode>,
    mode: RoutingMode,
    field: &'static str,
) -> Result<ProviderCode, RoutingError> {
    slot.cloned()
        .ok_or(RoutingError::MissingProvider { mode, field })
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{
        Combine, OpKind, ProviderCode, RoutingConfig, RoutingError, RoutingMode, resolve_route,
    };

    fn cfg(mode: RoutingMode) -> RoutingConfig {
        RoutingConfig {
            mode,
            primary: None,
            secondary: None,
            read: None,
            write: None,
        }
    }

    fn code(s: &str) -> ProviderCode {
        ProviderCode::new(s)
    }

    #[test]
    fn single_picks_primary() {
        let c = RoutingConfig {
            primary: Some(code("frappe_hr")),
            ..cfg(RoutingMode::Single)
        };
        let r = resolve_route(&c, OpKind::Read).expect("resolves");
        assert_eq!(r.providers, vec![code("frappe_hr")]);
        assert_eq!(r.combine, Combine::One);
    }

    #[test]
    fn primary_fallback_orders_primary_then_secondary() {
        let c = RoutingConfig {
            primary: Some(code("darwinbox")),
            secondary: Some(code("frappe_hr")),
            ..cfg(RoutingMode::PrimaryFallback)
        };
        let r = resolve_route(&c, OpKind::Write).expect("resolves");
        assert_eq!(r.providers, vec![code("darwinbox"), code("frappe_hr")]);
        assert_eq!(r.combine, Combine::Sequential);
    }

    #[test]
    fn fan_out_hits_both() {
        let c = RoutingConfig {
            primary: Some(code("darwinbox")),
            secondary: Some(code("frappe_hr")),
            ..cfg(RoutingMode::FanOut)
        };
        let r = resolve_route(&c, OpKind::Write).expect("resolves");
        assert_eq!(r.providers.len(), 2);
        assert_eq!(r.combine, Combine::All);
    }

    #[test]
    fn read_write_split_routes_by_op() {
        let c = RoutingConfig {
            read: Some(code("darwinbox")),
            write: Some(code("frappe_hr")),
            ..cfg(RoutingMode::ReadWriteSplit)
        };
        let read = resolve_route(&c, OpKind::Read).expect("resolves");
        assert_eq!(read.providers, vec![code("darwinbox")]);
        let write = resolve_route(&c, OpKind::Write).expect("resolves");
        assert_eq!(write.providers, vec![code("frappe_hr")]);
    }

    #[test]
    fn missing_provider_is_a_typed_config_error() {
        let err = resolve_route(&cfg(RoutingMode::Single), OpKind::Read).expect_err("should fail");
        assert_eq!(
            err,
            RoutingError::MissingProvider {
                mode: RoutingMode::Single,
                field: "primary",
            }
        );
    }

    #[test]
    fn read_write_split_missing_write_side_errors_only_on_write() {
        let c = RoutingConfig {
            read: Some(code("darwinbox")),
            ..cfg(RoutingMode::ReadWriteSplit)
        };
        assert!(resolve_route(&c, OpKind::Read).is_ok());
        assert!(resolve_route(&c, OpKind::Write).is_err());
    }
}
