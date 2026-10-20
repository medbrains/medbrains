//! Pine Labs Plutus Cloud: the billed sale is uploaded to the terminal, the
//! patient taps or inserts, and the status call says how it went.
//!
//! Verified UAT endpoints (RFC-MODULE-payment-providers §7.2):
//!   {base}/UploadBilledTransaction → PlutusTransactionReferenceID (PTRID)
//!   {base}/GetCloudBasedTxnStatus  → ResponseCode 0 approved, 1001 in progress
//! Inferred from the public integration guide, to validate on a UAT terminal:
//!   {base}/CancelTransaction, the field names below, and the
//!   `TransactionData` tags the approval details are read from.
//! Plutus has no device-presence call, so a ping only checks the hospital's
//! Pine Labs keys are set.

use async_trait::async_trait;
use serde_json::{Value, json};

use super::{
    Approval, Ctx, PosError, PosProvider, SaleAsk, SaleState, base_override, post_json,
    tenant_secret,
};

/// A stand-in Plutus for tests (a secret, never a stray environment variable).
pub const API_BASE_OVERRIDE: &str = "PINELABS_API_BASE_OVERRIDE";
const UAT_BASE: &str = "https://www.plutuscloudserviceuat.in:8201/API/CloudBasedIntegration/V1";
const LIVE_BASE: &str = "https://www.plutuscloudservice.in:8201/API/CloudBasedIntegration/V1";
const APPROVED: i64 = 0;
/// `ResponseCode` while the sale is still at the terminal.
const PROCESSING: i64 = 1001;
/// Card and UPI on the terminal.
const ALL_PAYMENT_MODES: i64 = 10;
/// The terminal's own give-up time; see [`super::ANSWER_WITHIN_SECS`].
const AUTO_CANCEL_MINUTES: i64 = 5;
/// Inferred `TransactionData` tags.
const TAG_APPROVAL: &str = "ApprovalCode";
const TAG_CARD: &str = "Card Number";
const TAG_AMOUNT: &str = "Amount";

#[derive(Debug)]
pub struct PineLabs;

struct Keys {
    merchant_id: String,
    security_token: String,
    client_id: String,
    store_id: String,
}

async fn keys(ctx: &Ctx<'_>) -> Result<Keys, PosError> {
    let get = |name: &'static str| tenant_secret(ctx.secrets, ctx.tenant_id, name);
    Ok(Keys {
        merchant_id: get("pinelabs-merchant-id").await?,
        security_token: get("pinelabs-security-token").await?,
        client_id: get("pinelabs-client-id").await?,
        store_id: get("pinelabs-store-id").await?,
    })
}

async fn base(ctx: &Ctx<'_>) -> String {
    match base_override(ctx.secrets, API_BASE_OVERRIDE).await {
        Some(b) => b,
        None if ctx.terminal.mode == "live" => LIVE_BASE.to_owned(),
        None => UAT_BASE.to_owned(),
    }
}

impl Keys {
    fn body(&self, extra: Value) -> Value {
        let mut body = json!({
            "MerchantID": self.merchant_id,
            "SecurityToken": self.security_token,
            "ClientID": self.client_id,
            "StoreID": self.store_id,
        });
        if let (Some(b), Value::Object(e)) = (body.as_object_mut(), extra) {
            b.extend(e);
        }
        body
    }
}

fn tag<'a>(data: &'a Value, name: &str) -> Option<&'a str> {
    data["TransactionData"]
        .as_array()?
        .iter()
        .find(|t| t["Tag"].as_str() == Some(name))
        .and_then(|t| t["Value"].as_str())
}

/// A Plutus status answer, read.
pub fn read_status(ptrid: &str, body: &Value) -> SaleState {
    match body["ResponseCode"].as_i64() {
        Some(APPROVED) => SaleState::Approved(Approval {
            reference: ptrid.to_owned(),
            approved_paise: tag(body, TAG_AMOUNT).and_then(|a| a.trim().parse().ok()),
            card_last4: tag(body, TAG_CARD).and_then(last4),
            auth_code: tag(body, TAG_APPROVAL).map(ToOwned::to_owned),
            payload: body.clone(),
        }),
        Some(PROCESSING) => SaleState::Waiting,
        _ => SaleState::Declined(
            body["ResponseMessage"]
                .as_str()
                .filter(|m| !m.is_empty())
                .unwrap_or("The card was declined at the terminal")
                .to_owned(),
        ),
    }
}

