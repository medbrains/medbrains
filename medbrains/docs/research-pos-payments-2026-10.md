# POS, counter payments, refunds and accounting for MedBrains (India) — research brief

Date: 2026-10-20. This is research only; nothing in the repo was changed.

**Code read:** `/Users/apple/Projects/MedBrains-pos/medbrains`, branch `feature/payments-p4-pos`, HEAD `f59b6603`. Paths below are relative to `medbrains/crates/` unless shown otherwise. Master has none of `pos/`, `settle.rs`, `upi_qr.rs` or `payment_link.rs`; its card-machine settlement is the old outbox handler `medbrains-outbox/src/handlers/pinelabs.rs`.

**Labels used throughout:**
- **VERIFIED**: seen in an official doc or in real third-party source code (Odoo, Care/10BedICU, Eka Care, HyFib).
- **SECONDARY**: from a news or integrator page.
- **INFERRED**: my reasoning, not confirmed by a source.
- **UNKNOWN**: looked for and not found.

**Third-party source used as evidence:** Odoo 18 `addons/pos_pine_labs` and `addons/pos_razorpay`, copied into the scratchpad (`.../scratchpad/odoo/`), and Hyperswitch plus Prism (`.../scratchpad/hs/`).

**Two dated facts to re-check before go-live:**
1. The UPI MDR change: 0.40% above ₹2,000, notified 14 Sep 2026; the start date may slip to 1 Jan 2027.
2. The Income-tax Act, 2025, in force from 1 Apr 2026, has renumbered every income-tax section cited here.

---

## Contents

1. Provider comparison table
2. Per-provider integration detail
3. Integration patterns compared
4. India rules and compliance
5. Corrections to our code (file:line, verified vs unknown)
6. Recommendation: providers, pattern, hardware and credentials
7. Soundbox and customer display — what changes P3
8. Accounting for hospital counter payments
9. Real-world refunds and returns
10. Hyperswitch evaluation
11. Edge-case catalogue
12. Updated build order

---

## 1. Provider comparison

