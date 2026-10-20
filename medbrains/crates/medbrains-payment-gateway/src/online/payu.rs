//! PayU (India) behind [`OnlineProvider`]: the hash-signed hosted checkout.
//!
//! VERIFIED (docs.payu.in):
//! * Checkout: a form posted to `{secure|test}.payu.in/_payment` with
//!   `hash = sha512(key|txnid|amount|productinfo|firstname|email|||||||||||SALT)`
//!   (five empty UDFs and five reserved fields); the salt is never sent.
//! * Response / webhook: `hash = sha512(SALT|status||||||udf5|udf4|udf3|udf2|
//!   udf1|email|firstname|productinfo|amount|txnid|key)`, with
//!   `additional_charges|` in front when PayU adds charges. Only `success` is
//!   paid. `mihpayid` is PayU's payment id.
//! * Command API `POST {info|test}.payu.in/merchant/postservice.php?form=2`,
//!   form `key, command, var1…, hash = sha512(key|command|var1|SALT)`:
//!   `verify_payment` (var1 = txnid), `cancel_refund_transaction` (var1 =
//!   mihpayid, var2 = a token unique per refund, ≤ 23 characters, var3 =
//!   amount; partial allowed).
//!
//! INFERRED: [`TXNID_LEN`]; the `mode` words (`CC`, `DC`, `NB`, `UPI`,
//! `CASH` for wallets); callbacks arrive form-encoded (JSON is read too);
//! [`PAYER_EMAIL`] is accepted where the counter has no email; PayU's refund
//! notices are not parsed (refunds are taken in when made here).

use std::collections::BTreeMap;

use async_trait::async_trait;
use axum::http::HeaderMap;
use serde_json::Value;
use sha2::{Digest, Sha512};

use super::http::{client, send};
use super::{
    Capabilities, Checkout, CheckoutAsk, ClientProof, Ctx, KeyField, Keys, Located, Notice,
    OnlineProvider, Opened, PaymentRecord, PaymentState, ProviderError, ProviderEvent, RefundAsk,
    Via, paise_of, rupees_text,
};

const WHO: &str = "PayU";
const LIVE: &str = "https://secure.payu.in";
const LIVE_INFO: &str = "https://info.payu.in";
const TEST: &str = "https://test.payu.in";
/// Inferred: PayU's `txnid` limit; ours is `MB` + the row id's first hex.
pub const TXNID_LEN: usize = 25;
/// PayU's refund token limit (verified: ≤ 23 characters).
const REFUND_TOKEN_LEN: usize = 23;
/// Inferred: PayU requires an email; the counter rarely has one.
pub const PAYER_EMAIL: &str = "patient@medbrains.local";
/// The page PayU sends the browser back to posts here.
pub const CALLBACK_PATH: &str = "/api/webhooks/payu";

#[derive(Debug)]
pub struct PayU;

const FIELDS: &[KeyField] = &[
    KeyField {
        name: "key",
        label: "Merchant key",
        secret: false,
        required: true,
    },
    KeyField {
        name: "salt",
        label: "Salt",
        secret: true,
        required: true,
    },
];

fn sha512_hex(text: &str) -> String {
    hex::encode(Sha512::digest(text.as_bytes()))
}

/// The txnid PayU knows a payment row by.
pub fn txnid(txn: uuid::Uuid) -> String {
    let mut id = format!("MB{}", txn.simple());
    id.truncate(TXNID_LEN);
    id
}

/// The request hash for a hosted checkout.
pub fn payment_hash(f: &BTreeMap<String, String>, salt: &str) -> String {
    let g = |k: &str| f.get(k).map_or("", String::as_str);
    sha512_hex(&format!(
        "{}|{}|{}|{}|{}|{}|||||||||||{salt}",
        g("key"),
        g("txnid"),
        g("amount"),
        g("productinfo"),
        g("firstname"),
        g("email")
    ))
}

