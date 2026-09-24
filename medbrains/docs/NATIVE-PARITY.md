# Native parity ledger — every React Native screen the SwiftUI + Compose apps must reach

Survey date 2026-09-13, from the code (not the tracker). This is the checklist the
native conversion (`RFCs/RFC-NATIVE-MOBILE.md`) is measured against: a React Native app
is deleted only when every row for it is ✅ on **both** platforms and its journeys run
natively. Status columns: `iOS` / `Android`, values ⬜ not started · 🟨 shell/placeholder ·
✅ converted and verified on the screen.

**Totals:** 35 modules + 4 role stacks, **118 screens/boards** (108 module or routed
screens + 10 gates/overlays). Shells (login, gating, module home), the Nurse module (phase 2), the Doctor module (phase 3, both 2026-09-14) and the Patient
app (phase 4, 2026-09-15; consent and family-share as tiles, bands as the empty state, as the RN app had them) are ✅
on both; every other module row is 🟨 (placeholder home) until its phase lands.

## 1. apps/mobile-staff → MedBrainsStaff (13 modules, 62 screens + login + EmergencyFlash)

Registry order decides where a role lands (`StaffModules` on both platforms mirrors it).

| Module (phase) | Screen | RN file | Endpoints | iOS | Android |
|---|---|---|---|---|---|
| doctor (3) | DoctorHome | modules/doctor.tsx | GET /api/tokens/worklist | ✅ | ✅ |
| doctor | QueueListScreen | doctor/queue-list.tsx | GET /api/tokens/worklist, POST /api/tokens/call-next | ✅ | ✅ |
| doctor | QueueDetailScreen | doctor/queue-detail.tsx | POST /api/tokens/{id}/call\|serve\|complete\|no-show | ✅ | ✅ |
| doctor | ConsultationScreen | doctor/consultation.tsx | GET/POST /api/opd/encounters/{id}/consultation, PATCH …/consultation/{cid} | ✅ | ✅ |
| doctor | DoctorIpdRoundsScreen | doctor/ipd-rounds.tsx | GET /api/ipd/admissions | ✅ | ✅ |
| doctor | DoctorIpdRoundDetailScreen | doctor/ipd-rounds.tsx | (props) | ✅ | ✅ |
| doctor | MyClinicScreen | doctor/my-clinic.tsx | GET /api/opd/appointments | ✅ | ✅ |
| nurse (2) | NurseHome | modules/nurse.tsx | GET /api/ipd/admissions, GET /api/bedside/nurse-calls/active | ✅ | ✅ |
| nurse | AdmissionsListScreen | nurse/admissions-list.tsx | GET /api/ipd/admissions | ✅ | ✅ |
| nurse | NurseCallBoardScreen | nurse/call-board.tsx | GET /api/bedside/nurse-calls/active, PATCH /api/bedside/nurse-requests/{id}/status | ✅ | ✅ |
| nurse | CodeBlueScreen | nurse/code-blue.tsx | /api/nurse/code-blue/*, …/responders | ✅ | ✅ |
| nurse | TransfusionMonitorScreen | nurse/transfusion-monitor.tsx | /api/ipd/admissions/{id}/transfusions, /api/ipd/transfusions/{id}/complete, /api/blood-bank/transfusions/{id}/observations | ✅ | ✅ |
| nurse | PatientWorkspaceScreen | nurse/patient-workspace.tsx | (props) | ✅ | ✅ |
| nurse | MarScheduleScreen | nurse/mar-schedule.tsx | GET /api/ipd/admissions/{id}/mar | ✅ | ✅ |
| nurse | AdministerDoseScreen (BCMA, scanner) | nurse/administer-dose.tsx | POST /api/nurse/mar/{marId}/verify-barcode, PATCH /api/ipd/admissions/{id}/mar/{marId}, GET /api/ipd/wards/{wardId}/on-duty | ✅ | ✅ |
| nurse | ShiftHandoverScreen | nurse/shift-handover.tsx | /api/nurse/handoffs, …/encounter/{id}, …/{id}/accept | ✅ | ✅ |
| nurse | BedsideActionScreen (vitals/io/pain/fall-risk) | nurse/bedside-action.tsx | /api/nurse/vitals, /api/nurse/io-entries, …/encounter/{id}/balance, /api/nurse/pain-entries, /api/nurse/fall-risk | ✅ | ✅ |
| reception (5) | ReceptionHome | modules/reception.tsx | GET /api/tokens/worklist | ✅ | ✅ |
| reception | RegisterPatientScreen | reception/register-patient.tsx | POST /api/patients/match + POST /api/patients (duplicate check the RN screen never ran), /api/setup/departments, /api/setup/doctors — camp, facility and ICD-11 fields deliberately left to the desk workstation (phone form stays one screen) | ✅ | ✅ |
| reception | PatientListScreen | reception/patient-list.tsx | GET /api/patients | ✅ | ✅ |
| reception | PatientDetailScreen | reception/patient-detail.tsx | (props) | ✅ | ✅ |
| reception | StartVisitScreen | reception/start-visit.tsx | POST /api/opd/encounters, GET /api/setup/departments, /api/setup/doctors | ✅ | ✅ |
| reception | QueueBoardScreen | reception/queue-board.tsx | GET /api/tokens/worklist, POST /api/tokens/call-next | ✅ | ✅ |
| reception | AppointmentsToday (new — the RN app's tile was dead) | — | GET /api/opd/appointments, PUT …/check-in, …/no-show | ✅ | ✅ |
| reception | BookAppointment (new) | — | GET /api/opd/doctors/{id}/slots, POST /api/opd/appointments | ✅ | ✅ |
| reception | VisitorDeskScreen | reception/visitor-desk.tsx | /api/front-office/visitors, /passes, /passes/{id}/revoke, /visitor-logs/{passId}/check-in\|check-out | ⬜ | ⬜ |
| reception | EnquiryDeskScreen | reception/enquiry-desk.tsx | /api/front-office/enquiries, …/{id}/resolve | ⬜ | ⬜ |
| pharmacy (5) | PharmacyHome | modules/pharmacy.tsx | GET /api/pharmacy/orders | 🟨 | 🟨 |
| pharmacy | PharmacyOrdersScreen | modules/pharmacy.tsx | GET /api/pharmacy/orders | ⬜ | ⬜ |
| pharmacy | ScanStockScreen (scanner) | pharmacy/scan-stock.tsx | GET /api/pharmacy/catalog, POST /api/pharmacy/stock/transactions | ⬜ | ⬜ |
| lab (5) | LabHome | modules/lab.tsx | GET /api/lab/orders | 🟨 | 🟨 |
| lab | LabOrdersScreen | modules/lab.tsx | GET /api/lab/orders | ⬜ | ⬜ |
| lab | PhlebotomyQueueScreen | modules/lab.tsx | GET /api/lab/phlebotomy-queue, PATCH …/{id}/status | ⬜ | ⬜ |
| lab | CriticalAlertsScreen | modules/lab.tsx | GET /api/lab/critical-alerts, POST …/{id}/acknowledge | ⬜ | ⬜ |
| lab | TatAnalyticsScreen | modules/lab.tsx | GET /api/lab/analytics/tat | ⬜ | ⬜ |
| lab | ScanSampleScreen (scanner) | lab/scan-sample.tsx | GET /api/lab/orders, POST /api/lab/orders/{id}/collect | ⬜ | ⬜ |
| lab | QcStatusScreen (Westgard) | lab/qc-status.tsx | GET /api/lab/qc-results | ⬜ | ⬜ |
| blood-bank (5) | BloodBankHome | modules/blood-bank.tsx | GET /api/blood-bank/components | 🟨 | 🟨 |
| blood-bank | InventoryScreen | modules/blood-bank.tsx | GET /api/blood-bank/components | ⬜ | ⬜ |
| blood-bank | CrossmatchScreen | modules/blood-bank.tsx | GET /api/blood-bank/crossmatch | ⬜ | ⬜ |
| blood-bank | TransfusionScreen | modules/blood-bank.tsx | GET /api/blood-bank/transfusions | ⬜ | ⬜ |
| blood-bank | DonorScreen | modules/blood-bank.tsx | GET /api/blood-bank/donors | ⬜ | ⬜ |
| blood-bank | TtiScreen | modules/blood-bank.tsx | GET /api/blood-bank/tti-report, /api/blood-bank/hemovigilance | ⬜ | ⬜ |
| billing (5) | BillingHome | modules/billing.tsx | GET /api/billing/invoices | 🟨 | 🟨 |
| billing | InvoicesScreen | modules/billing.tsx | GET /api/billing/invoices | ⬜ | ⬜ |
| bme (5) | BmeHome | modules/bme.tsx | GET /api/bme/equipment | 🟨 | 🟨 |
| bme | EquipmentScreen | modules/bme.tsx | GET /api/bme/equipment | ⬜ | ⬜ |
| bme | ReportBreakdownScreen | bme/report-breakdown.tsx | GET /api/bme/equipment, POST /api/bme/breakdowns | ⬜ | ⬜ |
| facilities (5) | FacilitiesHome | modules/facilities.tsx | GET /api/facilities/work-orders | 🟨 | 🟨 |
| facilities | WorkOrdersScreen | modules/facilities.tsx | GET /api/facilities/work-orders | ⬜ | ⬜ |
| facilities | RaiseWorkOrderScreen | facilities/raise-work-order.tsx | POST /api/facilities/work-orders | ⬜ | ⬜ |
| facilities | GasReadingScreen | facilities/gas-reading.tsx | POST /api/facilities/gas-readings | ⬜ | ⬜ |
| facilities | FireRoundScreen (scanner) | facilities/fire-round.tsx | GET /api/facilities/fire-equipment, POST /api/facilities/fire-inspections | ⬜ | ⬜ |
| facilities | WaterTestScreen | facilities/water-test.tsx | POST /api/facilities/water-tests | ⬜ | ⬜ |
| housekeeping (5) | HousekeepingHome | modules/housekeeping.tsx | GET /api/housekeeping/turnarounds | 🟨 | 🟨 |
| housekeeping | CleaningScreen | modules/housekeeping.tsx | GET /api/housekeeping/cleaning/tasks | ⬜ | ⬜ |
| housekeeping | BedTurnaroundScreen | housekeeping/bed-turnaround.tsx | GET /api/housekeeping/turnarounds, POST …/{id}/complete | ⬜ | ⬜ |
| security (5) | SecurityHome | modules/security.tsx | GET /api/security/incidents | 🟨 | 🟨 |
| security | IncidentsScreen | modules/security.tsx | GET /api/security/incidents | ⬜ | ⬜ |
| security | ReportIncidentScreen | security/report-incident.tsx | POST /api/security/incidents | ⬜ | ⬜ |
| security | TagAlertsScreen (Code Pink) | security/tag-alerts.tsx | GET /api/security/tag-alerts, POST …/{id}/resolve | ⬜ | ⬜ |
| hr (5) | HrHome | modules/hr.tsx | — | 🟨 | 🟨 |
| hr | AttendanceScreen | modules/hr.tsx | GET /api/hr/attendance | ⬜ | ⬜ |
| device-sync (6) | SyncSetupScreen | mobile-shell/pairing/sync-setup-screen.tsx | local node keypair (Rust `generateNodeIdentity`) | 🟨 | 🟨 |
| shell | StaffLoginGate | login-gate.tsx | POST /api/auth/login | ✅ | ✅ |
| shell (2) | EmergencyFlash overlay (1 Hz cap, reduced-motion banner, triple-tap silence, Respond) | components/emergency-flash.tsx | GET /api/emergency/codes, /api/nurse/code-blue/* | ✅ | ✅ |

Shell features to carry: BarcodeScanner (4 screens), BiometricUnlockGate, NotificationBridge
(`ws(s)://<base>/api/ws/notifications?token=`, foreground only, torn down on token change),
push registration, OfflineProvider (Rust AuthzCache — ✅ wrapped as `OfflineAuthz` both platforms).
Detox specs to re-implement natively: bcma, doctor-consultation, front-office, nurse-calls,
opd-queue, registration-journey (✅ registration-journey = SignInJourney on both).

## 2. apps/mobile-patient → MedBrainsPatient (8 modules, 8 screens + login)

Hospital tab always; Health tab (today, bands) only when `/api/portal/entitlements` opens it.

| Module (phase 4) | Screen | Endpoints | iOS | Android |
|---|---|---|---|---|
| appointments | AppointmentsScreen (Coming up / Earlier) | GET /api/portal/appointments | ✅ | ✅ |
| lab-reports | LabReportsScreen (flags emphasised, ≤200) | GET /api/portal/lab-reports | ✅ | ✅ |
| prescriptions | PrescriptionsScreen (≤200) | GET /api/portal/prescriptions | ✅ | ✅ |
| bills | BillsScreen ("still to pay" headline) | GET /api/portal/bills | ✅ | ✅ |
| consent | ConsentScreen (DPDP tiles; RN unwired) | /api/portal/consents (to wire) | ✅ | ✅ |
| family-share | FamilyShareScreen (RN unwired) | /api/portal/family-share (to wire) | ✅ | ✅ |
| today | TodayScreen (companion daily brief, local) | none (local record) | ✅ | ✅ |
| bands | BandsScreen (wearables; pairing unwired) | none | ✅ | ✅ |
| shell | PatientLoginGate (OTP; ABHA next) | POST /api/portal/auth/request-otp, /verify | ✅ | ✅ |
| shell | useCompanionAccess entitlement gate | GET /api/portal/entitlements | ✅ | ✅ |

## 3. apps/mobile-camp → MedBrainsCamp (2 modules, 10 screens + login)

Offline is app-owned: AES-GCM packet + event outbox (not CRDT). Native: Keychain/Keystore
key, SwiftData/Room store, same `CampSyncInboundEvent` outbox.

| Screen (phase 6) | Endpoints / storage | iOS | Android |
|---|---|---|---|
| CampHome | listCamps, packet meta, outbox state | ⬜ | ⬜ |
| CampListScreen | GET /api/camp/camps | ⬜ | ⬜ |
| PacketScreen (+ OperationModeChooser, wipe) | GET /api/camp/camps/{id}/packet; encrypted packet store | ⬜ | ⬜ |
| PatientRosterScreen | packet / GET /api/patients | ⬜ | ⬜ |
| PatientChartScreen (8 tabs) | packet + outbox | ⬜ | ⬜ |
| LivePatientChartScreen | GET /api/patients/{id}/context | ⬜ | ⬜ |
| IntakeScreen (screening + clinical fields) | outbox; /api/setup/departments, /api/setup/doctors | ⬜ | ⬜ |
| FieldOpsScreen | packet | ⬜ | ⬜ |
| SyncCenterScreen | POST /api/camp/sync/inbound | ⬜ | ⬜ |
| SyncSetupScreen (device-sync) | local node keypair | 🟨 | 🟨 |
| CampLoginGate | POST /api/auth/login | ⬜ | ⬜ |

## 4. apps/mobile-vendor → MedBrainsVendor (1 skeleton screen)

| Screen | Note | iOS | Android |
|---|---|---|---|
| BmeAmcScreen | static card; backend `/api/portal/vendor/work-orders` does not exist — build it with the screen, not before | ⬜ | ⬜ |

## 5. apps/mobile (RN CLI, no registry) → folded into MedBrainsStaff / MedBrainsPatient

26 screen components over 4 role stacks. Most duplicate mobile-staff; the four phlebotomy
screens are the salvage. Each row names its native home.

| Stack | Screen | Native home | iOS | Android |
|---|---|---|---|---|
| Phlebo | CollectionListScreen | Staff · lab (home collections) | ⬜ | ⬜ |
| Phlebo | CollectionDetailScreen | Staff · lab | ⬜ | ⬜ |
| Phlebo | SampleCollectionScreen (scanner, specimen rules) | Staff · lab | ⬜ | ⬜ |
| Phlebo | TripSummaryScreen | Staff · lab | ⬜ | ⬜ |
| Staff | StaffDashboard, TokenBoardsScreen (6 boards) | Staff · reception/queue | ⬜ | ⬜ |
| Staff | CampRegistrationScreen (offline retry queue) | Camp · IntakeScreen | ⬜ | ⬜ |
| Staff | PatientSearch, PatientDetail, PatientCareContext, PatientPharmacy | Staff · reception | ⬜ | ⬜ |
| Staff | QueueScreen | Staff · reception/QueueBoard | ⬜ | ⬜ |
| Staff | VitalsEntryScreen | Staff · nurse/BedsideAction | ⬜ | ⬜ |
| Staff | PrescriptionScreen (catalogue search) | Staff · doctor | ⬜ | ⬜ |
| Staff | LabOrderScreen, RadiologyOrderScreen | Staff · doctor | ⬜ | ⬜ |
| Staff | LabResultsViewScreen, ConsultationNotesScreen | Staff · doctor | ⬜ | ⬜ |
| Patient | PatientDashboard, Appointments, LabResults, Prescriptions, Billing, Profile, QueuePosition | Patient app | ⬜ | ⬜ |
| — | HomeScreen (unrouted); AppointmentBook/BillDetail/Payment (declared, never built) | drop | — | — |

## 6. apps/tv → MedBrainsTV, Compose for TV (11 boards + pairing)

Polling only today (5 s / 10 s react-query); native keeps polling and may add the
notifications WebSocket later. Device-code pairing (`pollDeviceToken`) is the login.

| Board (phase 7) | TV app codes | Endpoint | Poll | Android TV |
|---|---|---|---|---|
| QueueScreen (OPD) | TV-Queue, TV-DoctorRoom, Desktop-Kiosk | /tokens/board, /tokens/board/metrics | 5 s | ⬜ |
| CampQueueScreen | TV-Queue | /tokens/camp-board?camp_id= | 5 s | ⬜ |
| LabStatusScreen | TV-Lab | /tv/queue/lab | 10 s | ⬜ |
| RadiologyQueueScreen | TV-Radiology | /tv/queue/radiology/{modality} | 10 s | ⬜ |
| EmergencyTriageScreen | TV-Emergency | /tv/queue/er | 5 s | ⬜ |
| PharmacyQueueScreen | TV-Pharmacy | /tv/queue/pharmacy | 10 s | ⬜ |
| BillingQueueScreen | TV-Billing | /tv/queue/billing | 10 s | ⬜ |
| BedStatusScreen | TV-Ward, TV-ICU | /tv/queue/beds/{wardType} | 10 s | ⬜ |
| DigitalSignageScreen | TV-Notice, TV-Wayfinding, TV-Education, TV-Cafeteria, TV-Donor | static placeholder | — | ⬜ |
| DoctorRoomScreen | TV-DoctorRoom | /tokens/board (scoped) | 5 s | ⬜ |
| NurseCallsScreen | TV-Ward, TV-ICU | /bedside/nurse-calls/active[?ward_id=] | 10 s | ⬜ |
| TvPairingScreen + TvBoard chrome + TvErrorBoundary + TvFeedStatusBanner | all | /api/device-pairing/* | — | ⬜ |

## 7. Journeys (packages/e2e-mobile/src/journeys.ts)

14 journeys: MJ-NUR-001/002 (automated), MJ-NUR-003/004, MJ-DOC-001 (automated),
MJ-REC-001/002/003 (automated), MJ-REC-004/005/006, MJ-TV-001/002, MJ-SEC-001. Each
converted module re-implements its journeys as XCUITest + Compose tests; `automationStatus`
stays honest. No journey exists yet for patient, camp, vendor — they are written when those
apps convert.
