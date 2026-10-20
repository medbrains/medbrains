//! Pine Labs Plutus Cloud: the billed sale is uploaded to the terminal, the
//! patient taps, inserts or scans, and the status call says how it went.
//!
//! Checked against the Plutus Cloud integration spec as summarised in
//! `docs/research-pos-payments-2026-10.md` §2.1 and Odoo's shipping
//! `pos_pine_labs` (`pine_labs_pos_request.py`, `pos_payment_method.py`):
//!   {base}/UploadBilledTransaction → PlutusTransactionReferenceID (PTRID)
//!   {base}/GetCloudBasedTxnStatus  → ResponseCode + ResponseMessage + TransactionData
//!   {base}/CancelTransactionForced → ResponseCode 0 + "APPROVED" when cancelled
//! Every answer is HTTP 200; the outcome is in the body. Codes are reused
//! across outcomes, so only the explicit outcomes below close a sale and
//! anything else keeps it waiting. Plutus has no device-presence call, so a
//! ping only checks the hospital's Pine Labs keys are set.

use async_trait::async_trait;
use serde_json::{Value, json};

use super::{
    Approval, Ctx, PosError, PosProvider, SaleAsk, SaleState, Tender, base_override, post_json,
    tenant_secret,
};

/// A stand-in Plutus for tests (a secret, never a stray environment variable).
pub const API_BASE_OVERRIDE: &str = "PINELABS_API_BASE_OVERRIDE";
const UAT_BASE: &str = "https://www.plutuscloudserviceuat.in:8201/API/CloudBasedIntegration/V1";
const LIVE_BASE: &str = "https://www.plutuscloudservice.in:8201/API/CloudBasedIntegration/V1";
/// `ResponseCode` of an accepted request / an approved sale.
const OK: i64 = 0;
/// `ResponseMessage` of an accepted upload or cancel (Odoo checks both).
const ACCEPTED: &str = "APPROVED";
/// `ResponseMessage` of an approved sale (Odoo matches this exact string).
const TXN_APPROVED: &str = "TXN APPROVED";
/// `ResponseCode` / message of a sale cancelled at the terminal.
const VOIDED: i64 = 1008;
const TXN_VOIDED: &str = "TXN VOIDED";
/// `ResponseCode` of a Plutus timeout.
const PLUTUS_TIMEOUT: i64 = 1006;
/// The message once the terminal's auto-cancel has lapsed.
const AUTO_CANCEL_LAPSED: &str = "INVALID TRANSACTION NUMBER";
/// `AllowedPaymentMode`: 1 card, 10 UPI sale, several pipe-separated as a
/// string (a comma list is refused). 0 (every mode on the terminal) also
/// takes cash and EMI, so it is never sent.
const MODE_CARD: i64 = 1;
const MODE_UPI: i64 = 10;
const MODE_CARD_OR_UPI: &str = "1|10";
/// The terminal's own give-up time; see [`super::ANSWER_WITHIN_SECS`].
const AUTO_CANCEL_MINUTES: i64 = 5;
/// `TransactionData` tags, exact spelling; some clients see the unspaced form.
const TAG_APPROVAL: &str = "ApprovalCode";
const TAG_CARD: [&str; 2] = ["Card Number", "CardNumber"];
const TAG_AMOUNT_PAISE: &str = "AmountInPaisa";
/// Units unknown (request amounts are paise); read only when `AmountInPaisa` is absent.
const TAG_AMOUNT: &str = "Amount";
const TAG_RRN: &str = "RRN";
const TAG_MODE: &str = "PaymentMode";

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

fn tag<'a>(data: &'a Value, names: &[&str]) -> Option<&'a str> {
    let tags = data["TransactionData"].as_array()?;
    names.iter().find_map(|name| {
        tags.iter()
            .find(|t| t["Tag"].as_str() == Some(name))
            .and_then(|t| t["Value"].as_str())
            .map(str::trim)
            .filter(|v| !v.is_empty())
    })
}

