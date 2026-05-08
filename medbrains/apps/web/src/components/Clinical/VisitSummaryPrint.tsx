import { Button, Group, Modal, Stack } from "@mantine/core";
import type {
  Consultation,
  Diagnosis,
  LabOrder,
  LabTestCatalog,
  PrescriptionWithItems,
  Vital,
} from "@medbrains/types";
import { IconPrinter } from "@tabler/icons-react";
import { useRef } from "react";
import styles from "./visit-summary-print.module.scss";

interface VisitSummaryPrintProps {
  opened: boolean;
  onClose: () => void;
  patientName: string;
  uhid: string;
  visitDate: string;
  doctorName?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  vitals: Vital[];
  consultation: Consultation | null;
  diagnoses: Diagnosis[];
  prescriptions: PrescriptionWithItems[];
  labOrders: LabOrder[];
  labCatalog: LabTestCatalog[];
}

export function VisitSummaryPrint({
  opened,
  onClose,
  patientName,
  uhid,
  visitDate,
  doctorName,
  hospitalName,
  hospitalAddress,
  hospitalPhone,
  vitals,
  consultation,
  diagnoses,
  prescriptions,
  labOrders,
  labCatalog,
}: VisitSummaryPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const getTestName = (testId: string) => {
    const test = labCatalog.find((t) => t.id === testId);
    return test ? test.name : "—";
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Visit Summary — ${patientName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111; font-size: 13px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
            .hospital-name { font-size: 20px; font-weight: 700; }
            .hospital-info { font-size: 12px; color: #555; margin: 2px 0; }
            .summary-title { font-size: 16px; font-weight: 700; text-align: center; text-transform: uppercase; margin: 12px 0; letter-spacing: 1px; }
            .patient-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; border: 1px solid #ccc; border-radius: 4px; padding: 8px 12px; margin-bottom: 16px; }
            .field { display: flex; gap: 4px; padding: 2px 0; }
            .field-label { font-weight: 600; color: #555; min-width: 80px; }
            .section-title { font-size: 14px; font-weight: 700; border-bottom: 1px solid #999; padding-bottom: 4px; margin: 16px 0 8px; }
            .vitals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
            .vital-item { text-align: center; padding: 6px; border: 1px solid #ddd; border-radius: 4px; }
            .vital-label { font-size: 11px; color: #777; text-transform: uppercase; }
            .vital-value { font-size: 16px; font-weight: 600; }
            .soap-section { margin-bottom: 8px; }
            .soap-label { font-weight: 600; color: #555; margin-bottom: 2px; }
            .soap-content { padding-left: 8px; white-space: pre-wrap; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            th { text-align: left; padding: 4px 8px; border-bottom: 2px solid #333; font-weight: 600; font-size: 12px; }
            td { padding: 4px 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
            .footer { margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 16px; border-top: 1px solid #ccc; }
            .signature-line { width: 200px; border-top: 1px solid #333; padding-top: 4px; font-size: 12px; color: #555; text-align: center; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const formattedDate = new Date(visitDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const latestVitals = vitals.length > 0 ? vitals[vitals.length - 1] : null;

  return (
    <Modal opened={opened} onClose={onClose} title="Visit Summary Preview" size="xl">
      <Stack>
        <div ref={printRef}>
          <div className={styles.printContainer}>
            {/* Hospital Header */}
            <div className={styles.header}>
              <p className={styles.hospitalName}>{hospitalName ?? "Hospital"}</p>
              {hospitalAddress && <p className={styles.hospitalInfo}>{hospitalAddress}</p>}
              {hospitalPhone && <p className={styles.hospitalInfo}>Tel: {hospitalPhone}</p>}
            </div>

            <div className={styles.summaryTitle}>OPD Visit Summary</div>

            {/* Patient Info */}
            <div className={styles.patientGrid}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Patient:</span>
                <span className={styles.fieldValue}>{patientName}</span>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>UHID:</span>
                <span className={styles.fieldValue}>{uhid}</span>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Visit Date:</span>
                <span className={styles.fieldValue}>{formattedDate}</span>
              </div>
              {doctorName && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Doctor:</span>
                  <span className={styles.fieldValue}>Dr. {doctorName}</span>
                </div>
              )}
            </div>

            {/* Vitals */}
            {latestVitals && (
              <>
                <div className={styles.sectionTitle}>Vitals</div>
                <div className={styles.vitalsGrid}>
                  {latestVitals.temperature != null && (
                    <div className={styles.vitalItem}>
                      <div className={styles.vitalLabel}>Temp</div>
                      <div className={styles.vitalValue}>{latestVitals.temperature}°F</div>
                    </div>
                  )}
                  {latestVitals.pulse != null && (
                    <div className={styles.vitalItem}>
                      <div className={styles.vitalLabel}>Pulse</div>
                      <div className={styles.vitalValue}>{latestVitals.pulse}/min</div>
                    </div>
                  )}
                  {latestVitals.systolic_bp != null && (
                    <div className={styles.vitalItem}>
                      <div className={styles.vitalLabel}>BP</div>
                      <div className={styles.vitalValue}>
                        {latestVitals.systolic_bp}/{latestVitals.diastolic_bp}
                      </div>
                    </div>
                  )}
                  {latestVitals.spo2 != null && (
                    <div className={styles.vitalItem}>
                      <div className={styles.vitalLabel}>SpO2</div>
                      <div className={styles.vitalValue}>{latestVitals.spo2}%</div>
                    </div>
                  )}
                  {latestVitals.respiratory_rate != null && (
                    <div className={styles.vitalItem}>
                      <div className={styles.vitalLabel}>RR</div>
                      <div className={styles.vitalValue}>{latestVitals.respiratory_rate}/min</div>
                    </div>
                  )}
                  {latestVitals.weight_kg != null && (
                    <div className={styles.vitalItem}>
                      <div className={styles.vitalLabel}>Weight</div>
                      <div className={styles.vitalValue}>{latestVitals.weight_kg} kg</div>
                    </div>
                  )}
                  {latestVitals.height_cm != null && (
                    <div className={styles.vitalItem}>
                      <div className={styles.vitalLabel}>Height</div>
                      <div className={styles.vitalValue}>{latestVitals.height_cm} cm</div>
                    </div>
                  )}
                  {latestVitals.bmi != null && (
                    <div className={styles.vitalItem}>
                      <div className={styles.vitalLabel}>BMI</div>
                      <div className={styles.vitalValue}>{latestVitals.bmi}</div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Consultation / SOAP Notes */}
            {consultation && (
              <>
                <div className={styles.sectionTitle}>Consultation Notes</div>
                {consultation.chief_complaint && (
                  <div className={styles.soapSection}>
                    <div className={styles.soapLabel}>Chief Complaint:</div>
                    <div className={styles.soapContent}>{consultation.chief_complaint}</div>
                  </div>
                )}
                {consultation.examination && (
                  <div className={styles.soapSection}>
                    <div className={styles.soapLabel}>Examination:</div>
                    <div className={styles.soapContent}>{consultation.examination}</div>
                  </div>
                )}
                {consultation.history && (
                  <div className={styles.soapSection}>
                    <div className={styles.soapLabel}>Assessment:</div>
                    <div className={styles.soapContent}>{consultation.history}</div>
                  </div>
                )}
                {consultation.plan && (
                  <div className={styles.soapSection}>
                    <div className={styles.soapLabel}>Plan:</div>
                    <div className={styles.soapContent}>{consultation.plan}</div>
                  </div>
                )}
              </>
            )}

            {/* Diagnoses */}
            {diagnoses.length > 0 && (
              <>
                <div className={styles.sectionTitle}>Diagnoses</div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnoses.map((d) => (
                      <tr key={d.id}>
                        <td>{d.icd_code ?? "—"}</td>
                        <td>{d.description}</td>
                        <td>{d.is_primary ? "Primary" : "Secondary"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Prescriptions */}
            {prescriptions.length > 0 && (
              <>
                <div className={styles.sectionTitle}>Prescriptions</div>
                {prescriptions.map((p) => (
                  <table key={p.prescription.id} className={styles.table}>
                    <thead>
                      <tr>
                        <th>Drug</th>
                        <th>Dosage</th>
                        <th>Frequency</th>
                        <th>Duration</th>
                        <th>Route</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.items.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>{item.drug_name}</td>
                          <td>{item.dosage}</td>
                          <td>{item.frequency}</td>
                          <td>{item.duration}</td>
                          <td>{item.route ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </>
            )}

            {/* Lab Orders */}
            {labOrders.length > 0 && (
              <>
                <div className={styles.sectionTitle}>Investigations Ordered</div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Priority</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{getTestName(order.test_id)}</td>
                        <td>{order.priority.toUpperCase()}</td>
                        <td>{order.status.replace(/_/g, " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Footer */}
            <div className={styles.footer}>
              <div style={{ fontSize: "12px", color: "#555" }}>
                Printed: {new Date().toLocaleDateString("en-IN")}
              </div>
              <div style={{ textAlign: "center" }}>
                {doctorName && (
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Dr. {doctorName}</div>
                )}
                <div className={styles.signatureLine}>Signature & Seal</div>
              </div>
            </div>
          </div>
        </div>

        <Group justify="flex-end" className={styles.noPrint}>
          <Button variant="subtle" onClick={onClose}>
            Close
          </Button>
          <Button leftSection={<IconPrinter size={16} />} onClick={handlePrint}>
            Print Summary
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
