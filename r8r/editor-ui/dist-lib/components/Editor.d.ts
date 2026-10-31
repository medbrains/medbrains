import { CredentialTypeDescription, NodeTypeDescription } from '../types';
export declare function Editor({ workflowId, nodeTypes, credentialTypes, onBack, }: {
    workflowId: string;
    nodeTypes: readonly NodeTypeDescription[];
    credentialTypes: readonly CredentialTypeDescription[];
    onBack: () => void;
}): import("react").JSX.Element;
