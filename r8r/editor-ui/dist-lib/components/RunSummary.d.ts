import { RunResult } from '../types';
/**
 * One line under the canvas reporting the last run.
 *
 * The detail lives on the nodes themselves; this is the headline — did it
 * work, how much moved, how long it took.
 */
export declare function RunSummary({ result, consoleOpen, onToggleConsole, onClose, }: {
    result: RunResult;
    consoleOpen: boolean;
    onToggleConsole: () => void;
    onClose: () => void;
}): import("react").JSX.Element;
