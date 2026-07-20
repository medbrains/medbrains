// IPD PrintRoutingTab — split from documents.tsx (pure move).

import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { logicalPrinterProfileValues, printCopyModeValues } from "@medbrains/schemas";
import type { DocumentPrintFormat } from "@medbrains/types";
import { IconRoute } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DataTable } from "@/components";
import { Badge, type BadgeTone } from "@/components/ui";
import { documentsService } from "@/services/documents.service";
import {
  capabilityString,
  LOGICAL_PRINTER_PROFILES,
  optionLabel,
  PRINT_COPY_MODES,
  PRINT_FORMATS,
} from "./shared";

type PrintCopyMode = (typeof printCopyModeValues)[number];
type LogicalPrinterProfile = (typeof logicalPrinterProfileValues)[number];

interface PrintRoutingRequirement {
  id: string;
  module: string;
  workflow: string;
  artifact: string;
  requiredCopies: readonly PrintCopyMode[];
  printerProfiles: readonly LogicalPrinterProfile[];
  format: DocumentPrintFormat;
  trigger: string;
  standardRefs: readonly string[];
}

const PRINT_ROUTING_REQUIREMENTS: readonly PrintRoutingRequirement[] = [
  {
    id: "registration-sheet",
    module: "Registration",
    workflow: "Patient registration",
    artifact: "Registration sheet",
    requiredCopies: ["customer", "office"],
    printerProfiles: ["registration-a4"],
    format: "a4_portrait",
    trigger: "patient.created",
    standardRefs: ["NABH PRE patient identification", "DPDP Act purpose limitation"],
  },
  {
    id: "patient-card",
    module: "Registration",
    workflow: "Patient card",
    artifact: "Patient card",
    requiredCopies: ["customer", "office"],
    printerProfiles: ["patient-card", "registration-a4"],
    format: "label_50x25mm",
    trigger: "patient.card_printed",
    standardRefs: ["NABH PRE two identifiers"],
  },
  {
    id: "opd-token",
    module: "OPD",
    workflow: "Queue token",
    artifact: "OPD token slip",
    requiredCopies: ["customer", "office"],
    printerProfiles: ["opd-token-thermal", "opd-a4"],
    format: "thermal_80mm",
    trigger: "opd.queue.checked_in",
    standardRefs: ["NABH AAC access and continuity"],
  },
  {
    id: "opd-summary",
    module: "OPD",
    workflow: "Visit closure",
    artifact: "OPD visit summary",
    requiredCopies: ["customer", "office", "clinical", "mrd"],
    printerProfiles: ["opd-summary", "opd-a4", "mrd-record-room"],
    format: "a4_portrait",
    trigger: "opd.visit.completed",
    standardRefs: ["NABH COP continuity of care", "MRD retention control"],
  },
  {
    id: "prescription",
    module: "Pharmacy",
    workflow: "Prescription dispensing",
    artifact: "Prescription / medication labels",
    requiredCopies: ["customer", "office", "pharmacy"],
    printerProfiles: ["opd-a4", "pharmacy-drug-label"],
    format: "a4_portrait",
    trigger: "prescription.signed",
    standardRefs: ["NABH MOM medication safety", "Drugs and Cosmetics Act schedule controls"],
  },
  {
    id: "billing-receipt",
    module: "Billing",
    workflow: "Receipt and invoice",
    artifact: "Receipt / GST invoice",
    requiredCopies: ["customer", "office"],
    printerProfiles: ["billing-receipt-80mm", "billing-a4"],
    format: "thermal_80mm",
    trigger: "payment.captured",
    standardRefs: ["GST invoice retention", "Consumer Protection Act patient rights"],
  },
  {
    id: "ipd-admission",
    module: "IPD",
    workflow: "Admission packet",
    artifact: "Admission case sheet / consent pack",
    requiredCopies: ["customer", "office", "clinical", "mrd"],
    printerProfiles: ["ipd-a4", "consent-a4", "mrd-record-room"],
    format: "a4_portrait",
    trigger: "ipd.admission.created",
    standardRefs: ["NABH AAC admission documentation", "IPSG patient identification"],
  },
  {
    id: "wristband",
    module: "IPD",
    workflow: "Bed assignment",
    artifact: "Patient wristband",
    requiredCopies: ["clinical"],
    printerProfiles: ["wristband-label"],
    format: "wristband",
    trigger: "bed.assigned",
    standardRefs: ["IPSG 1 correct patient identification"],
  },
  {
    id: "emergency-mlc",
    module: "Emergency",
    workflow: "MLC documentation",
    artifact: "MLC register / police intimation",
    requiredCopies: ["office", "clinical", "police", "mrd", "duplicate"],
    printerProfiles: ["mlc-secure-printer", "emergency-a4"],
    format: "a4_portrait",
    trigger: "emergency.mlc.registered",
    standardRefs: ["CrPC/IPC medico-legal reporting", "NABH emergency records"],
  },
  {
    id: "camp-token",
    module: "Camp",
    workflow: "Camp registration",
    artifact: "Camp token and encounter sheet",
    requiredCopies: ["customer", "office"],
    printerProfiles: ["camp-token-thermal", "camp-a4"],
    format: "thermal_80mm",
    trigger: "camp.patient.checked_in",
    standardRefs: ["NABH PRE patient identification"],
  },
  {
    id: "lab-report",
    module: "Lab",
    workflow: "Verified result release",
    artifact: "Lab report",
    requiredCopies: ["customer", "lab", "office"],
    printerProfiles: ["lab-report-a4"],
    format: "a4_portrait",
    trigger: "lab.result.verified",
    standardRefs: ["NABL report traceability", "LOINC-coded result readiness"],
  },
  {
    id: "radiology-report",
    module: "Radiology",
    workflow: "Report sign-off",
    artifact: "Radiology report",
    requiredCopies: ["customer", "office", "clinical"],
    printerProfiles: ["radiology-report-a4"],
    format: "a4_portrait",
    trigger: "radiology.report.signed",
    standardRefs: ["DICOM study traceability", "NABH diagnostic report release"],
  },
  {
    id: "mrd-case-sheet",
    module: "MRD",
    workflow: "Case-sheet packet",
    artifact: "OPD/IPD case-sheet packet",
    requiredCopies: ["mrd", "office", "clinical", "duplicate"],
    printerProfiles: ["mrd-a4", "mrd-record-room"],
    format: "a4_portrait",
    trigger: "mrd.packet.generated",
    standardRefs: ["MRD retention and reprint audit", "NABH IMS"],
  },
];

