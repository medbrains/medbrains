import { Group, Stack, Text } from "@mantine/core";
import type { UhiFeeSources } from "@medbrains/types";
import { Badge, Card } from "@/components/ui";

interface UhiFeesCardProps {
  fees: UhiFeeSources;
  onlinePayment: boolean;
}

/**
 * Where the fees patient apps are quoted come from, and how they pay. Read
 * only: each source is set where it lives — a doctor's fee on the staff
 * record, the TELECONSULT rate in the charge master, a lab test's flag in the
 * lab catalogue, the online provider in Billing → Settings.
 */
export function UhiFeesCard({ fees, onlinePayment }: UhiFeesCardProps) {
  return (
    <Card>
      <Stack gap="xs">
        <Text fw={600}>Fees and payment</Text>
        <Group gap="xs">
          <Badge tone={onlinePayment ? "success" : "neutral"}>
            {onlinePayment ? "Paid online when booked" : "Paid at the hospital"}
          </Badge>
          <Badge tone={fees.doctors_with_fee > 0 ? "info" : "warning"}>
            {`${fees.doctors_with_fee} doctors with their own fee`}
          </Badge>
          <Badge tone={fees.patient_orderable_tests > 0 ? "info" : "warning"}>
            {`${fees.patient_orderable_tests} lab tests bookable by patients`}
          </Badge>
        </Group>
        <Text size="sm">
          A consultation is quoted at the doctor's own consultation fee; without one, at the charge
          master's rate (TELECONSULT for an online consultation —{" "}
          {fees.teleconsult_charge ? `₹${fees.teleconsult_charge}` : "not set"}; the department's
          OPD-CONSULT code for a visit). With neither, the app is told the fee is paid at the
          hospital.
        </Text>
        <Text size="sm" c="dimmed">
          {onlinePayment
            ? "Teleconsultations with a fee are held until paid through a Razorpay payment link, and let go if not paid within 30 minutes. Visits and lab tests are paid at the hospital."
            : "No online provider is set up (Billing → Settings → Payments, Razorpay), so every booking is paid at the hospital."}
        </Text>
        <Text size="sm" c="dimmed">
          Hospital holidays in Settings → Operations remove that day's slots, unless a doctor is
          marked available.
        </Text>
      </Stack>
    </Card>
  );
}
