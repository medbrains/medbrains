use std::{fmt, str::FromStr};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// Stable event names for cross-module HMS workflows.
///
/// These strings are intentionally explicit and version-controlled because they
/// drive cascades, NABH evidence sinks, dashboards, default pipelines, and live
/// UI refresh. Add a variant here before emitting a new event from route code.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ClinicalEventName {
    #[serde(rename = "patient.created")]
    PatientCreated,
    #[serde(rename = "patient.merged")]
    PatientMerged,
    #[serde(rename = "visit.created")]
    VisitCreated,
    #[serde(rename = "opd.encounter.created")]
    OpdEncounterCreated,
    #[serde(rename = "order.created")]
    OrderCreated,
    #[serde(rename = "order.cancelled")]
    OrderCancelled,
    #[serde(rename = "lab.order.completed")]
    LabOrderCompleted,
    #[serde(rename = "radiology.order.completed")]
    RadiologyOrderCompleted,
    #[serde(rename = "billing.invoice.created")]
    BillingInvoiceCreated,
    #[serde(rename = "billing.invoice.finalized")]
    BillingInvoiceFinalized,
    #[serde(rename = "billing.payment.received")]
    BillingPaymentReceived,
    #[serde(rename = "pharmacy.order.dispensed")]
    PharmacyOrderDispensed,
    #[serde(rename = "bed.assigned")]
    BedAssigned,
    #[serde(rename = "bed.transferred")]
    BedTransferred,
    #[serde(rename = "ipd.discharge.initiated")]
    IpdDischargeInitiated,
    #[serde(rename = "ipd.discharge.completed")]
    IpdDischargeCompleted,
    #[serde(rename = "quality.incident.reported")]
    QualityIncidentReported,
    #[serde(rename = "emergency.code_blue.activated")]
    EmergencyCodeBlueActivated,
    #[serde(rename = "emergency.code_blue.completed")]
    EmergencyCodeBlueCompleted,
    #[serde(rename = "blood.transfusion_reaction.reported")]
    BloodTransfusionReactionReported,
    #[serde(rename = "bme.equipment_downtime.recorded")]
    BmeEquipmentDowntimeRecorded,
    #[serde(rename = "housekeeping.bmw_disposal.recorded")]
    HousekeepingBmwDisposalRecorded,
}

