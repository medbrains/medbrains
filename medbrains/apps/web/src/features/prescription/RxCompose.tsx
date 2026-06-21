import { Box, Chip, Group, SimpleGrid, Stack } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Button, SegmentedControl, Select } from "@/components/ui";
import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { Input, NumberField } from "@/components/ui/Input";
import { DoseField } from "./DoseField";
import classes from "./prescription.module.scss";
import {
  byTime,
  CADENCE,
  type Dose,
  dosesFreqCode,
  FOODS,
  type FormularyDrug,
  fmt12,
  MAX_DOSES,
  type Repeat,
  ROUTES,
  type Route,
  type RxItem,
  repeatLabel,
  SLOTS,
  scheduleInfo,
  WEEK,
} from "./rxModel";

export type Prescriber = "doctor" | "nurse";

export interface ComposeValues {
  id: string;
  name: string;
  form: string;
  strength: string;
  brand: string;
  doses: Dose[];
  sos: boolean;
  repeat: Repeat;
  days: number;
  ongoing: boolean;
  food: string;
  route: Route;
  note: string;
  pendingMD: boolean;
}

interface Props {
  drug: FormularyDrug;
  /** Existing item when editing; undefined when adding. */
  init?: RxItem;
  prescriber: Prescriber;
  patientName: string;
  /** The patient's recorded allergies — drives the allergy block. */
  patientAllergies: string[];
  onSave: (vals: ComposeValues) => void;
  onCancel: () => void;
}

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** Does any recorded allergy name match this drug (by name or salt)? */
function matchAllergy(drug: FormularyDrug, allergies: string[]): string | null {
  const name = drug.name.toLowerCase();
  const salt = drug.salt.toLowerCase();
  for (const a of allergies) {
    const al = a.trim().toLowerCase();
    if (!al) continue;
    if (name.includes(al) || salt.includes(al) || (salt && al.includes(salt))) return a;
  }
  return null;
}

