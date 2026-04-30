/**
 * Module registry — every Module a user might see is declared here.
 * The shell filters this list against the user's effective
 * permissions before rendering the navigator.
 */

import type { Module } from "@medbrains/mobile-shell";
import { bmeAmcModule } from "./bme-amc";


export const MODULES: ReadonlyArray<Module> = [
  bmeAmcModule,

];
