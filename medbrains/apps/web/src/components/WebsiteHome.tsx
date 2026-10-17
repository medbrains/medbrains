import { useAuthStore } from "@medbrains/stores";
import { Navigate } from "react-router";
import { useEffectOnce } from "react-use";

const WEBSITE_URL = "https://www.medbrains.in/";

/**
 * The app's root. www.medbrains.in is the one landing page, so a visitor is
 * sent there; someone already signed in goes straight to work.
 */
export function WebsiteHome() {
  const user = useAuthStore((s) => s.user);
  useEffectOnce(() => {
    if (!user) window.location.replace(WEBSITE_URL);
  });
  return user ? <Navigate to="/dashboard" replace /> : null;
}
