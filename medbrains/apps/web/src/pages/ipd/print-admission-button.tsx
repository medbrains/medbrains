// IPD PrintAdmissionButton — split from ipd.tsx (pure move).

import { protectedIpdPatientIdentifier, protectedIpdPatientName } from "./shared";
import { useProtectedFieldAccess } from "@/components";
import { Badge, Button } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { buildCopyPrintHtml, copyPrintStyles, printCopyRouteLabel, PRINT_COPY_PACKETS } from "@/utils/printCopies";
import { Drawer, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import type { AdmissionPrintData } from "@medbrains/types";
import { IconPrinter } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

const IPD_ADMISSION_PRINT_COPIES = PRINT_COPY_PACKETS.ipdAdmission;

export function PrintAdmissionButton({ admissionId }: { admissionId: string }) {
  const printRef = useRef<HTMLDivElement | null>(null);
  const [printing, setPrinting] = useState(false);
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const { data } = useQuery({
    queryKey: ["ipd-print", admissionId],
    queryFn: () => ipdService.getAdmissionPrintData(admissionId),
    enabled: printing,
  });

  const printData = data as AdmissionPrintData | undefined;
  const printablePatientName = printData
    ? protectedIpdPatientName(printData.patient_name, patientNameAccess)
    : "Patient";
  const printableUhid = printData
    ? protectedIpdPatientIdentifier(printData.uhid, uhidAccess)
    : "No UHID";

  const handlePrint = () => {
    if (!printRef.current || !printData) return;
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Admission Slip - ${printableUhid}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111; font-size: 13px; }
            .admission-slip { border: 1px solid #ccc; border-radius: 4px; padding: 16px; }
            .title { text-align: center; font-size: 18px; font-weight: 700; margin-bottom: 16px; text-transform: uppercase; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; }
            .label { color: #555; font-size: 11px; text-transform: uppercase; }
            .value { font-weight: 600; margin-top: 2px; }
            .diagnosis { margin-top: 16px; border-top: 1px solid #ddd; padding-top: 12px; }
            ${copyPrintStyles()}
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${buildCopyPrintHtml(printRef.current.innerHTML, IPD_ADMISSION_PRINT_COPIES)}
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!printing) {
    return (
      <Button
        tone="secondary"
        size="xs"
        leftSection={<IconPrinter size={14} />}
        onClick={() => setPrinting(true)}
      >
        Print Slip
      </Button>
    );
  }

  if (!printData)
    return (
      <Text size="xs" c="dimmed">
        Loading print data...
      </Text>
    );

  return (
    <Drawer opened onClose={() => setPrinting(false)} title="Admission Slip" size="md">
      <Stack p="md">
        <Group gap={6}>
          {IPD_ADMISSION_PRINT_COPIES.map((copy) => (
            <Badge key={copy.label} tone="accent">
              {printCopyRouteLabel(copy)}
            </Badge>
          ))}
        </Group>
        <Stack ref={printRef} className="admission-slip" p="md" id="admission-slip-print">
          <Text ta="center" fw={700} size="lg" className="title">
            Admission Slip
          </Text>
          <SimpleGrid cols={2} className="grid">
            <div>
              <Text size="xs" c="dimmed" className="label">
                Patient Name
              </Text>
              <Text fw={500} className="value">
                {printablePatientName}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                UHID
              </Text>
              <Text fw={500} className="value">
                {printableUhid}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Age
              </Text>
              <Text className="value">{printData.age ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Gender
              </Text>
              <Text className="value">{printData.gender ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Admission Date
              </Text>
              <Text className="value">{new Date(printData.admission_date).toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Ward
              </Text>
              <Text className="value">{printData.ward_name ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Bed
              </Text>
              <Text className="value">{printData.bed_number ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Department
              </Text>
              <Text className="value">{printData.department_name ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Attending Doctor
              </Text>
              <Text className="value">{printData.doctor_name ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                IP Type
              </Text>
              <Text className="value">{printData.ip_type ?? "—"}</Text>
            </div>
          </SimpleGrid>
          {printData.provisional_diagnosis && (
            <div className="diagnosis">
              <Text size="xs" c="dimmed" className="label">
                Provisional Diagnosis
              </Text>
              <Text className="value">{printData.provisional_diagnosis}</Text>
            </div>
          )}
        </Stack>
        <Button
          tone="primary"
          mt="md"
          leftSection={<IconPrinter size={16} />}
          onClick={handlePrint}
        >
          Print admission packet
        </Button>
      </Stack>
    </Drawer>
  );
}

// ── Bed Turnaround View ────────────────────────────────

// ══════════════════════════════════════════════════════════
//  Phase 3b — Death Summary Tab
// ══════════════════════════════════════════════════════════
