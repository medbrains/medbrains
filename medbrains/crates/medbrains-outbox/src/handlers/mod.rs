//! Built-in handlers for outbound integrations.
//!
//! Real handlers (typed, hit external partners):
//! - `razorpay`  — payment.create_order, payment.refund
//! - `twilio`    — sms.* (real Twilio REST; falls back to stub when creds unset)
//! - `email_stub` — email.* (SendGrid HTTP API; SES pending SigV4)
//! - `whatsapp`  — whatsapp.* (Meta Cloud API)
//!
//! Stubs (Phase 1 — log only, return Ok; Phase 2 wires real protocol):
//! - `abdm_stub`      — abdm.verify_abha, abdm.hie_bundle_push
//! - `tpa_stub`       — tpa.preauth_submit
//! - `hl7_stub`       — lab.critical_value_notify, hl7.*
//!
//! Pipeline fallback (catches unregistered event_types):
//! - `pipeline_fallback` — delegates to existing `events::dispatch_to_pipelines`

pub mod abdm_hfr;
pub mod abdm_stub;
pub mod nhcx;
pub mod email_stub;
pub mod hl7_stub;
pub mod pipeline_fallback;
pub mod razorpay;
pub mod tpa_stub;
pub mod twilio;
pub mod whatsapp;
