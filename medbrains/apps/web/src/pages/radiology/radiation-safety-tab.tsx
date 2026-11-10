/**
 * The Radiological Safety Officer's registers: AERB equipment licences and
 * QA, staff TLD dosimetry, and diagnostic reference levels with their audit. Shown only to whoever keeps them.
 */
import { Stack } from "@mantine/core";
import { useState } from "react";
import { SegmentedControl } from "@/components/ui";
import { DosimetryPanel } from "./dosimetry-panel";
import { RadiationEquipmentPanel } from "./radiation-equipment-panel";
import { ReferenceLevelsPanel } from "./reference-levels-panel";

export function RadiationSafetyTab() {
  const [section, setSection] = useState("equipment");
  return (
    <Stack>
      <SegmentedControl
        aria-label="Register"
        data={[
          { value: "equipment", label: "Equipment (AERB)" },
          { value: "dosimetry", label: "Staff dosimetry (TLD)" },
          { value: "drl", label: "Reference levels (DRL)" },
        ]}
        value={section}
        onChange={setSection}
        w="fit-content"
      />
      {section === "equipment" && <RadiationEquipmentPanel />}
      {section === "dosimetry" && <DosimetryPanel />}
      {section === "drl" && <ReferenceLevelsPanel />}
    </Stack>
  );
}
