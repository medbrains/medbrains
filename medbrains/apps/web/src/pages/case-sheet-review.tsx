import { Group, Image, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CaseSheetScan } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconFileText } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, Card, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { caseSheetService } from "@/services/caseSheet.service";

type ExtractedField = { field: string; value: string; confidence?: number };

function statusTone(s: string): BadgeTone {
  if (s === "committed") return "success";
  if (s === "failed") return "danger";
  if (s === "parsed" || s === "reviewing") return "info";
  return "neutral";
}

function confidenceTone(c?: number): BadgeTone {
  if (c === undefined) return "neutral";
  if (c >= 0.85) return "success";
  if (c >= 0.6) return "warning";
  return "danger";
}

function ReviewPanel({ scan, canFile }: { scan: CaseSheetScan; canFile: boolean }) {
  const qc = useQueryClient();
  const initial = useMemo<ExtractedField[]>(
    () => (Array.isArray(scan.extracted_json) ? (scan.extracted_json as ExtractedField[]) : []),
    [scan.extracted_json],
  );
  const [fields, setFields] = useState<ExtractedField[]>(initial);

  const { data: image } = useQuery({
    queryKey: ["case-sheet-image", scan.id],
    queryFn: () => caseSheetService.presignDownload(scan.scan_image_url),
    enabled: !!scan.scan_image_url,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["case-sheet-scans"] });
    void qc.invalidateQueries({ queryKey: ["case-sheet-scan", scan.id] });
  };

  const save = useMutation({
    mutationFn: () => caseSheetService.saveReview(scan.id, fields),
    onSuccess: () => {
      invalidate();
      toast.success("Draft saved", { title: "Case sheet" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Save failed" }),
  });

  const commit = useMutation({
    mutationFn: () => caseSheetService.commitScan(scan.id),
    onSuccess: () => {
      invalidate();
      toast.success("Filed to the patient record", { title: "Committed" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Commit failed" }),
  });

  const editable = canFile && scan.status !== "committed";
  const committable = canFile && (scan.status === "parsed" || scan.status === "reviewing");

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      <Card withBorder padding="sm">
        {image?.download_url ? (
          <Image src={image.download_url} alt="Scanned case sheet" fit="contain" mah={520} />
        ) : (
          <Text c="dimmed" size="sm">
            Loading scan…
          </Text>
        )}
      </Card>

      <Stack gap="sm">
        <Group justify="space-between">
          <Badge tone={statusTone(scan.status)}>{scan.status}</Badge>
          {scan.overall_confidence && (
            <Text size="xs" c="dimmed">
              Overall confidence {scan.overall_confidence}%
            </Text>
          )}
        </Group>

        {scan.parse_error && (
          <Text size="sm" c="red">
            Parse error: {scan.parse_error}
          </Text>
        )}

        {fields.length === 0 ? (
          <Text size="sm" c="dimmed">
            No extracted fields yet. The scan is awaiting the parsing worker.
          </Text>
        ) : (
          fields.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length draft, never reordered
            <Group key={`${f.field}-${i}`} gap="xs" align="flex-end" wrap="nowrap">
              <TextInput
                label={f.field}
                value={f.value}
                onChange={(e) =>
                  setFields((prev) =>
                    prev.map((p, j) => (j === i ? { ...p, value: e.currentTarget.value } : p)),
                  )
                }
                disabled={!editable}
                style={{ flex: 1 }}
              />
              <Badge tone={confidenceTone(f.confidence)} size="sm">
                {f.confidence === undefined ? "—" : `${Math.round(f.confidence * 100)}%`}
              </Badge>
            </Group>
          ))
        )}

        {canFile && (
          <Group justify="flex-end">
            <Button
              tone="secondary"
              onClick={() => save.mutate()}
              loading={save.isPending}
              disabled={!editable || fields.length === 0}
            >
              Save draft
            </Button>
            <Button
              onClick={() => commit.mutate()}
              loading={commit.isPending}
              disabled={!committable}
            >
              Commit to record
            </Button>
          </Group>
        )}
      </Stack>
    </SimpleGrid>
  );
}

export function CaseSheetReviewPage() {
  useRequirePermission(P.MRD.CASE_SHEETS_VIEW);
  const canFile = useHasPermission(P.MRD.CASE_SHEETS_FILE);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: scans = [] } = useQuery({
    queryKey: ["case-sheet-scans"],
    queryFn: () => caseSheetService.listScans(),
    refetchInterval: 20_000,
  });

  const { data: scan } = useQuery({
    queryKey: ["case-sheet-scan", selectedId],
    queryFn: () => caseSheetService.getScan(selectedId ?? ""),
    enabled: !!selectedId,
  });

  const columns: Column<CaseSheetScan>[] = [
    {
      key: "created_at",
      label: "Uploaded",
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge>,
    },
    {
      key: "overall_confidence",
      label: "Confidence",
      render: (r) => (r.overall_confidence ? `${r.overall_confidence}%` : "—"),
    },
    {
      key: "open",
      label: "",
      render: (r) => (
        <Button size="xs" tone="secondary" onClick={() => setSelectedId(r.id)}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Case sheet review"
        subtitle="Verify digitized handwritten case sheets before filing to the record"
        icon={<IconFileText size={20} />}
      />
      <DataTable
        columns={columns}
        data={scans}
        rowKey={(r) => r.id}
        emptyTitle="No scanned case sheets yet."
      />
      {scan && <ReviewPanel key={scan.id} scan={scan} canFile={canFile} />}
    </Stack>
  );
}
