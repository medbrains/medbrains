import { useHasAnyPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/components/ui";
import { printDocument } from "@/lib/print/printDocument";
import { patientsService } from "@/services/patients.service";

/** The registration settings query, shared with the search box and the admin screen. */
export const REGISTRATION_SETTINGS_QUERY_KEY = ["registration-search-settings"];

/**
 * What the ID card, token ticket and card endpoints accept: `patients.view`
 * with a relationship, or the desk's `patients.card.reprint` for any patient.
 */
export const CARD_PRINT_PERMISSIONS = [P.PATIENTS.VIEW, P.PATIENTS.CARD.REPRINT];

/** The ID card print, as the menus and list rows offer it. */
export interface IdCardPrint {
  /** Whether this user may print a card at all. */
  allowed: boolean;
  /** The hospital's card printer is known, so a print can start. */
  ready: boolean;
  /** Why the card cannot print: the setting could not be read. */
  problem: string | null;
  /** Prints the patient's ID card on the hospital's card printer, or says why it cannot. */
  print: (patientId: string) => Promise<void>;
}

/**
 * The ID card print, following the hospital's "Card printer" setting: the
 * 58 mm thermal card (`patient-card`) or the CR80 card (`opd-card`).
 *
 * Three outcomes, never two: the setting answers thermal or cr80 (thermal
 * when the hospital never chose), or the read failed, and then the card does
 * not print and says why. A failed read is not "thermal": printing the wrong
 * card silently reads as the setting being ignored.
 */
export function useIdCardPrint(): IdCardPrint {
  const allowed = useHasAnyPermission(CARD_PRINT_PERMISSIONS);
  const setting = useQuery({
    queryKey: REGISTRATION_SETTINGS_QUERY_KEY,
    queryFn: () => patientsService.getSearchSettings(),
    enabled: allowed,
  });
  const problem = setting.isError ? "The card printer setting could not be loaded" : null;

  /** Prints the card the setting names and says so when it could not. */
  const print = async (patientId: string) => {
    if (problem) {
      toast.error(`${problem}. Try again.`, { title: "Could not print the card" });
      return;
    }
    if (!setting.data) return;
    const key = setting.data.card_printer === "cr80" ? "opd-card" : "patient-card";
    const result = await printDocument(key, patientId);
    if (!result.ok) {
      toast.error(result.problem ?? "Nothing was printed", { title: "Could not print" });
    }
  };

  return { allowed, ready: setting.isSuccess, problem, print };
}
