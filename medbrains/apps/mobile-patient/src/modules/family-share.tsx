/**
 * Patient → family share. Link a family member, share the personal
 * health record per-relation (parent / spouse / child / caregiver)
 * with time-bounded scope. Backed by `/api/portal/family-share`.
 */

import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function FamilyShareScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Family share"
      description="Link family, share specific records, set expiry."
      summaries={[
        { eyebrow: "LINKED", count: "—", title: "Family members" },
        { eyebrow: "SHARED", count: "—", title: "Active grants" },
      ]}
      actions={[
        {
          id: "linked",
          label: "Linked family",
          description: "People who can see at least one record.",
        },
        {
          id: "link",
          label: "Link a family member",
          description: "Send an invite by phone / email.",
        },
        {
          id: "share",
          label: "Share a record",
          description: "Pick what + with whom + how long.",
        },
        {
          id: "revoke-share",
          label: "Revoke a share",
          description: "End a family member's view of a record.",
        },
      ]}
    />
  );
}

export const familyShareModule: Module = {
  id: "family-share",
  displayName: "Family share",
  icon: () => null,
  requiredPermissions: [],
  navigator: FamilyShareScreen,
};
