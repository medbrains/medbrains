/**
 * Assigning a barcode to a specimen tube.
 *
 * A mislabelled specimen is the commonest serious error in phlebotomy: the
 * result is correct for the tube and wrong for the patient it gets filed
 * against, and nothing downstream can detect it. Everything here exists to make
 * that harder.
 */

export interface Specimen {
  sampleId: string;
  barcode: string;
  collected: boolean;
}

export type AssignOutcome = { ok: true; samples: Specimen[] } | { ok: false; reason: string };

/**
 * Assign to the tube the user is actually labelling.
 *
 * The previous behaviour picked the first uncollected sample, so scanning the
 * third tube recorded against the first. That is precisely the swap this step
 * is supposed to prevent, so the target is explicit.
 *
 * A barcode already on another tube is refused. Two specimens carrying one
 * label means one of them is mislabelled, and there is no way to tell which
 * afterwards.
 */
export function assignBarcode(
  samples: ReadonlyArray<Specimen>,
  sampleId: string,
  barcode: string,
): AssignOutcome {
  const code = barcode.trim();
  if (code === "") {
    return { ok: false, reason: "That label could not be read. Try again." };
  }

  const target = samples.find((s) => s.sampleId === sampleId);
  if (!target) {
    return { ok: false, reason: "That tube is no longer on this collection." };
  }

  const clash = samples.find((s) => s.sampleId !== sampleId && s.barcode === code);
  if (clash) {
    return {
      ok: false,
      reason:
        "That label is already on another tube in this collection. Two tubes cannot share a label — check which one you are holding.",
    };
  }

  return {
    ok: true,
    samples: samples.map((s) =>
      s.sampleId === sampleId ? { ...s, barcode: code, collected: true } : s,
    ),
  };
}

/** Every tube needs its own label before the collection can be closed. */
export function canComplete(samples: ReadonlyArray<Specimen>): boolean {
  return samples.length > 0 && samples.every((s) => s.collected && s.barcode.trim() !== "");
}

export function unlabelledCount(samples: ReadonlyArray<Specimen>): number {
  return samples.filter((s) => !s.collected || s.barcode.trim() === "").length;
}

/**
 * The barcode that stands for the whole order.
 *
 * `lab_orders.sample_barcode` is one column and one order is one test, so a
 * draw sends exactly one label back however many tubes this screen collected.
 * The first labelled tube wins, in the order the phlebotomist created them,
 * because that is the one they drew first.
 *
 * Extra tubes are not lost by choice -- there is nowhere to record them yet.
 * When the schema grows a per-specimen row this returns a list instead.
 */
export function primaryBarcode(samples: ReadonlyArray<Specimen>): string | undefined {
  return samples.find((s) => s.barcode.trim() !== "")?.barcode.trim();
}
