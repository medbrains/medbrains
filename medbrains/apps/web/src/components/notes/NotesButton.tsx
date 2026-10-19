import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconNote } from "@tabler/icons-react";
import { useState } from "react";
import { Drawer, IconButton } from "@/components/ui";
import { NotesPanel } from "./NotesPanel";

/** Top-bar entry to sticky notes, on every screen. */
export function NotesButton() {
  const canUse = useHasPermission(P.NOTES.USE);
  const [opened, setOpened] = useState(false);
  if (!canUse) return null;
  return (
    <>
      <IconButton aria-label="Notes" onClick={() => setOpened(true)}>
        <IconNote size={18} />
      </IconButton>
      <Drawer opened={opened} onClose={() => setOpened(false)} title="Notes" size="md">
        {opened && <NotesPanel />}
      </Drawer>
    </>
  );
}
