// Clinical-kb StateListTab — what this hospital must notify: the national list
// with its state's overlay, and the overlay itself for whoever manages it.

import { Group, Stack, Text, Title } from "@mantine/core";
import type { NotifiableDisease, NotifiableOverride } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, toast } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { ckbService } from "@/services/ckb.service";
import { OverrideModal } from "./override-modal";

const LIST_KEY = ["ckb-notifiable-list"];
const OVERRIDES_KEY = ["ckb-notifiable-overrides"];

export function StateListTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<NotifiableOverride | "new" | null>(null);
  const list = useQuery({ queryKey: LIST_KEY, queryFn: () => ckbService.getNotifiableList() });
  const overrides = useQuery({
    queryKey: OVERRIDES_KEY,
    queryFn: () => ckbService.listNotifiableOverrides(),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: LIST_KEY });
    void qc.invalidateQueries({ queryKey: OVERRIDES_KEY });
  };
  const remove = useMutation({
    mutationFn: (id: string) => ckbService.deleteNotifiableOverride(id),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message, { title: "Not changed" }),
  });
  const takeOff = useMutation({
    mutationFn: (d: NotifiableDisease) =>
      ckbService.upsertNotifiableOverride({ icd10_code: d.disease_code, is_notifiable: false }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message, { title: "Not changed" }),
  });
  const stateName = list.data?.state_name;

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          The national list{stateName ? `, with ${stateName}'s additions and exceptions` : ""}.
          Every diagnosis and lab result here is checked against it.
        </Text>
        {canManage && (
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setEditing("new")}
          >
            Add or change a disease
          </Button>
        )}
      </Group>
      {!stateName && list.data && (
        <Alert tone="info">
          This hospital's address has no state yet; set it in hospital settings so its state's list
          can be named here.
        </Alert>
      )}
      {list.isError && (
        <Alert tone="danger" title="The list could not be read">
          {list.error.message}
        </Alert>
      )}
      <DataTable
        columns={[
          {
            key: "disease_name",
            label: "Disease",
            render: (d: NotifiableDisease) => (
              <Group gap={6}>
                <Text size="sm">{d.disease_name}</Text>
                {d.overridden && <Badge tone="info">State</Badge>}
              </Group>
            ),
          },
          {
            key: "codes",
            label: "ICD-10 / ICD-11",
            render: (d: NotifiableDisease) => (
              <Text size="sm" ff="var(--mb-font-mono)">
                {d.disease_code}
                {d.icd11_code ? ` / ${d.icd11_code}` : ""}
              </Text>
            ),
          },
          {
            key: "reporting",
            label: "Report to",
            render: (d: NotifiableDisease) => (
              <Text size="sm">
                {d.reporting_body ?? "IDSP"}
                {d.report_timeframe ? ` · ${d.report_timeframe}` : ""}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (d: NotifiableDisease) =>
              canManage && !d.overridden ? (
                <Button
                  tone="ghost"
                  size="xs"
                  aria-label={`Take ${d.disease_name} off this hospital's list`}
                  onClick={() =>
                    confirmDestructive({
                      title: "Take off this hospital's list",
                      message: `${d.disease_name} will no longer be flagged here. Only do this when your state does not notify it.`,
                      confirmLabel: "Take off",
                      onConfirm: () => takeOff.mutate(d),
                    })
                  }
                >
                  Take off
                </Button>
              ) : null,
          },
        ]}
        data={list.data?.diseases ?? []}
        loading={list.isLoading}
        rowKey={(d: NotifiableDisease) => d.disease_code}
      />

      <Title order={6}>This hospital's changes</Title>
      <DataTable
        columns={[
          {
            key: "icd10_code",
            label: "Disease",
            render: (o: NotifiableOverride) => (
              <Text size="sm">
                {o.disease_name ?? o.icd10_code}{" "}
                <Text span size="xs" c="dimmed" ff="var(--mb-font-mono)">
                  {o.icd10_code}
                </Text>
              </Text>
            ),
          },
          {
            key: "is_notifiable",
            label: "Change",
            render: (o: NotifiableOverride) =>
              o.is_notifiable ? (
                <Badge tone="info">Notified here</Badge>
              ) : (
                <Badge tone="neutral">Not notified here</Badge>
              ),
          },
          {
            key: "notes",
            label: "Why",
            render: (o: NotifiableOverride) => (
              <Text size="sm" c="dimmed">
                {o.notes ?? "—"}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (o: NotifiableOverride) =>
              canManage ? (
                <Group gap={4} wrap="nowrap">
                  <Button tone="ghost" size="xs" onClick={() => setEditing(o)}>
                    Edit
                  </Button>
                  <Button
                    tone="ghost"
                    size="xs"
                    aria-label={`Undo the change to ${o.disease_name ?? o.icd10_code}`}
                    onClick={() => remove.mutate(o.id)}
                  >
                    Undo
                  </Button>
                </Group>
              ) : null,
          },
        ]}
        data={overrides.data ?? []}
        loading={overrides.isLoading}
        rowKey={(o: NotifiableOverride) => o.id}
      />

      {editing && (
        <OverrideModal
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      )}
    </Stack>
  );
}
