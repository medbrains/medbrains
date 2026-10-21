import { Group, Stack, Text } from "@mantine/core";
import type { PortalInvoice } from "@medbrains/types";
import { IconCreditCard } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, NumberField, Switch } from "@/components/ui";
import { portalService } from "@/services/portal.service";

/** A bill the patient can pay online: issued or part-paid, with a balance. */
export function canPayOnline(bill: PortalInvoice): boolean {
  return ["issued", "partially_paid"].includes(bill.status) && Number(bill.balance_due) > 0;
}

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * "Pay ₹X now", or a part of it (#4871): the hospital's payment page opens
 * in this tab; the rest can still be paid at the counter.
 */
export function PortalPayBill({ token, bill }: { token: string; bill: PortalInvoice }) {
  const due = Number(bill.balance_due);
  const [inPart, setInPart] = useState(false);
  const [part, setPart] = useState<number | string>("");
  const amount = inPart ? Number(part) || 0 : due;
  const pay = useMutation({
    mutationFn: () => portalService.payPortalBill(token, bill.id, inPart ? amount : undefined),
    onSuccess: (link) => {
      if (link.short_url) window.location.assign(link.short_url);
    },
  });
  return (
    <Stack gap="xs">
      <Switch
        label="Pay part now, the rest later"
        checked={inPart}
        onChange={(e) => setInPart(e.currentTarget.checked)}
      />
      {inPart && (
        <NumberField
          label="Amount to pay now"
          value={part}
          onChange={setPart}
          min={1}
          max={due}
          decimalScale={2}
          prefix="₹"
        />
      )}
      <Group>
        <Button
          tone="primary"
          leftSection={<IconCreditCard size={16} />}
          loading={pay.isPending}
          disabled={amount <= 0 || amount > due}
          onClick={() => pay.mutate()}
        >
          Pay {inr(amount)} now
        </Button>
      </Group>
      {pay.isError && (
        <Alert tone="warning" title="Online payment is not available just now">
          <Text size="sm">{pay.error.message} You can pay at the hospital billing counter.</Text>
        </Alert>
      )}
    </Stack>
  );
}
