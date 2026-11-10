import { EdgeProps } from '@xyflow/react';
export interface FlowEdgeData extends Record<string, unknown> {
    /** How many items travelled this wire in the last run, if any. */
    items?: number;
    /** Play the one-shot completion pulse. */
    pulse?: boolean;
}
/**
 * A wire between two nodes.
 *
 * After a run it reports what actually flowed along it — the signature device
 * of the canvas. A wire that carried nothing stays neutral, which makes a dead
 * branch obvious at a glance.
 */
export declare function FlowEdge({ id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, data, selected, }: EdgeProps & {
    data?: FlowEdgeData;
}): import("react").JSX.Element;
