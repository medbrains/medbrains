// Likely duplicate drugs in the formulary, and merging one into the other
// (#4861). Everything that pointed at the duplicate moves to the drug kept;
// drugs that differ in schedule or NDPS control are never merged.

import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CatalogDuplicatePair } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCopy, IconGitMerge } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Drawer, Input, Modal, toast } from "@/components/ui";
import { grnScanService } from "@/services/grnScan.service";

interface MergeChoice {
  keep: { id: string; label: string };
  drop: { id: string; label: string };
}

function MergeModal({ choice, onClose }: { choice: MergeChoice | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const merge = useMutation({
    mutationFn: (c: MergeChoice) =>
      grnScanService.mergeCatalogItems({
        survivor_id: c.keep.id,
        merged_id: c.drop.id,
        reason: reason.trim(),
      }),
    onSuccess: (record) => {
      const moved = Object.values(record.repointed).reduce((a, b) => a + b, 0);
      toast.success(`${moved} records and ${record.stock_moved} units moved.`, {
        title: "Drugs merged",
      });
      void qc.invalidateQueries({ queryKey: ["pharmacy-catalog-duplicates"] });
      void qc.invalidateQueries({ queryKey: ["pharmacy-catalog"] });
      setReason("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not merged" }),
  });
  return (
    <Modal opened={choice !== null} onClose={onClose} title="Merge duplicate drug">
      {choice && (
        <Stack>
          <Text size="sm">
            Keep <b>{choice.keep.label}</b>. <b>{choice.drop.label}</b> is retired and its batches,
            orders, prescriptions and stock move to the drug kept. This cannot be undone here.
          </Text>
          <Input
            label="Why are these the same drug?"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            error={reason.length > 0 && reason.trim().length < 5 ? "Say a little more" : undefined}
          />
          <Group justify="flex-end">
            <Button tone="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              tone="danger"
              leftSection={<IconGitMerge size={16} />}
              loading={merge.isPending}
              disabled={reason.trim().length < 5}
              onClick={() => merge.mutate(choice)}
            >
              Merge
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function DuplicatesList() {
  const [choice, setChoice] = useState<MergeChoice | null>(null);
  const pairs = useQuery({
    queryKey: ["pharmacy-catalog-duplicates"],
    queryFn: () => grnScanService.listCatalogDuplicates(),
  });
  const side = (id: string, code: string, name: string, stock: number) => ({
    id,
    label: `${name} (${code}, ${stock} in stock)`,
  });
  const columns = [
    {
      key: "a",
      label: "Drug",
      render: (r: CatalogDuplicatePair) => side(r.a_id, r.a_code, r.a_name, r.a_stock).label,
    },
    {
      key: "b",
      label: "Looks like",
      render: (r: CatalogDuplicatePair) => side(r.b_id, r.b_code, r.b_name, r.b_stock).label,
    },
    {
      key: "form",
      label: "Strength / form",
      render: (r: CatalogDuplicatePair) =>
        [r.strength, r.dosage_form].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "score",
      label: "Name match",
      render: (r: CatalogDuplicatePair) => `${Math.round(r.score * 100)}%`,
    },
    {
      key: "actions",
      label: "",
      render: (r: CatalogDuplicatePair) => {
        if (r.blocked_reason) return <Badge tone="danger">{r.blocked_reason}</Badge>;
        const a = side(r.a_id, r.a_code, r.a_name, r.a_stock);
        const b = side(r.b_id, r.b_code, r.b_name, r.b_stock);
        return (
          <Group gap="xs" wrap="nowrap">
            <Button size="xs" tone="secondary" onClick={() => setChoice({ keep: a, drop: b })}>
              Keep first
            </Button>
            <Button size="xs" tone="secondary" onClick={() => setChoice({ keep: b, drop: a })}>
              Keep second
            </Button>
          </Group>
        );
      },
    },
  ];
  return (
    <Stack>
      <Alert tone="info">
        Pairs with near-identical names and the same strength and form. Check the pack and
        manufacturer before merging; two brands of one molecule are not duplicates.
      </Alert>
      <DataTable
        columns={columns}
        data={pairs.data ?? []}
        loading={pairs.isLoading}
        error={pairs.error}
        onRetry={() => void pairs.refetch()}
        rowKey={(r) => `${r.a_id}-${r.b_id}`}
        emptyTitle="No likely duplicates found"
      />
      <MergeModal choice={choice} onClose={() => setChoice(null)} />
    </Stack>
  );
}

/** Toolbar button that opens the duplicate report; renders nothing without the permission. */
export function CatalogDuplicatesButton() {
  const canMerge = useHasPermission(P.PHARMACY.CATALOG_MERGE);
  const [opened, { open, close }] = useDisclosure(false);
  if (!canMerge) return null;
  return (
    <>
      <Button size="xs" tone="secondary" leftSection={<IconCopy size={14} />} onClick={open}>
        Find duplicates
      </Button>
      <Drawer
        opened={opened}
        onClose={close}
        title="Duplicate drugs"
        closeButtonProps={{ "aria-label": "Close duplicate drugs" }}
        position="right"
        size="xl"
      >
        {opened && <DuplicatesList />}
      </Drawer>
    </>
  );
}
