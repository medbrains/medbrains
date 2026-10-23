//! ICD-10 as a hospital-loaded catalogue, and the switch that picks ICD-11,
//! ICD-10 or both for diagnoses.
//!
//! No ICD-10 content ships with the code — ICD-10 is not openly licensed for
//! commercial use — and there is no ICD-11 ↔ ICD-10 mapping (WHO's ICD-11
//! licence §1.2.4 leaves crosswalks to a separate agreement). A licence
//! holder loads their own file; the tests use hand-written fixtures.

pub mod http;
pub mod parse;
pub mod store;
