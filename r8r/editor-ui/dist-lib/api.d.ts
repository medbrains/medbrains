import { CredentialSummary, CredentialTypeDescription, ExecutionSummary, Items, JsonValue, NodeTypeDescription, RunResponse, StoredCredential, StoredExecution, Workflow } from './types';
export declare class ApiError extends Error {
    readonly status: number;
    constructor(message: string, status: number);
}
/** How to reach an r8r server. */
export interface ApiConfig {
    /**
     * Where the REST API lives, without a trailing slash.
     *
     * Standalone that is `/rest`; mounted inside another application it is the
     * prefix the host nested it under, such as `/api/automation`.
     */
    readonly baseUrl: string;
    /**
     * Merged into every request. A host uses this to send its own session — a
     * cookie via `{ credentials: 'include' }`, or an Authorization header — so
     * the editor never needs to know how the host authenticates.
     */
    readonly fetchOptions?: RequestInit;
}
export interface Api {
    nodeTypes(): Promise<NodeTypeDescription[]>;
    listWorkflows(): Promise<Workflow[]>;
    getWorkflow(id: string): Promise<Workflow>;
    createWorkflow(workflow: Partial<Workflow>): Promise<Workflow>;
    updateWorkflow(id: string, workflow: Workflow): Promise<Workflow>;
    deleteWorkflow(id: string): Promise<{
        deleted: string;
    }>;
    setActive(id: string, active: boolean): Promise<Workflow>;
    runUnsaved(workflow: Workflow, startNode?: string, input?: Items): Promise<RunResponse>;
    runSaved(id: string, input?: Items): Promise<RunResponse>;
    credentialTypes(): Promise<CredentialTypeDescription[]>;
    listCredentials(): Promise<CredentialSummary[]>;
    getCredential(id: string): Promise<StoredCredential>;
    createCredential(payload: {
        name: string;
        type: string;
        data: Record<string, JsonValue>;
    }): Promise<CredentialSummary>;
    updateCredential(id: string, payload: {
        name?: string;
        data: Record<string, JsonValue>;
    }): Promise<CredentialSummary>;
    deleteCredential(id: string): Promise<{
        deleted: string;
    }>;
    listExecutions(workflowId?: string, limit?: number): Promise<ExecutionSummary[]>;
    getExecution(id: string): Promise<StoredExecution>;
    deleteExecution(id: string): Promise<{
        deleted: string;
    }>;
}
export declare function createApi(config: ApiConfig): Api;
/** Turn any thrown value into something worth showing a user. */
export declare function describeError(error: unknown): string;
