import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconBook,
  IconPlus,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type {
  CreatePgLogbookRequest,
  PgLogbookEntry,
  CoSignatureRequest as CoSigType,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { PageHeader } from "../components";

const ENTRY_TYPES = [
  { value: "case", label: "Case" },
  { value: "procedure", label: "Procedure" },
  { value: "ward_round", label: "Ward Round" },
  { value: "emergency", label: "Emergency" },
  { value: "seminar", label: "Seminar / CME" },
  { value: "other", label: "Other" },
];

export function PgLogbookPage() {
  useHasPermission(P.OPD.QUEUE_LIST);

  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string | null>("my-logbook");
  const [opened, { open, close }] = useDisclosure(false);
  const [entryType, setEntryType] = useState<string | null>("case");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [diagCodes, setDiagCodes] = useState("");
  const [procCodes, setProcCodes] = useState("");
  const [entryDate, setEntryDate] = useState<Date | null>(new Date());

  // My logbook entries
  const { data: myEntries = [] } = useQuery({
    queryKey: ["pg-logbook", "mine", userId],
    queryFn: () => api.listPgLogbook({ user_id: userId }),
    enabled: Boolean(userId),
  });

  // Entries pending my verification (supervisor view)
  const { data: pendingVerification = [] } = useQuery({
    queryKey: ["pg-logbook", "pending-verification", userId],
    queryFn: () => api.listPgLogbook({ supervisor_id: userId, pending_verification: true }),
    enabled: Boolean(userId),
  });

  // Co-signature requests
  const { data: coSignatures = [] } = useQuery({
    queryKey: ["co-signatures"],
    queryFn: () => api.listCoSignatures(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePgLogbookRequest) => api.createPgLogbookEntry(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pg-logbook"] });
      notifications.show({ title: "Created", message: "Logbook entry added", color: "success" });
      handleClose();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create entry", color: "danger" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.verifyPgLogbookEntry(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pg-logbook"] });
      notifications.show({ title: "Verified", message: "Logbook entry verified", color: "success" });
    },
  });

  const coSignMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateCoSignature(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["co-signatures"] });
      notifications.show({ title: "Updated", message: "Co-signature decision recorded", color: "success" });
    },
  });

  const handleClose = () => {
    close();
    setEntryType("case");
    setTitle("");
    setDescription("");
    setDiagCodes("");
    setProcCodes("");
    setEntryDate(new Date());
  };

  const handleCreate = () => {
    if (!entryType || !title.trim()) return;
    createMutation.mutate({
      entry_type: entryType,
      title: title.trim(),
      description: description.trim() || undefined,
      diagnosis_codes: diagCodes.trim() ? diagCodes.split(",").map((s) => s.trim()) : undefined,
      procedure_codes: procCodes.trim() ? procCodes.split(",").map((s) => s.trim()) : undefined,
      entry_date: entryDate ? entryDate.toISOString().slice(0, 10) : undefined,
    });
  };

  return (
    <div>
      <PageHeader
        title="PG Logbook & Supervision"
        subtitle="Case logs, procedure logs, and supervisor verification"
        actions={
          <Button leftSection={<IconPlus size={14} />} onClick={open}>
            New Entry
          </Button>
        }
      />

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="my-logbook" leftSection={<IconBook size={14} />}>
            My Logbook ({(myEntries as PgLogbookEntry[]).length})
          </Tabs.Tab>
          <Tabs.Tab value="pending-verification">
            Pending Verification ({(pendingVerification as PgLogbookEntry[]).length})
          </Tabs.Tab>
          <Tabs.Tab value="co-signatures">
            Co-Signatures ({(coSignatures as CoSigType[]).length})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="my-logbook" pt="md">
          <LogbookTable entries={myEntries as PgLogbookEntry[]} showVerify={false} />
        </Tabs.Panel>

        <Tabs.Panel value="pending-verification" pt="md">
          <LogbookTable
            entries={pendingVerification as PgLogbookEntry[]}
            showVerify
            onVerify={(id) => verifyMutation.mutate(id)}
          />
        </Tabs.Panel>

        <Tabs.Panel value="co-signatures" pt="md">
          <CoSignatureTable
            entries={coSignatures as CoSigType[]}
            userId={userId ?? ""}
            onDecision={(id, status) => coSignMutation.mutate({ id, status })}
          />
        </Tabs.Panel>
      </Tabs>

      <Modal opened={opened} onClose={handleClose} title="New Logbook Entry" size="md">
        <Stack gap="sm">
          <Select label="Entry Type" data={ENTRY_TYPES} value={entryType} onChange={setEntryType} required />
          <TextInput label="Title" placeholder="e.g. Appendectomy case #12" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
          <Textarea label="Description" placeholder="Details of the case/procedure" value={description} onChange={(e) => setDescription(e.currentTarget.value)} autosize minRows={3} />
          <TextInput label="Diagnosis Codes" placeholder="Comma-separated ICD-10 codes" value={diagCodes} onChange={(e) => setDiagCodes(e.currentTarget.value)} />
          <TextInput label="Procedure Codes" placeholder="Comma-separated codes" value={procCodes} onChange={(e) => setProcCodes(e.currentTarget.value)} />
          <DatePickerInput label="Entry Date" value={entryDate} onChange={(v) => setEntryDate(v as Date | null)} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleCreate} loading={createMutation.isPending} disabled={!entryType || !title.trim()}>
              Save Entry
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

