import { zodResolver } from "@hookform/resolvers/zod";
import { Accordion, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import type { SequencesInput } from "@medbrains/schemas";
import { sequencesSchema } from "@medbrains/schemas";
import { useOnboardingStore } from "@medbrains/stores";
import type { AdditionalSequence } from "@medbrains/types";
import { IconHash } from "@tabler/icons-react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { Button } from "@/components/ui";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const additionalSequenceDefaults: AdditionalSequence[] = [
  { seq_type: "lab_order", prefix: "LAB-", pad_width: 6 },
  { seq_type: "admission", prefix: "ADM-", pad_width: 6 },
  { seq_type: "opd_token", prefix: "OPD-", pad_width: 4 },
  { seq_type: "prescription", prefix: "RX-", pad_width: 6 },
  { seq_type: "discharge_summary", prefix: "DS-", pad_width: 6 },
  { seq_type: "purchase_order", prefix: "PO-", pad_width: 6 },
  { seq_type: "medical_record", prefix: "MR-", pad_width: 6 },
];

const seqTypeLabels: Record<string, string> = {
  lab_order: "Lab Order",
  admission: "Admission",
  opd_token: "OPD Token",
  prescription: "Prescription",
  discharge_summary: "Discharge Summary",
  purchase_order: "Purchase Order",
  medical_record: "Medical Record",
};

function makePreview(prefix: string, padWidth: number): string {
  return `${prefix}${"0".repeat(Math.max(0, padWidth - 1))}1`;
}

export function SequencesStep({ onNext, onBack }: Props) {
  const stored = useOnboardingStore((s) => s.sequences);
  const setSequences = useOnboardingStore((s) => s.setSequences);
  const additionalSequences = useOnboardingStore((s) => s.additionalSequences);
  const setAdditionalSequences = useOnboardingStore((s) => s.setAdditionalSequences);

  // Initialize additional sequences from defaults if empty
  const seqs = additionalSequences.length > 0 ? additionalSequences : additionalSequenceDefaults;

  const form = useForm<SequencesInput>({
    resolver: zodResolver(sequencesSchema) as Resolver<SequencesInput>,
    defaultValues: {
      uhid_prefix: stored?.uhid_prefix ?? "",
      uhid_pad_width: stored?.uhid_pad_width ?? 5,
      invoice_prefix: stored?.invoice_prefix ?? "INV-",
      invoice_pad_width: stored?.invoice_pad_width ?? 6,
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    setSequences(data);
    setAdditionalSequences(seqs);
    onNext();
  });

  const updateSeq = (index: number, field: "prefix" | "pad_width", value: string | number) => {
    const updated = [...seqs];
    const existing = updated[index];
    if (!existing) return;
    const item = { ...existing };
    if (field === "prefix") {
      item.prefix = String(value);
    } else {
      item.pad_width = Number(value);
    }
    updated[index] = item;
    // We need to trigger a local state update; since we read from store or defaults,
    // we write back immediately
    setAdditionalSequences(updated);
  };

  const uhidPrefix = form.watch("uhid_prefix");
  const uhidPadWidth = form.watch("uhid_pad_width");
  const invoicePrefix = form.watch("invoice_prefix");
  const invoicePadWidth = form.watch("invoice_pad_width");

  const uhidPreview = `${uhidPrefix}${"0".repeat(Math.max(0, uhidPadWidth - 1))}1`;
  const invoicePreview = `${invoicePrefix}${"0".repeat(Math.max(0, invoicePadWidth - 1))}1`;

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          Configure the format for auto-generated identifiers. These affect patient UHIDs, invoice
          numbers, and other sequences.
        </Text>

        <div>
          <Text fw={600} mb="xs">
            UHID (Patient ID) Format
          </Text>
          <div className={classes.formGrid}>
            <TextInput
              label="Prefix"
              {...form.register("uhid_prefix")}
              error={form.formState.errors.uhid_prefix?.message}
            />
            <Controller
              control={form.control}
              name="uhid_pad_width"
              render={({ field }) => (
                <NumberInput
                  label="Pad Width"
                  value={field.value}
                  onChange={(v) => field.onChange(Number(v))}
                  min={3}
                  max={10}
                  error={form.formState.errors.uhid_pad_width?.message}
                />
              )}
            />
          </div>
          <div className={classes.sequencePreview}>{uhidPreview}</div>
        </div>

        <div>
          <Text fw={600} mb="xs">
            Invoice Number Format
          </Text>
          <div className={classes.formGrid}>
            <TextInput
              label="Prefix"
              {...form.register("invoice_prefix")}
              error={form.formState.errors.invoice_prefix?.message}
            />
            <Controller
              control={form.control}
              name="invoice_pad_width"
              render={({ field }) => (
                <NumberInput
                  label="Pad Width"
                  value={field.value}
                  onChange={(v) => field.onChange(Number(v))}
                  min={3}
                  max={10}
                  error={form.formState.errors.invoice_pad_width?.message}
                />
              )}
            />
          </div>
          <div className={classes.sequencePreview}>{invoicePreview}</div>
        </div>

        <Accordion variant="contained" defaultValue="additional">
          <Accordion.Item value="additional">
            <Accordion.Control icon={<IconHash size={16} />}>
              Additional Sequences ({seqs.length})
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                {seqs.map((seq, index) => (
                  <div key={seq.seq_type}>
                    <Text size="sm" fw={500} mb={4}>
                      {seqTypeLabels[seq.seq_type] ?? seq.seq_type}
                    </Text>
                    <div className={classes.formGrid}>
                      <TextInput
                        label="Prefix"
                        value={seq.prefix}
                        onChange={(e) => updateSeq(index, "prefix", e.currentTarget.value)}
                        size="sm"
                      />
                      <NumberInput
                        label="Pad Width"
                        value={seq.pad_width}
                        onChange={(v) => updateSeq(index, "pad_width", Number(v))}
                        min={3}
                        max={10}
                        size="sm"
                      />
                    </div>
                    <Text size="xs" c="dimmed" mt={2}>
                      Preview: {makePreview(seq.prefix, seq.pad_width)}
                    </Text>
                  </div>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>

        <div className={classes.navButtons}>
          <Button tone="secondary" onClick={onBack}>
            Back
          </Button>
          <Button tone="primary" type="submit">
            Save & Continue
          </Button>
        </div>
      </Stack>
    </form>
  );
}
