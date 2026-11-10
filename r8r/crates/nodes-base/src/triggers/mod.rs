//! Nodes that start a workflow. A trigger never has an input connection; the
//! server hands it the payload that caused the run.

pub mod manual;
pub mod schedule;
pub mod webhook;
