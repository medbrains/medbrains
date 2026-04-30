//! ABDM (Ayushman Bharat Digital Mission) integration routes.
//!
//! Phase 11 of the hybrid roadmap. Two distinct surfaces:
//! - `hfr`         — Health Facility Registry registration. One-time
//!                    setup per tenant; produces the facility ID +
//!                    HCX sender code that NHCX needs.
//! - `hip_relay`   — Cloud-side relay for ABDM gateway callbacks.
//!                    The gateway POSTs here with NHCX results +
//!                    HIE bundle requests; we forward to the on-prem
//!                    server over the Headscale tailnet.

pub mod hfr;
pub mod hip_relay;