/// The last four digits of a masked card number.
pub(crate) fn last4(masked: &str) -> Option<String> {
    let digits: String = masked.chars().filter(char::is_ascii_digit).collect();
    (digits.len() >= 4).then(|| digits[digits.len() - 4..].to_owned())
}

fn reference_of(body: &Value) -> Option<String> {
    let id = &body["PlutusTransactionReferenceID"];
    id.as_str()
        .map(ToOwned::to_owned)
        .or_else(|| id.as_i64().map(|n| n.to_string()))
}

#[async_trait]
impl PosProvider for PineLabs {
    async fn start(&self, ctx: &Ctx<'_>, sale: SaleAsk) -> Result<String, PosError> {
        let k = keys(ctx).await?;
        let body = k.body(json!({
            "Amount": sale.amount_paise,
            "TransactionNumber": sale.txn_id.to_string(),
            "SequenceNumber": 1,
            "AllowedPaymentMode": ALL_PAYMENT_MODES,
            "AutoCancelDurationInMinutes": AUTO_CANCEL_MINUTES,
        }));
        let answer = post_json(
            &format!("{}/UploadBilledTransaction", base(ctx).await),
            &body,
        )
        .await?;
        if answer["ResponseCode"].as_i64() != Some(APPROVED) {
            return Err(PosError::Refused(format!(
                "Pine Labs would not send it to the terminal: {}",
                answer["ResponseMessage"]
                    .as_str()
                    .unwrap_or("no reason given")
            )));
        }
        reference_of(&answer)
            .ok_or_else(|| PosError::Refused("Pine Labs named no transaction".to_owned()))
    }

    async fn status(&self, ctx: &Ctx<'_>, reference: &str) -> Result<SaleState, PosError> {
        let k = keys(ctx).await?;
        let body = k.body(json!({ "PlutusTransactionReferenceID": reference }));
        let answer = post_json(
            &format!("{}/GetCloudBasedTxnStatus", base(ctx).await),
            &body,
        )
        .await?;
        Ok(read_status(reference, &answer))
    }

    async fn cancel(&self, ctx: &Ctx<'_>, reference: &str) -> Result<(), PosError> {
        let k = keys(ctx).await?;
        let body = k.body(json!({
            "PlutusTransactionReferenceID": reference,
            "TakeToHomeScreen": true,
            "ConfirmationRequired": false,
        }));
        post_json(&format!("{}/CancelTransaction", base(ctx).await), &body).await?;
        Ok(())
    }

    async fn ping(&self, ctx: &Ctx<'_>) -> Result<(), PosError> {
        keys(ctx).await.map(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::{SaleState, read_status};
    use serde_json::json;

    #[test]
    fn an_approval_carries_the_card_and_the_approval_code() {
        let body = json!({ "ResponseCode": 0, "TransactionData": [
            { "Tag": "Card Number", "Value": "************4242" },
            { "Tag": "ApprovalCode", "Value": "00A1B2" },
            { "Tag": "Amount", "Value": "50000" } ] });
        let SaleState::Approved(a) = read_status("PTR9", &body) else {
            unreachable!("approved")
        };
        assert_eq!(
            (a.reference.as_str(), a.card_last4.as_deref()),
            ("PTR9", Some("4242"))
        );
        assert_eq!(
            (a.auth_code.as_deref(), a.approved_paise),
            (Some("00A1B2"), Some(50_000))
        );
    }

    #[test]
    fn in_progress_waits_and_anything_else_is_a_decline_in_its_words() {
        assert_eq!(
            read_status("P", &json!({ "ResponseCode": 1001 })),
            SaleState::Waiting
        );
        assert_eq!(
            read_status(
                "P",
                &json!({ "ResponseCode": 1, "ResponseMessage": "DECLINED BY BANK" })
            ),
            SaleState::Declined("DECLINED BY BANK".to_owned())
        );
    }
}
