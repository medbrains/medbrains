// Clinical-kb NikshayTab — TB cases the hospital owes Ni-kshay: their
// notification details, the sheet in the MoHFW hospital format, and the
// Ni-kshay ID once notified.

import { Group, Stack, Text } from "@mantine/core";
import type { NikshaySheet, TbCase } from "@medbrains/types";
import { IconFileSpreadsheet, IconPrinter } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { exportName, printableReport, toCsv } from "@/components/Reports/report-export";
import { Alert, Badge, Button, toast } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";
import { downloadBlob } from "@/utils/download";
import { FacilityCodeField } from "./facility-code-field";
import { ResolveReportModal } from "./resolve-report-modal";
import { TbDetailsModal } from "./tb-details-modal";

interface NikshayTabProps {
  canList: boolean;
  canManage: boolean;
  canExport: boolean;
}

/** The form's fields a case still lacks, before the sheet is made. */
export function tbGaps(c: TbCase): string[] {
  const gaps: [unknown, string][] = [
    [c.site, "site"],
    [c.patient_type, "patient type"],
    [c.basis, "basis"],
    [c.treatment_started_on, "treatment start"],
    [c.weight_kg, "weight"],
  ];
  return gaps.filter(([v]) => v === null || v === undefined).map(([, name]) => name);
}

const isOverdue = (c: TbCase) =>
  c.status === "pending" && !!c.due_at && new Date(c.due_at).getTime() < Date.now();

function sheetRows(sheet: NikshaySheet): Record<string, string>[] {
  return sheet.rows.map((cells) =>
    Object.fromEntries(sheet.columns.map((col, i) => [col, cells[i] ?? ""])),
  );
}

function sheetTitle(sheet: NikshaySheet): string {
  const f = sheet.facility;
  const code = f.nikshay_he_code ? ` · HE code ${f.nikshay_he_code}` : "";
  return `TB notification — ${f.name}${code}`;
}

