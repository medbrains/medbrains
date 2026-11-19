/** The `/clinical` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AldreteRequest,
  AldreteResult,
  AnionGapRequest,
  AnionGapResult,
  CamIcuRequest,
  CamIcuResult,
  Cha2ds2VascRequest,
  Cha2ds2VascResult,
  ChildPughRequest,
  ChildPughResult,
  CiwaArRequest,
  CiwaArResult,
  CpotRequest,
  CpotResult,
  CreateHypoglycemiaRequest,
  CreateMedReconciliationRequest,
  CreateNutritionScreeningRequest,
  CreateSepsisBundleRequest,
  Curb65Request,
  Curb65Result,
  DecideItemRequest,
  GcsRequest,
  GcsResult,
  GlasgowBlatchfordRequest,
  GlasgowBlatchfordResult,
  HasBledRequest,
  HasBledResult,
  HypoglycemiaRecheckRequest,
  HypoglycemiaView,
  LungProtectiveRequest,
  LungProtectiveResult,
  MedReconciliationItem,
  MedReconciliationView,
  MeldRequest,
  MeldResult,
  MeowsRequest,
  MeowsResult,
  News2Request,
  News2Result,
  NutritionScreening,
  OsmolarGapRequest,
  OsmolarGapResult,
  PaediatricFluidRequest,
  PaediatricFluidResult,
  PewsRequest,
  PewsResult,
  QsofaRequest,
  QsofaResult,
  SepsisBundleView,
  SofaRequest,
  SofaResult,
  UpdateSepsisBundleRequest,
  WellsDvtRequest,
  WellsDvtResult,
  WellsPeRequest,
  WellsPeResult,
} from "@medbrains/types";
import { request } from "../client.js";

export const clinicalApi = {
  lungProtective: (data: LungProtectiveRequest) =>
    request<LungProtectiveResult>("/clinical/lung-protective", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  computeNews2: (data: News2Request) =>
    request<News2Result>("/clinical/news2", { method: "POST", body: JSON.stringify(data) }),
  computeAldrete: (data: AldreteRequest) =>
    request<AldreteResult>("/clinical/aldrete", { method: "POST", body: JSON.stringify(data) }),
  computeGcs: (data: GcsRequest) =>
    request<GcsResult>("/clinical/gcs", { method: "POST", body: JSON.stringify(data) }),
  computeQsofa: (data: QsofaRequest) =>
    request<QsofaResult>("/clinical/qsofa", { method: "POST", body: JSON.stringify(data) }),
  computeMeows: (data: MeowsRequest) =>
    request<MeowsResult>("/clinical/meows", { method: "POST", body: JSON.stringify(data) }),
  computePews: (data: PewsRequest) =>
    request<PewsResult>("/clinical/pews", { method: "POST", body: JSON.stringify(data) }),
  computeCamIcu: (data: CamIcuRequest) =>
    request<CamIcuResult>("/clinical/cam-icu", { method: "POST", body: JSON.stringify(data) }),
  computeCpot: (data: CpotRequest) =>
    request<CpotResult>("/clinical/cpot", { method: "POST", body: JSON.stringify(data) }),
  computeWellsPe: (data: WellsPeRequest) =>
    request<WellsPeResult>("/clinical/wells-pe", { method: "POST", body: JSON.stringify(data) }),
  computeWellsDvt: (data: WellsDvtRequest) =>
    request<WellsDvtResult>("/clinical/wells-dvt", { method: "POST", body: JSON.stringify(data) }),
  computeCha2ds2Vasc: (data: Cha2ds2VascRequest) =>
    request<Cha2ds2VascResult>("/clinical/cha2ds2-vasc", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  computeHasBled: (data: HasBledRequest) =>
    request<HasBledResult>("/clinical/has-bled", { method: "POST", body: JSON.stringify(data) }),
  computeCiwaAr: (data: CiwaArRequest) =>
    request<CiwaArResult>("/clinical/ciwa-ar", { method: "POST", body: JSON.stringify(data) }),
  computeChildPugh: (data: ChildPughRequest) =>
    request<ChildPughResult>("/clinical/child-pugh", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  computeSofa: (data: SofaRequest) =>
    request<SofaResult>("/clinical/sofa", { method: "POST", body: JSON.stringify(data) }),
  computeMeld: (data: MeldRequest) =>
    request<MeldResult>("/clinical/meld", { method: "POST", body: JSON.stringify(data) }),
  computeCurb65: (data: Curb65Request) =>
    request<Curb65Result>("/clinical/curb-65", { method: "POST", body: JSON.stringify(data) }),
  computeGlasgowBlatchford: (data: GlasgowBlatchfordRequest) =>
    request<GlasgowBlatchfordResult>("/clinical/glasgow-blatchford", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  computePaediatricFluid: (data: PaediatricFluidRequest) =>
    request<PaediatricFluidResult>("/clinical/paediatric-fluid", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  computeAnionGap: (data: AnionGapRequest) =>
    request<AnionGapResult>("/clinical/anion-gap", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  computeOsmolarGap: (data: OsmolarGapRequest) =>
    request<OsmolarGapResult>("/clinical/osmolar-gap", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createNutritionScreening: (data: CreateNutritionScreeningRequest) =>
    request<NutritionScreening>("/clinical/nutrition-screening", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listNutritionScreenings: (patientId: string) =>
    request<NutritionScreening[]>(`/clinical/nutrition-screenings?patient_id=${patientId}`),
  createHypoglycemiaEvent: (data: CreateHypoglycemiaRequest) =>
    request<HypoglycemiaView>("/clinical/hypoglycemia-event", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  recheckHypoglycemiaEvent: (id: string, data: HypoglycemiaRecheckRequest) =>
    request<HypoglycemiaView>(`/clinical/hypoglycemia-event/${id}/recheck`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  listHypoglycemiaEvents: (patientId: string) =>
    request<HypoglycemiaView[]>(`/clinical/hypoglycemia-events?patient_id=${patientId}`),
  createSepsisBundle: (data: CreateSepsisBundleRequest) =>
    request<SepsisBundleView>("/clinical/sepsis-bundle", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSepsisBundle: (id: string, data: UpdateSepsisBundleRequest) =>
    request<SepsisBundleView>(`/clinical/sepsis-bundle/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  listSepsisBundles: (patientId: string) =>
    request<SepsisBundleView[]>(`/clinical/sepsis-bundles?patient_id=${patientId}`),
  createMedReconciliation: (data: CreateMedReconciliationRequest) =>
    request<MedReconciliationView>("/clinical/med-reconciliation", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  decideMedItem: (id: string, data: DecideItemRequest) =>
    request<MedReconciliationItem>(`/clinical/med-reconciliation-item/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  completeMedReconciliation: (id: string) =>
    request<MedReconciliationView>(`/clinical/med-reconciliation/${id}/complete`, {
      method: "POST",
    }),
  listMedReconciliations: (patientId: string) =>
    request<MedReconciliationView[]>(`/clinical/med-reconciliations?patient_id=${patientId}`),

  // ── Clinical offline-mode REST adapters (Phase 7) ───────────────────
  // Mirror endpoints for the 4 CRDT hooks. Same data the edge node
  // holds in Loro containers — used when the tenant is in REST mode.

  listClinicalHandoffEntries: (shiftId: string) =>
    request<
      Array<{
        id: string;
        shift_id: string;
        author_user_id: string;
        author_name: string;
        category: "alert" | "info" | "task";
        note: string;
        authored_at: string;
      }>
    >(`/clinical/handoff-entries/shifts/${encodeURIComponent(shiftId)}`),
  createClinicalHandoffEntry: (
    shiftId: string,
    data: { category: "alert" | "info" | "task"; note: string; department_id?: string },
  ) =>
    request<{
      id: string;
      shift_id: string;
      author_user_id: string;
      author_name: string;
      category: "alert" | "info" | "task";
      note: string;
      authored_at: string;
    }>(`/clinical/handoff-entries/shifts/${encodeURIComponent(shiftId)}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listClinicalTriageEntries: (visitId: string) =>
    request<
      Array<{
        id: string;
        er_visit_id: string;
        author_user_id: string;
        author_name: string;
        esi_level: 1 | 2 | 3 | 4 | 5;
        chief_complaint: string;
        observation: string;
        authored_at: string;
      }>
    >(`/clinical/triage-entries/visits/${visitId}`),
  createClinicalTriageEntry: (
    visitId: string,
    data: { esi_level: 1 | 2 | 3 | 4 | 5; chief_complaint: string; observation?: string },
  ) =>
    request<{
      id: string;
      er_visit_id: string;
      author_user_id: string;
      author_name: string;
      esi_level: 1 | 2 | 3 | 4 | 5;
      chief_complaint: string;
      observation: string;
      authored_at: string;
    }>(`/clinical/triage-entries/visits/${visitId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPatientNotes: (patientId: string) =>
    request<{
      patient_id: string;
      text: string;
      last_author_id: string | null;
      last_author_name: string | null;
      last_edited_at: string | null;
      version: number;
    }>(`/clinical/patient-notes/${patientId}`),
  updatePatientNotes: (patientId: string, data: { text: string; if_version?: number }) =>
    request<{
      patient_id: string;
      text: string;
      last_author_id: string | null;
      last_author_name: string | null;
      last_edited_at: string | null;
      version: number;
    }>(`/clinical/patient-notes/${patientId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getNursingShiftNotes: (shiftId: string) =>
    request<{
      shift_id: string;
      text: string;
      last_author_id: string | null;
      last_author_name: string | null;
      last_edited_at: string | null;
      version: number;
    }>(`/clinical/nursing-shift-notes/${encodeURIComponent(shiftId)}`),
  updateNursingShiftNotes: (
    shiftId: string,
    data: { text: string; department_id?: string; if_version?: number },
  ) =>
    request<{
      shift_id: string;
      text: string;
      last_author_id: string | null;
      last_author_name: string | null;
      last_edited_at: string | null;
      version: number;
    }>(`/clinical/nursing-shift-notes/${encodeURIComponent(shiftId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
