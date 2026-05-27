# External Business API Integration Backlog

Source check date: 2026-05-25.

This is a future implementation backlog. Do not wire these connectors directly into billing,
front-office, CRM, or communication screens. Build them behind a connector registry, encrypted
credential vault, webhook inbox, replay queue, field mapper, and feature flags.

## Integration Backbone

- Connector registry: provider, environment, tenant/facility scope, enabled modules, API version, auth mode, webhook status, last health check.
- Credential handling: OAuth token store, API keys, certificate/mTLS support where needed, rotation schedule, least-privilege scopes, secret redaction in logs.
- Sync primitives: idempotency key, external id mapping table, cursor/watermark, retry policy, dead-letter/quarantine, manual replay, conflict resolution, and immutable sync audit.
- Data governance: PHI minimization, field-level masking, patient-consent check where applicable, export reason, user/facility attribution, and retention policy.
- Adapter contract: `push_invoice`, `push_payment`, `push_refund`, `sync_customer`, `sync_vendor`, `sync_item`, `receive_webhook`, `reconcile_status`, `test_connection`.

## P0 Accounting And ERP

### TallyPrime

- API family: XML over HTTP with an `ENVELOPE` request/response structure.
- MedBrains use: push ledgers, vouchers, sales invoices, receipts, refunds, GST tax split, journal entries, vendor bills, store purchases, and stock movement summaries.
- Implementation note: most hospitals will run Tally on LAN, so use a local bridge agent instead of exposing Tally directly to the cloud.

### QuickBooks Online

- API family: REST/JSON Accounting API with OAuth and company `realmID`.
- Core entities: Customer, Item, Invoice, Payment, CreditMemo, RefundReceipt, JournalEntry, Account, TaxCode.
- Invoice shape to map: QuickBooks invoice create requires `CustomerRef` and at least one `Line`; invoice lines carry item/detail, amount, tax, and linked transaction state.
- MedBrains use: push invoices/payments/refunds/credit notes, map departments/classes, reconcile external payment status, and pull accounting ids back into billing audit.

### Zoho Books / Indian ERP Adapters

- Verify exact active API versions before implementation.
- Keep the same accounting adapter contract so hospitals can choose Tally, QuickBooks, Zoho Books, SAP Business One, or a custom ERP without rewriting billing.

## P0 CRM And Front Office

### Zoho CRM

- API family: CRM V8 REST APIs under `{api-domain}/crm/{version}/{module_api_name}` with OAuth scopes such as `ZohoCRM.modules.{module}.{operation}`.
- Core modules: Leads, Contacts, Accounts, Deals, Tasks, Calls, Cases, Appointments, Sales Orders, Purchase Orders, Invoices, and custom modules.
- MedBrains use: lead/referral capture, corporate/TPA account sync, campaign source tracking, call-task follow-up, patient inquiry conversion, and outreach/camp CRM handoff.

### Salesforce

- API family: REST API under `/services/data/vXX.0`, sObject CRUD endpoints, SOQL query resource, composite APIs, and Bulk API for large sync.
- Core objects: Lead, Account, Contact, Opportunity, Case, Task, Event, Campaign, and custom objects.
- MedBrains use: enterprise hospital sales/referral pipeline, corporate client sync, payer/TPA relationship management, high-value case follow-up, and support-ticket sync.

## P0 Messaging And Communication

### WhatsApp Business Platform

- API family: Meta Cloud API or approved BSP adapters.
- Required concepts: approved templates for business-initiated messages, 24-hour customer service window, inbound message webhooks, delivery/read/failure status webhooks, opt-in/opt-out tracking.
- MedBrains use: appointment reminders, OPD token updates, lab/radiology result notifications, payment links, discharge follow-up, campaign/camp outreach, and patient support conversations.

### Twilio

- API family: Programmable Messaging REST API with inbound message webhooks and outbound status callbacks; WhatsApp is exposed through the same messaging model.
- MedBrains use: SMS/WhatsApp fallback provider, delivery tracking, inbound support messages, and failover routing.

### Gupshup / Exotel / MSG91

- API family: India-friendly CPaaS/BSP adapters for WhatsApp, SMS, email, and voice. Gupshup template sends use provider message ids and delivery webhooks.
- MedBrains use: local WhatsApp/SMS provider choice, campaign delivery, appointment reminders, payment collection nudges, missed-call/IVR callback flows, and voice call logs.

### Stalwart Mail Server

