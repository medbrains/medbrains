// Clinical-kb IhipTab — the IDSP P-form (presumptive) and L-form
// (lab-confirmed) line lists for a day or a reporting week, to enter on IHIP,
// and the portal's acknowledgement recorded against every case on them.

import { Group, Stack, Text } from "@mantine/core";
import type { IhipForm, IhipLineList } from "@medbrains/types";
import { IconFileSpreadsheet, IconListDetails, IconPrinter } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { downloadSheetCsv, printSheet } from "@/components/Reports/statutory-sheet";
import { Alert, Button, Input, SegmentedControl, toast } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";
import { FacilityCodeField } from "./facility-code-field";
import { IhipSubmitModal } from "./ihip-submit-modal";

interface IhipTabProps {
  canList: boolean;
  canManage: boolean;
  canExport: boolean;
}

/** A local calendar date as yyyy-mm-dd. */
const isoDay = (d: Date) => d.toLocaleDateString("en-CA");

/** The IDSP reporting week runs Monday to Sunday; this one, up to today. */
export function reportingWeek(today: Date): { from: string; to: string } {
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return { from: isoDay(monday), to: isoDay(today) };
}

const FORM_LABEL: Record<IhipForm, string> = {
  P: "P-form · presumptive",
  L: "L-form · lab-confirmed",
};

function listTitle(list: IhipLineList): string {
  const unit = list.facility.ihip_unit_id ? ` · unit ${list.facility.ihip_unit_id}` : "";
  return `IDSP ${list.form}-form line list — ${list.facility.name}${unit} — ${list.period_from} to ${list.period_to}`;
}

export function IhipTab({ canList, canManage, canExport }: IhipTabProps) {
  const [form, setForm] = useState<IhipForm>("P");
  const [period, setPeriod] = useState(() => reportingWeek(new Date()));
  const [list, setList] = useState<IhipLineList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Made on demand, never prefetched: each list is a recorded disclosure.
  const make = useMutation({
    mutationFn: () => ckbService.getIhipLineList(form, period.from, period.to),
    onSuccess: setList,
    onError: (e: Error) => toast.error(e.message, { title: "Line list not made" }),
  });
  const today = isoDay(new Date());

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        IHIP takes cases entered on the portal. Make the day's or the week's list here, enter it on
        IHIP, then record the acknowledgement IHIP gives. TB is notified on the Ni-kshay tab.
      </Text>
      {canList && <FacilityCodeField field="ihip_unit_id" canManage={canManage} />}
      {canExport && (
        <Group align="flex-end" gap="sm">
          <SegmentedControl
            aria-label="Form"
            data={(["P", "L"] as const).map((f) => ({ value: f, label: FORM_LABEL[f] }))}
            value={form}
            onChange={(v) => {
              setForm(v as IhipForm);
              setList(null);
            }}
          />
          <Input
            type="date"
            label="From"
            value={period.from}
            max={period.to}
            onChange={(e) => setPeriod({ ...period, from: e.currentTarget.value })}
          />
          <Input
            type="date"
            label="To"
            value={period.to}
            max={today}
            onChange={(e) => setPeriod({ ...period, to: e.currentTarget.value })}
          />
          <Button size="xs" tone="ghost" onClick={() => setPeriod({ from: today, to: today })}>
            Today
          </Button>
          <Button size="xs" tone="ghost" onClick={() => setPeriod(reportingWeek(new Date()))}>
            This week
          </Button>
          <Button
            size="xs"
            tone="primary"
            leftSection={<IconListDetails size={16} />}
            loading={make.isPending}
            onClick={() => make.mutate()}
          >
            Make line list
          </Button>
        </Group>
      )}
      {list && list.rows.length === 0 && (
        <Alert tone="info">
          No {list.form}-form case is waiting to be reported in this period.
        </Alert>
      )}
      {list && list.rows.length > 0 && (
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              {list.rows.length} case{list.rows.length === 1 ? "" : "s"} · {list.period_from} to{" "}
              {list.period_to}
            </Text>
            <Group gap="xs">
              <Button
                size="xs"
                tone="secondary"
                leftSection={<IconFileSpreadsheet size={16} />}
                onClick={() => downloadSheetCsv(list, `idsp-${list.form}-form-line-list`)}
              >
                Download CSV
              </Button>
              <Button
                size="xs"
                tone="secondary"
                leftSection={<IconPrinter size={16} />}
                onClick={() => printSheet(list, listTitle(list))}
              >
                Print
              </Button>
              {canManage && (
                <Button size="xs" tone="primary" onClick={() => setSubmitting(true)}>
                  Record IHIP acknowledgement
                </Button>
              )}
            </Group>
          </Group>
          <DataTable
            columns={[
              {
                key: "disease_name",
                label: "Disease",
                render: (d: IhipLineList["summary"][number]) => (
                  <Text size="sm">
                    {d.disease_name}{" "}
                    <Text span size="xs" c="dimmed" ff="var(--mb-font-mono)">
                      {d.icd10_code}
                    </Text>
                  </Text>
                ),
              },
              {
                key: "cases",
                label: "Cases",
                render: (d: IhipLineList["summary"][number]) => <Text size="sm">{d.cases}</Text>,
              },
            ]}
            data={list.summary}
            rowKey={(d: IhipLineList["summary"][number]) => d.icd10_code}
          />
        </Stack>
      )}
      {submitting && list && (
        <IhipSubmitModal
          list={list}
          onClose={() => setSubmitting(false)}
          onSubmitted={() => {
            setSubmitting(false);
            setList(null);
          }}
        />
      )}
    </Stack>
  );
}
