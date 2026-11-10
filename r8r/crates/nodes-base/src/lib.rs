//! Every node type that ships in the box. Mirrors `packages/nodes-base`.
//!
//! Adding a node means writing one file here and one line in `register_all` —
//! the editor picks up its palette entry and parameter panel automatically
//! from the `NodeTypeDescription` it returns.

use r8r_core::{CredentialRegistry, NodeRegistry};

pub mod integrations;
pub mod nodes;
pub mod triggers;

/// Install the built-in node types into a registry.
pub fn register_all(registry: &mut NodeRegistry) {
    registry
        // triggers
        .register(triggers::manual::ManualTrigger)
        .register(triggers::webhook::WebhookTrigger)
        .register(triggers::schedule::ScheduleTrigger)
        // transforms
        .register(nodes::set::SetNode)
        .register(nodes::code::CodeNode)
        .register(nodes::split_out::SplitOutNode)
        .register(nodes::map_fields::MapFieldsNode)
        .register(nodes::remember::RememberNode)
        .register(nodes::parse_data::ParseDataNode)
        .register(nodes::convert_data::ConvertDataNode)
        .register(nodes::aggregate::AggregateNode)
        // flow control
        .register(nodes::if_node::IfNode)
        .register(nodes::filter::FilterNode)
        .register(nodes::merge::MergeNode)
        .register(nodes::execute_workflow::ExecuteWorkflowNode)
        .register(nodes::wait::WaitNode)
        .register(nodes::no_op::NoOpNode)
        // i/o
        .register(nodes::http_request::HttpRequestNode);
}

/// Everything the build ships: node types and credential types.
#[derive(Debug, Default, Clone)]
pub struct Catalog {
    pub nodes: NodeRegistry,
    pub credentials: CredentialRegistry,
}

/// Core nodes plus every declarative integration.
#[must_use]
pub fn catalog() -> Catalog {
    let mut catalog = Catalog::default();
    register_all(&mut catalog.nodes);
    integrations::register_all(&mut catalog.nodes, &mut catalog.credentials);
    catalog
}

/// A registry with every built-in node already installed.
#[must_use]
pub fn registry() -> NodeRegistry {
    catalog().nodes
}
