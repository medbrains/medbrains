"""Hand-written workflow test cases per role (#4804).

Each is (area, title, steps, expected). Steps use the real menu names. The
generator adds the screen-by-screen and must-not-see cases from the code; these
are the jobs each role does all day. A case naming another role (e.g. "as
test_doctor") is a hand-off: two testers, or one tester in two browsers.
"""

W = dict  # readability: W(area=..., title=..., steps=..., expected=...)

WORKFLOWS: dict[str, list[dict]] = {
    "receptionist": [
        W(area="Patients", title="Register a new patient",
          steps="Patients → Register. Enter name, sex, date of birth, phone, address. Save.",
          expected="A UHID is issued and shown. Searching the name or phone in Patients finds them."),
        W(area="Patients", title="Duplicate check on registration",
          steps="Register the same name + phone + date of birth again.",
          expected="The system warns of a possible duplicate before saving a second record."),
        W(area="OPD Queue", title="Start an OPD visit with a token",
          steps="OPD Queue → new visit for the patient registered above. Pick a department and doctor.",
          expected="A token number is issued; the patient appears in the OPD queue as waiting; a token slip can be printed."),
        W(area="Appointments", title="Book and check in an appointment",
          steps="Appointments → book a slot with a doctor for tomorrow; then for today, and check the patient in.",
          expected="The slot shows as booked; on check-in the patient joins that doctor's queue."),
    ],
    "front_office_staff": [
        W(area="Token Console", title="Call the next patient",
          steps="Token Console → pick a counter → Call next.",
          expected="The next waiting token turns 'called'; the Token Board shows it."),
        W(area="Front Office", title="Visitor / enquiry desk",
          steps="Front Office → record a visitor or enquiry for an admitted patient.",
          expected="The entry is saved and listed with time and who recorded it."),
    ],
    "doctor": [
        W(area="OPD Queue", title="Consult a patient end to end",
          steps="OPD Queue → call your next patient → Start → record complaint, examination, diagnosis (ICD-10 search), advice → prescribe two medicines → Complete.",
          expected="The visit is completed; the case sheet shows the note signed by you; the consultation is on the patient's bill at your fee."),
        W(area="OPD Queue", title="Free revisit inside the window",
          steps="(Billing settings has a free revisit window, e.g. 7 days.) Consult the same patient again within the window.",
          expected="The second consultation is billed ₹0, marked 'Free revisit (day N of M)'."),
        W(area="Orders", title="Order a lab test and an X-ray",
          steps="In a visit, order a CBC and a chest X-ray.",
          expected="The CBC appears in Lab and the X-ray in Radiology as ordered for this patient."),
        W(area="Ophthalmology", title="Spectacle prescription",
          steps="In a visit: Specialty tab → Ophthalmology → New exam. Enter vision, sphere/cylinder/axis for both eyes, lens type. Sign prescription (it should ask for the pupillary distance first) → PDF → Spectacle prescription.",
          expected="Signing is refused until PD is entered; once signed the exam is read-only; the PDF shows your name and registration number, not DRAFT."),
        W(area="Doctor Sign-offs", title="Clear pending sign-offs",
          steps="Doctor Sign-offs → open an unsigned note → sign.",
          expected="It leaves the pending list and shows as signed on the case sheet."),
    ],
    "nurse": [
        W(area="OPD Queue", title="Record vitals before the doctor",
          steps="OPD Queue → a waiting patient → Vitals → enter BP, pulse, temperature, SpO2, weight.",
          expected="Vitals save; the doctor sees them on the visit; an out-of-range value is flagged."),
        W(area="IPD", title="Print a wristband for an admitted patient",
          steps="IPD → open an admission → Wristband → Send to print queue (or Generate & open PDF).",
          expected="With a wristband printer set up: 'Queued on <printer>' and the band prints with name, UHID and barcode. Without one: a clear 'no printer' message — never silence."),
        W(area="Nurse Activities", title="Give a scheduled medicine (eMAR)",
          steps="Nurse Activities → medication round → scan or pick the patient → give a due dose.",
          expected="The dose is recorded with time and your name; giving it twice is warned."),
        W(area="Ophthalmology", title="Record an eye workup but cannot sign it",
          steps="Ophthalmology → New exam → enter vision and refraction → Save.",
          expected="Saved as a draft. There is NO 'Sign prescription' button for a nurse."),
    ],
    "lab_technician": [
        W(area="Lab", title="Collect a sample with a barcode",
          steps="(As test_doctor, order a CBC.) Lab → the order → Collect sample → scan/enter the patient's UHID and a tube barcode.",
          expected="Collection refuses a wrong UHID; on success the order shows 'sample collected' with the barcode."),
        W(area="Lab", title="Enter and verify results",
          steps="Lab → the collected order → enter results → verify.",
          expected="Values outside range are flagged H/L; the doctor sees the verified result on the visit; a critical value raises an alert."),
    ],
    "radiology_tech": [
        W(area="Radiology", title="Perform an ordered exam",
          steps="(As test_doctor, order a chest X-ray.) Radiology → worklist → the order → start → complete.",
          expected="The order moves through the worklist; with PACS connected the images link to the order."),
    ],
    "pharmacist": [
        W(area="Pharmacy", title="Dispense a prescription",
          steps="(As test_doctor, prescribe two medicines.) Pharmacy → prescription queue → open → dispense from the oldest-expiry batch.",
          expected="Stock reduces from the chosen batch; a label can be printed; the items are billed."),
        W(area="Pharmacy", title="Controlled / Schedule H drug",
          steps="Dispense a Schedule H or NDPS drug.",
          expected="The schedule badge shows; NDPS needs a register entry before it can be dispensed."),
        W(area="Pharmacy", title="Counter sale and a return",
          steps="Pharmacy → POS → sell an OTC item → then return it.",
          expected="The sale prints a receipt; the return restores stock and refunds at the original price."),
    ],
    "billing_clerk": [
        W(area="Billing", title="Collect payment on an OPD bill",
          steps="Billing → find the patient's bill → Record payment (cash or UPI) → print receipt.",
          expected="The bill shows paid; the receipt prints; the day's collection includes it."),
        W(area="Billing", title="Open a bill raised by someone else",
          steps="Open a bill created by another user or by auto-billing.",
          expected="It opens. (A 'could not be opened' message here is a defect.)"),
        W(area="Billing", title="Split an insured bill (payer split)",
          steps="An issued bill with an insurance claim → Payer split. Check the admission kit is marked Patient (IRDAI). Move one line to Patient with a reason → Write to claim → Patient share PDF.",
          expected="Insurer and patient totals add up to the bill; the claim amount updates; moving a line without a reason is refused."),
    ],
    "insurance_officer": [
        W(area="Insurance & TPA", title="Raise a cashless claim",
          steps="Insurance & TPA → pre-authorisation for an admitted patient → submit; later record approval.",
          expected="Status moves submitted → approved with the approved amount; the bill's payer split uses it."),
    ],
    "mrd_officer": [
        W(area="Medical Records", title="Find and review a case sheet",
          steps="Medical Records → search a discharged patient → open the case sheet.",
          expected="The full record opens read-only; printed documents are filed in it."),
    ],
    "ot_staff": [
        W(area="Operation Theatre", title="Surgical safety checklist",
          steps="Operation Theatre → a booked case → WHO checklist sign-in, time-out, sign-out.",
          expected="Each stage records who and when; the case cannot close with the checklist incomplete."),
    ],
    "blood_bank_tech": [
        W(area="Blood Bank", title="Issue a unit after crossmatch",
          steps="Blood Bank → a request → crossmatch a compatible unit → issue.",
          expected="Incompatible groups are refused; the issued unit leaves stock with the patient recorded."),
    ],
    "cssd_technician": [
        W(area="CSSD", title="Run a sterilisation cycle",
          steps="CSSD → receive a set → load into a cycle → record the indicator result → release.",
          expected="A failed indicator blocks release; released sets show as sterile with expiry."),
    ],
    "dietitian": [
        W(area="Diet & Kitchen", title="Order a therapeutic diet",
          steps="Diet & Kitchen → an admitted patient → set a diabetic diet.",
          expected="The diet shows on the kitchen list for the next meal."),
    ],
    "canteen_staff": [
        W(area="Diet & Kitchen", title="Kitchen meal list",
          steps="Open the kitchen / meal list for today.",
          expected="Meals per ward and diet type are listed; no patient clinical notes are visible."),
    ],
    "housekeeping_staff": [
        W(area="Housekeeping", title="Clean a vacated bed",
          steps="Housekeeping → a bed marked for cleaning → start → done.",
          expected="The bed becomes available for admission."),
    ],
    "facilities_manager": [
        W(area="Facilities Management", title="Raise and close a work order",
          steps="Facilities Management → new work order → assign → complete.",
          expected="The order moves through its states with times recorded."),
    ],
    "biomed_engineer": [
        W(area="Biomedical Engineering", title="Calibration due",
          steps="Biomedical Engineering → an equipment item → record calibration.",
          expected="The next due date updates; overdue equipment is flagged."),
    ],
    "security_guard": [
        W(area="Security", title="Record an access event",
          steps="Security → log an entry at a gate or restricted zone.",
          expected="It appears in the access log with time and zone."),
    ],
    "ambulance_driver": [
        W(area="Ambulance", title="Complete a trip",
          steps="Ambulance → an assigned trip → start → reached → completed.",
          expected="Times are recorded for each stage."),
    ],
    "infection_control_officer": [
        W(area="Infection Control", title="Log an infection event",
          steps="Infection Control → record a hospital-acquired infection for a patient.",
          expected="It counts in the surveillance list and rates."),
    ],
    "quality_officer": [
        W(area="Quality", title="Report and review an incident",
          steps="Quality → report an incident → review it.",
          expected="The incident is tracked to closure; NABH indicators reflect it."),
    ],
    "audit_officer": [
        W(area="Audit Trail", title="Trace who opened a record",
          steps="Audit Trail → filter by a test patient or a test user.",
          expected="Every view and change is listed with user, time and address; nothing can be edited or deleted."),
    ],
    "procurement_officer": [
        W(area="Procurement", title="Purchase order to goods received",
          steps="Procurement → raise a PO → (as test_store_keeper) receive the goods (GRN).",
          expected="Received quantities update stock; partial receipts keep the PO open."),
    ],
    "store_keeper": [
        W(area="Indent & Store", title="Issue against an indent",
          steps="Indent & Store → a ward's indent → issue items.",
          expected="Store stock reduces; the ward's stock increases."),
    ],
    "hr_officer": [
        W(area="Payroll", title="Staff record and leave",
          steps="Open a staff record; approve or reject a leave request.",
          expected="The decision is recorded and the staff member's leave balance updates."),
    ],
    "camp_coordinator": [
        W(area="Camp Management", title="Plan a health camp",
          steps="Camp Management → new camp → add date, site, team.",
          expected="The camp appears in the list and can register attendees."),
    ],
    "marketing_executive": [
        W(area="Marketing", title="Create a campaign",
          steps="Marketing → new campaign.",
          expected="The campaign is listed; no patient clinical records are visible to marketing."),
    ],
    "scheduling_admin": [
        W(area="Smart Scheduling", title="Set a doctor's OPD schedule",
          steps="Set clinic days and slot length for a doctor.",
          expected="Appointments can be booked only in those slots."),
    ],
    "case_manager": [
        W(area="Case Management", title="Assign a case",
          steps="Case Management → assign an admitted patient to yourself → add a note.",
          expected="The assignment and note are listed."),
    ],
    "utilization_reviewer": [
        W(area="Utilization Review", title="Review a long stay",
          steps="Utilization Review → open a review → record the decision.",
          expected="The decision is saved with your name."),
    ],
    "occ_health_officer": [
        W(area="Occupational Health", title="Employee health check",
          steps="Occupational Health → record a staff fitness check.",
          expected="It is saved to that staff member's occupational record."),
    ],
    "delivery_runner": [
        W(area="Home Deliveries", title="Deliver a pharmacy order",
          steps="Home Deliveries → an assigned delivery → picked up → delivered.",
          expected="Status updates with times; only the address needed for delivery is visible."),
    ],
    "display_device": [
        W(area="Token Board", title="Waiting-room board",
          steps="Sign in and open Token Board.",
          expected="Tokens show and update when called; nothing else in the app is reachable."),
    ],
}
