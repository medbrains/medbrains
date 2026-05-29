import { Alert, Badge, Button, Group, Modal, Stack } from "@mantine/core";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import { P, type PrescriptionWithItems } from "@medbrains/types";
import { IconLock, IconPrinter } from "@tabler/icons-react";
import { useRef } from "react";
import {
  buildCopyPrintHtml,
  copyPrintStyles,
  PRINT_COPY_PACKETS,
  printCopyRouteLabel,
} from "../../utils/printCopies";
import styles from "./prescription-print.module.scss";

interface PrescriptionPrintProps {
  opened: boolean;
  onClose: () => void;
  prescription: PrescriptionWithItems;
  patientName: string;
  uhid: string;
  doctorName?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
}

function escapePrintText(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

const PRESCRIPTION_PRINT_COPIES = PRINT_COPY_PACKETS.prescription;

export function PrescriptionPrint({
  opened,
  onClose,
  prescription,
  patientName,
  uhid,
  doctorName,
  hospitalName,
  hospitalAddress,
  hospitalPhone,
}: PrescriptionPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const canViewPatient = useHasPermission(P.PATIENTS.VIEW);
  const canPrintPrescription = useHasAnyPermission([
    P.OPD.VISIT_UPDATE,
    P.PHARMACY.PRESCRIPTIONS_VIEW,
    P.PHARMACY.DISPENSING_CREATE,
    P.PHARMACY.RX_QUEUE_REVIEW,
  ]);
  const canPrint = canViewPatient && canPrintPrescription;

  const handlePrint = () => {
    if (!canPrint) return;
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prescription - ${escapePrintText(patientName)}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
            .hospital-name { font-size: 20px; font-weight: 700; }
            .hospital-info { font-size: 12px; color: #555; margin: 2px 0; }
            .patient-row { display: flex; justify-content: space-between; border: 1px solid #ccc; border-radius: 4px; padding: 8px 12px; margin-bottom: 16px; font-size: 13px; }
            .field-label { font-weight: 600; color: #555; margin-right: 4px; }
            .rx { font-size: 28px; font-weight: 700; font-family: serif; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
            th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #333; font-weight: 600; }
            td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
            tr:last-child td { border-bottom: none; }
            .drug-name { font-weight: 600; }
            .notes { margin-top: 12px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; color: #555; font-style: italic; }
            .footer { margin-top: 48px; display: flex; justify-content: space-between; align-items: flex-end; }
            .date-section { font-size: 12px; color: #555; }
            .signature-line { width: 200px; border-top: 1px solid #333; padding-top: 4px; font-size: 12px; color: #555; text-align: center; }
            .doctor-name { font-weight: 600; font-size: 13px; color: #111; }
            ${copyPrintStyles()}
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${buildCopyPrintHtml(content.innerHTML, PRESCRIPTION_PRINT_COPIES)}
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const prescDate = new Date(prescription.prescription.created_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Prescription Preview" size="lg">
      <Stack>
        {!canPrint && (
          <Alert color="orange" variant="light" icon={<IconLock size={16} />}>
            Prescription printing requires patient view and prescription, dispensing, Rx review, or
            OPD visit update permission.
          </Alert>
        )}
        <div ref={printRef}>
          {canPrint && (
            <div className={styles.printContainer}>
              {/* Hospital Header */}
              <div className={styles.header}>
                <p className={styles.hospitalName}>{hospitalName ?? "Hospital"}</p>
                {hospitalAddress && <p className={styles.hospitalInfo}>{hospitalAddress}</p>}
                {hospitalPhone && <p className={styles.hospitalInfo}>Tel: {hospitalPhone}</p>}
              </div>

              {/* Patient Info */}
              <div className={styles.patientRow}>
                <div className={styles.patientField}>
                  <span className={styles.fieldLabel}>Patient:</span>
                  <span className={styles.fieldValue}>{patientName}</span>
                </div>
                <div className={styles.patientField}>
                  <span className={styles.fieldLabel}>UHID:</span>
                  <span className={styles.fieldValue}>{uhid}</span>
                </div>
                <div className={styles.patientField}>
                  <span className={styles.fieldLabel}>Date:</span>
                  <span className={styles.fieldValue}>{prescDate}</span>
                </div>
              </div>

              {/* Rx Symbol + Drug Table */}
              <div className={styles.rxSymbol}>&#8478;</div>
              <table className={styles.drugTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Drug</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                    <th>Route</th>
                  </tr>
                </thead>
                <tbody>
                  {prescription.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td>{idx + 1}</td>
                      <td className={styles.drugName}>{item.drug_name}</td>
                      <td>{item.dosage}</td>
                      <td>{item.frequency}</td>
                      <td>{item.duration}</td>
                      <td>{item.route ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Notes */}
              {prescription.prescription.notes && (
                <div className={styles.notes}>
                  <strong>Instructions:</strong> {prescription.prescription.notes}
                </div>
              )}

              {/* Footer */}
              <div className={styles.footer}>
                <div className={styles.dateSection}>Date: {prescDate}</div>
                <div className={styles.signatureSection}>
                  {doctorName && <div className={styles.doctorName}>Dr. {doctorName}</div>}
                  <div className={styles.signatureLine}>Signature & Seal</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {canPrint && (
          <Group gap={6} className={styles.noPrint}>
            {PRESCRIPTION_PRINT_COPIES.map((copy) => (
              <Badge key={copy.label} variant="light" color="violet">
                {printCopyRouteLabel(copy)}
              </Badge>
            ))}
          </Group>
        )}

        <Group justify="flex-end" className={styles.noPrint}>
          <Button variant="subtle" onClick={onClose}>
            Close
          </Button>
          <Button
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrint}
            disabled={!canPrint}
          >
            Print
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
