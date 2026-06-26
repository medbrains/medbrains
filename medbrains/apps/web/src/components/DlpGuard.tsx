import { notifications } from "@mantine/notifications";
import type { TenantSettingsRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { tenantSettingsService } from "@/services/tenantSettings.service";

function isEditable(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node || typeof node.tagName !== "string") return false;
  return node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.isContentEditable;
}

function flagOn(rows: TenantSettingsRow[] | undefined): boolean {
  return Boolean(
    rows?.some((r) => r.key === "restrict_copy" && (r.value === true || r.value === "true")),
  );
}

/**
 * Data-loss-prevention guard (opt-in per tenant via `security.restrict_copy`).
 * When enabled, blocks copy/cut/context-menu and text selection on non-editable
 * content (PHI displayed in the app) — users can still edit their own form
 * fields. This is a DETERRENT layer, not absolute DLP (it can't stop
 * screenshots, photos, or devtools); true exfiltration control needs
 * endpoint/network DLP. Renders nothing.
 */
export function DlpGuard() {
  const { data: rows } = useQuery({
    queryKey: ["settings", "security"],
    queryFn: () => tenantSettingsService.getTenantSettings("security"),
    staleTime: 300_000,
    retry: false,
  });
  const restrict = flagOn(rows);

  // External DOM listeners (allowed useEffect): toggle the DLP guard.
  useEffect(() => {
    if (!restrict) {
      document.body.removeAttribute("data-dlp");
      return;
    }
    document.body.setAttribute("data-dlp", "on");
    let lastWarn = 0;
    const block = (e: Event) => {
      if (isEditable(e.target)) return; // allow editing one's own fields
      e.preventDefault();
      const now = Date.now();
      if (now - lastWarn > 3000) {
        lastWarn = now;
        notifications.show({
          title: "Copying restricted",
          message: "Your organization restricts copying data out of MedBrains.",
          color: "warning",
        });
      }
    };
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", block);
    return () => {
      document.body.removeAttribute("data-dlp");
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", block);
    };
  }, [restrict]);

  return null;
}
