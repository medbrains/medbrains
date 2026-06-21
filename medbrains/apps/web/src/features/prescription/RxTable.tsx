import { Box, Group } from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconX } from "@tabler/icons-react";
import { Fragment } from "react";
import { Button, SegmentedControl, Table } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton";
import { Input, NumberField } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DoseField } from "./DoseField";
import classes from "./prescription.module.scss";
import { type ComposeValues, type Prescriber, RxCompose } from "./RxCompose";
import {
  byTime,
  type Dose,
  FOODS,
  type FormularyDrug,
  FREQ_CODES,
  type FreqCode,
  freqCodeToDoses,
  MAX_DOSES,
  type RxItem,
  repeatLabel,
} from "./rxModel";

/** Standard frequency code implied by an item's current doses (null = custom). */
function currentFreq(item: RxItem): FreqCode | null {
  if (item.sos) return "SOS";
  const byCount: Record<number, FreqCode> = { 1: "OD", 2: "BD", 3: "TID", 4: "QID" };
  return byCount[item.doses.length] ?? null;
}

interface Props {
  items: RxItem[];
  formularyById: Record<string, FormularyDrug>;
  /** uid of the row whose advanced editor is expanded. */
  expandedUid: number | null;
  prescriber: Prescriber;
  patientName: string;
  patientAllergies: string[];
  onChange: (uid: number, patch: Partial<RxItem>) => void;
  onExpand: (uid: number | null) => void;
  onRemove: (uid: number) => void;
}

/**
 * Inline-editable prescription chart. Frequency / dose / duration / timing are
 * set directly on each row (grid-cell controls); the ⋯ expand opens the full
 * compose card for the many-ways frequency builder (day-parts · custom times ·
 * cadence · SOS) + route + note.
 */
