//! Razorpay POS (Ezetap) push-to-pay: the sale is pushed to the Android POS
//! device named by its serial, and polled.
//!
//! Checked against Odoo 17/18's shipping `addons/pos_razorpay`
//! (`razorpay_pos_request.py`, `pos_payment_method.py` and its tests), as
//! summarised in `docs/research-pos-payments-2026-10.md` §2.2:
//!   {base}/pay, {base}/status, {base}/cancel — all POST JSON, base
//!   `…/api/3.0/p2padapter/`; the device id is `<serial>|ezetap_android`;
//!   amounts are rupees; every answer carries `success`, and `success:false`
//!   or an `errorCode` is a refusal (HTTP 200 all the same).
//! Status words other than Odoo's are not documented; they keep the sale
//! waiting, and past the window it goes to a person, never to declined.

use async_trait::async_trait;
use serde_json::{Value, json};

use super::{
    Approval, Ctx, PosError, PosProvider, SaleAsk, SaleState, Tender, base_override, post_json,
    tenant_secret,
};

/// A stand-in Ezetap for tests.
pub const API_BASE_OVERRIDE: &str = "EZETAP_API_BASE_OVERRIDE";
const DEMO_BASE: &str = "https://demo.ezetap.com/api/3.0/p2padapter";
const LIVE_BASE: &str = "https://www.ezetap.com/api/3.0/p2padapter";
/// What Ezetap appends to a device serial to name an Android POS.
pub const DEVICE_SUFFIX: &str = "|ezetap_android";
/// `messageCode` of a sale the device finished.
const DONE: &str = "P2P_DEVICE_TXN_DONE";
/// `messageCode` of a sale cancelled on the device (one L).
const CANCELED: &str = "P2P_DEVICE_CANCELED";
/// `status` of an approved sale; `FAILED` fails it whatever the messageCode.
const AUTHORIZED: &str = "AUTHORIZED";
const FAILED: &str = "FAILED";

#[derive(Debug)]
pub struct Ezetap;

async fn creds(ctx: &Ctx<'_>) -> Result<(String, String), PosError> {
    Ok((
        tenant_secret(ctx.secrets, ctx.tenant_id, "ezetap-app-key").await?,
        tenant_secret(ctx.secrets, ctx.tenant_id, "ezetap-username").await?,
    ))
}

async fn base(ctx: &Ctx<'_>) -> String {
    match base_override(ctx.secrets, API_BASE_OVERRIDE).await {
        Some(b) => b,
        None if ctx.terminal.mode == "live" => LIVE_BASE.to_owned(),
        None => DEMO_BASE.to_owned(),
    }
}

/// `<serial>|ezetap_android` from the serial entered on the terminal (a
/// serial entered with the suffix already on is taken as it is).
pub fn device_id(serial: &str) -> String {
    let serial = serial.trim();
    if serial.ends_with(DEVICE_SUFFIX) {
        serial.to_owned()
    } else {
        format!("{serial}{DEVICE_SUFFIX}")
    }
}

fn device(ctx: &Ctx<'_>) -> Result<String, PosError> {
    ctx.terminal
        .terminal_code
        .as_deref()
        .filter(|c| !c.trim().is_empty())
        .map(device_id)
        .ok_or_else(|| {
            PosError::Refused("Set the Razorpay POS device serial no. on this terminal".to_owned())
        })
}

/// `success:true` with no `errorCode`; otherwise its refusal, in its words.
pub fn check(answer: &Value) -> Result<(), PosError> {
    let error = answer["errorCode"].as_str().filter(|c| !c.is_empty());
    if answer["success"].as_bool() == Some(true) && error.is_none() {
        return Ok(());
    }
    Err(PosError::Refused(format!(
        "Razorpay POS refused it: {}{}",
        answer["errorMessage"].as_str().unwrap_or("no reason given"),
        error.map(|c| format!(" ({c})")).unwrap_or_default()
    )))
}

