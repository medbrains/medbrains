/**
 * The REST client.
 *
 * A factory rather than a singleton: the editor ships as a library, so it
 * cannot assume it is served from the same origin and path as the engine, nor
 * that the host authenticates the way the standalone server does. Both are
 * supplied by whoever mounts it.
 */

import type {
  CredentialSummary,
  CredentialTypeDescription,
  ExecutionSummary,
  Items,
  JsonValue,
  NodeTypeDescription,
  RunResponse,
  StoredCredential,
  StoredExecution,
  StoredVariable,
  StoredVersion,
  VersionEntry,
  Workflow,
  WorkflowDiff,
} from './types'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** How to reach an r8r server. */
export interface ApiConfig {
  /**
   * Where the REST API lives, without a trailing slash.
   *
   * Standalone that is `/rest`; mounted inside another application it is the
   * prefix the host nested it under, such as `/api/automation`.
   */
  readonly baseUrl: string
  /**
   * Merged into every request. A host uses this to send its own session — a
   * cookie via `{ credentials: 'include' }`, or an Authorization header — so
   * the editor never needs to know how the host authenticates.
   */
  readonly fetchOptions?: RequestInit
}

export interface Api {
  nodeTypes(): Promise<NodeTypeDescription[]>

  listWorkflows(): Promise<Workflow[]>
  getWorkflow(id: string): Promise<Workflow>
  createWorkflow(workflow: Partial<Workflow>): Promise<Workflow>
  updateWorkflow(id: string, workflow: Workflow): Promise<Workflow>
  deleteWorkflow(id: string): Promise<{ deleted: string }>
  setActive(id: string, active: boolean): Promise<Workflow>

  runUnsaved(workflow: Workflow, startNode?: string, input?: Items): Promise<RunResponse>
  runSaved(id: string, input?: Items): Promise<RunResponse>

  credentialTypes(): Promise<CredentialTypeDescription[]>
  listCredentials(): Promise<CredentialSummary[]>
  getCredential(id: string): Promise<StoredCredential>
  createCredential(payload: {
    name: string
    type: string
    data: Record<string, JsonValue>
  }): Promise<CredentialSummary>
  updateCredential(
    id: string,
    payload: { name?: string; data: Record<string, JsonValue> },
  ): Promise<CredentialSummary>
  deleteCredential(id: string): Promise<{ deleted: string }>

  listVariables(): Promise<StoredVariable[]>
  setVariable(key: string, value: JsonValue): Promise<{ key: string; value: JsonValue }>
  deleteVariable(key: string): Promise<{ deleted: string }>

  listVersions(id: string): Promise<VersionEntry[]>
  getVersion(id: string, version: number): Promise<StoredVersion>
  compareVersions(id: string, from: number, to: number): Promise<WorkflowDiff>
  restoreVersion(id: string, version: number): Promise<Workflow>

  listExecutions(workflowId?: string, limit?: number): Promise<ExecutionSummary[]>
  getExecution(id: string): Promise<StoredExecution>
  deleteExecution(id: string): Promise<{ deleted: string }>
}

export function createApi(config: ApiConfig): Api {
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...config.fetchOptions,
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(config.fetchOptions?.headers ?? {}),
        ...(init?.headers ?? {}),
      },
    })

    if (!response.ok) {
      throw new ApiError(await errorMessage(response), response.status)
    }
    return (await response.json()) as T
  }

  const send = <T>(path: string, method: string, body: unknown): Promise<T> =>
    call<T>(path, { method, body: JSON.stringify(body) })

  return {
    nodeTypes: () => call('/node-types'),

    listWorkflows: () => call('/workflows'),
    getWorkflow: (id) => call(`/workflows/${id}`),
    createWorkflow: (workflow) => send('/workflows', 'POST', workflow),
    updateWorkflow: (id, workflow) => send(`/workflows/${id}`, 'PATCH', workflow),
    deleteWorkflow: (id) => call(`/workflows/${id}`, { method: 'DELETE' }),
    setActive: (id, active) => send(`/workflows/${id}/activate`, 'PATCH', { active }),

    /** Run the workflow currently on the canvas, saved or not. */
    runUnsaved: (workflow, startNode, input) =>
      send('/workflows/run', 'POST', {
        workflow,
        startNode: startNode ?? null,
        input: input ?? null,
      }),
    runSaved: (id, input) => send(`/workflows/${id}/run`, 'POST', { input: input ?? null }),

    credentialTypes: () => call('/credential-types'),
    listCredentials: () => call('/credentials'),
    /** Secrets come back redacted; the real values never leave the server. */
    getCredential: (id) => call(`/credentials/${id}`),
    createCredential: (payload) => send('/credentials', 'POST', payload),
    updateCredential: (id, payload) => send(`/credentials/${id}`, 'PATCH', payload),
    deleteCredential: (id) => call(`/credentials/${id}`, { method: 'DELETE' }),

    listVariables: () => call('/variables'),
    setVariable: (key, value) => send(`/variables/${encodeURIComponent(key)}`, 'PUT', { value }),
    deleteVariable: (key) => call(`/variables/${encodeURIComponent(key)}`, { method: 'DELETE' }),

    listVersions: (id) => call(`/workflows/${id}/versions`),
    getVersion: (id, version) => call(`/workflows/${id}/versions/${version}`),
    compareVersions: (id, from, to) =>
      send(`/workflows/${id}/versions/compare`, 'POST', { from, to }),
    restoreVersion: (id, version) =>
      send(`/workflows/${id}/versions/${version}/restore`, 'POST', {}),

    listExecutions: (workflowId, limit = 25) =>
      call(`/executions?limit=${limit}${workflowId ? `&workflowId=${workflowId}` : ''}`),
    getExecution: (id) => call(`/executions/${id}`),
    deleteExecution: (id) => call(`/executions/${id}`, { method: 'DELETE' }),
  }
}

/** Every handler answers `{ "error": "..." }`; fall back to the status line. */
async function errorMessage(response: Response): Promise<string> {
  const body = await response.text()
  try {
    const parsed = JSON.parse(body) as { error?: string }
    if (parsed.error) return parsed.error
  } catch {
    // Not JSON — a proxy, or a crash. Use whatever came back.
  }
  return body || `${response.status} ${response.statusText}`
}

/** Turn any thrown value into something worth showing a user. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
