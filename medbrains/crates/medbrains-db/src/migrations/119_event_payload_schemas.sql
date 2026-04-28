-- 119: Define payload schemas for all system events
-- Each event now declares exactly what data it carries, so the pipeline
-- builder can show available fields and users can map them to action inputs.

-- ── Patient Events ─────────────────────────────────────────
UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "patient_id",        "type": "uuid",   "label": "Patient ID"},
    {"path": "uhid",              "type": "string", "label": "UHID"},
    {"path": "first_name",        "type": "string", "label": "First Name"},
    {"path": "last_name",         "type": "string", "label": "Last Name"},
    {"path": "phone",             "type": "string", "label": "Phone"},
    {"path": "email",             "type": "string", "label": "Email"},
    {"path": "gender",            "type": "string", "label": "Gender"},
    {"path": "date_of_birth",     "type": "date",   "label": "Date of Birth"},
    {"path": "category",          "type": "string", "label": "Patient Category"},
    {"path": "registered_by",     "type": "uuid",   "label": "Registered By (User ID)"},
    {"path": "registered_by_name","type": "string", "label": "Registered By (Name)"},
    {"path": "department_id",     "type": "uuid",   "label": "Department ID"},
    {"path": "department_name",   "type": "string", "label": "Department Name"}
  ]
}' WHERE event_code = 'patients.patient.registered';

-- ── OPD Events ─────────────────────────────────────────────
UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "encounter_id",      "type": "uuid",   "label": "Encounter ID"},
    {"path": "patient_id",        "type": "uuid",   "label": "Patient ID"},
    {"path": "patient_name",      "type": "string", "label": "Patient Name"},
    {"path": "uhid",              "type": "string", "label": "UHID"},
    {"path": "doctor_id",         "type": "uuid",   "label": "Doctor ID"},
    {"path": "doctor_name",       "type": "string", "label": "Doctor Name"},
    {"path": "department_id",     "type": "uuid",   "label": "Department ID"},
    {"path": "department_name",   "type": "string", "label": "Department Name"},
    {"path": "visit_type",        "type": "string", "label": "Visit Type"},
    {"path": "encounter_date",    "type": "date",   "label": "Encounter Date"}
  ]
}' WHERE event_code IN ('opd.encounter.creating', 'opd.encounter.created', 'opd.consultation.completed');

UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "prescription_id",   "type": "uuid",   "label": "Prescription ID"},
    {"path": "encounter_id",      "type": "uuid",   "label": "Encounter ID"},
    {"path": "patient_id",        "type": "uuid",   "label": "Patient ID"},
    {"path": "patient_name",      "type": "string", "label": "Patient Name"},
    {"path": "doctor_id",         "type": "uuid",   "label": "Doctor ID"},
    {"path": "doctor_name",       "type": "string", "label": "Doctor Name"},
    {"path": "items_count",       "type": "integer","label": "Number of Items"},
    {"path": "items",             "type": "array",  "label": "Prescription Items"}
  ]
}' WHERE event_code IN ('opd.prescription.creating', 'opd.prescription.created');

-- ── Lab Events ─────────────────────────────────────────────
UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "order_id",          "type": "uuid",   "label": "Order ID"},
    {"path": "patient_id",        "type": "uuid",   "label": "Patient ID"},
    {"path": "patient_name",      "type": "string", "label": "Patient Name"},
    {"path": "uhid",              "type": "string", "label": "UHID"},
    {"path": "doctor_id",         "type": "uuid",   "label": "Ordering Doctor ID"},
    {"path": "doctor_name",       "type": "string", "label": "Ordering Doctor"},
    {"path": "department_id",     "type": "uuid",   "label": "Department ID"},
    {"path": "tests",             "type": "array",  "label": "Ordered Tests"},
    {"path": "tests_count",       "type": "integer","label": "Number of Tests"},
    {"path": "priority",          "type": "string", "label": "Priority (routine/urgent/stat)"},
    {"path": "is_critical",       "type": "boolean","label": "Has Critical Values"}
  ]
}' WHERE event_code IN ('lab.order.creating', 'lab.order.created', 'lab.order.completed');

