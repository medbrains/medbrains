//! Where the automation engine runs.
//!
//! Some hospitals want one process to deploy and monitor; others keep
//! automation off the clinical server entirely, so a workflow that misbehaves
//! cannot compete with patient registration for CPU. Both are reasonable, so
//! the choice is configuration rather than a fork.
//!
//! The engine, the nodes, the store and the HTTP surface are identical either
//! way. Only the wiring differs, which is what keeps the two modes from
//! drifting apart.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Deployment {
    /// Mounted inside the `MedBrains` server under `/api/automation`.
    ///
    /// Shares the process, the connection pool and the auth middleware, so a
    /// request arrives already authenticated and tenant-scoped, and a node can
    /// reach clinical data in-process without a network hop or a second token.
    #[default]
    Embedded,

    /// Its own service, on its own host.
    ///
    /// Isolates automation's CPU, memory and connection use from the clinical
    /// server completely. It validates the same tokens and reaches `MedBrains`
    /// over its FHIR API like any other client, which means a node cannot see
    /// anything the API would not serve.
    Standalone,
}

impl Deployment {
    /// Read the choice from configuration, defaulting to embedded because that
    /// is the deployment with nothing extra to run.
    #[must_use]
    pub fn from_env(value: Option<&str>) -> Self {
        match value.map(str::trim).map(str::to_ascii_lowercase).as_deref() {
            Some("standalone" | "separate" | "external") => Deployment::Standalone,
            _ => Deployment::Embedded,
        }
    }

    /// Can a node read clinical data directly, or must it go through the API?
    ///
    /// This is the one behavioural difference between the modes, and it is a
    /// consequence of where the process is rather than a policy: a separate
    /// host has no connection to the clinical database and should not be given
    /// one.
    #[must_use]
    pub fn allows_in_process_access(&self) -> bool {
        matches!(self, Deployment::Embedded)
    }

    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Deployment::Embedded => "embedded",
            Deployment::Standalone => "standalone",
        }
    }
}

#[cfg(test)]
mod tests {
    // Tests may state what must hold and stop if it does not; that is what a
    // test is. The denials exist for code the hospital runs.
    #![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic, clippy::indexing_slicing)]

    use super::*;

    #[test]
    fn the_default_is_the_deployment_with_nothing_extra_to_run() {
        assert_eq!(Deployment::default(), Deployment::Embedded);
        assert_eq!(Deployment::from_env(None), Deployment::Embedded);
    }

    #[test]
    fn a_separate_server_can_be_asked_for_by_several_names() {
        for value in ["standalone", "separate", "external", "STANDALONE", " standalone "] {
            assert_eq!(Deployment::from_env(Some(value)), Deployment::Standalone, "{value}");
        }
    }

    #[test]
    fn an_unrecognised_setting_stays_embedded_rather_than_failing_to_boot() {
        assert_eq!(Deployment::from_env(Some("yes please")), Deployment::Embedded);
        assert_eq!(Deployment::from_env(Some("")), Deployment::Embedded);
    }

    #[test]
    fn only_the_embedded_deployment_reaches_clinical_data_in_process() {
        // A separate host has no clinical database connection, and should not
        // be handed one to make a node faster.
        assert!(Deployment::Embedded.allows_in_process_access());
        assert!(!Deployment::Standalone.allows_in_process_access());
    }
}
