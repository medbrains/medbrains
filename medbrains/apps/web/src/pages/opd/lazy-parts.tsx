// OPD parts that carry heavy libraries, each fetched the first time it renders: the encounter
// (every clinical tab) is not needed by the queue, Vitals pulls the CRDT engine (loro, a 3.6 MB
// wasm) and Charts pulls recharts.

import { Loader } from "@mantine/core";
import { type ComponentProps, lazy, Suspense } from "react";
import type { EncounterDetail as EncounterDetailComponent } from "./encounter-detail";
import type { ChartsTab as ChartsTabComponent } from "./tabs/charts-tab";
import type { VitalsTab as VitalsTabComponent } from "./vitals";

const Encounter = lazy(() =>
  import("./encounter-detail").then((m) => ({ default: m.EncounterDetail })),
);
const Vitals = lazy(() => import("./vitals").then((m) => ({ default: m.VitalsTab })));
const Charts = lazy(() => import("./tabs/charts-tab").then((m) => ({ default: m.ChartsTab })));

/** The OPD encounter, loaded when one is opened. */
export function EncounterDetail(props: ComponentProps<typeof EncounterDetailComponent>) {
  return (
    <Suspense fallback={<Loader />}>
      <Encounter {...props} />
    </Suspense>
  );
}

/** The encounter's Vitals tab, loaded when it opens. */
export function VitalsTab(props: ComponentProps<typeof VitalsTabComponent>) {
  return (
    <Suspense fallback={<Loader size="sm" />}>
      <Vitals {...props} />
    </Suspense>
  );
}

/** The encounter's Charts tab, loaded when it opens. */
export function ChartsTab(props: ComponentProps<typeof ChartsTabComponent>) {
  return (
    <Suspense fallback={<Loader size="sm" />}>
      <Charts {...props} />
    </Suspense>
  );
}
