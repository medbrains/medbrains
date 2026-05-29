import { Alert, Badge, Button, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type FoodTiming, P, type PrescriptionItem, type TimeOfDay } from "@medbrains/types";
import { IconLock, IconPrinter } from "@tabler/icons-react";
import { useMemo, useRef } from "react";
import {
  foodTimingLabel,
  frequencyToDefaultSlots,
  parseInstructions,
} from "@/lib/medication-timing-utils";
import {
  buildCopyPrintHtml,
  copyPrintStyles,
  PRINT_COPY_PACKETS,
  printCopyRouteLabel,
} from "@/utils/printCopies";
import classes from "./pharmacy-dispensing.module.scss";

interface PharmacyLabelProps {
  items: PrescriptionItem[];
  patientName: string;
  uhid: string;
  date?: string;
}

interface LabelData {
  id: string;
  drug_name: string;
  dosage: string;
  route: string | null;
  frequency: string;
  duration: string;
  time_slots: TimeOfDay[];
  food_timing?: FoodTiming;
  custom_instruction?: string;
}

const ALL_SLOTS: Array<{ slot: TimeOfDay; abbrev: string }> = [
  { slot: "morning", abbrev: "AM" },
  { slot: "afternoon", abbrev: "AF" },
  { slot: "evening", abbrev: "PM" },
  { slot: "bedtime", abbrev: "HS" },
];

const PHARMACY_LABEL_PRINT_COPIES = PRINT_COPY_PACKETS.pharmacyLabel;

export function PharmacyLabel({ items, patientName, uhid, date }: PharmacyLabelProps) {
  const printRef = useRef<HTMLDivElement | null>(null);
  const canViewPatient = useHasPermission(P.PATIENTS.VIEW);
  const canViewPrescription = useHasPermission(P.PHARMACY.PRESCRIPTIONS_VIEW);
  const canDispense = useHasPermission(P.PHARMACY.DISPENSING_CREATE);
  const canReviewRx = useHasPermission(P.PHARMACY.RX_QUEUE_REVIEW);
  const canPrintLabels = canViewPatient && (canViewPrescription || canDispense || canReviewRx);
  const labels = useMemo<LabelData[]>(() => {
    return items.map((item) => {
      const parsed = parseInstructions(item.instructions);
      let timeSlots: TimeOfDay[];
      let foodTiming: FoodTiming | undefined;
      let customInstruction: string | undefined;

      if (parsed && !("text" in parsed)) {
        timeSlots = parsed.time_slots?.length
          ? parsed.time_slots
          : frequencyToDefaultSlots(item.frequency);
        foodTiming = parsed.food_timing;
        customInstruction = parsed.custom_instruction;
      } else {
        timeSlots = frequencyToDefaultSlots(item.frequency);
      }

      return {
        id: item.id,
        drug_name: item.drug_name,
        dosage: item.dosage,
        route: item.route,
        frequency: item.frequency,
        duration: item.duration,
        time_slots: timeSlots,
        food_timing: foodTiming,
        custom_instruction: customInstruction,
      };
    });
  }, [items]);

  const handlePrint = () => {
    if (!canPrintLabels) return;
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank", "width=760,height=900");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Medication Labels</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 16px; color: #101918; font-size: 12px; }
            .pharmacy-label-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .pharmacy-label-card { border: 1px solid #222; border-radius: 4px; padding: 10px 12px; page-break-inside: avoid; }
            .pharmacy-label-drug { font-size: 15px; font-weight: 700; line-height: 1.2; margin-bottom: 4px; }
            .pharmacy-label-dosage { font-size: 12px; color: #34423e; margin-bottom: 8px; }
            .pharmacy-timing-strip { display: flex; gap: 8px; margin: 8px 0; }
            .pharmacy-timing-dot { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; }
            .pharmacy-timing-dot.active { background: #e0e0e0; border: 1px solid #000; color: #000; }
            .pharmacy-timing-dot.inactive { background: #fff; border: 1px solid #bbb; color: #888; }
            .pharmacy-food-instruction { font-size: 11px; font-weight: 600; color: #34423e; margin-top: 4px; }
            .pharmacy-label-patient { font-size: 10px; color: #53615f; margin-top: 8px; border-top: 1px dashed #88938f; padding-top: 6px; }
            ${copyPrintStyles()}
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${buildCopyPrintHtml(content.innerHTML, PHARMACY_LABEL_PRINT_COPIES)}
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Stack gap="sm">
      {!canPrintLabels && (
        <Alert color="orange" variant="light" icon={<IconLock size={16} />}>
          Medication label printing requires patient-view plus prescription, dispensing, or
          Rx-review permission.
        </Alert>
      )}
      <Group justify="flex-end" className="no-print">
        {PHARMACY_LABEL_PRINT_COPIES.map((copy) => (
          <Badge key={copy.label} color="violet" variant="light">
            {printCopyRouteLabel(copy)}
          </Badge>
        ))}
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPrinter size={14} />}
          onClick={handlePrint}
          disabled={!canPrintLabels}
        >
          Print Labels
        </Button>
      </Group>

      {canPrintLabels && (
        <div ref={printRef} className={`${classes.labelGrid} pharmacy-label-grid`}>
          {labels.map((label) => (
            <div key={label.id} className={`${classes.labelCard} pharmacy-label-card`}>
              <div className={`${classes.labelDrugName} pharmacy-label-drug`}>
                {label.drug_name}
              </div>

              <div className={`${classes.labelDosage} pharmacy-label-dosage`}>
                {label.dosage}
                {label.route && ` · ${label.route}`}
                {` · ${label.frequency}`}
                {` · ${label.duration}`}
              </div>

              <div className={`${classes.timingStrip} pharmacy-timing-strip`}>
                {ALL_SLOTS.map(({ slot, abbrev }) => {
                  const active = label.time_slots.includes(slot);
                  return (
                    <div
                      key={slot}
                      className={`${classes.timingDot} pharmacy-timing-dot ${
                        active ? `${classes.active} active` : `${classes.inactive} inactive`
                      }`}
                    >
                      {abbrev}
                    </div>
                  );
                })}
              </div>

              {label.food_timing && label.food_timing !== "any" && (
                <div className={`${classes.labelFoodInstruction} pharmacy-food-instruction`}>
                  {foodTimingLabel(label.food_timing)}
                </div>
              )}

              {label.custom_instruction && (
                <Text size="xs" c="dimmed" fs="italic">
                  {label.custom_instruction}
                </Text>
              )}

              <div className={`${classes.labelPatient} pharmacy-label-patient`}>
                {patientName} · {uhid}
                {date && ` · ${date}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </Stack>
  );
}
