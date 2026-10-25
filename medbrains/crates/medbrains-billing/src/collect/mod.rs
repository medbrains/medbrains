//! Collect anywhere (#4885): a patient's dues by department and bill, and one
//! endpoint that takes their money at any desk — each desk its own lanes, the
//! central cashier all of them. Routes are in the crate's `router()`.

pub mod allocate;
pub mod bills;
pub mod dues;
pub mod lanes;
pub mod open_today;
pub mod post;
pub mod receipts;
pub mod settings;
mod support;
pub mod tender;
