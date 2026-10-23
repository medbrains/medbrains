//! The UHI wire format: domains, actions, the context every message
//! carries, and ACK/NACK.
//!
//! Sources (github.com/NHA-ABDM/UHI): `specification/core.yml`, the Postman
//! collections, NHA's reference HSPA. What could not be confirmed there is
//! marked **inferred** and kept a named constant, so one edit fixes it once
//! NHA's sandbox answers.

use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

/// Teleconsultation and physical consultation — verified (every UHI example).
pub const CONSULTATION_DOMAIN: &str = "nic2004:85111";
/// Blood banks — **inferred** from the UHI registry's test fixture; NHA's
/// reference blood-bank search instead rides the consultation domain with
/// fulfilment type `BloodStock`, which is accepted too.
pub const BLOOD_BANK_DOMAIN: &str = "nic2008:86906";
/// Ambulance — **inferred** from the same fixture; nothing else published.
pub const AMBULANCE_DOMAIN: &str = "nic2008:86909";
/// Diagnostic laboratories — the code the UHI registry's test fixture names
/// "Laboratories". NHA has published no lab service yet ("next phase"), so
/// the service stays hidden ([`Service::is_live`]).
pub const LAB_DOMAIN: &str = "nic2008:86905";
/// The UHI core version every working example carries — verified.
pub const CORE_VERSION: &str = "0.7.1";

/// Fulfilment types — verified (`ConstantsUtils.java`).
pub const FULFILMENT_ONLINE: &str = "Online";
pub const FULFILMENT_PHYSICAL: &str = "Physical";
pub const FULFILMENT_PHYSICAL_OPD: &str = "Physical-OPD";
pub const FULFILMENT_BLOOD_STOCK: &str = "BloodStock";
/// Lab sample collection at home or at the lab counter — **inferred**.
pub const FULFILMENT_HOME_COLLECTION: &str = "HomeCollection";
pub const FULFILMENT_WALK_IN: &str = "WalkIn";

/// Payment stages and states — verified (`core.yml` `Payment`; NHA's
/// reference HSPA books only on `PAID` or `FREE`).
pub const PAYMENT_ON_ORDER: &str = "ON-ORDER";
pub const PAYMENT_ON_FULFILMENT: &str = "ON-FULFILLMENT";
pub const PAYMENT_PAID: &str = "PAID";
pub const PAYMENT_NOT_PAID: &str = "NOT-PAID";
/// How the patient app opens the payment link — verified (NHA's EUA sends
/// `http/get`; `core.yml` lists `https`).
pub const PAYMENT_TL_METHOD: &str = "http/get";

/// Order states — `CONFIRMED`/`CANCELLED`/`FAILED` verified; `PENDING`
/// (waiting for staff) **inferred**.
pub const STATE_PENDING: &str = "PENDING";
pub const STATE_CONFIRMED: &str = "CONFIRMED";
pub const STATE_CANCELLED: &str = "CANCELLED";
pub const STATE_FAILED: &str = "FAILED";

/// UHI's error codes (`GatewayError.java`) — verified.
pub const ERR_AUTH_MISSING: &str = "UHI-1401";
pub const ERR_BAD_REQUEST: &str = "UHI-1404";
pub const ERR_INVALID_SIGNATURE: &str = "UHI-1405";
pub const ERR_NOT_REGISTERED: &str = "UHI-1406";
pub const ERR_INTERNAL: &str = "UHI-1407";

/// What this hospital can offer over UHI; each is one variant and its
/// catalogue. U-WIN is not here: NHA has published no U-WIN UHI spec.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Service {
    Teleconsultation,
    PhysicalConsultation,
    LabTests,
    BloodBank,
    Ambulance,
}

impl Service {
    pub const ALL: [Self; 5] = [
        Self::Teleconsultation,
        Self::PhysicalConsultation,
        Self::LabTests,
        Self::BloodBank,
        Self::Ambulance,
    ];

