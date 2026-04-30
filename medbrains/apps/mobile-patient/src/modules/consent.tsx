/**
 * Patient → consent. DPDP Act 2023-aligned revocation of consent
 * for any flow the patient previously authorised (procedure,
 * research, family share, ABDM data sharing). Backed by
 * `/api/portal/consents` — actions are subject-locked.
 */

import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function ConsentScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Consent"
      description="View, grant, or revoke consent for any of your records."
      summaries={[
        { eyebrow: "ACTIVE", count: "—", title: "Granted consents" },
        { eyebrow: "REVOKED", count: "—", title: "Revoked / expired" },
      ]}
      actions={[
        {
          id: "active",
          label: "Active consents",
          description: "What you've granted, to whom, for how long.",
        },
        {
          id: "revoke",
          label: "Revoke a consent",
          description: "Stop a previously granted access.",
        },
        {
          id: "audit",
          label: "Access audit",
          description: "Who saw what, when.",
        },
        {
          id: "data-export",
          label: "Export my data",
          description: "DPDP right to portability.",
        },
        {
          id: "delete-account",
          label: "Delete my account",
          description: "DPDP right to erasure (with safety holds).",
        },
      ]}
    />
  );
}

export const consentModule: Module = {
  id: "consent",
  displayName: "Consent",
  icon: () => null,
  requiredPermissions: [],
  navigator: ConsentScreen,
};
