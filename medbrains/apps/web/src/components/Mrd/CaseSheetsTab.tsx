import { zodResolver } from "@hookform/resolvers/zod";
import { Card, Group, Select, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { nullOn404 } from "@medbrains/api";
import {
  type MrdCaseSheetFileFormInput,
  type MrdCaseSheetReprintFormInput,
  mrdCaseSheetFileFormSchema,
  mrdCaseSheetReprintFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  MrdCaseSheetPacket,
  MrdCaseSheetPacketStatus,
  MrdCaseSheetPage,
  MrdCaseSheetPageStatus,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconClipboardList } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { DataTable, useClinicalEmit } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";
import { PRINT_COPY_PACKETS, printCopyRouteLabel } from "@/utils/printCopies";
import { CaseSheetDrawers } from "./CaseSheetDrawers";
import { buildCaseSheetColumns } from "./caseSheetColumns";
import {
  CASE_SHEET_STATUS_OPTIONS,
  MRD_FILE_FORM_DEFAULTS,
  MRD_REPRINT_FORM_DEFAULTS,
  type MrdCaseSheetPrintPreview,
  toCaseSheetStatus,
} from "./mrdShared";

const MRD_CASE_SHEET_PRINT_COPIES = PRINT_COPY_PACKETS.mrdCaseSheet;
const MRD_CASE_SHEET_REPRINT_COPIES = PRINT_COPY_PACKETS.mrdCaseSheetReprint;

export function CaseSheetsTab() {
  const emit = useClinicalEmit();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const printPreviewRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const canPrint = useHasPermission(P.MRD.CASE_SHEETS_PRINT);
  const canReprint = useHasPermission(P.MRD.CASE_SHEETS_REPRINT);
  const canFile = useHasPermission(P.MRD.CASE_SHEETS_FILE);
  const encounterFilter = searchParams.get("encounter_id");
  const admissionFilter = searchParams.get("admission_id");
  const patientFilter = searchParams.get("patient_id")?.trim() || null;
  const urlPacketType = searchParams.get("packet_type");
  const sourcePacketType =
    urlPacketType === "opd" || urlPacketType === "ipd"
      ? urlPacketType
      : encounterFilter
        ? "opd"
        : admissionFilter
          ? "ipd"
          : undefined;
  const sourceFilterLabel = encounterFilter
    ? "Filtered to OPD encounter packet"
    : admissionFilter
      ? "Filtered to IPD admission packet"
      : patientFilter
        ? "Filtered to patient case sheets"
        : null;
  const [statusFilter, setStatusFilter] = useState<MrdCaseSheetPacketStatus | null>(() =>
    toCaseSheetStatus(searchParams.get("status")),
  );
  const [typeFilter, setTypeFilter] = useState<string | null>(() => sourcePacketType ?? null);
  const [selectedPacket, setSelectedPacket] = useState<MrdCaseSheetPacket | null>(null);
  const [pagesOpen, { open: openPages, close: closePages }] = useDisclosure();
  const [fileOpen, { open: openFile, close: closeFile }] = useDisclosure();
  const [reprintOpen, { open: openReprint, close: closeReprint }] = useDisclosure();
  const [printPreviewOpen, { open: openPrintPreview, close: closePrintPreview }] = useDisclosure();
  const [printPreview, setPrintPreview] = useState<MrdCaseSheetPrintPreview | null>(null);
  const fileForm = useForm<MrdCaseSheetFileFormInput>({
    resolver: zodResolver(mrdCaseSheetFileFormSchema),
    defaultValues: MRD_FILE_FORM_DEFAULTS,
  });
  const reprintForm = useForm<MrdCaseSheetReprintFormInput>({
    resolver: zodResolver(mrdCaseSheetReprintFormSchema),
    defaultValues: MRD_REPRINT_FORM_DEFAULTS,
  });

  const { data: packets = [], isLoading } = useQuery({
    queryKey: [
      "mrd-case-sheets",
      statusFilter,
      typeFilter,
      patientFilter,
      encounterFilter,
      admissionFilter,
    ],
    queryFn: () =>
      mrdService.listMrdCaseSheetPackets({
        status: statusFilter ?? undefined,
        packet_type: typeFilter === "opd" || typeFilter === "ipd" ? typeFilter : sourcePacketType,
        patient_id: patientFilter ?? undefined,
        encounter_id: encounterFilter ?? undefined,
        admission_id: admissionFilter ?? undefined,
      }),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["mrd-storage-locations"],
    queryFn: () => mrdService.listMrdStorageLocations(),
  });

  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ["mrd-case-sheet-pages", selectedPacket?.id],
    queryFn: () => mrdService.listMrdCaseSheetPages(selectedPacket?.id ?? ""),
    enabled: pagesOpen && !!selectedPacket,
  });

  const { data: completeness, isLoading: completenessLoading } = useQuery({
    queryKey: ["mrd-case-sheet-completeness", selectedPacket?.id],
    queryFn: () => mrdService.getMrdCaseSheetCompleteness(selectedPacket?.id ?? ""),
    enabled: pagesOpen && !!selectedPacket,
  });

  const [deficientPage, setDeficientPage] = useState<MrdCaseSheetPage | null>(null);
  const [deficiencyReason, setDeficiencyReason] = useState("");
  const pageStatusMutation = useMutation({
    mutationFn: ({
      pageId,
      status,
      reason,
    }: {
      pageId: string;
      status: MrdCaseSheetPageStatus;
      reason?: string;
    }) =>
      mrdService.updateMrdCaseSheetPageStatus(selectedPacket?.id ?? "", pageId, {
        status,
        deficiency_reason: reason,
      }),
    onSuccess: () => {
      setDeficientPage(null);
      setDeficiencyReason("");
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheet-pages", selectedPacket?.id] });
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheet-completeness", selectedPacket?.id] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not update page" }),
  });

  const printMut = useMutation({
    mutationFn: async (packet: MrdCaseSheetPacket): Promise<MrdCaseSheetPrintPreview> => {
      const printedPacket = await mrdService.printMrdCaseSheetPacket(packet.id, {
        copies: MRD_CASE_SHEET_PRINT_COPIES.length,
      });
      const [packetPages, packetCompleteness] = await Promise.all([
        mrdService.listMrdCaseSheetPages(printedPacket.id),
        mrdService.getMrdCaseSheetCompleteness(printedPacket.id).catch(nullOn404),
      ]);
      return {
        action: "print",
        completeness: packetCompleteness,
        copies: MRD_CASE_SHEET_PRINT_COPIES,
        packet: printedPacket,
        pages: packetPages,
      };
    },
    onSuccess: (preview) => {
      emit("mrd.case_sheet.printed", {
        admission_id: preview.packet.admission_id,
        copies: preview.copies.length,
        document_output_id: preview.packet.document_output_id,
        encounter_id: preview.packet.encounter_id,
        is_reprint: false,
        packet_id: preview.packet.id,
        packet_number: preview.packet.packet_number,
        packet_type: preview.packet.packet_type,
        patient_id: preview.packet.patient_id,
        print_job_id: preview.packet.print_job_id,
        printed_at: preview.packet.printed_at,
        source_record_id: preview.packet.id,
        status: preview.packet.status,
      });
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheets"] });
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheet-pages", preview.packet.id] });
      void qc.invalidateQueries({
        queryKey: ["mrd-case-sheet-completeness", preview.packet.id],
      });
      setPrintPreview(preview);
      openPrintPreview();
      notifications.show({
        title: "Case sheet print prepared",
        message: `${preview.packet.packet_number} is ready with MRD, office, and clinical copies`,
        color: "success",
      });
    },
  });

  const reprintMut = useMutation({
    mutationFn: async (values: MrdCaseSheetReprintFormInput): Promise<MrdCaseSheetPrintPreview> => {
      if (!selectedPacket) {
        throw new Error("Select a case-sheet packet before reprinting");
      }
      const reprintReason = values.reprint_reason.trim();
      const printedPacket = await mrdService.printMrdCaseSheetPacket(selectedPacket.id, {
        copies: MRD_CASE_SHEET_REPRINT_COPIES.length,
        reprint_reason: reprintReason,
      });
      const [packetPages, packetCompleteness] = await Promise.all([
        mrdService.listMrdCaseSheetPages(printedPacket.id),
        mrdService.getMrdCaseSheetCompleteness(printedPacket.id).catch(nullOn404),
      ]);
      return {
        action: "reprint",
        completeness: packetCompleteness,
        copies: MRD_CASE_SHEET_REPRINT_COPIES,
        packet: printedPacket,
        pages: packetPages,
        reprintReason,
      };
    },
    onSuccess: (preview) => {
      emit("mrd.case_sheet.printed", {
        admission_id: preview.packet.admission_id,
        copies: preview.copies.length,
        document_output_id: preview.packet.document_output_id,
        encounter_id: preview.packet.encounter_id,
        is_reprint: true,
        packet_id: preview.packet.id,
        packet_number: preview.packet.packet_number,
        packet_type: preview.packet.packet_type,
        patient_id: preview.packet.patient_id,
        print_job_id: preview.packet.print_job_id,
        printed_at: preview.packet.printed_at,
        source_record_id: preview.packet.id,
        status: preview.packet.status,
      });
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheets"] });
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheet-pages", preview.packet.id] });
      void qc.invalidateQueries({
        queryKey: ["mrd-case-sheet-completeness", preview.packet.id],
      });
      closeReprint();
      reprintForm.reset(MRD_REPRINT_FORM_DEFAULTS);
      setPrintPreview(preview);
      openPrintPreview();
      notifications.show({
        title: "Duplicate print prepared",
        message: `${preview.packet.packet_number} duplicate is ready for MRD record room`,
        color: "success",
      });
    },
  });

  const fileMut = useMutation({
    mutationFn: (values: MrdCaseSheetFileFormInput) => {
      if (!selectedPacket) {
        throw new Error("Select a case-sheet packet before filing");
      }
      return mrdService.fileMrdCaseSheetPacket(selectedPacket.id, {
        storage_location_id: values.storage_location_id,
        notes: values.notes?.trim() || undefined,
      });
    },
    onSuccess: (packet) => {
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheets"] });
      void qc.invalidateQueries({ queryKey: ["mrd-case-sheet-completeness", packet.id] });
      void qc.invalidateQueries({ queryKey: ["mrd-storage-locations"] });
      void qc.invalidateQueries({ queryKey: ["mrd-records"] });
      closeFile();
      fileForm.reset(MRD_FILE_FORM_DEFAULTS);
      notifications.show({
        title: "Case sheet filed",
        message: `${packet.packet_number} filed at ${packet.shelf_location ?? "MRD storage"}`,
        color: "success",
      });
    },
  });

  const locationOptions = locations
    .filter((location) => location.is_active)
    .map((location) => ({
      value: location.id,
      label: `${location.code} · ${location.name}`,
    }));

  const columns = buildCaseSheetColumns({
    canPrint,
    canReprint,
    canFile,
    navigate,
    setSelectedPacket,
    openPages,
    openReprint,
    openFile,
    printMut,
    fileForm,
    reprintForm,
  });

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group>
          <Select
            data={CASE_SHEET_STATUS_OPTIONS}
            value={statusFilter ?? ""}
            onChange={(value) => setStatusFilter(toCaseSheetStatus(value))}
            w={220}
          />
          <Select
            data={[
              { value: "", label: "All workflows" },
              { value: "opd", label: "OPD" },
              { value: "ipd", label: "IPD" },
            ]}
            value={typeFilter ?? ""}
            onChange={(value) => setTypeFilter(value || null)}
            w={180}
          />
          {sourceFilterLabel && (
            <Group gap={6}>
              <Badge tone="primary">{sourceFilterLabel}</Badge>
              <Button
                tone="ghost"
                size="compact-xs"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete("encounter_id");
                  next.delete("admission_id");
                  next.delete("patient_id");
                  next.delete("packet_type");
                  setTypeFilter(null);
                  setSearchParams(next, { replace: true });
                }}
              >
                Show all
              </Button>
            </Group>
          )}
        </Group>
        <Text size="sm" c="dimmed">
          MRD filing follows fixed case-sheet assembly, print control, and storage tracking.
        </Text>
      </Group>
      <Card withBorder radius="sm" mb="md">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Text size="sm" fw={600}>
              Case-sheet print routing
            </Text>
            <Text size="xs" c="dimmed">
              Initial packets create MRD and office tracking copies. Reprints are duplicate-only and
              require an audit reason.
            </Text>
          </Stack>
          <Group gap={6}>
            {MRD_CASE_SHEET_PRINT_COPIES.map((copy) => (
              <Badge key={copy.label} tone="accent">
                {printCopyRouteLabel(copy)}
              </Badge>
            ))}
          </Group>
        </Group>
      </Card>

      <DataTable
        columns={columns}
        data={packets}
        loading={isLoading}
        rowKey={(packet) => packet.id}
        emptyIcon={<IconClipboardList size={32} />}
        emptyTitle="No case-sheet packets"
        emptyDescription="Generate an OPD or IPD case sheet from the encounter/admission action panel."
      />

      <CaseSheetDrawers
        selectedPacket={selectedPacket}
        canFile={canFile}
        reprintCopies={MRD_CASE_SHEET_REPRINT_COPIES}
        pagesOpen={pagesOpen}
        closePages={closePages}
        pages={pages}
        pagesLoading={pagesLoading}
        completeness={completeness}
        completenessLoading={completenessLoading}
        deficientPage={deficientPage}
        setDeficientPage={setDeficientPage}
        deficiencyReason={deficiencyReason}
        setDeficiencyReason={setDeficiencyReason}
        pageStatusMutation={pageStatusMutation}
        fileOpen={fileOpen}
        closeFile={closeFile}
        fileForm={fileForm}
        fileMut={fileMut}
        locationOptions={locationOptions}
        reprintOpen={reprintOpen}
        closeReprint={closeReprint}
        reprintForm={reprintForm}
        reprintMut={reprintMut}
        printPreviewOpen={printPreviewOpen}
        closePrintPreview={closePrintPreview}
        printPreview={printPreview}
        printPreviewRef={printPreviewRef}
      />
    </>
  );
}