    /// The value stored in `uhi_subscriptions.services` / `uhi_transactions.service`.
    pub const fn code(self) -> &'static str {
        match self {
            Self::Teleconsultation => "teleconsultation",
            Self::PhysicalConsultation => "physical_consultation",
            Self::LabTests => "lab_tests",
            Self::BloodBank => "blood_bank",
            Self::Ambulance => "ambulance",
        }
    }

    pub fn from_code(code: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|s| s.code() == code)
    }

    /// Whether NHA lets a hospital be the provider of this service today:
    /// physical consultation, blood bank discovery and ambulance (PIB, 29
    /// Jun 2026). Teleconsultation (with its online payment) and lab tests
    /// are not provider services yet and stay off unless
    /// [`PREVIEW_SERVICES`] is set.
    pub const fn is_live(self) -> bool {
        matches!(
            self,
            Self::PhysicalConsultation | Self::BloodBank | Self::Ambulance
        )
    }

    /// The service a message asks for, from its domain and fulfilment type.
    /// `None` for one this hospital does not offer over UHI yet.
    pub fn for_message(domain: &str, fulfilment_type: Option<&str>) -> Option<Self> {
        match (domain, fulfilment_type) {
            (BLOOD_BANK_DOMAIN, _) | (CONSULTATION_DOMAIN, Some(FULFILMENT_BLOOD_STOCK)) => {
                Some(Self::BloodBank)
            }
            (AMBULANCE_DOMAIN, _) => Some(Self::Ambulance),
            (LAB_DOMAIN, _) => Some(Self::LabTests),
            (CONSULTATION_DOMAIN, Some(FULFILMENT_PHYSICAL | FULFILMENT_PHYSICAL_OPD)) => {
                Some(Self::PhysicalConsultation)
            }
            // A consultation search without a type is answered with what we
            // have: teleconsultations.
            (CONSULTATION_DOMAIN, None | Some(FULFILMENT_ONLINE)) => Some(Self::Teleconsultation),
            _ => None,
        }
    }
}

/// Set to `true` to offer services UHI does not support from a provider yet
/// (teleconsultation, online payment, lab tests). Off by default.
pub const PREVIEW_SERVICES: &str = "UHI_PREVIEW_SERVICES";

/// Which published gateway contract a subscription follows.
///
/// `V202` — the default — is Gateway spec v2.0.2, NHA's UHI set of 28 Sep
/// 2026 as published on the ABDM developer portal (docs.abdm.gov.in). `S2`
/// is the earlier contract of github.com/NHA-ABDM/UHI, kept selectable in
/// case a sandbox still answers on it. Everything that differs between them
/// is decided here.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GatewaySpec {
    V202,
    S2,
}

impl GatewaySpec {
    pub fn from_code(code: &str) -> Self {
        if code == "s2" { Self::S2 } else { Self::V202 }
    }

    /// Where a search fanned out by the gateway is answered.
    pub const fn on_search_path(self) -> &'static str {
        match self {
            Self::V202 => "/api/v1/uhi/on_search",
            Self::S2 => "/api/v1/on_search",
        }
    }

    /// The headers the gateway's own signature may arrive in.
    pub const fn gateway_headers(self) -> &'static [&'static str] {
        match self {
            Self::V202 => &["x-gateway-authorization", "proxy-authorization"],
            Self::S2 => &["x-gateway-authorization"],
        }
    }

    /// Whether our calls carry a separate `Digest: BLAKE-512=…` header.
    pub const fn sends_digest(self) -> bool {
        matches!(self, Self::V202)
    }

    pub fn ack(self) -> Value {
        match self {
            Self::V202 => json!({ "message": { "ack": { "status": "ACK" } }, "error": {} }),
            Self::S2 => json!({ "message": { "ack": { "status": "ACK" } } }),
        }
    }
}

/// The calls an EUA makes to an HSPA. `update` and `rating` are accepted and
/// recorded; nothing in this hospital changes on them.
pub const ACTIONS: [&str; 8] = [
    "search", "select", "init", "confirm", "status", "cancel", "update", "rating",
];

/// A refusal. `kind` is a Beckn error type: `CONTEXT-ERROR` for what the
/// caller sent, `CORE-ERROR` for our own fault.
pub fn nack(kind: &str, code: &str, message: &str) -> Value {
    json!({
        "message": { "ack": { "status": "NACK" } },
        "error": { "type": kind, "code": code, "path": "", "message": message },
    })
}

/// The parts of a message's `context` this hospital acts on. UHI names the
/// patient app `consumer_*` and us `provider_*`; Beckn's `bap_*`/`bpp_*` are
/// read too.
#[derive(Debug, Clone)]
pub struct Context {
    raw: Value,
    pub domain: String,
    pub action: String,
    pub transaction_id: String,
    pub message_id: String,
    pub consumer_id: String,
    pub consumer_uri: String,
    pub provider_id: Option<String>,
    pub city: Option<String>,
    pub country: String,
}