| Provider | Surfaces | Cloud push to terminal | App-to-app (our app on terminal) | Local ECR (PC↔terminal) | Sandbox | Soundbox API | Dynamic QR API | Access | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Pine Labs (Plutus)** | Android & legacy POS, Duo dual-screen, PlutusQR, Plural online PG | **Yes, public spec**: `UploadBilledTransaction` / `GetCloudBasedTxnStatus` / `CancelTransaction(Forced)`, plus a PostBack URL ([spec](https://developer.pinelabs.com/in/instore/cloud-integration)) | Yes: `com.pinelabs.masterapp` Messenger/intent; TransactionType 4001 sale … 6001 settle ([spec](https://developer.pinelabs.com/in/instore/app-integration)) | Yes: COM `PlutusExchange.ExchangeObj`, TCP via the PADController app, Java `PlutusTransport` ([spec](https://developer.pinelabs.com/in/instore/wired-integration)) | UAT host plus a real terminal pointed at UAT | No public API (`IsMQTTDisabled` flag only) | On terminal (`AllowedPaymentMode` 10/11); Plural online has UPI | Merchant account + at least one terminal → Pine Labs emails MerchantID / StoreID / ClientID / SecurityToken ([Odoo doc](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/payment_methods/terminals/pine_labs.html)) | Best-documented. Hosts accept **Indian IPs only**. Owns Mosambee. Supplies many bank-branded terminals (ICICI, AU) |
| **Razorpay POS (Ezetap)** | Android POS (PAX A910S, A99 dual-screen), Dynamic Soundbox, online PG + QR + links | **Yes, not public**: `/api/3.0/p2padapter/{pay,status,cancel}` (Odoo `pos_razorpay`, VERIFIED in code) | Yes: Ezetap AppToApp SDK (see §2.2) | No public option | `demo.ezetap.com` | Dynamic Soundbox takes invoice amount and shows a QR; "API integration", not public ([doc](https://razorpay.com/docs/build/llm-docs/pos/dynamic-soundbox.md)) | **Yes, public**: QR Codes API (on-demand feature) | Razorpay POS sales; appKey + username (device login) + device serial | Same company as our online gateway, so one relationship |
| **Paytm** | Android EDC, Soundbox (+AI soundbox with screen), dynamic QR, PG | **Yes, public**: `/ecr/payment/request`, `/ecr/V2/payment/status` with checksum ([doc](https://www.paytmpayments.com/docs/api/pos-sale-api)); also CPay pull mode | Yes: `com.paytm.pos`, launcher category `com.paytm.edc.launcher`; needs pentest + no-malware letter | USB DLL (wired ECR) | Staging hosts | None. Device "mapped with your Paytm QR" | Yes: `/paymentservices/qr/create`, **enterprise only, customer display required** | Paytm business onboarding + channelId / clientId | Rejects a second request on a busy terminal (`0333`), which matches our one-open-sale index |
| **PhonePe** | EDC / Smart POS, SmartPOD (speaker + card + customer display), SmartSpeaker, DQR | **Yes, public**: `/v1/edc/transaction/init`, with **S2S callback** `X-CALLBACK-URL` and ONE_TO_ONE or OPEN mapping ([doc](https://developer.phonepe.com/offline-integration/integrated-edc-solution/edc-sale-request-api)) | UNKNOWN | UNKNOWN | `mercury-uat.phonepe.com` | None | **Yes, public**: `/v3/qr/init` returns `qrString`; expiry up to 1 month ([doc](https://developer.phonepe.com/offline-integration/dynamic-qr-solution/dqr-init-api)) | PhonePe business; merchantId, storeId, terminalId, salt key | Only cloud-push provider with a documented push callback |
| **Mswipe** | WisePOS (Android), WisePad (BT reader), Boombox soundbox | **Yes, public**: Cloud Connect `/JF/generatetoken`, `/JF/canceltoken` + verification API ([doc](https://docs.mswipe.com/Cloud-Connect-Integration.md)) | Android SDK (reader) | — | UAT hosts | **Partner model**: onboard QRString + VPA; partner POSTs txns with `boomboxdeviceid` | Yes (`generateDynamicQR`) | Developer portal login | Tokens shown on terminal; poll for status |
| **Worldline India** (ex-MRL Posnet) | Bank-branded terminals for ~18 banks | Undocumented `bouat.mrlpay.com/pcpos4/TransactionRequest.php` (AES body) seen in WizApp code | Unconfirmed for India | Yes, per bank | UAT host seen | — | — | Through the bank | **Being sold to BillDesk (Feb 2026, closing H2 2026)** ([PR](https://investors.worldline.com/en/home/news-events/financial-press-releases/2026/pr-2026_02_25_01)). Avoid as a first build |
| **BharatPe** | Swipe (Axis-acquired), Speaker, One | UNKNOWN | UNKNOWN | — | — | None | UNKNOWN | — | No public developer docs |
| **Mosambee** | mPOS / Android | UNKNOWN (docs on request) | `com.mosambee.mpos` | — | — | — | — | Pine Labs group | Use Pine Labs' APIs instead |
| **Innoviti uniPAY** | Bank terminals (e.g. HDFC) | UNKNOWN | — | **Local .NET** `InnovitiPayment.GETPAYMENT` (WizApp code); XML response | — | — | On terminal (txn type 86) | info@innoviti.com | Needs the bridge |
| **Getepay** | PG, POS | UNKNOWN | — | — | — | — | UNKNOWN | — | Nothing public |
| **Cashfree** (comparator) | softPOS, terminals, soundbox | `/pg/terminal/transactions` (QR or link) | — | — | Public sandbox | **Yes, public**: `POST /pg/terminal/soundbox` binds VPA ↔ device serial ([doc](https://www.cashfree.com/docs/api-reference/payments/latest/softpos/onboard-soundbox-vpa)) | Yes | Self-serve | The only public soundbox-binding API found |
| **Juspay / Hyperswitch** | Online orchestration | **No POS** | — | — | sandbox.hyperswitch.io | — | Online UPI QR only | — | See §10 |

**Bank-issued POS (HDFC, ICICI, SBI, Axis):**
- The bank issues the MID. A technology service provider (TSP) runs the device and the switch: Pine Labs, Worldline/MRL, Ezetap, Innoviti or Mosambee.
- ICICI's charges page lists "Pinelabs Platinum APOS" ([ICICI](https://icicibank.com/business-banking/cash-management-services/eazypay-schedule-of-charges)).
- A Pine Labs app-to-app response carries `AcquiringBankCode`: 01 HDFC, 02 ICICI, 05 Axis, 06 SBI.
- **How hospitals integrate (INFERRED):** they ask the bank RM and the TSP to enable that TSP's ECR or cloud integration on the bank MID/TID. A bank-branded Pine Labs terminal can then use Plutus Cloud with credentials Pine Labs issues.
- Our `payment_terminals.provider` (the TSP) plus `acquiring_bank` already model this correctly (`0050_billing.sql:1537-1551`).

---

## 2. Per-provider integration detail

### 2.1 Pine Labs Plutus Cloud (cloud-based ECR) — VERIFIED

**Hosts** ([spec](https://developer.pinelabs.com/in/instore/cloud-integration); Odoo `pine_labs_pos_request.py`):
- UAT: `https://www.plutuscloudserviceuat.in:8201/API/CloudBasedIntegration/V1/`
- Prod: `https://www.plutuscloudservice.in:8201/API/CloudBasedIntegration/V1/`
- POST JSON only. Every answer is **HTTP 200**; the outcome is in `ResponseCode` and `ResponseMessage`. The one exception: a non-numeric `SequenceNumber` returns HTTP 400 ([Eka Care field notes](https://github.com/eka-care/pos-terminal-mock), `docs/pine-labs.md`).
- **India IPs only.** Odoo needs a proxy outside India.

**Auth:** in the body, `MerchantID`, `SecurityToken`, `StoreID` (one billing system, many terminals) and/or `ClientID` (one terminal; needed for zero-click push).
- An older variant uses `IMEI` + `MerchantStorePosCode` (HyFib, WizApp).
- Field-name casing varies between clients (Odoo `StoreID`, Care `Storeid`); the server is probably case-insensitive (INFERRED).

**UploadBilledTransaction request:**
- Mandatory: `TransactionNumber`, `SequenceNumber`, `AllowedPaymentMode`, `Amount` (paise), `MerchantID`, `SecurityToken`.
- `UserID` is marked mandatory in the spec, but Odoo omits it.
- Optional:
  - `AutoCancelDurationInMinutes`
  - `TxnType`: 0 sale, 1 void, 3 refund
  - `OriginalPlutusTransactionReferenceID` (for void / sale-complete)
  - `TransactionId` (the original, for a refund)
  - `IsTipExpected` / `TipAmount`
  - `CustomerMobileNumber`, `CustomerEmailID`
  - GST QR fields: `InvoiceDate`, `Invoicenumber`, `GstIn`, `GstBrkUp`
  - `BankCode`: picks the UPI PSP; 2 HDFC, 4 ICICI, 52 PhonePe QR
  - `IsMQTTDisabled`

**Upload response:** `ResponseCode` 0 + `ResponseMessage` "APPROVED" means uploaded, and returns `PlutusTransactionReferenceID` (PTRID). Odoo checks both fields.

**`AllowedPaymentMode` codes:**

| Code | Mode |
|---|---|
| **0** | All modes enabled on the terminal |
| **1** | Card |
| **10** | UPI Sale (dynamic QR / collect) |
| 11 | UPI Bharat QR |
| 8 | PhonePe |
| 20 | Bank EMI |
| 6 | Brand EMI |
| 23 / 24 | Cardless EMI |
| 27 / 28 | Pre-auth / Sale complete |
| 2 | Cash |

- Several modes are **pipe-separated as a string**, e.g. `"1|10"`. A comma list returns `INVALID PAYMENT MODE RECEIVED`. `0` goes alone (Eka, observed on hardware).

**GetCloudBasedTxnStatus:**
- Request: credentials + PTRID.
- Response: `ResponseCode`, `ResponseMessage`, `TransactionData` as `[{Tag, Value}]`.

| ResponseCode | Message | Meaning / action |
|---|---|---|
| `0` | **"TXN APPROVED"** (Odoo matches this exact string) | Approved |
| `1001` | "TXN UPLOADED" | Keep polling |
| `1006` | — | Plutus timeout → failed |
| `1008` | "TXN VOIDED" | Cancelled at the terminal |
| `1077` | — | Pay-later initiated |
| `1` / `2` | many messages | Declines and invalid requests |

- Messages seen under codes 1/2 include "INVALID PLUTUS TXN REF ID", "TRANSACTION NOT FOUND", "INVALID TRANSACTION NUMBER" (the auto-cancel lapsed) and "CANNOT CANCEL AS TRANSACTION IS IN PROGRESS".
- **Codes are reused across outcomes.** Match on the message, and treat anything unrecognised as pending (Eka).
- Odoo polls every 5 s and force-cancels after 125 s idle. It also rejects an approval whose PTRID differs from the one stored.

**TransactionData tags (exact spelling):**
- No space in the name: `TID`, `MID`, `PaymentMode`, `Amount`, `AmountInPaisa`, `OriginalAmount`, `FinalAmount`, `BatchNumber`, `RRN`, `ApprovalCode`, `TransactionLogId`, `HostTxnId`
- With a space: `Invoice Number`, `Card Number`, `Expiry Date`, `Card Type`, `Card Holder Name`, `Acquirer Id`, `Acquirer Name`, `Transaction Date` (ddMMyyyy), `Transaction Time` (HHmmss)
- UPI and currency: `Customer VPA`, `Currency Type`
- EMI: `EmiTenureMonths`, `EmiAmountInPaise`, `BankEmiTenureMonths`, …
- Accept both spaced and unspaced variants (`CardNumber`, `HostTxnID`, `VPA`, `BankName` are seen in pinelabs_fin).
- **There is no `TipAmount` tag in the status response** (UNKNOWN).

**CancelTransaction:**
- Fields: credentials + PTRID + **`Amount` (paise)**.
- Allowed only while the transaction is open; **after PIN entry the sale cannot be cancelled** (it auto-reverses).

**CancelTransactionForced:** the same fields plus `TakeToHomeScreen`, `ConfirmationRequired`; `ClientID` is mandatory for the terminal to be notified. Odoo uses Forced with `true/true`.

**Void and refund:**
- Void = `UploadBilledTransaction` with `TxnType: 1` + `OriginalPlutusTransactionReferenceID`.
- Refund = `TxnType: 3` + `TransactionId` of the original sale (spec §5.4.12).
- **Both go to the terminal for completion.** What status the terminal reports for a refund has not been observed on hardware (Eka). Treat as UNKNOWN until UAT.

**Settlement:** there is no cloud call. It happens on the terminal (auto batch or manual), or through app-to-app MethodId 1003 / wired TxnType 6001.

**PostBack:** we register a URL with Pine Labs and it POSTs JSON. Keys:
- `ResponseCode`, `PlutusTransactionReferenceID`, `TransactionNumber`
- `BankTID`, `BankMID`, `PaymenMode` (sic)
- `Amount`, `ApprovalCode`, `RRN`, `Invoice`
- `AcquirerName`, `TransactionDate`, `TransactionTime`, `TransactionLogId`, `HostTxnId`

**No signature is described**, so treat a PostBack only as a nudge to re-poll status.

**Gotchas:**
- Re-uploading the same `TransactionNumber` **replaces the live sale**, so use a fresh number per attempt.
- Always send AutoCancel; otherwise the next customer can pay a stale amount.
- Cash taken on the machine (mode 2) never appears in card settlement.

### 2.2 Razorpay POS (Ezetap)

**P2P push API — VERIFIED in Odoo 17/18 `pos_razorpay` source:**
- Demo base `https://demo.ezetap.com/api/3.0/p2padapter/`; live base `https://www.ezetap.com/api/3.0/p2padapter/`.
- Endpoints `pay`, `status`, `cancel`, all POST JSON. Timeout 10 s.

`pay` request:
```json
{"username":"<device login>","appKey":"<api key>","amount":<amount>,
 "externalRefNumber":"<our ref>","mode":"ALL|CARD|UPI|BHARATQR",
 "pushTo":{"deviceId":"<device serial>|ezetap_android"}}
```
- Success when `success == true` and there is no `errorCode`. Returns `p2pRequestId`.

`status` request: `{username, appKey, origP2pRequestId}`.
- **Approved** when `status == "AUTHORIZED"` and `messageCode == "P2P_DEVICE_TXN_DONE"`.
- **Failed** when `status == "FAILED"` or `messageCode == "P2P_DEVICE_CANCELED"`.
- **Waiting** when `messageCode` is `P2P_DEVICE_RECEIVED`, `P2P_DEVICE_SENT` or `P2P_STATUS_QUEUED`.
- Anything else, including `success:false` or an `errorCode`, is an error.
- Approved fields Odoo reads: `authCode`, `cardLastFourDigit`, `externalRefNumber`, **`reverseReferenceNumber`** (RRN), `txnId`, `paymentMode`, `paymentCardType`, `paymentCardBrand`, `nameOnCard`, `acquirerCode`, `createdTime`.

`cancel` request: `{username, appKey, origP2pRequestId, pushTo:{deviceId}}`. Success when `success` is true and there is no `errorCode`.

**Credential fields** (Odoo labels):
- "Device Serial No" (e.g. `7000012300`), used as `{serial}|ezetap_android`
- "Username (Device Login)" (e.g. `1234500121`)
- "API Key"

**Other integrators:** LS Pay and Ginesys describe the same p2padapter with modes CARD / UPI / BHARATQR / ALL and a 180 s timeout (SECONDARY: [LS Pay](https://help.lspay.lsretail.com/Content/Plugins/LS-Pay-PSP-RazorPay.htm)).

**Devices** ([Razorpay docs](https://razorpay.com/docs/build/llm-docs/pos/android-smart-pos.md)): PAX A910S, and PAX A99 including a dual-screen variant.

**Refunds on Razorpay POS** ([doc](https://razorpay.com/docs/pos/refunds.md)): source refunds only (card → same card, UPI → same VPA), 5–7 working days, not after 6 months; MDR and GST on it are not returned.

**Addendum (Odoo master `addons/pos_razorpay`, incl. its tests and JS — VERIFIED):**
- **Void:** `POST {demo|www}.ezetap.com/api/2.0/payment/void` with `{username, appKey, txnId}`. Full amount, unsettled only.
- **Refund:** `POST .../api/2.0/payment/unified/refund` with `{username, appKey, amount, originalTransactionId: <txnId>, externalRefNumber: <new unique ref>}`. Settled only; partial allowed.
- **Which one to call:** Odoo first calls `status` on the original and branches:
  - `AUTHORIZED` + `settlementStatus: SETTLED` → refund.
  - `AUTHORIZED` + `PENDING` → void (Odoo blocks partial: "A partial refund is not allowed because the transaction has not yet been settled").
  - `VOIDED` or `AUTHORIZED_REFUNDED` → refuse.
  - The refund/void answer's `status` is `REFUNDED` or `VOIDED`, with `postingDate`.
- **`amount` is in rupees**, not paise. Odoo's test asserts `"amount": 100`; other integrators send strings like `"700.5"`.
- **Required field:** a missing `externalRefNumber` returns `{"success":false,"errorCode":"EZETAP_0000387"}` (HTTP 200).
- **On approval, check the echo:** Odoo checks that `externalRefNumber` matches what was sent ("Reference number mismatched").
- **`createdTime`** is epoch ms in IST; subtract 19,800,000 for UTC.
- **Other status words:**
  - `status`: `VOIDED`, `AUTHORIZED_REFUNDED`.
  - Pay errors: `P2P_DEVICE_NOT_FOUND` (device not mapped to the API user / PushToPay off) and `DEVICE_NOT_FOUND` (bad serial). SECONDARY: [school integration](https://github.com/SomvanshiTechnologies/ShemfordSchool/blob/main/backend/routes/pos_payments.py).
  - **`P2P_STATUS_IN_EXPIRED` was found nowhere.**
- **Polling (Odoo):** every 10 s; auto-cancel after 90 s idle. `P2P_STATUS_QUEUED` means another sale is occupying the device.
- **Onboarding:** the acquirer or Razorpay must **map each device serial to the API user and enable PushToPay**. Until then every pay call returns `P2P_DEVICE_NOT_FOUND`. `username` is the API user (not the portal login); `appKey` is a UUID from the POS team. No self-serve sandbox.
- **Android SDK** ([ezetap/android-payments-sdk](https://github.com/ezetap/android-payments-sdk)):
  - Pattern: `EzeAPI.*(activity, requestCode, json)` → `onActivityResult`.
  - Methods: `initialize`, `prepareDevice`, `pay` / `performTransaction`, `getTransaction`, `voidTransaction`, `refundTransaction`, `preAuth`, `printReceipt`, `checkForIncompleteTransaction`.
  - Payment modes: Card, UPI, BHARATQR, Brand_EMI / Normal_EMI, …
  - No settlement method.
- **Razorpay POS docs:**
  - POS refunds can also be issued via the standard Refunds API (`/v1/payments/:id/refund`), with multiple partials ([doc](https://razorpay.com/docs/build/llm-docs/pos/refunds/issue.md)). How the Ezetap `txnId` maps to the `pay_` id is UNKNOWN.
  - **POS settles T+1** (online T+2) ([doc](https://razorpay.com/docs/build/llm-docs/pos/settlements.md)).
  - "Not supported for unregistered businesses."

### 2.3 Razorpay QR Codes, Payment Links, Refunds, Settlements, RazorpayX

All VERIFIED in Razorpay docs.

**QR Codes** ([create](https://razorpay.com/docs/api/qr-codes/create/), [webhooks](https://razorpay.com/docs/webhooks/qr-codes/)):
- `POST /v1/payments/qr_codes` with:
  - `type`: `upi_qr` (`bharat_qr` is legacy)
  - `usage`: `single_use` | `multiple_use`
  - `fixed_amount`: must be true for single-use
  - `payment_amount`: paise
  - `close_by`: single-use only; ≥ 2 min ahead; **effective window 2 min–2 h**
  - `customer_id`, `notes` (≤15)
- **Enablement:** an on-demand feature that Razorpay Support activates (`upi_qr.rs:9` is correct).
- Other endpoints: `POST /v1/payments/qr_codes/{id}/close`, `GET …/{id}/payments`.
- Webhooks: `qr_code.created`, `qr_code.credited` (QR + payment), `qr_code.closed`.
  - **`qr_code.closed` fires only on a manual close, not on auto-expiry.** Expire locally from `close_by`.
  - `close_reason`: `on_demand` | `paid`.

**Payment Links** ([create](https://razorpay.com/docs/api/payments/payment-links/create-standard/), [webhooks](https://razorpay.com/docs/webhooks/payment-links/)):
- `POST /v1/payment_links` with:
  - `amount` (≥ 100 paise)
  - `accept_partial` + `first_min_partial_amount`
  - `reference_id` (**unique**, ≤ 40)
  - `expire_by`: ≥ 15 min ahead, ≤ 6 months
  - `customer{name,email,contact}`
  - `notify{sms,email}`: Razorpay sends
  - `reminder_enable`
  - `callback_url` + `callback_method: get`
  - `upi_link`: live only, no partial
- Statuses: `created` / `partially_paid` / `paid` / `expired` / `cancelled`.
- Other endpoints:
  - `POST /v1/payment_links/{id}/cancel`
  - `POST /v1/payment_links/{id}/notify_by/{sms|email}` (resend)
  - `PATCH` (edit)
- Webhooks: `payment_link.paid`, `payment_link.partially_paid`, `payment_link.expired`, `payment_link.cancelled`.

**Refunds** ([create](https://razorpay.com/docs/api/refunds/create-normal/), [instant](https://razorpay.com/docs/payments/refunds/instant/)):
- `POST /v1/payments/{id}/refund` with:
  - `amount` (omit for full)
  - `speed`: `normal` (5–7 working days) | `optimum` (instant, falls back to normal; per-refund fee)
  - `notes`
  - **`receipt` must be unique, so it is an idempotency key**
- Rules:
  - Only captured payments.
  - **Multiple partials** up to the captured amount.
  - No normal refund after **6 months**.
  - Needs balance; blocked during disputes.
- Instant limits: ≤ ₹5 lakh immediate; ₹5L–₹1 cr via NEFT in 3–4 h.
- Statuses: `pending` / `processed` / `failed`. `acquirer_data{arn,rrn,utr}`.
- Webhooks: `refund.created`, `refund.processed`, `refund.failed`, `refund.speed_changed`.

**Settlements** ([API](https://razorpay.com/docs/api/settlements/)):
- `GET /v1/settlements[/{id}]` returns `id`, `amount`, `status`, **`fees`**, **`tax`**, **`utr`**.
- `GET /v1/settlements/recon/combined?year&month[&day]` lists per item:
  - `type` (payment / refund / adjustment), `amount`, `fee`, `tax`
  - `settlement_id`, `settlement_utr`, `payment_id`, `order_id`, `order_receipt`
  - `method`, `card_network`, `card_type`, `dispute_id`
- **This is the import for §8 three-way recon.**
- Online settles T+2, POS T+1; Instant Settlements is on request.

**RazorpayX payouts** (for refunding cash-paid money online):
1. `POST /v1/contacts` (`type: customer`)
2. `POST /v1/fund_accounts` (`account_type: vpa` or `bank_account`)
3. `POST /v1/payouts` with:
   - header **`X-Payout-Idempotency`**
   - `account_number`: our RazorpayX account
   - `amount` (paise), `mode` (`UPI` / `IMPS` / `NEFT`), `purpose: refund`, `reference_id`, `narration` (≤ 30)

- Statuses: `queued` / `pending` / `processing` / `processed` / `reversed` / `failed` / `rejected`, with `utr`.
- Webhooks: `payout.*` ([doc](https://razorpay.com/docs/api/x/payouts/create/vpa/)).
- Needs a separately funded RazorpayX account.
- **Use PG refunds (`speed=optimum`) for money that came through Razorpay; payouts only for cash or out-of-band money.**

### 2.4 Paytm

**EDC cloud Sale — VERIFIED** ([doc](https://www.paytmpayments.com/docs/api/pos-sale-api)):
- `POST {host}/ecr/payment/request`. Staging host `securegw-stage.paytmpayments.in`. Prod `securegw-edc.paytm.in` is SECONDARY ([Ginesys](https://ginesys.atlassian.net/wiki/spaces/PUB/pages/3803054197)).
- `head`: `requestTimeStamp`, `channelId`, `checksum`, `version`.
- `body`: see the table.

| Field | Rule |
|---|---|
| `paytmMid` | 20 chars |
| `paytmTid` | 8 chars |
| `transactionDateTime` | — |
| `merchantTransactionId` | 8–32 chars, alphanumeric, unique |
| `merchantReferenceNo` | — |
| `transactionAmount` | paise |
| `merchantExtendedInfo` | `paymentMode` = `ALL` / `CARD` / `QR`, `autoAccept` |
| `displayInfo` | — |
| `printInfo` | — |
| `gstInformation` | — |

- Response `resultInfo.resultStatus` is `A` (accepted) or `F`. Codes: `0333` (terminal busy), `0233` (duplicate order id), `0330` (bad checksum).

**Status** (`/ecr/V2/payment/status`):
- `resultStatus`: `S`, `F`, `U` (pending), `A`.
- Fields: `retrievalReferenceNo`, `authCode`, `issuerMaskCardNo`, `cardScheme`, `cardType`, `payMethod` (`CREDIT_CARD` / `DEBIT_CARD` / `UPI` / `EMI`), `bankTid`, `bankMid`.
- `event=VOID` voids, **same day only**.
- No callback is documented, so poll.

**CPay mode:** `/edc-integration-service/payment/request` returns a 6-digit code that any terminal on the MID can pull. Status states: `IN_QUEUE`, `PENDING`, `FAILED`, `COMPLETED`, `EXPIRED`, `CANCELLED`.

**App-to-app:** `com.paytm.pos`. Deploying needs a pentest report and a no-malware letter.

**Dynamic QR** ([doc](https://www.paytmpayments.com/docs/api/create-qr-code-api)):
- `POST /paymentservices/qr/create` with `mid`, `orderId`, `amount`, `businessType: UPI_QR_CODE`, `posId` ("Store_POS"), `expiryDate` (default 10 min).
- Returns `qrData` + `image`.
- The S2S callback fires on a final state; Paytm configures the URL.
- **Enterprise-only, and needs a customer-facing display.**

**Soundbox:** "mapped with your Paytm QR"; there is no ISV API ([help](https://business.paytm.com/support/how-does-the-soundbox-work)).

### 2.5 PhonePe

**EDC Sale — VERIFIED** ([doc](https://developer.phonepe.com/offline-integration/integrated-edc-solution/edc-sale-request-api)):
- UAT `https://mercury-uat.phonepe.com/enterprise-sandbox/v1/edc/transaction/init`.
- Prod `https://mercury-t2.phonepe.com/v1/edc/transaction/init`.
- Headers:
  - `X-VERIFY` = SHA256(base64 body + path + salt) + `###` + salt index
  - `X-PROVIDER-ID`
  - `X-CALLBACK-URL`
- Body:
  - `merchantId`, `storeId`, `terminalId`
  - `orderId`, `transactionId` (unique, <40 chars)
  - `integrationMappingType`: `ONE_TO_ONE` or `OPEN`, with `shortOrderId` for OPEN
  - `amount` (paise)
  - `paymentModes` `["CARD","DQR"]`
  - `timeAllowedForHandoverToTerminalSeconds`, `autoAccept`

**DQR** ([doc](https://developer.phonepe.com/offline-integration/dynamic-qr-solution/dqr-init-api)):
- `POST /v3/qr/init` with `merchantId`, `storeId`, `terminalId?`, `transactionId`, `amount` (paise), `expiresIn` (seconds, up to 1 month), and optional `gstBreakup` / `invoiceDetails`.
- Returns `qrString` (`upi://pay?...`).
- Status: `GET /v3/transaction/{mid}/{txnId}/status`.
- [FAQ](https://developer.phonepe.com/offline-integration/faqs/dynamic-qr-flow) rules:
  - A QR cannot be rescanned after an attempt, even a failed one.
  - `transactionId` must be under 35 chars, alphanumeric plus `_`/`-`.
  - Callback statuses: PAYMENT_SUCCESS / FAILED / PENDING / EXPIRED.
  - Still poll as a fallback.

**SmartSpeaker** announces PhonePe QR payments; no API was found.

### 2.6 Mswipe — VERIFIED ([docs.mswipe.com](https://docs.mswipe.com))

**Cloud Connect:**
- `POST {uat.Mswipetech.co.in | ap.Mswipeota.com}/JF/generatetoken` with `amount` (paise, zero-padded), `clientcode`, `txntype` (00 card / 03 UPI), `Mac` (hash with salt), `storeid`, invoice number (unique), optional TID.
- Cancel with `/JF/canceltoken`.
- Verification API returns `RRNO`, `AuthCode`, `Card_Last_Digits`.

**Dynamic QR:** `/MQR/api/Values/generateDynamicQR`, HMAC-signed.

**Boombox:**
- Onboarding takes `QRString` + `VPA`.
- The partner POSTs successful transactions with `boomboxdeviceid`.
- It is AES-GCM encrypted, and built for a Google Pay-style partner rather than as a self-serve API.

### 2.7 Worldline / Innoviti / BharatPe / Mosambee / Getepay

These are summarised in §1. None has a public developer surface usable from a web counter.
- Worldline India's future is uncertain (BillDesk sale).
- Innoviti is local .NET only, so it needs our bridge plus a vendor SDK.

### 2.8 Juspay

Juspay has no POS product. Hyperswitch is online-only (§10).

### 2.9 POS orchestration layers that unify terminals

**None found in India.** Each ERP integrator (Odoo, Ginesys, LS Pay, Zoho, WizApp, Eka Care, HyFib) writes one adapter per TSP. MedBrains' `PosProvider` trait *is* that orchestration layer.

---

## 3. Integration patterns compared (hospital counter, web app)

| | (a) Cloud push server→terminal | (b) App-to-app, our app on an Android POS | (c) Local ECR via our site bridge | (d) Standalone terminal + reconcile by reference | (e) Dynamic QR on our screen + webhook |
|---|---|---|---|---|---|
| Our code today | `pos/pinelabs.rs`, `pos/ezetap.rs`, `pos/sale.rs` | none | `pos/bridge.rs` + `medbrains-bridge/src/card_terminal.rs` (simulator only) | manual payment entry with a typed reference | `upi_qr.rs` (Razorpay) |
| Latency | 1–3 s to reach the terminal, plus 3–5 s polling; PhonePe has a callback | Lowest (on device) | Low on LAN; bridge poll interval (seconds) adds to it | Cashier types it, 10–30 s | 2–10 s webhook; poll fallback |
| Works from a browser | Yes | No: needs an Android app per terminal and vendor app approval (Pine Labs InfoSec + marketplace; Paytm pentest + no-malware letter) | Yes, via the bridge PC | Yes | Yes |
| Failure modes | Provider cloud down; terminal lost its data connection (shows as "uploaded" forever); India-IP restriction; cancel refused after PIN entry | App crash, OS updates, sideload policies, one device = one counter | PC asleep or off, COM port grabbed, driver issues, bridge restart loses in-memory results (`card_terminal.rs` today) | Typo, wrong amount, a slip never entered, duplicate entry | QR left open after another tender; late payment after expiry; payer's UPI app pending |
| Double-charge risk | **Medium**: cancel races approval; a status misread as declined while the terminal is live (our bug, §5) | Low (synchronous) | Medium: a lost result → cashier retries | **High**: nothing links the slip to the bill | Low if single-use + closed on settle; medium if QR not closed |
| Reconciliation | Strong: PTRID / `p2pRequestId` + RRN + batch | Strong | Strong if the bridge reports RRN / batch | Weak: RRN typed by hand | Strong: `qr_code.credited` with payment id + RRN |
| PCI scope | Out of card data (semi-integrated; INFERRED) | Out, unless our app touches card data | Out, if the ECR returns masked data only | Out | SAQ-A-like (no cards) |
| Hardware | Provider terminal with SIM/Wi-Fi | Android smart POS | Wired terminal + PC | Any terminal | Customer-facing screen or tablet (or print) |
| Best for | **Default for card** | Bedside / mobile collection later | Bank terminals with only an ECR (Innoviti, older Worldline) | Fallback only | **Default for UPI** (no MDR ≤ ₹2,000, no hardware) |

**Conclusion:**
- Card: (a) by default, with (c) for bank-ECR-only sites.
- UPI: (e) by default, with on-terminal UPI (a) as an alternative.
- Keep (d) as the explicit fallback with a mandatory RRN/approval-code capture and a reconciliation flag.
- (b) is phase 2+, mainly for bedside collection.

---

## 4. India rules and compliance

1. **Payment Aggregator licence: MedBrains does not need one,** provided each hospital uses its own MID and keys and settlement goes straight to the hospital (INFERRED, strong).
   - RBI Master Direction on PAs (15 Sep 2025) consolidated the 2020/21/23 rules and created **PA-P** (physical), PA-O and PA-CB. Existing PAs had to declare PA-P business by 31 Dec 2025 ([CAM alert](https://www.cyrilshroff.com/wp-content/uploads/2025/10/Client-Alert-RBI-Introduces-Consolidated-Framework-for-Payment-Aggregators-3.pdf), [RBI](https://rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12896)).
   - The licence question returns if we ever pool funds, deduct our fee from settlements, or run a multi-hospital marketplace MID.
   - The Direction allows a **refund to an alternate mode only with the customer's specific consent and only to the same customer's instrument**.
2. **Card tokenisation:** since 1 Oct 2022 only issuers and networks may store card data.
   - A merchant may keep the last 4 digits and the issuer name ([law.asia](https://law.asia/card-on-file-tokenisation-rbi/)).
   - We may keep last4, brand/network, issuer, RRN, auth code, TID/MID, batch, invoice/ROC, provider ids, UTR.
   - **Never** keep the full PAN, expiry date or CVV.
   - Note: Pine Labs returns `Expiry Date` and a masked `Card Number`. **Our raw `payload` storage (`sale.rs:112` → `webhook_payload`) must drop `Expiry Date` and `Card Holder Name`** (INFERRED, conservative).
3. **PCI-DSS scope:**
   - Hosted checkout and links: SAQ A.
   - Semi-integrated patterns (a), (b) and (c), where we send an amount and get masked results, keep MedBrains out of the cardholder-data environment. The exact SAQ (P2PE / B-IP / C) is for the acquirer or a QSA ([TSG](https://tsgpayments.com/a-practical-guide-to-pci-saqs-what-each-version-covers/), INFERRED).
   - Rule: card data and PIN never transit MedBrains or the bridge.
4. **UPI dynamic QR** (NPCI linking spec, [labnol mirror](https://www.labnol.org/files/linking.pdf)):
   - `am` is mandatory in dynamic mode; `tr` is the transaction reference; `mc` is the MCC; `tid` is PSP-generated; signed QR `mode=02`.
   - Do not hand-build merchant QRs; use the PSP's string (NPCI OC-190, [PDF](https://www.npci.org.in/PDF/npci/upi/circular/2024/UPI-OC-190-FY-23-24-Reiteration-of-compliance-to-OC-163-OC-163A-and-OC-100.pdf)).
   - UPI apps show the **CBS-registered payee name** (from 30 Jun 2025).
   - P2P collect ended 1 Oct 2025; P2M collect continues.
   - PSP→NPCI check-status calls are rate-limited (since 31 Jul 2025, SECONDARY), so prefer webhooks.
5. **UPI ₹5 lakh per-transaction limit for hospitals:** verified merchants only. Ask the acquirer to flag the MID ([Business Standard](https://www.business-standard.com/finance/news/npci-directs-members-to-comply-with-rbi-s-upi-transaction-limit-decision-124010200986_1.html)). Store a per-MID UPI limit.
6. **MDR:**
   - **Debit cards:** RBI 2017 caps — 0.40% (cap ₹200) up to ₹20 lakh turnover, else 0.90% (cap ₹1,000) ([RBI](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11183)).
   - **RuPay debit:** 0%.
   - **Credit cards:** ~1.5–2%, negotiated.
   - **UPI:**
     - 0% since 2020, but the **Aug 2026 PSS Act amendment + 14 Sep 2026 notification keep UPI fee-free only ≤ ₹2,000**. Above that, 0.40% capped at ₹300.
     - Hospitals are not on the flat-₹5 sector list.
     - The start date is unresolved: 15 Oct 2026 or 1 Jan 2027 ([MediaNama](https://www.medianama.com/2026/09/223-upi-mdr-rs-2000-threshold/), [ThePrint](https://theprint.in/india/sc-refuses-to-stay-mdr-on-upi-payments-above-rs-2000-issues-notice-to-centre/3055713/), [Inc42](https://inc42.com/buzz/upi-mdr-rollout-may-be-deferred-to-january-2027-amid-pushback-by-retailers/)).
     - Wallet-funded UPI > ₹2,000 carries up to 1.1% interchange.
   - **Design:** an MDR config per mode × amount band × card type × effective date.
7. **GST on MDR = 18%.**
   - Hospital healthcare services are exempt (Notification 12/2017-CT(R) entry 74). In-patient medicines are part of an exempt composite supply; OPD/OTC pharmacy is taxable.
   - So ITC on MDR-GST is **claimable on pharmacy MIDs, common credit under Rule 42 on mixed, and blocked on pure hospital MIDs** ([Rule 42](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter5/rule42_v1.00.html); INFERRED, strong).
   - Tag each MID/terminal with its business line.
8. **Settlement:** typically T+1 (custom per agreement). Pine Labs settlements carry a settlement id, gross, deductions, net and UTR ([doc](https://www.pinelabs.com/docs/online-payments/dashboard/settlements.md)).
9. **Failed transactions:** RBI TAT circular (20 Sep 2019) — card at POS and UPI-to-merchant debited but not confirmed → **auto-reversal by T+5**, with ₹100/day compensation after that ([RBI](https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=11693)).
10. **Voids and refunds on POS:**
    - A void is possible only before batch settlement (full amount, no MDR).
    - After settlement it is a refund (partial allowed; MDR lost).
    - Paytm void is same day with a 00:05 cut-off ([Pine Labs FAQ](https://www.pinelabs.com/faqs)).
11. **MCC:** 8062 hospitals, 8011 doctors, 8071 labs, 5912 pharmacies. In-house pharmacies usually get a separate MID, which helps the GST split.
12. **Cash limits:**
    - **s.269ST** (old numbering): no receipt of ≥ ₹2 lakh in cash from one person per day / per transaction / per event. The penalty equals the amount and falls on the hospital. **There is no hospital exemption** (the COVID relaxation of 2021 expired) ([ITD](https://www.incometaxindia.gov.in/w/section-269st-8)).
    - **Rule 114B:** PAN for bills > ₹2 lakh regardless of mode.
    - **s.269T:** loan-type deposits ≥ ₹20,000 must be repaid electronically. An IPD advance is arguably outside it, but refunding it electronically above a threshold is standard practice.
13. **TDS:**
    - None on MDR or gateway fees (194H exclusion, Notification 56/2012; INFERRED for 194J).
    - **TPAs and insurers deduct 194J at 10%** on hospital claims ([Medi Assist v DCIT](https://itatonline.org/archives/medi-assist-tpa-vs-dcit-karnataka-high-court/)), giving a TDS receivable reconciled to 26AS/AIS.

---

## 5. Corrections to our code (by file and line)

### 5.1 `medbrains-payment-gateway/src/pos/pinelabs.rs`

| Line | Ours | Finding | Status |
|---|---|---|---|
| 23-24 | UAT/LIVE bases | **Correct**: matches Odoo and the spec | VERIFIED |
| 29 | `ALL_PAYMENT_MODES: i64 = 10` with doc "Card and UPI" | **Wrong.** `10` = UPI Sale only, so a card can never be taken. Use `1` for card, `10` for UPI, `"1|10"` (a **string**, pipe-separated) for both, or `0` for all enabled. Make the mode come from the sale (see trait changes). The master outbox handler has the same bug | VERIFIED |
| 31 / 131 | `AutoCancelDurationInMinutes: 5` | Fine (Care 5, Odoo 10, Eka 2) | VERIFIED |
| 33 | `TAG_APPROVAL = "ApprovalCode"` | Correct | VERIFIED |
| 34 | `TAG_CARD = "Card Number"` | Correct (with a space); also accept `CardNumber` | VERIFIED |
| 35 | `TAG_AMOUNT = "Amount"` | The tag exists, but `AmountInPaisa` is unambiguous. Prefer it, falling back to `Amount`. Units of `Amount` are UNKNOWN (Pine Labs request amounts are paise) | partly VERIFIED |
| 40-55 | MerchantID / SecurityToken / ClientID / StoreID all required | Correct field set. ClientID **or** StoreID is enough; require at least one, not both. Also allow the legacy IMEI + MerchantStorePosCode variant (some bank-issued setups) | VERIFIED |
| 89-106 `read_status` | `0` → approved, `1001` → waiting, **anything else → Declined** | **Wrong and dangerous.** Codes are reused; Eka says unknown → pending. Map: `0` + "TXN APPROVED" → Approved; `1001` → Waiting; `1008` / "TXN VOIDED" → Cancelled; `1006` → TimedOut/failed; "INVALID TRANSACTION NUMBER" after auto-cancel → TimedOut; "TRANSACTION NOT FOUND" / "INVALID PLUTUS TXN REF ID" → failed only after the deadline; anything unrecognised → Waiting. As written, one odd code closes the sale as `failed`, `sale.rs:201` stops polling, and a card the patient then approves is **taken but never posted** | VERIFIED (codes) / INFERRED (fix) |
| 91-97 | Approval reads approval code, card, amount | Missing: `RRN`, `PaymentMode` (CARD/UPI/…), `Card Type` (debit/credit → MDR), `Acquirer Name`, `TID`, `MID`, `BatchNumber`, `Invoice Number`, `TransactionLogId` (needed for refund), `Customer VPA`. Also check that the PTRID in the response equals the one asked for (Odoo does) | VERIFIED tags |
| 126-132 | Upload body | Add `UserID` (spec "M"; Odoo omits — test in UAT). `TransactionNumber = txn_id` is fine because every attempt is a new row (one number per attempt), unlike master. `SequenceNumber: 1` is fine for one tender per upload | VERIFIED / UNKNOWN (`UserID`) |
| 138 | Upload success = `ResponseCode == 0` | Also require `ResponseMessage == "APPROVED"` (Odoo) | VERIFIED |
| 161-170 `cancel` | `CancelTransaction` with `TakeToHomeScreen` / `ConfirmationRequired` | **Mixed up.** Those flags belong to `CancelTransactionForced`. `CancelTransaction` takes `Amount` (paise), which we omit. And `post_json` treats any HTTP 200 as success, although Pine Labs always answers 200 — **check `ResponseCode`**. "CANNOT CANCEL AS TRANSACTION IS IN PROGRESS" must surface as "still live", not success | VERIFIED |
| — | no `refund` / `void` | Add: void = Upload with `TxnType: 1` + `OriginalPlutusTransactionReferenceID`; refund = `TxnType: 3` + `TransactionId`. Both complete **on the terminal**, so they need the same start/poll loop as a sale. Terminal answers are UNKNOWN until UAT | VERIFIED request / UNKNOWN response |
| — | no PostBack | Optional: a PostBack URL as a nudge to re-poll (unsigned, so never trusted on its own) | VERIFIED |
| 10-11 ping | keys only | Fine; there is no device-presence call | VERIFIED |

### 5.2 `medbrains-payment-gateway/src/pos/ezetap.rs` (now VERIFIED against Odoo `pos_razorpay`)

| Line | Ours | Finding | Status |
|---|---|---|---|
| 21-22 | `.../api/3.0/p2p` with `/start`, `/status`, `/cancel` | **Wrong path.** It is `.../api/3.0/p2padapter/` with `pay`, `status` and `cancel`. Today's start call would 404 | VERIFIED |
| 24 | `DONE = "P2P_DEVICE_TXN_DONE"` | Correct | VERIFIED |
| 25 | `CANCELED = "P2P_DEVICE_CANCELED"` | Correct (one L) | VERIFIED |
| 26 | `EXPIRED = "P2P_STATUS_IN_EXPIRED"` | Not seen in Odoo. Keep it only as a guess; LS Pay mentions a 180 s timeout | UNKNOWN |
| 27 | `FAILED = "P2P_DEVICE_TXN_FAILED"` | Not seen. Odoo keys failure on **`status == "FAILED"`** regardless of messageCode | VERIFIED (status) / UNKNOWN (code) |
| 29 | `AUTHORIZED` | Correct | VERIFIED |
| 49-57 | deviceId = `terminal_code` as entered | Odoo builds `"{serial}|ezetap_android"` from the bare serial. Either append the suffix or validate it. The screen should ask for "Device serial no." | VERIFIED |
| 67-91 `read_status` | Ignores `success` and `errorCode`; unknown → Waiting | Add: `success == false` or an `errorCode` → error (`PosError::Refused`, or Offline if transient). Waiting only for `P2P_DEVICE_RECEIVED`, `P2P_DEVICE_SENT` and `P2P_STATUS_QUEUED`. `status == "FAILED"` → Declined | VERIFIED |
| 71 | reference = `txnId` | Correct. Also keep `p2pRequestId` (stored as `gateway_order_id`) | VERIFIED |
| 72-74 | `amount` as a float, ×100 | UNKNOWN whether status returns `amount`; Odoo doesn't read it. Keep it optional | UNKNOWN |
| 75-78 | `cardLastFourDigit`, `authCode` | Correct. Add `reverseReferenceNumber` (RRN), `paymentMode`, `paymentCardBrand`, `paymentCardType`, `acquirerCode`, `createdTime` | VERIFIED |
| 99 | `amount` sent as the string `"500.00"` | **Units right (rupees).** Odoo sends a number (`100`), others send strings. Test both in demo; a number is the safer match to Odoo | VERIFIED units / UNKNOWN format |
| 100 | `externalRefNumber` = txn id | Correct (required: `EZETAP_0000387` if missing). On approval, **check it echoes back** (Odoo) | VERIFIED |
| 101 | `mode: "CARD"` hard-coded | Allowed values: `ALL`, `CARD`, `UPI`, `BHARATQR`. Take it from the sale | VERIFIED |
| 105-111 | start success = `success == true` | Also require no `errorCode` | VERIFIED |
| 116-117 | status body `appKey`, `username`, `origP2pRequestId` | Correct | VERIFIED |
| 124-130 | cancel body + `pushTo` | Correct (Odoo sends `pushTo` without `mode`) | VERIFIED |
| — | no refund / void | Add: `status` first (read `settlementStatus`); `PENDING` → `/api/2.0/payment/void {txnId}` (full only); `SETTLED` → `/api/2.0/payment/unified/refund {amount, originalTransactionId, externalRefNumber}` (partial OK). These are synchronous server calls, so no patient at the device, unlike Pine Labs | VERIFIED (Odoo master) |
| 26 | `P2P_STATUS_IN_EXPIRED` | Found nowhere. Drop it, and run our own timer → `cancel` (Odoo: 90 s idle; LS Pay 180 s) | VERIFIED absent |
| 4-9 module doc | "INFERRED … Ginesys" | Update to cite Odoo 17/18 `addons/pos_razorpay` | — |

### 5.3 `pos/undo.rs`, `pos/sale.rs`, `pos/mod.rs`, `settle.rs` (state machine and trait)

- **`undo.rs:56-63` — double-charge bug.** After a cancel, any status other than Approved/Declined (including `Waiting`) is recorded as `cancelled`. Pine Labs refuses a cancel once a PIN is entered ("CANNOT CANCEL AS TRANSACTION IS IN PROGRESS"), and our `cancel` (`pinelabs.rs:161-170`) reports success on any HTTP 200. So the bill shows "cancelled — no money taken" while the terminal is still charging.
  - **Fix:** `Waiting` → keep the sale open ("still at the machine"). Mark it cancelled only on a definite `Cancelled` / `TimedOut`.
  - Separately, a closed `failed`/`expired` sale is never re-polled (`sale.rs:201-203`); `settle_capture` would accept a late approval but nobody asks.
  - **Add:** a sweeper that re-polls `failed`/`expired` cloud sales with code `offline`/`no answer` for 24 h (Pine Labs/Ezetap auto-reverse within T+5 anyway, but a captured one must post).
- **`sale.rs:109` — `method: Some("card")` is hard-coded.** UPI paid on the terminal (Pine Labs `PaymentMode` = UPI, Ezetap `paymentMode`) is booked as card. That puts the wrong clearing account, MDR and day-close bucket. Take the method from the approval.
- **`mod.rs:66-70 SaleAsk`:** add `modes` (card / upi / all / emi).
- **`mod.rs:73-82 Approval`:** add `rrn`, `method`, `card_brand` (network), `card_type` (credit/debit/prepaid — drives MDR), `acquirer`, `tid`, `mid`, `batch_no`, `invoice_no`, `provider_log_id` (Pine Labs `TransactionLogId`, needed for its refund), `emi` (tenure, issuer — optional), `payer_vpa`.
  - **Do not keep** expiry date or cardholder name; strip them from `payload` before storing (`sale.rs:112`, `settle.rs:81`).
- **`mod.rs:117-137 PosProvider`:**
  - **void vs refund.** Split them: `void(reference)` is full-amount, same batch; `refund(reference, amount)` is after settlement. The caller decides by batch state: Pine Labs `BatchNumber` + settled flag; Paytm void same day before 00:05. Both may need the patient at the terminal, so both must return a provider reference and go through the same start → poll → apply loop, not a one-shot `Result<String>` (`mod.rs:124-134`, `undo.rs:73-102`). The refund status must also be pollable: `refund_status(ref)`.
  - **settlement / batch close.** `settle_batch()` returns batch no, count and total per TID. Cloud Pine Labs has none (done on the terminal), so make it optional (`Unsupported`), and let the cashier **enter the terminal's batch total** at day close (§8).
  - **tip.** Hospitals don't take tips. **Skip** (YAGNI); Pine Labs `IsTipExpected` exists if ever needed.
  - **EMI.** Real for large procedures. Enabling it is just a mode (Pine Labs 20/6, Paytm `paymentMode` EMI keys) plus EMI fields in Approval. MDR/subvention comes in the settlement MIS.
  - **card brand.** Add it to Approval (above).
  - **RRN.** Add it to Approval (above). The RRN is the key that reconciliation files match on.
  - **UPI on the terminal.** It is a mode, plus `Approval.method = "upi"`. On Pine Labs pass `BankCode` to pick the PSP if the hospital has several.
  - **status-by-our-ref.** Pine Labs status needs the PTRID; if `start` timed out after Pine Labs accepted it, we have no PTRID. Mitigation: re-upload with a new `TransactionNumber` would replace the live sale (Eka) — **so on an upload timeout, do not retry. Mark it `unknown` and ask the cashier to check the terminal.** Our `send()` marks it `failed/offline` (`sale.rs:355-366`), which invites a second sale.
- **`medbrains-bridge/src/card_terminal.rs:28-51`:**
  - `Outcome::Approved` needs the same fields as `Approval`, and `CardMachine` needs `void`, `refund` and `settle_batch` (Pine Labs wired: 4006, 4002, 6001).
  - Results are retried 5× in memory then dropped (`:170-182`). **Persist them to the bridge's local buffer** (`buffer.rs` already exists) so a restart does not lose an approval.
- **`pos/mod.rs:242-265 post_json`:** Pine Labs answers 200 with errors in the body, and Ezetap answers 200 with `success:false`. That is fine, because each adapter reads its body — but `cancel` doesn't (see above).

### 5.4 `upi_qr.rs`, `payment_link.rs`, refunds in `lib.rs`

- `upi_qr.rs:9`: "on-demand feature Razorpay Support switches on" — see §2.3 for confirmation.
- `upi_qr.rs:26`: a 15-minute `close_by` is fine. The comment "Razorpay allows 2 minutes to 2 hours" (`:23`) is correct. Remember that `qr_code.closed` does **not** fire on auto-expiry.
- `upi_qr.rs:99-109`: `usage: single_use` + `fixed_amount: true` is right.
- **Missing:** close the QR (`POST /v1/payments/qr_codes/{id}/close`) when the bill is paid by another tender or the cashier abandons it. Otherwise a late scan overpays and lands in `payment_webhook_exceptions` as `over_capture` with no auto-refund.
- **Missing:** a local sweep that marks the row `expired` after `close_by`.
- `payment_link.rs:61` `accept_partial:false`, `:65` notify off and reminders off: fine for UHI and delivery. For **IPD deposit top-ups and estimates** consider `accept_partial` + `first_min_partial_amount`. Add `expire_by` (the outbox handler passes `None`, `payment_link.rs:166`). Add a cancel call (`POST /v1/payment_links/{id}/cancel`) when the bill is settled another way.
- `lib.rs:2506-2540` `refund_through_razorpay`:
  - No `speed` (defaults to normal). Add `speed: optimum` as a choice; it carries a fee.
  - **Idempotency correction:** the comment at `lib.rs:2399-2413` says Razorpay refunds take no idempotency key. But **`receipt` must be unique, and a duplicate is rejected** ([doc](https://razorpay.com/docs/api/refunds/create-normal/)). We send a random `rf_{uuid}` each call (`lib.rs:2517`). Derive it from a persisted refund-request id instead. That makes a retry after a timeout safe, and allows the refund to move to the outbox.
  - `refund_id` on the transaction row is overwritten by each partial refund (`settle.rs:388`, `refund_id = $2`). The `refunds` table keeps them all, so this is cosmetic.
  - Non-Razorpay online payments (Cashfree / PhonePe / PayU / CCAvenue) are refunded **through Razorpay with a foreign payment id** — route by `txn.gateway` (§11).

---

## 6. Recommendation

**Build first: two card providers and one UPI path.**

1. **Pine Labs Plutus Cloud** (pattern a). Why:
   - Public spec, plus three open-source hospital-grade references (Odoo, Care/10BedICU, Eka Care).
   - The largest installed base in Indian hospitals, including most bank-branded terminals (ICICI, AU, HDFC through Pine Labs).
   - Card + UPI + EMI on one device; a PostBack exists.
   - Our adapter is 70% there — fix the §5.1 items.
2. **Razorpay POS (Ezetap) p2padapter** (pattern a). Why:
   - Same company as our online gateway, QR and links, so one KYC, one settlement relationship and one recon report.
   - The API shape is now verified from Odoo.
   - The Dynamic Soundbox gives a cheap UPI-with-display counter device.
3. **Razorpay dynamic UPI QR on our own customer display** (pattern e). Why:
   - No terminal needed.
   - Exactly-once settlement already exists (`upi_qr.rs` + `settle.rs`).
   - Zero MDR ≤ ₹2,000.
   - Works at every counter including OPD registration.

**Hold:**
- **Paytm EDC / PhonePe EDC:** add as the third card provider when a hospital already holds them. PhonePe is the cleaner API (callback, OPEN mapping).
- **Worldline:** ownership change. **Innoviti:** local only, via the bridge.
- **App-to-app (b):** later, for bedside or mobile collection.
- **Hyperswitch:** see §10.

**Ask Pine Labs for (per hospital, through the merchant account):**
- MerchantID, SecurityToken, StoreID (multi-terminal) and a ClientID per terminal.
- **UAT access + one terminal configured for UAT.**
- PostBack URL registration.
- Confirmation of: `UserID` handling, refund/void (`TxnType` 1/3) behaviour on cloud, the `Amount` tag units, EMI enablement, which `AllowedPaymentMode` values the TIDs have, and the BankCode for UPI.
- Settlement MIS file format (per TID, daily) and the batch auto-settle time.
- Pine Labs Android (A910-class) or Duo for counters needing a customer screen.
- Whitelisting of our egress IP if they ask. Hosts are India-IP only, so our servers must be in India; for dev, use a proxy in India.

**Ask Razorpay for:**
- POS: device serial(s), device-login username, appKey, demo access (`demo.ezetap.com`) with a demo device.
- POS void/refund API (see §2.2 addendum), settlement report for POS.
- Gateway: **enable the QR Codes feature** (on-demand), webhook secret for `qr_code.credited` / `qr_code.closed` / `refund.*`, Payment Links, Instant Refunds if wanted.
- Optionally RazorpayX payouts, for refunding cash payments online.
- Dynamic Soundbox: its API docs.
- Mark the MID as a verified hospital merchant for the **₹5 lakh UPI limit**.

**Ask the acquiring bank (if a bank POS):** which TSP runs the terminal, and to enable that TSP's cloud/ECR integration on the MID/TID; MCC 8062 (hospital) vs 5912 (pharmacy) on separate MIDs.

---

## 7. Soundbox and customer display — what changes P3

1. **No major soundbox lets a third party push an announcement**: not Paytm, PhonePe, BharatPe or the banks. Each announces the payments its own backend credits to the QR/VPA/terminal it is mapped to. So **"MedBrains drives the soundbox" is not a buildable P3 item** for those providers. Drop it.
2. **What is buildable:**
   - **Cashfree** soundbox: bind VPA ↔ device by API ([doc](https://www.cashfree.com/docs/api-reference/payments/latest/softpos/onboard-soundbox-vpa)).
   - **Mswipe Boombox:** the partner pushes transactions; partner-only.
   - **Razorpay Dynamic Soundbox:** takes the invoice amount and shows the QR. API is private; ask.
   - A soundbox announces a Razorpay QR-API payment only if Razorpay maps it to the same MID/terminal. **Test before promising.**
3. **Never close a bill on an announcement.** Only on the webhook or status. An announcement is UX, not evidence.
4. **Customer display — build our own.** A `/counter-display/{station}` web page on a second monitor or a ₹6–8k Android tablet, subscribed over WebSocket to the counter session. It shows:
   - amount, masked patient name / UHID, the QR (from `upi_qr.rs`) and an expiry countdown;
   - the result, "Paid ₹X — thank you";
   - optionally, our own **browser-generated announcement** (Web Speech API / pre-recorded clip) on the display device. That gives soundbox-like audio for our QR payments with no vendor API. **This replaces "soundbox integration" in P3.**
   - Paytm requires a customer-facing display for its dynamic QR anyway.
5. **Dual-screen POS** (Pine Labs Duo, PAX A99 dual) shows the amount on the terminal's customer side by itself when we cloud-push. Nothing to build. Only app-to-app lets us draw on it (Android Presentation API).
6. **Terminal-rendered QR:** pushing a sale with mode UPI (Pine Labs 10, Paytm `QR`, PhonePe `DQR`, Ezetap `UPI`) makes the terminal itself show a dynamic QR. That is an alternative "customer display" at counters that have a terminal.

---

## 8. Accounting for hospital counter payments

### 8.1 Ledger (INFERRED standard practice; one clearing account per provider × MID)

| Event | Dr | Cr |
|---|---|---|
| Cash receipt | Cash in drawer — counter/shift | Patient receivable (or revenue at billing) |
| Card at POS | **Card clearing — {provider}/{MID}** | Patient receivable |
| UPI QR / link / gateway | **UPI / PG clearing — {provider}/{MID}** | Patient receivable |
| IPD deposit / advance | Cash or clearing | **Patient advances (liability)** |
| Deposit applied to final bill | Patient advances | Patient receivable |
| Settlement credit (provider MIS + bank UTR) | Bank (net) + **MDR expense** + **GST input on MDR** (eligible: pharmacy MID) / **GST on MDR expense** (blocked: hospital MID) / Rule 42 common pool | Clearing (gross) |
| Refund to card/UPI | Patient receivable / advances / sales return | Clearing (netted in next settlement) or Bank |
| Cash refund | Patient advances / receivable | **Cash — the shift that pays it** |
| Chargeback debited | Chargeback receivable (disputed) | Clearing / Bank |
| Chargeback lost / won | Chargeback loss / Bank | Chargeback receivable |
| Round-off | Round-off (Dr/Cr) | Receivable |
| Cash over/short at close | Cash short (exp.) / Cash in drawer | Cash in drawer / Cash over (income) |
| TPA / insurer settlement | Bank + **TDS receivable (194J)** + claim disallowance (write-off or transfer to patient) | TPA receivable |

**Rounding:**
- GST s.170 rounds tax to the nearest rupee ([s.170](https://www.knowyourgst.com/gstlaw/cgst-act/170-rounding-off-of-tax-etc-170/)).
- Invoice-level round-off goes to a Round-off ledger.
- Gateway and terminal amounts are always integer paise. Never round twice (bill round-off ≠ paise conversion).

**TDS:** none on MDR. TPA/insurer 194J at 10% goes to TDS receivable, reconciled to 26AS/AIS.

**Settlement reconciliation (three-way):**
- HMIS receipt (our id, amount, MID/TID, RRN/payment id) ↔ provider transaction (RRN, gross, MDR, GST, net, settlement id) ↔ bank credit (UTR, net).
- Sources:
  - Razorpay settlements API / recon (see §2.3).
  - Pine Labs settlement MIS (per TID, per day; settlement id + UTR; [doc](https://www.pinelabs.com/docs/online-payments/dashboard/settlements.md); MIS itemises MDR, GST and EMI subvention, [Terra](https://www.terra-insight.com/insights/pine-labs-pos-mdr-reconciliation-india/)).
  - Ezetap: the Razorpay POS dashboard report.
- The clearing account must net to zero per settlement id.
- Exceptions: receipt not settled; settled without a receipt (an abandoned counter attempt that the patient actually paid); amount mismatch; MDR different from the configured rate.

**Chargebacks:**
- Card: ~120 days for the cardholder; 30–45 days for the merchant to respond.
- UPI: UDIR / URCS auto-adjudication from 15 Feb 2025 ([Angel One](https://www.angelone.in/news/npci-introduces-new-chargeback-rule-for-upi-transactions)).
- Need: a dispute record (received → evidence → won/lost) with evidence (charge slip, itemised bill, discharge summary, patient ID). **Block refunds while disputed.**

**Our code (pos/p0):**
- `medbrains-billing/src/accounting.rs` is **manual GL only**. `journal_entries` is written only at `:282` and `:425`. No payment, refund, advance or credit note auto-posts.
- There are **no** clearing, MDR, GST-on-MDR, chargeback or round-off accounts.
- Bank auto-reconcile (`accounting.rs:632-680`) matches 1:1 on gross amount, which cannot match net, batched settlements.
- TDS rows are manual (`accounting.rs:694-850`). Insurer TDS is in `medbrains-nhcx-callback/src/payments.rs:5-12`.
- GSTR summary ignores credit notes (`accounting.rs:852-947`).
- Gateway recon is status counts + an exceptions list (`lib.rs:1414-1488`); there is no settlement import.

**Recommended product:**
1. An event → journal posting map (one function per money event, run inside the same transaction as `post_payment` / `post_refund`).
2. Seeded GL accounts: clearing per provider/MID, MDR, GST input (eligible / blocked / common), round-off, cash over/short, chargeback, patient advances, TDS receivable.
3. A settlement import (Razorpay API pull; Pine Labs / Ezetap CSV upload) with a three-way match screen.
4. A MID/terminal "business line" tag (hospital / pharmacy) for GST ITC.

### 8.2 Day close and shifts

**Practice:**
- Expected cash = opening float + cash sales − cash refunds + paid-ins − paid-outs − safe drops.
- The **X report** is a running total; the **Z report** closes and resets the shift.
- Variance needs a reason and permission ([Comarch](https://help.comarch.com/pos/?p=296), [LaunchMyStore](https://launchmystore.help.center/article/1116-pos-shifts-opening-closing-x-and-z-reports)).
- POS: the cashier runs the terminal's **batch settlement** at end of shift/day. The Z report lists card/UPI totals **per TID** and the terminal batch number/total, and compares them with HMIS card totals. Later these are matched to the provider MIS and the bank UTR.

**Indian HMIS (Medeil, Marg, KareXpert, Insta by Practo):** no public documentation on shift close, refund approval or deposit refund was found (UNKNOWN; needs vendor demos). Gofrugal documents strip-wise returns ([link](https://community.gofrugal.com/portal/en/kb/articles/strip-wise-sales-and-sales-return-in-pharmacy-vertical)).

**Our code:**
- **Pharmacy is good:**
  - `medbrains-pharmacy-cash-drawer` drawer open/close with an expected-cash function (`1075_pharmacy_returns_day_close.sql:85-103`).
  - `day_close.rs:226-315` locks the drawers, builds a Z report, refuses on open drawers, and needs a variance reason; reopen needs a permission.
  - Sales and returns are refused on a closed day (`pos_counter.rs:416-456`).
  - Gap: the variance > ₹100 → `variance_pending_signoff` has **no sign-off handler**, and the ₹100 is hard-coded.
- **Billing is weak** (`cash_closing.rs`):
  - One close per cashier per day, not per shift.
  - `expected_cash` ignores cash refunds and advances (`:156`).
  - `refunds_total` is tenant-wide, not per counter (`:190-198`).
  - Closing locks nothing.
  - No verifier ≠ cashier check (`:280-329`).
  - **Gateway, QR and card-machine money is posted with `counter_id: None, shift: None` (`settle.rs:193-194`)**, so it is missing from counter closes and creates false card/UPI variances.
  - No TID batch capture.

**Recommended product:**
- One shared shift/drawer model for billing **and** pharmacy (reuse the pharmacy drawer design).
- Every payment carries `station_id` and `shift_id`. For gateway money, take them from the row that started it: `payment_gateway_transactions.created_by` + terminal station.
- The Z report shows per-tender expected vs counted, per-TID HMIS total vs the cashier-entered terminal batch total + batch no., and cash refunds paid from this drawer.
- The variance sign-off handler: a supervisor, not the cashier.

---

## 9. Real-world refunds and returns

**The rules:**
- **Refund to source.**
  - Visa: refund only to the card used; another card only if the original is unusable; cash/cheque/credit only when neither works ([Visa Q&A](https://eu.review.visa.com/content/dam/VCOM/global/support-legal/documents/new-purchase-return-vbs-10-apr-17.pdf)).
  - RBI PA Direction 2025: an alternate mode needs the customer's specific consent and must be the same customer's instrument.
  - Card/UPI → cash is a **chargeback double-dip** and **money-laundering** risk (card in, cash out). So it is a policy exception, not a cashier choice.
- **Cash → online:** UPI/IMPS payout to a verified account of the payer (cancelled cheque or penny-drop), with proof. Apollo refunds everything by NEFT ([policy](https://www.apolloclinic.com/health-check-packages/refund-cancellation-policy/)); Tata Memorial's NEFT refund form ([PDF](https://tmc.gov.in/PDF/academics/Guidelines/NEFT%20details%20for%20refund.pdf)).

| Scenario | Recommended behaviour (screens + rules) | What we have | Gap |
|---|---|---|---|
| **Card refunded as cash** | Blocked by default. Exception path: reason code (card closed / refund declined), patient's signed consent, approver ≠ requester, threshold. Receipt says "cash in lieu of card refund" | Billing `create_refund` takes any `mode` (`adjustments.rs:232-275`); pharmacy refuses off-tender (`return_rules.rs:174-214`) | Billing has no check; no exception path |
| **Cash refunded online** | "Refund to bank/UPI" form: payee = payer/patient, VPA (validate) or account+IFSC (penny-drop), proof upload; payout via RazorpayX `mode: UPI/IMPS`; status webhook; UTR on the voucher | **None.** RazorpayX is virtual accounts only (`outbox/handlers/razorpayx.rs`) | Build the payouts adapter + screen (P2) |
| **Partial card refund, same day** | Void needs the full amount, so partial → refund. UI offers "Void" only for full + batch open, else "Refund" | `PosProvider::refund` default `Unsupported` (`pos/mod.rs:124-134`); only the simulator refunds | Implement void + refund for Pine Labs (`TxnType` 1/3) and Ezetap |
| **Card refund after settlement** | Refund via provider (terminal or API), MDR lost, partial OK, poll to completion | Same as above | Same |
| **Partial online refund** | Multiple partials up to the captured amount; `speed: optimum` when instant is enabled (fee); show "refund initiated → processed / failed" | `initiate_refund` supports partial and multiple (`lib.rs:2458-2464`), no `speed` | Add `speed`; show refund status from webhooks |
| **Split tender (₹600 card + ₹400 cash), refund ₹500** | Per-tender caps. **Default: electronic first, back to source** (₹500 card, ₹0 cash) — no chargeback exposure; tenant setting for pro-rata (₹300/₹200); cashier may re-allocate within caps; cash only from cash tenders | Pharmacy: pro-rata default + chosen split with caps (`return_rules.rs:125-214`), but card/UPI parts are **book entries with a typed reference**, never executed. Billing: invoice-level cap only, `post_refund` doesn't cap per payment (`posting.rs:195-252`) | Per-payment caps in billing; execute card/UPI parts via provider; make the default a setting |
| **Pharmacy return** | Within N days with the bill; sealed + same batch + not expired → restock; else quarantine; cold-chain / H1 / X / NDPS non-returnable unless a pharmacist overrides (logged, NDPS register entry); loose units only if sold loose; GST credit note for taxable lines | Window 15 days configurable + override (`return_rules.rs:14-48`, `pos_returns.rs:459-473`); cold-chain refused, controlled needs a permission (`pos_returns.rs:511-528`); back to the original batch (`:716-778`); credit note always created (`:594-627`) | **Expired-batch return still adds to `quantity_on_hand`** (`:734`, `:759-762`) → quarantine instead; credit-note number `CN-{sale}-{n}` is not a continuous GST series (`:566-574`) |
| **Credit note vs refund** | Taxable pharmacy lines → GST credit note (Rule 53, ≤16 chars, unique per FY per GSTIN; s.34 deadline 30 Nov next FY); exempt hospital services → refund voucher; credit kept as patient credit is allowed | Billing credit notes have **no GST fields** and **don't reduce the source invoice**, so a credit note + refund can both happen (`adjustments.rs:364-442`) | Make the credit note reduce refundable; GST series |
| **IPD deposit refund at discharge** | Final bill − deposits < 0 → "Refund due" task; refund to source for card/UPI deposits; NEFT/UPI payout for cash deposits ≥ threshold (₹20k default); cash below; approval above a threshold | Refund due shown (`final_bill.rs:70`, `:232`); `refund_advance` writes **no `refunds` row and no posting**, only audit (`advances.rs:424-523`); advances never post a `payments` row (`advances.rs:164-249`) so day close misses them | Route advances and their refunds through posting + day close |
| **Insurance/TPA settles after patient paid** | On claim settlement, compute patient's excess (amount covered and received, net of TDS — don't refund the TDS part until it is in 26AS); create a "patient refund due" liability + task; refund to source | Insurer money settles on the claim (`nhcx-callback/src/payments.rs`); `patient_payable` floored at 0 (`1068:85`) | Nothing flags the refund due |
| **Cancelled test/procedure** | Cancel the charge line → if paid, auto "refund due" with reason code; forfeiture rules shown up front | Item add/remove has **no status guard** on paid bills (`medbrains-billing/src/lib.rs:1033-1130`) | Guard + refund-due flow |
| **Package adjustment** | Recompute package vs itemised; difference → refund due or supplementary bill | — | Not found |
| **Refund to TPA vs patient** | If the TPA overpaid → refund/adjust to the TPA (offset against the next settlement); if the patient overpaid → refund the patient | — | Not found |
| **Approvals and audit** | Maker-checker on every refund; a second approver above a tenant threshold or for an off-source refund; reason-code master; gapless refund-voucher series per counter per FY; immutable audit (requester, approver, payer, instrument, provider refund id / UTR); dispute blocks refund | Write-off and concessions have maker-checker (`credit.rs:537`, `concessions.rs:399-401`); **billing refunds and discounts have none**; `refunds.approved_by` and `processed_by` exist but are never written (0050:1848-1849); no audit trigger on `refunds`; reasons are free text | Add approvals, reason codes, audit |
| **Failure: gateway refund fails** | Stays "failed — action needed"; retry same source, or exception path to the same customer's account with consent; never auto-switch to cash | `refund.failed` → parked (`lib.rs:1301-1328`) | Needs a finance screen action |
| **Failure: double refund (cash + online)** | Lock the per-payment refundable balance when the refund is requested; block a manual refund while an online one is pending | Manual `create_refund` doesn't touch `payment_gateway_transactions.refund_amount`, so the gateway can refund again | Unify refund caps on the payment row |
| **Refund after day close / another shift** | Cash refund belongs to **the shift whose drawer pays it**; card/UPI refunds don't touch the drawer; a closed Z is never edited | Pharmacy does this (`pos_returns.rs:629-644`); billing `refunds` has no counter/shift | Billing refunds need shift_id |

---

## 10. Hyperswitch (Juspay) evaluation

**Facts:**
- Apache-2.0 ([repo](https://github.com/juspay/hyperswitch)), ~45k stars.
- Monthly releases (v1.128.0, 2026-10-16).
- **MSRV 1.92** (ours is 1.85). Run it as Docker images; don't link the crates.

**Deployment:**
- **Self-host:** router, scheduler producer + consumer, drainer, Redis, its own Postgres (Diesel), control centre, and optionally Kafka/ClickHouse/OpenSearch for analytics. There is a Helm chart.
  - The card vault ("Tartarus") is separate. Deploying it puts us in PCI scope. **Don't**: use redirect/SDK flows; RBI CoFT bars storing PANs anyway.
- **Juspay cloud:** sandbox `https://sandbox.hyperswitch.io`; merchant accounts, business profiles, merchant connector accounts, `pk_snd_…` / secret keys.
  - India data residency **is not stated**; get it in writing.
  - Self-host in ap-south-1 satisfies RBI localisation.
  - Pricing is "contact us". Recon, revenue recovery and cost observability are **paid add-ons** on self-host ([pricing](https://hyperswitch.io/pricing)).

**India connectors** (read from source):
- **Main router:**
  - `razorpay`: UPI Collect only, Sandbox status, **no incoming webhooks**. UPI intent/QR is `NotImplemented`.
  - `paytm` and `phonepe`: Alpha stubs.
  - `payu`: cards, no UPI.
  - `hyperpg`.
  - **No** Cashfree, CCAvenue, BillDesk, Easebuzz or Pine Labs.
- **The real India connectors are in Prism / UCS** (`juspay/connector-service`, Apache-2.0), a second gRPC service.
  - Connectors: Razorpay V2, PhonePe, PayU, Easebuzz, Juspay, Cashfree, Paytm, Pine Labs Online.
  - UPI collect/intent/QR is in its matrix, but **Paytm has no refund flow** and Cashfree has no documented authorise. Coverage is marked ⚠/? (young).
- **No POS / terminal / soundbox / counter QR connectors. Hyperswitch is online-only.**
- **No Indian payout connector** (no RazorpayX or Cashfree Payouts).

**Unified API (VERIFIED in `crates/router/src/routes/app.rs`):**
- `POST /payments` (confirm, capture incl. partial, cancel = void, `cancel_post_capture`).
- `/refunds`: multiple partials; `refund_id` = idempotency handle.
- `/payment_link`, `/payouts`, `/disputes`, `/relay`.
- Routing: rule-based, success-rate, elimination, volume split, plus smart retries.
- `GET /payments/{id}?force_sync=true`: poll the connector.
- **Webhooks:** 33 unified events (`payment_succeeded`, `refund_succeeded`, `dispute_opened`, …), HMAC-SHA512 in `X-Webhook-Signature-512`, 16 retries over ~24 h, dedup on `event_id`.
- **Idempotency:** the enforced mechanism is a merchant-supplied `payment_id`/`refund_id` uniqueness check (`DuplicatePayment`). The `Idempotency-Key` header constant exists but is unused.
- **Statuses:** `requires_*`, `processing`, `succeeded`, `failed`, `cancelled`, `partially_captured`, `expired`, `conflicted`; refunds `pending` / `succeeded` / `failed` / `review`.

**Mapping to our code:**

| Ours | With Hyperswitch |
|---|---|
| `razorpay.rs`, Razorpay `create_order` / checkout, webhook verifiers for 5 providers (`lib.rs:1098-2000`), `refund_through_razorpay` | **Replaced** by one adapter + one webhook verifier (`X-Webhook-Signature-512`) |
| `upi_qr.rs` (Razorpay QR API, counter QR) | **Stays**: Hyperswitch's UPI QR is the online checkout `next_action`, routed through a router connector that has QR `NotImplemented` for Razorpay |
| `payment_link.rs` | Could move to `/payment_link`; low value |
| `settle.rs` exactly-once settle, `posting.rs`, parking | **Stays**: Hyperswitch webhooks feed `settle_capture` the same way |
| `pos/` trait + Pine Labs / Ezetap / bridge | **Stays** (no POS in Hyperswitch) |
| Cash, day close, refunds policy, payouts | **Stays** / we build it |

**Migration path (if adopted):**
1. Add `"hyperswitch"` to `provider_spec` so `resolve_active_provider` (`lib.rs:353-371`) can return it.
2. The adapter creates a payment with `payment_id` = our `payment_gateway_transactions.id` (deterministic, so idempotent) and `metadata.tenant_id`.
3. Consume `payment_succeeded` / `payment_failed` / `payment_expired` / `refund_succeeded` / `refund_failed` / `dispute_*`.
4. Verify HMAC-SHA512, dedup on `event_id` into `processed_webhooks`, then call `settle_capture` / `settle_refund` **unchanged**. The conditional `UPDATE … WHERE status NOT IN ('captured','refunded')` still decides exactly once.
5. For the amount, read `amount_received` → `Received::Exactly`.
6. **Tests:** unit-mock at our adapter boundary; a compose profile running the router image + `dummyconnector` for contract tests (nightly, not per PR); real sandbox tests manual.

**Risks:**
- India connector immaturity: today our own Razorpay crate does *more* than Hyperswitch's router Razorpay connector.
- Two extra services + a second Postgres + Redis per install, which is heavy for standalone single-hospital deployments.
- Upgrade churn and v1/v2 API split.
- PCI if the vault is deployed.
- Unconfirmed residency and pricing for the hosted option.

### 10.1 "Can we just rely on Hyperswitch because it is compliance-ready?" — no, not on its own

**The case studies** ([hyperswitch.io/case-studies](https://hyperswitch.io/case-studies), fetched 2026-10-20):
- Zurich (insurance), Flowbird (self-hosted; parking terminals, EU), OpenCommerce, Golf District, a global ticketing platform, a European retailer, Convesio, Bask Health, Narvar, Innago (US ACH).
- **None is Indian.** None mentions UPI, RBI or in-person POS in India.
- The site's badges (PCI DSS 4.0 US/EU, ISO 27001:2022, SOC 2 Type 2) are **about Juspay's hosted service**, not about any merchant.

**Caveats that bite later, when money is actually expected:**
1. **The badges don't transfer to us.**
   - Hosted: Juspay's PCI covers its vault. We still file our own SAQ (A if redirect / SDK).
   - Self-hosted: **we** become responsible for PCI on whatever we run, and fully so if we deploy the card vault.
   - No India data-residency statement for the hosted cloud. RBI's 2018 storage directive needs payment data stored only in India; get this in the contract, or self-host in ap-south-1.
2. **It is not an acquirer or a Payment Aggregator.**
   - Each hospital still onboards and does KYC with each PSP: Razorpay, PhonePe, Cashfree…
   - MDR, settlement (T+1/T+2), chargebacks, refund windows (6 months) and the ₹5 lakh UPI limit all come from the PSP, unchanged.
   - Hyperswitch adds its own fee on top (hosted pricing unpublished).
3. **India connectors are immature.**
   - The main-router Razorpay connector is UPI-collect only, with **no incoming webhooks**, so status depends on polling.
   - Paytm and PhonePe are Alpha stubs.
   - Real coverage needs the separate Prism/UCS service, where Paytm has no refund flow.
   - A payment that succeeds at the PSP but whose status Hyperswitch does not learn shows as pending. That is precisely the "money taken, bill unpaid" failure.
   - **Test every flow we rely on in the sandbox — pay, partial refund, expiry, late success — before switching.**
4. **One more hop in the money path.**
   - Hyperswitch down means no payments, even if Razorpay is up. Its smart retry / routing only helps if a second PSP is configured and onboarded for that hospital.
   - Webhooks become PSP → Hyperswitch → us (16 retries over 24 h). Keep our exactly-once `settle_capture` and our own force-sync poll.
5. **No POS, no soundbox, no counter QR, no Indian payouts.**
   - Card machines, cash, day close, refunds-to-cash and payouts stay ours whatever we choose.
   - About two-thirds of the counter work in this brief is outside Hyperswitch.
6. **Recon is a paid add-on** on self-host, with no documented Indian settlement-file support. Our three-way recon (§8) still needs building, or buying.
7. **Lock-in is moderate.** Apache-2.0 code means we can self-host if Juspay's terms change. But migrating saved mandates or tokens between vaults is not trivial; we hold none today, so this is low risk now.

**Bottom line:**
- Hyperswitch is a reasonable *online* orchestration layer *later*, when a hospital runs two or more online PSPs.
- It is not a compliance shortcut and not a substitute for the counter work.
- If adopted, put it behind the existing gateway seam as one more provider. Keep `settle.rs` as the system of record.

**Verdict:** don't adopt the orchestrator now.
- If multi-PSP is needed, the lighter route is **Prism as a library or sidecar** behind our existing gateway seam (unified connectors, no vault, scheduler or second DB).
- Re-evaluate the full orchestrator only when routing or smart retries are a business need.
- POS stays ours regardless.

---

## 11. Edge-case catalogue

Legend: **Yes** = handled; **Partly**; **No**. Code refs are to the pos worktree.

### Payment outcome

| # | Case | Correct behaviour | Ours |
|---|---|---|---|
| 1 | Gateway/terminal call times out | Unknown, not failed. Poll by our reference; no new attempt until resolved | **Partly.** Cloud POS upload timeout → `failed/offline` (`sale.rs:355-366`), which invites a retry; Pine Labs re-upload with a new number is OK, but the first may be live. Razorpay order: idempotency per row (`lib.rs:736`) |
| 2 | Double tap / two clicks | One open attempt per bill per channel | **Partly.** One open sale per terminal (`uq_pgt_terminal_open`, `sale.rs:307-329`); **two online orders for one bill possible** (`create_order` `lib.rs:502-717`); the second payment is parked `over_capture` |
| 3 | Network drop mid-payment | Same as 1; the terminal finishes on its own; poll/PostBack | **Partly** (`refresh` polls; stops once closed, `sale.rs:201`) |
| 4 | Gateway says failed but money debited | Wait: auto-reversal by T+5; if it later captures, post it | **Yes** for online (`settle.rs:83` accepts failed/expired); **No** for cloud POS after close (not re-polled) |
| 5 | Late success after we marked failed | Post it; if the bill is already paid, park + auto-refund prompt | **Partly.** Posts or parks (`settle.rs:118-144`, `:168-209`); no auto-refund of a parked overpayment |
| 6 | Duplicate webhooks | Dedup by event id + conditional settle | **Yes** (`processed_webhooks` PK, `lib.rs:916-919`; `settle.rs:83`) |
| 7 | Out-of-order webhooks (failed after captured) | Never downgrade captured | **Partly.** Razorpay guarded (`lib.rs:1254-1258`); **Cashfree / PhonePe / PayU / CCAvenue unguarded** (`lib.rs:1645-1649`, `1759-1763`, `1859-1863`, `1978-1982`) |
| 8 | Status read misinterpreted while the terminal is live | Unknown → pending | **No.** Pine Labs `_ => Declined` (`pinelabs.rs:99-105`); cancel treats Waiting as cancelled (`undo.rs:62`) |
| 9 | Partial authorisation (approved < asked) | Post what was approved; balance stays due | **Yes** (`sale.rs:100-105` `Credited`) |
| 10 | Paise rounding | Integer paise end to end; one rupee-rounding at bill | **Partly.** `amount_to_paise` everywhere; Ezetap sends `"500.00"` string — format to verify |
| 11 | Amount changed after QR/link issued | Close the old QR/link; issue a new one | **No.** No close/cancel calls (`upi_qr.rs`, `payment_link.rs`) |
| 12 | Expired QR paid late | Credit settles; if the bill is already paid → park + refund | **Partly.** Settles or parks; no local expiry sweep |
| 13 | Link paid twice | `reference_id` unique + single payment per link | **Yes** (Razorpay rejects duplicates, `payment_link.rs:62`); the second capture is parked |
| 14 | Overpayment | Refuse posting; park; auto-suggest refund to source | **Partly** (`posting.rs:69-84`; parked, no refund action) |
| 15 | Underpayment | Post; leave balance | **Partly.** Virtual-account second credit is **neither posted nor parked** (`lib.rs:865-961`) |
| 16 | Amount mismatch on capture | Park | **Yes** (`settle.rs:138-142`) |
| 17 | UPI on terminal booked as card | Book by the actual method | **No** (`sale.rs:109`) |

### Refunds

| # | Case | Correct behaviour | Ours |
|---|---|---|---|
| 18 | Refund > paid | Refuse, per payment | **Partly.** Gateway yes (`lib.rs:2458-2464`); billing caps per invoice, not per payment (`posting.rs:151-169`) |
| 19 | Refund on a voided sale | Refuse | **Partly** (gateway requires `captured`); no void yet |
| 20 | Void after batch close | Becomes a refund | **No** (no void/refund on terminals) |
| 21 | Refund a split tender | Per-tender caps; policy default | **Partly** (pharmacy yes; billing no) |
| 22 | Cash refund on an online payment | Exception path only | **No** (billing allows freely) |
| 23 | Online refund for a cash payment | Payout to verified VPA/account | **No** |
| 24 | Refund to a closed card/account | Refund fails → finance action → alternate same-customer instrument with consent | **Partly** (parked on `refund.failed`) |
| 25 | Failed refund retry | Retry same source; idempotent by our refund request id (Razorpay `receipt` is unique) | **No** retry action; receipt is random per call (`lib.rs:2517`), so a retry would not be deduplicated |
| 26 | Double refund (manual + gateway) | One refundable balance per payment | **No** (`create_refund` doesn't touch `refund_amount`) |
| 27 | Refund of non-Razorpay online payment | Route by `txn.gateway` | **No** (always Razorpay, `lib.rs:2506`) |
| 28 | Refund while chargeback open | Block | **No** (no disputes) |

### People and timing

| # | Case | Correct behaviour | Ours |
|---|---|---|---|
| 29 | Refund across shifts / after day close | Book into the paying drawer's shift; closed Z immutable | **Partly** (pharmacy yes; billing no shift on refunds, closes lock nothing) |
| 30 | Cashier changes mid-transaction | Sale belongs to its station + starter; new cashier can follow it | **Partly** (sale tied to terminal/station; `created_by`); gateway money posted with no counter/shift (`settle.rs:193-194`) |
| 31 | Terminal offline mid-sale | Keep pending; never "failed" until resolved | **Partly** (`next_step` keeps on Offline until overdue, then Expire with "check the slip") |
| 32 | Bridge PC sleeps / restarts | Results persisted locally; terminal health shown | **Partly** (health via heartbeat; **results lost on restart**, `card_terminal.rs:170-182`) |
| 33 | Two counters charge one bill | Bill row lock + balance check | **Yes** on `posting.rs:52-66`; **No** on bypass writers (`medbrains-pharmacy-payments/src/lib.rs:213-251`, camp, instalments) |
| 34 | Cash + online on the same bill at once | Same lock; the second over-collect is parked | **Yes / Partly** (parked, no refund prompt) |

### Bill state

| # | Case | Correct behaviour | Ours |
|---|---|---|---|
| 35 | Bill edited after payment | Block edits on paid bills, or recompute + refund-due/supplementary | **No** (item add/remove unguarded, `medbrains-billing/src/lib.rs:1033-1130`) |
| 36 | Bill cancelled after payment | Refund first, then cancel | **Yes** (cancel only draft/issued, `lib.rs:1385-1389`) |
| 37 | Discount after payment | Approval → refund due | **No** (discount has no maker-checker, `adjustments.rs:110`, and no refund-due) |
| 38 | Insurance/TPA settles after patient paid | Patient refund due (net of TDS timing) | **No** |
| 39 | IPD deposit > final bill | Refund due task; to source / payout | **Partly** (shown; `refund_advance` not posted) |
| 40 | Package adjustment | Recompute → refund/supplementary | **No** |

### Records and compliance

| # | Case | Correct behaviour | Ours |
|---|---|---|---|
| 41 | Pharmacy return after card-paid bill | Refund on terminal/API to card | **Partly** (book entry with typed reference only) |
| 42 | GST credit-note numbering | Per GSTIN per FY, ≤16 chars, gapless | **No** (`CN-{sale}-{n}`; billing CN no GST) |
| 43 | Receipt reprint | "DUPLICATE", permission + reason, audited | **Yes** (`print-data/src/billing.rs:90-118`) |
| 44 | Tampering | Immutable payments/refunds; audit triggers; no hard delete | **Partly** (audit trigger on `payments`, not `refunds`) |
| 45 | Chargeback after refund | Contest with refund proof | **No** |
| 46 | Settlement ≠ bank credit | Three-way recon, exceptions | **No** (1:1 gross match only) |
| 47 | MDR different from contract | Flag per settlement | **No** |
| 48 | TDS (TPA) | TDS receivable + 26AS recon | **Partly** (manual) |
| 49 | Merchant account switch mid-day | Store MID/key id on each transaction; verify webhooks and refund with the key that took it | **No** (current keys used, `lib.rs:1210`, `:2514`) |
| 50 | Provider downtime → fallback | Offer the next tender (QR ↔ terminal ↔ static QR with RRN capture ↔ cash) | **Partly** (static-UPI fallback `lib.rs:2088-2148`; "take it another way" messages) |
| 51 | ≥ ₹2 lakh cash per payer per day/admission (269ST) | Hard block, aggregated | **No** (not found) |
| 52 | PAN for bills > ₹2 lakh (114B) | Capture PAN / Form 60 | UNKNOWN (not checked) |
| 53 | UPI amount > MID limit (₹1L / ₹5L) | Warn; split or other mode | **No** |
| 54 | Card expiry / name stored in payload | Strip | **No** (raw payload stored) |
| 55 | Webhook for unknown order | Park | **Yes** (`lib.rs:1130-1155`) |
| 56 | Bad webhook signature | 400 + log (park if body parses) | **Partly** (400, not parked) |

---

## 12. Updated build order

1. **Fix live-money bugs in P4 before any terminal goes live:**
   - Pine Labs payment mode (`pinelabs.rs:29`).
   - Pine Labs status mapping, unknown → waiting (`:89-106`).
   - Pine Labs cancel: Forced vs normal, `Amount`, check `ResponseCode` (`:161-170`).
   - `undo.rs:62`: Waiting ≠ cancelled.
   - Ezetap path `p2padapter/pay` + success/errorCode handling + deviceId suffix (`ezetap.rs:21-22`, `:49-57`, `:67-91`).
   - Method from the approval, not `"card"` (`sale.rs:109`).
   - Upload timeout → unknown, not failed (`sale.rs:355-366`).
   - Strip expiry and name from payloads.
   - Guard the four unguarded failed-webhook updates.
   - Refund routing by `txn.gateway`.
2. **Trait v2:** `SaleAsk.modes`; `Approval` + rrn / method / brand / card_type / tid / mid / batch / invoice / log_id; `void` / `refund` as pollable operations; optional `settle_batch`; bridge `CardMachine` parity + persisted results. Then UAT on a real Pine Labs terminal and an Ezetap demo device.
3. **Counter attribution + shift model for billing:** station / shift on every payment, including gateway and POS money; a shared drawer design with pharmacy; a Z report with per-TID batch entry; a variance sign-off handler.
4. **QR / link hygiene:** close the QR or cancel the link when the bill is settled another way; local expiry sweep; the customer-display page (WebSocket) with browser audio. **This replaces soundbox integration in P3.**
5. **Refund engine:**
   - per-payment refundable balance shared by manual and gateway refunds;
   - refund-to-source default;
   - split-tender policy setting;
   - exception path (cash ↔ online) with consent + maker-checker + thresholds + reason codes;
   - refund voucher series;
   - audit trigger on `refunds`;
   - `speed` option;
   - failed-refund retry screen.
6. **Advances and deposits through posting** (payments + refunds rows, day close), refund-due tasks (IPD excess, TPA after patient paid, cancelled services, package adjustments), and paid-bill edit guard.
7. **Payouts adapter** (RazorpayX: contacts → fund accounts (VPA / bank) → payouts with an idempotency header) for cash-paid refunds and deposit refunds.
8. **Accounting:** automatic journal postings per money event; seeded clearing / MDR / GST-ITC / round-off / over-short / chargeback / TDS accounts; MID business-line tag; settlement import (Razorpay API, Pine Labs / Ezetap MIS) with a three-way recon screen; MDR rate config with effective dates (UPI > ₹2,000 change).
9. **Compliance guards:** 269ST cash aggregation per payer per day + admission; PAN capture > ₹2 lakh; UPI per-MID limit; GST credit-note series (≤16 chars, per GSTIN per FY, 30 Nov cutoff); expired-batch return → quarantine (`pos_returns.rs:734`).
10. **Disputes / chargebacks:** a record, evidence pack and refund block.
11. **Third card provider** (PhonePe EDC, then Paytm) as hospitals ask. App-to-app (b) for bedside collection. Re-evaluate Hyperswitch/Prism when multi-PSP routing is a real need.
