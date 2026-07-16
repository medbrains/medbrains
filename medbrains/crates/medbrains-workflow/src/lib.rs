//! Workflow engine: clinical/domain event queue + orchestration pipelines
//! (scheduler, jobs, connectors, Lua code executor). events <-> orchestration are
//! mutually dependent so they live together. Re-exported by medbrains-server.

pub mod events;
pub mod orchestration;
