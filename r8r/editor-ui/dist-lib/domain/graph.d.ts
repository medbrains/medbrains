import { Connection, JsonValue, NodeTypeDescription, Workflow, WorkflowNode } from '../types';
/** Stable identity for a connection, used as the React Flow edge id. */
export declare function edgeId(connection: Connection): string;
/**
 * The parts of a workflow worth saving. Comparing two snapshots is how the
 * editor knows whether the Save button should be enabled — timestamps and
 * server-assigned fields are deliberately excluded so a reload is never
 * mistaken for an edit.
 */
export declare function snapshot(workflow: Workflow): string;
export declare function isDirty(workflow: Workflow | null, saved: string): boolean;
/**
 * Seed a new node's parameters from its type's declared defaults.
 *
 * Properties are applied in order and only when visible, because integration
 * nodes declare one `operation` property per resource: seeding all of them
 * blindly would leave the last resource's default in place, and the node would
 * open with an Operation its Resource does not offer.
 */
export declare function defaultParameters(type: NodeTypeDescription): Record<string, JsonValue>;
/**
 * Node names address nodes in expressions (`nodes["Fetch users"]`), so two
 * nodes sharing a name would make one of them unreachable. Suffix until unique.
 */
export declare function uniqueName(base: string, nodes: readonly WorkflowNode[]): string;
/** Where a newly added node should land: to the right of everything else. */
export declare function nextPosition(nodes: readonly WorkflowNode[]): readonly [number, number];
/**
 * Only a Webhook or Schedule trigger can fire on its own, so a workflow with
 * neither cannot meaningfully be "active" — the server refuses it too.
 */
export declare function hasAutomaticTrigger(workflow: Workflow): boolean;
/** Add a connection unless the identical one already exists. */
export declare function addConnection(connections: readonly Connection[], candidate: Connection): Connection[];
/** Reject connections that would not make sense on the canvas. */
export declare function canConnect(source: string | null, target: string | null): boolean;
/** Remove a node along with every connection that touched it. */
export declare function removeNode(workflow: Workflow, nodeId: string): Workflow;
export declare function buildNode(type: NodeTypeDescription, existing: readonly WorkflowNode[], id: string): WorkflowNode;
export declare function connectionFrom(source: string, target: string, sourceHandle: string | null): Connection;
