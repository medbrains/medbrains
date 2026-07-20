import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  type SecurityAccessCardFormInput,
  type SecurityAccessLogFormInput,
  type SecurityZoneFormInput,
  securityAccessCardFormSchema,
  securityAccessLogFormSchema,
  securityZoneFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { SecurityAccessCard, SecurityAccessLog, SecurityZone } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBabyCarriage,
  IconFileReport,
  IconPlus,
  IconShieldLock,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  defaultSecurityAccessCardFormValues,
  defaultSecurityAccessLogFormValues,
  defaultSecurityZoneFormValues,
  securityAccessCardFormToRequest,
  securityAccessLogFormToRequest,
  securityZoneFormToRequest,
} from "@/forms/security.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { securityService } from "@/services/security.service";
import { CctvTab } from "./security/cctv-tab";
import { CodeDebriefsTab } from "./security/code-debriefs-tab";
import { IncidentsTab } from "./security/incidents-tab";
import { PatientSafetyTab } from "./security/patient-safety-tab";

// ── Constants ──────────────────────────────────────────

const ZONE_LEVELS = [
  { value: "public", label: "Public" },
  { value: "general", label: "General" },
  { value: "restricted", label: "Restricted" },
  { value: "high_security", label: "High Security" },
  { value: "critical", label: "Critical" },
];

const ACCESS_METHODS = [
  { value: "card", label: "Card" },
  { value: "biometric", label: "Biometric" },
  { value: "pin", label: "PIN" },
  { value: "manual", label: "Manual" },
];

const ZONE_LEVEL_COLORS: Record<string, BadgeTone> = {
  public: "neutral",
  general: "primary",
  restricted: "warning",
  high_security: "danger",
  critical: "accent",
};

// ══════════════════════════════════════════════════════════
//  Access Control Tab
// ══════════════════════════════════════════════════════════

