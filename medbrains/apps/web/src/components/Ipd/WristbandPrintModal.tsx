// Wristband print — patient identity band for IPD admission. Prints
// from the browser's print dialog so any USB/Bluetooth label printer
// supported by the OS works (Zebra, Brother, generic 60×30mm).
//
// NABH IPSG 1 (correct patient identification): wristband must carry
// at least 2 identifiers. We use UHID + full name + DOB. Bed & ward
// help nursing locate the patient quickly. Critical / MLC / allergy
// indicators surface as inline glyphs the moment the band is read.
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Badge, Button, Group, Modal, Stack, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { IpdWristbandReprintFormInput } from "@medbrains/schemas";
import { ipdWristbandReprintFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import { P, type WristbandPrintData } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ipdService } from "../../services/ipd.service";
import { PRINT_COPY_ROUTES } from "../../utils/printCopies";

interface WristbandPrintModalProps {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
  canReprint: boolean;
}

const WRISTBAND_PRINT_ROUTE = PRINT_COPY_ROUTES.wristbandClinical;

export function WristbandPrintModal({
  admissionId,
  opened,
  onClose,
  canReprint,
}: WristbandPrintModalProps) {
  const printRef = useRef<HTMLDivElement | null>(null);
  const [printData, setPrintData] = useState<WristbandPrintData | null>(null);
  const hasPrintPermission = useHasPermission(P.IPD.WRISTBAND_PRINT);
  const hasReprintPermission = useHasPermission(P.IPD.WRISTBAND_REPRINT);
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);
  const canPreparePrint = hasPrintPermission && canViewPatientRecord;
  const canPrepareReprint = canReprint && hasReprintPermission && canViewPatientRecord;
  const reprintForm = useForm<IpdWristbandReprintFormInput>({
    resolver: zodResolver(ipdWristbandReprintFormSchema),
    defaultValues: { reprint_reason: "" },
  });
  const [reprintReasonOpened, { open: openReprintReason, close: closeReprintReason }] =
    useDisclosure(false);

  const printMutation = useMutation({
    mutationFn: (variables: { reprintReason?: string }) => {
      if (variables.reprintReason && !canPrepareReprint) {
        throw new Error("You do not have permission to reprint wristbands");
      }
      if (!variables.reprintReason && !canPreparePrint) {
        throw new Error("You do not have permission to print wristbands");
      }
      return ipdService.getWristbandPrintData(admissionId, variables);
    },
    onSuccess: (data) => {
      setPrintData(data);
      closeReprintReason();
      reprintForm.reset({ reprint_reason: "" });
    },
    onError: (error) => {
      notifications.show({
        title: "Wristband print failed",
        message: error instanceof Error ? error.message : "Unable to prepare wristband",
        color: "red",
      });
    },
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank", "width=400,height=300");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Wristband — ${printData?.uhid ?? ""}</title>
          <style>
            @page { size: 60mm 30mm; margin: 0; }
            body { margin: 0; font-family: monospace; }
            .band { width: 60mm; height: 30mm; padding: 2mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
            .name { font-size: 10pt; font-weight: 700; }
            .row { font-size: 7pt; }
            .uhid { font-size: 9pt; letter-spacing: 0.5mm; }
            .badges { font-size: 6pt; color: #c8102e; }
            .route { font-size: 5pt; color: #555; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    w.document.close();
  };

  const preparePrint = () => printMutation.mutate({});
  const prepareReprint = reprintForm.handleSubmit((values) => {
    printMutation.mutate({ reprintReason: values.reprint_reason.trim() });
  });
  const closeReprint = () => {
    closeReprintReason();
    reprintForm.reset({ reprint_reason: "" });
  };
  const closeModal = () => {
    setPrintData(null);
    closeReprint();
    onClose();
  };

  return (
    <Modal opened={opened} onClose={closeModal} title="Print wristband" size="md">
      <Stack gap="sm">
        <Alert color="primary" variant="light">
          NABH IPSG 1 — patient identification. Wristband prints with UHID + name + DOB at minimum.
          Confirm with the patient before attaching.
        </Alert>
        {!canPreparePrint && (
          <Alert color="danger" variant="light">
            Wristband printing requires both wristband print and patient-view permission.
          </Alert>
        )}

        {printData && (
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
                {printData.patient_name}
              </div>
              <div className="uhid" style={{ fontSize: "9pt", letterSpacing: "0.5mm" }}>
                {printData.uhid}
              </div>
              <div className="row" style={{ fontSize: "7pt" }}>
                DOB {printData.date_of_birth ?? "—"} · {printData.gender} · BG{" "}
                {printData.blood_group ?? "—"}
              </div>
              {(printData.is_critical || printData.is_mlc || printData.allergies.length > 0) && (
                <div className="badges" style={{ fontSize: "6pt", color: "#c8102e" }}>
                  {printData.is_critical && "★ CRITICAL "}
                  {printData.is_mlc && "⚠ MLC "}
                  {printData.allergies.length > 0 &&
                    `⚕ ALLERGY: ${printData.allergies.join(", ").slice(0, 30)}`}
                </div>
              )}
              <div className="route" style={{ fontSize: "5pt", color: "#555" }}>
                {WRISTBAND_PRINT_ROUTE.label} · {WRISTBAND_PRINT_ROUTE.printerProfile}
              </div>
            </div>
          </div>
        )}

        {printData && (
          <Group gap="xs">
            <Badge variant="light">{printData.document_number}</Badge>
            <Badge color="violet" variant="light">
              {WRISTBAND_PRINT_ROUTE.label}
            </Badge>
            <Badge color="blue" variant="light">
              {WRISTBAND_PRINT_ROUTE.printerProfile}
            </Badge>
            {printData.is_reprint && (
              <Badge color="orange" variant="light">
                Duplicate
              </Badge>
            )}
          </Group>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={closeModal}>
            Close
          </Button>
          {canPrepareReprint && (
            <Button
              variant="default"
              disabled={printMutation.isPending}
              onClick={openReprintReason}
            >
              Reprint
            </Button>
          )}
          {printData ? (
            <Button onClick={handlePrint}>Print wristband</Button>
          ) : (
            <Button
              onClick={preparePrint}
              loading={printMutation.isPending}
              disabled={!canPreparePrint}
            >
              Prepare wristband
            </Button>
          )}
        </Group>

        <Modal
          opened={reprintReasonOpened}
          onClose={closeReprint}
          title="Wristband reprint"
          centered
        >
          <form onSubmit={prepareReprint}>
            <Stack gap="sm">
              <Controller
                name="reprint_reason"
                control={reprintForm.control}
                render={({ field, fieldState }) => (
                  <Textarea
                    label="Reason"
                    placeholder="Example: original band damaged or ward transfer duplicate"
                    minRows={3}
                    error={fieldState.error?.message}
                    required
                    {...field}
                  />
                )}
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={closeReprint}>
                  Cancel
                </Button>
                <Button type="submit" loading={printMutation.isPending}>
                  Prepare reprint
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Modal>
  );
}
