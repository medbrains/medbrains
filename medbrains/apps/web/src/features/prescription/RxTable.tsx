import { Box, Group } from "@mantine/core";
import { IconPencil, IconX } from "@tabler/icons-react";
import { Table } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton";
import classes from "./prescription.module.scss";
import { dosesFreqCode, type FormularyDrug, type RxItem, repeatLabel } from "./rxModel";

interface Props {
  items: RxItem[];
  formularyById: Record<string, FormularyDrug>;
  showBrand?: boolean;
  showSalt?: boolean;
  showTiming?: boolean;
  showNotes?: boolean;
  onEdit: (uid: number) => void;
  onRemove: (uid: number) => void;
}

/** Compact prescription chart — schedule/AWaRe/LASA badges inline on each row. */
export function RxTable({
  items,
  formularyById,
  showBrand = true,
  showSalt = false,
  showTiming = true,
  showNotes = true,
  onEdit,
  onRemove,
}: Props) {
  return (
    <Table className={classes.rxTable} highlightOnHover={false}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th className={classes.rxTNum}>#</Table.Th>
          <Table.Th>Medication</Table.Th>
          {showBrand && <Table.Th>Brand</Table.Th>}
          <Table.Th>Dose</Table.Th>
          <Table.Th>Schedule</Table.Th>
          <Table.Th>Duration</Table.Th>
          {showTiming && <Table.Th>Timing</Table.Th>}
          {showNotes && <Table.Th>Note</Table.Th>}
          <Table.Th className={classes.r} aria-label="actions" />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((it, i) => {
          const d = formularyById[it.id];
          return (
            <Table.Tr key={it.uid}>
              <Table.Td className={classes.rxTNum}>{String(i + 1).padStart(2, "0")}</Table.Td>
              <Table.Td className={classes.rxTDrug}>
                <b>
                  {it.form}. {it.name}
                </b>
                {d?.schedule === "X" || d?.schedule === "H1" ? (
                  <span className={classes.rxTFlag}>{d.schedule}</span>
                ) : null}
                {d?.controlled && <span className={classes.rxTFlag}>NDPS</span>}
                {d?.aware && <span className={classes.rxTFlag}>{d.aware}</span>}
                {d?.sedative && <span className={classes.rxTFlag}>sedative</span>}
                {it.pendingMD && <span className={classes.rxTFlag}>pending MD</span>}
                {showSalt && d?.salt && <Box className={classes.rxTSalt}>{d.salt}</Box>}
              </Table.Td>
              {showBrand && <Table.Td className={classes.rxTBrand}>{it.brand}</Table.Td>}
              <Table.Td className={classes.rxTDose}>{it.strength}</Table.Td>
              <Table.Td className={classes.rxTFreq}>
                {it.sos ? (
                  "SOS"
                ) : (
                  <>
                    {dosesFreqCode(it.doses, false)}
                    {it.repeat && it.repeat.type !== "daily" && (
                      <span className={classes.rxTCad}>{repeatLabel(it.repeat)}</span>
                    )}
                    <Box className={classes.rxTTimes}>
                      {it.doses.map((dose) => dose.time).join(" · ")}
                    </Box>
                  </>
                )}
              </Table.Td>
              <Table.Td className={classes.rxTDur}>
                {it.ongoing ? "ongoing" : it.sos ? "PRN" : `${it.days} days`}
              </Table.Td>
              {showTiming && (
                <Table.Td className={classes.rxTTiming}>
                  {it.food || (it.sos ? it.note || "—" : "—")}
                </Table.Td>
              )}
              {showNotes && <Table.Td className={classes.rxTNote}>{it.note || "—"}</Table.Td>}
              <Table.Td className={classes.r}>
                <Group gap={4} justify="flex-end" wrap="nowrap" className={classes.rxTActions}>
                  <IconButton
                    aria-label={`Edit ${it.name}`}
                    onClick={() => onEdit(it.uid)}
                    size="sm"
                  >
                    <IconPencil size={15} stroke={1.6} />
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
