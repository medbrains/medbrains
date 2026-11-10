import { EdgeChange, NodeChange } from '@xyflow/react';
import { NodeTypeDescription, RunResult, Workflow, WorkflowNode } from '../types';
export type EditorBusy = 'loading' | 'saving' | 'running' | null;
export interface WorkflowEditor {
    workflow: Workflow | null;
    selectedId: string | null;
    result: RunResult | null;
    busy: EditorBusy;
    dirty: boolean;
    error: string | null;
    select: (id: string | null) => void;
    rename: (name: string) => void;
    addNode: (type: NodeTypeDescription) => string;
    patchNode: (id: string, patch: Partial<WorkflowNode>) => void;
    removeNode: (id: string) => void;
    applyNodeChanges: (changes: NodeChange[]) => void;
    applyEdgeChanges: (changes: EdgeChange[]) => void;
    connect: (source: string | null, target: string | null, sourceHandle: string | null) => void;
    save: () => Promise<void>;
    run: () => Promise<void>;
    /** Load a past run back onto the canvas. */
    loadExecution: (executionId: string) => Promise<void>;
    setActive: (active: boolean) => Promise<void>;
    clearResult: () => void;
}
export declare function useWorkflowEditor(workflowId: string): WorkflowEditor;
