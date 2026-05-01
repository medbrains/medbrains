/**
 * Patient login gate — defaults to password login. Once the
 * tenant's ABHA consumer endpoint is deployed, swap `onSubmit` for
 * `patientAbhaSignIn` (which delegates to the NHA gateway).
 */

import { LoginScreen, useAuthStore } from "@medbrains/mobile-shell";
import { patientPasswordSignIn } from "./auth/sign-in.js";

export function PatientLoginGate() {
  const identity = useAuthStore((s) => s.identity);
  const hydrating = useAuthStore((s) => s.hydrating);

  if (hydrating || identity) {
    return null;
  }

  return (
    <LoginScreen
      title="MedBrains"
      subtitle="Sign in to view your records"
      identifierLabel="Email or phone"
      passwordLabel="Password"
      onSubmit={patientPasswordSignIn}
    />
  );
}
