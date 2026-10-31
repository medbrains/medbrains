//! Instance variables, supplied by whoever runs the engine.
//!
//! `r8r-core` does not know where variables are stored — the standalone server
//! keeps them in `SQLite`, a host embedding the engine may keep them anywhere —
//! so it asks for them through this trait rather than reaching for a database.

use serde_json::{Map, Value};

/// Somewhere to read the instance's variables from.
pub trait Variables: Send + Sync + std::fmt::Debug {
    /// Every variable, as an expression will see them under `vars`.
    ///
    /// Read once per run rather than per node, so that a workflow cannot see a
    /// variable change halfway through and take two different branches on what
    /// is meant to be the same value.
    fn all(&self) -> Map<String, Value>;
}

/// An engine with no variables configured — the default, and the shape of an
/// instance where nobody has needed one yet.
#[derive(Debug, Default)]
pub struct NoVariables;

impl Variables for NoVariables {
    fn all(&self) -> Map<String, Value> {
        Map::new()
    }
}

/// A fixed set, for tests and for a host that knows its variables up front.
#[derive(Debug, Default)]
pub struct StaticVariables(Map<String, Value>);

impl StaticVariables {
    #[must_use]
    pub fn new(values: Map<String, Value>) -> Self {
        StaticVariables(values)
    }
}

impl Variables for StaticVariables {
    fn all(&self) -> Map<String, Value> {
        self.0.clone()
    }
}
