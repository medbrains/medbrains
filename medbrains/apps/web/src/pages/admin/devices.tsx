import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  IconCheck,
  IconPlug,
  IconPlugConnected,
  IconPlugOff,
  IconPlus,
  IconSearch,
  IconServer,
} from "@tabler/icons-react";
import { PageHeader } from "../../components/PageHeader";
import { useRequirePermission } from "../../hooks/useRequirePermission";

// Types inlined until @medbrains/types rebuild propagates
interface DeviceAdapterCatalog { id: string; adapter_code: string; manufacturer: string; manufacturer_code: string; model: string; model_code: string; device_category: string; device_subcategory: string | null; protocol: string; transport: string; default_port: number | null; default_baud_rate: number | null; default_config: Record<string, unknown>; field_mappings: unknown[]; data_transforms: unknown[]; qc_recommendations: unknown[]; known_quirks: unknown[]; supported_tests: unknown[]; adapter_version: string; sdk_version: string; wasm_hash: string | null; wasm_size_bytes: number | null; is_verified: boolean; contributed_by: string; documentation_url: string | null; is_active: boolean; }
interface DeviceInstance { id: string; tenant_id: string; adapter_code: string; facility_id: string | null; department_id: string | null; name: string; code: string; serial_number: string | null; hostname: string | null; port: number | null; protocol_config: Record<string, unknown>; field_mappings: unknown[]; data_transforms: unknown[]; qc_config: Record<string, unknown>; ai_config_version: number; ai_confidence: number | null; human_overrides: Record<string, unknown>; config_source: string; status: string; last_heartbeat: string | null; last_message_at: string | null; last_error: string | null; error_count_24h: number; message_count_24h: number; bridge_agent_id: string | null; notes: string | null; tags: string[]; is_active: boolean; created_at: string; updated_at: string; }
interface GeneratedDeviceConfig { protocol_config: Record<string, unknown>; field_mappings: unknown[]; data_transforms: unknown[]; qc_config: Record<string, unknown>; applied_quirks: string[]; confidence: number; warnings: string[]; suggested_name: string; suggested_code: string; default_port: number | null; }
interface BridgeAgent { id: string; tenant_id: string | null; name: string; deployment_mode: string; version: string | null; hostname: string | null; capabilities: string[]; status: string; last_heartbeat: string | null; devices_connected: number; buffer_depth: number; is_active: boolean; created_at: string; }
interface ManufacturerSummary { code: string; name: string; model_count: number; }
interface CreateDeviceInstanceRequest { adapter_code: string; name: string; code: string; facility_id?: string; department_id?: string; serial_number?: string; hostname?: string; port?: number; credentials?: Record<string, unknown>; notes?: string; tags?: string[]; }

// ── Status badge color map ──

const STATUS_COLOR: Record<string, string> = {
  active: "success",
  testing: "info",
  pending_setup: "warning",
  configuring: "warning",
  degraded: "orange",
  disconnected: "danger",
  maintenance: "slate",
  decommissioned: "slate",
};

// ── Main Page ──────────────────────────────────────────────────

