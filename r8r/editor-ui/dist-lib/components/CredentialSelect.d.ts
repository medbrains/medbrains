import { CredentialRequirement, CredentialTypeDescription } from '../types';
/**
 * Picks the credential a node authenticates with. Only credentials of the
 * type the node declares are offered, so a GitHub token can never be selected
 * for a Slack node.
 */
export declare function CredentialSelect({ requirement, credentialTypes, selectedId, onSelect, }: {
    requirement: CredentialRequirement;
    credentialTypes: readonly CredentialTypeDescription[];
    selectedId: string | undefined;
    onSelect: (id: string | undefined) => void;
}): import("react").JSX.Element;
