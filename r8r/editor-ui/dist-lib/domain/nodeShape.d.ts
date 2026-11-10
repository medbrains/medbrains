import { NodeTypeDescription, WorkflowNode } from '../types';
export type NodeShape = 'trigger' | 'utility' | 'branch' | 'card';
export declare function shapeOf(node: WorkflowNode, description?: NodeTypeDescription): NodeShape;
/** Rendered width and height per shape, kept here so CSS and layout agree. */
export declare const SHAPE_SIZE: Record<NodeShape, {
    width: number;
    height: number;
}>;
/**
 * The one line worth reading on the canvas: what this node is actually
 * configured to do. Chosen per node type because "the most important
 * parameter" is not something a generic rule can guess.
 */
export declare function subtitleOf(node: WorkflowNode, description?: NodeTypeDescription): string;
/** Everything the hover tooltip should say, in reading order. */
export declare function tooltipLines(node: WorkflowNode, description?: NodeTypeDescription): {
    title: string;
    description: string;
    detail: string;
};
