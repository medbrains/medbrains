import { CredentialTypeDescription } from '../types';
/**
 * Create or edit one credential. The form is generated from the credential
 * type's declared properties, so a new integration needs no UI work.
 */
export declare function CredentialModal({ opened, type, credentialId, onClose, onSaved, }: {
    opened: boolean;
    type: CredentialTypeDescription | undefined;
    /** Editing an existing credential, or creating a new one when absent. */
    credentialId?: string;
    onClose: () => void;
    onSaved: (id: string) => void;
}): import("react").JSX.Element;
