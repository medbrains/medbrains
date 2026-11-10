/**
 * The registry clerk's worklist for the NCDIR hospital-based cancer registry:
 * every staged cancer, whether its abstract is due, in draft, complete or
 * submitted; the abstract itself; and the sheet of complete cases for NCDIR.
 */
import { Group, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type RegistryStatus, type RegistryWorklistRow } from "@medbrains/types";
import { IconDownload } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, SegmentedControl, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { specialtyService } from "@/services/specialty.service";
import { downloadBlob } from "@/utils/download";
import { AbstractModal } from "./AbstractModal";
import { type Filter, matchesFilter } from "./registry-form";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Not submitted" },
  { value: "due", label: "Due" },
  { value: "draft", label: "Draft" },
  { value: "complete", label: "Complete" },
  { value: "submitted", label: "Submitted" },
  { value: "all", label: "All" },
];

const STATUS: Record<RegistryStatus, { tone: BadgeTone; label: string }> = {
  due: { tone: "warning", label: "Due" },
  draft: { tone: "info", label: "Draft" },
  complete: { tone: "success", label: "Complete" },
  submitted: { tone: "neutral", label: "Submitted" },
};

export function CancerRegistryPage() {
  useRequirePermission(P.SPECIALTY.OTHER.ONCOLOGY_REGISTRY_LIST);
  const canExport = useHasPermission(P.SPECIALTY.OTHER.ONCOLOGY_REGISTRY_EXPORT);
  const [filter, setFilter] = useState<Filter>("open");
  const [open, setOpen] = useState<string | null>(null);
  const worklist = useQuery({
    queryKey: ["cancer-registry"],
    queryFn: () => specialtyService.listCancerRegistry(),
  });
  const rows = useMemo(
    () => (worklist.data ?? []).filter((r) => matchesFilter(r, filter)),
    [worklist.data, filter],
  );
  const exportSheet = useMutation({
    mutationFn: () => specialtyService.exportRegistrySheet(),
    onSuccess: (sheet) => {
      if (sheet.count === 0) {
        toast.info("No complete case is waiting for NCDIR");
        return;
      }
      downloadBlob(new Blob([sheet.content], { type: "text/csv" }), sheet.filename);
      toast.success(`${sheet.count} case${sheet.count === 1 ? "" : "s"} exported`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<RegistryWorklistRow>[] = [
    {
      key: "patient_name",
      label: "Patient",
      render: (r) => (
        <Text size="sm">
          {r.patient_name} · {r.uhid}
        </Text>
      ),
    },
    {
      key: "primary_site",
      label: "Site",
      render: (r) => (
        <Text size="sm">
          {r.primary_site}
          {r.histology ? ` · ${r.histology}` : ""}
        </Text>
      ),
    },
    {
      key: "staged_at",
      label: "Staged",
      render: (r) => (
        <Text size="sm">{r.staged_at ? new Date(r.staged_at).toLocaleDateString() : "—"}</Text>
      ),
    },
    {
      key: "status",
      label: "Abstract",
      render: (r) => <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>,
    },
    {
      key: "ncdir_reference",
      label: "NCDIR registration",
      render: (r) => <Text size="sm">{r.ncdir_reference ?? "—"}</Text>,
    },
    {
      key: "open",
      label: "",
      render: (r) => (
        <Button
          tone="ghost"
          size="xs"
          onClick={() => setOpen(r.staging_id)}
          aria-label={`Open abstract for ${r.patient_name}`}
        >
          Abstract
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Cancer registry"
        subtitle="NCDIR hospital-based cancer registry: abstracts due, complete and submitted"
        actions={
          canExport ? (
            <Button
              tone="primary"
              leftSection={<IconDownload size={16} />}
              loading={exportSheet.isPending}
              onClick={() => exportSheet.mutate()}
            >
              Export for NCDIR
            </Button>
          ) : undefined
        }
      />
      <Group my="md">
        <SegmentedControl
          aria-label="Show abstracts"
          data={FILTERS}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />
      </Group>
      <DataTable
        columns={columns}
        data={rows}
        loading={worklist.isLoading}
        error={worklist.error}
        onRetry={() => worklist.refetch()}
        rowKey={(r) => r.staging_id}
        emptyTitle="No cases here"
        emptyDescription="Every cancer staged in oncology appears here for the registry."
      />
      <AbstractModal stagingId={open} onClose={() => setOpen(null)} />
    </>
  );
}