export function RxCompose({
  drug,
  init,
  prescriber,
  patientName,
  patientAllergies,
  onSave,
  onCancel,
}: Props) {
  const [strength, setStrength] = useState(init?.strength ?? drug.strengths[0] ?? "");
  const [brand, setBrand] = useState(init?.brand ?? drug.brands[0] ?? "");
  const [doses, setDoses] = useState<Dose[]>(
    init?.doses ? [...init.doses] : [{ key: "m", label: "Morning", time: "09:00" }],
  );
  const [sos, setSos] = useState(init?.sos ?? false);
  const [repeat, setRepeat] = useState<Repeat>(
    init?.repeat ? { ...init.repeat } : { type: "daily", days: [], everyN: 2, dom: 1 },
  );
  const [days, setDays] = useState(init?.days ?? 5);
  const [ongoing, setOngoing] = useState(init?.ongoing ?? false);
  const [food, setFood] = useState(init?.food || "after food");
  const [route, setRoute] = useState<Route>(init?.route ?? "oral");
  const [note, setNote] = useState(init?.note ?? "");
  const [override, setOverride] = useState(false);

  const toggleSlot = (s: (typeof SLOTS)[number]) =>
    setDoses((ds) => {
      if (ds.some((d) => d.key === s.key)) return ds.filter((d) => d.key !== s.key);
      if (ds.length >= MAX_DOSES) return ds;
      return [...ds, { key: s.key, label: s.label, time: s.def }].sort(byTime);
    });
  const addCustom = () =>
    setDoses((ds) =>
      ds.length >= MAX_DOSES
        ? ds
        : [...ds, { key: `c${Date.now()}`, label: "Custom", time: "12:00" }].sort(byTime),
    );
  const setTime = (i: number, time: string) =>
    setDoses((ds) => ds.map((d, j) => (j === i ? { ...d, time } : d)));
  const removeDose = (i: number) => setDoses((ds) => ds.filter((_, j) => j !== i));
  const setCad = (type: Repeat["type"]) => setRepeat((r) => ({ ...r, type }));
  const toggleWeekday = (d: number) =>
    setRepeat((r) => {
      if (r.type === "weekly") return { ...r, days: [d] };
      const has = (r.days || []).includes(d);
      return { ...r, days: has ? (r.days || []).filter((x) => x !== d) : [...(r.days || []), d] };
    });

  const allergyMatch = matchAllergy(drug, patientAllergies);
  const blocked = Boolean(allergyMatch && !override);
  const caution = Boolean(drug.crossPen && patientAllergies.length > 0);
  const nurseGate = prescriber === "nurse" && drug.kind === "rx";
  const noDoses = !sos && doses.length === 0;
  const sched = scheduleInfo(drug.schedule ?? null);

  const save = () => {
    if (blocked || noDoses) return;
    const dd = sos ? [] : [...doses].sort(byTime);
    onSave({
      id: drug.id,
      name: drug.name,
      form: drug.form,
      strength,
      brand,
      doses: dd,
      sos,
      repeat: sos ? { type: "daily" } : repeat,
      days,
      ongoing,
      food: sos ? "" : food,
      route,
      note,
      pendingMD: nurseGate,
    });
  };

  return (
    <Box className={classes.compose}>
      <Group justify="space-between" wrap="nowrap" className={classes.composeHead}>
        <Box className={classes.composeDrug}>
          <b>
            {drug.form}. {drug.name}
          </b>
          <span>{drug.cls}</span>
        </Box>
        <IconButton onClick={onCancel} aria-label="Close" size="sm">
          <IconX size={16} stroke={1.8} />
        </IconButton>
      </Group>
      <Stack gap="sm" className={classes.composeBody}>
        {/* regulatory signals */}
        {(sched || drug.aware || drug.controlled || drug.lasa) && (
          <Group gap="xs" className={classes.chipRow}>
            {sched && (
              <span className={cx(classes.pill, sched.strict ? classes.red : classes.blue)}>
                <span className={classes.pdot} />
                {sched.label}
                {sched.strict ? " · register" : ""}
              </span>
            )}
            {drug.controlled && (
              <span className={cx(classes.pill, classes.red)}>
                <span className={classes.pdot} />
                NDPS controlled
              </span>
            )}
            {drug.aware && (
              <span
                className={cx(classes.pill, drug.aware === "Access" ? classes.green : classes.blue)}
              >
                <span className={classes.pdot} />
                AWaRe · {drug.aware}
              </span>
            )}
            {drug.lasa && (
              <span className={cx(classes.pill, classes.blue)}>
                <span className={classes.pdot} />
                LASA — confirm name
              </span>
            )}
          </Group>
        )}

        {allergyMatch && (
          <Group gap="sm" wrap="nowrap" align="flex-start" className={classes.allergyBlock}>
            <span className={classes.abIc}>!</span>
            <Box className={classes.abTxt}>
              <b>Allergy on file — {allergyMatch}</b>
              <span>
                {patientName} has a recorded allergy to {allergyMatch}. Review before prescribing{" "}
                {drug.name}.
              </span>
            </Box>
            <Group gap="xs" className={classes.abActions}>
              <Button tone="subtle-danger" size="xs" onClick={() => setOverride((o) => !o)}>
                {override ? "re-block" : "override"}
              </Button>
            </Group>
          </Group>
        )}
        {caution && !allergyMatch && (
          <Group
            gap="sm"
            wrap="nowrap"
            align="flex-start"
            className={cx(classes.allergyBlock, classes.amber)}
          >
            <span className={classes.abIc}>!</span>
            <Box className={classes.abTxt}>
              <b>Cross-reactivity caution</b>
              <span>Recorded allergy may cross-react with {drug.cls}. Confirm tolerance.</span>
            </Box>
          </Group>
        )}
        {nurseGate && (
          <Group
            gap="sm"
            wrap="nowrap"
            align="flex-start"
            className={cx(classes.allergyBlock, classes.amber)}
          >
            <span className={classes.abIc}>⊘</span>
            <Box className={classes.abTxt}>
              <b>Outside nurse scope</b>
              <span>
                {drug.cls} is prescription-only. A nurse may draft it, but it routes to a doctor for
                sign-off.
              </span>
            </Box>
          </Group>
        )}

        <DoseField value={strength} strengths={drug.strengths} onChange={setStrength} />

        <Stack gap={6} className={classes.fg}>
          <span className={classes.fgLbl}>
            Schedule {!sos && `· ${dosesFreqCode(doses, false)}`}
          </span>
          <Group gap="xs" className={classes.slotQuick}>
            {SLOTS.map((s) => {
              const on = doses.some((d) => d.key === s.key);
              return (
                <Chip
                  key={s.key}
                  checked={on}
                  disabled={sos}
                  onChange={() => toggleSlot(s)}
                  variant="outline"
                  size="xs"
                  classNames={{ label: classes.chip }}
                >
                  {s.label}
                </Chip>
              );
            })}
            <Button
              tone="ghost"
              size="xs"
              disabled={sos || doses.length >= MAX_DOSES}
              onClick={addCustom}
            >
              + time
            </Button>
          </Group>
          {!sos && doses.length > 0 && (
            <Stack gap={6} className={classes.doseTimes}>
              {doses.map((d, i) => (
                <Group gap="xs" wrap="nowrap" className={classes.doseTimeRow} key={d.key}>
                  <span className={classes.dtrLabel}>{d.label}</span>
                  <Input
                    type="time"
                    value={d.time}
                    onChange={(e) => setTime(i, e.currentTarget.value)}
                    aria-label={`${d.label} time`}
                    size="xs"
                  />
                  <span className={classes.dtr12}>{fmt12(d.time)}</span>
                  <IconButton
                    className={classes.dtrRm}
                    tone="danger"
                    onClick={() => removeDose(i)}
                    aria-label="remove dose"
                    size="xs"
                  >
                    <IconX size={13} stroke={1.8} />
                  </IconButton>
                </Group>
              ))}
            </Stack>
          )}
          {!sos && doses.length >= MAX_DOSES && (
            <Box className={classes.doseCap}>
              Max {MAX_DOSES} doses — keeps the printed chart clean.
            </Box>
          )}
          {noDoses && (
            <Box className={cx(classes.doseCap, classes.red)}>
              Add at least one time, or mark SOS.
            </Box>
          )}
          <Checkbox
            className={classes.sosRow}
            checked={sos}
            onChange={(e) => setSos(e.currentTarget.checked)}
            label="SOS — as needed (PRN)"
          />
        </Stack>

        {!sos && (
          <Stack gap={6} className={classes.fg}>
            <span className={classes.fgLbl}>Repeat · {repeatLabel(repeat)}</span>
            <SegmentedControl
              className={classes.cadSeg}
              fullWidth
              value={repeat.type}
              onChange={(v) => setCad(v as Repeat["type"])}
              data={CADENCE.map((c) => ({ value: c.v, label: c.label }))}
            />
            {repeat.type === "interval" && (
              <Group gap="xs" className={classes.cadSub}>
                <span>every</span>
                <NumberField
                  aria-label="interval in days"
                  min={2}
                  max={90}
                  value={repeat.everyN || 2}
                  onChange={(v) =>
                    setRepeat((r) => ({ ...r, everyN: Math.max(2, Number(v) || 2) }))
                  }
                  w={88}
                />
                <span>days</span>
              </Group>
            )}
            {(repeat.type === "days" || repeat.type === "weekly") && (
              <Group gap="xs" className={classes.weekdayRow}>
                {WEEK.map((w, i) => {
                  const dn = i + 1;
                  const on = (repeat.days || []).includes(dn);
                  return (
                    <Chip
                      key={w}
                      checked={on}
                      onChange={() => toggleWeekday(dn)}
                      variant="outline"
                      size="xs"
                      classNames={{ label: cx(classes.chip, classes.wd) }}
                    >
                      {w}
                    </Chip>
                  );
                })}
              </Group>
            )}
            {repeat.type === "monthly" && (
              <Group gap="xs" className={classes.cadSub}>
                <span>on day</span>
                <NumberField
                  aria-label="day of month"
                  min={1}
                  max={31}
                  value={repeat.dom || 1}
                  onChange={(v) =>
                    setRepeat((r) => ({ ...r, dom: Math.min(31, Math.max(1, Number(v) || 1)) }))
                  }
                  w={88}
                />
                <span>of each month</span>
              </Group>
            )}
          </Stack>
        )}

        <SimpleGrid cols={2} spacing="md" className={classes.fg2col}>
          <Stack gap={6} className={classes.fg}>
            <span className={classes.fgLbl}>Route</span>
            <Select
              aria-label="Route"
              value={route}
              onChange={(v) => v && setRoute(v as Route)}
              data={ROUTES.map((r) => ({ value: r.v, label: r.label }))}
              allowDeselect={false}
            />
          </Stack>
          <Stack gap={6} className={classes.fg}>
            <span className={classes.fgLbl}>{sos ? "Dispense up to" : "Duration"}</span>
            <Group gap="sm" className={classes.durRow}>
              <NumberField
                aria-label="duration in days"
                min={1}
                max={365}
                value={days}
                disabled={ongoing}
                onChange={(v) => {
                  setOngoing(false);
                  setDays(Math.max(1, Number(v) || 1));
                }}
                suffix={days > 1 ? " days" : " day"}
                w={120}
              />
              <Checkbox
                checked={ongoing}
                onChange={(e) => setOngoing(e.currentTarget.checked)}
                label="ongoing"
              />
            </Group>
          </Stack>
        </SimpleGrid>

        <SimpleGrid cols={2} spacing="md" className={classes.fg2col}>
          <Stack gap={6} className={classes.fg}>
            <span className={classes.fgLbl}>{sos ? "Condition" : "Timing"}</span>
            {sos ? (
              <Input
                aria-label="Condition"
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
                placeholder="e.g. if temp > 38°C"
              />
            ) : (
              <Select
                aria-label="Timing"
                value={food}
                onChange={(v) => v && setFood(v)}
                data={FOODS}
                allowDeselect={false}
              />
            )}
          </Stack>
          <Stack gap={6} className={classes.fg}>
            <span className={classes.fgLbl}>Brand</span>
            <Select
              aria-label="Brand"
              value={brand}
              onChange={(v) => v && setBrand(v)}
              data={drug.brands}
              allowDeselect={false}
            />
          </Stack>
        </SimpleGrid>

        {!sos && (
          <Stack gap={6} className={classes.fg}>
            <span className={classes.fgLbl}>Note to patient (optional)</span>
            <Input
              aria-label="Note to patient"
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
              placeholder="e.g. complete the full course"
            />
          </Stack>
        )}
      </Stack>

      <Group justify="space-between" wrap="nowrap" className={classes.composeFoot}>
        <span className={classes.cfHint}>
          {drug.salt} · {brand}
          {drug.atc ? ` · ${drug.atc}` : ""}
        </span>
        <Group gap="xs" className={classes.cfBtns}>
          <Button tone="ghost" size="xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button tone="primary" size="xs" disabled={blocked || noDoses} onClick={save}>
            {init ? "Save changes" : nurseGate ? "Add · route to MD" : "Add to prescription"}
          </Button>
        </Group>
      </Group>
    </Box>
  );
}