function LogbookTable({
  entries,
  showVerify,
  onVerify,
}: {
  entries: PgLogbookEntry[];
  showVerify: boolean;
  onVerify?: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No entries found
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Date</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Title</Table.Th>
          <Table.Th>Diagnosis Codes</Table.Th>
          <Table.Th>Verified</Table.Th>
          {showVerify && <Table.Th w={60}>Action</Table.Th>}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {entries.map((e) => (
          <Table.Tr key={e.id}>
            <Table.Td><Text size="sm">{e.entry_date}</Text></Table.Td>
            <Table.Td><Badge size="sm" variant="light">{e.entry_type}</Badge></Table.Td>
            <Table.Td>
              <Text size="sm" fw={500}>{e.title}</Text>
              {e.description && <Text size="xs" c="dimmed" lineClamp={1}>{e.description}</Text>}
            </Table.Td>
            <Table.Td>
              {e.diagnosis_codes.length > 0 ? (
                <Group gap={2}>
                  {e.diagnosis_codes.map((c) => <Badge key={c} size="xs" variant="light">{c}</Badge>)}
                </Group>
              ) : "—"}
            </Table.Td>
            <Table.Td>
              {e.supervisor_verified ? (
                <Badge color="success" size="sm">Verified</Badge>
              ) : (
                <Badge color="warning" size="sm">Pending</Badge>
              )}
            </Table.Td>
            {showVerify && (
              <Table.Td>
                {!e.supervisor_verified && onVerify && (
                  <Tooltip label="Verify entry">
                    <ActionIcon variant="light" color="success" size="sm" onClick={() => onVerify(e.id)} aria-label="Confirm">
                      <IconCheck size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Table.Td>
            )}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function CoSignatureTable({
  entries,
  userId,
  onDecision,
}: {
  entries: CoSigType[];
  userId: string;
  onDecision: (id: string, status: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No co-signature requests
      </Text>
    );
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "approved": return "success";
      case "denied": return "danger";
      default: return "warning";
    }
  };

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Order Type</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Created</Table.Th>
          <Table.Th w={120}>Action</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {entries.map((e) => (
          <Table.Tr key={e.id}>
            <Table.Td><Badge size="sm" variant="light">{e.order_type}</Badge></Table.Td>
            <Table.Td><Badge color={statusColor(e.status)} size="sm">{e.status}</Badge></Table.Td>
            <Table.Td><Text size="xs" c="dimmed">{new Date(e.created_at).toLocaleString()}</Text></Table.Td>
            <Table.Td>
              {e.status === "pending" && e.approver_id === userId && (
                <Group gap={4}>
                  <Button size="xs" color="success" variant="light" onClick={() => onDecision(e.id, "approved")}>
                    Approve
                  </Button>
                  <Button size="xs" color="danger" variant="light" onClick={() => onDecision(e.id, "denied")}>
                    Deny
                  </Button>
                </Group>
              )}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