fn approval(ptrid: &str, body: &Value) -> Approval {
    let paise = tag(body, &[TAG_AMOUNT_PAISE])
        .or_else(|| tag(body, &[TAG_AMOUNT]))
        .and_then(|a| a.parse().ok());
    Approval {
        reference: ptrid.to_owned(),
        approved_paise: paise,
        card_last4: tag(body, &TAG_CARD).and_then(last4),
        auth_code: tag(body, &[TAG_APPROVAL]).map(ToOwned::to_owned),
        rrn: tag(body, &[TAG_RRN]).map(ToOwned::to_owned),
        method: tag(body, &[TAG_MODE]).map(ToOwned::to_owned),
        payload: body.clone(),
    }
}

/// A Plutus status answer, read. Only an explicit outcome closes the sale:
/// an approval for this PTRID, a void, a Plutus timeout or a lapsed
/// auto-cancel. Every other code or message — 1001 "TXN UPLOADED", the reused 1 / 2
/// codes ("TRANSACTION NOT FOUND", "CANNOT CANCEL AS TRANSACTION IS IN
/// PROGRESS", …) — keeps it waiting, so polling goes on.
pub fn read_status(ptrid: &str, body: &Value) -> SaleState {
    let code = body["ResponseCode"].as_i64();
    let message = body["ResponseMessage"].as_str().unwrap_or_default().trim();
    let echoed = reference_of(body);
    match code {
        // An approval for some other sale is not ours (Odoo: "Reference number mismatched").
        Some(OK) if message == TXN_APPROVED && echoed.as_deref().is_none_or(|r| r == ptrid) => {
            SaleState::Approved(approval(ptrid, body))
        }
        Some(VOIDED) => SaleState::Cancelled,
        _ if message == TXN_VOIDED => SaleState::Cancelled,
        Some(PLUTUS_TIMEOUT) => SaleState::TimedOut,
        _ if message == AUTO_CANCEL_LAPSED => SaleState::TimedOut,
        _ => SaleState::Waiting,
    }
}

/// The `AllowedPaymentMode` for the cashier's choice.
pub fn allowed_mode(tender: Tender) -> Value {
    match tender {
        Tender::Card => json!(MODE_CARD),
        Tender::Upi => json!(MODE_UPI),
        Tender::Either => json!(MODE_CARD_OR_UPI),
    }
}

/// Whether Plutus accepted an upload or a cancel.
fn accepted(answer: &Value) -> bool {
    answer["ResponseCode"].as_i64() == Some(OK)
        && answer["ResponseMessage"].as_str().map(str::trim) == Some(ACCEPTED)
}

fn reason(answer: &Value) -> &str {
    answer["ResponseMessage"]
        .as_str()
        .filter(|m| !m.trim().is_empty())
        .unwrap_or("no reason given")
}

/// The last four digits of a masked card number.
pub(crate) fn last4(masked: &str) -> Option<String> {
    let digits: String = masked.chars().filter(char::is_ascii_digit).collect();
    (digits.len() >= 4).then(|| digits[digits.len() - 4..].to_owned())
}

