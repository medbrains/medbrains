import { Group, Stack, Text } from "@mantine/core";
import { Button, NumberField } from "@/components/ui";
import { changeDue, rupees } from "./collect-math";

interface CashTenderProps {
  amount: number;
  tendered: number | string;
  onTendered: (value: number | string) => void;
}

/** Notes the patient commonly hands over. */
const QUICK_NOTES = [500, 2000] as const;

/** Cash: what the patient handed over, and the change to give back. */
export function CashTender({ amount, tendered, onTendered }: CashTenderProps) {
  const given = Number(tendered) || 0;
  const short = given > 0 && given < amount;
  return (
    <Stack gap="xs">
      <Group align="flex-end" gap="xs">
        <NumberField
          label="Cash handed over"
          value={tendered}
          onChange={onTendered}
          min={0}
          decimalScale={2}
          prefix="₹"
          w={180}
          error={short ? `Short by ${rupees(amount - given)}` : undefined}
        />
        <Button tone="secondary" size="xs" onClick={() => onTendered(amount)}>
          Exact
        </Button>
        {QUICK_NOTES.filter((note) => note > amount).map((note) => (
          <Button key={note} tone="secondary" size="xs" onClick={() => onTendered(note)}>
            {rupees(note)}
          </Button>
        ))}
      </Group>
      <Group justify="space-between" aria-live="polite">
        <Text size="sm" c="dimmed">
          Change due
        </Text>
        <Text size="lg" fw={700} data-testid="cash-change">
          {rupees(changeDue(amount, given || amount))}
        </Text>
      </Group>
    </Stack>
  );
}