export function RxTable({
  items,
  formularyById,
  expandedUid,
  prescriber,
  patientName,
  patientAllergies,
  onChange,
  onExpand,
  onRemove,
}: Props) {
  const setFreq = (uid: number, code: string) => {
    if (code === "SOS") onChange(uid, { sos: true, doses: [] });
    else {
      const { doses, sos } = freqCodeToDoses(code);
      onChange(uid, { sos, doses, repeat: { type: "daily" } });
    }
  };
  const setDoseTime = (item: RxItem, di: number, time: string) =>
    onChange(item.uid, { doses: item.doses.map((d, i) => (i === di ? { ...d, time } : d)) });
  const addDoseTime = (item: RxItem) => {
    if (item.doses.length >= MAX_DOSES) return;
    const next: Dose[] = [
      ...item.doses,
      { key: `c${item.doses.length}-${item.uid}`, label: "Dose", time: "12:00" },
    ];
    onChange(item.uid, { doses: next.sort(byTime) });
  };
  const removeDoseTime = (item: RxItem, di: number) =>
    onChange(item.uid, { doses: item.doses.filter((_, i) => i !== di) });

  return (
    <Table className={classes.rxTable} highlightOnHover={false}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th className={classes.rxTNum}>#</Table.Th>
          <Table.Th>Medication</Table.Th>
          <Table.Th>Dose</Table.Th>
          <Table.Th>Frequency</Table.Th>
          <Table.Th>Duration</Table.Th>
          <Table.Th>Timing</Table.Th>
          <Table.Th className={classes.r} aria-label="actions" />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((it, i) => {
          const d = formularyById[it.id];
          const expanded = expandedUid === it.uid;
          const cadence = !it.sos && it.repeat && it.repeat.type !== "daily";
          return (
            <Fragment key={it.uid}>
              <Table.Tr>
                <Table.Td className={classes.rxTNum}>{String(i + 1).padStart(2, "0")}</Table.Td>
                <Table.Td className={classes.rxTDrug}>
                  <b>
                    {it.form ? `${it.form}. ` : ""}
                    {it.name}
                  </b>
                  {(d?.schedule === "X" || d?.schedule === "H1") && (
                    <span className={classes.rxTFlag}>{d.schedule}</span>
                  )}
                  {d?.controlled && <span className={classes.rxTFlag}>NDPS</span>}
                  {d?.aware && <span className={classes.rxTFlag}>{d.aware}</span>}
                  {d?.lasa && <span className={classes.rxTFlag}>LASA</span>}
                  {it.pendingMD && <span className={classes.rxTFlag}>pending MD</span>}
                  {d?.salt && <Box className={classes.rxTSalt}>{d.salt}</Box>}
                </Table.Td>
                <Table.Td className={classes.rxTDose}>
                  <DoseField
                    compact
                    value={it.strength}
                    strengths={d?.strengths ?? []}
                    onChange={(v) => onChange(it.uid, { strength: v })}
                  />
                </Table.Td>
                <Table.Td className={classes.rxTFreq}>
                  <SegmentedControl
                    size="xs"
                    value={currentFreq(it) ?? ""}
                    onChange={(v) => setFreq(it.uid, v)}
                    data={[...FREQ_CODES]}
                  />
                  {!it.sos && it.doses.length > 0 && (
                    <Group gap={4} wrap="wrap" className={classes.rxTDoseTimes}>
                      {it.doses.map((dose, di) => (
                        <Box key={dose.key} className={classes.rxTDoseTime}>
                          <Input
                            type="time"
                            size="xs"
                            value={dose.time}
                            aria-label={`Dose ${di + 1} time`}
                            onChange={(e) => setDoseTime(it, di, e.currentTarget.value)}
                            w={86}
                          />
                          {it.doses.length > 1 && (
                            <IconButton
                              aria-label="Remove this time"
                              tone="danger"
                              size="xs"
                              onClick={() => removeDoseTime(it, di)}
                            >
                              <IconX size={11} stroke={1.8} />
                            </IconButton>
                          )}
                        </Box>
                      ))}
                      {it.doses.length < MAX_DOSES && (
                        <Button tone="ghost" size="xs" onClick={() => addDoseTime(it)}>
                          + time
                        </Button>
                      )}
                    </Group>
                  )}
                  {cadence && <Box className={classes.rxTCad}>{repeatLabel(it.repeat)}</Box>}
                </Table.Td>
                <Table.Td className={classes.rxTDur}>
                  {it.ongoing ? (
                    <Box className={classes.rxTOngoing}>ongoing</Box>
                  ) : it.sos ? (
                    <Box className={classes.rxTOngoing}>PRN</Box>
                  ) : (
                    <NumberField
                      aria-label="Duration in days"
                      size="xs"
                      min={1}
                      max={365}
                      value={it.days}
                      onChange={(v) => onChange(it.uid, { days: Math.max(1, Number(v) || 1) })}
                      suffix=" d"
                      w={84}
                    />
                  )}
                </Table.Td>
                <Table.Td className={classes.rxTTiming}>
                  {it.sos ? (
                    <Box className={classes.rxTOngoing}>{it.note || "as needed"}</Box>
                  ) : (
                    <Select
                      aria-label="Timing"
                      size="xs"
                      value={it.food || null}
                      data={FOODS}
                      onChange={(v) => v && onChange(it.uid, { food: v })}
                      allowDeselect={false}
                      w={132}
                    />
                  )}
                </Table.Td>
                <Table.Td className={classes.r}>
                  <Group gap={4} justify="flex-end" wrap="nowrap" className={classes.rxTActions}>
                    <IconButton
                      aria-label={expanded ? "Collapse options" : "More options"}
                      onClick={() => onExpand(expanded ? null : it.uid)}
                      size="sm"
                    >
                      {expanded ? (
                        <IconChevronUp size={15} stroke={1.6} />
                      ) : (
                        <IconChevronDown size={15} stroke={1.6} />
                      )}
                    </IconButton>
                    <IconButton
                      aria-label={`Remove ${it.name}`}
                      tone="danger"
                      onClick={() => onRemove(it.uid)}
                      size="sm"
                    >
                      <IconX size={15} stroke={1.6} />
                    </IconButton>
                  </Group>
                </Table.Td>
              </Table.Tr>
              {expanded && d && (
                <Table.Tr key={`${it.uid}-edit`}>
                  <Table.Td colSpan={7} className={classes.rxTEdit}>
                    <RxCompose
                      drug={d}
                      init={it}
                      prescriber={prescriber}
                      patientName={patientName}
                      patientAllergies={patientAllergies}
                      onSave={(vals: ComposeValues) => {
                        onChange(it.uid, vals);
                        onExpand(null);
                      }}
                      onCancel={() => onExpand(null)}
                    />
                  </Table.Td>
                </Table.Tr>
              )}
            </Fragment>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
