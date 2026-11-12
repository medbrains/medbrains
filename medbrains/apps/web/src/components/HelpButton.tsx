import { IconHelp } from "@tabler/icons-react";
import { useLocation } from "react-router";
import { IconButton, Tooltip } from "@/components/ui";

/** Screens with their own page in the guide; the rest open its front page. */
const GUIDE_PAGES: ReadonlyArray<[prefix: string, page: string]> = [
  ["/patients/register", "user-guides/front-office/register-a-patient/"],
  ["/opd/new", "user-guides/front-office/start-an-opd-visit/"],
  ["/opd/encounters", "user-guides/doctor/consultation/"],
  ["/lab", "user-guides/lab/from-order-to-report/"],
  ["/home-visits", "user-guides/nurse/home-visit-case-sheet/"],
  ["/home-healthcare", "user-guides/nurse/home-visit-case-sheet/"],
];

/** The user guide (apps/docs, served at /help), opened at this screen's page. */
export function HelpButton() {
  const { pathname } = useLocation();
  const page = GUIDE_PAGES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "";
  return (
    <Tooltip label="Help for this screen">
      <IconButton
        aria-label="Help"
        size="md"
        onClick={() => window.open(`/help/${page}`, "_blank", "noopener")}
      >
        <IconHelp size={18} stroke={1.5} />
      </IconButton>
    </Tooltip>
  );
}