/// Whether a callback's `hash` is PayU's reverse hash of its fields.
pub fn response_hash_ok(f: &BTreeMap<String, String>, salt: &str) -> bool {
    let g = |k: &str| f.get(k).map_or("", String::as_str);
    let core = format!(
        "{salt}|{}||||||{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}",
        g("status"),
        g("udf5"),
        g("udf4"),
        g("udf3"),
        g("udf2"),
        g("udf1"),
        g("email"),
        g("firstname"),
        g("productinfo"),
        g("amount"),
        g("txnid"),
        g("key")
    );
    let text = match f.get("additional_charges").filter(|c| !c.is_empty()) {
        Some(c) => format!("{c}|{core}"),
        None => core,
    };
    f.get("hash")
        .is_some_and(|h| h.trim().eq_ignore_ascii_case(&sha512_hex(&text)))
}

/// A callback's fields, form-encoded or JSON.
pub fn fields_of(body: &str) -> BTreeMap<String, String> {
    if let Ok(Value::Object(m)) = serde_json::from_str::<Value>(body) {
        return m
            .iter()
            .filter_map(|(k, v)| super::text(v).map(|t| (k.clone(), t)))
            .collect();
    }
    body.split('&')
        .filter_map(|pair| {
            let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
            let decode = |s: &str| {
                urlencoding::decode(&s.replace('+', " "))
                    .map(|c| c.into_owned())
                    .ok()
            };
            Some((decode(k)?, decode(v)?))
        })
        .filter(|(k, _)| !k.is_empty())
        .collect()
}

/// PayU's `mode` as the method words settling knows.
fn method_of(mode: &str) -> String {
    match mode {
        "CC" | "DC" | "EMI" => "card",
        "NB" => "netbanking",
        "CASH" => "wallet",
        m if m.starts_with("UPI") => "upi",
        other => return other.to_ascii_lowercase(),
    }
    .to_owned()
}

async fn command(ctx: &Ctx<'_>, cmd: &str, vars: &[&str]) -> Result<Value, ProviderError> {
    let info = if ctx.base == LIVE {
        LIVE_INFO
    } else {
        ctx.base.as_str()
    };
    let key = ctx.keys.need("key")?;
    let salt = ctx.keys.need("salt")?;
    let var1 = vars.first().copied().unwrap_or_default();
    let mut form = vec![
        ("key".to_owned(), key.to_owned()),
        ("command".to_owned(), cmd.to_owned()),
        (
            "hash".to_owned(),
            sha512_hex(&format!("{key}|{cmd}|{var1}|{salt}")),
        ),
    ];
    for (i, v) in vars.iter().enumerate() {
        form.push((format!("var{}", i + 1), (*v).to_owned()));
    }
    let url = format!("{info}/merchant/postservice.php?form=2");
    send(client().post(url).form(&form), WHO).await
}

/// The site the cashier's page is on (scheme and host).
fn origin_of(url: &str) -> Option<&str> {
    let after = url.find("://")? + 3;
    let end = url[after..]
        .find(['/', '?', '#'])
        .map_or(url.len(), |i| after + i);
    url.get(..end)
}

