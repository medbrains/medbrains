import { Group, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { Card, NumberField } from "@/components/ui";
import { defaultValidUntil, minValidUntil, type RefillTerms } from "./rxRefills";

interface RxRefillTermsProps {
  value: RefillTerms;
  onChange: (next: RefillTerms) => void;
  /** Today, YYYY-MM-DD. */
  today: string;
  /** Lines on the pad that may not be refilled (Schedule X, H1, NDPS). */
  controlled: string[];
}

/**
 * Refills and expiry, written with the prescription. A refill is issued by
 * the pharmacy without a new visit; the expiry is printed on the prescription
 * and the bill, and nothing is dispensed against it afterwards.
 */
export function RxRefillTerms({ value, onChange, today, controlled }: RxRefillTermsProps) {
  const noRefills = controlled.length > 0;
  const refills = noRefills ? 0 : value.refills;
  const set = (patch: Partial<RefillTerms>) => onChange({ ...value, ...patch });
  const terms = { ...value, refills };

  return (
    <Card padding="sm" mb="sm">
      <Group align="flex-start" gap="md" wrap="wrap">
        <NumberField
          label="Refills"
          description={
            noRefills ? `Not with ${controlled.join(", ")}` : "Issued without a new visit"
          }
          min={0}
          max={12}
          w={160}
          value={refills}
          disabled={noRefills}
          onChange={(v) => set({ refills: typeof v === "number" ? v : 0, validUntil: null })}
        />
        {refills > 0 && (
          <NumberField
            label="Every (days)"
            description="Earliest gap between refills"
            min={1}
            max={365}
            w={160}
            value={value.intervalDays}
            onChange={(v) =>
              set({ intervalDays: typeof v === "number" ? v : 30, validUntil: null })
            }
          />
        )}
        <DateInput
          label="Valid until"
          description="Not dispensed after this day"
          size="sm"
          valueFormat="DD MMM YYYY"
          minDate={minValidUntil(terms, today)}
          w={180}
          value={value.validUntil ?? defaultValidUntil(terms, today)}
          onChange={(d) => set({ validUntil: d })}
        />
      </Group>
      {refills > 0 && (
        <Text size="xs" c="dimmed" mt="xs">
          {refills} refill{refills === 1 ? "" : "s"}, at least {value.intervalDays} days apart.
        </Text>
      )}
    </Card>
  );
}
