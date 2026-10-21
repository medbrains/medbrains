import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { BloodDonation, TtiPanel } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Badge, Button, Input, Modal, Select, Table, toast } from "@/components/ui";
import { bloodBankService } from "@/services/bloodBank.service";
import {
  markerLabels,
  TTI_MARKERS,
  TTI_RESULT_OPTIONS,
  type TtiFormValues,
  toTtiRequest,
  ttiSummary,
} from "./tti-model";

const resultField = z.enum(["non_reactive", "reactive", "indeterminate", ""]).optional();
const schema = z
  .object({
    hiv: resultField,
    hbsag: resultField,
    hcv: resultField,
    syphilis: resultField,
    malaria: resultField,
    method: z.string().optional(),
    kit_lot: z.string().optional(),
  })
  .refine((v) => TTI_MARKERS.some(({ value }) => v[value]), {
    message: "Enter at least one marker result",
    path: ["hiv"],
  });

const STATUS_TONE = {
  cleared: "success",
  reactive: "danger",
  incomplete: "warning",
  withheld: "neutral",
} as const;

interface Props {
  donation: BloodDonation | null;
  onClose: () => void;
}

/** A donation's TTI screening: the five markers, and what they allow. */
export function TtiResultsDrawer({ donation, onClose }: Props) {
  const qc = useQueryClient();
  const canView = useHasPermission(P.BLOOD_BANK.TTI_VIEW);
  const canRecord = useHasPermission(P.BLOOD_BANK.TTI_RECORD);
  const donationId = donation?.id ?? "";

  const panelQuery = useQuery({
    queryKey: ["blood-bank", "tti", donationId],
    queryFn: () => bloodBankService.listTtiResults(donationId),
    enabled: canView && Boolean(donationId),
  });

  const { control, handleSubmit, reset } = useForm<TtiFormValues>({
    resolver: zodResolver(schema),
  });

  const recordMut = useMutation({
    mutationFn: (values: TtiFormValues) =>
      bloodBankService.recordTtiResults(donationId, toTtiRequest(values)),
    onSuccess: (panel: TtiPanel) => {
      qc.setQueryData(["blood-bank", "tti", donationId], panel);
      void qc.invalidateQueries({ queryKey: ["blood-bank", "components"] });
      void qc.invalidateQueries({ queryKey: ["blood-bank", "donors"] });
      reset();
      const notify = panel.status === "reactive" ? toast.warning : toast.success;
      notify(ttiSummary(panel), { title: "Screening recorded" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Screening not recorded" }),
  });

  const panel = panelQuery.data;

  return (
    <Modal
      opened={donation !== null}
      onClose={onClose}
      title={`TTI screening — bag ${donation?.bag_number ?? ""}`}
      fullScreen
    >
      <Stack>
        {!canView && (
          <Alert tone="neutral" title="No access to screening results">
            You can record results but not read them back.
          </Alert>
        )}
        {panelQuery.isError && (
          <Alert tone="danger" title="Screening results could not be loaded">
            Treat this donation's units as unscreened until the results load.
          </Alert>
        )}
        {panel && (
          <Alert tone={STATUS_TONE[panel.status]} title={`Screening ${panel.status}`}>
            {ttiSummary(panel)}
          </Alert>
        )}
        {panel && panel.results.length > 0 && (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Marker</Table.Th>
                <Table.Th>Result</Table.Th>
                <Table.Th>Method / kit lot</Table.Th>
                <Table.Th>Tested</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {panel.results.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>{markerLabels([r.marker])}</Table.Td>
                  <Table.Td>
                    <Badge
                      tone={
                        r.result === "reactive"
                          ? "danger"
                          : r.result === "non_reactive"
                            ? "success"
                            : "warning"
                      }
                    >
                      {r.result.replace("_", "-")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{[r.method, r.kit_lot].filter(Boolean).join(" / ") || "—"}</Table.Td>
                  <Table.Td>{new Date(r.tested_at).toLocaleString()}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {canRecord && panel?.status !== "reactive" && (
          <Stack gap="sm">
            <Text fw={600}>Enter results</Text>
            <Text size="sm" c="dimmed">
              Leave a marker blank if it has not been tested. A reactive result is final.
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {TTI_MARKERS.map(({ value, label }) => (
                <Controller
                  key={value}
                  name={value}
                  control={control}
                  render={({ field, fieldState }) => (
                    <Select
                      label={label}
                      data={TTI_RESULT_OPTIONS}
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? "")}
                      clearable
                      error={fieldState.error?.message}
                    />
                  )}
                />
              ))}
            </SimpleGrid>
            <Group grow>
              <Controller
                name="method"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Method"
                    placeholder="ELISA, CLIA, NAT…"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.currentTarget.value)}
                  />
                )}
              />
              <Controller
                name="kit_lot"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Kit lot"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.currentTarget.value)}
                  />
                )}
              />
            </Group>
            <Button
              tone="primary"
              loading={recordMut.isPending}
              onClick={() => void handleSubmit((v) => recordMut.mutate(v))()}
            >
              Save results
            </Button>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
