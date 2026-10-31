/**
 * Previous runs of this workflow.
 *
 * Opening one puts its readout back on the canvas, so a failure from last
 * night is inspected exactly the way a run from ten seconds ago is.
 */
export declare function ExecutionsPanel({ workflowId, selectedId, onOpen, onClose, }: {
    workflowId: string;
    selectedId?: string;
    onOpen: (executionId: string) => void;
    onClose: () => void;
}): import("react").JSX.Element;
