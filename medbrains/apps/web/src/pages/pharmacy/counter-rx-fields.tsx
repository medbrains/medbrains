import { Group, Text } from "@mantine/core";
import { Input } from "@/components/ui";
import type { CounterRx } from "./pos-checkout";

interface CounterRxFieldsProps {
  /** Some line is Schedule H1: the prescriber and address are needed too. */
  h1: boolean;
  value: CounterRx;
  onChange: (next: CounterRx) => void;
}

/**
 * A Schedule H or H1 medicine sold against the prescription the customer
 * brings: who prescribed it, and for H1 the patient's address — for the H1
 * register. The patient's name and mobile are the sale's customer fields.
 */
export function CounterRxFields({ h1, value, onChange }: CounterRxFieldsProps) {
  const set = (key: keyof CounterRx) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: e.currentTarget.value });
  return (
    <>
      <Text size="xs" c="dimmed">
        Prescription medicine: name the patient{h1 ? ", the prescriber and the address" : ""} from
        the prescription.
      </Text>
      <Group gap="xs" wrap="wrap">
        <Input
          size="xs"
          label="Prescriber"
          value={value.prescriberName}
          onChange={set("prescriberName")}
          required={h1}
        />
        <Input
          size="xs"
          label="Registration no."
          value={value.prescriberRegistration}
          onChange={set("prescriberRegistration")}
          required={h1}
        />
        {h1 && (
          <Input
            size="xs"
            label="Patient's address"
            value={value.address}
            onChange={set("address")}
            required
            w={240}
          />
        )}
      </Group>
    </>
  );
}
