/**
 * Module registry — every Module a user might see is declared here.
 * The shell filters this list against the user's effective
 * permissions before rendering the navigator.
 */

import type { Module } from "@medbrains/mobile-shell";
import { queueModule } from "./queue";
import { bedStatusModule } from "./bed-status";
import { labStatusModule } from "./lab-status";
import { emergencyTriageModule } from "./emergency-triage";
import { pharmacyQueueModule } from "./pharmacy-queue";
import { digitalSignageModule } from "./digital-signage";


export const MODULES: ReadonlyArray<Module> = [
  queueModule,
  bedStatusModule,
  labStatusModule,
  emergencyTriageModule,
  pharmacyQueueModule,
  digitalSignageModule,

];
