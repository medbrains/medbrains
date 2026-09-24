//! Bedside decisions in plain functions, once, for every device.
//!
//! These mirror rules the server already enforces. The device copy exists so
//! a nurse is stopped *before* the tap rather than handed a refusal after it,
//! never as the only guard. They lived in TypeScript inside the React Native
//! staff app; the `SwiftUI` and Compose apps must not each carry a third copy
//! that can drift, so they moved here and reach both through `medbrains-edge-rn`.

pub mod appointment;
pub mod bcma;
pub mod clinic_day;
pub mod companion;
pub mod consultation;
pub mod emergency;
pub mod fall_risk;
pub mod nurse_calls;
pub mod registration;
pub mod transfusion;
pub mod visitors;