impl ClinicalEventName {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::PatientCreated => "patient.created",
            Self::PatientMerged => "patient.merged",
            Self::VisitCreated => "visit.created",
            Self::OpdEncounterCreated => "opd.encounter.created",
            Self::OrderCreated => "order.created",
            Self::OrderCancelled => "order.cancelled",
            Self::LabOrderCompleted => "lab.order.completed",
            Self::RadiologyOrderCompleted => "radiology.order.completed",
            Self::BillingInvoiceCreated => "billing.invoice.created",
            Self::BillingInvoiceFinalized => "billing.invoice.finalized",
            Self::BillingPaymentReceived => "billing.payment.received",
            Self::PharmacyOrderDispensed => "pharmacy.order.dispensed",
            Self::BedAssigned => "bed.assigned",
            Self::BedTransferred => "bed.transferred",
            Self::IpdDischargeInitiated => "ipd.discharge.initiated",
            Self::IpdDischargeCompleted => "ipd.discharge.completed",
            Self::QualityIncidentReported => "quality.incident.reported",
            Self::EmergencyCodeBlueActivated => "emergency.code_blue.activated",
            Self::EmergencyCodeBlueCompleted => "emergency.code_blue.completed",
            Self::BloodTransfusionReactionReported => "blood.transfusion_reaction.reported",
            Self::BmeEquipmentDowntimeRecorded => "bme.equipment_downtime.recorded",
            Self::HousekeepingBmwDisposalRecorded => "housekeeping.bmw_disposal.recorded",
        }
    }

    #[must_use]
    pub const fn default_source_module(self) -> ClinicalEventSourceModule {
        match self {
            Self::PatientCreated | Self::PatientMerged => ClinicalEventSourceModule::Patients,
            Self::VisitCreated | Self::OpdEncounterCreated => ClinicalEventSourceModule::Opd,
            Self::OrderCreated | Self::OrderCancelled => ClinicalEventSourceModule::OrderBasket,
            Self::LabOrderCompleted => ClinicalEventSourceModule::Lab,
            Self::RadiologyOrderCompleted => ClinicalEventSourceModule::Radiology,
            Self::BillingInvoiceCreated
            | Self::BillingInvoiceFinalized
            | Self::BillingPaymentReceived => ClinicalEventSourceModule::Billing,
            Self::PharmacyOrderDispensed => ClinicalEventSourceModule::Pharmacy,
            Self::BedAssigned | Self::BedTransferred => ClinicalEventSourceModule::Ipd,
            Self::IpdDischargeInitiated | Self::IpdDischargeCompleted => {
                ClinicalEventSourceModule::Ipd
            }
            Self::QualityIncidentReported => ClinicalEventSourceModule::Quality,
            Self::EmergencyCodeBlueActivated | Self::EmergencyCodeBlueCompleted => {
                ClinicalEventSourceModule::Emergency
            }
            Self::BloodTransfusionReactionReported => ClinicalEventSourceModule::BloodBank,
            Self::BmeEquipmentDowntimeRecorded => ClinicalEventSourceModule::Bme,
            Self::HousekeepingBmwDisposalRecorded => ClinicalEventSourceModule::Housekeeping,
        }
    }

    #[must_use]
    pub const fn required_payload_keys(self) -> &'static [&'static str] {
        match self {
            Self::PatientCreated => &["patient_id"],
            Self::PatientMerged => &["surviving_patient_id", "merged_patient_id"],
            Self::VisitCreated => &["visit_id", "patient_id"],
            Self::OpdEncounterCreated => &["encounter_id", "patient_id"],
            Self::OrderCreated => &["order_id", "order_type", "patient_id"],
            Self::OrderCancelled => &["order_id", "order_type", "reason"],
            Self::LabOrderCompleted => &["order_id", "patient_id"],
            Self::RadiologyOrderCompleted => &["order_id", "patient_id"],
            Self::BillingInvoiceCreated => &["invoice_id", "patient_id", "total_amount"],
            Self::BillingInvoiceFinalized => &["invoice_id", "patient_id"],
            Self::BillingPaymentReceived => &["payment_id", "invoice_id", "patient_id"],
            Self::PharmacyOrderDispensed => &["order_id", "patient_id", "items"],
            Self::BedAssigned => &["bed_id", "admission_id", "patient_id"],
            Self::BedTransferred => &["transfer_id", "admission_id", "from_bed_id", "to_bed_id"],
            Self::IpdDischargeInitiated | Self::IpdDischargeCompleted => {
                &["admission_id", "patient_id"]
            }
            Self::QualityIncidentReported => &["incident_id"],
            Self::EmergencyCodeBlueActivated | Self::EmergencyCodeBlueCompleted => {
                &["code_blue_id"]
            }
            Self::BloodTransfusionReactionReported => {
                &["reaction_id", "transfusion_id", "patient_id"]
            }
            Self::BmeEquipmentDowntimeRecorded => &["downtime_id", "equipment_id"],
            Self::HousekeepingBmwDisposalRecorded => &["disposal_id"],
        }
    }

    #[must_use]
    pub fn missing_payload_keys(self, payload: &Value) -> Vec<&'static str> {
        self.required_payload_keys()
            .iter()
            .copied()
            .filter(|key| payload.get(*key).is_none())
            .collect()
    }
}

impl fmt::Display for ClinicalEventName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for ClinicalEventName {
    type Err = ClinicalEventParseError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "patient.created" => Ok(Self::PatientCreated),
            "patient.merged" => Ok(Self::PatientMerged),
            "visit.created" => Ok(Self::VisitCreated),
            "opd.encounter.created" => Ok(Self::OpdEncounterCreated),
            "order.created" => Ok(Self::OrderCreated),
            "order.cancelled" => Ok(Self::OrderCancelled),
            "lab.order.completed" => Ok(Self::LabOrderCompleted),
            "radiology.order.completed" => Ok(Self::RadiologyOrderCompleted),
            "billing.invoice.created" => Ok(Self::BillingInvoiceCreated),
            "billing.invoice.finalized" => Ok(Self::BillingInvoiceFinalized),
            "billing.payment.received" => Ok(Self::BillingPaymentReceived),
            "pharmacy.order.dispensed" => Ok(Self::PharmacyOrderDispensed),
            "bed.assigned" => Ok(Self::BedAssigned),
            "bed.transferred" => Ok(Self::BedTransferred),
            "ipd.discharge.initiated" => Ok(Self::IpdDischargeInitiated),
            "ipd.discharge.completed" => Ok(Self::IpdDischargeCompleted),
            "quality.incident.reported" => Ok(Self::QualityIncidentReported),
            "emergency.code_blue.activated" => Ok(Self::EmergencyCodeBlueActivated),
            "emergency.code_blue.completed" => Ok(Self::EmergencyCodeBlueCompleted),
            "blood.transfusion_reaction.reported" => Ok(Self::BloodTransfusionReactionReported),
            "bme.equipment_downtime.recorded" => Ok(Self::BmeEquipmentDowntimeRecorded),
            "housekeeping.bmw_disposal.recorded" => Ok(Self::HousekeepingBmwDisposalRecorded),
            other => Err(ClinicalEventParseError {
                value: other.to_owned(),
            }),
        }
    }
}