export function NikshayTab({ canList, canManage, canExport }: NikshayTabProps) {
  const [status, setStatus] = useState("pending");
  const [editing, setEditing] = useState<TbCase | null>(null);
  const [notifying, setNotifying] = useState<TbCase | null>(null);
  const [lastSheet, setLastSheet] = useState<NikshaySheet | null>(null);
  const cases = useQuery({
    queryKey: ["ckb-nikshay", status],
    queryFn: () => ckbService.listTbCases(status || undefined),
    enabled: canList,
  });
  // Made on demand, never prefetched: each sheet is a recorded disclosure.
  const sheet = useMutation({
    mutationFn: () => ckbService.getNikshaySheet(),
    onError: (e: Error) => toast.error(e.message, { title: "Sheet not made" }),
  });
  const makeSheet = (deliver: (s: NikshaySheet) => void) =>
    sheet.mutate(undefined, {
      onSuccess: (s) => {
        setLastSheet(s);
        if (s.rows.length === 0) {
          toast.info("No TB case is waiting to be notified.");
          return;
        }
        deliver(s);
      },
    });
  const downloadCsv = () =>
    makeSheet((s) =>
      downloadBlob(
        new Blob(["﻿", toCsv(sheetRows(s))], { type: "text/csv;charset=utf-8" }),
        exportName("nikshay-tb-notification", "csv"),
      ),
    );
  const printSheet = () =>
    makeSheet((s) => {
      const page = window.open("", "_blank");
      if (!page) {
        toast.error("Allow pop-ups for this site to print the sheet.");
        return;
      }
      page.document.write(printableReport(sheetTitle(s), sheetRows(s), null));
      page.document.close();
      page.print();
    });

  return (
    <Stack>
      <Alert tone="warning" title="TB notification is mandatory">
        Every TB patient diagnosed or treated here must be notified to Ni-kshay. Since the March
        2018 gazette notification, failing to notify can be punished under IPC sections 269 and 270
        (up to two years). The Ni-kshay ID you get back is recorded against the case.
      </Alert>
      {canList && <FacilityCodeField canManage={canManage} />}
      <Group justify="space-between">
        <Group gap="xs">
          {["pending", "submitted", ""].map((s) => (
            <Button
              key={s || "all"}
              size="xs"
              tone={status === s ? "primary" : "ghost"}
              onClick={() => setStatus(s)}
            >
              {s === "pending" ? "To notify" : s === "submitted" ? "Notified" : "All"}
            </Button>
          ))}
        </Group>
        {canExport && (
          <Group gap="xs">
            <Button
              size="xs"
              tone="secondary"
              leftSection={<IconFileSpreadsheet size={16} />}
              loading={sheet.isPending}
              onClick={downloadCsv}
            >
              Download sheet (CSV)
            </Button>
            <Button
              size="xs"
              tone="secondary"
              leftSection={<IconPrinter size={16} />}
              loading={sheet.isPending}
              onClick={printSheet}
            >
              Print sheet
            </Button>
          </Group>
        )}
      </Group>
      {lastSheet && lastSheet.missing.length > 0 && (
        <Alert tone="info" title="Fill these before submitting">
          {lastSheet.missing
            .map((m) => `${m.patient_name ?? "Patient"}: ${m.fields.join(", ")}`)
            .join(" · ")}
        </Alert>
      )}
      {cases.isError && (
        <Alert tone="danger" title="TB cases could not be read">
          {cases.error.message}
        </Alert>
      )}
      <DataTable
        columns={[
          {
            key: "patient",
            label: "Patient",
            render: (c: TbCase) => (
              <Stack gap={0}>
                <Text size="sm" fw={600}>
                  {c.patient_name ?? "—"}
                </Text>
                <Text size="xs" c="dimmed" ff="var(--mb-font-mono)">
                  {c.uhid ?? ""}
                </Text>
              </Stack>
            ),
          },
          {
            key: "disease",
            label: "Diagnosis",
            render: (c: TbCase) => (
              <Stack gap={0}>
                <Text size="sm">
                  {c.disease_name}{" "}
                  <Text span size="xs" c="dimmed" ff="var(--mb-font-mono)">
                    {c.icd10_code}
                  </Text>
                </Text>
                <Text size="xs" c="dimmed">
                  {c.case_class === "confirmed"
                    ? "Microbiologically confirmed"
                    : "Clinically diagnosed"}
                </Text>
              </Stack>
            ),
          },
          {
            key: "due_at",
            label: "Due",
            render: (c: TbCase) => (
              <Group gap={4} wrap="nowrap">
                <Text size="sm">{c.due_at ? new Date(c.due_at).toLocaleString() : "—"}</Text>
                {isOverdue(c) && <Badge tone="danger">Overdue</Badge>}
              </Group>
            ),
          },
          {
            key: "details",
            label: "Form",
            render: (c: TbCase) => {
              const gaps = tbGaps(c);
              return gaps.length === 0 ? (
                <Text size="sm">Complete</Text>
              ) : (
                <Text size="sm" c="dimmed">
                  Needs {gaps.join(", ")}
                </Text>
              );
            },
          },
          {
            key: "nikshay_id",
            label: "Ni-kshay ID",
            render: (c: TbCase) => (
              <Text size="sm" ff="var(--mb-font-mono)">
                {c.nikshay_id ?? "—"}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (c: TbCase) =>
              canManage && c.status === "pending" ? (
                <Group gap={4} wrap="nowrap">
                  <Button size="xs" tone="ghost" onClick={() => setEditing(c)}>
                    TB details
                  </Button>
                  <Button size="xs" tone="primary" onClick={() => setNotifying(c)}>
                    Record Ni-kshay ID
                  </Button>
                </Group>
              ) : null,
          },
        ]}
        data={cases.data ?? []}
        loading={cases.isLoading}
        rowKey={(c: TbCase) => c.report_id}
      />
      {editing && <TbDetailsModal tbCase={editing} onClose={() => setEditing(null)} />}
      <ResolveReportModal
        report={
          notifying
            ? {
                id: notifying.report_id,
                disease_name: notifying.disease_name,
                icd10_code: notifying.icd10_code,
              }
            : null
        }
        refLabel="Ni-kshay ID"
        refPlaceholder="e.g. 10458921"
        requireRef
        onClose={() => setNotifying(null)}
      />
    </Stack>
  );
}
