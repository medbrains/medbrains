// The patient list row's own actions: print the ID card, open the record.

import { Group, Tooltip } from "@mantine/core";
import type { Patient } from "@medbrains/types";
import { IconUsers } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { PrintIdCardButton } from "@/components/Print/PrintIdCardButton";
import { IconButton } from "@/components/ui";

/** "Print ID card" (per the hospital's card printer) and "Full profile", for one row. */
export function PatientRowActions({ row }: { row: Patient }) {
  const { t } = useTranslation("patients");
  const navigate = useNavigate();
  return (
    <Group gap="xs" wrap="nowrap">
      <PrintIdCardButton
        patientId={row.id}
        ariaLabel={t("directory.printIdCardFor", { uhid: row.uhid })}
      />
      <Tooltip label={t("label.fullProfile")}>
        <IconButton
          tone="success"
          size={44}
          aria-label={t("label.fullProfile")}
          onClick={() => navigate(`/patients/${row.id}`)}
        >
          <IconUsers size={16} />
        </IconButton>
      </Tooltip>
    </Group>
  );
}
