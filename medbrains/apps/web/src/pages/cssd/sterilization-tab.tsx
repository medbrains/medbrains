// CSSD SterilizationTab — split from cssd.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Checkbox,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { CssdIndicatorFormInput, CssdLoadFormInput } from "@medbrains/schemas";
import { cssdIndicatorFormSchema, cssdLoadFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateCssdLoadRequest,
  CssdIndicatorResult,
  CssdSterilizationLoad,
  LoadStatus,
  RecordCssdIndicatorRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconEye, IconFlame, IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, Button, IconButton, Table } from "@/components/ui";
import { cssdIndicatorTypeOptions, cssdMethodOptions, cssdOptionalText } from "@/forms/cssd.form";
import { cssdService } from "@/services/cssd.service";
import { methodLabels } from "./shared";

const STATUS_TONE: Record<string, BadgeTone> = {
  available: "success",
  sterile: "success",
  completed: "success",
  verified: "success",
  active: "success",
  pass: "success",
  loading: "neutral",
  pending: "neutral",
  running: "primary",
  in_use: "primary",
  decontaminating: "warning",
  preparing: "warning",
  sterilizing: "warning",
  damaged: "danger",
  failed: "danger",
  condemned: "danger",
  gray: "neutral",
  slate: "neutral",
  teal: "success",
  orange: "warning",
  red: "danger",
  blue: "info",
  primary: "primary",
  violet: "accent",
};

function statusBadgeTone(s: string): BadgeTone {
  return STATUS_TONE[s] ?? "neutral";
}

