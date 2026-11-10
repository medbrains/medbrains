import { NodeProps } from '@xyflow/react';
import { NodeRunData, NodeTypeDescription, WorkflowNode } from '../types';
export interface FlowNodeData extends Record<string, unknown> {
    node: WorkflowNode;
    description?: NodeTypeDescription;
    run?: NodeRunData;
}
/**
 * A node on the canvas.
 *
 * Its shape says what role the node plays, its name sits below the card the
 * way a component is labelled on a schematic, and the readout underneath
 * appears only once the node has actually run.
 */
export declare function FlowNode({ data, selected }: NodeProps & {
    data: FlowNodeData;
}): import("react").JSX.Element;
