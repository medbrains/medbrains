/**
 * The wire contract, mirroring `crates/workflow/src/interfaces.rs`.
 *
 * Every field here is as narrow as the Rust type it comes from: enums are
 * string-literal unions rather than `string`, and JSON is a real recursive
 * type rather than `any`. If the Rust side gains a variant, TypeScript stops
 * compiling until this file is updated too.
 */

export type JsonPrimitive = string | number | boolean | null
export type JsonObject = { [key: string]: JsonValue }
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject

/** One unit of data flowing between nodes. */
export type Item = JsonObject
export type Items = Item[]

/** Output port name. `main` on every node; `If` adds `false`. */
export type PortName = string
export const MAIN_PORT = 'main'
/** Where records that failed go when a node isolates them. */
export const ERROR_PORT = 'error'

// ------------------------------------------------------------- node schema

export type NodeGroup = 'trigger' | 'input' | 'output' | 'transform' | 'flow'

export type PropertyKind =
  | 'string'
  | 'multilineString'
  | 'number'
  | 'boolean'
  | 'options'
  | 'json'
  | 'code'
  | 'keyValue'
  | 'collection'
  | 'fieldMapper'

export interface PropertyOption {
  readonly name: string
  readonly value: JsonValue
  /** What choosing this operation does, shown under the dropdown. */
  readonly action?: string
}

/**
 * When a parameter is visible, mirroring `crates/workflow/src/display_options.rs`.
 * Every `show` condition must hold and no `hide` condition may — that is what
 * makes an integration's resource/operation cascade work.
 */
export interface DisplayOptions {
  readonly show?: Readonly<Record<string, readonly JsonValue[]>>
  readonly hide?: Readonly<Record<string, readonly JsonValue[]>>
}

export interface NodeProperty {
  readonly name: string
  readonly displayName: string
  readonly type: PropertyKind
  readonly default: JsonValue
  readonly options?: readonly PropertyOption[]
  readonly required?: boolean
  readonly placeholder?: string
  readonly description?: string
  /** Secret: render masked, and never echo the value back. */
  readonly password?: boolean
  readonly displayOptions?: DisplayOptions
}

/** A credential type a node can authenticate with. */
export interface CredentialRequirement {
  readonly name: string
  readonly required: boolean
}

export interface NodeTypeDescription {
  readonly name: string
  readonly displayName: string
  readonly group: NodeGroup
  readonly description: string
  readonly icon: string
  readonly color: string
  readonly properties: readonly NodeProperty[]
  readonly outputs: readonly PortName[]
  readonly inputs: readonly PortName[]
  readonly credentials?: readonly CredentialRequirement[]
  readonly baseUrl?: string
}

// ------------------------------------------------------------- credentials

export interface CredentialTypeDescription {
  readonly name: string
  readonly displayName: string
  readonly documentationUrl?: string
  readonly baseUrl?: string
  readonly properties: readonly NodeProperty[]
}

export interface CredentialSummary {
  readonly id: string
  readonly name: string
  readonly type: string
  readonly createdAt: string
  readonly updatedAt: string
}

/** One credential with secrets replaced by {@link REDACTED}. */
export interface StoredCredential extends CredentialSummary {
  readonly data: Record<string, JsonValue>
}

/**
 * What the server sends instead of a secret, and what the editor sends back
 * for a field the user did not retype. Round-tripping it preserves the stored
 * value; sending anything else replaces it.
 */
export const REDACTED = '__r8r_unchanged__'

// ------------------------------------------------------------------- graph

/**
 * What the engine does when a node fails. `null` means stop.
 *
 * `continueRecord` runs the items one at a time, so that one bad record does
 * not discard the good ones it arrived with.
 */
export type OnError = 'stop' | 'continue' | 'continueRecord'

export interface WorkflowNode {
  id: string
  type: string
  name: string
  parameters: Record<string, JsonValue>
  position: readonly [number, number]
  disabled?: boolean
  onError?: OnError | null
  retryOnFail?: boolean
  maxTries?: number | null
  waitBetweenTriesMs?: number | null
  notes?: string | null
  /** Credential type name -> stored credential id. */
  credentials?: Record<string, string>
}

export interface Connection {
  from: string
  to: string
  port: PortName
}

export interface Workflow {
  id: string
  name: string
  active: boolean
  nodes: WorkflowNode[]
  connections: Connection[]
  settings?: JsonValue
  readonly createdAt?: string
  readonly updatedAt?: string
}

// --------------------------------------------------------------- execution

export type NodeRunStatus = 'ok' | 'error' | 'skipped'
export type ExecutionStatus = 'running' | 'success' | 'error' | 'canceled'
export type ExecutionMode = 'manual' | 'trigger' | 'webhook' | 'schedule' | 'retry'

export interface NodeRunData {
  readonly nodeId: string
  readonly name: string
  readonly type: string
  readonly status: NodeRunStatus
  readonly ms: number
  readonly tries: number
  readonly output: Readonly<Record<PortName, Items>>
  readonly error?: string
}

export interface RunResult {
  readonly status: ExecutionStatus
  readonly error?: string
  readonly runs: readonly NodeRunData[]
  readonly last: Items
}

export interface ExecutionSummary {
  readonly id: string
  readonly workflowId: string
  readonly workflowName: string
  readonly status: ExecutionStatus
  readonly mode: ExecutionMode
  readonly startedAt: string
  readonly finishedAt?: string
  readonly ms: number
  readonly error?: string
}

export interface StoredExecution extends ExecutionSummary {
  readonly data: RunResult
}

/** What `POST /rest/workflows/run` and `.../{id}/run` return. */
export interface RunResponse {
  readonly executionId: string | null
  readonly result: RunResult
}

// --------------------------------------------------------------- history

/** One setting, before and after. `null` means it was not set. */
export interface FieldChange {
  readonly path: string
  readonly before: JsonValue | null
  readonly after: JsonValue | null
}

export interface NodeSummary {
  readonly id: string
  readonly name: string
  readonly kind: string
}

export interface NodeChange extends NodeSummary {
  readonly fields: readonly FieldChange[]
}

export interface WorkflowDiff {
  readonly renamed: readonly [string, string] | null
  readonly nodesAdded: readonly NodeSummary[]
  readonly nodesRemoved: readonly NodeSummary[]
  readonly nodesChanged: readonly NodeChange[]
  readonly connectionsAdded: readonly Connection[]
  readonly connectionsRemoved: readonly Connection[]
  readonly settingsChanged: readonly FieldChange[]
}

/** A version, and what the save that created it changed. */
export interface VersionEntry {
  readonly id: string
  readonly workflowId: string
  readonly version: number
  readonly name: string
  readonly createdAt: string
  readonly note: string | null
  /** `null` for the first version, which changed everything. */
  readonly changes: WorkflowDiff | null
  readonly summary: string
}

export interface StoredVersion {
  readonly id: string
  readonly workflowId: string
  readonly version: number
  readonly name: string
  readonly createdAt: string
  readonly note: string | null
  readonly workflow: Workflow
}

/** A setting that differs between one deployment and the next. */
export interface StoredVariable {
  readonly key: string
  readonly value: JsonValue
  readonly updatedAt: string
}