/// The `mode` for the cashier's choice.
pub const fn mode(tender: Tender) -> &'static str {
    match tender {
        Tender::Card => "CARD",
        Tender::Upi => "UPI",
        Tender::Either => "ALL",
    }
}

/// Paise as the rupee number Ezetap takes (Odoo sends `100` for ₹100).
// ponytail: f64 holds two decimals of a counter amount exactly enough for
// JSON; a Decimal number would need serde-float plumbing.
#[allow(clippy::cast_precision_loss)]
pub fn rupees(paise: i64) -> Value {
    if paise % 100 == 0 {
        json!(paise / 100)
    } else {
        json!(paise as f64 / 100.0)
    }
}

fn text(v: &Value) -> Option<String> {
    v.as_str()
        .map(ToOwned::to_owned)
        .or_else(|| v.as_i64().map(|n| n.to_string()))
        .filter(|s| !s.is_empty())
}

#[allow(clippy::cast_possible_truncation)]
fn approval(answer: &Value) -> Approval {
    let amount = &answer["amount"];
    let rupees = amount
        .as_f64()
        .or_else(|| amount.as_str().and_then(|a| a.trim().parse().ok()));
    Approval {
        reference: text(&answer["txnId"]).unwrap_or_default(),
        approved_paise: rupees.map(|r: f64| (r * 100.0).round() as i64),
        card_last4: answer["cardLastFourDigit"]
            .as_str()
            .and_then(super::pinelabs::last4),
        auth_code: text(&answer["authCode"]),
        rrn: text(&answer["reverseReferenceNumber"]),
        method: text(&answer["paymentMode"]),
        payload: answer.clone(),
    }
}

/// An Ezetap status answer, read — Odoo's mapping. A refusal to say is an
/// error, never an outcome. `P2P_DEVICE_RECEIVED`, `P2P_DEVICE_SENT` and
/// `P2P_STATUS_QUEUED` wait, and so does any word we do not know.
pub fn read_status(answer: &Value) -> Result<SaleState, PosError> {
    check(answer)?;
    let status = answer["status"].as_str().unwrap_or_default();
    let code = answer["messageCode"].as_str().unwrap_or_default();
    Ok(match (status, code) {
        (AUTHORIZED, DONE) => SaleState::Approved(approval(answer)),
        (_, CANCELED) => SaleState::Cancelled,
        (FAILED, _) => SaleState::Declined(
            answer["message"]
                .as_str()
                .filter(|m| !m.is_empty())
                .unwrap_or("The payment failed at the machine")
                .to_owned(),
        ),
        _ => SaleState::Waiting,
    })
}

#[async_trait]
impl PosProvider for Ezetap {
    async fn start(&self, ctx: &Ctx<'_>, sale: SaleAsk) -> Result<String, PosError> {
        let (app_key, username) = creds(ctx).await?;
        let body = json!({
            "appKey": app_key, "username": username,
            "amount": rupees(sale.amount_paise),
            "externalRefNumber": sale.txn_id.to_string(),
            "mode": mode(sale.tender),
            "pushTo": { "deviceId": device(ctx)? },
        });
        let answer = post_json(&format!("{}/pay", base(ctx).await), &body).await?;
        check(&answer)?;
        text(&answer["p2pRequestId"])
            .ok_or_else(|| PosError::Refused("Razorpay POS named no request".to_owned()))
    }

    async fn status(&self, ctx: &Ctx<'_>, reference: &str) -> Result<SaleState, PosError> {
        let (app_key, username) = creds(ctx).await?;
        let body =
            json!({ "appKey": app_key, "username": username, "origP2pRequestId": reference });
        let answer = post_json(&format!("{}/status", base(ctx).await), &body).await?;
        read_status(&answer)
    }

