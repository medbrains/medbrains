//! Security intelligence, phase 1 (RFC-OSINT §3.1, §3.3, §3a): checks that
//! run on a fixed cadence, assume something is wrong and keep proving
//! otherwise.
//!
//! - every run leaves a heartbeat in `security_check_runs`; a check that
//!   stops reporting, or keeps failing, is itself a finding ([`watchers`]);
//! - findings land in the existing `vulnerabilities` table, one row per
//!   (check, asset, key): seen again it updates, resolved and seen again it
//!   re-opens, gone from a successful run it resolves;
//! - a check that cannot run reports an error, never "nothing found".
//!
//! Every database write goes through the kernel's unit of work.

pub mod audit_chain;
pub mod debian;
pub mod dependencies;
pub mod honeytokens;
pub mod model;
pub mod posture;
pub mod routes;
pub mod runner;
pub mod watchers;

pub use model::{CheckError, Found, Report, Severity};
pub use runner::{Check, Ctx, Runner};

/// One check on the screen: what it is called and how often it must run.
#[derive(Debug, Clone, Copy)]
pub struct CheckInfo {
    pub key: &'static str,
    pub label: &'static str,
    pub every_secs: u64,
}

const MINUTE: u64 = 60;
const HOUR: u64 = 60 * MINUTE;
const DAY: u64 = 24 * HOUR;

/// Every check and its cadence (RFC-OSINT §3a). The one list the runner, the
/// watchers and the screen read, so none of them can disagree.
pub const CHECKS: &[CheckInfo] = &[
    CheckInfo {
        key: watchers::KEY,
        label: "Watch the watchers",
        every_secs: MINUTE,
    },
    CheckInfo {
        key: honeytokens::KEY,
        label: "Honeytokens",
        every_secs: 5 * MINUTE,
    },
    CheckInfo {
        key: POSTURE,
        label: "Security posture",
        every_secs: HOUR,
    },
    CheckInfo {
        key: audit_chain::KEY,
        label: "Audit chain (last hour)",
        every_secs: HOUR,
    },
    CheckInfo {
        key: dependencies::KEY,
        label: "Vulnerable dependencies",
        every_secs: DAY,
    },
    CheckInfo {
        key: debian::KEY,
        label: "Operating system packages",
        every_secs: DAY,
    },
];

pub const POSTURE: &str = "posture";

/// Every phase-1 check, for the server to run. `started` is when the runner
/// starts, so the watchers give a never-run check its first interval.
#[must_use]
pub fn all_checks(started: chrono::DateTime<chrono::Utc>) -> Vec<Box<dyn Check>> {
    vec![
        Box::new(watchers::Watchers { since: started }),
        Box::new(honeytokens::Honeytokens),
        Box::new(posture::Posture),
        Box::new(audit_chain::AuditChain),
        Box::new(dependencies::Dependencies),
        Box::new(debian::Debian),
    ]
}

/// The catalogue entry for `key`.
#[must_use]
pub fn info(key: &str) -> Option<&'static CheckInfo> {
    CHECKS.iter().find(|c| c.key == key)
}

/// Whether network lookups (advisory databases) are allowed.
///
/// An explicit `MEDBRAINS_ADVISORY_FETCH=on|off` wins; unset, it
/// is on only for MedBrains-hosted installs (`MEDBRAINS_HOSTED=true`). Nothing
/// leaves an on-premises install unless the hospital turns it on (RFC-OSINT §8).
#[must_use]
pub fn network_lookups_allowed() -> bool {
    match std::env::var("MEDBRAINS_ADVISORY_FETCH").as_deref() {
        Ok("on" | "true") => true,
        Ok(_) => false,
        Err(_) => std::env::var("MEDBRAINS_HOSTED").as_deref() == Ok("true"),
    }
}