/// The PTRID as Plutus gave it: a number (Odoo sends it back as received).
fn ptrid(reference: &str) -> Value {
    reference
        .parse::<i64>()
        .map_or_else(|_| json!(reference), |n| json!(n))
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
            "AllowedPaymentMode": allowed_mode(sale.tender),
            "AutoCancelDurationInMinutes": AUTO_CANCEL_MINUTES,
        }));
        let answer = post_json(
            &format!("{}/UploadBilledTransaction", base(ctx).await),
            &body,
        )
        .await?;
        if !accepted(&answer) {
            return Err(PosError::Refused(format!(
                "Pine Labs would not send it to the terminal: {}",
                reason(&answer)
            )));
        }
        reference_of(&answer)
            .ok_or_else(|| PosError::Refused("Pine Labs named no transaction".to_owned()))
    }

    async fn status(&self, ctx: &Ctx<'_>, reference: &str) -> Result<SaleState, PosError> {
        let k = keys(ctx).await?;
        let body = k.body(json!({ "PlutusTransactionReferenceID": ptrid(reference) }));
        let answer = post_json(
            &format!("{}/GetCloudBasedTxnStatus", base(ctx).await),
            &body,
        )
        .await?;
        Ok(read_status(reference, &answer))
    }

    /// The forced cancel Odoo uses: it takes the terminal back to its home
    /// screen. Once the PIN is in, Plutus answers 200 with "CANNOT CANCEL AS
    /// TRANSACTION IS IN PROGRESS" — a refusal, and the sale stays live.
    async fn cancel(
        &self,
        ctx: &Ctx<'_>,
        reference: &str,
        amount_paise: i64,
    ) -> Result<(), PosError> {
        let k = keys(ctx).await?;
        let body = k.body(json!({
            "PlutusTransactionReferenceID": ptrid(reference),
            "Amount": amount_paise,
            "TakeToHomeScreen": true,
            "ConfirmationRequired": true,
        }));
        let answer = post_json(
            &format!("{}/CancelTransactionForced", base(ctx).await),
            &body,
        )
        .await?;
        if accepted(&answer) {
            Ok(())
        } else {
            Err(PosError::Refused(format!(
                "Pine Labs did not cancel it: {}",
                reason(&answer)
            )))
        }
    }

    async fn ping(&self, ctx: &Ctx<'_>) -> Result<(), PosError> {
        keys(ctx).await.map(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::{SaleState, Tender, allowed_mode, read_status};
    use serde_json::json;

    /// An approval as Plutus answers it (spec §2.1 tags, Odoo's exact message).
    #[test]
    fn an_approval_carries_the_card_rrn_mode_and_paise() {
        let body = json!({ "ResponseCode": 0, "ResponseMessage": "TXN APPROVED",
            "PlutusTransactionReferenceID": 7_700_123, "TransactionData": [
            { "Tag": "Card Number", "Value": "************4242" },
            { "Tag": "ApprovalCode", "Value": "00A1B2" },
            { "Tag": "RRN", "Value": "429011223344" },
            { "Tag": "PaymentMode", "Value": "CARD" },
            { "Tag": "Amount", "Value": "500.00" },
            { "Tag": "AmountInPaisa", "Value": "50000" } ] });
        let SaleState::Approved(a) = read_status("7700123", &body) else {
            unreachable!("approved")
        };
        assert_eq!(
            (a.reference.as_str(), a.card_last4.as_deref()),
            ("7700123", Some("4242"))
        );
        assert_eq!(
            (a.auth_code.as_deref(), a.approved_paise),
            (Some("00A1B2"), Some(50_000))
        );
        assert_eq!(
            (a.rrn.as_deref(), a.method.as_deref()),
            (Some("429011223344"), Some("CARD"))
        );
    }

    #[test]
    fn only_explicit_outcomes_close_the_sale() {
        let read = |b: serde_json::Value| read_status("P", &b);
        assert_eq!(
            read(json!({ "ResponseCode": 1001, "ResponseMessage": "TXN UPLOADED" })),
            SaleState::Waiting
        );
        assert_eq!(
            read(json!({ "ResponseCode": 1008, "ResponseMessage": "TXN VOIDED" })),
            SaleState::Cancelled
        );
        assert_eq!(read(json!({ "ResponseCode": 1006 })), SaleState::TimedOut);
        assert_eq!(
            read(json!({ "ResponseCode": 1, "ResponseMessage": "INVALID TRANSACTION NUMBER" })),
            SaleState::TimedOut
        );
    }

    /// Codes are reused across outcomes: none of these may read as a decline.
    #[test]
    fn reused_or_unknown_codes_keep_the_sale_waiting() {
        for body in [
            json!({ "ResponseCode": 1, "ResponseMessage": "TRANSACTION NOT FOUND" }),
            json!({ "ResponseCode": 2, "ResponseMessage": "INVALID PLUTUS TXN REF ID" }),
            json!({ "ResponseCode": 1, "ResponseMessage": "CANNOT CANCEL AS TRANSACTION IS IN PROGRESS" }),
            json!({ "ResponseCode": 1077 }),
            json!({ "ResponseCode": 0, "ResponseMessage": "APPROVED" }),
            json!({ "ResponseCode": 0, "ResponseMessage": "TXN APPROVED",
                    "PlutusTransactionReferenceID": 999 }),
            json!({}),
        ] {
            assert_eq!(read_status("P", &body), SaleState::Waiting, "{body}");
        }
    }

    #[test]
    fn the_allowed_mode_follows_the_cashiers_choice() {
        assert_eq!(allowed_mode(Tender::Card), json!(1));
        assert_eq!(allowed_mode(Tender::Upi), json!(10));
        assert_eq!(allowed_mode(Tender::Either), json!("1|10"));
    }
}
