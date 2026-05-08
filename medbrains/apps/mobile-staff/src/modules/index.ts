/**
 * Module registry — every Module a user might see is declared here.
 * The shell filters this list against the user's effective
 * permissions before rendering the navigator.
 */

import type { Module } from "@medbrains/mobile-shell";
import { billingModule } from "./billing";
import { bmeModule } from "./bme";
import { campModule } from "./camp";
import { doctorModule } from "./doctor";
import { facilitiesModule } from "./facilities";
import { housekeepingModule } from "./housekeeping";
import { hrModule } from "./hr";
import { labModule } from "./lab";
import { nurseModule } from "./nurse";
import { pharmacyModule } from "./pharmacy";
import { receptionModule } from "./reception";
import { securityModule } from "./security";

export const MODULES: ReadonlyArray<Module> = [
  campModule,
  doctorModule,
  nurseModule,
  pharmacyModule,
  labModule,
  billingModule,
  bmeModule,
  facilitiesModule,
  housekeepingModule,
  securityModule,
  hrModule,
  receptionModule,
];