- API/protocol family: self-hosted mail and collaboration server with SMTP, IMAP, POP3, JMAP, WebDAV/CalDAV/CardDAV, WebAdmin, JMAP management objects, queues, DKIM/SPF/DMARC/TLS reporting, autoconfig/autodiscover, and webhooks.
- MedBrains use: tenant-owned hospital mail domains, staff/user mailbox provisioning, notification email relay for `comm_messages.channel=email`, doctor/nurse/front-office mailbox aliases, department shared addresses, inbound reply ingestion, critical alert inbox routing, and audit-friendly delivery tracing.
- Integration shape: add a `stalwart` provider to the existing email outbox handler instead of replacing `comm_messages`. Provision domains/accounts/aliases through Stalwart JMAP management or `stalwart-cli` plans; send transactional notifications through SMTP/JMAP submission; receive delivery/inbound events through Stalwart webhooks into the connector webhook inbox.
- Admin setup UI: domain wizard, DNS readiness checklist, DKIM rotation status, MX/SPF/DMARC/MTA-STS/TLS-RPT validation, mailbox quota defaults, department/shared mailbox aliases, app-password/API-key rotation, test send, queue health, and failed delivery replay.
- Security and compliance: keep PHI-minimized templates by default, require explicit patient consent/communication preference checks, encrypt stored connector credentials, avoid logging message bodies unless explicitly retained, support mailbox disable/suspend on staff exit, and retain delivery/audit evidence for critical clinical and billing notifications.
- Deployment note: prefer Stalwart as an optional hospital-managed connector. Cloud SaaS tenants may continue to use SendGrid/SES/CPaaS email while hospitals needing owned domains and mailboxes can enable Stalwart per tenant/facility.

## P0 Payments And Reconciliation

### Razorpay

- API family: REST/JSON under `https://api.razorpay.com/v1` plus webhooks for payment-flow events.
- MedBrains use: payment links, orders, payments, refunds, settlements, disputes, webhook replay, day-close reconciliation, and invoice/payment status matching.

### Other India Payment Providers

- Verify current APIs before coding: PayU, Cashfree, PhonePe PG, Pine Labs/Plutus POS, BharatPe, UPI collect, BBPS where applicable.
- Keep all provider integrations behind the payment adapter contract and never store card data in MedBrains.

## Implementation Tickets

- [ ] Create external connector registry tables and encrypted credential storage.
- [ ] Create webhook inbox with signature verification, replay, quarantine, and event-id idempotency.
- [ ] Create external id mapping for patient/customer, corporate/account, invoice, payment, refund, item, department/class, and ledger/account.
- [ ] Build Tally bridge-agent connector for XML-over-HTTP import/export.
- [ ] Build QuickBooks Online connector for Customer, Item, Invoice, Payment, CreditMemo/RefundReceipt, JournalEntry, and TaxCode mapping.
- [ ] Build CRM connector abstraction with Zoho CRM and Salesforce adapters.
- [ ] Build messaging connector abstraction with Meta WhatsApp Cloud API, Twilio, Gupshup, Exotel, and MSG91 adapters.
- [ ] Build Stalwart connector for hospital mail domains, staff mailbox provisioning, aliases/shared mailboxes, outbound notification email, inbound reply/delivery webhooks, queue health, and DNS/DKIM/DMARC readiness.
- [ ] Build payment connector abstraction with Razorpay first, then PayU/Cashfree/PhonePe/POS adapters.
- [ ] Add admin UI for connector setup, connection test, mapping, health, webhook logs, replay, and sync audit.
- [ ] Add permissions: `integrations.connectors.view/manage`, `integrations.credentials.rotate`, `integrations.webhooks.view/replay`, `integrations.mappings.manage`, `integrations.exports.approve`.

## Official Source Pointers

- TallyPrime XML integration: https://help.tallysolutions.com/xml-interface/
- TallyPrime integration prerequisites: https://help.tallysolutions.com/pre-requisites-for-integrations/
- QuickBooks Online Accounting API: https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api
- QuickBooks Invoice API: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/Invoice
- Zoho CRM V8 Records API: https://www.zoho.com/crm/developer/docs/api/v8/get-records.html
- Zoho CRM V8 API references: https://www.zoho.com/crm/developer/docs/api/v8/api-references.html
- Salesforce Platform REST API overview: https://developer.salesforce.com/blogs/2024/04/accessing-object-data-with-salesforce-platform-apis
- Twilio WhatsApp overview: https://www.twilio.com/docs/whatsapp/api
- Twilio messaging webhooks: https://www.twilio.com/docs/usage/webhooks/messaging-webhooks
- Gupshup WhatsApp templates: https://docs.gupshup.io/docs/template-messages
- Gupshup webhooks: https://docs.gupshup.io/docs/webhooks-2
- Stalwart Mail Server overview: https://stalw.art/mail-server/
- Stalwart HTTP/JMAP/API overview: https://stalw.art/docs/http/
- Stalwart management schema reference: https://stalw.art/docs/ref/
- Razorpay API reference: https://razorpay.com/docs/api/
- Razorpay webhooks: https://razorpay.com/docs/webhooks/?preferred-country=IN