/// Canonical module identifiers used in event envelopes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ClinicalEventSourceModule {
    #[serde(rename = "patients")]
    Patients,
    #[serde(rename = "opd")]
    Opd,
    #[serde(rename = "order_basket")]
    OrderBasket,
    #[serde(rename = "lab")]
    Lab,
    #[serde(rename = "radiology")]
    Radiology,
    #[serde(rename = "billing")]
    Billing,
    #[serde(rename = "pharmacy")]
    Pharmacy,
    #[serde(rename = "ipd")]
    Ipd,
    #[serde(rename = "quality")]
    Quality,
    #[serde(rename = "emergency")]
    Emergency,
    #[serde(rename = "blood_bank")]
    BloodBank,
    #[serde(rename = "bme")]
    Bme,
    #[serde(rename = "housekeeping")]
    Housekeeping,
    #[serde(rename = "mrd")]
    Mrd,
    #[serde(rename = "integration")]
    Integration,
}

impl ClinicalEventSourceModule {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Patients => "patients",
            Self::Opd => "opd",
            Self::OrderBasket => "order_basket",
            Self::Lab => "lab",
            Self::Radiology => "radiology",
            Self::Billing => "billing",
            Self::Pharmacy => "pharmacy",
            Self::Ipd => "ipd",
            Self::Quality => "quality",
            Self::Emergency => "emergency",
            Self::BloodBank => "blood_bank",
            Self::Bme => "bme",
            Self::Housekeeping => "housekeeping",
            Self::Mrd => "mrd",
            Self::Integration => "integration",
        }
    }
}

impl fmt::Display for ClinicalEventSourceModule {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClinicalEventParseError {
    pub value: String,
}

impl fmt::Display for ClinicalEventParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "unknown clinical event name: {}", self.value)
    }
}

impl std::error::Error for ClinicalEventParseError {}

/// Required metadata envelope for all cross-module clinical/business events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClinicalEventEnvelope {
    pub tenant_id: Uuid,
    pub event_name: ClinicalEventName,
    pub source_module: ClinicalEventSourceModule,
    pub source_record_id: Uuid,
    pub actor_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patient_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admission_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encounter_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub department_id: Option<Uuid>,
    #[serde(default)]
    pub payload: Value,
}

impl ClinicalEventEnvelope {
    #[must_use]
    pub fn new(
        tenant_id: Uuid,
        event_name: ClinicalEventName,
        source_record_id: Uuid,
        actor_id: Uuid,
        payload: Value,
    ) -> Self {
        Self {
            tenant_id,
            event_name,
            source_module: event_name.default_source_module(),
            source_record_id,
            actor_id,
            occurred_at: Utc::now(),
            patient_id: None,
            admission_id: None,
            encounter_id: None,
            department_id: None,
            payload,
        }
    }

    #[must_use]
    pub const fn with_source_module(mut self, source_module: ClinicalEventSourceModule) -> Self {
        self.source_module = source_module;
        self
    }

    #[must_use]
    pub const fn with_patient(mut self, patient_id: Uuid) -> Self {
        self.patient_id = Some(patient_id);
        self
    }

    #[must_use]
    pub const fn with_admission(mut self, admission_id: Uuid) -> Self {
        self.admission_id = Some(admission_id);
        self
    }

    #[must_use]
    pub const fn with_encounter(mut self, encounter_id: Uuid) -> Self {
        self.encounter_id = Some(encounter_id);
        self
    }

    #[must_use]
    pub const fn with_department(mut self, department_id: Uuid) -> Self {
        self.department_id = Some(department_id);
        self
    }

    #[must_use]
    pub fn missing_payload_keys(&self) -> Vec<&'static str> {
        self.event_name.missing_payload_keys(&self.payload)
    }

    #[must_use]
    pub fn payload_is_complete(&self) -> bool {
        self.missing_payload_keys().is_empty()
    }

    #[must_use]
    pub fn idempotency_key(&self) -> String {
        format!(
            "{}:{}:{}",
            self.event_name.as_str(),
            self.source_module.as_str(),
            self.source_record_id
        )
    }
}