export function DevicesPage() {
  useRequirePermission("devices.list");
  const canCreate = useHasPermission("devices.create");

  const [wizardOpened, { open: openWizard, close: closeWizard }] = useDisclosure(false);

  return (
    <div>
      <PageHeader
        title="Device Integration"
        subtitle="Connect medical devices, manage adapters, monitor bridge agents"
        actions={
          canCreate ? (
            <Button leftSection={<IconPlus size={16} />} onClick={openWizard}>
              Add Device
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue="devices">
        <Tabs.List mb="md">
          <Tabs.Tab value="devices">Connected Devices</Tabs.Tab>
          <Tabs.Tab value="catalog">Adapter Catalog</Tabs.Tab>
          <Tabs.Tab value="routing">Routing Rules</Tabs.Tab>
          <Tabs.Tab value="agents">Bridge Agents</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="devices"><DeviceListTab /></Tabs.Panel>
        <Tabs.Panel value="catalog"><CatalogTab /></Tabs.Panel>
        <Tabs.Panel value="routing"><RoutingRulesTab /></Tabs.Panel>
        <Tabs.Panel value="agents"><AgentsTab /></Tabs.Panel>
      </Tabs>

      <AddDeviceWizard opened={wizardOpened} onClose={closeWizard} />
    </div>
  );
}

// ── Device List Tab ────────────────────────────────────────────

function DeviceListTab() {
  const { data: devices, isLoading } = useQuery({
    queryKey: ["devices", "instances"],
    queryFn: () => api.listDeviceInstances(),
  });

  if (isLoading) return <Loader />;

  if (!devices?.length) {
    return (
      <Card p="xl" ta="center">
        <ThemeIcon variant="light" size={64} radius="xl" mx="auto" mb="md">
          <IconPlug size={32} />
        </ThemeIcon>
        <Title order={4} c="var(--mb-text-secondary)">No devices connected</Title>
        <Text size="sm" c="var(--mb-text-muted)" mt="xs">
          Add your first device using the adapter catalog
        </Text>
      </Card>
    );
  }

  return (
    <Card p={0}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Device</Table.Th>
            <Table.Th>Adapter</Table.Th>
            <Table.Th>Protocol</Table.Th>
            <Table.Th>Host</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Messages (24h)</Table.Th>
            <Table.Th>AI Confidence</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {devices.map((d: DeviceInstance) => (
            <Table.Tr key={d.id}>
              <Table.Td>
                <div>
                  <Text size="sm" fw={600}>{d.name}</Text>
                  <Text size="xs" c="dimmed" ff="var(--font-mono, monospace)">{d.code}</Text>
                </div>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{d.adapter_code}</Text>
              </Table.Td>
              <Table.Td>
                <Badge size="sm" variant="light" color="slate">
                  {(d.protocol_config as Record<string, unknown>).type as string ?? d.adapter_code.split("_")[0]}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" ff="var(--font-mono, monospace)" c="dimmed">
                  {d.hostname ? `${d.hostname}:${d.port ?? ""}` : "Not configured"}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge size="sm" color={STATUS_COLOR[d.status] ?? "gray"}>
                  {d.status.replace(/_/g, " ")}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{d.message_count_24h}</Text>
              </Table.Td>
              <Table.Td>
                {d.ai_confidence != null ? (
                  <Badge
                    size="sm"
                    variant="light"
                    color={d.ai_confidence > 0.9 ? "success" : d.ai_confidence > 0.7 ? "warning" : "danger"}
                  >
                    {Math.round(d.ai_confidence * 100)}%
                  </Badge>
                ) : (
                  <Text size="xs" c="dimmed">Manual</Text>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

// ── Adapter Catalog Tab ────────────────────────────────────────

function CatalogTab() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<string | null>(null);

  const { data: adapters, isLoading } = useQuery({
    queryKey: ["devices", "catalog", search, category, protocol],
    queryFn: () =>
      api.listAdapterCatalog({
        q: search || undefined,
        category: category ?? undefined,
        protocol: protocol ?? undefined,
      }),
  });

  const { data: manufacturers } = useQuery({
    queryKey: ["devices", "manufacturers"],
    queryFn: () => api.listManufacturers(),
  });

  const categoryOptions = [
    { value: "lab_chemistry", label: "Lab - Chemistry" },
    { value: "lab_hematology", label: "Lab - Hematology" },
    { value: "lab_immunoassay", label: "Lab - Immunoassay" },
    { value: "lab_coagulation", label: "Lab - Coagulation" },
    { value: "lab_blood_gas", label: "Lab - Blood Gas" },
    { value: "lab_urinalysis", label: "Lab - Urinalysis" },
    { value: "patient_monitor", label: "Patient Monitor" },
    { value: "ventilator", label: "Ventilator" },
    { value: "ct_scanner", label: "CT Scanner" },
    { value: "mri_scanner", label: "MRI Scanner" },
    { value: "xray", label: "X-Ray" },
    { value: "ultrasound", label: "Ultrasound" },
    { value: "cold_chain_sensor", label: "Cold Chain Sensor" },
    { value: "blood_bank_analyzer", label: "Blood Bank" },
  ];

  const protocolOptions = [
    { value: "hl7_v2", label: "HL7 v2" },
    { value: "astm_e1381", label: "ASTM" },
    { value: "dicom", label: "DICOM" },
    { value: "serial_rs232", label: "Serial RS-232" },
    { value: "mqtt", label: "MQTT" },
    { value: "rest_json", label: "REST/JSON" },
  ];

  return (
    <Stack gap="md">
      <Group>
        <TextInput
          placeholder="Search adapters..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Category"
          data={categoryOptions}
          value={category}
          onChange={setCategory}
          clearable
          w={200}
        />
        <Select
          placeholder="Protocol"
          data={protocolOptions}
          value={protocol}
          onChange={setProtocol}
          clearable
          w={160}
        />
      </Group>

      {manufacturers && (
        <Group gap="xs">
          <Text size="xs" c="dimmed" fw={500}>
            {manufacturers.reduce((sum: number, m: ManufacturerSummary) => sum + m.model_count, 0)} adapters from{" "}
            {manufacturers.length} manufacturers
          </Text>
        </Group>
      )}

      {isLoading ? (
        <Loader />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {adapters?.map((a: DeviceAdapterCatalog) => (
            <Card key={a.id} withBorder p="md">
              <Group justify="space-between" mb="xs">
                <div>
                  <Text size="sm" fw={700}>{a.model}</Text>
                  <Text size="xs" c="dimmed">{a.manufacturer}</Text>
                </div>
                {a.is_verified && (
                  <Tooltip label="Verified by MedBrains">
                    <Badge size="xs" color="success" variant="filled" leftSection={<IconCheck size={10} />}>
                      Verified
                    </Badge>
                  </Tooltip>
                )}
              </Group>
              <Group gap="xs" mb="sm">
                <Badge size="xs" variant="light">{a.device_category.replace(/_/g, " ")}</Badge>
                <Badge size="xs" variant="outline" color="slate">{a.protocol.replace(/_/g, " ")}</Badge>
                <Badge size="xs" variant="filled"
                  color={(a as unknown as Record<string, string>).data_direction === "consumer" ? "info" :
                    (a as unknown as Record<string, string>).data_direction === "bidirectional" ? "violet" : "success"}>
                  {((a as unknown as Record<string, string>).data_direction ?? "producer").replace(/_/g, " ")}
                </Badge>
                {a.default_port && (
                  <Badge size="xs" variant="dot" color="slate">Port {a.default_port}</Badge>
                )}
              </Group>
              {/* Show app_url for consumer/bidirectional devices */}
              {a.default_config && !!(a.default_config as Record<string, unknown>).app_url && (
                <Text size="xs" c="dimmed" ff="var(--font-mono, monospace)" mb="xs">
                  App: {String((a.default_config as Record<string, unknown>).app_url)}
                </Text>
              )}
              {/* Show features for interactive devices */}
              {a.default_config && Array.isArray((a.default_config as Record<string, unknown>).features) && (
                <Group gap={4} mb="xs">
                  {((a.default_config as Record<string, unknown>).features as string[]).slice(0, 4).map((f: string) => (
                    <Badge key={f} size="xs" variant="dot" color="slate">{f.replace(/_/g, " ")}</Badge>
                  ))}
                  {((a.default_config as Record<string, unknown>).features as string[]).length > 4 && (
                    <Text size="xs" c="dimmed">{`+${((a.default_config as Record<string, unknown>).features as string[]).length - 4} more`}</Text>
                  )}
                </Group>
              )}
              {a.known_quirks && (a.known_quirks as unknown[]).length > 0 && (
                <Text size="xs" c="warning" mb="xs">
                  {(a.known_quirks as unknown[]).length} known quirk(s) — auto-applied
                </Text>
              )}
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

// ── Bridge Agents Tab ──────────────────────────────────────────

function AgentsTab() {
  const { data: agents, isLoading } = useQuery({
    queryKey: ["devices", "agents"],
    queryFn: () => api.listBridgeAgents(),
  });

  if (isLoading) return <Loader />;

  if (!agents?.length) {
    return (
      <Card p="xl" ta="center">
        <ThemeIcon variant="light" size={64} radius="xl" mx="auto" mb="md">
          <IconServer size={32} />
        </ThemeIcon>
        <Title order={4} c="var(--mb-text-secondary)">No bridge agents registered</Title>
        <Text size="sm" c="var(--mb-text-muted)" mt="xs">
          Deploy a medbrains-bridge agent and it will self-register here
        </Text>
      </Card>
    );
  }

  return (
    <Card p={0}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Agent</Table.Th>
            <Table.Th>Mode</Table.Th>
            <Table.Th>Capabilities</Table.Th>
            <Table.Th>Devices</Table.Th>
            <Table.Th>Buffer</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Last Heartbeat</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {agents.map((a: BridgeAgent) => (
            <Table.Tr key={a.id}>
              <Table.Td>
                <Text size="sm" fw={600}>{a.name}</Text>
                <Text size="xs" c="dimmed">{a.hostname ?? "Unknown host"}</Text>
              </Table.Td>
              <Table.Td><Badge size="sm" variant="light">{a.deployment_mode}</Badge></Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {a.capabilities.map((c: string) => (
                    <Badge key={c} size="xs" variant="outline" color="slate">{c}</Badge>
                  ))}
                </Group>
              </Table.Td>
              <Table.Td>{a.devices_connected}</Table.Td>
              <Table.Td>{a.buffer_depth}</Table.Td>
              <Table.Td>
                <Badge
                  size="sm"
                  color={a.status === "online" ? "success" : a.status === "degraded" ? "warning" : "danger"}
                  leftSection={a.status === "online" ? <IconPlugConnected size={10} /> : <IconPlugOff size={10} />}
                >
                  {a.status}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="xs" c="dimmed">
                  {a.last_heartbeat ? new Date(a.last_heartbeat).toLocaleTimeString() : "Never"}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

// ── Routing Rules Tab ──────────────────────────────────────────

interface RoutingRule {
  id: string;
  device_instance_id: string | null;
  adapter_code: string | null;
  name: string;
  description: string | null;
  target_module: string;
  match_strategy: string;
  match_field: string;
  target_entity: string;
  auto_verify: boolean;
  notify_on_critical: boolean;
  reject_duplicates: boolean;
  is_active: boolean;
  priority: number;
  created_at: string;
}

const MODULE_COLORS: Record<string, string> = {
  lab: "primary", radiology: "violet", vitals: "success",
  pharmacy: "orange", blood_bank: "danger", icu: "info", generic: "slate",
};

function RoutingRulesTab() {
  const queryClient = useQueryClient();
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false);

  const { data: rules, isLoading } = useQuery({
    queryKey: ["devices", "routing-rules"],
    queryFn: () => api.listRoutingRules() as Promise<RoutingRule[]>,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteRoutingRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", "routing-rules"] }),
  });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Text size="sm" fw={600}>Data Routing Rules</Text>
          <Text size="xs" c="dimmed">
            Configure how incoming device data maps to MedBrains modules
          </Text>
        </div>
        <Button size="sm" leftSection={<IconPlus size={14} />} variant="light" onClick={openAdd}>
          Add Rule
        </Button>
      </Group>

      {isLoading ? <Loader /> : !rules?.length ? (
        <Card p="xl" ta="center">
          <ThemeIcon variant="light" size={64} radius="xl" mx="auto" mb="md">
            <IconPlug size={32} />
          </ThemeIcon>
          <Title order={4} c="var(--mb-text-secondary)">No routing rules</Title>
          <Text size="sm" c="var(--mb-text-muted)" mt="xs">
            Add rules to route device data to lab, radiology, vitals, or other modules
          </Text>
        </Card>
      ) : (
        <Card p={0}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Rule</Table.Th>
                <Table.Th>Adapter</Table.Th>
                <Table.Th>Target</Table.Th>
                <Table.Th>Match</Table.Th>
                <Table.Th>Field</Table.Th>
                <Table.Th>Auto-verify</Table.Th>
                <Table.Th>Alerts</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rules.map((r: RoutingRule) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>{r.name}</Text>
                    {r.description && <Text size="xs" c="dimmed">{r.description}</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="var(--font-mono, monospace)" c="dimmed">{r.adapter_code ?? "Any"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={MODULE_COLORS[r.target_module] ?? "gray"}>{r.target_module}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="outline" color="slate">{r.match_strategy.replace(/_/g, " ")}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="var(--font-mono, monospace)">{r.match_field}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={r.auto_verify ? "danger" : "slate"} variant="light">
                      {r.auto_verify ? "Yes" : "No"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={r.notify_on_critical ? "success" : "slate"} variant="light">
                      {r.notify_on_critical ? "On" : "Off"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={r.is_active ? "success" : "slate"}>
                      {r.is_active ? "Active" : "Off"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="subtle" color="danger"
                      onClick={() => deleteMutation.mutate(r.id)}
                      loading={deleteMutation.isPending}>
                      Delete
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <Card withBorder p="md">
        <Text size="sm" fw={600} mb="xs">How routing works</Text>
        <Stack gap={4}>
          <Text size="xs" c="dimmed">1. Device sends data &rarr; bridge parses it &rarr; POSTs to /api/device-ingest/module</Text>
          <Text size="xs" c="dimmed">2. Server finds matching routing rules (by device or adapter type)</Text>
          <Text size="xs" c="dimmed">3. Extracts match value from parsed payload (e.g., OBR.3 = sample barcode)</Text>
          <Text size="xs" c="dimmed">4. Looks up existing order/record &rarr; creates/updates entity</Text>
          <Text size="xs" c="dimmed">5. If critical value detected and alerts on &rarr; sends notification</Text>
        </Stack>
      </Card>

      <AddRoutingRuleModal opened={addOpened} onClose={closeAdd} />
    </Stack>
  );
}

function AddRoutingRuleModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [adapterCode, setAdapterCode] = useState("");
  const [targetModule, setTargetModule] = useState("lab");
  const [matchStrategy, setMatchStrategy] = useState("order_id");
  const [matchField, setMatchField] = useState("");
  const [targetEntity, setTargetEntity] = useState("");

  const createMutation = useMutation({
    mutationFn: () => api.createRoutingRule({
      name,
      adapter_code: adapterCode || undefined,
      target_module: targetModule,
      match_strategy: matchStrategy,
      match_field: matchField,
      target_entity: targetEntity,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices", "routing-rules"] });
      setName(""); setAdapterCode(""); setMatchField(""); setTargetEntity("");
      onClose();
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700}>Add Routing Rule</Text>}>
      <Stack>
        <TextInput label="Rule name" value={name} onChange={(e) => setName(e.currentTarget.value)} required
          placeholder="e.g., Lab results from cobas 6000" />
        <TextInput label="Adapter code" value={adapterCode} onChange={(e) => setAdapterCode(e.currentTarget.value)}
          placeholder="e.g., roche_cobas_6000 (blank = all adapters)" ff="var(--font-mono, monospace)" />
        <Group grow>
          <Select label="Target module" data={[
            { value: "lab", label: "Lab" }, { value: "radiology", label: "Radiology" },
            { value: "vitals", label: "Vitals" }, { value: "pharmacy", label: "Pharmacy" },
            { value: "blood_bank", label: "Blood Bank" }, { value: "icu", label: "ICU" },
            { value: "generic", label: "Generic" },
          ]} value={targetModule} onChange={(v) => setTargetModule(v ?? "lab")} />
          <Select label="Match strategy" data={[
            { value: "order_id", label: "Order ID" }, { value: "sample_barcode", label: "Sample barcode" },
            { value: "patient_id", label: "Patient ID" }, { value: "accession_number", label: "Accession #" },
            { value: "uhid", label: "UHID" }, { value: "custom", label: "Custom" },
          ]} value={matchStrategy} onChange={(v) => setMatchStrategy(v ?? "order_id")} />
        </Group>
        <TextInput label="Match field path" value={matchField} onChange={(e) => setMatchField(e.currentTarget.value)}
          placeholder="e.g., OBR.3, PID.3, AccessionNumber" ff="var(--font-mono, monospace)" required />
        <TextInput label="Target entity" value={targetEntity} onChange={(e) => setTargetEntity(e.currentTarget.value)}
          placeholder="e.g., lab_results, icu_flowsheets, radiology_orders" ff="var(--font-mono, monospace)" required />
        <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}
          disabled={!name || !matchField || !targetEntity}
          leftSection={<IconCheck size={16} />}>
          Create Rule
        </Button>
      </Stack>
    </Modal>
  );
}

// ── Add Device Wizard ──────────────────────────────────────────

function AddDeviceWizard({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [selectedAdapter, setSelectedAdapter] = useState<DeviceAdapterCatalog | null>(null);
  const [aiConfig, setAiConfig] = useState<GeneratedDeviceConfig | null>(null);
  const [search, setSearch] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [hostname, setHostname] = useState("");
  const [port, setPort] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [notes, setNotes] = useState("");

  const { data: adapters } = useQuery({
    queryKey: ["devices", "catalog", search],
    queryFn: () => api.listAdapterCatalog({ q: search || undefined }),
    enabled: opened,
  });

  const previewMutation = useMutation({
    mutationFn: (adapterCode: string) => api.previewAdapterConfig(adapterCode) as Promise<GeneratedDeviceConfig>,
    onSuccess: (config: GeneratedDeviceConfig) => {
      setAiConfig(config);
      setName(config.suggested_name);
      setCode(config.suggested_code);
      if (config.default_port) setPort(String(config.default_port));
      setStep(2);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDeviceInstanceRequest) => api.createDeviceInstance(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      resetAndClose();
    },
  });

  function resetAndClose() {
    setStep(0);
    setSelectedAdapter(null);
    setAiConfig(null);
    setSearch("");
    setName("");
    setCode("");
    setHostname("");
    setPort("");
    setSerialNumber("");
    setNotes("");
    onClose();
  }

  function handleSelectAdapter(adapter: DeviceAdapterCatalog) {
    setSelectedAdapter(adapter);
    setStep(1);
    previewMutation.mutate(adapter.adapter_code);
  }

  function handleSave() {
    if (!selectedAdapter) return;
    createMutation.mutate({
      adapter_code: selectedAdapter.adapter_code,
      name,
      code,
      hostname: hostname || undefined,
      port: port ? Number(port) : undefined,
      serial_number: serialNumber || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <Modal
      opened={opened}
      onClose={resetAndClose}
      title={<Text fw={700} size="lg">Add Device</Text>}
      size="lg"
    >
      <Stepper active={step} size="sm" mb="lg">
        <Stepper.Step label="Select adapter" />
        <Stepper.Step label="AI config" />
        <Stepper.Step label="Network" />
        <Stepper.Step label="Confirm" />
      </Stepper>

      {/* Step 0: Select Adapter */}
      {step === 0 && (
        <Stack>
          <TextInput
            placeholder="Search by manufacturer or model..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          <SimpleGrid cols={2} spacing="sm">
            {adapters?.slice(0, 12).map((a: DeviceAdapterCatalog) => (
              <Card
                key={a.id}
                withBorder
                p="sm"
                style={{ cursor: "pointer" }}
                onClick={() => handleSelectAdapter(a)}
              >
                <Text size="sm" fw={600}>{a.model}</Text>
                <Text size="xs" c="dimmed">{a.manufacturer}</Text>
                <Group gap={4} mt={4}>
                  <Badge size="xs" variant="light">{a.device_category.replace(/_/g, " ")}</Badge>
                  <Badge size="xs" variant="outline" color="slate">{a.protocol}</Badge>
                  {a.is_verified && <Badge size="xs" color="success">Verified</Badge>}
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      )}

      {/* Step 1: Loading AI config */}
      {step === 1 && (
        <Stack align="center" py="xl">
          <Loader />
          <Text size="sm" c="dimmed">Generating configuration...</Text>
        </Stack>
      )}

      {/* Step 2: AI Config Review */}
      {step === 2 && aiConfig && selectedAdapter && (
        <Stack>
          <Group justify="space-between">
            <div>
              <Text size="sm" fw={600}>{selectedAdapter.manufacturer} {selectedAdapter.model}</Text>
              <Text size="xs" c="dimmed">Protocol: {selectedAdapter.protocol} | Transport: {selectedAdapter.transport}</Text>
            </div>
            <Badge
              size="md"
              color={aiConfig.confidence > 0.9 ? "success" : "warning"}
            >
              {Math.round(aiConfig.confidence * 100)}% auto-configured
            </Badge>
          </Group>

          {aiConfig.warnings.map((w: string, i: number) => (
            <Text key={i} size="xs" c="warning">{w}</Text>
          ))}

          {aiConfig.applied_quirks.length > 0 && (
            <Text size="xs" c="dimmed">
              Auto-applied quirks: {aiConfig.applied_quirks.join(", ")}
            </Text>
          )}

          <Text size="xs" fw={600} mt="sm">Field Mappings ({(aiConfig.field_mappings as unknown[]).length})</Text>
          <Card withBorder p="xs">
            {(aiConfig.field_mappings as Array<{ device_field: string; target: string }>).map((m, i) => (
              <Group key={i} gap="xs" py={2}>
                <Badge size="xs" variant="outline" ff="var(--font-mono)">{m.device_field}</Badge>
                <Text size="xs" c="dimmed">&rarr;</Text>
                <Badge size="xs" variant="light" color="primary" ff="var(--font-mono)">{m.target}</Badge>
              </Group>
            ))}
          </Card>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={() => setStep(3)}>Continue</Button>
          </Group>
        </Stack>
      )}

      {/* Step 3: Network & Credentials */}
      {step === 3 && (
        <Stack>
          <TextInput label="Device name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
          <TextInput label="Device code" value={code} onChange={(e) => setCode(e.currentTarget.value)} required
            description="Unique identifier for this device instance"
            ff="var(--font-mono, monospace)" />
          <Group grow>
            <TextInput label="Hostname / IP" value={hostname} onChange={(e) => setHostname(e.currentTarget.value)}
              placeholder="192.168.1.100" />
            <TextInput label="Port" value={port} onChange={(e) => setPort(e.currentTarget.value)}
              placeholder={String(aiConfig?.default_port ?? "")} w={100} />
          </Group>
          <TextInput label="Serial number" value={serialNumber} onChange={(e) => setSerialNumber(e.currentTarget.value)}
            placeholder="Optional" />
          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)}
            placeholder="Optional notes about this device" rows={2} />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={handleSave} loading={createMutation.isPending}
              leftSection={<IconCheck size={16} />}>
              Save Device
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
