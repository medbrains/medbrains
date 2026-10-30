import { Stack, Text } from "@mantine/core";
import type { StoreAbout } from "@medbrains/types";
import { Divider } from "@/components/ui";

/**
 * Who is selling: the pharmacy, its drug licences, the pharmacist in charge
 * and the grievance officer — shown on every storefront page, as the
 * e-commerce rules ask.
 */
export function StoreFooter({ about }: { about: StoreAbout }) {
  return (
    <Stack gap={2} w="100%">
      <Divider />
      <Text size="xs" fw={600}>
        {about.pharmacy_name}
      </Text>
      {about.address && <Text size="xs">{about.address}</Text>}
      {about.drug_licence && <Text size="xs">Drug licence: {about.drug_licence}</Text>}
      {about.gstin && <Text size="xs">GSTIN: {about.gstin}</Text>}
      {about.pharmacist_name && (
        <Text size="xs">
          Pharmacist in charge: {about.pharmacist_name}
          {about.pharmacist_registration ? ` (reg. ${about.pharmacist_registration})` : ""}
        </Text>
      )}
      {about.grievance_officer && (
        <Text size="xs">
          Grievances: {about.grievance_officer.name}, {about.grievance_officer.email},{" "}
          {about.grievance_officer.phone}. Acknowledged within 48 hours.
        </Text>
      )}
      <Text size="xs" c="dimmed">
        {about.return_policy} Medicines are dispensed by a registered pharmacist.
      </Text>
    </Stack>
  );
}