-- ── Pharmacy Events ────────────────────────────────────────
UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "order_id",          "type": "uuid",   "label": "Order ID"},
    {"path": "patient_id",        "type": "uuid",   "label": "Patient ID"},
    {"path": "patient_name",      "type": "string", "label": "Patient Name"},
    {"path": "items",             "type": "array",  "label": "Dispensed Items"},
    {"path": "items_count",       "type": "integer","label": "Number of Items"},
    {"path": "total_amount",      "type": "number", "label": "Total Amount"},
    {"path": "has_controlled",    "type": "boolean","label": "Contains Controlled Substance"},
    {"path": "dispensed_by",      "type": "uuid",   "label": "Dispensed By (User ID)"},
    {"path": "dispensed_by_name", "type": "string", "label": "Dispensed By (Name)"}
  ]
}' WHERE event_code IN ('pharmacy.order.dispensing', 'pharmacy.order.dispensed');

-- ── IPD Events ─────────────────────────────────────────────
UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "admission_id",      "type": "uuid",   "label": "Admission ID"},
    {"path": "patient_id",        "type": "uuid",   "label": "Patient ID"},
    {"path": "patient_name",      "type": "string", "label": "Patient Name"},
    {"path": "uhid",              "type": "string", "label": "UHID"},
    {"path": "doctor_id",         "type": "uuid",   "label": "Attending Doctor ID"},
    {"path": "doctor_name",       "type": "string", "label": "Attending Doctor"},
    {"path": "department_id",     "type": "uuid",   "label": "Department ID"},
    {"path": "department_name",   "type": "string", "label": "Department Name"},
    {"path": "ward_id",           "type": "uuid",   "label": "Ward ID"},
    {"path": "ward_name",         "type": "string", "label": "Ward Name"},
    {"path": "bed_number",        "type": "string", "label": "Bed Number"},
    {"path": "admission_type",    "type": "string", "label": "Admission Type"},
    {"path": "ip_number",         "type": "string", "label": "IP Number"}
  ]
}' WHERE event_code IN ('ipd.admission.creating', 'ipd.admission.created', 'ipd.admission.transferred');

UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "admission_id",      "type": "uuid",   "label": "Admission ID"},
    {"path": "patient_id",        "type": "uuid",   "label": "Patient ID"},
    {"path": "patient_name",      "type": "string", "label": "Patient Name"},
    {"path": "uhid",              "type": "string", "label": "UHID"},
    {"path": "ip_number",         "type": "string", "label": "IP Number"},
    {"path": "doctor_name",       "type": "string", "label": "Doctor Name"},
    {"path": "department_name",   "type": "string", "label": "Department Name"},
    {"path": "discharge_type",    "type": "string", "label": "Discharge Type"},
    {"path": "total_bill",        "type": "number", "label": "Total Bill Amount"},
    {"path": "length_of_stay",    "type": "integer","label": "Length of Stay (days)"}
  ]
}' WHERE event_code = 'ipd.discharge.initiated';

-- ── Billing Events ─────────────────────────────────────────
UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "invoice_id",        "type": "uuid",   "label": "Invoice ID"},
    {"path": "invoice_number",    "type": "string", "label": "Invoice Number"},
    {"path": "patient_id",        "type": "uuid",   "label": "Patient ID"},
    {"path": "patient_name",      "type": "string", "label": "Patient Name"},
    {"path": "total_amount",      "type": "number", "label": "Total Amount"},
    {"path": "net_amount",        "type": "number", "label": "Net Payable"},
    {"path": "discount",          "type": "number", "label": "Discount"},
    {"path": "payment_mode",      "type": "string", "label": "Payment Mode"},
    {"path": "department_id",     "type": "uuid",   "label": "Department ID"},
    {"path": "department_name",   "type": "string", "label": "Department Name"},
    {"path": "is_insured",        "type": "boolean","label": "Insurance Patient"},
    {"path": "tpa_name",          "type": "string", "label": "TPA/Insurer Name"}
  ]
}' WHERE event_code = 'billing.invoice.created';

UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "payment_id",        "type": "uuid",   "label": "Payment ID"},
    {"path": "invoice_id",        "type": "uuid",   "label": "Invoice ID"},
    {"path": "patient_id",        "type": "uuid",   "label": "Patient ID"},
    {"path": "patient_name",      "type": "string", "label": "Patient Name"},
    {"path": "amount",            "type": "number", "label": "Amount Paid"},
    {"path": "payment_mode",      "type": "string", "label": "Payment Mode"},
    {"path": "receipt_number",    "type": "string", "label": "Receipt Number"}
  ]
}' WHERE event_code = 'billing.payment.received';

UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "concession_id",     "type": "uuid",   "label": "Concession ID"},
    {"path": "invoice_id",        "type": "uuid",   "label": "Invoice ID"},
    {"path": "patient_name",      "type": "string", "label": "Patient Name"},
    {"path": "original_amount",   "type": "number", "label": "Original Amount"},
    {"path": "concession_amount", "type": "number", "label": "Concession Amount"},
    {"path": "reason",            "type": "string", "label": "Reason"},
    {"path": "requested_by_name", "type": "string", "label": "Requested By"}
  ]
}' WHERE event_code = 'billing.concession.requested';

-- ── OT Events ──────────────────────────────────────────────
UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "surgery_id",        "type": "uuid",   "label": "Surgery ID"},
    {"path": "patient_id",        "type": "uuid",   "label": "Patient ID"},
    {"path": "patient_name",      "type": "string", "label": "Patient Name"},
    {"path": "surgeon_name",      "type": "string", "label": "Surgeon Name"},
    {"path": "procedure_name",    "type": "string", "label": "Procedure"},
    {"path": "ot_room",           "type": "string", "label": "OT Room"},
    {"path": "duration_minutes",  "type": "integer","label": "Duration (min)"},
    {"path": "admission_id",      "type": "uuid",   "label": "Admission ID"}
  ]
}' WHERE event_code = 'ot.surgery.completed';

-- ── Emergency Events ───────────────────────────────────────
UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "visit_id",          "type": "uuid",   "label": "ER Visit ID"},
    {"path": "patient_id",        "type": "uuid",   "label": "Patient ID"},
    {"path": "patient_name",      "type": "string", "label": "Patient Name"},
    {"path": "triage_level",      "type": "string", "label": "Triage Level"},
    {"path": "chief_complaint",   "type": "string", "label": "Chief Complaint"},
    {"path": "is_mlc",            "type": "boolean","label": "Medico-Legal Case"},
    {"path": "arrival_mode",      "type": "string", "label": "Arrival Mode"}
  ]
}' WHERE event_code = 'emergency.visit.created';

-- ── Ambulance Events ───────────────────────────────────────
UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "trip_id",           "type": "uuid",   "label": "Trip ID"},
    {"path": "patient_name",      "type": "string", "label": "Patient Name"},
    {"path": "pickup_location",   "type": "string", "label": "Pickup Location"},
    {"path": "drop_location",     "type": "string", "label": "Drop Location"},
    {"path": "distance_km",       "type": "number", "label": "Distance (km)"},
    {"path": "fare",              "type": "number", "label": "Fare Amount"}
  ]
}' WHERE event_code = 'ambulance.trip.completed';

-- ── Indent Events ──────────────────────────────────────────
UPDATE event_registry SET payload_schema = '{
  "type": "object",
  "fields": [
    {"path": "requisition_id",    "type": "uuid",   "label": "Requisition ID"},
    {"path": "requisition_number","type": "string", "label": "Requisition Number"},
    {"path": "department_id",     "type": "uuid",   "label": "Department ID"},
    {"path": "department_name",   "type": "string", "label": "Department Name"},
    {"path": "items_count",       "type": "integer","label": "Number of Items"},
    {"path": "total_amount",      "type": "number", "label": "Estimated Amount"},
    {"path": "priority",          "type": "string", "label": "Priority"},
    {"path": "requested_by",      "type": "uuid",   "label": "Requested By (User ID)"},
    {"path": "requested_by_name", "type": "string", "label": "Requested By (Name)"}
  ]
}' WHERE event_code IN ('indent.requisition.submitted', 'indent.requisition.approved');
