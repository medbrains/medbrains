import { useHasPermission } from "@medbrains/stores";
import { type MpiMatchResult, P } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Badge, Button, toast } from "@/components/ui";
import { patientsService } from "@/services/patients.service";

interface PharmacyCustomerMatchProps {
  match: MpiMatchResult;
  onCompleted: () => void;
}

/**
 * A duplicate-check hit that is a pharmacy customer's light record: the
 * person bought medicines before registering. The desk completes that
 * record — a UHID on the same row, so their orders stay with them — rather
 * than registering them a second time.
 */
export function PharmacyCustomerMatch({ match, onCompleted }: PharmacyCustomerMatchProps) {
  const canRegister = useHasPermission(P.PATIENTS.CREATE);
  const navigate = useNavigate();
  const complete = useMutation({
    mutationFn: () => patientsService.completePatientRegistration(match.id),
    onSuccess: (done) => {
      toast.success(`Registered as ${done.uhid}. Fill in the rest of their details.`);
      onCompleted();
      navigate(`/patients/${done.id}`);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not registered" }),
  });
  if (!match.pharmacy_customer) return null;
  return (
    <>
      <Badge size="sm" tone="info">
        Pharmacy customer — complete registration
      </Badge>
      {canRegister && (
        <Button
          size="xs"
          tone="primary"
          loading={complete.isPending}
          onClick={() => complete.mutate()}
        >
          Complete registration
        </Button>
      )}
    </>
  );
}
