import { useAuthStore } from "@medbrains/stores";
import type { TokenBoardSurfaceId } from "@medbrains/types";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppBarGradient } from "../components/AppBarGradient";
import { MOBILE_NAVIGATION_TEXT, mobilePatientJourneyText } from "../components/patientJourneyText";
import {
  // Patient screens
  AppointmentsScreen,
  BillingScreen,
  CollectionDetailScreen,
  // Phlebo screens
  CollectionListScreen,
  ConsultationNotesScreen,
  LabOrderScreen,
  LabResultsScreen,
  LabResultsViewScreen,
  LoginScreen,
  PatientCareContextScreen,
  PatientDashboard,
  PatientDetailScreen,
  PatientPharmacyScreen,
  // Staff screens
  PatientSearchScreen,
  PrescriptionScreen,
  PrescriptionsScreen,
  ProfileScreen,
  QueuePositionScreen,
  QueueScreen,
  RadiologyOrderScreen,
  SampleCollectionScreen,
  StaffDashboard,
  CampRegistrationScreen,
  TokenBoardsScreen,
  TripSummaryScreen,
  VitalsEntryScreen,
} from "../screens";
import { APP_BAR_COLORS } from "../theme/paper-theme";
import type { PatientCareContextRouteParams } from "./careContextParams";

export type RootStackParamList = {
  // Auth screens
  Login: undefined;

  // Patient screens
  PatientDashboard: undefined;
  Appointments: undefined;
  AppointmentBook: { appointmentId?: string; doctorId?: string };
  LabResults: undefined;
  LabResultDetail: { orderId: string };
  Prescriptions: undefined;
  Billing:
    | {
        admissionId?: string;
        encounterId?: string;
        filter?: "all" | "paid" | "pending";
        handoff?: "discharge_bill" | "payment";
        patientId?: string;
      }
    | undefined;
  BillDetail: { invoiceId: string };
  Payment: { invoiceId: string };
  Profile: undefined;
  QueuePosition: { appointmentId: string };

  // Staff screens
  StaffDashboard: undefined;
  CampRegistration: undefined;
  TokenBoards: { surface?: TokenBoardSurfaceId } | undefined;
  PatientSearch: undefined;
  PatientCareContext: PatientCareContextRouteParams;
  PatientDetail: { patientId: string };
  PatientPharmacy: {
    handoff?: "dispense" | "queue";
    patientId: string;
    pharmacyOrderId?: string;
    pharmacyRxQueueId?: string;
  };
  Queue: { departmentId?: string };
  Vitals: { encounterId?: string; patientId?: string };
  Prescription: {
    admissionId?: string;
    encounterId?: string;
    orderContext?: "ipd" | "opd";
    patientId?: string;
  };
  LabOrder: {
    admissionId?: string;
    encounterId?: string;
    orderContext?: "ipd" | "opd";
    patientId?: string;
  };
  RadiologyOrder: {
    admissionId?: string;
    encounterId?: string;
    orderContext?: "ipd" | "opd";
    patientId?: string;
  };
  LabResultsView: { orderId?: string; patientId?: string };
  ConsultationNotes: { encounterId: string; patientId?: string };

  // Phlebo screens
  CollectionList: undefined;
  CollectionDetail: { orderId: string };
  SampleCollection: { orderId: string };
  TripSummary: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const appBarScreenOptions = {
  headerBackground: () => <AppBarGradient />,
  headerStyle: { backgroundColor: "transparent" },
  headerTintColor: APP_BAR_COLORS.foreground,
  headerTitleStyle: { color: APP_BAR_COLORS.title, fontWeight: "700" as const },
};
const NAV_TEXT = MOBILE_NAVIGATION_TEXT;

function navigationTitle(key: string): string {
  return mobilePatientJourneyText(key);
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function PatientStack() {
  return (
    <Stack.Navigator screenOptions={appBarScreenOptions}>
      <Stack.Screen
        name="PatientDashboard"
        component={PatientDashboard}
        options={{ title: navigationTitle(NAV_TEXT.patient.myHealth) }}
      />
      <Stack.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{ title: navigationTitle(NAV_TEXT.patient.appointments) }}
      />
      <Stack.Screen
        name="LabResults"
        component={LabResultsScreen}
        options={{ title: navigationTitle(NAV_TEXT.patient.labResults) }}
      />
      <Stack.Screen
        name="LabResultDetail"
        component={LabResultsViewScreen}
        options={{ title: navigationTitle(NAV_TEXT.patient.labResultDetails) }}
      />
      <Stack.Screen
        name="Prescriptions"
        component={PrescriptionsScreen}
        options={{ title: navigationTitle(NAV_TEXT.patient.prescriptions) }}
      />
      <Stack.Screen
        name="Billing"
        component={BillingScreen}
        options={{ title: navigationTitle(NAV_TEXT.patient.billing) }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: navigationTitle(NAV_TEXT.patient.profile) }}
      />
      <Stack.Screen
        name="QueuePosition"
        component={QueuePositionScreen}
        options={{ title: navigationTitle(NAV_TEXT.patient.queueStatus) }}
      />
    </Stack.Navigator>
  );
}