export function SterilizationTab() {
  const canCreate = useHasPermission(P.CSSD.STERILIZATION_CREATE);
  // Reading the loads and the indicator results is `cssd.sterilization.list`;
  // the sterilizer register is `cssd.equipment.list`. Neither is the create code
  // this tab already held, and an empty sterilization log reads as "nothing was
  // sterilised" — which on a CSSD board is a claim about the day's instruments.
  const canListSterilization = useHasPermission(P.CSSD.STERILIZATION_LIST);
  const canListEquipment = useHasPermission(P.CSSD.EQUIPMENT_LIST);
  const qc = useQueryClient();
  const [loadOpened, { open: openLoad, close: closeLoad }] = useDisclosure(false);
  const [selectedLoad, setSelectedLoad] = useState<CssdSterilizationLoad | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data: loads = [], isLoading } = useQuery({
    queryKey: ["cssd-loads"],
    queryFn: () => cssdService.listCssdLoads(),
    enabled: canListSterilization,
  });

  const { data: sterilizers = [] } = useQuery({
    queryKey: ["cssd-sterilizers"],
    queryFn: () => cssdService.listCssdSterilizers(),
    enabled: canListEquipment,
  });

  const loadForm = useForm<CssdLoadFormInput>({
    resolver: zodResolver(cssdLoadFormSchema),
    defaultValues: {
      sterilizer_id: "",
      method: "steam",
      is_flash: false,
      flash_reason: "",
      notes: "",
    },
  });
  const {
    control: loadControl,
    handleSubmit: handleLoadSubmit,
    reset: resetLoad,
    watch: watchLoad,
    formState: { errors: loadErrors },
  } = loadForm;
  const createLoadMut = useMutation({
    mutationFn: (data: CreateCssdLoadRequest) => cssdService.createCssdLoad(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-loads"] });
      notifications.show({ title: "Load created", message: "", color: "success" });
      closeLoad();
      resetLoad();
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LoadStatus }) =>
      cssdService.updateCssdLoadStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-loads"] });
      notifications.show({ title: "Load status updated", message: "", color: "primary" });
    },
  });

  // Indicators for detail view
  const { data: indicators = [] } = useQuery({
    queryKey: ["cssd-indicators", selectedLoad?.id],
    queryFn: () => cssdService.listCssdIndicators(selectedLoad?.id ?? ""),
    enabled: !!selectedLoad && canListSterilization,
  });

  const indicatorForm = useForm<CssdIndicatorFormInput>({
    resolver: zodResolver(cssdIndicatorFormSchema),
    defaultValues: {
      indicator_type: "chemical",
      result_pass: true,
      indicator_brand: "",
      indicator_lot: "",
    },
  });
  const {
    control: indicatorControl,
    handleSubmit: handleIndicatorSubmit,
    reset: resetIndicator,
    formState: { errors: indicatorErrors },
  } = indicatorForm;
  const indicatorMut = useMutation({
    mutationFn: (data: RecordCssdIndicatorRequest) =>
      cssdService.recordCssdIndicator(selectedLoad?.id ?? "", data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-indicators", selectedLoad?.id] });
      notifications.show({ title: "Indicator recorded", message: "", color: "success" });
      resetIndicator();
    },
  });

  const submitLoad = (values: CssdLoadFormInput) => {
    createLoadMut.mutate({
      sterilizer_id: values.sterilizer_id.trim(),
      method: values.method,
      is_flash: values.is_flash,
      flash_reason: values.is_flash ? cssdOptionalText(values.flash_reason) : undefined,
      notes: cssdOptionalText(values.notes),
    });
  };

  const submitIndicator = (values: CssdIndicatorFormInput) => {
    indicatorMut.mutate({
      indicator_type: values.indicator_type,
      result_pass: values.result_pass,
      indicator_brand: cssdOptionalText(values.indicator_brand),
      indicator_lot: cssdOptionalText(values.indicator_lot),
    });
  };

  const columns = [
    {
      key: "load_number" as const,
      label: "Load #",
      render: (l: CssdSterilizationLoad) => l.load_number,
    },
    {
      key: "method" as const,
      label: "Method",
      render: (l: CssdSterilizationLoad) => methodLabels[l.method] ?? l.method,
    },
    {
      key: "status" as const,
      label: "Status",
      render: (l: CssdSterilizationLoad) => (
        <Badge tone={statusBadgeTone(l.status)}>{l.status}</Badge>
      ),
    },
    {
      key: "is_flash" as const,
      label: "Flash",
      render: (l: CssdSterilizationLoad) =>
        l.is_flash ? <Badge tone="warning">Flash</Badge> : "—",
    },
    {
      key: "created_at" as const,
      label: "Created",
      render: (l: CssdSterilizationLoad) => new Date(l.created_at).toLocaleString(),
    },
    {
      key: "id" as const,
      label: "Actions",
      render: (l: CssdSterilizationLoad) => (
        <Group gap="xs">
          <Tooltip label="Details & Indicators">
            <IconButton
              tone="default"
              onClick={() => {
                setSelectedLoad(l);
                openDetail();
              }}
              aria-label="View details"
            >
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
          {canCreate && l.status === "loading" && (
            <Tooltip label="Start Cycle">
              <IconButton
                tone="primary"
                onClick={() => updateStatusMut.mutate({ id: l.id, status: "running" })}
                aria-label="Fire"
              >
                <IconFlame size={16} />
              </IconButton>
            </Tooltip>
          )}
          {canCreate && l.status === "running" && (
            <Tooltip label="Complete">
              <IconButton
                tone="success"
                onClick={() => updateStatusMut.mutate({ id: l.id, status: "completed" })}
                aria-label="Edit"
              >
                <IconPencil size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openLoad}>
            New Load
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={loads}
        loading={isLoading}
        rowKey={(l) => l.id}
        emptyTitle="No sterilization loads"
      />

      <Drawer
        opened={loadOpened}
        onClose={closeLoad}
        title="Create Sterilization Load"
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleLoadSubmit(submitLoad)}>
          <Controller
            name="sterilizer_id"
            control={loadControl}
            render={({ field }) => (
              <Select
                label="Sterilizer"
                data={sterilizers.map((s) => ({ value: s.id, label: s.name }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={loadErrors.sterilizer_id?.message}
              />
            )}
          />
          <Controller
            name="method"
            control={loadControl}
            render={({ field }) => (
              <Select
                label="Method"
                data={cssdMethodOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "steam")}
                error={loadErrors.method?.message}
              />
            )}
          />
          <Controller
            name="is_flash"
            control={loadControl}
            render={({ field }) => (
              <Checkbox
                label="Flash Sterilization"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          {watchLoad("is_flash") && (
            <Controller
              name="flash_reason"
              control={loadControl}
              render={({ field }) => (
                <TextInput
                  label="Flash Reason"
                  {...field}
                  error={loadErrors.flash_reason?.message}
                />
              )}
            />
          )}
          <Controller
            name="notes"
            control={loadControl}
            render={({ field }) => (
              <Textarea label="Notes" {...field} error={loadErrors.notes?.message} />
            )}
          />
          <Button tone="primary" loading={createLoadMut.isPending} type="submit">
            Create
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title={`Load ${selectedLoad?.load_number ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          {selectedLoad && (
            <>
              <Card withBorder>
                <Stack gap="xs">
                  <Group>
                    <Badge tone={statusBadgeTone(selectedLoad.status)}>{selectedLoad.status}</Badge>
                    {selectedLoad.is_flash && <Badge tone="warning">Flash</Badge>}
                  </Group>
                  <Text size="sm">
                    <b>Method:</b> {methodLabels[selectedLoad.method]}
                  </Text>
                  {selectedLoad.temperature_c && (
                    <Text size="sm">
                      <b>Temperature:</b> {String(selectedLoad.temperature_c)}°C
                    </Text>
                  )}
                  {selectedLoad.pressure_psi && (
                    <Text size="sm">
                      <b>Pressure:</b> {String(selectedLoad.pressure_psi)} PSI
                    </Text>
                  )}
                  {selectedLoad.cycle_time_minutes && (
                    <Text size="sm">
                      <b>Cycle Time:</b> {String(selectedLoad.cycle_time_minutes)} min
                    </Text>
                  )}
                </Stack>
              </Card>

              <Text fw={600} mt="md">
                Cycle Indicators ({indicators.length})
              </Text>
              {indicators.length > 0 && (
                <Card withBorder>
                  <Stack gap="xs">
                    {indicators.map((ind: CssdIndicatorResult) => (
                      <Group key={ind.id} justify="space-between">
                        <Group gap="xs">
                          <Badge>{ind.indicator_type === "biological" ? "BI" : "CI"}</Badge>
                          <Text size="sm">
                            {ind.indicator_type === "biological" ? "Biological" : "Chemical"}
                          </Text>
                        </Group>
                        <Badge tone={ind.result_pass ? "success" : "danger"}>
                          {ind.result_pass ? "Pass" : "Fail"}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              )}

              <Text fw={600} mt="md">
                Indicator Details
              </Text>
              {indicators.length > 0 && (
                <Table withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Result</Table.Th>
                      <Table.Th>Brand/Lot</Table.Th>
                      <Table.Th>Time</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {indicators.map((ind: CssdIndicatorResult) => (
                      <Table.Tr key={ind.id}>
                        <Table.Td>{ind.indicator_type}</Table.Td>
                        <Table.Td>
                          {ind.result_pass ? (
                            <Badge tone="success">Pass</Badge>
                          ) : (
                            <Badge tone="danger">Fail</Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {[ind.indicator_brand, ind.indicator_lot].filter(Boolean).join(" / ") ||
                            "—"}
                        </Table.Td>
                        <Table.Td>{new Date(ind.read_at).toLocaleString()}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}

              {canCreate && (
                <>
                  <Text fw={600}>Record Indicator</Text>
                  <Stack component="form" onSubmit={handleIndicatorSubmit(submitIndicator)}>
                    <Controller
                      name="indicator_type"
                      control={indicatorControl}
                      render={({ field }) => (
                        <Select
                          label="Type"
                          data={cssdIndicatorTypeOptions}
                          value={field.value}
                          onChange={(value) => field.onChange(value ?? "chemical")}
                          error={indicatorErrors.indicator_type?.message}
                        />
                      )}
                    />
                    <Controller
                      name="result_pass"
                      control={indicatorControl}
                      render={({ field }) => (
                        <Checkbox
                          label="Pass"
                          checked={field.value}
                          onChange={(event) => field.onChange(event.currentTarget.checked)}
                        />
                      )}
                    />
                    <Group grow>
                      <Controller
                        name="indicator_brand"
                        control={indicatorControl}
                        render={({ field }) => (
                          <TextInput
                            label="Brand"
                            {...field}
                            error={indicatorErrors.indicator_brand?.message}
                          />
                        )}
                      />
                      <Controller
                        name="indicator_lot"
                        control={indicatorControl}
                        render={({ field }) => (
                          <TextInput
                            label="Lot #"
                            {...field}
                            error={indicatorErrors.indicator_lot?.message}
                          />
                        )}
                      />
                    </Group>
                    <Button tone="primary" loading={indicatorMut.isPending} type="submit">
                      Record
                    </Button>
                  </Stack>
                </>
              )}
            </>
          )}
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Issuance Tab ────────────────────────────────────────
