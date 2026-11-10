import { CredentialTypeDescription, Items, NodeRunData, NodeTypeDescription, WorkflowNode } from '../types';
/**
 * The node view: what went in, how the node is configured, what came out.
 *
 * Configuring and debugging are the same activity, so they share one screen
 * rather than living in a side panel and a drawer that cannot be read together.
 */
export declare function NodeDetailView({ node, description, credentialTypes, input, destinations, run, onPatch, onDelete, onClose, onExecute, executing, }: {
    node: WorkflowNode;
    description?: NodeTypeDescription;
    credentialTypes: readonly CredentialTypeDescription[];
    input: Items;
    /** Fields the next node expects, shown in the mapper's right column. */
    destinations: readonly string[];
    run?: NodeRunData;
    onPatch: (patch: Partial<WorkflowNode>) => void;
    onDelete: () => void;
    onClose: () => void;
    onExecute: () => void;
    executing: boolean;
}): import("react").JSX.Element;
