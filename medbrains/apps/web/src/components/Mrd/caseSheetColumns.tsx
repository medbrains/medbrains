import { Group, Stack, Text, Tooltip } from "@mantine/core";
import type { MrdCaseSheetFileFormInput, MrdCaseSheetReprintFormInput } from "@medbrains/schemas";
import type { MrdCaseSheetPacket } from "@medbrains/types";
import { IconArrowRight, IconClipboardList, IconMapPin, IconPrinter } from "@tabler/icons-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import type { NavigateFunction } from "react-router";
import type { Column } from "@/components/DataTable";
import { Badge, IconButton } from "@/components/ui";
import {
  fmt,
  MRD_FILE_FORM_DEFAULTS,
  MRD_REPRINT_FORM_DEFAULTS,
  type MrdCaseSheetPrintPreview,
  STATUS_COLORS,
} from "./mrdShared";

interface BuildCaseSheetColumnsArgs {
  canPrint: boolean;
  canReprint: boolean;
  canFile: boolean;
  navigate: NavigateFunction;
  setSelectedPacket: (packet: MrdCaseSheetPacket) => void;
  openPages: () => void;
  openReprint: () => void;
  openFile: () => void;
  printMut: UseMutationResult<MrdCaseSheetPrintPreview, Error, MrdCaseSheetPacket>;
  fileForm: UseFormReturn<MrdCaseSheetFileFormInput>;
  reprintForm: UseFormReturn<MrdCaseSheetReprintFormInput>;
}

export function buildCaseSheetColumns({
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
}: BuildCaseSheetColumnsArgs): Column<MrdCaseSheetPacket>[] {
  return [
    {
      key: "packet_number",
      label: "Packet #",
      render: (packet) => <Text fw={600}>{packet.packet_number}</Text>,
    },
    {
      key: "patient",
      label: "Patient",
      render: (packet) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {packet.patient_name ?? "Patient"}
          </Text>
          <Text size="xs" c="dimmed">
            {packet.uhid ?? "No UHID"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "packet_type",
      label: "Type",
      render: (packet) => <Badge tone="neutral">{packet.packet_type.toUpperCase()}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (packet) => (
        <Badge tone={STATUS_COLORS[packet.status] ?? "neutral"}>{packet.status}</Badge>
      ),
    },
    {
      key: "pages",
      label: "Pages",
      render: (packet) => <Text>{packet.page_count}</Text>,
    },
    {
      key: "printed_at",
      label: "Printed",
      render: (packet) => <Text size="sm">{fmt(packet.printed_at)}</Text>,
    },
    {
      key: "shelf_location",
      label: "Shelf",
      render: (packet) => <Text size="sm">{packet.shelf_location ?? "—"}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (packet) => {
        const sourceRoute =
          packet.packet_type === "opd" && packet.encounter_id
            ? `/opd/encounters/${packet.encounter_id}#consultation`
            : packet.packet_type === "ipd" && packet.admission_id
              ? `/ipd/admissions/${packet.admission_id}#overview`
              : null;

        return (
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Pages">
              <IconButton
                tone="default"
                onClick={() => {
                  setSelectedPacket(packet);
                  openPages();
                }}
                aria-label="View page checklist"
              >
                <IconClipboardList size={16} />
              </IconButton>
            </Tooltip>
            {sourceRoute && (
              <Tooltip label={packet.packet_type === "opd" ? "Open OPD encounter" : "Open IPD"}>
                <IconButton
                  tone="default"
                  onClick={() => navigate(sourceRoute)}
                  aria-label="Open source workflow"
                >
                  <IconArrowRight size={16} />
                </IconButton>
              </Tooltip>
            )}
            {canPrint && (packet.status === "generated" || packet.status === "draft") && (
              <Tooltip label="Prepare MRD, office, and clinical copies">
                <IconButton
                  tone="primary"
                  onClick={() => printMut.mutate(packet)}
                  loading={printMut.isPending}
                  aria-label="Prepare MRD case-sheet copies"
                >
                  <IconPrinter size={16} />
                </IconButton>
              </Tooltip>
            )}
            {canReprint && packet.printed_at && (
              <Tooltip label="Reprint">
                <IconButton
                  tone="default"
                  onClick={() => {
                    setSelectedPacket(packet);
                    reprintForm.reset(MRD_REPRINT_FORM_DEFAULTS);
                    openReprint();
                  }}
                  aria-label="Reprint case sheet"
                >
                  <IconPrinter size={16} />
                </IconButton>
              </Tooltip>
            )}
            {canFile && packet.status === "printed" && (
              <Tooltip label="File in MRD">
                <IconButton
                  tone="success"
                  onClick={() => {
                    setSelectedPacket(packet);
                    fileForm.reset(MRD_FILE_FORM_DEFAULTS);
                    openFile();
                  }}
                  aria-label="File case sheet"
                >
                  <IconMapPin size={16} />
                </IconButton>
              </Tooltip>
            )}
          </Group>
        );
      },
    },
  ];
}
