import { FileButton, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { IngestionItem } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconScan, IconSearch, IconUpload } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, Button, Card, Input, Select, toast } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";

const STATUS_TONE: Record<string, BadgeTone> = {
  uploaded: "neutral",
  linked: "info",
  filed: "success",
};

/**
 * Reverse print / digitisation — scan paper back into the MRD. Upload scans
 * into a batch, barcode-link each to its MRD record, and file (which attaches
 * the scan to the patient's record). The round-trip partner to case-sheet
 * printing.
 */
export function DigitizeTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.MRD.RECORDS_CREATE);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [barcodes, setBarcodes] = useState<Record<string, string>>({});

  const { data: batches = [] } = useQuery({
    queryKey: ["ingestion-batches"],
    queryFn: () => mrdService.listIngestionBatches(),
  });
  const { data: items = [] } = useQuery({
    queryKey: ["ingestion-items", batchId],
    queryFn: () => mrdService.listIngestionItems(batchId ?? ""),
    enabled: Boolean(batchId),
  });

  const invalidateItems = () =>
    void qc.invalidateQueries({ queryKey: ["ingestion-items", batchId] });

  const createBatch = useMutation({
    mutationFn: () => mrdService.createIngestionBatch({ label: newLabel.trim() }),
    onSuccess: (batch) => {
      setNewLabel("");
      setBatchId(batch.id);
      void qc.invalidateQueries({ queryKey: ["ingestion-batches"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not create batch" }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const presign = await mrdService.presignUpload({
        category: "mrd_scan",
        filename: file.name,
        mime_type: file.type || undefined,
      });
      const res = await fetch(presign.upload_url, {
        method: "PUT",
        body: file,
        headers: file.type ? { "Content-Type": file.type } : undefined,
      });
      if (!res.ok) throw new Error("Upload to storage failed.");
      return mrdService.addIngestionItem(batchId ?? "", {
        file_url: presign.key,
        original_filename: file.name,
        mime_type: file.type || undefined,
      });
    },
    onSuccess: () => {
      invalidateItems();
      toast.success("Scan uploaded", { title: "Digitise" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Upload failed" }),
  });

  const link = useMutation({
    mutationFn: ({ id, barcode }: { id: string; barcode: string }) =>
      mrdService.linkIngestionItem(id, { barcode }),
    onSuccess: invalidateItems,
    onError: (e: Error) => toast.error(e.message, { title: "Link failed" }),
  });
  const fileItem = useMutation({
    mutationFn: (id: string) => mrdService.fileIngestionItem(id),
    onSuccess: () => {
      invalidateItems();
      toast.success("Scan filed to the patient record", { title: "Digitise" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not file" }),
  });

  const ocr = useMutation({
    mutationFn: (id: string) => mrdService.ocrIngestionItem(id),
    onSuccess: (item) => {
      invalidateItems();
      if (item.ocr_status === "done") toast.success("Text extracted", { title: "OCR" });
      else if (item.ocr_status === "unavailable")
        toast.error("OCR engine not available on the server.", { title: "OCR" });
      else if (item.ocr_status === "unsupported")
        toast.error("OCR supports image scans; convert PDFs to images first.", { title: "OCR" });
      else toast.error("Could not extract text from this scan.", { title: "OCR" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "OCR failed" }),
  });

  const [search, setSearch] = useState("");
  const { data: searchResults = [] } = useQuery({
    queryKey: ["ingestion-search", search],
    queryFn: () => mrdService.searchIngested(search.trim()),
    enabled: search.trim().length > 1,
  });

  const columns = [
    {
      key: "file",
      label: "Scan",
      render: (it: IngestionItem) => (
        <Text size="sm" lineClamp={1}>
          {it.original_filename}
        </Text>
      ),
    },
    {
      key: "barcode",
      label: "MRD record # (barcode)",
      render: (it: IngestionItem) =>
        it.status === "uploaded" && canManage ? (
          <Group gap={4} wrap="nowrap">
            <Input
              placeholder="record number"
              value={barcodes[it.id] ?? ""}
              onChange={(e) => setBarcodes((b) => ({ ...b, [it.id]: e.currentTarget.value }))}
              size="xs"
              w={150}
            />
            <Button
              size="xs"
              tone="secondary"
              disabled={!(barcodes[it.id] ?? "").trim()}
              loading={link.isPending}
              onClick={() => link.mutate({ id: it.id, barcode: (barcodes[it.id] ?? "").trim() })}
            >
              Link
            </Button>
          </Group>
        ) : (
          <Text size="sm" ff="var(--mb-font-mono)">
            {it.barcode ?? "—"}
          </Text>
        ),
    },
    {
      key: "ocr",
      label: "OCR text",
      render: (it: IngestionItem) => (
        <Stack gap={2}>
          {it.extracted_text ? (
            <Text size="xs" lineClamp={2} maw={260}>
              {it.extracted_text}
            </Text>
          ) : (
            <Text size="xs" c="dimmed">
              {it.ocr_status ?? "not run"}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (it: IngestionItem) => (
        <Badge tone={STATUS_TONE[it.status] ?? "neutral"}>{it.status}</Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (it: IngestionItem) => (
        <Group gap={4} wrap="nowrap">
          {canManage && (
            <Button
              size="xs"
              tone="secondary"
              loading={ocr.isPending}
              onClick={() => ocr.mutate(it.id)}
            >
              OCR
            </Button>
          )}
          {canManage && it.status === "linked" && (
            <Button
              size="xs"
              tone="primary"
              loading={fileItem.isPending}
              onClick={() => fileItem.mutate(it.id)}
            >
              File to record
            </Button>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Card withBorder padding="sm">
        <Group gap="xs" mb="xs">
          <IconSearch size={16} />
          <Text fw={600} size="sm">
            Search digitised records
          </Text>
        </Group>
        <Input
          placeholder="Search by OCR'd text, file name, or MRD number"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        {search.trim().length > 1 && (
          <Stack gap={4} mt="xs">
            {searchResults.length === 0 && (
              <Text size="sm" c="dimmed">
                No matching scans.
              </Text>
            )}
            {searchResults.map((it) => (
              <Group key={it.id} justify="space-between" wrap="nowrap">
                <Text size="sm" lineClamp={1}>
                  {it.original_filename}
                  {it.barcode ? ` · ${it.barcode}` : ""}
                </Text>
                <Badge tone={STATUS_TONE[it.status] ?? "neutral"} size="sm">
                  {it.status}
                </Badge>
              </Group>
            ))}
          </Stack>
        )}
      </Card>

      <Card withBorder padding="sm">
        <Group gap="xs">
          <IconScan size={18} />
          <Text fw={600}>Digitise (reverse print)</Text>
        </Group>
        <Text size="sm" c="dimmed" mt={4}>
          Scan paper back into the MRD: upload into a batch, link each scan to its record number,
          then file it to the patient's record.
        </Text>
        <Group mt="sm" align="flex-end" gap="xs">
          <Select
            label="Batch"
            placeholder="Select a batch"
            data={batches.map((b) => ({ value: b.id, label: b.label }))}
            value={batchId}
            onChange={setBatchId}
            w={240}
          />
          {canManage && (
            <>
              <Input
                label="New batch"
                placeholder="e.g. Ward 4B discharge charts"
                value={newLabel}
                onChange={(e) => setNewLabel(e.currentTarget.value)}
                w={240}
              />
              <Button
                tone="secondary"
                disabled={!newLabel.trim()}
                loading={createBatch.isPending}
                onClick={() => createBatch.mutate()}
              >
                Create
              </Button>
            </>
          )}
          {canManage && batchId && (
            <FileButton
              onChange={(file) => file && upload.mutate(file)}
              accept="application/pdf,image/*"
            >
              {(props) => (
                <Button
                  {...props}
                  tone="primary"
                  leftSection={<IconUpload size={14} />}
                  loading={upload.isPending}
                >
                  Upload scan
                </Button>
              )}
            </FileButton>
          )}
        </Group>
      </Card>

      {batchId && (
        <DataTable columns={columns} data={items} loading={false} rowKey={(it) => it.id} />
      )}
    </Stack>
  );
}
