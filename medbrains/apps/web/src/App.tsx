import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { RouteErrorBoundary } from "./components/AppErrorBoundary";
import { PageSkeleton } from "./components/PageSkeleton";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { TopProgressBar } from "./components/TopProgressBar";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!pathname) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
  return null;
}

// Every signed-in route, and the shell that draws them, live in AuthedRoutes:
// sign-in, the kiosk, the public pages and the TV board never use them, so
// their route table (and the preload map of each page's chunks) is not part
// of the entry every first load parses.
const AuthedRoutes = lazy(() =>
  import("./AuthedRoutes").then((m) => ({ default: m.AuthedRoutes })),
);

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
const StorePage = lazy(() => import("./pages/store").then((m) => ({ default: m.StorePage })));
const PublicEnquiryPage = lazy(() =>
  import("./pages/public-enquiry").then((m) => ({ default: m.PublicEnquiryPage })),
);
const PublicBookingPage = lazy(() =>
  import("./pages/public-booking").then((m) => ({ default: m.PublicBookingPage })),
);
const SharedImagesPage = lazy(() =>
  import("./pages/shared-images").then((m) => ({ default: m.SharedImagesPage })),
);
const QueueStatusPage = lazy(() =>
  import("./pages/queue-status").then((m) => ({ default: m.QueueStatusPage })),
);
const VerifyPrescriptionPage = lazy(() =>
  import("./pages/verify-prescription").then((m) => ({ default: m.VerifyPrescriptionPage })),
);
const VerifyBillPage = lazy(() =>
  import("./pages/verify-bill").then((m) => ({ default: m.VerifyBillPage })),
);
const VerifySignaturePage = lazy(() =>
  import("./pages/verify-signature").then((m) => ({ default: m.VerifySignaturePage })),
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
const TokenDisplayPage = lazy(() =>
  import("./pages/token-display").then((m) => ({ default: m.TokenDisplayPage })),
);
const ScreenPage = lazy(() => import("./pages/screen").then((m) => ({ default: m.ScreenPage })));

const TrialPage = lazy(() => import("./pages/trial/index").then((m) => ({ default: m.TrialPage })));

export function App() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <ScrollToTop />
        <TopProgressBar />
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {/* Public */}
            {/* A page load of / is the website (served as home.html); reaching /
                inside the app means sign-in, which sends a signed-in user on. */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            {/* A hospital starts its own trial — only the trial server takes it. */}
            <Route path="/trial" element={<TrialPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            {/* Scanned off a printed prescription — public by necessity. */}
            <Route path="/verify/rx/:token" element={<VerifyPrescriptionPage />} />
            <Route path="/verify/bill" element={<VerifyBillPage />} />
            {/* The QR on a signed print — insurers, courts, other hospitals. */}
            <Route path="/verify/signature/:token" element={<VerifySignaturePage />} />
            {/* Scanned off the kiosk slip — the patient has no login. */}
            <Route path="/queue/:token" element={<QueueStatusPage />} />
            {/* A shared-images link: the viewer opens after the recipient's code. */}
            <Route path="/shared-images/:token" element={<SharedImagesPage />} />
            {/* Public self-service booking — off unless the tenant enables it. */}
            <Route path="/book/:tenantCode" element={<PublicBookingPage />} />
            {/* The hospital's own "contact us" form — off unless enabled. */}
            <Route path="/enquire/:tenantCode" element={<PublicEnquiryPage />} />
            {/* A patient reading their own records — own session, not staff auth. */}
            <Route path="/portal/:tenantCode" element={<PatientPortalPage />} />
            {/* The pharmacy storefront — browsing is public, ordering signs in. */}
            <Route path="/store/:tenantCode" element={<StorePage />} />
            {/* Unattended self-service terminal in the lobby. */}
            <Route path="/kiosk/checkin" element={<KioskSelfCheckinPage />} />
            {/* A waiting-room TV: pairs by code, then shows its own board. */}
            <Route path="/screen" element={<ScreenPage />} />
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

            {/* Signed in: the shell and every page inside it. */}
            <Route path="/*" element={<AuthedRoutes />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
