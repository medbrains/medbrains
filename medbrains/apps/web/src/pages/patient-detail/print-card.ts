// Patient-detail registration-card print helpers — split from patient-detail.tsx (pure move).

import { notifications } from "@mantine/notifications";
import type { RegistrationCardPrintData } from "@medbrains/types";
import { patientDetailService } from "@/services/patientDetail.service";
import { buildCopyPrintHtml, copyPrintStyles, PRINT_COPY_PACKETS } from "@/utils/printCopies";
import { escapeHtml } from "./shared";

export const PATIENT_CARD_PRINT_COPIES = PRINT_COPY_PACKETS.patientCard;

function registrationCardValue(value: string | null | undefined, fallback = "Not recorded") {
  return escapeHtml(value?.trim() || fallback);
}

function registrationAllergySummary(allergies: readonly string[]) {
  if (allergies.length === 0) {
    return "None recorded";
  }
  return allergies.map((allergy) => escapeHtml(allergy)).join(", ");
}

function buildRegistrationCardContent(data: RegistrationCardPrintData) {
  const hospitalName = registrationCardValue(data.hospital_name, "MedBrains HMS");
  const printedAt = new Date().toLocaleString("en-IN");

  return `
    <section class="registration-print">
      <header class="registration-header">
        <div>
          <div class="hospital-name">${hospitalName}</div>
          <div class="document-title">Registration slip and patient card</div>
        </div>
        <div class="printed-at">Printed ${escapeHtml(printedAt)}</div>
      </header>

      <section class="patient-card">
        <div>
          <div class="uhid">${registrationCardValue(data.uhid)}</div>
          <div class="patient-name">${registrationCardValue(data.patient_name)}</div>
          <div class="identity-line">
            ${registrationCardValue(data.gender)} | ${registrationCardValue(data.age)} | DOB ${registrationCardValue(data.date_of_birth)}
          </div>
        </div>
        <div class="qr-block">
          <div class="qr-label">QR</div>
          <div class="qr-code">${registrationCardValue(data.qr_code_data)}</div>
        </div>
      </section>

      <dl class="registration-details">
        <dt>UHID</dt><dd>${registrationCardValue(data.uhid)}</dd>
        <dt>Phone</dt><dd>${registrationCardValue(data.phone)}</dd>
        <dt>Email</dt><dd>${registrationCardValue(data.email)}</dd>
        <dt>Blood group</dt><dd>${registrationCardValue(data.blood_group)}</dd>
        <dt>Registered on</dt><dd>${registrationCardValue(data.registration_date)}</dd>
        <dt>Address</dt><dd>${registrationCardValue(data.address)}</dd>
        <dt>Emergency contact</dt>
        <dd>
          ${registrationCardValue(data.emergency_contact_name)}
          ${data.emergency_contact_phone ? `(${registrationCardValue(data.emergency_contact_phone)})` : ""}
        </dd>
        <dt>Allergies</dt><dd>${registrationAllergySummary(data.allergies)}</dd>
      </dl>

      <footer class="registration-footer">
        Verify patient identity with UHID plus a second identifier before clinical service or billing.
      </footer>
    </section>
  `;
}

function writeRegistrationCardPrintPacket(win: Window, data: RegistrationCardPrintData) {
  const content = buildRegistrationCardContent(data);
  win.document.open();
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Patient Card ${registrationCardValue(data.uhid)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 16px; color: #101918; font-size: 12px; }
          .registration-print { border: 1px solid #cfd8dc; padding: 14px; border-radius: 6px; }
          .registration-header { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 12px; }
          .hospital-name { font-size: 17px; font-weight: 700; }
          .document-title { color: #475569; margin-top: 2px; }
          .printed-at { color: #64748b; font-size: 11px; white-space: nowrap; }
          .patient-card { border: 2px solid #1f2937; border-radius: 8px; padding: 14px; display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
          .uhid { font-size: 20px; font-weight: 800; color: #0f6b75; letter-spacing: 0; }
          .patient-name { font-size: 16px; font-weight: 700; margin-top: 5px; }
          .identity-line { color: #475569; margin-top: 4px; }
          .qr-block { width: 112px; min-height: 82px; border: 1px dashed #94a3b8; border-radius: 6px; padding: 8px; text-align: center; overflow-wrap: anywhere; }
          .qr-label { font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 4px; }
          .qr-code { font-size: 9px; color: #0f172a; }
          .registration-details { display: grid; grid-template-columns: 120px 1fr; gap: 7px 12px; margin: 0; }
          .registration-details dt { color: #475569; font-weight: 700; }
          .registration-details dd { margin: 0; }
          .registration-footer { border-top: 1px solid #cbd5e1; margin-top: 14px; padding-top: 10px; color: #475569; font-size: 11px; }
          ${copyPrintStyles()}
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${buildCopyPrintHtml(content, PATIENT_CARD_PRINT_COPIES)}
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
    </html>
  `);
  win.document.close();
}

export async function handlePrintPatientCard(patientId: string): Promise<boolean> {
  const win = window.open("", "_blank", "width=520,height=720");
  if (!win) {
    notifications.show({
      title: "Print blocked",
      message: "Allow pop-ups to print the patient card packet.",
      color: "warning",
    });
    return false;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html><head><title>Preparing patient card</title></head>
    <body style="font-family:Arial,sans-serif;padding:20px;">Preparing patient card...</body></html>
  `);
  win.document.close();

  try {
    const data = await patientDetailService.getRegistrationCardPrintData(patientId);
    writeRegistrationCardPrintPacket(win, data);
    return true;
  } catch (error) {
    win.close();
    notifications.show({
      title: "Print failed",
      message: error instanceof Error ? error.message : "Unable to load patient card print data.",
      color: "danger",
    });
    return false;
  }
}
