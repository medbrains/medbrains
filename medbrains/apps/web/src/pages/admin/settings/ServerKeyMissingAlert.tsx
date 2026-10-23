import { Alert } from "@/components/ui";

interface ServerKeyMissingAlertProps {
  /** The integration the key turns on, as the screen names it. */
  integration: string;
  /** The environment variable the server lacks; nothing renders when null. */
  envName: string | null | undefined;
}

/**
 * Says an integration is off because the server itself lacks its key — so a
 * hospital administrator does not keep re-entering keys that cannot be saved.
 */
export function ServerKeyMissingAlert({ integration, envName }: ServerKeyMissingAlertProps) {
  if (!envName) return null;
  return (
    <Alert tone="warning" title={`${integration} is not configured on this server`}>
      Ask your administrator to set {envName} on the server. Until then nothing here can be saved
      and nothing is sent to {integration}.
    </Alert>
  );
}