#[async_trait]
impl OnlineProvider for PayU {
    fn code(&self) -> &'static str {
        "payu"
    }
    fn label(&self) -> &'static str {
        "PayU"
    }
    fn capabilities(&self) -> Capabilities {
        Capabilities {
            checkout: true,
            partial_refund: true,
            // The docs allow a partial refund; a second one is not stated.
            multiple_refunds: false,
            emi: true,
            ..Capabilities::default()
        }
    }
    fn key_fields(&self) -> &'static [KeyField] {
        FIELDS
    }
    fn api_base(&self, live: bool) -> &'static str {
        if live { LIVE } else { TEST }
    }

    async fn create_checkout(
        &self,
        ctx: &Ctx<'_>,
        ask: &CheckoutAsk<'_>,
    ) -> Result<Opened, ProviderError> {
        let back = ask.return_url.and_then(origin_of).ok_or_else(|| {
            ProviderError::Refused("PayU needs the page to send the patient back to".to_owned())
        })?;
        let callback = format!("{back}{CALLBACK_PATH}");
        let order_ref = txnid(ask.txn_id);
        let amount = rupees_text(ask.amount_paise);
        let pairs: [(&str, &str); 9] = [
            ("key", ctx.keys.need("key")?),
            ("txnid", order_ref.as_str()),
            ("amount", amount.as_str()),
            ("productinfo", ask.description),
            ("firstname", "Patient"),
            ("email", PAYER_EMAIL),
            ("phone", ask.phone.unwrap_or_default()),
            ("surl", callback.as_str()),
            ("furl", callback.as_str()),
        ];
        let mut fields: BTreeMap<String, String> = pairs
            .into_iter()
            .map(|(k, v)| (k.to_owned(), v.to_owned()))
            .collect();
        let hash = payment_hash(&fields, ctx.keys.need("salt")?);
        fields.insert("hash".to_owned(), hash);
        Ok(Opened {
            order_ref,
            checkout: Checkout::FormPost {
                action: format!("{}/_payment", ctx.base),
                fields,
            },
        })
    }

    async fn fetch_payment(
        &self,
        ctx: &Ctx<'_>,
        proof: &ClientProof<'_>,
    ) -> Result<PaymentRecord, ProviderError> {
        let v = command(ctx, "verify_payment", &[proof.order_ref]).await?;
        let t = &v["transaction_details"][proof.order_ref];
        let state = match t["status"].as_str() {
            Some("success") => PaymentState::Paid,
            Some("failure" | "failed" | "bounced" | "dropped") => PaymentState::Failed(
                t["field9"]
                    .as_str()
                    .unwrap_or("The payment failed")
                    .to_owned(),
            ),
            _ => PaymentState::Pending,
        };
        Ok(PaymentRecord {
            state,
            payment_id: super::text(&t["mihpayid"]).unwrap_or_default(),
            amount_paise: paise_of(&t["amt"]).or_else(|| paise_of(&t["transaction_amount"])),
            method: t["mode"].as_str().map(method_of),
        })
    }

    async fn refund(&self, ctx: &Ctx<'_>, ask: &RefundAsk<'_>) -> Result<String, ProviderError> {
        let token: String = ask.idempotency_key.chars().take(REFUND_TOKEN_LEN).collect();
        let amount = rupees_text(ask.amount_paise);
        let v = command(
            ctx,
            "cancel_refund_transaction",
            &[ask.payment_id, &token, &amount],
        )
        .await?;
        if v["status"].as_i64() != Some(1) {
            return Err(ProviderError::Refused(
                v["msg"]
                    .as_str()
                    .unwrap_or("PayU refused the refund")
                    .to_owned(),
            ));
        }
        Ok(super::text(&v["request_id"]).unwrap_or(token))
    }

    fn locate(&self, _headers: &HeaderMap, body: &str) -> Located {
        fields_of(body)
            .remove("txnid")
            .map_or(Located::Unreadable, Located::Order)
    }

    fn parse_webhook(
        &self,
        keys: &Keys,
        _headers: &HeaderMap,
        body: &str,
    ) -> Result<Notice, ProviderError> {
        let f = fields_of(body);
        if !response_hash_ok(&f, keys.need("salt")?)
            || f.get("key").map(String::as_str) != keys.get("key")
        {
            return Err(ProviderError::BadSignature);
        }
        let status = f.get("status").cloned().unwrap_or_default();
        let payment_id = f.get("mihpayid").cloned().unwrap_or_default();
        let event = match status.as_str() {
            "success" => ProviderEvent::Captured {
                via: Via::Checkout,
                payment_id: payment_id.clone(),
                amount_paise: f
                    .get("amount")
                    .and_then(|a| paise_of(&Value::String(a.clone()))),
                method: f.get("mode").map(String::as_str).map(method_of),
                lookup: None,
            },
            "failure" | "failed" | "bounced" => ProviderEvent::Failed {
                code: f.get("error").cloned(),
                reason: f.get("error_Message").cloned(),
            },
            other => ProviderEvent::Ignored(format!("status {other}")),
        };
        Ok(Notice {
            event_id: format!("{payment_id}:{status}"),
            event,
        })
    }

    async fn ping(&self, ctx: &Ctx<'_>) -> Result<(), ProviderError> {
        let v = command(ctx, "verify_payment", &["medbrains-ping"]).await?;
        match v["msg"].as_str() {
            Some(m) if m.to_ascii_lowercase().contains("invalid") => {
                Err(ProviderError::Refused(m.to_owned()))
            }
            _ => Ok(()),
        }
    }
}

#[cfg(test)]
#[path = "payu_tests.rs"]
mod tests;
