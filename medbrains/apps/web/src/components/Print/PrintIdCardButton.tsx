import { Tooltip } from "@mantine/core";
import { IconId } from "@tabler/icons-react";
import { useState } from "react";
import { IconButton } from "@/components/ui";
import { useIdCardPrint } from "./useIdCardPrint";

export interface PrintIdCardButtonProps {
  patientId: string;
  /** The button's name, naming the patient when a list holds many. */
  ariaLabel: string;
}

/**
 * A row's "Print ID card": one icon button printing the card the hospital's
 * card printer setting names. Hidden without the permission the card
 * endpoints accept; disabled while the setting loads, and when it could not
 * be read a press says so rather than printing a guess.
 */
export function PrintIdCardButton({ patientId, ariaLabel }: PrintIdCardButtonProps) {
  const card = useIdCardPrint();
  const [printing, setPrinting] = useState(false);
  if (!card.allowed) return null;

  /** Prints the card with the button busy until it is done. */
  const print = async () => {
    setPrinting(true);
    await card.print(patientId);
    setPrinting(false);
  };

  return (
    <Tooltip label={card.problem ?? ariaLabel}>
      <IconButton
        size={44}
        aria-label={ariaLabel}
        loading={printing}
        disabled={!card.ready && !card.problem}
        onClick={() => void print()}
      >
        <IconId size={16} />
      </IconButton>
    </Tooltip>
  );
}
