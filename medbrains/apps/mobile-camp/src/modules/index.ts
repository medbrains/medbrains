/**
 * Camp app module registry.
 *
 * This app is purpose-built for outreach camps, so the shell renders
 * only Camp Mode instead of the full staff module list.
 */

import type { Module } from "@medbrains/mobile-shell";
import { campModule } from "./camp";

export const MODULES: ReadonlyArray<Module> = [campModule];
