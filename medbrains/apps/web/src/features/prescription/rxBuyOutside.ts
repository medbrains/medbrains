import { type RxItem, SLOTS } from "./rxModel";

/** What a buy-outside line says on the printed prescription. */
export const BUY_OUTSIDE_PRINT = "Buy from outside the hospital";

/**
 * A line the prescriber chose to have bought outside: the typed name and
 * strength, the dose, once in the morning for five days (edited on the row
 * like any line). Its id is a local key, never a catalogue id.
 */
export function buyOutsideItem(
  uid: number,
  line: { name: string; strength: string; dose: string },
): RxItem {
  const name = [line.name.trim(), line.strength.trim()].filter(Boolean).join(" ");
  const morning = SLOTS[0];
  return {
    uid,
    id: `outside-${uid}`,
    name,
    form: "",
    strength: line.dose.trim(),
    brand: name,
    doses: [{ key: morning.key, label: morning.label, time: morning.def }],
    sos: false,
    repeat: { type: "daily" },
    days: 5,
    ongoing: false,
    food: "after food",
    route: "oral",
    note: "",
    buyOutside: true,
  };
}
