import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { TopProgressBar } from "./components/TopProgressBar";
import { SpotlightProvider } from "./components/SpotlightProvider";
import { PageSkeleton } from "./components/PageSkeleton";
import { AppLayout } from "./layouts/AppLayout";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
  return null;
}

const LandingPage = lazy(() => import("./pages/landing").then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import("./pages/login").then((m) => ({ default: m.LoginPage })));
const OnboardingPage = lazy(() => import("./pages/onboarding").then((m) => ({ default: m.OnboardingPage })));
const DashboardPage = lazy(() => import("./pages/dashboard").then((m) => ({ default: m.DashboardPage })));
const PatientsPage = lazy(() => import("./pages/patients").then((m) => ({ default: m.PatientsPage })));
const PatientDetailPage = lazy(() => import("./pages/patient-detail").then((m) => ({ default: m.PatientDetailPage })));
const OpdPage = lazy(() => import("./pages/opd").then((m) => ({ default: m.OpdPage })));
const AppointmentsPage = lazy(() => import("./pages/appointments").then((m) => ({ default: m.AppointmentsPage })));
const PgLogbookPage = lazy(() => import("./pages/pg-logbook").then((m) => ({ default: m.PgLogbookPage })));
const LabPage = lazy(() => import("./pages/lab").then((m) => ({ default: m.LabPage })));
const PharmacyPage = lazy(() => import("./pages/pharmacy").then((m) => ({ default: m.PharmacyPage })));
const PharmacyFinancePage = lazy(() => import("./pages/pharmacy-finance").then((m) => ({ default: m.PharmacyFinancePage })));
const NurseActivitiesPage = lazy(() => import("./pages/nurse-activities").then((m) => ({ default: m.NurseActivitiesPage })));
const RadiologyPage = lazy(() => import("./pages/radiology").then((m) => ({ default: m.RadiologyPage })));
const BillingPage = lazy(() => import("./pages/billing").then((m) => ({ default: m.BillingPage })));
const CssdPage = lazy(() => import("./pages/cssd").then((m) => ({ default: m.CssdPage })));
const DietKitchenPage = lazy(() => import("./pages/diet-kitchen").then((m) => ({ default: m.DietKitchenPage })));
const EmergencyPage = lazy(() => import("./pages/emergency").then((m) => ({ default: m.EmergencyPage })));
const BloodBankPage = lazy(() => import("./pages/blood-bank").then((m) => ({ default: m.BloodBankPage })));
const IcuPage = lazy(() => import("./pages/icu").then((m) => ({ default: m.IcuPage })));
const IpdPage = lazy(() => import("./pages/ipd").then((m) => ({ default: m.IpdPage })));
const CareViewPage = lazy(() => import("./pages/care-view").then((m) => ({ default: m.CareViewPage })));
const OtPage = lazy(() => import("./pages/ot").then((m) => ({ default: m.OtPage })));
const IndentPage = lazy(() => import("./pages/indent").then((m) => ({ default: m.IndentPage })));
const ProcurementPage = lazy(() => import("./pages/procurement").then((m) => ({ default: m.ProcurementPage })));
const QualityPage = lazy(() => import("./pages/quality").then((m) => ({ default: m.QualityPage })));
const FrontOfficePage = lazy(() => import("./pages/front-office").then((m) => ({ default: m.FrontOfficePage })));
const HousekeepingPage = lazy(() => import("./pages/housekeeping").then((m) => ({ default: m.HousekeepingPage })));
const HrPage = lazy(() => import("./pages/hr").then((m) => ({ default: m.HrPage })));
const BmePage = lazy(() => import("./pages/bme").then((m) => ({ default: m.BmePage })));
const AmbulancePage = lazy(() => import("./pages/ambulance").then((m) => ({ default: m.AmbulancePage })));
const CommunicationsPage = lazy(() => import("./pages/communications").then((m) => ({ default: m.CommunicationsPage })));
const CampPage = lazy(() => import("./pages/camp").then((m) => ({ default: m.CampPage })));
const BedsidePortalPage = lazy(() => import("./pages/bedside-portal").then((m) => ({ default: m.BedsidePortalPage })));
const CommandCenterPage = lazy(() => import("./pages/command-center").then((m) => ({ default: m.CommandCenterPage })));
const ConsentPage = lazy(() => import("./pages/consent").then((m) => ({ default: m.ConsentPage })));
const FacilitiesPage = lazy(() => import("./pages/facilities").then((m) => ({ default: m.FacilitiesPage })));
const InfectionControlPage = lazy(() => import("./pages/infection-control").then((m) => ({ default: m.InfectionControlPage })));
const MrdPage = lazy(() => import("./pages/mrd").then((m) => ({ default: m.MrdPage })));
const SecurityPage = lazy(() => import("./pages/security").then((m) => ({ default: m.SecurityPage })));
const RegulatoryPage = lazy(() => import("./pages/regulatory").then((m) => ({ default: m.RegulatoryPage })));
const InsurancePage = lazy(() => import("./pages/insurance").then((m) => ({ default: m.InsurancePage })));
const OrderSetsPage = lazy(() => import("./pages/order-sets").then((m) => ({ default: m.OrderSetsPage })));
const ChronicCarePage = lazy(() => import("./pages/chronic-care").then((m) => ({ default: m.ChronicCarePage })));
const OccupationalHealthPage = lazy(() => import("./pages/occupational-health").then((m) => ({ default: m.OccupationalHealthPage })));
const UtilizationReviewPage = lazy(() => import("./pages/utilization-review").then((m) => ({ default: m.UtilizationReviewPage })));
const CaseManagementPage = lazy(() => import("./pages/case-management").then((m) => ({ default: m.CaseManagementPage })));
const SchedulingPage = lazy(() => import("./pages/scheduling").then((m) => ({ default: m.SchedulingPage })));
const LmsPage = lazy(() => import("./pages/lms").then((m) => ({ default: m.LmsPage })));
const RetrospectivePage = lazy(() => import("./pages/retrospective").then((m) => ({ default: m.RetrospectivePage })));
const SpecialtyIndexPage = lazy(() => import("./pages/specialty").then((m) => ({ default: m.SpecialtyIndexPage })));
const CathLabPage = lazy(() => import("./pages/specialty/cath-lab").then((m) => ({ default: m.CathLabPage })));
const EndoscopyPage = lazy(() => import("./pages/specialty/endoscopy").then((m) => ({ default: m.EndoscopyPage })));
const PsychiatryPage = lazy(() => import("./pages/specialty/psychiatry").then((m) => ({ default: m.PsychiatryPage })));
const PmrPage = lazy(() => import("./pages/specialty/pmr").then((m) => ({ default: m.PmrPage })));
const PalliativePage = lazy(() => import("./pages/specialty/palliative").then((m) => ({ default: m.PalliativePage })));
const MaternityPage = lazy(() => import("./pages/specialty/maternity").then((m) => ({ default: m.MaternityPage })));
const OtherSpecialtiesPage = lazy(() => import("./pages/specialty/other").then((m) => ({ default: m.OtherSpecialtiesPage })));
const UsersPage = lazy(() => import("./pages/admin/users").then((m) => ({ default: m.UsersPage })));
const RolesPage = lazy(() => import("./pages/admin/roles").then((m) => ({ default: m.RolesPage })));
const SettingsPage = lazy(() => import("./pages/admin/settings").then((m) => ({ default: m.SettingsPage })));
const IntegrationHubPage = lazy(() => import("./pages/admin/integration-hub").then((m) => ({ default: m.IntegrationHubPage })));
const IntegrationBuilderPage = lazy(() => import("./pages/admin/integration-builder").then((m) => ({ default: m.IntegrationBuilderPage })));
const TvDisplaysPage = lazy(() => import("./pages/tv-displays").then((m) => ({ default: m.TvDisplaysPage })));
const DoctorSchedulesPage = lazy(() => import("./pages/admin/doctor-schedules").then((m) => ({ default: m.DoctorSchedulesPage })));
const AnalyticsPage = lazy(() => import("./pages/analytics").then((m) => ({ default: m.AnalyticsPage })));
const AuditPage = lazy(() => import("./pages/audit").then((m) => ({ default: m.AuditPage })));
const DocumentsPage = lazy(() => import("./pages/documents").then((m) => ({ default: m.DocumentsPage })));
const DevicesPage = lazy(() => import("./pages/admin/devices").then((m) => ({ default: m.DevicesPage })));
const DynamicScreenPage = lazy(() => import("./components/ScreenRenderer/DynamicScreenPage").then((m) => ({ default: m.DynamicScreenPage })));

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <TopProgressBar />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Protected */}
          <Route
            element={
              <ProtectedRoute>
                <SpotlightProvider />
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="patients/new" element={<DynamicScreenPage screenCode="patient-create" />} />
            <Route path="patients/:id" element={<PatientDetailPage />} />
            <Route path="opd" element={<OpdPage />} />
            <Route path="opd/appointments" element={<AppointmentsPage />} />
            <Route path="opd/pg-logbook" element={<PgLogbookPage />} />
            <Route path="opd/encounters/:id" element={<DynamicScreenPage screenCode="opd-consultation" />} />
            <Route path="lab" element={<LabPage />} />
            <Route path="lab/board" element={<DynamicScreenPage screenCode="lab-worklist" />} />
            <Route path="radiology" element={<RadiologyPage />} />
            <Route path="pharmacy" element={<PharmacyPage />} />
            <Route path="pharmacy/catalog" element={<DynamicScreenPage screenCode="pharmacy-catalog" />} />
            <Route path="pharmacy/finance" element={<PharmacyFinancePage />} />
            <Route path="nurse" element={<NurseActivitiesPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="billing/new" element={<DynamicScreenPage screenCode="billing-create" />} />
            <Route path="indent/*" element={<IndentPage />} />
            <Route path="procurement" element={<ProcurementPage />} />
            <Route path="quality" element={<QualityPage />} />
            <Route path="front-office" element={<FrontOfficePage />} />
            <Route path="housekeeping" element={<HousekeepingPage />} />
            <Route path="hr" element={<HrPage />} />
            <Route path="bme" element={<BmePage />} />
            <Route path="ambulance" element={<AmbulancePage />} />
            <Route path="communications" element={<CommunicationsPage />} />
            <Route path="camp" element={<CampPage />} />
            <Route path="command-center" element={<CommandCenterPage />} />
            <Route path="facilities" element={<FacilitiesPage />} />
            <Route path="consent" element={<ConsentPage />} />
            <Route path="infection-control" element={<InfectionControlPage />} />
            <Route path="mrd" element={<MrdPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="insurance" element={<InsurancePage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
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
            <Route path="blood-bank" element={<BloodBankPage />} />
            <Route path="icu" element={<IcuPage />} />
            <Route path="ipd" element={<IpdPage />} />
            <Route path="ipd/beds" element={<DynamicScreenPage screenCode="ipd-bed-board" />} />
            <Route path="bedside-portal" element={<BedsidePortalPage />} />
            <Route path="care-view" element={<CareViewPage />} />
            <Route path="ot" element={<OtPage />} />
            <Route path="admin">
              <Route index element={<Navigate to="users" replace />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route
                path="device-integrations"
                element={<Navigate to="/admin/settings#device-integrations" replace />}
              />
              <Route path="modules" element={<DynamicScreenPage screenCode="admin-modules" />} />
              <Route path="locations" element={<DynamicScreenPage screenCode="admin-locations" />} />
              <Route path="integration-hub" element={<IntegrationHubPage />} />
              <Route path="integration-builder" element={<IntegrationBuilderPage />} />
              <Route path="integration-builder/:id" element={<IntegrationBuilderPage />} />
              <Route path="tv-displays" element={<TvDisplaysPage />} />
              <Route path="doctor-schedules" element={<DoctorSchedulesPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="devices" element={<DevicesPage />} />
            </Route>

            {/* Dynamic screen routing — screens defined in Screen Builder */}
            <Route path="m/:moduleCode/:screenCode" element={<DynamicScreenPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
