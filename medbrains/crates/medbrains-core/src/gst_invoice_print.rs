//! A GST invoice as printed. When its lines are medicines it is also the
//! pharmacy bill, which the Drugs and Cosmetics Rules and GST ask more of:
//! batch and expiry per line, the prescriber and pharmacist, the drug
//! licence, the patient's address for Schedule H1 and X, MRP and what the
//! patient saved, and tax split into CGST and SGST.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GstInvoicePrintData {
    pub invoice_number: String,
    pub patient_name: String,
    pub uhid: String,
    pub subtotal: String,
    pub tax_amount: String,
    pub total_amount: String,
    pub hospital_gstin: Option<String>,
    pub hospital_name: Option<String>,
    pub hospital_address: Option<String>,
    pub items: Vec<GstInvoiceItemLine>,
    pub date: String,
    /// Any line is a medicine: print it as a pharmacy bill.
    pub is_pharmacy: bool,
    pub patient_phone: Option<String>,
    /// Shown when a Schedule H1 or X drug is on the bill.
    pub patient_address: Option<String>,
    pub prescriber_name: Option<String>,
    pub prescriber_registration: Option<String>,
    pub pharmacist_name: Option<String>,
    pub pharmacist_registration: Option<String>,
    /// The pharmacy's drug licence numbers (Form 20/21), as the hospital set them.
    pub drug_licence: Option<String>,
    pub cgst_total: String,
    pub sgst_total: String,
    /// Sum of MRP × quantity over medicine lines; none without MRPs.
    pub mrp_total: Option<String>,
    /// MRP total less what was billed, when positive.
    pub savings: Option<String>,
    pub paid_amount: String,
    pub balance_due: String,
    /// The prescription's last valid day and refills left, for a dispensed Rx.
    pub rx_valid_until: Option<String>,
    pub refills_left: Option<i32>,
    /// Schedules on the bill (e.g. "H", "H1", "X"), for their printed warnings.
    pub schedules: Vec<String>,
    /// `upi://pay` link for the balance, when the hospital has a UPI ID.
    pub upi_link: Option<String>,
    /// Public page that confirms this bill is genuine.
    pub verify_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct GstInvoiceItemLine {
    pub description: String,
    pub hsn_code: Option<String>,
    pub quantity: i32,
    pub unit_price: String,
    pub tax_percent: String,
    pub total_price: String,
    pub generic_name: Option<String>,
    pub schedule: Option<String>,
    pub manufacturer: Option<String>,
    pub batch_number: Option<String>,
    /// "MM/YY", as packs print it.
    pub expiry: Option<String>,
    pub mrp: Option<String>,
    pub discount_amount: String,
    pub cgst_amount: String,
    pub sgst_amount: String,
}
