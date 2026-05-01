/**
 * TV → digital signage. Hospital announcements, visitor info, code
 * activation broadcasts. Deep-link: medbrains://tv/digital-signage
 */

import type { Module } from "@medbrains/mobile-shell";
import { TvBoard } from "../components/tv-board.js";

function DigitalSignageScreen() {
  return (
    <TvBoard
      eyebrow="ANNOUNCEMENTS"
      title="Welcome"
      subtitle="Visitor hours · 9 AM to 7 PM. Please follow infection control protocols."
      legend="Rotates every 30 seconds · medbrains://tv/digital-signage"
    />
  );
}

export const digitalSignageModule: Module = {
  id: "digital-signage",
  displayName: "Digital signage",
  icon: () => null,
  requiredPermissions: [],
  navigator: DigitalSignageScreen,
};
