/**
 * "Which operation is this consent for?" — when a surgical, procedure or
 * anaesthesia consent is taken for a patient with a booked operation, tie it
 * to that booking so the OT start-of-surgery gate accepts it without a
 * separate link step. Hidden for roles that cannot read the theatre list.
 */
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui";
import { otService } from "@/services/ot.service";

const OT_CONSENT_TYPES = new Set(["surgery", "procedure", "anesthesia"]);
const OPEN_STATUSES = new Set(["requested", "confirmed", "postponed"]);

/** Only these consents can cover an operation (the server enforces the same). */
export function isOtConsentType(type: string | null | undefined): boolean {
  return OT_CONSENT_TYPES.has(type ?? "");
}

interface OtBookingForConsentSelectProps {
  patientId: string;
  consentType: string | null | undefined;
  value: string | null;
  onChange: (bookingId: string | null) => void;
}

export function OtBookingForConsentSelect({
  patientId,
  consentType,
  value,
  onChange,
}: OtBookingForConsentSelectProps) {
  const canListBookings = useHasPermission(P.OT.BOOKINGS_LIST);
  const relevant = canListBookings && isOtConsentType(consentType);
  const bookings = useQuery({
    queryKey: ["ot-bookings", { patient_id: patientId, per_page: "20" }],
    queryFn: () => otService.listOtBookings({ patient_id: patientId, per_page: "20" }),
    enabled: relevant,
  });

  if (!relevant) return null;
  const options = (bookings.data?.bookings ?? [])
    .filter((b) => OPEN_STATUSES.has(b.status))
    .map((b) => ({ value: b.id, label: `${b.procedure_name} — ${b.scheduled_date}` }));

  return (
    <Select
      label="For booked operation (optional)"
      description="Ties this consent to the operation so theatre can start on it."
      placeholder={options.length === 0 ? "No open OT booking for this patient" : "Choose"}
      data={options}
      value={value}
      onChange={onChange}
      clearable
      error={bookings.isError ? "OT bookings could not be read." : undefined}
    />
  );
}
