import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import type {
  StorefrontQueueRow,
  StorefrontVerifyRequest,
  StoreRejectReason,
} from "@medbrains/types";
import { IconExternalLink } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Image,
  Input,
  NumberField,
  SegmentedControl,
  Select,
  TextArea,
  toast,
} from "@/components/ui";
import { storefrontService } from "@/services/storefront.service";
import { decisionProblem, defaultDecisions, REJECT_REASONS } from "../store/storefront";

const schema = z.object({
  lines: z.array(
    z.object({
      catalog_item_id: z.string(),
      approve: z.boolean(),
      quantity: z.number().optional(),
      reason: z.string().optional(),
    }),
  ),
  note: z.string(),
  prescriber_name: z.string(),
  prescriber_registration: z.string(),
  patient_address: z.string(),
});
type Review = z.infer<typeof schema>;

interface OnlineOrderReviewProps {
  row: StorefrontQueueRow | null;
  patientName: string;
  onClose: () => void;
}

const optional = (v: string) => (v.trim() ? v.trim() : undefined);

/**
 * The pharmacist reads the prescription beside the lines and gives each
 * prescription line a verdict: approve (perhaps fewer), or refuse with a
 * reason. Schedule H1 needs the prescriber and the patient's address.
 */
export function OnlineOrderReview({ row, patientName, onClose }: OnlineOrderReviewProps) {
  return (
    <Drawer
      opened={row !== null}
      onClose={onClose}
      title={`Online order · ${patientName}`}
      position="right"
      size="lg"
    >
      {row && <ReviewForm key={row.id} row={row} onDone={onClose} />}
    </Drawer>
  );
}

function ReviewForm({ row, onDone }: { row: StorefrontQueueRow; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { control, handleSubmit } = useForm<Review>({
    resolver: zodResolver(schema),
    defaultValues: {
      lines: defaultDecisions(row.lines),
      note: "",
      prescriber_name: row.prescriber_name ?? "",
      prescriber_registration: row.prescriber_registration ?? "",
      patient_address: row.record_address ?? "",
    },
  });
  const decisions = useWatch({ control, name: "lines" });
  const verify = useMutation({
    mutationFn: (v: Review) => {
      const lines = v.lines.map((d) => ({
        catalog_item_id: d.catalog_item_id,
        approve: d.approve,
        ...(d.approve
          ? { quantity: d.quantity }
          : { reason: d.reason as StoreRejectReason | undefined }),
      }));
      const problem = decisionProblem(lines, row.lines);
      if (problem) throw new Error(problem);
      const body: StorefrontVerifyRequest = {
        lines,
        note: optional(v.note),
        prescriber_name: optional(v.prescriber_name),
        prescriber_registration: optional(v.prescriber_registration),
        patient_address: optional(v.patient_address),
      };
      return storefrontService.verifyStorefrontOrder(row.id, body);
    },
    onSuccess: (order) => {
      toast.success(order.status === "rejected" ? "Order rejected" : "Sent to fulfilment");
      void queryClient.invalidateQueries({ queryKey: ["storefront-orders"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not verified" }),
  });
  const url = storefrontService.storefrontPrescriptionUrl(row.id);

  return (
    <Stack component="form" gap="md" onSubmit={handleSubmit((v) => verify.mutate(v))}>
      {row.prescription_reused && (
        <Alert tone="warning" title="This prescription was uploaded for another patient too">
          Check it is this patient's before approving.
        </Alert>
      )}
      {row.has_prescription ? (
        <Stack gap="xs">
          <Image src={url} alt="The uploaded prescription" fit="contain" mah={420} />
          <Button
            component="a"
            href={url}
            target="_blank"
            rel="noopener"
            tone="tertiary"
            rightSection={<IconExternalLink size={14} />}
          >
            Open the prescription
          </Button>
        </Stack>
      ) : (
        <Text size="sm">Against the patient's prescription from this hospital.</Text>
      )}
      {row.lines.map((line) => {
        const index = decisions.findIndex((d) => d.catalog_item_id === line.catalog_item_id);
        return (
          <Card key={line.catalog_item_id} padding="sm">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600} size="sm">
                  {line.drug_name} × {line.quantity}
                </Text>
                {index < 0 && (
                  <Badge size="xs" tone="neutral">
                    No prescription needed
                  </Badge>
                )}
              </Group>
              {index >= 0 && (
                <LineVerdict
                  control={control}
                  index={index}
                  max={line.quantity}
                  approve={decisions[index]?.approve ?? true}
                />
              )}
            </Stack>
          </Card>
        );
      })}
      <Text fw={600} size="sm">
        Schedule H1 record
      </Text>
      <Text size="xs" c="dimmed">
        Needed when approving a Schedule H1 medicine.
      </Text>
      <Controller
        control={control}
        name="prescriber_name"
        render={({ field }) => <Input label="Prescriber's name" {...field} />}
      />
      <Controller
        control={control}
        name="prescriber_registration"
        render={({ field }) => <Input label="Prescriber's registration number" {...field} />}
      />
      <Controller
        control={control}
        name="patient_address"
        render={({ field }) => <TextArea label="Patient's address" {...field} />}
      />
      <Controller
        control={control}
        name="note"
        render={({ field }) => (
          <TextArea
            label="Note for the patient"
            description="When anything is refused or reduced"
            {...field}
          />
        )}
      />
      <Button type="submit" tone="primary" loading={verify.isPending}>
        Save verdict
      </Button>
    </Stack>
  );
}

function LineVerdict({
  control,
  index,
  max,
  approve,
}: {
  control: ReturnType<typeof useForm<Review>>["control"];
  index: number;
  max: number;
  approve: boolean;
}) {
  return (
    <>
      <Controller
        control={control}
        name={`lines.${index}.approve`}
        render={({ field }) => (
          <SegmentedControl
            aria-label="Verdict"
            data={[
              { value: "yes", label: "Approve" },
              { value: "no", label: "Refuse" },
            ]}
            value={field.value ? "yes" : "no"}
            onChange={(v) => field.onChange(v === "yes")}
          />
        )}
      />
      {approve ? (
        <Controller
          control={control}
          name={`lines.${index}.quantity`}
          render={({ field }) => (
            <NumberField
              label="Quantity to supply"
              min={1}
              max={max}
              value={field.value}
              onChange={(v) => field.onChange(Number(v))}
            />
          )}
        />
      ) : (
        <Controller
          control={control}
          name={`lines.${index}.reason`}
          render={({ field }) => (
            <Select
              label="Why not"
              data={REJECT_REASONS}
              value={field.value ?? null}
              onChange={(v) => field.onChange(v ?? undefined)}
            />
          )}
        />
      )}
    </>
  );
}
