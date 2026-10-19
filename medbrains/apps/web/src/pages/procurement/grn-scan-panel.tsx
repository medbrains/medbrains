// Scanned supplier bills: upload a photo or PDF, the on-prem reader drafts it,
// a person reviews it beside the image and commits — only then does stock move.

import { FileButton, Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { GrnScanListItem, GrnScanStatus } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconRefresh, IconScan, IconTrash, IconUpload } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import {
  Badge,
  type BadgeTone,
  Button,
  Card,
  Drawer,
  IconButton,
  Table,
  toast,
} from "@/components/ui";
import { grnScanService } from "@/services/grnScan.service";
import { accuracyOf, sha256Hex } from "./grn-scan-logic";
import { GrnScanReviewPanel } from "./grn-scan-review";

const STATUS: Record<GrnScanStatus, { tone: BadgeTone; label: string }> = {
  uploaded: { tone: "neutral", label: "Uploaded" },
  parsing: { tone: "info", label: "Queued for the bill reader" },
  parsed: { tone: "warning", label: "Ready to review" },
  reviewing: { tone: "warning", label: "In review" },
  committed: { tone: "success", label: "Posted" },
  failed: { tone: "danger", label: "Could not be read" },
  discarded: { tone: "neutral", label: "Discarded" },
};

async function uploadBill(file: File) {
  // The hash is of the file as chosen, so the same bill uploaded twice is caught.
  const sha = await sha256Hex(file);
  const presign = await grnScanService.presignUpload({
    category: "purchase_bill",
    filename: file.name,
    mime_type: file.type || undefined,
  });
  const put = await fetch(presign.upload_url, {
    method: "PUT",
    body: file,
    headers: file.type ? { "Content-Type": file.type } : undefined,
  });
  if (!put.ok) throw new Error("Upload to storage failed.");
  return grnScanService.createScan({
    file_key: presign.key,
    file_sha256: sha,
    mime_type: file.type || undefined,
  });
}

function AccuracyCard() {
  const { data = [], error } = useQuery({
    queryKey: ["grn-scan-accuracy"],
    queryFn: () => grnScanService.getAccuracy(),
  });
  if (error) return <Text c="danger">Accuracy could not be loaded: {error.message}</Text>;
  if (data.length === 0) return null;
  return (
    <Card withBorder>
      <Stack gap="xs">
        <Text fw={600}>Bill reader accuracy by supplier</Text>
        <Text size="xs" c="dimmed">
          Fields read right: share of read fields nobody corrected. Matches held: remembered item
          matches the reviewer kept.
        </Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Supplier</Table.Th>
              <Table.Th>Bills</Table.Th>
              <Table.Th>Fields read right</Table.Th>
              <Table.Th>Matches held</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((row) => {
              const pct = accuracyOf(row);
              return (
                <Table.Tr key={row.vendor_id}>
                  <Table.Td>{row.vendor_name}</Table.Td>
                  <Table.Td>{row.scans}</Table.Td>
                  <Table.Td>{pct.fields === null ? "—" : `${pct.fields}%`}</Table.Td>
                  <Table.Td>{pct.matches === null ? "—" : `${pct.matches}%`}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}

export function GrnScanPanel() {
  const qc = useQueryClient();
  const canPost = useHasPermission(P.PROCUREMENT.GRN_POST);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const scans = useQuery({
    queryKey: ["grn-scans"],
    queryFn: () => grnScanService.listScans(),
    refetchInterval: 20_000,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["grn-scans"] });

  const upload = useMutation({
    mutationFn: uploadBill,
    onSuccess: () => {
      refresh();
      toast.success("Queued for the bill reader. It appears here to review once read.", {
        title: "Bill uploaded",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Upload refused" }),
  });
  const retry = useMutation({
    mutationFn: (id: string) => grnScanService.submitScan(id),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message, { title: "Could not resend" }),
  });
  const discard = useMutation({
    mutationFn: (id: string) => grnScanService.discardScan(id),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message, { title: "Could not discard" }),
  });

  const columns = [
    {
      key: "created_at",
      label: "Uploaded",
      render: (r: GrnScanListItem) => new Date(r.created_at).toLocaleString(),
    },
    { key: "vendor", label: "Supplier", render: (r: GrnScanListItem) => r.vendor_name ?? "—" },
    { key: "invoice", label: "Invoice", render: (r: GrnScanListItem) => r.invoice_number ?? "—" },
    {
      key: "status",
      label: "Status",
      render: (r: GrnScanListItem) => (
        <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
      ),
    },
    {
      key: "grn",
      label: "GRN",
      render: (r: GrnScanListItem) => r.grn_number ?? "—",
    },
    {
      key: "actions",
      label: "",
      render: (r: GrnScanListItem) => (
        <Group gap="xs" wrap="nowrap">
          {(r.status === "parsed" || r.status === "reviewing") && (
            <Button
              size="xs"
              tone="primary"
              leftSection={<IconScan size={16} />}
              onClick={() => {
                setReviewId(r.id);
                open();
              }}
            >
              Review
            </Button>
          )}
          {r.status === "failed" && (
            <IconButton aria-label="Send to the reader again" onClick={() => retry.mutate(r.id)}>
              <IconRefresh size={16} />
            </IconButton>
          )}
          {r.status !== "committed" && r.status !== "discarded" && (
            <IconButton aria-label="Discard this scan" onClick={() => discard.mutate(r.id)}>
              <IconTrash size={16} />
            </IconButton>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Photograph or scan a distributor bill. The reader drafts the GRN; you check it against the
          image and post it.
        </Text>
        <FileButton onChange={(f) => f && upload.mutate(f)} accept="image/*,application/pdf">
          {(props) => (
            <Button
              {...props}
              tone="primary"
              leftSection={<IconUpload size={16} />}
              loading={upload.isPending}
            >
              Upload a bill
            </Button>
          )}
        </FileButton>
      </Group>
      <DataTable
        columns={columns}
        data={scans.data ?? []}
        loading={scans.isLoading}
        error={scans.error}
        onRetry={() => void scans.refetch()}
        rowKey={(r) => r.id}
        emptyTitle="No scanned bills yet"
      />
      <AccuracyCard />
      <Drawer
        opened={opened}
        onClose={close}
        title="Review scanned bill"
        closeButtonProps={{ "aria-label": "Close bill review" }}
        position="right"
        size="100%"
      >
        {reviewId && (
          <GrnScanReviewPanel
            key={reviewId}
            scanId={reviewId}
            canPost={canPost}
            onCommitted={() => {
              refresh();
              close();
            }}
          />
        )}
      </Drawer>
    </Stack>
  );
}
