/**
 * Print a register or statutory return for a period — the NDPS register for a
 * month, the BMW return for a quarter, the visitor register for a day.
 *
 * These documents key on a period, not a record, so the record menus cannot
 * offer them. The period string is what the server's handler parses:
 * `YYYY-MM-DD`, `YYYY-MM`, `YYYY-Qn` or `YYYY`.
 */
import { Popover, Stack } from "@mantine/core";
import { DatePicker, MonthPicker, YearPicker } from "@mantine/dates";
import { useHasPermission } from "@medbrains/stores";
import { IconPrinter } from "@tabler/icons-react";
import { useState } from "react";
import { Button, Select, toast } from "@/components/ui";
import { printDocumentDef } from "@/lib/print/print-registry";
import { printDocument } from "@/lib/print/printDocument";

export type RegisterPeriod = "date" | "month" | "quarter" | "year";

export interface PrintRegisterButtonProps {
  /** Registry key of a period document, e.g. "ndps-register". */
  documentKey: string;
  period: RegisterPeriod;
  label?: string;
}

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"].map((q) => ({ value: q, label: q }));

/** `YYYY-MM-DD` from the pickers, cut to what the handler expects. */
export function periodValue(period: RegisterPeriod, day: string, quarter: string): string {
  if (period === "date") return day.slice(0, 10);
  if (period === "month") return day.slice(0, 7);
  if (period === "year") return day.slice(0, 4);
  return `${day.slice(0, 4)}-${quarter}`;
}

/**
 * The calendar sits in the popover itself. A picker *input* opens a second
 * dropdown over the first, which could stay open over the Print button.
 */
function PeriodPicker({
  period,
  day,
  onDay,
}: {
  period: RegisterPeriod;
  day: string | null;
  onDay: (value: string | null) => void;
}) {
  if (period === "date") return <DatePicker aria-label="Day" value={day} onChange={onDay} />;
  if (period === "month") return <MonthPicker aria-label="Month" value={day} onChange={onDay} />;
  return <YearPicker aria-label="Year" value={day} onChange={onDay} />;
}

export function PrintRegisterButton({ documentKey, period, label }: PrintRegisterButtonProps) {
  const def = printDocumentDef(documentKey);
  const allowed = useHasPermission(def?.permission ?? "");
  const [day, setDay] = useState<string | null>(null);
  const [quarter, setQuarter] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  if (!def || !allowed) return null;

  const ready = day !== null && (period !== "quarter" || quarter !== null);
  const print = async () => {
    if (!day) return;
    setPrinting(true);
    const result = await printDocument(documentKey, periodValue(period, day, quarter ?? ""));
    setPrinting(false);
    if (!result.ok) {
      toast.error(result.problem ?? "The register could not be printed", {
        title: `Could not print ${def.label}`,
      });
    }
  };

  return (
    <Popover position="bottom-end" withinPortal trapFocus>
      <Popover.Target>
        <Button size="compact-sm" tone="secondary" leftSection={<IconPrinter size={14} />}>
          {label ?? def.label}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <PeriodPicker period={period} day={day} onDay={setDay} />
          {period === "quarter" && (
            <Select label="Quarter" data={QUARTERS} value={quarter} onChange={setQuarter} />
          )}
          <Button
            size="compact-sm"
            leftSection={<IconPrinter size={14} />}
            disabled={!ready}
            loading={printing}
            onClick={() => void print()}
          >
            Print
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
