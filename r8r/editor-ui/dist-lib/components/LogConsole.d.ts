import { RunResult, Workflow } from '../types';
/**
 * A terminal for the run.
 *
 * Deliberately console-shaped — monospace, fixed columns, level in the
 * gutter — because that is the format anyone debugging a pipeline already
 * knows how to read.
 */
export declare function LogConsole({ workflow, result, mode, onClose, }: {
    workflow: Workflow;
    result: RunResult;
    mode?: string;
    onClose: () => void;
}): import("react").JSX.Element;
