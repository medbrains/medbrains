/**
 * Clinical terminology facade for mobile staff screens. ICD-11 is the
 * default diagnosis coding path; SNOMED can be enabled later through the
 * same terminology endpoint.
 */

import type { SearchTerminologyParams, TerminologySearchResult } from "@medbrains/types";
import { request } from "./client.js";
import { apiConfig } from "./config.js";

export async function searchTerminology(
  params: SearchTerminologyParams,
): Promise<TerminologySearchResult[]> {
  const qs = new URLSearchParams();
  qs.set("system", params.system);
  qs.set("q", params.q);
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.semantic_tag) qs.set("semantic_tag", params.semantic_tag);
  return request<TerminologySearchResult[]>(apiConfig, "GET", `/api/terminology/search?${qs}`);
}
