import { Skeleton } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconNote } from "@tabler/icons-react";
import { lazy, Suspense, useState } from "react";
import { IconButton, Modal } from "@/components/ui";

// The panel's editor brings zod and the date pickers; the button is on every
// screen, so the panel loads the first time someone opens it.
const NotesPanel = lazy(() => import("./NotesPanel").then((m) => ({ default: m.NotesPanel })));
const PANEL_LOADING_HEIGHT = 200;

/** Top-bar entry to sticky notes, on every screen; the panel loads on first open. */
export function NotesButton() {
  const canUse = useHasPermission(P.NOTES.USE);
  const [opened, setOpened] = useState(false);
  if (!canUse) return null;
  return (
    <>
      <IconButton aria-label="Notes" onClick={() => setOpened(true)}>
        <IconNote size={18} />
      </IconButton>
      <Modal opened={opened} onClose={() => setOpened(false)} title="Notes" size="md">
        {opened && (
          <Suspense
            fallback={<Skeleton height={PANEL_LOADING_HEIGHT} aria-label="Loading notes" />}
          >
            <NotesPanel />
          </Suspense>
        )}
      </Modal>
    </>
  );
}
