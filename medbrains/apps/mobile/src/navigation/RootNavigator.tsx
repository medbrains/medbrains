import { useAuthStore } from "@medbrains/stores";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import {
  LoginScreen,
  PatientDashboard,
  StaffDashboard,
  // Staff screens
  PatientSearchScreen,
  PatientDetailScreen,
  QueueScreen,
  VitalsEntryScreen,
  PrescriptionScreen,
  LabOrderScreen,
  LabResultsViewScreen,
  ConsultationNotesScreen,
  // Patient screens
  AppointmentsScreen,
  LabResultsScreen,
  PrescriptionsScreen,
  BillingScreen,
  ProfileScreen,
  QueuePositionScreen,
  // Phlebo screens
  CollectionListScreen,
  CollectionDetailScreen,
  SampleCollectionScreen,
  TripSummaryScreen,
} from "../screens";

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
  Billing: undefined;
  BillDetail: { invoiceId: string };
  Payment: { invoiceId: string };
  Profile: undefined;
  QueuePosition: { appointmentId: string };

  // Staff screens
  StaffDashboard: undefined;
  PatientSearch: undefined;
  PatientDetail: { patientId: string };
  Queue: { departmentId?: string };
  Vitals: { encounterId?: string; patientId?: string };
  Prescription: { encounterId?: string; patientId?: string };
  LabOrder: { encounterId?: string; patientId?: string };
  LabResultsView: { orderId?: string; patientId?: string };
  ConsultationNotes: { encounterId: string; patientId?: string };

  // Phlebo screens
  CollectionList: undefined;
  CollectionDetail: { orderId: string };
  SampleCollection: { orderId: string };
  TripSummary: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function PatientStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#228be6" },
        headerTintColor: "#ffffff",
      }}
    >
      <Stack.Screen
        name="PatientDashboard"
        component={PatientDashboard}
        options={{ title: "My Health" }}
      />
      <Stack.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{ title: "Appointments" }}
      />
      <Stack.Screen
        name="LabResults"
        component={LabResultsScreen}
        options={{ title: "Lab Results" }}
      />
      <Stack.Screen
        name="LabResultDetail"
        component={LabResultsViewScreen}
        options={{ title: "Result Details" }}
      />
      <Stack.Screen
        name="Prescriptions"
        component={PrescriptionsScreen}
        options={{ title: "Prescriptions" }}
      />
      <Stack.Screen
        name="Billing"
        component={BillingScreen}
        options={{ title: "Bills & Payments" }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile" }}
      />
      <Stack.Screen
        name="QueuePosition"
        component={QueuePositionScreen}
        options={{ title: "Queue Status" }}
      />
    </Stack.Navigator>
  );
}

function StaffStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#228be6" },
        headerTintColor: "#ffffff",
      }}
    >
      <Stack.Screen
        name="StaffDashboard"
        component={StaffDashboard}
        options={{ title: "Dashboard" }}
      />
      <Stack.Screen
        name="PatientSearch"
        component={PatientSearchScreen}
        options={{ title: "Find Patient" }}
      />
      <Stack.Screen
        name="PatientDetail"
        component={PatientDetailScreen}
        options={{ title: "Patient Details" }}
      />
      <Stack.Screen
        name="Queue"
        component={QueueScreen}
        options={{ title: "Patient Queue" }}
      />
      <Stack.Screen
        name="Vitals"
        component={VitalsEntryScreen}
        options={{ title: "Record Vitals" }}
      />
      <Stack.Screen
        name="Prescription"
        component={PrescriptionScreen}
        options={{ title: "E-Prescription" }}
      />
      <Stack.Screen
        name="LabOrder"
        component={LabOrderScreen}
        options={{ title: "Lab Orders" }}
      />
      <Stack.Screen
        name="LabResultsView"
        component={LabResultsViewScreen}
        options={{ title: "Lab Results" }}
      />
      <Stack.Screen
        name="ConsultationNotes"
        component={ConsultationNotesScreen}
        options={{ title: "Consultation Notes" }}
      />
    </Stack.Navigator>
  );
}

function PhlebotomistStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#40c057" },
        headerTintColor: "#ffffff",
      }}
    >
      <Stack.Screen
        name="CollectionList"
        component={CollectionListScreen}
        options={{ title: "Home Collections" }}
      />
      <Stack.Screen
        name="CollectionDetail"
        component={CollectionDetailScreen}
        options={{ title: "Collection Details" }}
      />
      <Stack.Screen
        name="SampleCollection"
        component={SampleCollectionScreen}
        options={{ title: "Collect Samples" }}
      />
      <Stack.Screen
        name="TripSummary"
        component={TripSummaryScreen}
        options={{ title: "Trip Summary" }}
      />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const { isAuthenticated, user } = useAuthStore();

  // Not logged in - show auth flow
  if (!isAuthenticated) {
    return <AuthStack />;
  }

  // Determine user type based on role
  const isPhlebotomist = user?.role === "lab_technician"; // Phlebo uses lab_technician role with home collection flag
  const isStaff = user?.role && [
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
