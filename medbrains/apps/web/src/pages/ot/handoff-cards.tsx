// OT handoff cards — split from ot.tsx (pure move).

import { Card, Checkbox, Group, Select, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { OtHandoffItem, SetupUser, UpsertPreopHandoffInput } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { adminAccessService } from "@/services/adminAccess.service";
import { otService } from "@/services/ot.service";

interface HandoffLike {
  items: OtHandoffItem[];
  completed: boolean;
  completed_at: string | null;
}

interface OtHandoffCardProps {
  bookingId: string;
  title: string;
  template: OtHandoffItem[];
  queryKey: string;
  canEdit: boolean;
  receiverLabel: string;
  confirmLabel: string;
  doneMessage: string;
  fetchHandoff: (bookingId: string) => Promise<HandoffLike | null>;
  upsertHandoff: (bookingId: string, data: UpsertPreopHandoffInput) => Promise<HandoffLike>;
}

const PREOP_HANDOFF_TEMPLATE: OtHandoffItem[] = [
  { key: "consent_verified", label: "Informed consent signed and verified", checked: false },
  { key: "id_band", label: "Patient ID band present and correct", checked: false },
  { key: "npo_confirmed", label: "Fasting / NPO status confirmed", checked: false },
  { key: "site_marked", label: "Surgical site marked (or not applicable)", checked: false },
  { key: "allergies_checked", label: "Allergies reviewed and band applied", checked: false },
  {
    key: "prosthetics_removed",
    label: "Dentures, lenses, jewellery and prosthetics removed",
    checked: false,
  },
  { key: "preop_meds_given", label: "Pre-op medication given as ordered", checked: false },
  { key: "valuables_secured", label: "Valuables handed to relatives / secured", checked: false },
  {
    key: "records_available",
    label: "Case notes, imaging and investigations available",
    checked: false,
  },
  {
    key: "blood_arranged",
    label: "Blood arranged if required (or not applicable)",
    checked: false,
  },
];

const POSTOP_HANDOFF_TEMPLATE: OtHandoffItem[] = [
  { key: "airway_patent", label: "Airway patent — extubated or secured", checked: false },
  { key: "vitals_stable", label: "Vital signs stable and documented", checked: false },
  { key: "pain_assessed", label: "Pain assessed and controlled", checked: false },
  { key: "ponv_assessed", label: "Nausea / vomiting assessed", checked: false },
  { key: "dressing_intact", label: "Surgical dressing dry and intact", checked: false },
  { key: "drains_lines", label: "Drains, catheters and IV lines documented", checked: false },
  { key: "bleeding_output", label: "Bleeding / drain output assessed", checked: false },
  { key: "aldrete_recorded", label: "Aldrete score recorded", checked: false },
  { key: "postop_orders", label: "Post-op orders and analgesia handed over", checked: false },
  {
    key: "belongings_notes",
    label: "Patient belongings and case notes accompany patient",
    checked: false,
  },
];

function OtHandoffCard({
  bookingId,
  title,
  template,
  queryKey,
  canEdit,
  receiverLabel,
  confirmLabel,
  doneMessage,
  fetchHandoff,
  upsertHandoff,
}: OtHandoffCardProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<OtHandoffItem[]>(template);
  const [receivedBy, setReceivedBy] = useState<string | null>(null);

  const { data: handoff } = useQuery({
    queryKey: [queryKey, bookingId],
    queryFn: () => fetchHandoff(bookingId),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => adminAccessService.listUsers(),
    staleTime: 300_000,
    enabled: canEdit,
  });

  const stored = handoff?.items;
  const effectiveItems = stored && stored.length > 0 ? stored : items;
  const completed = handoff?.completed ?? false;
  const allChecked = effectiveItems.every((i) => i.checked);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: [queryKey, bookingId] });

  const save = useMutation({
    mutationFn: (next: OtHandoffItem[]) => upsertHandoff(bookingId, { items: next }),
    onSuccess: invalidate,
    onError: () => toast.error("Failed to save handoff", { title: "Error" }),
  });
  const confirm = useMutation({
    mutationFn: () =>
      upsertHandoff(bookingId, {
        items: effectiveItems,
        received_by: receivedBy ?? undefined,
        completed: true,
      }),
    onSuccess: () => {
      invalidate();
      toast.success(doneMessage, { title: "Handoff complete" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Cannot confirm" }),
  });

  const toggle = (key: string) => {
    const next = effectiveItems.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i));
    setItems(next);
    save.mutate(next);
  };

  return (
    <Card withBorder padding="sm">
      <Group justify="space-between">
        <Text fw={600}>{title}</Text>
        <Badge tone={completed ? "success" : "warning"} size="sm">
          {completed ? "Handed off" : "Pending"}
        </Badge>
      </Group>
      {completed && handoff?.completed_at && (
        <Text size="xs" c="dimmed" mt={4}>
          Handed off at {new Date(handoff.completed_at).toLocaleString()}
        </Text>
      )}
      <Stack gap="xs" mt="xs">
        {effectiveItems.map((item) => (
          <Checkbox
            key={item.key}
            label={item.label}
            checked={item.checked}
            disabled={!canEdit || completed}
            onChange={() => toggle(item.key)}
            size="xs"
          />
        ))}
        {canEdit && !completed && (
          <>
            <Select
              label={receiverLabel}
              placeholder="Select staff"
              data={(users as SetupUser[]).map((u) => ({ value: u.id, label: u.full_name }))}
              value={receivedBy}
              onChange={setReceivedBy}
              searchable
              size="xs"
            />
            <Button
              tone="primary"
              size="xs"
              disabled={!allChecked || !receivedBy}
              loading={confirm.isPending}
              onClick={() => confirm.mutate()}
            >
              {allChecked ? confirmLabel : "Check all items to confirm"}
            </Button>
          </>
        )}
      </Stack>
    </Card>
  );
}

export function PostopHandoffCard({ bookingId }: { bookingId: string }) {
  const canEdit = useHasPermission(P.OT.POSTOP_CREATE);
  return (
    <OtHandoffCard
      bookingId={bookingId}
      title="OT → PACU / ward handoff"
      template={POSTOP_HANDOFF_TEMPLATE}
      queryKey="ot-postop-handoff"
      canEdit={canEdit}
      receiverLabel="Received by (PACU / ward nurse)"
      confirmLabel="Confirm handoff"
      doneMessage="Patient handed off from OT"
      fetchHandoff={(id) => otService.getPostopHandoff(id)}
      upsertHandoff={(id, data) => otService.upsertPostopHandoff(id, data)}
    />
  );
}

export function PreopHandoffCard({ bookingId }: { bookingId: string }) {
  const canEdit = useHasPermission(P.OT.PREOP_CREATE);
  return (
    <OtHandoffCard
      bookingId={bookingId}
      title="Ward → OT send-off"
      template={PREOP_HANDOFF_TEMPLATE}
      queryKey="ot-preop-handoff"
      canEdit={canEdit}
      receiverLabel="Received by (OT nurse)"
      confirmLabel="Confirm send-off to OT"
      doneMessage="Patient handed off to OT"
      fetchHandoff={(id) => otService.getPreopHandoff(id)}
      upsertHandoff={(id, data) => otService.upsertPreopHandoff(id, data)}
    />
  );
}
