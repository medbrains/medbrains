import { P } from "@medbrains/types";
import { REPORT_FAMILIES } from "./report-catalog";

/**
 * Anyone who may read at least one report opens the reports page; the
 * server's catalog then lists only the reports they may read. Guarding the
 * page on analytics.view alone shut out roles whose reports are gated on
 * their own permission (marketing reads the acquisition family with
 * marketing.campaigns.view).
 */
export const REPORT_READERS: readonly string[] = Array.from(
  new Set([
    ...REPORT_FAMILIES.flatMap((family) => family.reports.flatMap((report) => report.permissions)),
    P.MARKETING.CAMPAIGNS_VIEW,
  ]),
);
