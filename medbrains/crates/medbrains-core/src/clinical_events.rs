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
    #[serde(rename = "patient.updated")]
    PatientUpdated,
    #[serde(rename = "patient.merged")]
    PatientMerged,
    #[serde(rename = "patient.access_shared")]
    PatientAccessShared,
    #[serde(rename = "patient.card_printed")]
    PatientCardPrinted,
    #[serde(rename = "patient.search.completed")]
    PatientSearchCompleted,
    #[serde(rename = "visit.created")]
    VisitCreated,
    #[serde(rename = "emergency.visit.created")]
    EmergencyVisitCreated,
    #[serde(rename = "mlc.created")]
    MlcCreated,
    #[serde(rename = "emergency.mlc_police_intimation.created")]
    EmergencyMlcPoliceIntimationCreated,
    #[serde(rename = "opd.encounter.created")]
    OpdEncounterCreated,
    #[serde(rename = "opd.queue.called")]
    OpdQueueCalled,
    #[serde(rename = "opd.consultation.started")]
    OpdConsultationStarted,
    #[serde(rename = "opd.vitals.recorded")]
    OpdVitalsRecorded,
    #[serde(rename = "opd.consultation.saved")]
    OpdConsultationSaved,
    #[serde(rename = "opd.encounter.completed")]
    OpdEncounterCompleted,
    #[serde(rename = "opd.followup.scheduled")]
    OpdFollowupScheduled,
    #[serde(rename = "opd.prescription.updated")]
    OpdPrescriptionUpdated,
    #[serde(rename = "opd.certificate.created")]
    OpdCertificateCreated,
    #[serde(rename = "opd.consent.signed")]
    OpdConsentSigned,
    #[serde(rename = "camp.started")]
    CampStarted,
    #[serde(rename = "camp.registration.created")]
    CampRegistrationCreated,
    #[serde(rename = "camp.screening.completed")]
    CampScreeningCompleted,
    #[serde(rename = "order.created")]
    OrderCreated,
    #[serde(rename = "order.cancelled")]
    OrderCancelled,
    #[serde(rename = "lab.order.completed")]
    LabOrderCompleted,
    #[serde(rename = "lab.sample_collected")]
    LabSampleCollected,
    #[serde(rename = "lab.result.posted")]
    LabResultPosted,
    #[serde(rename = "lab.result.verified")]
    LabResultVerified,
    #[serde(rename = "radiology.order.completed")]
    RadiologyOrderCompleted,
    #[serde(rename = "radiology.report.created")]
    RadiologyReportCreated,
    #[serde(rename = "radiology.report.verified")]
    RadiologyReportVerified,
    #[serde(rename = "billing.invoice.created")]
    BillingInvoiceCreated,
    #[serde(rename = "billing.invoice.finalized")]
    BillingInvoiceFinalized,
    #[serde(rename = "billing.payment.received")]
    BillingPaymentReceived,
    #[serde(rename = "pharmacy.order.dispensed")]
    PharmacyOrderDispensed,
    #[serde(rename = "pharmacy.prescription.reviewed")]
    PharmacyPrescriptionReviewed,
    #[serde(rename = "pharmacy.stock.movement.created")]
    PharmacyStockMovementCreated,
    #[serde(rename = "pharmacy.ndps.movement.created")]
    PharmacyNdpsMovementCreated,
    #[serde(rename = "indent.requisition.submitted")]
    IndentRequisitionSubmitted,
    #[serde(rename = "indent.requisition.approved")]
    IndentRequisitionApproved,
    #[serde(rename = "indent.requisition.issued")]
    IndentRequisitionIssued,
    #[serde(rename = "ipd.admission.created")]
    IpdAdmissionCreated,
    #[serde(rename = "bed.assigned")]
    BedAssigned,
    #[serde(rename = "bed.transferred")]
    BedTransferred,
    #[serde(rename = "ipd.discharge.initiated")]
    IpdDischargeInitiated,
    #[serde(rename = "ipd.discharge.completed")]
    IpdDischargeCompleted,
    #[serde(rename = "ipd.discharge.finalized")]
    IpdDischargeFinalized,
    #[serde(rename = "mrd.case_sheet.generated")]
    MrdCaseSheetGenerated,
    #[serde(rename = "mrd.case_sheet.printed")]
    MrdCaseSheetPrinted,
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
            Self::PatientUpdated => "patient.updated",
            Self::PatientMerged => "patient.merged",
            Self::PatientAccessShared => "patient.access_shared",
            Self::PatientCardPrinted => "patient.card_printed",
            Self::PatientSearchCompleted => "patient.search.completed",
            Self::VisitCreated => "visit.created",
            Self::EmergencyVisitCreated => "emergency.visit.created",
            Self::MlcCreated => "mlc.created",
            Self::EmergencyMlcPoliceIntimationCreated => "emergency.mlc_police_intimation.created",
            Self::OpdEncounterCreated => "opd.encounter.created",
            Self::OpdQueueCalled => "opd.queue.called",
            Self::OpdConsultationStarted => "opd.consultation.started",
            Self::OpdVitalsRecorded => "opd.vitals.recorded",
            Self::OpdConsultationSaved => "opd.consultation.saved",
            Self::OpdEncounterCompleted => "opd.encounter.completed",
            Self::OpdFollowupScheduled => "opd.followup.scheduled",
            Self::OpdPrescriptionUpdated => "opd.prescription.updated",
            Self::OpdCertificateCreated => "opd.certificate.created",
            Self::OpdConsentSigned => "opd.consent.signed",
            Self::CampStarted => "camp.started",
            Self::CampRegistrationCreated => "camp.registration.created",
            Self::CampScreeningCompleted => "camp.screening.completed",
            Self::OrderCreated => "order.created",
            Self::OrderCancelled => "order.cancelled",
            Self::LabOrderCompleted => "lab.order.completed",
            Self::LabSampleCollected => "lab.sample_collected",
            Self::LabResultPosted => "lab.result.posted",
            Self::LabResultVerified => "lab.result.verified",
            Self::RadiologyOrderCompleted => "radiology.order.completed",
            Self::RadiologyReportCreated => "radiology.report.created",
            Self::RadiologyReportVerified => "radiology.report.verified",
            Self::BillingInvoiceCreated => "billing.invoice.created",
            Self::BillingInvoiceFinalized => "billing.invoice.finalized",
            Self::BillingPaymentReceived => "billing.payment.received",
            Self::PharmacyOrderDispensed => "pharmacy.order.dispensed",
            Self::PharmacyPrescriptionReviewed => "pharmacy.prescription.reviewed",
            Self::PharmacyStockMovementCreated => "pharmacy.stock.movement.created",
            Self::PharmacyNdpsMovementCreated => "pharmacy.ndps.movement.created",
            Self::IndentRequisitionSubmitted => "indent.requisition.submitted",
            Self::IndentRequisitionApproved => "indent.requisition.approved",
            Self::IndentRequisitionIssued => "indent.requisition.issued",
            Self::IpdAdmissionCreated => "ipd.admission.created",
            Self::BedAssigned => "bed.assigned",
            Self::BedTransferred => "bed.transferred",
            Self::IpdDischargeInitiated => "ipd.discharge.initiated",
            Self::IpdDischargeCompleted => "ipd.discharge.completed",
            Self::IpdDischargeFinalized => "ipd.discharge.finalized",
            Self::MrdCaseSheetGenerated => "mrd.case_sheet.generated",
            Self::MrdCaseSheetPrinted => "mrd.case_sheet.printed",
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
            Self::PatientCreated
            | Self::PatientUpdated
            | Self::PatientMerged
            | Self::PatientAccessShared
            | Self::PatientCardPrinted
            | Self::PatientSearchCompleted => ClinicalEventSourceModule::Patients,
            Self::VisitCreated
            | Self::OpdEncounterCreated
            | Self::OpdQueueCalled
            | Self::OpdConsultationStarted
            | Self::OpdVitalsRecorded
            | Self::OpdConsultationSaved
            | Self::OpdEncounterCompleted
            | Self::OpdFollowupScheduled
            | Self::OpdPrescriptionUpdated
            | Self::OpdCertificateCreated
            | Self::OpdConsentSigned => ClinicalEventSourceModule::Opd,
            Self::CampStarted | Self::CampRegistrationCreated | Self::CampScreeningCompleted => {
                ClinicalEventSourceModule::Camp
            }
            Self::EmergencyVisitCreated
            | Self::MlcCreated
            | Self::EmergencyMlcPoliceIntimationCreated => ClinicalEventSourceModule::Emergency,
            Self::OrderCreated | Self::OrderCancelled => ClinicalEventSourceModule::OrderBasket,
            Self::LabOrderCompleted
            | Self::LabSampleCollected
            | Self::LabResultPosted
            | Self::LabResultVerified => ClinicalEventSourceModule::Lab,
            Self::RadiologyOrderCompleted
            | Self::RadiologyReportCreated
            | Self::RadiologyReportVerified => ClinicalEventSourceModule::Radiology,
            Self::BillingInvoiceCreated
            | Self::BillingInvoiceFinalized
            | Self::BillingPaymentReceived => ClinicalEventSourceModule::Billing,
            Self::PharmacyOrderDispensed
            | Self::PharmacyPrescriptionReviewed
            | Self::PharmacyStockMovementCreated
            | Self::PharmacyNdpsMovementCreated => ClinicalEventSourceModule::Pharmacy,
            Self::IndentRequisitionSubmitted
            | Self::IndentRequisitionApproved
            | Self::IndentRequisitionIssued => ClinicalEventSourceModule::Indent,
            Self::IpdAdmissionCreated | Self::BedAssigned | Self::BedTransferred => {
                ClinicalEventSourceModule::Ipd
            }
            Self::IpdDischargeInitiated
            | Self::IpdDischargeCompleted
            | Self::IpdDischargeFinalized => ClinicalEventSourceModule::Ipd,
            Self::MrdCaseSheetGenerated | Self::MrdCaseSheetPrinted => {
                ClinicalEventSourceModule::Mrd
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
            Self::PatientUpdated => &["patient_id"],
            Self::PatientMerged => &["surviving_patient_id", "merged_patient_id"],
            Self::PatientAccessShared | Self::PatientCardPrinted => &["patient_id"],
            Self::PatientSearchCompleted => &["search_id"],
            Self::VisitCreated => &["visit_id", "patient_id"],
            Self::EmergencyVisitCreated => &["visit_id", "patient_id"],
            Self::MlcCreated => &["mlc_case_id", "patient_id"],
            Self::EmergencyMlcPoliceIntimationCreated => {
                &["intimation_id", "mlc_case_id", "patient_id"]
            }
            Self::OpdEncounterCreated => &["encounter_id", "patient_id"],
            Self::OpdQueueCalled | Self::OpdConsultationStarted => {
                &["queue_entry_id", "encounter_id", "patient_id"]
            }
            Self::OpdVitalsRecorded => &["encounter_id", "patient_id"],
            Self::OpdConsultationSaved => &["consultation_id", "encounter_id", "patient_id"],
            Self::OpdEncounterCompleted => &["encounter_id", "patient_id"],
            Self::OpdFollowupScheduled => &["appointment_id", "patient_id"],
            Self::OpdPrescriptionUpdated => &["prescription_id", "encounter_id", "patient_id"],
            Self::OpdCertificateCreated => &["certificate_id", "patient_id"],
            Self::OpdConsentSigned => &["consent_id", "patient_id"],
            Self::CampStarted => &["camp_id"],
            Self::CampRegistrationCreated => &["registration_id", "camp_id", "patient_id"],
            Self::CampScreeningCompleted => &["screening_id", "camp_id", "patient_id"],
            Self::OrderCreated => &["order_id", "order_type", "patient_id"],
            Self::OrderCancelled => &["order_id", "order_type", "reason"],
            Self::LabOrderCompleted | Self::LabSampleCollected => &["order_id", "patient_id"],
            Self::LabResultPosted | Self::LabResultVerified => &["order_id", "patient_id"],
            Self::RadiologyOrderCompleted => &["order_id", "patient_id"],
            Self::RadiologyReportCreated | Self::RadiologyReportVerified => {
                &["report_id", "order_id", "patient_id"]
            }
            Self::BillingInvoiceCreated => &["invoice_id", "patient_id", "total_amount"],
            Self::BillingInvoiceFinalized => &["invoice_id", "patient_id"],
            Self::BillingPaymentReceived => &["payment_id", "invoice_id", "patient_id"],
            Self::PharmacyOrderDispensed => &["order_id", "patient_id", "items"],
            Self::PharmacyPrescriptionReviewed => &[
                "rx_queue_id",
                "prescription_id",
                "patient_id",
                "review_status",
                "pharmacy_order_id",
                "billing_invoice_id",
            ],
            Self::PharmacyStockMovementCreated => &["transaction_type", "quantity"],
            Self::PharmacyNdpsMovementCreated => &["entry_id", "catalog_item_id", "action"],
            Self::IndentRequisitionSubmitted => &[
                "requisition_id",
                "department_id",
                "indent_type",
                "requested_by",
                "status",
            ],
            Self::IndentRequisitionApproved => &[
                "requisition_id",
                "department_id",
                "indent_type",
                "approved_by",
                "status",
            ],
            Self::IndentRequisitionIssued => &[
                "requisition_id",
                "department_id",
                "indent_type",
                "issued_by",
                "status",
            ],
            Self::IpdAdmissionCreated => &["admission_id", "patient_id"],
            Self::BedAssigned => &["bed_id", "admission_id", "patient_id"],
            Self::BedTransferred => &["transfer_id", "admission_id", "from_bed_id", "to_bed_id"],
            Self::IpdDischargeInitiated | Self::IpdDischargeCompleted => {
                &["admission_id", "patient_id"]
            }
            Self::IpdDischargeFinalized => &["summary_id", "admission_id", "patient_id"],
            Self::MrdCaseSheetGenerated => &["packet_id", "packet_type", "patient_id"],
            Self::MrdCaseSheetPrinted => &["packet_id", "patient_id"],
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
            "patient.updated" => Ok(Self::PatientUpdated),
            "patient.merged" => Ok(Self::PatientMerged),
            "patient.access_shared" => Ok(Self::PatientAccessShared),
            "patient.card_printed" => Ok(Self::PatientCardPrinted),
            "patient.search.completed" => Ok(Self::PatientSearchCompleted),
            "visit.created" => Ok(Self::VisitCreated),
            "emergency.visit.created" => Ok(Self::EmergencyVisitCreated),
            "mlc.created" => Ok(Self::MlcCreated),
            "emergency.mlc_police_intimation.created" => {
                Ok(Self::EmergencyMlcPoliceIntimationCreated)
            }
            "opd.encounter.created" => Ok(Self::OpdEncounterCreated),
            "opd.queue.called" => Ok(Self::OpdQueueCalled),
            "opd.consultation.started" => Ok(Self::OpdConsultationStarted),
            "opd.vitals.recorded" => Ok(Self::OpdVitalsRecorded),
            "opd.consultation.saved" => Ok(Self::OpdConsultationSaved),
            "opd.encounter.completed" => Ok(Self::OpdEncounterCompleted),
            "opd.followup.scheduled" => Ok(Self::OpdFollowupScheduled),
            "opd.prescription.updated" => Ok(Self::OpdPrescriptionUpdated),
            "opd.certificate.created" => Ok(Self::OpdCertificateCreated),
            "opd.consent.signed" => Ok(Self::OpdConsentSigned),
            "camp.started" => Ok(Self::CampStarted),
            "camp.registration.created" => Ok(Self::CampRegistrationCreated),
            "camp.screening.completed" => Ok(Self::CampScreeningCompleted),
            "order.created" => Ok(Self::OrderCreated),
            "order.cancelled" => Ok(Self::OrderCancelled),
            "lab.order.completed" => Ok(Self::LabOrderCompleted),
            "lab.sample_collected" => Ok(Self::LabSampleCollected),
            "lab.result.posted" => Ok(Self::LabResultPosted),
            "lab.result.verified" => Ok(Self::LabResultVerified),
            "radiology.order.completed" => Ok(Self::RadiologyOrderCompleted),
            "radiology.report.created" => Ok(Self::RadiologyReportCreated),
            "radiology.report.verified" => Ok(Self::RadiologyReportVerified),
            "billing.invoice.created" => Ok(Self::BillingInvoiceCreated),
            "billing.invoice.finalized" => Ok(Self::BillingInvoiceFinalized),
            "billing.payment.received" => Ok(Self::BillingPaymentReceived),
            "pharmacy.order.dispensed" => Ok(Self::PharmacyOrderDispensed),
            "pharmacy.prescription.reviewed" => Ok(Self::PharmacyPrescriptionReviewed),
            "pharmacy.stock.movement.created" => Ok(Self::PharmacyStockMovementCreated),
            "pharmacy.ndps.movement.created" => Ok(Self::PharmacyNdpsMovementCreated),
            "indent.requisition.submitted" => Ok(Self::IndentRequisitionSubmitted),
            "indent.requisition.approved" => Ok(Self::IndentRequisitionApproved),
            "indent.requisition.issued" => Ok(Self::IndentRequisitionIssued),
            "ipd.admission.created" => Ok(Self::IpdAdmissionCreated),
            "bed.assigned" => Ok(Self::BedAssigned),
            "bed.transferred" => Ok(Self::BedTransferred),
            "ipd.discharge.initiated" => Ok(Self::IpdDischargeInitiated),
            "ipd.discharge.completed" => Ok(Self::IpdDischargeCompleted),
            "ipd.discharge.finalized" => Ok(Self::IpdDischargeFinalized),
            "mrd.case_sheet.generated" => Ok(Self::MrdCaseSheetGenerated),
            "mrd.case_sheet.printed" => Ok(Self::MrdCaseSheetPrinted),
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
    #[serde(rename = "camp")]
    Camp,
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
    #[serde(rename = "indent")]
    Indent,
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
            Self::Camp => "camp",
            Self::OrderBasket => "order_basket",
            Self::Lab => "lab",
            Self::Radiology => "radiology",
            Self::Billing => "billing",
            Self::Pharmacy => "pharmacy",
            Self::Indent => "indent",
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

#[cfg(test)]
mod tests {
    use super::{ClinicalEventName, ClinicalEventSourceModule};

    #[test]
    fn ipd_discharge_finalized_is_canonical() {
        assert_eq!(
            "ipd.discharge.finalized".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::IpdDischargeFinalized)
        );
        assert_eq!(
            ClinicalEventName::IpdDischargeFinalized.as_str(),
            "ipd.discharge.finalized"
        );
        assert_eq!(
            ClinicalEventName::IpdDischargeFinalized.default_source_module(),
            ClinicalEventSourceModule::Ipd
        );
        assert_eq!(
            ClinicalEventName::IpdDischargeFinalized.required_payload_keys(),
            &["summary_id", "admission_id", "patient_id"]
        );
    }

    #[test]
    fn patient_updated_is_canonical() {
        assert_eq!(
            "patient.updated".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::PatientUpdated)
        );
        assert_eq!(
            ClinicalEventName::PatientUpdated.as_str(),
            "patient.updated"
        );
        assert_eq!(
            ClinicalEventName::PatientUpdated.default_source_module(),
            ClinicalEventSourceModule::Patients
        );
        assert_eq!(
            ClinicalEventName::PatientUpdated.required_payload_keys(),
            &["patient_id"]
        );
    }

    #[test]
    fn patient_access_events_are_canonical() {
        assert_eq!(
            "patient.access_shared".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::PatientAccessShared)
        );
        assert_eq!(
            ClinicalEventName::PatientAccessShared.default_source_module(),
            ClinicalEventSourceModule::Patients
        );
        assert_eq!(
            ClinicalEventName::PatientAccessShared.required_payload_keys(),
            &["patient_id"]
        );

        assert_eq!(
            "patient.card_printed".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::PatientCardPrinted)
        );
        assert_eq!(
            ClinicalEventName::PatientCardPrinted.as_str(),
            "patient.card_printed"
        );
        assert_eq!(
            ClinicalEventName::PatientCardPrinted.default_source_module(),
            ClinicalEventSourceModule::Patients
        );
        assert_eq!(
            ClinicalEventName::PatientCardPrinted.required_payload_keys(),
            &["patient_id"]
        );

        assert_eq!(
            "patient.search.completed".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::PatientSearchCompleted)
        );
        assert_eq!(
            ClinicalEventName::PatientSearchCompleted.default_source_module(),
            ClinicalEventSourceModule::Patients
        );
        assert_eq!(
            ClinicalEventName::PatientSearchCompleted.required_payload_keys(),
            &["search_id"]
        );
    }

    #[test]
    fn emergency_mlc_events_are_canonical() {
        assert_eq!(
            "mlc.created".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::MlcCreated)
        );
        assert_eq!(ClinicalEventName::MlcCreated.as_str(), "mlc.created");
        assert_eq!(
            ClinicalEventName::MlcCreated.default_source_module(),
            ClinicalEventSourceModule::Emergency
        );
        assert_eq!(
            ClinicalEventName::MlcCreated.required_payload_keys(),
            &["mlc_case_id", "patient_id"]
        );

        assert_eq!(
            "emergency.mlc_police_intimation.created"
                .parse::<ClinicalEventName>()
                .ok(),
            Some(ClinicalEventName::EmergencyMlcPoliceIntimationCreated)
        );
        assert_eq!(
            ClinicalEventName::EmergencyMlcPoliceIntimationCreated.as_str(),
            "emergency.mlc_police_intimation.created"
        );
        assert_eq!(
            ClinicalEventName::EmergencyMlcPoliceIntimationCreated.default_source_module(),
            ClinicalEventSourceModule::Emergency
        );
        assert_eq!(
            ClinicalEventName::EmergencyMlcPoliceIntimationCreated.required_payload_keys(),
            &["intimation_id", "mlc_case_id", "patient_id"]
        );
    }

    #[test]
    fn opd_document_events_are_canonical() {
        assert_eq!(
            "opd.certificate.created".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::OpdCertificateCreated)
        );
        assert_eq!(
            ClinicalEventName::OpdCertificateCreated.as_str(),
            "opd.certificate.created"
        );
        assert_eq!(
            ClinicalEventName::OpdCertificateCreated.default_source_module(),
            ClinicalEventSourceModule::Opd
        );
        assert_eq!(
            ClinicalEventName::OpdCertificateCreated.required_payload_keys(),
            &["certificate_id", "patient_id"]
        );

        assert_eq!(
            "opd.consent.signed".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::OpdConsentSigned)
        );
        assert_eq!(
            ClinicalEventName::OpdConsentSigned.as_str(),
            "opd.consent.signed"
        );
        assert_eq!(
            ClinicalEventName::OpdConsentSigned.default_source_module(),
            ClinicalEventSourceModule::Opd
        );
        assert_eq!(
            ClinicalEventName::OpdConsentSigned.required_payload_keys(),
            &["consent_id", "patient_id"]
        );
    }

    #[test]
    fn opd_lifecycle_events_are_canonical() {
        let events = [
            (
                "opd.queue.called",
                ClinicalEventName::OpdQueueCalled,
                &["queue_entry_id", "encounter_id", "patient_id"][..],
            ),
            (
                "opd.consultation.started",
                ClinicalEventName::OpdConsultationStarted,
                &["queue_entry_id", "encounter_id", "patient_id"],
            ),
            (
                "opd.vitals.recorded",
                ClinicalEventName::OpdVitalsRecorded,
                &["encounter_id", "patient_id"],
            ),
            (
                "opd.consultation.saved",
                ClinicalEventName::OpdConsultationSaved,
                &["consultation_id", "encounter_id", "patient_id"],
            ),
            (
                "opd.encounter.completed",
                ClinicalEventName::OpdEncounterCompleted,
                &["encounter_id", "patient_id"],
            ),
            (
                "opd.followup.scheduled",
                ClinicalEventName::OpdFollowupScheduled,
                &["appointment_id", "patient_id"],
            ),
            (
                "opd.prescription.updated",
                ClinicalEventName::OpdPrescriptionUpdated,
                &["prescription_id", "encounter_id", "patient_id"],
            ),
        ];

        for (event_name, parsed, payload_keys) in events {
            assert_eq!(event_name.parse::<ClinicalEventName>().ok(), Some(parsed));
            assert_eq!(parsed.as_str(), event_name);
            assert_eq!(
                parsed.default_source_module(),
                ClinicalEventSourceModule::Opd
            );
            assert_eq!(parsed.required_payload_keys(), payload_keys);
        }
    }

    #[test]
    fn mrd_case_sheet_events_are_canonical() {
        assert_eq!(
            "mrd.case_sheet.generated".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::MrdCaseSheetGenerated)
        );
        assert_eq!(
            ClinicalEventName::MrdCaseSheetGenerated.as_str(),
            "mrd.case_sheet.generated"
        );
        assert_eq!(
            ClinicalEventName::MrdCaseSheetGenerated.default_source_module(),
            ClinicalEventSourceModule::Mrd
        );
        assert_eq!(
            ClinicalEventName::MrdCaseSheetGenerated.required_payload_keys(),
            &["packet_id", "packet_type", "patient_id"]
        );

        assert_eq!(
            "mrd.case_sheet.printed".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::MrdCaseSheetPrinted)
        );
        assert_eq!(
            ClinicalEventName::MrdCaseSheetPrinted.as_str(),
            "mrd.case_sheet.printed"
        );
        assert_eq!(
            ClinicalEventName::MrdCaseSheetPrinted.default_source_module(),
            ClinicalEventSourceModule::Mrd
        );
        assert_eq!(
            ClinicalEventName::MrdCaseSheetPrinted.required_payload_keys(),
            &["packet_id", "patient_id"]
        );
    }

    #[test]
    fn pharmacy_movement_events_are_canonical() {
        assert_eq!(
            "pharmacy.prescription.reviewed"
                .parse::<ClinicalEventName>()
                .ok(),
            Some(ClinicalEventName::PharmacyPrescriptionReviewed)
        );
        assert_eq!(
            ClinicalEventName::PharmacyPrescriptionReviewed.as_str(),
            "pharmacy.prescription.reviewed"
        );
        assert_eq!(
            ClinicalEventName::PharmacyPrescriptionReviewed.default_source_module(),
            ClinicalEventSourceModule::Pharmacy
        );
        assert_eq!(
            ClinicalEventName::PharmacyPrescriptionReviewed.required_payload_keys(),
            &[
                "rx_queue_id",
                "prescription_id",
                "patient_id",
                "review_status",
                "pharmacy_order_id",
                "billing_invoice_id",
            ]
        );

        assert_eq!(
            "pharmacy.stock.movement.created"
                .parse::<ClinicalEventName>()
                .ok(),
            Some(ClinicalEventName::PharmacyStockMovementCreated)
        );
        assert_eq!(
            ClinicalEventName::PharmacyStockMovementCreated.as_str(),
            "pharmacy.stock.movement.created"
        );
        assert_eq!(
            ClinicalEventName::PharmacyStockMovementCreated.default_source_module(),
            ClinicalEventSourceModule::Pharmacy
        );
        assert_eq!(
            ClinicalEventName::PharmacyStockMovementCreated.required_payload_keys(),
            &["transaction_type", "quantity"]
        );

        assert_eq!(
            "pharmacy.ndps.movement.created"
                .parse::<ClinicalEventName>()
                .ok(),
            Some(ClinicalEventName::PharmacyNdpsMovementCreated)
        );
        assert_eq!(
            ClinicalEventName::PharmacyNdpsMovementCreated.as_str(),
            "pharmacy.ndps.movement.created"
        );
        assert_eq!(
            ClinicalEventName::PharmacyNdpsMovementCreated.default_source_module(),
            ClinicalEventSourceModule::Pharmacy
        );
        assert_eq!(
            ClinicalEventName::PharmacyNdpsMovementCreated.required_payload_keys(),
            &["entry_id", "catalog_item_id", "action"]
        );
    }

    #[test]
    fn indent_requisition_events_are_canonical() {
        let events = [
            (
                "indent.requisition.submitted",
                ClinicalEventName::IndentRequisitionSubmitted,
                &[
                    "requisition_id",
                    "department_id",
                    "indent_type",
                    "requested_by",
                    "status",
                ][..],
            ),
            (
                "indent.requisition.approved",
                ClinicalEventName::IndentRequisitionApproved,
                &[
                    "requisition_id",
                    "department_id",
                    "indent_type",
                    "approved_by",
                    "status",
                ],
            ),
            (
                "indent.requisition.issued",
                ClinicalEventName::IndentRequisitionIssued,
                &[
                    "requisition_id",
                    "department_id",
                    "indent_type",
                    "issued_by",
                    "status",
                ],
            ),
        ];

        for (event_name, parsed, payload_keys) in events {
            assert_eq!(event_name.parse::<ClinicalEventName>().ok(), Some(parsed));
            assert_eq!(parsed.as_str(), event_name);
            assert_eq!(
                parsed.default_source_module(),
                ClinicalEventSourceModule::Indent
            );
            assert_eq!(parsed.required_payload_keys(), payload_keys);
        }
    }

    #[test]
    fn diagnostic_result_events_are_canonical() {
        assert_eq!(
            "lab.sample_collected".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::LabSampleCollected)
        );
        assert_eq!(
            ClinicalEventName::LabSampleCollected.as_str(),
            "lab.sample_collected"
        );
        assert_eq!(
            ClinicalEventName::LabSampleCollected.default_source_module(),
            ClinicalEventSourceModule::Lab
        );
        assert_eq!(
            ClinicalEventName::LabSampleCollected.required_payload_keys(),
            &["order_id", "patient_id"]
        );

        assert_eq!(
            "lab.result.posted".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::LabResultPosted)
        );
        assert_eq!(
            ClinicalEventName::LabResultPosted.default_source_module(),
            ClinicalEventSourceModule::Lab
        );
        assert_eq!(
            ClinicalEventName::LabResultPosted.required_payload_keys(),
            &["order_id", "patient_id"]
        );

        assert_eq!(
            "lab.result.verified".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::LabResultVerified)
        );
        assert_eq!(
            ClinicalEventName::LabResultVerified.as_str(),
            "lab.result.verified"
        );
        assert_eq!(
            ClinicalEventName::LabResultVerified.default_source_module(),
            ClinicalEventSourceModule::Lab
        );
        assert_eq!(
            ClinicalEventName::LabResultVerified.required_payload_keys(),
            &["order_id", "patient_id"]
        );

        assert_eq!(
            "radiology.report.created".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::RadiologyReportCreated)
        );
        assert_eq!(
            ClinicalEventName::RadiologyReportCreated.as_str(),
            "radiology.report.created"
        );
        assert_eq!(
            ClinicalEventName::RadiologyReportCreated.default_source_module(),
            ClinicalEventSourceModule::Radiology
        );
        assert_eq!(
            ClinicalEventName::RadiologyReportCreated.required_payload_keys(),
            &["report_id", "order_id", "patient_id"]
        );

        assert_eq!(
            "radiology.report.verified"
                .parse::<ClinicalEventName>()
                .ok(),
            Some(ClinicalEventName::RadiologyReportVerified)
        );
        assert_eq!(
            ClinicalEventName::RadiologyReportVerified.as_str(),
            "radiology.report.verified"
        );
        assert_eq!(
            ClinicalEventName::RadiologyReportVerified.default_source_module(),
            ClinicalEventSourceModule::Radiology
        );
        assert_eq!(
            ClinicalEventName::RadiologyReportVerified.required_payload_keys(),
            &["report_id", "order_id", "patient_id"]
        );
    }

    #[test]
    fn camp_events_are_canonical() {
        assert_eq!(
            "camp.started".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::CampStarted)
        );
        assert_eq!(ClinicalEventName::CampStarted.as_str(), "camp.started");
        assert_eq!(
            ClinicalEventName::CampStarted.default_source_module(),
            ClinicalEventSourceModule::Camp
        );
        assert_eq!(
            ClinicalEventName::CampStarted.required_payload_keys(),
            &["camp_id"]
        );

        assert_eq!(
            "camp.registration.created"
                .parse::<ClinicalEventName>()
                .ok(),
            Some(ClinicalEventName::CampRegistrationCreated)
        );
        assert_eq!(
            ClinicalEventName::CampRegistrationCreated.required_payload_keys(),
            &["registration_id", "camp_id", "patient_id"]
        );

        assert_eq!(
            "camp.screening.completed".parse::<ClinicalEventName>().ok(),
            Some(ClinicalEventName::CampScreeningCompleted)
        );
        assert_eq!(
            ClinicalEventName::CampScreeningCompleted.default_source_module(),
            ClinicalEventSourceModule::Camp
        );
        assert_eq!(
            ClinicalEventName::CampScreeningCompleted.required_payload_keys(),
            &["screening_id", "camp_id", "patient_id"]
        );
    }
}
