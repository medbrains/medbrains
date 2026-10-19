import { Anchor } from "@mantine/core";
import type { NhcxStatus } from "@medbrains/types";
import { Link } from "react-router";
import { Alert } from "@/components/ui";

interface NhcxSetupAlertProps {
  status: NhcxStatus | undefined;
  isError: boolean;
}

/** Says plainly when NHCX cannot send, and why — never a silent "Queued". */
export function NhcxSetupAlert({ status, isError }: NhcxSetupAlertProps) {
  if (isError) {
    return (
      <Alert tone="warning" title="Could not check the NHCX setup">
        Whether NHCX is set up is unknown right now — try again in a minute.
      </Alert>
    );
  }
  if (!status || status.ready) return null;
  return (
    <Alert tone="warning" title="NHCX is not set up for this hospital">
      Missing: {status.missing.join(", ")}. File this on the payer's portal for now, or{" "}
      <Anchor component={Link} to="/admin/settings#nhcx">
        finish the NHCX setup
      </Anchor>
      .
    </Alert>
  );
}
