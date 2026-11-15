import { useLocaleStore } from "@medbrains/stores";
import { sessionService } from "./session.service";

/**
 * Reload the locale profile from `/api/auth/me` after it changed (an applied
 * locale-profile change set), so every screen formats with the new values at
 * once. A failed reload is shown as a failed load, never as the old profile.
 */
export async function refreshLocaleProfile(): Promise<void> {
  try {
    const me = await sessionService.me();
    useLocaleStore.getState().setProfile(me.locale_profile ?? null);
  } catch {
    useLocaleStore.getState().setProfile(null);
  }
}
