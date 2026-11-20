/** The `/terminology` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  DiagnosisCodingStatus,
  Icd10ImportResult,
  Icd10Release,
  ImportIcd10Request,
  LookupTerminologyParams,
  SearchTerminologyParams,
  SetDiagnosisCodingRequest,
  SnomedConceptCount,
  SnomedConceptDetail,
  SnomedEclResult,
  SnomedHierarchyResponse,
  SnomedImportFiles,
  SnomedImportStarted,
  SnomedRelease,
  SnomedRollup,
  SnomedSearchParams,
  SnomedSearchResponse,
  SnomedStatus,
  SnomedSubsumption,
  TerminologySearchResponse,
  TerminologySearchResult,
} from "@medbrains/types";
import { request } from "../client.js";

export const terminologyApi = {
  // ── Terminology Service (official-source facade) ───────
  searchTerminology: (params: SearchTerminologyParams) => {
    const qs = new URLSearchParams();
    qs.set("system", params.system);
    qs.set("q", params.q);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.semantic_tag) qs.set("semantic_tag", params.semantic_tag);
    return request<TerminologySearchResult[]>(`/terminology/search?${qs}`);
  },
  searchTerminologyWithSuggestions: (params: SearchTerminologyParams) => {
    const qs = new URLSearchParams();
    qs.set("system", params.system);
    qs.set("q", params.q);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.semantic_tag) qs.set("semantic_tag", params.semantic_tag);
    return request<TerminologySearchResponse>(`/terminology/search-with-suggestions?${qs}`);
  },
  lookupTerminology: (params: LookupTerminologyParams) => {
    const qs = new URLSearchParams();
    qs.set("system", params.system);
    qs.set("code", params.code);
    return request<TerminologySearchResult>(`/terminology/lookup?${qs}`);
  },

  // ── Diagnosis coding switch + the hospital's licensed ICD-10 catalogue ──
  getDiagnosisCoding: () => request<DiagnosisCodingStatus>("/terminology/diagnosis-coding"),
  setDiagnosisCoding: (data: SetDiagnosisCodingRequest) =>
    request<DiagnosisCodingStatus>("/terminology/diagnosis-coding", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listIcd10Releases: () => request<Icd10Release[]>("/terminology/icd10/releases"),
  importIcd10Release: (data: ImportIcd10Request) =>
    request<Icd10ImportResult>("/terminology/icd10/releases", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── SNOMED CT store (licensed RF2 releases; every result capped at 50) ──
  getSnomedStatus: () => request<SnomedStatus>("/terminology/snomed/status"),
  searchSnomedConcepts: (params: SnomedSearchParams) => {
    const qs = new URLSearchParams();
    qs.set("q", params.q);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.active_only !== undefined) qs.set("active_only", String(params.active_only));
    if (params.semantic_tag) qs.set("semantic_tag", params.semantic_tag);
    if (params.refset) qs.set("refset", params.refset);
    if (params.lang) qs.set("lang", params.lang);
    return request<SnomedSearchResponse>(`/terminology/snomed/search?${qs}`);
  },
  getSnomedConcept: (conceptId: string) =>
    request<SnomedConceptDetail>(`/terminology/snomed/concepts/${encodeURIComponent(conceptId)}`),
  getSnomedHierarchy: (conceptId: string, direction: "ancestors" | "descendants") =>
    request<SnomedHierarchyResponse>(
      `/terminology/snomed/concepts/${encodeURIComponent(conceptId)}/hierarchy?direction=${direction}`,
    ),
  checkSnomedSubsumption: (sub: string, sup: string) =>
    request<SnomedSubsumption>(
      `/terminology/snomed/subsumes?sub=${encodeURIComponent(sub)}&sup=${encodeURIComponent(sup)}`,
    ),
  evaluateSnomedEcl: (expression: string) =>
    request<SnomedEclResult>(
      `/terminology/snomed/ecl?expression=${encodeURIComponent(expression)}`,
    ),
  countSnomedCodedRecords: (conceptId: string) =>
    request<SnomedConceptCount>(
      `/terminology/snomed/analytics/count?concept=${encodeURIComponent(conceptId)}`,
    ),
  rollupSnomedCodedRecords: (parentId?: string) =>
    request<SnomedRollup>(
      `/terminology/snomed/analytics/rollup${parentId ? `?parent=${encodeURIComponent(parentId)}` : ""}`,
    ),
  listSnomedReleases: () => request<SnomedRelease[]>("/terminology/snomed/releases"),
  getSnomedRelease: (id: string) => request<SnomedRelease>(`/terminology/snomed/releases/${id}`),
  uploadSnomedRelease: (file: File) =>
    request<SnomedImportStarted>("/terminology/snomed/releases/upload", {
      method: "POST",
      body: file,
      headers: { "Content-Type": "application/zip", "X-File-Name": file.name },
    }),
  listSnomedImportFiles: () => request<SnomedImportFiles>("/terminology/snomed/import-files"),
  importSnomedReleaseFromPath: (fileName: string) =>
    request<SnomedImportStarted>("/terminology/snomed/releases/import-path", {
      method: "POST",
      body: JSON.stringify({ file_name: fileName }),
    }),
};
