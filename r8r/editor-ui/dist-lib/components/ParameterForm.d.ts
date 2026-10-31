import { CredentialTypeDescription, Items, NodeTypeDescription, WorkflowNode } from '../types';
/**
 * The middle column of the node view: every parameter the node declares,
 * rendered from its schema so a new node type needs no frontend work.
 */
export declare function ParameterForm({ node, description, credentialTypes, input, destinations, onPatch, onDelete, }: {
    node: WorkflowNode;
    description?: NodeTypeDescription;
    credentialTypes: readonly CredentialTypeDescription[];
    /** What reached this node in the last run, for the mapper's source column. */
    input: Items;
    /** Fields the next node expects, for the mapper's destination column. */
    destinations: readonly string[];
    onPatch: (patch: Partial<WorkflowNode>) => void;
    onDelete: () => void;
}): import("react").JSX.Element;
