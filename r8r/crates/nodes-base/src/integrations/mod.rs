//! Integrations: one vendor per file, each written as data.
//!
//! An integration never implements `NodeExecutor`. It returns a manifest —
//! a credential type plus a node description whose operations carry their
//! routing — and `r8r_core::declarative` executes it. That keeps every
//! integration free of transport code, error handling and retry logic, and
//! means a new vendor is a review of one data file.

pub mod builder;
pub mod generic_auth;
pub mod github;
pub mod medbrains;
pub mod slack;

use r8r_core::declarative::DeclarativeNode;
use r8r_core::{CredentialRegistry, NodeRegistry};
use r8r_workflow::CredentialTypeDescription;
use r8r_workflow::interfaces::NodeTypeDescription;

/// A vendor's node and the credential type it authenticates with.
#[derive(Debug, Clone)]
pub struct Integration {
    pub node: NodeTypeDescription,
    pub credential: CredentialTypeDescription,
}

impl Integration {
    /// Install both halves into the registries.
    pub fn install(self, nodes: &mut NodeRegistry, credentials: &mut CredentialRegistry) {
        nodes.register(DeclarativeNode::new(
            self.node,
            Some(self.credential.clone()),
        ));
        credentials.register(self.credential);
    }
}

/// Every integration that ships in the box.
pub fn all() -> Vec<Integration> {
    vec![
        slack::integration(),
        github::integration(),
        medbrains::integration(),
    ]
}

pub fn register_all(nodes: &mut NodeRegistry, credentials: &mut CredentialRegistry) {
    for integration in all() {
        integration.install(nodes, credentials);
    }
    // Credential types usable by the generic HTTP Request node.
    for credential in generic_auth::all() {
        credentials.register(credential);
    }
}
