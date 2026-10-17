import { P } from "@medbrains/types";

/**
 * Who may open Medical Records: anyone holding one of its sections. The menu
 * entry and the page guard both read this, so a role the page admits (a
 * doctor reading case sheets) also finds it in the menu.
 */
export const MRD_PAGE_PERMISSIONS = [
  P.MRD.RECORDS_LIST,
  P.MRD.RECORDS_MANAGE,
  P.MRD.CASE_SHEETS_VIEW,
  P.MRD.BIRTHS_LIST,
  P.MRD.DEATHS_LIST,
] as const;