function AccessControlTab() {
  const canManage = useHasPermission(P.SECURITY.ACCESS_MANAGE);
  const qc = useQueryClient();

  // ── Zones ──
  const { data: zones = [], isLoading: zonesLoading } = useQuery({
    queryKey: ["sec-zones"],
    queryFn: () => securityService.listSecurityZones(),
  });
  const [zoneOpened, { open: openZone, close: closeZone }] = useDisclosure(false);
  const zoneForm = useForm<SecurityZoneFormInput>({
    resolver: zodResolver(securityZoneFormSchema),
    defaultValues: defaultSecurityZoneFormValues,
  });
  const afterHoursRestricted = zoneForm.watch("after_hours_restricted");
  const handleOpenZone = () => {
    zoneForm.reset(defaultSecurityZoneFormValues);
    openZone();
  };
  const createZoneMut = useMutation({
    mutationFn: (values: SecurityZoneFormInput) =>
      securityService.createSecurityZone(securityZoneFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-zones"] });
      zoneForm.reset(defaultSecurityZoneFormValues);
      closeZone();
      notifications.show({
        title: "Zone Created",
        message: "Security zone added",
        color: "success",
      });
    },
  });

  const zoneColumns: Column<SecurityZone>[] = [
    { key: "zone_code", label: "Code", render: (r) => <Text fw={600}>{r.zone_code}</Text> },
    { key: "name", label: "Name", render: (r) => <Text>{r.name}</Text> },
    {
      key: "level",
      label: "Level",
      render: (r) => (
        <Badge tone={ZONE_LEVEL_COLORS[r.level] ?? "neutral"}>{r.level.replace("_", " ")}</Badge>
      ),
    },
    {
      key: "after_hours",
      label: "After Hours",
      render: (r) =>
        r.after_hours_restricted ? (
          <Badge tone="warning">Restricted</Badge>
        ) : (
          <Text c="dimmed">Open</Text>
        ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  // ── Access Cards ──
  const { data: cards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ["sec-cards"],
    queryFn: () => securityService.listSecurityAccessCards(),
  });
  const [cardOpened, { open: openCard, close: closeCard }] = useDisclosure(false);
  const cardForm = useForm<SecurityAccessCardFormInput>({
    resolver: zodResolver(securityAccessCardFormSchema),
    defaultValues: defaultSecurityAccessCardFormValues,
  });
  const handleOpenCard = () => {
    cardForm.reset(defaultSecurityAccessCardFormValues);
    openCard();
  };
  const createCardMut = useMutation({
    mutationFn: (values: SecurityAccessCardFormInput) =>
      securityService.createSecurityAccessCard(securityAccessCardFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-cards"] });
      cardForm.reset(defaultSecurityAccessCardFormValues);
      closeCard();
      notifications.show({
        title: "Card Issued",
        message: "Access card created",
        color: "success",
      });
    },
  });
  const deactivateCardMut = useMutation({
    mutationFn: (id: string) =>
      securityService.deactivateSecurityAccessCard(id, "Manual deactivation"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-cards"] });
      notifications.show({
        title: "Card Deactivated",
        message: "Access card deactivated",
        color: "orange",
      });
    },
  });

  const cardColumns: Column<SecurityAccessCard>[] = [
    { key: "card_number", label: "Card #", render: (r) => <Text fw={600}>{r.card_number}</Text> },
    {
      key: "employee_id",
      label: "Employee",
      render: (r) => <Text size="sm">{r.employee_id.slice(0, 8)}...</Text>,
    },
    { key: "card_type", label: "Type", render: (r) => <Text>{r.card_type ?? "standard"}</Text> },
    { key: "issued_date", label: "Issued", render: (r) => <Text size="sm">{r.issued_date}</Text> },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions" as const,
            label: "Actions",
            render: (r: SecurityAccessCard) =>
              r.is_active ? (
                <Tooltip label="Deactivate">
                  <IconButton
                    tone="danger"
                    onClick={() => deactivateCardMut.mutate(r.id)}
                    aria-label="Deactivate"
                  >
                    <IconX size={16} />
                  </IconButton>
                </Tooltip>
              ) : (
                <Text c="dimmed">—</Text>
              ),
          },
        ]
      : []),
  ];

  // ── Access Logs ──
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["sec-access-logs"],
    queryFn: () => securityService.listSecurityAccessLogs(),
  });
  const [logOpened, { open: openLog, close: closeLog }] = useDisclosure(false);
  const logForm = useForm<SecurityAccessLogFormInput>({
    resolver: zodResolver(securityAccessLogFormSchema),
    defaultValues: defaultSecurityAccessLogFormValues,
  });
  const handleOpenLog = () => {
    logForm.reset(defaultSecurityAccessLogFormValues);
    openLog();
  };
  const createLogMut = useMutation({
    mutationFn: (values: SecurityAccessLogFormInput) =>
      securityService.createSecurityAccessLog(securityAccessLogFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-access-logs"] });
      logForm.reset(defaultSecurityAccessLogFormValues);
      closeLog();
      notifications.show({
        title: "Log Recorded",
        message: "Access log entry created",
        color: "success",
      });
    },
  });

  const logColumns: Column<SecurityAccessLog>[] = [
    {
      key: "zone_id",
      label: "Zone",
      render: (r) => (
        <Text size="sm">
          {zones.find((z) => z.id === r.zone_id)?.zone_code ?? r.zone_id.slice(0, 8)}
        </Text>
      ),
    },
    {
      key: "person_name",
      label: "Person",
      render: (r) => <Text>{r.person_name ?? r.employee_id?.slice(0, 8) ?? "—"}</Text>,
    },
    {
      key: "access_method",
      label: "Method",
      render: (r) => <Badge tone="neutral">{r.access_method}</Badge>,
    },
    {
      key: "direction",
      label: "Direction",
      render: (r) => (
        <Badge tone={r.direction === "entry" ? "success" : "warning"}>{r.direction}</Badge>
      ),
    },
    {
      key: "granted",
      label: "Access",
      render: (r) => (
        <Badge tone={r.granted ? "success" : "danger"}>{r.granted ? "Granted" : "Denied"}</Badge>
      ),
    },
    {
      key: "is_after_hours",
      label: "After Hours",
      render: (r) =>
        r.is_after_hours ? <Badge tone="warning">Yes</Badge> : <Text c="dimmed">No</Text>,
    },
    {
      key: "accessed_at",
      label: "Time",
      render: (r) => <Text size="sm">{new Date(r.accessed_at).toLocaleString()}</Text>,
    },
  ];

  return (
    <Stack>
      <Text fw={600} size="lg">
        Security Zones
      </Text>
      <Group>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handleOpenZone}>
            Add Zone
          </Button>
        )}
      </Group>
      <DataTable columns={zoneColumns} data={zones} loading={zonesLoading} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="lg">
        Access Cards
      </Text>
      <Group>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handleOpenCard}>
            Issue Card
          </Button>
        )}
      </Group>
      <DataTable columns={cardColumns} data={cards} loading={cardsLoading} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="lg">
        Access Logs
      </Text>
      <Group>
        {canManage && (
          <Button tone="secondary" leftSection={<IconPlus size={16} />} onClick={handleOpenLog}>
            Log Entry
          </Button>
        )}
      </Group>
      <DataTable columns={logColumns} data={logs} loading={logsLoading} rowKey={(r) => r.id} />

      {/* Zone Drawer */}
      <Drawer
        opened={zoneOpened}
        onClose={closeZone}
        title="Add Security Zone"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={zoneForm.handleSubmit((values) => createZoneMut.mutate(values))}
        >
          <TextInput
            label="Zone Code"
            required
            {...zoneForm.register("zone_code")}
            error={zoneForm.formState.errors.zone_code?.message}
          />
          <TextInput
            label="Zone Name"
            required
            {...zoneForm.register("name")}
            error={zoneForm.formState.errors.name?.message}
          />
          <Controller
            control={zoneForm.control}
            name="level"
            render={({ field, fieldState }) => (
              <Select
                label="Security Level"
                data={ZONE_LEVELS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Textarea
            label="Description"
            {...zoneForm.register("description")}
            error={zoneForm.formState.errors.description?.message}
          />
          <Controller
            control={zoneForm.control}
            name="after_hours_restricted"
            render={({ field }) => (
              <Switch
                label="After Hours Restricted"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          {afterHoursRestricted && (
            <Group grow>
              <TextInput
                label="Start Time"
                placeholder="22:00"
                {...zoneForm.register("after_hours_start")}
                error={zoneForm.formState.errors.after_hours_start?.message}
              />
              <TextInput
                label="End Time"
                placeholder="06:00"
                {...zoneForm.register("after_hours_end")}
                error={zoneForm.formState.errors.after_hours_end?.message}
              />
            </Group>
          )}
          <Button tone="primary" type="submit" loading={createZoneMut.isPending}>
            Create Zone
          </Button>
        </Stack>
      </Drawer>

      {/* Card Drawer */}
      <Drawer
        opened={cardOpened}
        onClose={closeCard}
        title="Issue Access Card"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={cardForm.handleSubmit((values) => createCardMut.mutate(values))}
        >
          <Controller
            control={cardForm.control}
            name="employee_id"
            render={({ field }) => (
              <EmployeeSearchSelect
                label="Employee"
                required
                value={field.value}
                onChange={field.onChange}
                error={cardForm.formState.errors.employee_id?.message}
              />
            )}
          />
          <TextInput
            label="Card Number"
            required
            {...cardForm.register("card_number")}
            error={cardForm.formState.errors.card_number?.message}
          />
          <Controller
            control={cardForm.control}
            name="card_type"
            render={({ field, fieldState }) => (
              <Select
                label="Card Type"
                data={[
                  { value: "standard", label: "Standard" },
                  { value: "temporary", label: "Temporary" },
                  { value: "contractor", label: "Contractor" },
                ]}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={fieldState.error?.message}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createCardMut.isPending}>
            Issue Card
          </Button>
        </Stack>
      </Drawer>

      {/* Access Log Drawer */}
      <Drawer
        opened={logOpened}
        onClose={closeLog}
        title="Record Access Log"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={logForm.handleSubmit((values) => createLogMut.mutate(values))}
        >
          <Controller
            control={logForm.control}
            name="zone_id"
            render={({ field, fieldState }) => (
              <Select
                label="Zone"
                required
                data={zones.map((z) => ({ value: z.id, label: `${z.zone_code} — ${z.name}` }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Person Name"
            {...logForm.register("person_name")}
            error={logForm.formState.errors.person_name?.message}
          />
          <Controller
            control={logForm.control}
            name="access_method"
            render={({ field, fieldState }) => (
              <Select
                label="Access Method"
                data={ACCESS_METHODS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={logForm.control}
            name="direction"
            render={({ field, fieldState }) => (
              <Select
                label="Direction"
                data={[
                  { value: "entry", label: "Entry" },
                  { value: "exit", label: "Exit" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={logForm.control}
            name="granted"
            render={({ field }) => (
              <Switch
                label="Granted"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            control={logForm.control}
            name="is_after_hours"
            render={({ field }) => (
              <Switch
                label="After Hours"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createLogMut.isPending}>
            Record Log
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  CCTV Tab
// ══════════════════════════════════════════════════════════

export function SecurityPage() {
  useRequirePermission(P.SECURITY.ACCESS_LIST);

  return (
    <div>
      <PageHeader
        title="Security Department"
        subtitle="Access control, CCTV, incident management, patient safety tags"
      />
      <Tabs defaultValue="access">
        <Tabs.List>
          <Tabs.Tab value="access" leftSection={<IconShieldLock size={16} />}>
            Access Control
          </Tabs.Tab>
          <Tabs.Tab value="cctv" leftSection={<IconVideo size={16} />}>
            CCTV
          </Tabs.Tab>
          <Tabs.Tab value="incidents" leftSection={<IconAlertTriangle size={16} />}>
            Incidents
          </Tabs.Tab>
          <Tabs.Tab value="patient-safety" leftSection={<IconBabyCarriage size={16} />}>
            Patient Safety
          </Tabs.Tab>
          <Tabs.Tab value="debriefs" leftSection={<IconFileReport size={16} />}>
            Code Debriefs
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="access" pt="md">
          <AccessControlTab />
        </Tabs.Panel>
        <Tabs.Panel value="cctv" pt="md">
          <CctvTab />
        </Tabs.Panel>
        <Tabs.Panel value="incidents" pt="md">
          <IncidentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="patient-safety" pt="md">
          <PatientSafetyTab />
        </Tabs.Panel>
        <Tabs.Panel value="debriefs" pt="md">
          <CodeDebriefsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