function readinessTone(color: string): BadgeTone {
  if (color === "success") return "success";
  if (color === "danger") return "danger";
  if (color === "orange") return "warning";
  return "neutral";
}

function routingReadiness(
  route: PrintRoutingRequirement,
  activeProfiles: ReadonlySet<string>,
  activeCopyModes: ReadonlySet<string>,
) {
  const missingProfiles = route.printerProfiles.filter((profile) => !activeProfiles.has(profile));
  const missingCopies = route.requiredCopies.filter((copy) => !activeCopyModes.has(copy));

  if (missingProfiles.length === 0 && missingCopies.length === 0) {
    return { color: "success", label: "Ready", missingCopies, missingProfiles };
  }

  if (missingProfiles.length > 0 && missingCopies.length > 0) {
    return { color: "danger", label: "Profile + copy gap", missingCopies, missingProfiles };
  }

  if (missingProfiles.length > 0) {
    return { color: "orange", label: "Printer profile gap", missingCopies, missingProfiles };
  }

  return { color: "orange", label: "Copy mode gap", missingCopies, missingProfiles };
}

export function PrintRoutingTab() {
  const { data: printers = [], isLoading } = useQuery({
    queryKey: ["printers"],
    queryFn: () => documentsService.listPrinters(),
  });

  const activeProfiles = useMemo(
    () =>
      new Set(
        printers
          .filter((printer) => printer.is_active)
          .flatMap((printer) => capabilityString(printer.capabilities, "profile_code")),
      ),
    [printers],
  );
  const activeCopyModes = useMemo(
    () =>
      new Set(
        printers
          .filter((printer) => printer.is_active)
          .flatMap((printer) => capabilityString(printer.capabilities, "copy_modes")),
      ),
    [printers],
  );
  const readyCount = PRINT_ROUTING_REQUIREMENTS.filter(
    (route) =>
      routingReadiness(route, activeProfiles, activeCopyModes).missingProfiles.length === 0 &&
      routingReadiness(route, activeProfiles, activeCopyModes).missingCopies.length === 0,
  ).length;
  const customerCopyCount = PRINT_ROUTING_REQUIREMENTS.filter((route) =>
    route.requiredCopies.includes("customer"),
  ).length;
  const officeCopyCount = PRINT_ROUTING_REQUIREMENTS.filter((route) =>
    route.requiredCopies.includes("office"),
  ).length;

  const columns = [
    {
      key: "workflow",
      label: "Workflow",
      render: (row: PrintRoutingRequirement) => (
        <Stack gap={3}>
          <Group gap={6}>
            <Badge>{row.module}</Badge>
            <Badge tone="neutral">{row.trigger}</Badge>
          </Group>
          <Text size="sm" fw={600}>
            {row.workflow}
          </Text>
        </Stack>
      ),
    },
    {
      key: "artifact",
      label: "Print Sheet",
      render: (row: PrintRoutingRequirement) => (
        <Stack gap={3}>
          <Text size="sm">{row.artifact}</Text>
          <Text size="xs" c="dimmed">
            {optionLabel(PRINT_FORMATS, row.format)}
          </Text>
        </Stack>
      ),
    },
    {
      key: "copies",
      label: "Copies",
      render: (row: PrintRoutingRequirement) => (
        <Group gap={4}>
          {row.requiredCopies.map((copy) => (
            <Badge
              key={copy}
              tone={copy === "customer" || copy === "office" ? "accent" : "success"}
            >
              {optionLabel(PRINT_COPY_MODES, copy)}
            </Badge>
          ))}
        </Group>
      ),
    },
    {
      key: "printerProfiles",
      label: "Required Printers",
      render: (row: PrintRoutingRequirement) => (
        <Stack gap={4}>
          {row.printerProfiles.map((profile) => (
            <Badge key={profile} tone={activeProfiles.has(profile) ? "info" : "warning"}>
              {optionLabel(LOGICAL_PRINTER_PROFILES, profile)}
            </Badge>
          ))}
        </Stack>
      ),
    },
    {
      key: "standards",
      label: "Controls",
      render: (row: PrintRoutingRequirement) => (
        <Stack gap={3}>
          {row.standardRefs.map((standard) => (
            <Text key={standard} size="xs" c="dimmed" lineClamp={1}>
              {standard}
            </Text>
          ))}
        </Stack>
      ),
    },
    {
      key: "status",
      label: "Setup",
      render: (row: PrintRoutingRequirement) => {
        const readiness = routingReadiness(row, activeProfiles, activeCopyModes);
        return (
          <Stack gap={4}>
            <Badge tone={readinessTone(readiness.color)}>{readiness.label}</Badge>
            {readiness.missingProfiles.length > 0 && (
              <Text size="xs" c="orange">
                Missing:{" "}
                {readiness.missingProfiles
                  .map((profile) => optionLabel(LOGICAL_PRINTER_PROFILES, profile))
                  .join(", ")}
              </Text>
            )}
            {readiness.missingCopies.length > 0 && (
              <Text size="xs" c="orange">
                Copy gap:{" "}
                {readiness.missingCopies
                  .map((copy) => optionLabel(PRINT_COPY_MODES, copy))
                  .join(", ")}
              </Text>
            )}
          </Stack>
        );
      },
    },
  ];

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 4 }}>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Print Routes
          </Text>
          <Text size="xl" fw={700}>
            {PRINT_ROUTING_REQUIREMENTS.length}
          </Text>
        </Card>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Ready
          </Text>
          <Text
            size="xl"
            fw={700}
            c={readyCount === PRINT_ROUTING_REQUIREMENTS.length ? "success" : "orange"}
          >
            {readyCount}
          </Text>
        </Card>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Customer Copy
          </Text>
          <Text size="xl" fw={700}>
            {customerCopyCount}
          </Text>
        </Card>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Office Copy
          </Text>
          <Text size="xl" fw={700}>
            {officeCopyCount}
          </Text>
        </Card>
      </SimpleGrid>

      <DataTable
        columns={columns}
        data={[...PRINT_ROUTING_REQUIREMENTS]}
        loading={isLoading}
        rowKey={(route) => route.id}
        virtualized="auto"
        tableMaxHeight="62vh"
        emptyIcon={<IconRoute size={36} />}
        emptyTitle="No print routes"
        emptyDescription="Add print routing requirements before enabling direct printer dispatch."
      />
    </Stack>
  );
}

// ── Print Queue Tab ─────────────────────────────────────
