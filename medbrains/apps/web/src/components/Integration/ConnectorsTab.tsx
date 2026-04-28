import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@medbrains/api";
import type { ConnectorRow } from "@medbrains/types";
import { IconActivity, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { showError, showSuccess } from "../../utils/notifications";

const STATUS_DOT: Record<string, string> = {
  active: "green",
  inactive: "gray",
  error: "red",
};

const CONNECTOR_TYPES = [
  { label: "REST API", value: "rest_api" },
  { label: "Database", value: "database" },
  { label: "FHIR", value: "fhir" },
  { label: "HL7 v2", value: "hl7_v2" },
  { label: "SMTP", value: "smtp" },
  { label: "SMS Gateway", value: "sms" },
  { label: "Webhook", value: "webhook" },
  { label: "ABDM", value: "abdm" },
];

export function ConnectorsTab() {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string | null>(null);
  const [formDesc, setFormDesc] = useState("");
  const [formConfig, setFormConfig] = useState("{}");

  const { data: connectors = [] } = useQuery({
    queryKey: ["orchestration", "connectors"],
    queryFn: () => api.listConnectors(),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.createConnector({
        connector_type: formType ?? "rest_api",
        name: formName,
        description: formDesc || undefined,
        config: safeParseJson(formConfig),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["orchestration", "connectors"],
      });
      showSuccess("Created", "Connector added");
      resetForm();
      close();
    },
    onError: () => showError("Error", "Failed to create connector"),
  });

  const testMut = useMutation({
    mutationFn: (id: string) => api.testConnector(id),
    onSuccess: (res) => {
      if (res.is_healthy) {
        showSuccess("Healthy", "Connector responded successfully");
      } else {
        showError("Unhealthy", "Health check failed");
      }
      void queryClient.invalidateQueries({
        queryKey: ["orchestration", "connectors"],
      });
    },
    onError: () => showError("Error", "Test request failed"),
  });

  function resetForm() {
    setFormName("");
    setFormType(null);
    setFormDesc("");
    setFormConfig("{}");
  }

  return (
    <Stack gap="sm">
      <Group justify="flex-end">
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={open}>
          Add Connector
        </Button>
      </Group>

      {connectors.length === 0 && (
        <Text c="dimmed" size="sm" ta="center" py="xl">
          No connectors configured
        </Text>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {connectors.map((c) => (
          <ConnectorCard
            key={c.id}
            connector={c}
            onTest={() => testMut.mutate(c.id)}
            testing={testMut.isPending}
          />
        ))}
      </SimpleGrid>

      <Modal opened={opened} onClose={close} title="Add Connector" size="md">
        <Stack gap="sm">
          <Select
            label="Type"
            data={CONNECTOR_TYPES}
            value={formType}
            onChange={setFormType}
            required
          />
          <TextInput
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Description"
            value={formDesc}
            onChange={(e) => setFormDesc(e.currentTarget.value)}
          />
          <Textarea
            label="Config (JSON)"
            value={formConfig}
            onChange={(e) => setFormConfig(e.currentTarget.value)}
            autosize
            minRows={3}
            maxRows={8}
            ff="monospace"
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              loading={createMut.isPending}
              disabled={!formName || !formType}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

interface ConnectorCardProps {
  connector: ConnectorRow;
  onTest: () => void;
  testing: boolean;
}

function ConnectorCard({ connector, onTest, testing }: ConnectorCardProps) {
  const stats = connector.stats as {
    total_calls?: number;
    success?: number;
    failures?: number;
  };

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="xs">
        <Text fw={600} size="sm">
          {connector.name}
        </Text>
        <Tooltip label="Test health">
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={onTest}
            loading={testing}
            aria-label="Test"
          >
            <IconActivity size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Group gap="xs" mb="xs">
        <Badge variant="outline" size="xs">
          {connector.connector_type.replace(/_/g, " ")}
        </Badge>
        <Badge
          size="xs"
          color={STATUS_DOT[connector.status] ?? "gray"}
          variant="dot"
        >
          {connector.status}
        </Badge>
        {connector.is_healthy !== null && (
          <Badge
            size="xs"
            color={connector.is_healthy ? "green" : "red"}
            variant="light"
          >
            {connector.is_healthy ? "healthy" : "unhealthy"}
          </Badge>
        )}
      </Group>

      {connector.description && (
        <Text size="xs" c="dimmed" lineClamp={2} mb="xs">
          {connector.description}
        </Text>
      )}

      <Group gap="lg">
        <StatValue label="Total" value={stats.total_calls ?? 0} />
        <StatValue label="OK" value={stats.success ?? 0} />
        <StatValue label="Fail" value={stats.failures ?? 0} />
      </Group>
    </Card>
  );
}

function StatValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600}>
        {value.toLocaleString()}
      </Text>
    </div>
  );
}

function safeParseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