function StaffStack() {
  return (
    <Stack.Navigator screenOptions={appBarScreenOptions}>
      <Stack.Screen
        name="StaffDashboard"
        component={StaffDashboard}
        options={{ title: navigationTitle(NAV_TEXT.staff.dashboard) }}
      />
      <Stack.Screen
        name="CampRegistration"
        component={CampRegistrationScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.campRegistration) }}
      />
      <Stack.Screen
        name="TokenBoards"
        component={TokenBoardsScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.tokenBoards) }}
      />
      <Stack.Screen
        name="PatientSearch"
        component={PatientSearchScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.findPatient) }}
      />
      <Stack.Screen
        name="PatientDetail"
        component={PatientDetailScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.patientDetails) }}
      />
      <Stack.Screen
        name="PatientCareContext"
        component={PatientCareContextScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.careContext) }}
      />
      <Stack.Screen
        name="PatientPharmacy"
        component={PatientPharmacyScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.patientPharmacy) }}
      />
      <Stack.Screen
        name="Queue"
        component={QueueScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.patientQueue) }}
      />
      <Stack.Screen
        name="Billing"
        component={BillingScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.billing) }}
      />
      <Stack.Screen
        name="Vitals"
        component={VitalsEntryScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.recordVitals) }}
      />
      <Stack.Screen
        name="Prescription"
        component={PrescriptionScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.ePrescription) }}
      />
      <Stack.Screen
        name="LabOrder"
        component={LabOrderScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.labOrders) }}
      />
      <Stack.Screen
        name="RadiologyOrder"
        component={RadiologyOrderScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.imagingOrder) }}
      />
      <Stack.Screen
        name="LabResultsView"
        component={LabResultsViewScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.labResults) }}
      />
      <Stack.Screen
        name="ConsultationNotes"
        component={ConsultationNotesScreen}
        options={{ title: navigationTitle(NAV_TEXT.staff.consultationNotes) }}
      />
    </Stack.Navigator>
  );
}

function PhlebotomistStack() {
  return (
    <Stack.Navigator screenOptions={appBarScreenOptions}>
      <Stack.Screen
        name="CollectionList"
        component={CollectionListScreen}
        options={{ title: navigationTitle(NAV_TEXT.phlebotomy.homeCollections) }}
      />
      <Stack.Screen
        name="CollectionDetail"
        component={CollectionDetailScreen}
        options={{ title: navigationTitle(NAV_TEXT.phlebotomy.collectionDetails) }}
      />
      <Stack.Screen
        name="SampleCollection"
        component={SampleCollectionScreen}
        options={{ title: navigationTitle(NAV_TEXT.phlebotomy.collectSamples) }}
      />
      <Stack.Screen
        name="TripSummary"
        component={TripSummaryScreen}
        options={{ title: navigationTitle(NAV_TEXT.phlebotomy.tripSummary) }}
      />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const user = useAuthStore((state) => state.user);

  // Not logged in - show auth flow
  if (!isAuthenticated) {
    return <AuthStack />;
  }

  // Determine user type based on role
  const isPhlebotomist = user?.role === "lab_technician"; // Phlebo uses lab_technician role with home collection flag
  const isStaff =
    user?.role &&
    [
      "super_admin",
      "hospital_admin",
      "doctor",
      "nurse",
      "receptionist",
      "lab_technician",
      "pharmacist",
      "billing_clerk",
    ].includes(user.role);

  // Show appropriate stack based on user type
  if (isPhlebotomist) {
    return <PhlebotomistStack />;
  }

  if (isStaff) {
    return <StaffStack />;
  }

  // Default to patient view (for patient portal users)
  return <PatientStack />;
}