fn text(v: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|k| v.get(*k).and_then(Value::as_str))
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

impl Context {
    /// # Errors
    /// The name of the first required field that is missing.
    pub fn parse(body: &Value) -> Result<Self, String> {
        let raw = body.get("context").cloned().ok_or("context")?;
        let need = |keys: &[&str]| text(&raw, keys).ok_or_else(|| keys[0].to_owned());
        Ok(Self {
            domain: need(&["domain"])?,
            action: need(&["action"])?,
            transaction_id: need(&["transaction_id"])?,
            message_id: need(&["message_id"])?,
            consumer_id: need(&["consumer_id", "bap_id"])?,
            consumer_uri: need(&["consumer_uri", "bap_uri"])?,
            provider_id: text(&raw, &["provider_id", "bpp_id"]),
            city: text(&raw, &["city"]),
            country: text(&raw, &["country"]).unwrap_or_else(|| "IND".to_owned()),
            raw,
        })
    }

    /// The context of our `on_<action>` answer: the same transaction and
    /// message IDs, with us as the provider.
    pub fn reply(&self, provider_id: &str, provider_uri: &str) -> Value {
        let mut ctx = self.raw.clone();
        let beckn_names = ctx.get("bap_id").is_some();
        if let Some(map) = ctx.as_object_mut() {
            map.insert("action".into(), json!(format!("on_{}", self.action)));
            map.insert(
                "timestamp".into(),
                json!(Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)),
            );
            let (id, uri) = if beckn_names {
                ("bpp_id", "bpp_uri")
            } else {
                ("provider_id", "provider_uri")
            };
            map.insert(id.into(), json!(provider_id));
            map.insert(uri.into(), json!(provider_uri));
            map.entry("core_version").or_insert(json!(CORE_VERSION));
        }
        ctx
    }
}

/// `fulfillment.type` of a search intent or an order.
pub fn fulfilment_type(body: &Value) -> Option<&str> {
    let message = body.get("message")?;
    message
        .pointer("/intent/fulfillment/type")
        .or_else(|| message.pointer("/order/fulfillment/type"))
        .and_then(Value::as_str)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{AMBULANCE_DOMAIN, CONSULTATION_DOMAIN, Context, Service};
    use serde_json::json;

    #[test]
    fn the_service_follows_domain_and_fulfilment_type() {
        let s = Service::for_message;
        assert_eq!(
            s(CONSULTATION_DOMAIN, Some("Online")),
            Some(Service::Teleconsultation)
        );
        assert_eq!(
            s(CONSULTATION_DOMAIN, None),
            Some(Service::Teleconsultation)
        );
        assert_eq!(
            s(CONSULTATION_DOMAIN, Some("BloodStock")),
            Some(Service::BloodBank)
        );
        assert_eq!(
            s(CONSULTATION_DOMAIN, Some("Physical")),
            Some(Service::PhysicalConsultation)
        );
        assert_eq!(s(super::LAB_DOMAIN, None), Some(Service::LabTests));
        assert_eq!(s(CONSULTATION_DOMAIN, Some("Vaccination")), None);
        assert_eq!(s(AMBULANCE_DOMAIN, None), Some(Service::Ambulance));
        assert_eq!(s("nic2004:00000", None), None);
    }

    #[test]
    fn a_reply_keeps_the_ids_and_names_us() {
        let body = json!({ "context": { "domain": CONSULTATION_DOMAIN, "action": "search",
            "transaction_id": "t1", "message_id": "m1", "consumer_id": "eua",
            "consumer_uri": "https://eua.test/api/v1", "city": "std:080" } });
        let ctx = Context::parse(&body).unwrap();
        let reply = ctx.reply("hspa.test", "https://h.test/api/uhi/hspa/hspa.test");
        assert_eq!(reply["action"], "on_search");
        assert_eq!(reply["message_id"], "m1");
        assert_eq!(reply["transaction_id"], "t1");
        assert_eq!(reply["provider_id"], "hspa.test");
        assert_eq!(reply["city"], "std:080");
        assert_eq!(
            Context::parse(&json!({ "context": { "domain": "d" } })).unwrap_err(),
            "action"
        );
    }
}
