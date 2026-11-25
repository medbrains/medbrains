// The device (materiovigilance) reports list of the ADR tab, with its own
// fetch, so it is read only by those the server serves it to.

import { Text } from "@mantine/core";
import type { MateriovigilanceReport } from "@medbrains/types";
import { IconSend } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { printColumn } from "@/components/Print/printColumn";
import { Badge, type BadgeTone, IconButton, toast } from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";

export const severityColors: Record<string, BadgeTone> = {
  mild: "primary",
  moderate: "warning",
  severe: "warning",
  fatal: "danger",
};

export const eventStatusColors: Record<string, BadgeTone> = {
  draft: "neutral",
  submitted: "primary",
  under_review: "warning",
  closed: "success",
  withdrawn: "neutral",
};

/** The CDSCO cell: submitted, a Send button for a draft the user may send, else a dash. */
function cdscoCell(r: MateriovigilanceReport, canSend: boolean, onSend: (id: string) => void) {
  if (r.submitted_to_cdsco) {
    return (
      <Badge tone="success" size="sm">
        Submitted
      </Badge>
    );
  }
  if (r.status === "draft" && canSend) {
    return (
      <IconButton tone="primary" onClick={() => onSend(r.id)} aria-label="Send">
        <IconSend size={14} />
      </IconButton>
    );
  }
  return (
    <Text size="sm" c="dimmed">
      -
    </Text>
  );
}

/** The device-report columns; Send appears only for those who may send a draft. */
function mvColumns(canSend: boolean, onSend: (id: string) => void) {
  return [
    {
      key: "report_number",
      label: "Report #",
      render: (r: MateriovigilanceReport) => (
        <Text size="sm" fw={500}>
          {r.report_number}
        </Text>
      ),
    },
    {
      key: "device_name",
      label: "Device",
      render: (r: MateriovigilanceReport) => <Text size="sm">{r.device_name}</Text>,
    },
    {
      key: "event_description",
      label: "Event",
      render: (r: MateriovigilanceReport) => (
        <Text size="sm" lineClamp={1}>
          {r.event_description}
        </Text>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      render: (r: MateriovigilanceReport) => (
        <Badge tone={severityColors[r.severity]}>{r.severity}</Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: MateriovigilanceReport) => (
        <Badge tone={eventStatusColors[r.status]}>{r.status.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "cdsco",
      label: "CDSCO",
      render: (r: MateriovigilanceReport) => cdscoCell(r, canSend, onSend),
    },
    {
      key: "date",
      label: "Date",
      render: (r: MateriovigilanceReport) => <Text size="sm">{r.event_date}</Text>,
    },
    printColumn<MateriovigilanceReport>("materiovigilance", { label: (r) => r.report_number }),
  ];
}

interface MvReportsSectionProps {
  statusFilter: string | null;
  canCreateMv: boolean;
}

/** Device adverse-event reports, filtered like the ADR list, with Send to CDSCO for drafts. */
export function MvReportsSection({ statusFilter, canCreateMv }: MvReportsSectionProps) {
  const qc = useQueryClient();
  const {
    data: mvReports,
    isLoading: mvLoading,
    error: mvError,
    refetch: refetchMv,
  } = useQuery<MateriovigilanceReport[]>({
    queryKey: ["regulatory-mv", statusFilter],
    queryFn: () =>
      regulatoryService.listMvReports(statusFilter ? { status: statusFilter } : undefined),
  });

  const submitMvMut = useMutation({
    mutationFn: (id: string) => regulatoryService.submitMvToCdsco(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-mv"] });
      toast.info("", { title: "Submitted to CDSCO" });
    },
  });

  return (
    <>
      <Text fw={600} mt="md">
        Materiovigilance Reports (Medical Devices)
      </Text>
      <DataTable
        data={mvReports ?? []}
        rowKey={(r) => r.id}
        loading={mvLoading}
        error={mvError}
        onRetry={() => void refetchMv()}
        columns={mvColumns(canCreateMv, (id) => submitMvMut.mutate(id))}
      />
    </>
  );
}
