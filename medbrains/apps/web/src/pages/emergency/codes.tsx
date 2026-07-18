// Emergency CodesTab — split from emergency.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Checkbox,
  Divider,
  Drawer,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  EmergencyCodeActivationFormInput,
  EmergencyCodeDeactivateFormInput,
} from "@medbrains/schemas";
import {
  emergencyCodeActivationFormSchema,
  emergencyCodeDeactivateFormSchema,
} from "@medbrains/schemas";
import type {
  CreateCodeActivationRequest,
  DeactivateCodeRequest,
  ErCodeActivation,
} from "@medbrains/types";
import { IconAlertTriangle, IconCheck, IconFileText, IconFirstAidKit } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { useClinicalEmit } from "@/components/ClinicalEventProvider";
import { Alert, Badge, Button, IconButton, toast } from "@/components/ui";
import {
  emergencyCodeDeactivateOutcomeOptions,
  emergencyCodeTypeOptions,
  emergencyOptionalText,
} from "@/forms/emergency.form";
import { emergencyService } from "@/services/emergency.service";

const CRASH_CART_ITEMS = [
  { key: "defibrillator_present", label: "Defibrillator present and functional" },
  { key: "defibrillator_charge_test", label: "Defibrillator charge test passed" },
  { key: "airway_equipment", label: "Airway equipment (ETT, laryngoscope, ambu bag)" },
  { key: "iv_access_supplies", label: "IV access supplies (cannulas, fluids, sets)" },
  { key: "adrenaline", label: "Adrenaline (Epinephrine) 1mg ampoules" },
  { key: "atropine", label: "Atropine 0.6mg ampoules" },
  { key: "amiodarone", label: "Amiodarone 150mg ampoules" },
  { key: "suction_equipment", label: "Suction equipment functional" },
  { key: "oxygen_supply", label: "Oxygen supply connected and flowing" },
  { key: "monitor_leads", label: "Cardiac monitor leads and pads" },
];

const emptyCodeActivationForm: EmergencyCodeActivationFormInput = {
  code_type: "code_blue",
  location: "",
  notes: "",
};

const emptyCodeDeactivateForm: EmergencyCodeDeactivateFormInput = {
  outcome: "resolved",
  notes: "",
};

function codeActivationClinicalPayload(code: ErCodeActivation): Record<string, unknown> {
  return {
    source_record_id: code.id,
    code_blue_id: code.id,
    code_activation_id: code.id,
    code_type: code.code_type,
    er_visit_id: code.er_visit_id,
    location: code.location,
    activated_at: code.activated_at,
    deactivated_at: code.deactivated_at,
    outcome: code.outcome,
    crash_cart_checklist: code.crash_cart_checklist,
    response_team: code.response_team,
    activated_by: code.activated_by,
    deactivated_by: code.deactivated_by,
  };
}

function emitCodeBlueLifecycleEvent(
  emit: (trigger: string, payload: Record<string, unknown>) => void,
  trigger: "emergency.code_blue.activated" | "emergency.code_blue.completed",
  code: ErCodeActivation,
) {
  if (code.code_type !== "code_blue") {
    return;
  }

  emit(trigger, codeActivationClinicalPayload(code));
}

function CrashCartChecklist({
  value,
  onChange,
}: {
  value: Record<string, boolean>;
  onChange: (updated: Record<string, boolean>) => void;
}) {
  const allChecked = CRASH_CART_ITEMS.every((item) => value[item.key] === true);
  const checkedCount = CRASH_CART_ITEMS.filter((item) => value[item.key] === true).length;

  return (
    <Card withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconFirstAidKit size={20} />
          <Title order={5}>Crash Cart Checklist</Title>
        </Group>
        <Badge tone={allChecked ? "success" : "warning"}>
          {checkedCount}/{CRASH_CART_ITEMS.length}
        </Badge>
      </Group>
      <Divider mb="sm" />
      <Stack gap="xs">
        {CRASH_CART_ITEMS.map((item) => (
          <Checkbox
            key={item.key}
            label={item.label}
            checked={value[item.key] === true}
            onChange={(e) => onChange({ ...value, [item.key]: e.currentTarget.checked })}
          />
        ))}
      </Stack>
    </Card>
  );
}

