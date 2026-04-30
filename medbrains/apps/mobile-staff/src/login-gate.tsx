/**
 * Login gate — renders the LoginScreen when no identity is in
 * memory. Mounted under `AuthProvider` so the LoginScreen's call to
 * `signIn` persists the JWT into the SecretStore. Lives separately
 * from `App.tsx` so the shell can swap login flows per variant.
 */

import { useAuthStore, LoginScreen } from "@medbrains/mobile-shell";
import { staffSignIn } from "./auth/sign-in.js";

export function StaffLoginGate() {
  const identity = useAuthStore((s) => s.identity);
  const hydrating = useAuthStore((s) => s.hydrating);

  if (hydrating) {
    return null;
  }
  if (identity) {
    return null;
  }
  return (
    <LoginScreen
      title="MedBrains Staff"
      subtitle="Sign in with your hospital credentials"
      identifierLabel="Username"
      onSubmit={staffSignIn}
    />
  );
}
