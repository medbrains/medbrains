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

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Group, Modal, Stack, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { IpdTransferOutFormInput } from "@medbrains/schemas";
import { ipdTransferOutFormSchema } from "@medbrains/schemas";
import { Controller, useForm } from "react-hook-form";

interface TransferOutModalProps {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
}

export function TransferOutModal({ admissionId, opened, onClose }: TransferOutModalProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<IpdTransferOutFormInput>({
    resolver: zodResolver(ipdTransferOutFormSchema),
    defaultValues: {
      receiving_hospital: "",
      receiving_doctor: "",
      receiving_phone: "",
      reason: "",
      clinical_summary: "",
      transport_mode: "",
      accompanying_staff: "",
    },
    mode: "onTouched",
  });

  const handlePrint = handleSubmit((values) => {
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
          <div class="field"><span class="label">Receiving hospital:</span> ${values.receiving_hospital}</div>
          <div class="field"><span class="label">Receiving physician:</span> ${values.receiving_doctor || "—"}</div>
          <div class="field"><span class="label">Contact:</span> ${values.receiving_phone || "—"}</div>
          <div class="field"><span class="label">Reason for transfer:</span> ${values.reason}</div>
          <div class="field"><span class="label">Mode of transport:</span> ${values.transport_mode || "Ambulance"}</div>
          <div class="field"><span class="label">Accompanying staff:</span> ${values.accompanying_staff || "—"}</div>
          <div class="field"><span class="label">Clinical summary:</span></div>
          <div class="summary">${values.clinical_summary.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>
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
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Inter-hospital transfer-out" size="lg">
      <Stack gap="sm">
        <Alert color="warning" variant="light">
          Generates a transfer letter for the receiving hospital. Records captured here also seed
          the future referral.dispatched event. MLC cases require additional police-liaison
          clearance.
        </Alert>

        <Controller
          control={control}
          name="receiving_hospital"
          render={({ field }) => (
            <TextInput
              label="Receiving hospital / facility"
              required
              placeholder="e.g. Apollo Hospitals, Chennai"
              value={field.value}
              onChange={field.onChange}
              error={errors.receiving_hospital?.message}
            />
          )}
        />
        <Group grow>
          <Controller
            control={control}
            name="receiving_doctor"
            render={({ field }) => (
              <TextInput
                label="Receiving physician"
                placeholder="Dr. Name"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="receiving_phone"
            render={({ field }) => (
              <TextInput
                label="Contact number"
                placeholder="+91 …"
                value={field.value}
                onChange={field.onChange}
                error={errors.receiving_phone?.message}
              />
            )}
          />
        </Group>
        <Controller
          control={control}
          name="reason"
          render={({ field }) => (
            <Textarea
              label="Reason for transfer"
              required
              autosize
              minRows={2}
              value={field.value}
              onChange={field.onChange}
              error={errors.reason?.message}
              placeholder="Higher-level care needed; specialty unavailable; family request; etc."
            />
          )}
        />
        <Controller
          control={control}
          name="clinical_summary"
          render={({ field }) => (
            <Textarea
              label="Clinical summary"
              autosize
              minRows={4}
              value={field.value}
              onChange={field.onChange}
              placeholder="Diagnosis · vitals · current treatment · pending investigations · medications administered today · last meal time"
            />
          )}
        />
        <Group grow>
          <Controller
            control={control}
            name="transport_mode"
            render={({ field }) => (
              <TextInput
                label="Mode of transport"
                placeholder="Ambulance (BLS/ALS), private vehicle"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="accompanying_staff"
            render={({ field }) => (
              <TextInput
                label="Accompanying staff"
                placeholder="Nurse / paramedic name"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Group>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void handlePrint()}>Generate + print letter</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
