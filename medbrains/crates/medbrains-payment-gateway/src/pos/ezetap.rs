//! Razorpay POS (Ezetap) push-to-pay: the sale is pushed to the Android POS
//! device named by its device id (`<serial>|ezetap_android`), and polled.
//!
//! INFERRED — not verified against Ezetap's own reference, which is not
//! public. `/api/3.0/p2p/start` and `/api/3.0/p2p/status` and the `pushTo`
//! device id are from a partner integration guide (Ginesys); the cancel
//! call, every field name and every status word below are inferred and kept
//! as named constants. Validate on a Razorpay POS device with sandbox keys
//! (Ezetap demo host) before go-live.

use async_trait::async_trait;
use serde_json::{Value, json};

use super::{
    Approval, Ctx, PosError, PosProvider, SaleAsk, SaleState, base_override, post_json,
    tenant_secret,
};

/// A stand-in Ezetap for tests.
pub const API_BASE_OVERRIDE: &str = "EZETAP_API_BASE_OVERRIDE";
const DEMO_BASE: &str = "https://demo.ezetap.com/api/3.0/p2p";
const LIVE_BASE: &str = "https://www.ezetap.com/api/3.0/p2p";
/// Inferred `messageCode` values.
const DONE: &str = "P2P_DEVICE_TXN_DONE";
const CANCELED: &str = "P2P_DEVICE_CANCELED";
const EXPIRED: &str = "P2P_STATUS_IN_EXPIRED";
const FAILED: &str = "P2P_DEVICE_TXN_FAILED";
/// Inferred `status` of a completed card sale.
const AUTHORIZED: &str = "AUTHORIZED";

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

fn device(ctx: &Ctx<'_>) -> Result<String, PosError> {
    ctx.terminal
        .terminal_code
        .clone()
        .filter(|c| !c.trim().is_empty())
        .ok_or_else(|| {
            PosError::Refused("Set the Razorpay POS device id on this terminal".to_owned())
        })
}

fn refused(answer: &Value) -> PosError {
    PosError::Refused(format!(
        "Razorpay POS refused it: {}",
        answer["errorMessage"].as_str().unwrap_or("no reason given")
    ))
}

/// An Ezetap status answer, read.
pub fn read_status(answer: &Value) -> SaleState {
    let code = answer["messageCode"].as_str().unwrap_or_default();
    match code {
        DONE if answer["status"].as_str() == Some(AUTHORIZED) => SaleState::Approved(Approval {
            reference: answer["txnId"].as_str().unwrap_or_default().to_owned(),
            approved_paise: answer["amount"]
                .as_f64()
                .map(|r| (r * 100.0).round() as i64),
            card_last4: answer["cardLastFourDigit"]
                .as_str()
                .and_then(super::pinelabs::last4),
            auth_code: answer["authCode"].as_str().map(ToOwned::to_owned),
            payload: answer.clone(),
        }),
        DONE | FAILED => SaleState::Declined(
            answer["message"]
                .as_str()
                .unwrap_or("The card was declined")
                .to_owned(),
        ),
        CANCELED => SaleState::Cancelled,
        EXPIRED => SaleState::TimedOut,
        _ => SaleState::Waiting,
    }
}

#[async_trait]
impl PosProvider for Ezetap {
    async fn start(&self, ctx: &Ctx<'_>, sale: SaleAsk) -> Result<String, PosError> {
        let (app_key, username) = creds(ctx).await?;
        let body = json!({
            "appKey": app_key, "username": username,
            "amount": format!("{}.{:02}", sale.amount_paise / 100, sale.amount_paise % 100),
            "externalRefNumber": sale.txn_id.to_string(),
            "mode": "CARD",
            "pushTo": { "deviceId": device(ctx)? },
        });
        let answer = post_json(&format!("{}/start", base(ctx).await), &body).await?;
        if answer["success"].as_bool() != Some(true) {
            return Err(refused(&answer));
        }
        answer["p2pRequestId"]
            .as_str()
            .map(ToOwned::to_owned)
            .ok_or_else(|| PosError::Refused("Razorpay POS named no request".to_owned()))
    }

    async fn status(&self, ctx: &Ctx<'_>, reference: &str) -> Result<SaleState, PosError> {
        let (app_key, username) = creds(ctx).await?;
        let body =
            json!({ "appKey": app_key, "username": username, "origP2pRequestId": reference });
        let answer = post_json(&format!("{}/status", base(ctx).await), &body).await?;
        Ok(read_status(&answer))
    }

    async fn cancel(&self, ctx: &Ctx<'_>, reference: &str) -> Result<(), PosError> {
        let (app_key, username) = creds(ctx).await?;
        let body = json!({ "appKey": app_key, "username": username,
                           "origP2pRequestId": reference, "pushTo": { "deviceId": device(ctx)? } });
        let answer = post_json(&format!("{}/cancel", base(ctx).await), &body).await?;
        if answer["success"].as_bool() == Some(false) {
            return Err(refused(&answer));
        }
        Ok(())
    }

    async fn ping(&self, ctx: &Ctx<'_>) -> Result<(), PosError> {
        creds(ctx).await?;
        device(ctx).map(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::{SaleState, read_status};
    use serde_json::json;

    #[test]
    fn a_done_authorized_sale_is_approved_and_a_done_unauthorized_one_declined() {
        let ok = json!({ "messageCode": "P2P_DEVICE_TXN_DONE", "status": "AUTHORIZED",
                         "txnId": "T1", "amount": 500.0, "authCode": "AC1",
                         "cardLastFourDigit": "4242" });
        let SaleState::Approved(a) = read_status(&ok) else {
            unreachable!("approved")
        };
        assert_eq!(
            (a.reference.as_str(), a.approved_paise),
            ("T1", Some(50_000))
        );
        let no = json!({ "messageCode": "P2P_DEVICE_TXN_DONE", "status": "FAILED", "message": "Declined" });
        assert_eq!(read_status(&no), SaleState::Declined("Declined".to_owned()));
        assert_eq!(
            read_status(&json!({ "messageCode": "P2P_DEVICE_RECEIVED" })),
            SaleState::Waiting
        );
    }
}
