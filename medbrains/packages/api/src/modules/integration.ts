/** The `/integration` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AiGenerateCodeRequest,
  AiGeneratedCode,
  CodeTestRequest,
  CodeTestResult,
  CompileRustRequest,
  CompileRustResult,
  CreatePipelineRequest,
  CustomCodeSnippet,
  ExecutionListResponse,
  IntegrationExecution,
  IntegrationNodeTemplate,
  IntegrationPipeline,
  PipelineListResponse,
  TriggerPipelineRequest,
  UpdatePipelineRequest,
  UpdatePipelineStatusRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const integrationApi = {
  // ── Integration Hub ────────────────────────────────────

  /**
   * Built-in (Rust hardcoded) default pipelines, with this tenant's
   * enable/disable state. The list itself is code and cannot be edited here;
   * which of them run for this hospital can be, via
   * {@link setDefaultPipelineEnabled}.
   */
  listDefaultPipelines: () =>
    request<
      Array<{
        event_type: string;
        description: string;
        disabled_for_tenant: boolean;
      }>
    >("/integration/default-pipelines"),

  /** Clinical events this hospital has raised that no pipeline listens to. */
  listUncoveredEvents: () =>
    request<
      Array<{
        event_type: string;
        fired: number;
        last_fired: string | null;
      }>
    >("/integration/uncovered-events"),

  /** Turn one built-in pipeline on or off for this hospital. */
  setDefaultPipelineEnabled: (eventType: string, disabled: boolean) =>
    request<{
      event_type: string;
      description: string;
      disabled_for_tenant: boolean;
    }>(`/integration/default-pipelines/${encodeURIComponent(eventType)}`, {
      method: "PUT",
      body: JSON.stringify({ disabled }),
    }),

  listPipelines: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PipelineListResponse>(`/integration/pipelines${qs}`);
  },
  createPipeline: (data: CreatePipelineRequest) =>
    request<IntegrationPipeline>("/integration/pipelines", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPipeline: (id: string) => request<IntegrationPipeline>(`/integration/pipelines/${id}`),
  updatePipeline: (id: string, data: UpdatePipelineRequest) =>
    request<IntegrationPipeline>(`/integration/pipelines/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePipeline: (id: string) =>
    request<void>(`/integration/pipelines/${id}`, { method: "DELETE" }),
  updatePipelineStatus: (id: string, data: UpdatePipelineStatusRequest) =>
    request<IntegrationPipeline>(`/integration/pipelines/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  triggerPipeline: (id: string, data?: TriggerPipelineRequest) =>
    request<IntegrationExecution>(`/integration/pipelines/${id}/trigger`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  listPipelineExecutions: (pipelineId: string, params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<ExecutionListResponse>(`/integration/pipelines/${pipelineId}/executions${qs}`);
  },
  getExecution: (id: string) => request<IntegrationExecution>(`/integration/executions/${id}`),
  listNodeTemplates: () => request<IntegrationNodeTemplate[]>("/integration/node-templates"),
  createNodeTemplate: (data: Record<string, unknown>) =>
    request<IntegrationNodeTemplate>("/integration/node-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Custom Code (Pipeline Code Execution) ───────────────

  listCodeSnippets: () => request<CustomCodeSnippet[]>("/integration/code-snippets"),

  createCodeSnippet: (data: {
    name: string;
    language: string;
    code: string;
    description?: string;
    input_schema?: Record<string, unknown>;
    output_schema?: Record<string, unknown>;
  }) =>
    request<CustomCodeSnippet>("/integration/code-snippets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCodeSnippet: (
    id: string,
    data: Partial<{
      name: string;
      language: string;
      code: string;
      description: string;
      input_schema: Record<string, unknown>;
      output_schema: Record<string, unknown>;
    }>,
  ) =>
    request<CustomCodeSnippet>(`/integration/code-snippets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  testCode: (data: CodeTestRequest) =>
    request<CodeTestResult>("/integration/code-snippets/test", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  compileRust: (data: CompileRustRequest) =>
    request<CompileRustResult>("/integration/code/compile-rust", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  aiGenerateCode: (data: AiGenerateCodeRequest) =>
    request<AiGeneratedCode>("/integration/code/ai-generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getIntegrationCodeSnippet: (id: string) => request<unknown>(`/integration/code-snippets/${id}`),
};