    async fn cancel(&self, ctx: &Ctx<'_>, reference: &str, _paise: i64) -> Result<(), PosError> {
        let (app_key, username) = creds(ctx).await?;
        let body = json!({ "appKey": app_key, "username": username,
                           "origP2pRequestId": reference, "pushTo": { "deviceId": device(ctx)? } });
        let answer = post_json(&format!("{}/cancel", base(ctx).await), &body).await?;
        check(&answer)
    }

    async fn ping(&self, ctx: &Ctx<'_>) -> Result<(), PosError> {
        creds(ctx).await?;
        device(ctx).map(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::{PosError, SaleState, Tender, device_id, mode, read_status, rupees};
    use serde_json::json;

    /// Odoo's `test_fetch_payment_status_authorized` payload, with UPI paid.
    #[test]
    fn an_authorized_done_sale_is_approved_with_its_rrn_and_mode() {
        let ok = json!({ "success": true, "status": "AUTHORIZED",
            "messageCode": "P2P_DEVICE_TXN_DONE", "authCode": "D12345",
            "cardLastFourDigit": "1234", "externalRefNumber": "Hoot/ORDER0001",
            "txnId": "250102070624795E020088174", "paymentMode": "UPI",
            "reverseReferenceNumber": "500212345678", "settlementStatus": "PENDING" });
        let Ok(SaleState::Approved(a)) = read_status(&ok) else {
            unreachable!("approved")
        };
        assert_eq!(a.reference, "250102070624795E020088174");
        assert_eq!(
            (a.auth_code.as_deref(), a.card_last4.as_deref()),
            (Some("D12345"), Some("1234"))
        );
        assert_eq!(
            (a.rrn.as_deref(), a.method.as_deref(), a.approved_paise),
            (Some("500212345678"), Some("UPI"), None)
        );
    }

    #[test]
    fn failed_and_cancelled_close_and_the_device_words_wait() {
        let failed = json!({ "success": true, "status": "FAILED",
                             "messageCode": "P2P_DEVICE_TXN_DONE", "message": "Declined" });
        assert_eq!(
            read_status(&failed),
            Ok(SaleState::Declined("Declined".to_owned()))
        );
        let cancelled = json!({ "success": true, "messageCode": "P2P_DEVICE_CANCELED",
                                "message": "Transaction cancelled on the terminal" });
        assert_eq!(read_status(&cancelled), Ok(SaleState::Cancelled));
        for code in [
            "P2P_DEVICE_RECEIVED",
            "P2P_DEVICE_SENT",
            "P2P_STATUS_QUEUED",
            "P2P_STATUS_IN_EXPIRED",
            "SOMETHING_NEW",
        ] {
            let answer = json!({ "success": true, "messageCode": code });
            assert_eq!(read_status(&answer), Ok(SaleState::Waiting), "{code}");
        }
    }

    /// Odoo's `test_payment_request_reports_error_message` payload.
    #[test]
    fn success_false_or_an_error_code_is_a_refusal_never_an_outcome() {
        let refused = json!({ "success": false, "errorCode": "EZETAP_0000387",
                              "errorMessage": "`externalRefNumber` field is empty." });
        assert!(
            matches!(read_status(&refused), Err(PosError::Refused(w)) if w.contains("EZETAP_0000387"))
        );
        let sneaky = json!({ "success": true, "errorCode": "EZETAP_1", "status": "AUTHORIZED",
                             "messageCode": "P2P_DEVICE_TXN_DONE" });
        assert!(matches!(read_status(&sneaky), Err(PosError::Refused(_))));
    }

    #[test]
    fn device_mode_and_amount_are_sent_as_ezetap_takes_them() {
        assert_eq!(device_id("7000012300"), "7000012300|ezetap_android");
        assert_eq!(
            device_id(" 7000012300|ezetap_android "),
            "7000012300|ezetap_android"
        );
        assert_eq!(
            (mode(Tender::Card), mode(Tender::Upi), mode(Tender::Either)),
            ("CARD", "UPI", "ALL")
        );
        assert_eq!(rupees(10_000), json!(100));
        assert_eq!(rupees(70_050), json!(700.5));
    }
}
