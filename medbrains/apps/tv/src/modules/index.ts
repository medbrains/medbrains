/**
 * Module registry — every Module a user might see is declared here.
 * The shell filters this list against the user's effective
 * permissions before rendering the navigator.
 */

import type { Module } from "@medbrains/mobile-shell";
import { bedStatusModule } from "./bed-status";
import { billingQueueModule } from "./billing-queue";
import { digitalSignageModule } from "./digital-signage";
import { emergencyTriageModule } from "./emergency-triage";
import { labStatusModule } from "./lab-status";
import { pharmacyQueueModule } from "./pharmacy-queue";
import { queueModule } from "./queue";

export const MODULES: ReadonlyArray<Module> = [
  queueModule,
  bedStatusModule,
  labStatusModule,
  emergencyTriageModule,
  pharmacyQueueModule,
  billingQueueModule,
  digitalSignageModule,
];
