/** The `/documents` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AddDocumentSignatureRequest,
  BatchGenerateRequest,
  CreateDocumentTemplateRequest,
  CreatePrinterRequest,
  CreateReviewScheduleRequest,
  DeliverablePrintJob,
  DocumentFormReviewSchedule,
  DocumentOutput,
  DocumentOutputSignature,
  DocumentOutputStats,
  DocumentTemplate,
  DocumentTemplateVersion,
  GenerateDocumentRequest,
  MockRenderPrintTemplateRequest,
  MockRenderPrintTemplateResponse,
  PrintEditorCapabilitiesResponse,
  PrinterConfig,
  PrintJob,
  UpdateDocumentTemplateRequest,
  UpdatePrintJobRequest,
  VoidDocumentRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const documentsApi = {
  // ── Documents Module ─────────────────────────────────────

  // Templates
  listDocumentTemplates: (params?: {
    category?: string;
    module_code?: string;
    is_active?: boolean;
  }) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set("category", params.category);
    if (params?.module_code) sp.set("module_code", params.module_code);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<DocumentTemplate[]>(`/documents/templates${qs ? `?${qs}` : ""}`);
  },
  createDocumentTemplate: (data: CreateDocumentTemplateRequest) =>
    request<DocumentTemplate>("/documents/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getDocumentTemplate: (id: string) => request<DocumentTemplate>(`/documents/templates/${id}`),
  updateDocumentTemplate: (id: string, data: UpdateDocumentTemplateRequest) =>
    request<DocumentTemplate>(`/documents/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteDocumentTemplate: (id: string) =>
    request<{ status: string }>(`/documents/templates/${id}`, {
      method: "DELETE",
    }),
  listTemplateVersions: (id: string) =>
    request<DocumentTemplateVersion[]>(`/documents/templates/${id}/versions`),
  listDefaultTemplates: () => request<DocumentTemplate[]>("/documents/templates/defaults"),
  setDefaultTemplate: (id: string) =>
    request<DocumentTemplate>(`/documents/templates/${id}/set-default`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  // Document Generation
  generateDocument: (data: GenerateDocumentRequest) =>
    request<DocumentOutput>("/documents/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  previewDocument: (data: GenerateDocumentRequest) =>
    request<DocumentOutput>("/documents/generate/preview", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  batchGenerateDocuments: (data: BatchGenerateRequest) =>
    request<DocumentOutput[]>("/documents/generate/batch", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Document Outputs
  listDocumentOutputs: (params?: {
    category?: string;
    status?: string;
    patient_id?: string;
    module_code?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set("category", params.category);
    if (params?.status) sp.set("status", params.status);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.module_code) sp.set("module_code", params.module_code);
    const qs = sp.toString();
    return request<DocumentOutput[]>(`/documents/outputs${qs ? `?${qs}` : ""}`);
  },
  getDocumentOutput: (id: string) => request<DocumentOutput>(`/documents/outputs/${id}`),
  recordDocumentPrint: (id: string) =>
    request<DocumentOutput>(`/documents/outputs/${id}/print`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  voidDocumentOutput: (id: string, data: VoidDocumentRequest) =>
    request<DocumentOutput>(`/documents/outputs/${id}/void`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPatientDocumentOutputs: (patientId: string) =>
    request<DocumentOutput[]>(`/documents/outputs/patient/${patientId}`),
  getDocumentOutputStats: () => request<DocumentOutputStats>("/documents/outputs/stats"),

  // Document Signatures
  listDocumentSignatures: (docId: string) =>
    request<DocumentOutputSignature[]>(`/documents/outputs/${docId}/signatures`),
  addDocumentSignature: (docId: string, data: AddDocumentSignatureRequest) =>
    request<DocumentOutputSignature>(`/documents/outputs/${docId}/signatures`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteDocumentSignature: (docId: string, sigId: string) =>
    request<{ status: string }>(`/documents/outputs/${docId}/signatures/${sigId}`, {
      method: "DELETE",
    }),

  // Review Schedule
  listReviewSchedule: (params?: { template_id?: string; review_status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.template_id) sp.set("template_id", params.template_id);
    if (params?.review_status) sp.set("review_status", params.review_status);
    const qs = sp.toString();
    return request<DocumentFormReviewSchedule[]>(`/documents/review-schedule${qs ? `?${qs}` : ""}`);
  },
  createReviewSchedule: (data: CreateReviewScheduleRequest) =>
    request<DocumentFormReviewSchedule>("/documents/review-schedule", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  markReviewed: (id: string) =>
    request<DocumentFormReviewSchedule>(`/documents/review-schedule/${id}`, {
      method: "PUT",
      body: JSON.stringify({}),
    }),

  // Printers & Print Jobs
  listPrinters: () => request<PrinterConfig[]>("/documents/printers"),
  createPrinter: (data: CreatePrinterRequest) =>
    request<PrinterConfig>("/documents/printers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Retire a printer (it stops receiving jobs) or bring it back. */
  setPrinterActive: (id: string, isActive: boolean) =>
    request<PrinterConfig>(`/documents/printers/${id}/active`, {
      method: "PUT",
      body: JSON.stringify({ is_active: isActive }),
    }),
  listPrintJobs: () => request<PrintJob[]>("/documents/print-jobs"),
  updatePrintJob: (id: string, data: UpdatePrintJobRequest) =>
    request<PrintJob>(`/documents/print-jobs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getPrintEditorCapabilities: () =>
    request<PrintEditorCapabilitiesResponse>("/documents/print-editor/capabilities"),
  mockRenderPrintTemplate: (data: MockRenderPrintTemplateRequest) =>
    request<MockRenderPrintTemplateResponse>("/documents/print-editor/mock-render", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // ── Server-side document rendering (epic #267) ──
  renderDocument: (data: { template_code: string; source_id: string; watermark?: string }) =>
    request<{ document_output_id: string; file_key: string; download_url: string }>(
      "/documents/render",
      { method: "POST", body: JSON.stringify(data) },
    ),
  /** Send a rendered document to a printer — the one named, else the best match. */
  queueDocumentPrint: (id: string, data: { printer_id?: string; copies?: number }) =>
    request<{ print_job_id: string; status: string; printer_name: string }>(
      `/documents/${id}/queue-print`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  /** A site bridge takes queued jobs, each rendered for its printer. */
  claimPrintJobs: (data: { printer_ids?: string[] }) =>
    request<DeliverablePrintJob[]>("/documents/print-jobs/claim", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** A site bridge reports a job printed (no error) or failed. */
  reportPrintJobResult: (id: string, data: { error?: string | null }) =>
    request<{ status: string }>(`/documents/print-jobs/${id}/result`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listRenderTemplates: () =>
    request<{
      templates: {
        code: string;
        title: string;
        module_code: string;
        paper_mm: { width: number; height: number };
        has_override: boolean;
        default_html: string;
      }[];
    }>("/documents/render/templates"),
  saveRenderTemplate: (code: string, data: { html: string | null }) =>
    request<{ status: string }>(`/documents/render/templates/${code}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
