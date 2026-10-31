import { EditorBusy } from '../hooks/useWorkflowEditor';
import { Workflow } from '../types';
export declare function EditorToolbar({ workflow, dirty, busy, onBack, onRename, onSave, onRun, onSetActive, runsOpen, onToggleRuns, }: {
    workflow: Workflow;
    dirty: boolean;
    busy: EditorBusy;
    onBack: () => void;
    onRename: (name: string) => void;
    onSave: () => void;
    onRun: () => void;
    onSetActive: (active: boolean) => void;
    runsOpen: boolean;
    onToggleRuns: () => void;
}): import("react").JSX.Element;
