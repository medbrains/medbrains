/** The `/branding` API area: the hospital's marks every staff role sees. */
import type { BrandingMarks } from "@medbrains/types";
import { request } from "../client.js";

export const brandingApi = {
  getBrandingMarks: () => request<BrandingMarks>("/branding/marks"),
};
