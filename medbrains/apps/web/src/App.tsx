import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { RouteErrorBoundary } from "./components/AppErrorBoundary";
import { PageSkeleton } from "./components/PageSkeleton";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SpotlightProvider } from "./components/SpotlightProvider";
import { TopProgressBar } from "./components/TopProgressBar";
import { AppLayout } from "./layouts/AppLayout";
import { TenantConfigProvider } from "./providers/TenantConfigProvider";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!pathname) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
  return null;
}

const LandingPage = lazy(() => import("./pages/landing").then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import("./pages/login").then((m) => ({ default: m.LoginPage })));
const TermsPage = lazy(() => import("./pages/legal").then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import("./pages/legal").then((m) => ({ default: m.PrivacyPage })));
const OnboardingPage = lazy(() =>
  import("./pages/onboarding").then((m) => ({ default: m.OnboardingPage })),
);
const VerifyEmailPage = lazy(() =>
  import("./pages/verify-email").then((m) => ({ default: m.VerifyEmailPage })),
);
const PatientPortalPage = lazy(() =>
  import("./pages/portal").then((m) => ({ default: m.PatientPortalPage })),
);
const PublicEnquiryPage = lazy(() =>
  import("./pages/public-enquiry").then((m) => ({ default: m.PublicEnquiryPage })),
);
const PublicBookingPage = lazy(() =>
  import("./pages/public-booking").then((m) => ({ default: m.PublicBookingPage })),
);
const QueueStatusPage = lazy(() =>
  import("./pages/queue-status").then((m) => ({ default: m.QueueStatusPage })),
);
const VerifyPrescriptionPage = lazy(() =>
  import("./pages/verify-prescription").then((m) => ({ default: m.VerifyPrescriptionPage })),
);
const KioskSelfCheckinPage = lazy(() =>
  import("./pages/kiosk/self-checkin").then((m) => ({ default: m.KioskSelfCheckinPage })),
);
const AcceptInvitePage = lazy(() =>
  import("./pages/accept-invite").then((m) => ({ default: m.AcceptInvitePage })),
);
const ForcePasswordChangePage = lazy(() =>
  import("./pages/force-password-change").then((m) => ({ default: m.ForcePasswordChangePage })),
);
const ForgotPasswordPage = lazy(() =>
  import("./pages/forgot-password").then((m) => ({ default: m.ForgotPasswordPage })),
);
const MfaEnrollPage = lazy(() =>
  import("./pages/mfa-enroll").then((m) => ({ default: m.MfaEnrollPage })),
);
const DemoDicomFixturesPage = lazy(() =>
  import("./pages/demo-dicom-fixtures").then((m) => ({ default: m.DemoDicomFixturesPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/dashboard").then((m) => ({ default: m.DashboardPage })),
);
const SetupCenterPage = lazy(() =>
  import("./pages/setup").then((m) => ({ default: m.SetupCenterPage })),
);
const DeploymentCostPage = lazy(() =>
  import("./pages/setup/deployment").then((m) => ({ default: m.DeploymentCostPage })),
);
const InfrastructurePage = lazy(() =>
  import("./pages/setup/infrastructure").then((m) => ({ default: m.InfrastructurePage })),
);
const SimulatorPage = lazy(() =>
  import("./pages/admin/simulator").then((m) => ({ default: m.SimulatorPage })),
);
const DomainsEmailPage = lazy(() =>
  import("./pages/setup/domains-email").then((m) => ({ default: m.DomainsEmailPage })),
);
const PatientsPage = lazy(() =>
  import("./pages/patients").then((m) => ({ default: m.PatientsPage })),
);
const PatientRegisterPage = lazy(() =>
  import("./pages/patients").then((m) => ({ default: m.PatientRegisterPage })),
);
const AssistantPage = lazy(() =>
  import("./pages/assistant").then((m) => ({ default: m.AssistantPage })),
);
const RemoteAccessPage = lazy(() =>
  import("./pages/remote-access").then((m) => ({ default: m.RemoteAccessPage })),
);
const PatientDetailPage = lazy(() =>
  import("./pages/patient-detail").then((m) => ({ default: m.PatientDetailPage })),
);
const PatientEditPage = lazy(() =>
  import("./pages/patient-edit").then((m) => ({ default: m.PatientEditPage })),
);
const OpdPage = lazy(() => import("./pages/opd").then((m) => ({ default: m.OpdPage })));
const OpdNewVisitPage = lazy(() =>
  import("./pages/opd").then((m) => ({ default: m.OpdNewVisitPage })),
);
const OpdEncounterPage = lazy(() =>
  import("./pages/opd").then((m) => ({ default: m.OpdEncounterPage })),
);
const OpdVitalsPage = lazy(() => import("./pages/opd").then((m) => ({ default: m.OpdVitalsPage })));
const AppointmentsPage = lazy(() =>
  import("./pages/appointments").then((m) => ({ default: m.AppointmentsPage })),
);
const PgLogbookPage = lazy(() =>
  import("./pages/pg-logbook").then((m) => ({ default: m.PgLogbookPage })),
);
const LabPage = lazy(() => import("./pages/lab").then((m) => ({ default: m.LabPage })));
const LabOrderCreatePage = lazy(() =>
  import("./pages/lab/order-create").then((m) => ({ default: m.LabOrderCreatePage })),
);
const LabOrderDetailPage = lazy(() =>
  import("./pages/lab").then((m) => ({ default: m.LabOrderDetailPage })),
);
const PharmacyPage = lazy(() =>
  import("./pages/pharmacy").then((m) => ({ default: m.PharmacyPage })),
);
const WardStockPage = lazy(() =>
  import("./pages/ward-stock").then((m) => ({ default: m.WardStockPage })),
);
const PharmacyOrderCreatePage = lazy(() =>
  import("./pages/pharmacy").then((m) => ({ default: m.PharmacyOrderCreatePage })),
);
const PharmacyOrderDetailPage = lazy(() =>
  import("./pages/pharmacy").then((m) => ({ default: m.PharmacyOrderDetailPage })),
);
const PharmacyFinancePage = lazy(() =>
  import("./pages/pharmacy-finance").then((m) => ({ default: m.PharmacyFinancePage })),
);
const FulfilmentQueuePage = lazy(() =>
  import("./pages/pharmacy/fulfilment-queue").then((m) => ({ default: m.FulfilmentQueuePage })),
);
const VerifyPackPage = lazy(() =>
  import("./pages/pharmacy/verify-view").then((m) => ({ default: m.VerifyPackPage })),
);
const DispatchPage = lazy(() =>
  import("./pages/pharmacy/dispatch-view").then((m) => ({ default: m.DispatchPage })),
);
const RadiologyPage = lazy(() =>
  import("./pages/radiology").then((m) => ({ default: m.RadiologyPage })),
);
const BillingPage = lazy(() => import("./pages/billing").then((m) => ({ default: m.BillingPage })));
const BillingCounterPage = lazy(() =>
  import("./pages/billing-counter").then((m) => ({ default: m.BillingCounterPage })),
);
const BillingWorklistPage = lazy(() =>
  import("./pages/billing-worklist").then((m) => ({ default: m.BillingWorklistPage })),
);
const BillingTpaPipelinePage = lazy(() =>
  import("./pages/billing-tpa-pipeline").then((m) => ({ default: m.BillingTpaPipelinePage })),
);
const BillingInvoiceDetailPage = lazy(() =>
  import("./pages/billing").then((m) => ({ default: m.BillingInvoiceDetailPage })),
);
const CssdPage = lazy(() => import("./pages/cssd").then((m) => ({ default: m.CssdPage })));
const DietKitchenPage = lazy(() =>
  import("./pages/diet-kitchen").then((m) => ({ default: m.DietKitchenPage })),
);
const EmergencyPage = lazy(() =>
  import("./pages/emergency").then((m) => ({ default: m.EmergencyPage })),
);
const EmergencyVisitCreatePage = lazy(() =>
  import("./pages/emergency").then((m) => ({ default: m.EmergencyVisitCreatePage })),
);
const EmergencyVisitDetailPage = lazy(() =>
  import("./pages/emergency").then((m) => ({ default: m.EmergencyVisitDetailPage })),
);
const BloodBankPage = lazy(() =>
  import("./pages/blood-bank").then((m) => ({ default: m.BloodBankPage })),
);
const IcuPage = lazy(() => import("./pages/icu").then((m) => ({ default: m.IcuPage })));
const IpdPage = lazy(() => import("./pages/ipd").then((m) => ({ default: m.IpdPage })));
const IpdNewAdmissionPage = lazy(() =>
  import("./pages/ipd").then((m) => ({ default: m.IpdNewAdmissionPage })),
);
const IpdAdmissionDetailPage = lazy(() =>
  import("./pages/ipd").then((m) => ({ default: m.IpdAdmissionDetailPage })),
);
const NurseActivitiesPage = lazy(() =>
  import("./pages/nurse-activities").then((m) => ({ default: m.NurseActivitiesPage })),
);
const CareViewPage = lazy(() =>
  import("./pages/care-view").then((m) => ({ default: m.CareViewPage })),
);
const DirectoryPage = lazy(() =>
  import("./pages/directory").then((m) => ({ default: m.DirectoryPage })),
);
const CaseSheetReviewPage = lazy(() =>
  import("./pages/case-sheet-review").then((m) => ({ default: m.CaseSheetReviewPage })),
);
const InterHospitalTransfersPage = lazy(() =>
  import("./pages/inter-hospital-transfers").then((m) => ({
    default: m.InterHospitalTransfersPage,
  })),
);
const HospitalGroupsPage = lazy(() =>
  import("./pages/hospital-groups").then((m) => ({ default: m.HospitalGroupsPage })),
);
const InterHospitalStockPage = lazy(() =>
  import("./pages/inter-hospital-stock").then((m) => ({ default: m.InterHospitalStockPage })),
);
const HomeHealthcarePage = lazy(() =>
  import("./pages/home-healthcare").then((m) => ({ default: m.HomeHealthcarePage })),
);
const HomeVisitsPage = lazy(() =>
  import("./pages/home-visits").then((m) => ({ default: m.HomeVisitsPage })),
);
const ClinicalTrialsPage = lazy(() =>
  import("./pages/clinical-trials").then((m) => ({ default: m.ClinicalTrialsPage })),
);
const LongTermCarePage = lazy(() =>
  import("./pages/long-term-care").then((m) => ({ default: m.LongTermCarePage })),
);
const HealthPackagesPage = lazy(() =>
  import("./pages/health-packages").then((m) => ({ default: m.HealthPackagesPage })),
);
const TestimonialsPage = lazy(() =>
  import("./pages/testimonials").then((m) => ({ default: m.TestimonialsPage })),
);
const MicrositeSettingsPage = lazy(() =>
  import("./pages/microsite-settings").then((m) => ({ default: m.MicrositeSettingsPage })),
);
const OtPage = lazy(() => import("./pages/ot").then((m) => ({ default: m.OtPage })));
const QualityPage = lazy(() => import("./pages/quality").then((m) => ({ default: m.QualityPage })));
const FrontOfficePage = lazy(() =>
  import("./pages/front-office").then((m) => ({ default: m.FrontOfficePage })),
);
const TokenBoardPage = lazy(() =>
  import("./pages/token-board").then((m) => ({ default: m.TokenBoardPage })),
);
const TokenConsolePage = lazy(() =>
  import("./pages/token-console").then((m) => ({ default: m.TokenConsolePage })),
);
const HealthPulsePage = lazy(() =>
  import("./pages/health-pulse").then((m) => ({ default: m.HealthPulsePage })),
);
const TokenDisplayPage = lazy(() =>
  import("./pages/token-display").then((m) => ({ default: m.TokenDisplayPage })),
);
const HousekeepingPage = lazy(() =>
  import("./pages/housekeeping").then((m) => ({ default: m.HousekeepingPage })),
);
const HrPage = lazy(() => import("./pages/hr").then((m) => ({ default: m.HrPage })));
const PayrollPage = lazy(() =>
  import("./pages/hr/payroll").then((m) => ({ default: m.PayrollPage })),
);
const ProfilePage = lazy(() => import("./pages/profile").then((m) => ({ default: m.ProfilePage })));
const BmePage = lazy(() => import("./pages/bme").then((m) => ({ default: m.BmePage })));
const MaterialsPage = lazy(() =>
  import("./pages/materials").then((m) => ({ default: m.MaterialsPage })),
);
const AmbulancePage = lazy(() =>
  import("./pages/ambulance").then((m) => ({ default: m.AmbulancePage })),
);
const CommunicationsPage = lazy(() =>
  import("./pages/communications").then((m) => ({ default: m.CommunicationsPage })),
);
const CampPage = lazy(() => import("./pages/camp").then((m) => ({ default: m.CampPage })));
const TelemedicinePage = lazy(() =>
  import("./pages/telemedicine").then((m) => ({ default: m.TelemedicinePage })),
);
const CampCreatePage = lazy(() =>
  import("./pages/camp/camp-create").then((m) => ({ default: m.CampCreatePage })),
);
const CampWorkPage = lazy(() => import("./pages/camp").then((m) => ({ default: m.CampWorkPage })));
const CampPlanEditPage = lazy(() =>
  import("./pages/camp").then((m) => ({ default: m.CampPlanEditPage })),
);
const CampRegistrationCreatePage = lazy(() =>
  import("./pages/camp/registration-create").then((m) => ({
    default: m.CampRegistrationCreatePage,
  })),
);
const CampClinicalRoutePage = lazy(() =>
  import("./pages/camp/clinical-route").then((m) => ({ default: m.CampClinicalRoutePage })),
);
const CampScreeningCreatePage = lazy(() =>
  import("./pages/camp/screening-create").then((m) => ({ default: m.CampScreeningCreatePage })),
);
const CampLabSampleCreatePage = lazy(() =>
  import("./pages/camp/lab-sample-create").then((m) => ({
    default: m.CampLabSampleCreatePage,
  })),
);
const CampTeamMemberAddPage = lazy(() =>
  import("./pages/camp").then((m) => ({ default: m.CampTeamMemberAddPage })),
);
const CampAssetReturnPage = lazy(() =>
  import("./pages/camp").then((m) => ({ default: m.CampAssetReturnPage })),
);
const CampBillingCreatePage = lazy(() =>
  import("./pages/camp").then((m) => ({ default: m.CampBillingCreatePage })),
);
const CampFollowupCreatePage = lazy(() =>
  import("./pages/camp").then((m) => ({ default: m.CampFollowupCreatePage })),
);
const BedsidePortalPage = lazy(() =>
  import("./pages/bedside-portal").then((m) => ({ default: m.BedsidePortalPage })),
);
const CommandCenterPage = lazy(() =>
  import("./pages/command-center").then((m) => ({ default: m.CommandCenterPage })),
);
const ConsentPage = lazy(() => import("./pages/consent").then((m) => ({ default: m.ConsentPage })));
const MarketingPage = lazy(() =>
  import("./pages/marketing").then((m) => ({ default: m.MarketingPage })),
);
const FacilitiesPage = lazy(() =>
  import("./pages/facilities").then((m) => ({ default: m.FacilitiesPage })),
);
const InfectionControlPage = lazy(() =>
  import("./pages/infection-control").then((m) => ({ default: m.InfectionControlPage })),
);
const MrdPage = lazy(() => import("./pages/mrd").then((m) => ({ default: m.MrdPage })));
const SecurityPage = lazy(() =>
  import("./pages/security").then((m) => ({ default: m.SecurityPage })),
);
const RegulatoryPage = lazy(() =>
  import("./pages/regulatory").then((m) => ({ default: m.RegulatoryPage })),
);
const InsurancePage = lazy(() =>
  import("./pages/insurance").then((m) => ({ default: m.InsurancePage })),
);
const OrderSetsPage = lazy(() =>
  import("./pages/order-sets").then((m) => ({ default: m.OrderSetsPage })),
);
const ChronicCarePage = lazy(() =>
  import("./pages/chronic-care").then((m) => ({ default: m.ChronicCarePage })),
);
const OccupationalHealthPage = lazy(() =>
  import("./pages/occupational-health").then((m) => ({ default: m.OccupationalHealthPage })),
);
const UtilizationReviewPage = lazy(() =>
  import("./pages/utilization-review").then((m) => ({ default: m.UtilizationReviewPage })),
);
const CaseManagementPage = lazy(() =>
  import("./pages/case-management").then((m) => ({ default: m.CaseManagementPage })),
);
const SchedulingPage = lazy(() =>
  import("./pages/scheduling").then((m) => ({ default: m.SchedulingPage })),
);
const LmsPage = lazy(() => import("./pages/lms").then((m) => ({ default: m.LmsPage })));
const RetrospectivePage = lazy(() =>
  import("./pages/retrospective").then((m) => ({ default: m.RetrospectivePage })),
);
const SpecialtyIndexPage = lazy(() =>
  import("./pages/specialty").then((m) => ({ default: m.SpecialtyIndexPage })),
);
const CathLabPage = lazy(() =>
  import("./pages/specialty/cath-lab").then((m) => ({ default: m.CathLabPage })),
);
const OphthoPage = lazy(() =>
  import("./pages/specialty/ophtho").then((m) => ({ default: m.OphthoPage })),
);
const DentalPage = lazy(() =>
  import("./pages/specialty/dental").then((m) => ({ default: m.DentalPage })),
);
const EndoscopyPage = lazy(() =>
  import("./pages/specialty/endoscopy").then((m) => ({ default: m.EndoscopyPage })),
);
const PsychiatryPage = lazy(() =>
  import("./pages/specialty/psychiatry").then((m) => ({ default: m.PsychiatryPage })),
);
const PmrPage = lazy(() => import("./pages/specialty/pmr").then((m) => ({ default: m.PmrPage })));
const PalliativePage = lazy(() =>
  import("./pages/specialty/palliative").then((m) => ({ default: m.PalliativePage })),
);
const MaternityPage = lazy(() =>
  import("./pages/specialty/maternity").then((m) => ({ default: m.MaternityPage })),
);
const OtherSpecialtiesPage = lazy(() =>
  import("./pages/specialty/other").then((m) => ({ default: m.OtherSpecialtiesPage })),
);
const NabhIndicatorsPage = lazy(() => import("./pages/admin/nabh-indicators"));
const UsersPage = lazy(() => import("./pages/admin/users").then((m) => ({ default: m.UsersPage })));
const ApiKeysPage = lazy(() =>
  import("./pages/admin/api-keys").then((m) => ({ default: m.ApiKeysPage })),
);
const RolesPage = lazy(() => import("./pages/admin/roles").then((m) => ({ default: m.RolesPage })));
const GroupsPage = lazy(() => import("./pages/admin/groups"));
const SsoSettingsPage = lazy(() =>
  import("./pages/admin/sso").then((m) => ({ default: m.SsoSettingsPage })),
);
const AdminDoctorsPage = lazy(() =>
  import("./pages/admin/doctors").then((m) => ({ default: m.AdminDoctorsPage })),
);
const ApprovalsPage = lazy(() =>
  import("./pages/approvals").then((m) => ({ default: m.ApprovalsPage })),
);
const AccessRequestsPage = lazy(() =>
  import("./pages/admin/access-requests").then((m) => ({ default: m.AccessRequestsPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/admin/settings").then((m) => ({ default: m.SettingsPage })),
);
const OAuthCallbackPage = lazy(() =>
  import("./pages/OAuthCallbackPage").then((m) => ({ default: m.OAuthCallbackPage })),
);
const ClinicalKbPage = lazy(() =>
  import("./pages/clinical-kb").then((m) => ({ default: m.ClinicalKbPage })),
);
const DocumentTemplatesPage = lazy(() =>
  import("./pages/admin/document-templates").then((m) => ({
    default: m.DocumentTemplatesPage,
  })),
);
const IntegrationHubPage = lazy(() =>
  import("./pages/admin/integration-hub").then((m) => ({ default: m.IntegrationHubPage })),
);
const TvDisplaysPage = lazy(() =>
  import("./pages/tv-displays").then((m) => ({ default: m.TvDisplaysPage })),
);
const DoctorSchedulesPage = lazy(() =>
  import("./pages/admin/doctor-schedules").then((m) => ({ default: m.DoctorSchedulesPage })),
);
const DoctorSignoffsPage = lazy(() =>
  import("./pages/doctor/signoffs").then((m) => ({ default: m.SignoffsPage })),
);
const AnalyticsPage = lazy(() =>
  import("./pages/analytics").then((m) => ({ default: m.AnalyticsPage })),
);
const ReportsPage = lazy(() => import("./pages/reports").then((m) => ({ default: m.ReportsPage })));
const AuditPage = lazy(() => import("./pages/audit").then((m) => ({ default: m.AuditPage })));
const DocumentsPage = lazy(() =>
  import("./pages/documents").then((m) => ({ default: m.DocumentsPage })),
);
const DevicesPage = lazy(() =>
  import("./pages/admin/devices").then((m) => ({ default: m.DevicesPage })),
);
const ComponentsInputsPage = lazy(() =>
  import("./pages/components-inputs").then((m) => ({ default: m.ComponentsInputsPage })),
);
const PairedDevicesPage = lazy(() =>
  import("./pages/admin/paired-devices").then((m) => ({ default: m.PairedDevicesPage })),
);

export function App() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <ScrollToTop />
        <TopProgressBar />
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            {/* Scanned off a printed prescription — public by necessity. */}
            <Route path="/verify/rx/:token" element={<VerifyPrescriptionPage />} />
            {/* Scanned off the kiosk slip — the patient has no login. */}
            <Route path="/queue/:token" element={<QueueStatusPage />} />
            {/* Public self-service booking — off unless the tenant enables it. */}
            <Route path="/book/:tenantCode" element={<PublicBookingPage />} />
            {/* The hospital's own "contact us" form — off unless enabled. */}
            <Route path="/enquire/:tenantCode" element={<PublicEnquiryPage />} />
            {/* A patient reading their own records — own session, not staff auth. */}
            <Route path="/portal/:tenantCode" element={<PatientPortalPage />} />
            {/* Unattended self-service terminal in the lobby. */}
            <Route path="/kiosk/checkin" element={<KioskSelfCheckinPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/force-password-change" element={<ForcePasswordChangePage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/mfa-enroll" element={<MfaEnrollPage />} />

            {/* Full-screen TV / waiting-area display (authed, no app shell) */}
            <Route
              path="/token-display"
              element={
                <ProtectedRoute>
                  <TokenDisplayPage />
                </ProtectedRoute>
              }
            />

            {/* Protected */}
            <Route
              element={
                <ProtectedRoute>
                  <TenantConfigProvider>
                    <SpotlightProvider />
                    <AppLayout />
                  </TenantConfigProvider>
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="setup" element={<SetupCenterPage />} />
              <Route path="setup/deployment" element={<DeploymentCostPage />} />
              <Route path="setup/infrastructure" element={<InfrastructurePage />} />
              <Route path="admin/simulator" element={<SimulatorPage />} />
              <Route path="setup/domains-email" element={<DomainsEmailPage />} />
              <Route path="clinical-kb" element={<ClinicalKbPage />} />
              <Route path="oauth/callback" element={<OAuthCallbackPage />} />
              <Route path="components-inputs" element={<ComponentsInputsPage />} />
              <Route path="demo/dicom/*" element={<DemoDicomFixturesPage />} />
              <Route path="assistant" element={<AssistantPage />} />
              <Route path="remote-access" element={<RemoteAccessPage />} />
              <Route path="patients" element={<PatientsPage />} />
              <Route path="patients/register" element={<PatientRegisterPage />} />
              <Route path="patients/:id/edit" element={<PatientEditPage />} />
              <Route path="patients/:id" element={<PatientDetailPage />} />
              <Route path="opd" element={<OpdPage />} />
              <Route path="opd/new" element={<OpdNewVisitPage />} />
              <Route path="opd/encounters/:encounterId" element={<OpdEncounterPage />} />
              <Route path="opd/queue/:queueEntryId/vitals" element={<OpdVitalsPage />} />
              <Route path="opd/appointments" element={<AppointmentsPage />} />
              <Route path="opd/pg-logbook" element={<PgLogbookPage />} />
              <Route path="doctor/signoffs" element={<DoctorSignoffsPage />} />
              <Route path="lab" element={<LabPage />} />
              <Route path="lab/orders/new" element={<LabOrderCreatePage />} />
              <Route path="lab/orders/:orderId" element={<LabOrderDetailPage />} />
              <Route path="radiology" element={<RadiologyPage />} />
              <Route path="pharmacy" element={<PharmacyPage />} />
              <Route path="ward-stock" element={<WardStockPage />} />
              <Route path="pharmacy/orders/new" element={<PharmacyOrderCreatePage />} />
              <Route path="pharmacy/orders/:orderId" element={<PharmacyOrderDetailPage />} />
              <Route path="pharmacy/finance" element={<PharmacyFinancePage />} />
              <Route path="pharmacy/fulfilment" element={<FulfilmentQueuePage />} />
              <Route path="pharmacy/fulfilment/:orderId" element={<VerifyPackPage />} />
              <Route path="pharmacy/dispatch" element={<DispatchPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="billing/counter" element={<BillingCounterPage />} />
              <Route path="billing/worklist" element={<BillingWorklistPage />} />
              <Route path="billing/tpa-pipeline" element={<BillingTpaPipelinePage />} />
              <Route path="billing/invoices/:invoiceId" element={<BillingInvoiceDetailPage />} />
              <Route path="materials" element={<MaterialsPage />} />
              {/* Consolidated into the unified Materials workspace. */}
              <Route path="indent/*" element={<Navigate to="/materials" replace />} />
              <Route path="procurement" element={<Navigate to="/materials" replace />} />
              <Route path="quality" element={<QualityPage />} />
              <Route path="front-office" element={<FrontOfficePage />} />
              <Route path="health-pulse" element={<HealthPulsePage />} />
              <Route path="token-board" element={<TokenBoardPage />} />
              <Route path="token-console" element={<TokenConsolePage />} />
              <Route path="housekeeping" element={<HousekeepingPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="hr" element={<HrPage />} />
              <Route path="hr/payroll" element={<PayrollPage />} />
              <Route path="bme" element={<BmePage />} />
              <Route path="assets" element={<Navigate to="/materials" replace />} />
              <Route path="ambulance" element={<AmbulancePage />} />
              <Route path="communications" element={<CommunicationsPage />} />
              <Route path="camp" element={<CampPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="telemedicine" element={<TelemedicinePage />} />
              <Route path="camp/new" element={<CampCreatePage />} />
              <Route path="camp/:campId/work" element={<CampWorkPage />} />
              <Route path="camp/:campId/work/plan" element={<CampPlanEditPage />} />
              <Route path="camp/:campId/work/team/new" element={<CampTeamMemberAddPage />} />
              <Route
                path="camp/:campId/work/assets/:reservationId/return"
                element={<CampAssetReturnPage />}
              />
              <Route
                path="camp/:campId/work/screenings/new"
                element={<CampScreeningCreatePage />}
              />
              <Route
                path="camp/:campId/work/registrations/new"
                element={<CampRegistrationCreatePage />}
              />
              <Route path="camp/:campId/work/lab/new" element={<CampLabSampleCreatePage />} />
              <Route path="camp/:campId/work/billing/new" element={<CampBillingCreatePage />} />
              <Route path="camp/:campId/work/followups/new" element={<CampFollowupCreatePage />} />
              <Route
                path="camp/:campId/work/registrations/:registrationId/clinical-route"
                element={<CampClinicalRoutePage />}
              />
              <Route path="command-center" element={<CommandCenterPage />} />
              <Route path="facilities" element={<FacilitiesPage />} />
              <Route path="consent" element={<ConsentPage />} />
              <Route path="marketing" element={<MarketingPage />} />
              <Route path="infection-control" element={<InfectionControlPage />} />
              <Route path="mrd" element={<MrdPage />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="insurance" element={<InsurancePage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/nabh" element={<NabhIndicatorsPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="regulatory" element={<RegulatoryPage />} />
              <Route path="order-sets" element={<OrderSetsPage />} />
              <Route path="chronic-care" element={<ChronicCarePage />} />
              <Route path="occupational-health" element={<OccupationalHealthPage />} />
              <Route path="utilization-review" element={<UtilizationReviewPage />} />
              <Route path="case-management" element={<CaseManagementPage />} />
              <Route path="scheduling" element={<SchedulingPage />} />
              <Route path="lms" element={<LmsPage />} />
              <Route path="retrospective" element={<RetrospectivePage />} />
              <Route path="specialty">
                <Route index element={<SpecialtyIndexPage />} />
                <Route path="ophthalmology" element={<OphthoPage />} />
                <Route path="dental" element={<DentalPage />} />
                <Route path="cath-lab" element={<CathLabPage />} />
                <Route path="endoscopy" element={<EndoscopyPage />} />
                <Route path="psychiatry" element={<PsychiatryPage />} />
                <Route path="pmr" element={<PmrPage />} />
                <Route path="palliative" element={<PalliativePage />} />
                <Route path="maternity" element={<MaternityPage />} />
                <Route path="other" element={<OtherSpecialtiesPage />} />
              </Route>
              <Route path="cssd" element={<CssdPage />} />
              <Route path="diet-kitchen" element={<DietKitchenPage />} />
              <Route path="emergency" element={<EmergencyPage />} />
              <Route path="emergency/visits/new" element={<EmergencyVisitCreatePage />} />
              <Route path="emergency/visits/:visitId" element={<EmergencyVisitDetailPage />} />
              <Route path="blood-bank" element={<BloodBankPage />} />
              <Route path="icu" element={<IcuPage />} />
              <Route path="ipd" element={<IpdPage />} />
              <Route path="ipd/new" element={<IpdNewAdmissionPage />} />
              <Route path="ipd/admissions/:admissionId" element={<IpdAdmissionDetailPage />} />
              <Route path="nurse" element={<NurseActivitiesPage />} />
              <Route path="bedside-portal" element={<BedsidePortalPage />} />
              <Route path="care-view" element={<CareViewPage />} />
              <Route path="directory" element={<DirectoryPage />} />
              <Route path="case-sheet-review" element={<CaseSheetReviewPage />} />
              <Route path="inter-hospital-transfers" element={<InterHospitalTransfersPage />} />
              <Route path="hospital-groups" element={<HospitalGroupsPage />} />
              <Route path="inter-hospital-stock" element={<InterHospitalStockPage />} />
              <Route path="home-healthcare" element={<HomeHealthcarePage />} />
              <Route path="home-visits" element={<HomeVisitsPage />} />
              <Route path="clinical-trials" element={<ClinicalTrialsPage />} />
              <Route path="long-term-care" element={<LongTermCarePage />} />
              <Route path="health-packages" element={<HealthPackagesPage />} />
              <Route path="testimonials" element={<TestimonialsPage />} />
              <Route path="microsite-settings" element={<MicrositeSettingsPage />} />
              <Route path="ot" element={<OtPage />} />
              <Route path="admin">
                <Route index element={<Navigate to="users" replace />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="doctors" element={<AdminDoctorsPage />} />
                <Route path="nabh-indicators" element={<NabhIndicatorsPage />} />
                <Route path="api-keys" element={<ApiKeysPage />} />
                <Route path="roles" element={<RolesPage />} />
                <Route path="groups" element={<GroupsPage />} />
                <Route path="sso" element={<SsoSettingsPage />} />
                <Route path="access-requests" element={<AccessRequestsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="document-templates" element={<DocumentTemplatesPage />} />
                <Route
                  path="device-integrations"
                  element={<Navigate to="/admin/settings#device-integrations" replace />}
                />
                <Route path="integration-hub" element={<IntegrationHubPage />} />
                <Route
                  path="integration-builder"
                  element={<Navigate to="/admin/integration-hub" replace />}
                />
                <Route
                  path="integration-builder/:id"
                  element={<Navigate to="/admin/integration-hub" replace />}
                />
                <Route path="tv-displays" element={<TvDisplaysPage />} />
                <Route path="doctor-schedules" element={<DoctorSchedulesPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="devices" element={<DevicesPage />} />
                <Route path="paired-devices" element={<PairedDevicesPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
