// Inter-hospital transfer-out — generates the transfer letter and
// records the receiving facility. The actual outbound dispatch (FHIR
// referral message, fax, email of the PDF) is operator-driven; this
// modal captures intent + the artefact.
//
// Today the body just collects the data and shows it as a printable
// letter. A future iteration will:
//   - upload the rendered PDF to documents store
//   - emit a `referral.dispatched` event so the receiving hospital
//     (if also on MedBrains) gets a notification
//   - flip the admission status to `transferred_out`
import { Alert, Button, Group, Modal, Stack, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

interface TransferOutModalProps {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
}

export function TransferOutModal({ admissionId, opened, onClose }: TransferOutModalProps) {
  const [receivingHospital, setReceivingHospital] = useState("");
  const [receivingDoctor, setReceivingDoctor] = useState("");
  const [receivingPhone, setReceivingPhone] = useState("");
  const [reason, setReason] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [transportMode, setTransportMode] = useState("");
  const [accompanyingStaff, setAccompanyingStaff] = useState("");

  const handlePrint = () => {
    if (!receivingHospital || !reason) {
      notifications.show({
        title: "Missing required fields",
        message: "Receiving hospital + reason for transfer are required.",
        color: "danger",
      });
      return;
    }
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Inter-hospital transfer letter</title>
          <style>
            body { font-family: serif; max-width: 600px; margin: 40px auto; line-height: 1.6; }
            h1 { font-size: 18pt; border-bottom: 2px solid #000; padding-bottom: 6px; }
            .field { margin: 10px 0; }
            .label { font-weight: 600; display: inline-block; min-width: 200px; }
            .summary { white-space: pre-wrap; border-left: 3px solid #ccc; padding-left: 10px; margin: 10px 0; }
            .sig { margin-top: 40px; }
            .footer { font-size: 9pt; color: #555; margin-top: 30px; }
          </style>
        </head>
        <body onload="window.print();">
          <h1>Inter-Hospital Transfer Letter</h1>
          <div class="field"><span class="label">Date:</span> ${new Date().toLocaleString()}</div>
          <div class="field"><span class="label">Admission reference:</span> ${admissionId.slice(0, 12)}…</div>
          <div class="field"><span class="label">Receiving hospital:</span> ${receivingHospital}</div>
          <div class="field"><span class="label">Receiving physician:</span> ${receivingDoctor || "—"}</div>
          <div class="field"><span class="label">Contact:</span> ${receivingPhone || "—"}</div>
          <div class="field"><span class="label">Reason for transfer:</span> ${reason}</div>
          <div class="field"><span class="label">Mode of transport:</span> ${transportMode || "Ambulance"}</div>
          <div class="field"><span class="label">Accompanying staff:</span> ${accompanyingStaff || "—"}</div>
          <div class="field"><span class="label">Clinical summary:</span></div>
          <div class="summary">${clinicalSummary.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>
          <div class="sig">
            <p>Authorised by attending physician</p>
            <p>__________________________________</p>
            <p>Signature / Seal / Date</p>
          </div>
          <div class="footer">
            This letter accompanies the patient's medical records. Receiving
            facility must acknowledge receipt for handoff completion.
          </div>
        </body>
      </html>
    `);
    w.document.close();
    notifications.show({
      title: "Transfer letter generated",
      message: "Print + give to ambulance crew along with medical records.",
      color: "success",
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Inter-hospital transfer-out" size="lg">
      <Stack gap="sm">
        <Alert color="warning" variant="light">
          Generates a transfer letter for the receiving hospital. Records captured here also seed
          the future referral.dispatched event. MLC cases require additional police-liaison
          clearance.
        </Alert>

        <TextInput
          label="Receiving hospital / facility"
          required
          placeholder="e.g. Apollo Hospitals, Chennai"
          value={receivingHospital}
          onChange={(e) => setReceivingHospital(e.currentTarget.value)}
        />
        <Group grow>
          <TextInput
            label="Receiving physician"
            placeholder="Dr. Name"
            value={receivingDoctor}
            onChange={(e) => setReceivingDoctor(e.currentTarget.value)}
          />
          <TextInput
            label="Contact number"
            placeholder="+91 …"
            value={receivingPhone}
            onChange={(e) => setReceivingPhone(e.currentTarget.value)}
          />
        </Group>
        <Textarea
          label="Reason for transfer"
          required
          autosize
          minRows={2}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          placeholder="Higher-level care needed; specialty unavailable; family request; etc."
        />
        <Textarea
          label="Clinical summary"
          autosize
          minRows={4}
          value={clinicalSummary}
          onChange={(e) => setClinicalSummary(e.currentTarget.value)}
          placeholder="Diagnosis · vitals · current treatment · pending investigations · medications administered today · last meal time"
        />
        <Group grow>
          <TextInput
            label="Mode of transport"
            placeholder="Ambulance (BLS/ALS), private vehicle"
            value={transportMode}
            onChange={(e) => setTransportMode(e.currentTarget.value)}
          />
          <TextInput
            label="Accompanying staff"
            placeholder="Nurse / paramedic name"
            value={accompanyingStaff}
            onChange={(e) => setAccompanyingStaff(e.currentTarget.value)}
          />
        </Group>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handlePrint}>Generate + print letter</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
