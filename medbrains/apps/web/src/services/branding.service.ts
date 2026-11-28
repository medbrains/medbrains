import { brandingApi } from "@medbrains/api/modules/branding";

/** The hospital's marks for the header: emblem, name banner and display name. */
export const brandingService = {
  getBrandingMarks: () => brandingApi.getBrandingMarks(),
};
