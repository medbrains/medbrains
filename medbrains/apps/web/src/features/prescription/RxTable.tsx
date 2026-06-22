import { Box, Group } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconX } from "@tabler/icons-react";
import { Button, SegmentedControl, Table } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton";
import { Input, NumberField } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DoseField } from "./DoseField";
import classes from "./prescription.module.scss";
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
  stockStatus,
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
  /** Lowercased NLEM (government-essential) generic names — drives the NLEM tag. */
  nlemGenerics: ReadonlySet<string>;
  onChange: (uid: number, patch: Partial<RxItem>) => void;
  /** Open the detailed dose modal for this row. */
  onOpenDetails: (uid: number) => void;
  onRemove: (uid: number) => void;
}

/**
 * Inline-editable prescription chart. Frequency / dose / duration / timing are
 * set directly on each row; the adjust icon opens a modal for the detailed dose
 * writer (day-parts · custom times · cadence · SOS · route · note).
 */
export function RxTable({
  items,
  formularyById,
  nlemGenerics,
  onChange,
  onOpenDetails,
  onRemove,
}: Props) {
  const isNlem = (d?: FormularyDrug) =>
    Boolean(d?.salt && nlemGenerics.has(d.salt.trim().toLowerCase()));
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
          const cadence = !it.sos && it.repeat && it.repeat.type !== "daily";
          return (
            <Table.Tr key={it.uid}>
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
                {d && stockStatus(d) === "out" && (
                  <span className={`${classes.rxTFlag} ${classes.rxTFlagRed}`}>out of stock</span>
                )}
                {d && stockStatus(d) === "low" && (
                  <span className={classes.rxTFlag}>low stock</span>
                )}
                {it.pendingMD && <span className={classes.rxTFlag}>pending MD</span>}
                {isNlem(d) && (
                  <span
                    className={`${classes.rxTFlag} ${classes.rxTFlagNlem}`}
                    title="Generic is on the National List of Essential Medicines — prefer the generic"
                  >
                    NLEM
                  </span>
                )}
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
                    aria-label={`Dose details for ${it.name}`}
                    onClick={() => onOpenDetails(it.uid)}
                    size="sm"
                  >
                    <IconAdjustmentsHorizontal size={15} stroke={1.6} />
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
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
