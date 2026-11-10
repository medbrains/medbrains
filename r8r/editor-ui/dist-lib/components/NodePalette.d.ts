import { NodeTypeDescription } from '../types';
export declare function NodePalette({ nodeTypes, onAdd, }: {
    nodeTypes: readonly NodeTypeDescription[];
    onAdd: (type: NodeTypeDescription) => void;
}): import("react").JSX.Element;
