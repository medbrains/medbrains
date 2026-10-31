//! The node registry: node type name -> implementation.
//! Mirrors `nodes-loader` in n8n core, minus the dynamic package loading.

use crate::errors::Result;
use crate::execute_context::ExecuteContext;
use crate::suspension::NodeOutcome;
use async_trait::async_trait;
use r8r_workflow::NodeTypeDescription;
use std::collections::HashMap;
use std::sync::Arc;

/// One node type. Implementations live in `r8r-nodes-base`.
#[async_trait]
pub trait NodeExecutor: Send + Sync {
    /// Palette entry and parameter schema. The editor renders its whole
    /// parameter panel from this, so a new node needs no frontend changes.
    fn description(&self) -> NodeTypeDescription;

    /// Run the node.
    ///
    /// Most nodes produce data, and `main_output(items).into()` is the whole
    /// of it. A node that cannot finish inside this run — one waiting for a
    /// person, or for a date — returns a suspension instead, and the engine
    /// records where it stopped so a later resume can carry on.
    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome>;
}

#[derive(Default, Clone)]
pub struct NodeRegistry {
    types: HashMap<String, Arc<dyn NodeExecutor>>,
}

impl std::fmt::Debug for NodeRegistry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut names: Vec<&str> = self.types.keys().map(String::as_str).collect();
        names.sort_unstable();
        f.debug_struct("NodeRegistry")
            .field("types", &names)
            .finish()
    }
}

impl NodeRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, node: impl NodeExecutor + 'static) -> &mut Self {
        let node = Arc::new(node);
        self.types.insert(node.description().name, node);
        self
    }

    pub fn get(&self, kind: &str) -> Option<Arc<dyn NodeExecutor>> {
        self.types.get(kind).cloned()
    }

    pub fn is_trigger(&self, kind: &str) -> bool {
        self.types
            .get(kind)
            .is_some_and(|n| n.description().is_trigger())
    }

    /// Palette contents, sorted so the editor list is stable between reloads.
    pub fn descriptions(&self) -> Vec<NodeTypeDescription> {
        let mut all: Vec<_> = self.types.values().map(|n| n.description()).collect();
        all.sort_by(|a, b| a.display_name.cmp(&b.display_name));
        all
    }

    pub fn len(&self) -> usize {
        self.types.len()
    }
    pub fn is_empty(&self) -> bool {
        self.types.is_empty()
    }
}