export function CodesTab({
  canView,
  canCreate,
  canUpdate,
  contextAction,
  contextLocation,
}: {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  contextAction: string;
  contextLocation: string;
}) {
  const contextCodeDefaults = { ...emptyCodeActivationForm, location: contextLocation };
  const shouldOpenContextCode = canCreate && contextAction === "new" && Boolean(contextLocation);
  const [opened, { open, close }] = useDisclosure(shouldOpenContextCode);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [deactivateOpened, { open: openDeactivateModal, close: closeDeactivateModal }] =
    useDisclosure(false);
  const [selectedCode, setSelectedCode] = useState<ErCodeActivation | null>(null);
  const [codeToDeactivate, setCodeToDeactivate] = useState<ErCodeActivation | null>(null);
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const { data = [], isLoading } = useQuery({
    queryKey: ["er-codes"],
    queryFn: () => emergencyService.listCodeActivations(),
    enabled: canView,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmergencyCodeActivationFormInput>({
    resolver: zodResolver(emergencyCodeActivationFormSchema),
    defaultValues: contextCodeDefaults,
  });
  const {
    control: deactivateControl,
    handleSubmit: handleDeactivateSubmit,
    reset: resetDeactivate,
    formState: { errors: deactivateErrors },
  } = useForm<EmergencyCodeDeactivateFormInput>({
    resolver: zodResolver(emergencyCodeDeactivateFormSchema),
    defaultValues: emptyCodeDeactivateForm,
  });
  const [crashCart, setCrashCart] = useState<Record<string, boolean>>({});

  const createMut = useMutation({
    mutationFn: (d: CreateCodeActivationRequest) => emergencyService.createCodeActivation(d),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["er-codes"] });
      emitCodeBlueLifecycleEvent(emit, "emergency.code_blue.activated", row);
      close();
      setCrashCart({});
      toast.error(`${row.code_type.toUpperCase()} activated`, { title: "Code Activated" });
    },
  });

  const deactivateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DeactivateCodeRequest }) =>
      emergencyService.deactivateCode(id, data),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["er-codes"] });
      emitCodeBlueLifecycleEvent(emit, "emergency.code_blue.completed", row);
      setSelectedCode((current) => (current?.id === row.id ? row : current));
      setCodeToDeactivate(null);
      resetDeactivate(emptyCodeDeactivateForm);
      closeDeactivateModal();
      notifications.show({ title: "Code Deactivated", message: "Code has been deactivated" });
    },
  });

  const handleCreate = (values: EmergencyCodeActivationFormInput) => {
    const hasCheckedItems = Object.values(crashCart).some((v) => v);
    const payload: CreateCodeActivationRequest = {
      code_type: values.code_type,
      location: values.location.trim(),
      notes: emergencyOptionalText(values.notes),
      crash_cart_checklist: hasCheckedItems ? crashCart : undefined,
    };
    createMut.mutate(payload);
  };

  const handleViewDetail = (code: ErCodeActivation) => {
    setSelectedCode(code);
    openDetail();
  };

  const handleOpenDeactivate = (code: ErCodeActivation) => {
    setCodeToDeactivate(code);
    resetDeactivate(emptyCodeDeactivateForm);
    openDeactivateModal();
  };

  const handleCloseDeactivate = () => {
    closeDeactivateModal();
    setCodeToDeactivate(null);
    resetDeactivate(emptyCodeDeactivateForm);
  };

  const handleDeactivateCode = (values: EmergencyCodeDeactivateFormInput) => {
    if (!codeToDeactivate) {
      return;
    }
    const payload: DeactivateCodeRequest = {
      outcome: values.outcome,
      notes: emergencyOptionalText(values.notes),
    };
    deactivateMut.mutate({ id: codeToDeactivate.id, data: payload });
  };

  const columns = [
    {
      key: "code_type",
      label: "Code",
      render: (r: ErCodeActivation) => (
        <TableValueBadge
          value="emergency"
          kind="priority"
          label={`CODE ${r.code_type.toUpperCase()}`}
          color={
            r.code_type === "code_blue"
              ? "primary"
              : r.code_type === "code_yellow"
                ? "warning"
                : "orange"
          }
          size="lg"
          variant="filled"
        />
      ),
    },
    {
      key: "activated_at",
      label: "Activated",
      render: (r: ErCodeActivation) => new Date(r.activated_at).toLocaleString(),
    },
    { key: "location", label: "Location", render: (r: ErCodeActivation) => r.location ?? "---" },
    { key: "outcome", label: "Outcome", render: (r: ErCodeActivation) => r.outcome ?? "---" },
    {
      key: "deactivated_at",
      label: "Status",
      render: (r: ErCodeActivation) =>
        r.deactivated_at ? (
          <TableValueBadge value="completed" label="Resolved" color="success" variant="filled" />
        ) : (
          <TableValueBadge value="active" label="Active" color="danger" variant="filled" />
        ),
    },
    {
      key: "crash_cart",
      label: "Crash Cart",
      render: (r: ErCodeActivation) => {
        const checklist = r.crash_cart_checklist as Record<string, boolean> | null;
        if (!checklist)
          return (
            <Text size="sm" c="dimmed">
              Not checked
            </Text>
          );
        const checked = Object.values(checklist).filter(Boolean).length;
        const total = CRASH_CART_ITEMS.length;
        return (
          <TableValueBadge
            value={checked === total ? "completed" : "pending"}
            color={checked === total ? "success" : "orange"}
            label={`${checked}/${total}`}
          />
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (r: ErCodeActivation) => (
        <Group gap="xs">
          <Tooltip label="View Details">
            <IconButton
              tone="primary"
              aria-label="View code activation details"
              onClick={() => handleViewDetail(r)}
            >
              <IconFileText size={16} />
            </IconButton>
          </Tooltip>
          {!r.deactivated_at && canUpdate && (
            <Tooltip label="Deactivate">
              <IconButton
                tone="success"
                aria-label="Deactivate code activation"
                onClick={() => handleOpenDeactivate(r)}
              >
                <IconCheck size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  const selectedChecklist = selectedCode?.crash_cart_checklist as Record<string, boolean> | null;

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button
            tone="danger"
            leftSection={<IconAlertTriangle size={16} />}
            onClick={() => {
              reset(contextCodeDefaults);
              open();
            }}
          >
            Activate Code
          </Button>
        </Group>
      )}
      {canView ? (
        <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            Code activation history is not available for your role. You can activate a new code when
            code creation is allowed.
          </Text>
        </Card>
      )}

      {/* Create Code Drawer */}
      <Drawer
        opened={opened}
        onClose={() => {
          close();
          setCrashCart({});
          reset(contextCodeDefaults);
        }}
        title="Activate Emergency Code"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreate)}>
          <Controller
            name="code_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Code Type"
                required
                data={emergencyCodeTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "code_blue")}
                error={errors.code_type?.message}
              />
            )}
          />
          <Controller
            name="location"
            control={control}
            render={({ field }) => (
              <TextInput label="Location" error={errors.location?.message} required {...field} />
            )}
          />
          <Controller
            name="notes"
            control={control}
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Divider />
          <CrashCartChecklist value={crashCart} onChange={setCrashCart} />
          <Button tone="danger" type="submit" loading={createMut.isPending}>
            Activate Code
          </Button>
        </Stack>
      </Drawer>

      <Modal
        opened={deactivateOpened}
        onClose={handleCloseDeactivate}
        title="Close Emergency Code"
        centered
      >
        <Stack component="form" onSubmit={handleDeactivateSubmit(handleDeactivateCode)}>
          {codeToDeactivate && (
            <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm" fw={600}>
                CODE {codeToDeactivate.code_type.toUpperCase()}
              </Text>
              <Text size="sm" c="dimmed">
                {codeToDeactivate.location ?? "Location not recorded"} - activated{" "}
                {new Date(codeToDeactivate.activated_at).toLocaleString()}
              </Text>
            </Alert>
          )}
          <Controller
            name="outcome"
            control={deactivateControl}
            render={({ field }) => (
              <Select
                label="Closure outcome"
                required
                data={emergencyCodeDeactivateOutcomeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "resolved")}
                error={deactivateErrors.outcome?.message}
              />
            )}
          />
          <Controller
            name="notes"
            control={deactivateControl}
            render={({ field }) => (
              <Textarea
                label="Closure notes"
                placeholder="Team handoff, patient disposition, all-clear confirmation"
                minRows={3}
                {...field}
              />
            )}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={handleCloseDeactivate}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={deactivateMut.isPending}>
              Close Code
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Code Detail Drawer */}
      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="Code Activation Details"
        position="right"
        size="lg"
      >
        {selectedCode && (
          <Stack>
            <Group>
              <Badge
                tone={selectedCode.code_type === "code_blue" ? "primary" : "warning"}
                size="xl"
              >
                CODE {selectedCode.code_type.toUpperCase()}
              </Badge>
              {selectedCode.deactivated_at ? (
                <Badge tone="success" size="lg">
                  Resolved
                </Badge>
              ) : (
                <Badge tone="danger" size="lg">
                  Active
                </Badge>
              )}
            </Group>
            <Text size="sm">
              <Text span fw={600}>
                Activated:
              </Text>{" "}
              {new Date(selectedCode.activated_at).toLocaleString()}
            </Text>
            {selectedCode.deactivated_at && (
              <Text size="sm">
                <Text span fw={600}>
                  Deactivated:
                </Text>{" "}
                {new Date(selectedCode.deactivated_at).toLocaleString()}
              </Text>
            )}
            {selectedCode.location && (
              <Text size="sm">
                <Text span fw={600}>
                  Location:
                </Text>{" "}
                {selectedCode.location}
              </Text>
            )}
            {selectedCode.outcome && (
              <Text size="sm">
                <Text span fw={600}>
                  Outcome:
                </Text>{" "}
                {selectedCode.outcome}
              </Text>
            )}
            {selectedCode.notes && (
              <Text size="sm">
                <Text span fw={600}>
                  Notes:
                </Text>{" "}
                {selectedCode.notes}
              </Text>
            )}

            <Divider />
            <Title order={5}>Crash Cart Checklist</Title>
            {selectedChecklist ? (
              <Card withBorder p="md">
                <Stack gap="xs">
                  {CRASH_CART_ITEMS.map((item) => (
                    <Group key={item.key} gap="xs">
                      {selectedChecklist[item.key] ? (
                        <ThemeIcon color="success" size="sm" radius="xl">
                          <IconCheck size={12} />
                        </ThemeIcon>
                      ) : (
                        <ThemeIcon color="danger" size="sm" radius="xl" variant="light">
                          <IconAlertTriangle size={12} />
                        </ThemeIcon>
                      )}
                      <Text size="sm" c={selectedChecklist[item.key] ? undefined : "danger"}>
                        {item.label}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Card>
            ) : (
              <Text size="sm" c="dimmed">
                No crash cart checklist was recorded for this activation.
              </Text>
            )}
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}

// ── MLC Cases Tab ──────────────────────────────────────
