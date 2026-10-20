//! Built-in handlers for outbound integrations.
//!
//! Real handlers (typed, hit external partners):
//! - `twilio`    — sms.* (real Twilio REST; falls back to stub when creds unset)
//! - `email_stub` — email.* (`SendGrid` HTTP API; SES pending `SigV4`)
//! - `whatsapp`  — whatsapp.* (Meta Cloud API)
//! - `nhcx`      — nhcx.* (HCX JWE exchange with the NHCX gateway)
//!
//! Stubs (Phase 1 — log only, return Ok; Phase 2 wires real protocol):
//! - `hl7_stub`       — `lab.critical_value_notify`, hl7.*
//!
//! Pipeline fallback (catches unregistered `event_types)`:
//! - `pipeline_fallback` — delegates to existing `events::dispatch_to_pipelines`

pub mod cashfree;
pub mod ccavenue;
pub mod email_stub;
pub mod google_meet;
pub mod hl7_stub;
pub mod nhcx;
pub mod pacs_worklist;
pub mod payu;
pub mod phonepe;
pub mod pinelabs;
pub mod pipeline_fallback;
pub mod razorpayx;
pub mod teams;
pub mod twilio;
pub mod webhook;
pub mod whatsapp;
pub mod zoom;
