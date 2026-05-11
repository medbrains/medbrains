/**
 * Login gate — renders the LoginScreen when no identity is in
 * memory. Mounted under `AuthProvider` so the LoginScreen's call to
 * `signIn` persists the JWT into the SecretStore. Lives separately
 * from `App.tsx` so the shell can swap login flows per variant.
 */

import { LoginScreen, useAuthStore } from "@medbrains/mobile-shell";
import { campSignIn } from "./auth/sign-in.js";

export function CampLoginGate() {
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
      title="MedBrains Camp"
      subtitle="Sign in before downloading a camp packet"
      identifierLabel="Username"
      logoSource={require("../assets/icon.png")}
      onSubmit={campSignIn}
    />
  );
}
