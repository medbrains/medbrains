import { Group, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { MarketingContact } from "@medbrains/types";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, Drawer, Select, toast } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";
import { EnquiryDetailDrawer } from "./enquiry-detail-drawer";

export function MarketingEnquiriesTab({
  canView,
  canCreate,
  canLog,
  canMoveStage,
  canViewStages,
}: {
  canView: boolean;
  canCreate: boolean;
  canLog: boolean;
  canMoveStage: boolean;
  canViewStages: boolean;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<MarketingContact | null>(null);
  const [createOpen, createDrawer] = useDisclosure(false);
  const [form, setForm] = useState({ display_name: "", phone: "", email: "", source: "walk_in" });

  // Stages are rows, not an enum, so the filter and the mover both read them
  // from the server rather than hard-coding a vocabulary that a dental clinic
  // and an IVF unit would not share.
  const { data: stages = [] } = useQuery({
    queryKey: ["marketing", "stages"],
    queryFn: () => marketingService.listStages(),
    enabled: canViewStages,
  });

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (search.trim() !== "") params.search = search.trim();
    if (stageFilter) params.stage_id = stageFilter;
    return params;
  }, [search, stageFilter]);

  const {
    data: contacts = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "contacts", filters],
    queryFn: () => marketingService.listContacts(filters),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      marketingService.createContact({
        display_name: form.display_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        source: form.source,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketing", "contacts"] });
      setForm({ display_name: "", phone: "", email: "", source: "walk_in" });
      createDrawer.close();
      toast.success("Enquiry recorded");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not record enquiry" }),
  });

  const stageName = (id: string | null) =>
    id ? (stages.find((s) => s.id === id)?.name ?? "—") : "—";

  const columns = [
    {
      key: "display_name",
      label: "Name",
      render: (row: MarketingContact) => (
        <Text fw={500}>{row.display_name ?? "Unnamed enquiry"}</Text>
      ),
    },
    {
      key: "primary_phone",
      label: "Phone",
      render: (row: MarketingContact) => <Text size="sm">{row.primary_phone ?? "—"}</Text>,
    },
    {
      key: "source",
      label: "Source",
      render: (row: MarketingContact) => <Text size="sm">{row.source}</Text>,
    },
    {
      key: "stage",
      label: "Stage",
      render: (row: MarketingContact) => (
        <Badge tone="info" size="sm">
          {stageName(row.stage_id)}
        </Badge>
      ),
    },
    {
      key: "last_contacted_at",
      label: "Last contact",
      render: (row: MarketingContact) => (
        <Text size="sm" c="dimmed">
          {row.last_contacted_at
            ? new Date(row.last_contacted_at).toLocaleDateString()
            : "Never contacted"}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      <Group>
        <TextInput
          size="xs"
          placeholder="Search name or phone"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        {canViewStages && (
          <Select
            size="xs"
            placeholder="All stages"
            data={stages.map((s) => ({ value: s.id, label: s.name }))}
            value={stageFilter}
            onChange={setStageFilter}
            clearable
          />
        )}
        {canCreate && (
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={createDrawer.open}
          >
            New enquiry
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={contacts}
        loading={isLoading}
        rowKey={(row: MarketingContact) => row.id}
        // Opening an enquiry carries `marketing.contacts.view`, which is a
        // different code from listing them — a desk that may see the worklist
        // does not necessarily hold the record.
        onRowClick={canView ? (row: MarketingContact) => setSelected(row) : undefined}
        emptyTitle={isError ? "Enquiries could not be loaded" : "No enquiries"}
        emptyDescription={
          isError
            ? "This is not a statement that there are none — the list failed to load."
            : "Nothing matches these filters."
        }
      />

      <Text size="xs" c="dimmed">
        Showing the {contacts.length} most recently active. Narrow with search or stage rather than
        paging — the server returns a fixed window.
      </Text>

      <EnquiryDetailDrawer
        contact={selected}
        stages={stages}
        canLog={canLog}
        canMoveStage={canMoveStage}
        onClose={() => setSelected(null)}
      />

      <Drawer opened={createOpen} onClose={createDrawer.close} title="New enquiry" position="right">
        <Stack gap="sm">
          <TextInput
            label="Name"
            value={form.display_name}
            onChange={(event) =>
              setForm((f) => ({ ...f, display_name: event.currentTarget.value }))
            }
          />
          <TextInput
            label="Phone"
            value={form.phone}
            onChange={(event) => setForm((f) => ({ ...f, phone: event.currentTarget.value }))}
          />
          <TextInput
            label="Email"
            value={form.email}
            onChange={(event) => setForm((f) => ({ ...f, email: event.currentTarget.value }))}
          />
          <TextInput
            label="Source"
            value={form.source}
            onChange={(event) => setForm((f) => ({ ...f, source: event.currentTarget.value }))}
          />
          <Group justify="flex-end">
            <Button tone="secondary" size="xs" onClick={createDrawer.close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              size="xs"
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Record enquiry
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  );
}
