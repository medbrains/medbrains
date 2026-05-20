// Wristband print — patient identity band for IPD admission. Prints
// from the browser's print dialog so any USB/Bluetooth label printer
// supported by the OS works (Zebra, Brother, generic 60×30mm).
//
// NABH IPSG 1 (correct patient identification): wristband must carry
// at least 2 identifiers. We use UHID + full name + DOB. Bed & ward
// help nursing locate the patient quickly. Critical / MLC / allergy
// indicators surface as inline glyphs the moment the band is read.
import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import type { AdmissionDetailResponse } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ipdService } from "../../services/ipd.service";

interface WristbandPrintModalProps {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
}

export function WristbandPrintModal({ admissionId, opened, onClose }: WristbandPrintModalProps) {
  const printRef = useRef<HTMLDivElement | null>(null);
  const { data } = useQuery({
    queryKey: ["admission-detail", admissionId],
    queryFn: () => ipdService.getAdmission(admissionId),
    enabled: opened,
  });

  const detail = data as AdmissionDetailResponse | undefined;
  const adm = detail?.admission;
  const patientId = adm?.patient_id ?? "";
  const { data: patient } = useQuery({
    queryKey: ["patient-detail", patientId],
    queryFn: () => ipdService.getPatient(patientId),
    enabled: patientId.length > 0,
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank", "width=400,height=300");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Wristband — ${patient?.uhid ?? ""}</title>
          <style>
            @page { size: 60mm 30mm; margin: 0; }
            body { margin: 0; font-family: monospace; }
            .band { width: 60mm; height: 30mm; padding: 2mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
            .name { font-size: 10pt; font-weight: 700; }
            .row { font-size: 7pt; }
            .uhid { font-size: 9pt; letter-spacing: 0.5mm; }
            .badges { font-size: 6pt; color: #c8102e; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    w.document.close();
  };

  // Auto-trigger print as soon as the data lands so the operator can
  // just click "Print" + Enter on the OS dialog. Disabled by default
  // because operators may want to confirm the badges first.
  useEffect(() => {
    return () => {
      // no-op — kept here for future auto-print toggle
    };
  }, []);

  const fullName = patient
    ? `${patient.prefix ?? ""} ${patient.first_name} ${patient.middle_name ?? ""} ${patient.last_name}`.trim()
    : "—";
  const dob = patient?.date_of_birth ?? "—";
  const allergies =
    patient?.attributes && typeof patient.attributes === "object"
      ? (((patient.attributes as Record<string, unknown>).drug_allergies as string | undefined) ??
        null)
      : null;

  return (
    <Modal opened={opened} onClose={onClose} title="Print wristband" size="md">
      <Stack gap="sm">
        <Alert color="primary" variant="light">
          NABH IPSG 1 — patient identification. Wristband prints with UHID + name + DOB at minimum.
          Confirm with the patient before attaching.
        </Alert>

        <div ref={printRef}>
          <div
            className="band"
            style={{
              width: "60mm",
              height: "30mm",
              padding: "2mm",
              border: "1px solid #999",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              fontFamily: "monospace",
            }}
          >
            <div className="name" style={{ fontSize: "10pt", fontWeight: 700 }}>
              {fullName}
            </div>
            <div className="uhid" style={{ fontSize: "9pt", letterSpacing: "0.5mm" }}>
              {patient?.uhid ?? "—"}
            </div>
            <div className="row" style={{ fontSize: "7pt" }}>
              DOB {dob} · {patient?.gender ?? "—"} · BG {patient?.blood_group ?? "—"}
            </div>
            {(adm?.is_critical || adm?.mlc_case_id || allergies) && (
              <div className="badges" style={{ fontSize: "6pt", color: "#c8102e" }}>
                {adm?.is_critical && "★ CRITICAL "}
                {adm?.mlc_case_id && "⚠ MLC "}
                {allergies && `⚕ ALLERGY: ${allergies.slice(0, 30)}`}
              </div>
            )}
          </div>
        </div>

        <Text size="xs" c="dimmed">
          Print on a 60×30mm label printer (Zebra ZD230 / Brother QL series / generic). Browser
          print dialog opens in a new window.
        </Text>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handlePrint} disabled={!patient}>
            Print wristband
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
