//! Shared cross-domain server services — helpers many domain crates reuse that
//! are heavier than the framework glue in `medbrains-server-core` (e.g. the LLM
//! access layer, and — later — the billing auto-charge helpers).
//!
//! Domain crates depend on this instead of reaching into sibling route modules,
//! keeping the dependency graph acyclic.

pub mod billing;
pub mod llm;
