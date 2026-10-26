// Shown on every screen of the pack: the templates are a start, not advice.

import { IconScale } from "@tabler/icons-react";
import { Alert } from "@/components/ui";

export function CounselNotice() {
  return (
    <Alert tone="warning" icon={<IconScale size={16} />} title="Template — review with counsel">
      These policies are templates drafted against the DPDP Act 2023, the DPDP Rules 2025 (most
      duties in force from May 2027) and CERT-In's directions of 28 April 2022. They are not legal
      advice: have the hospital's counsel review each one before it is approved and published.
    </Alert>
  );
}
