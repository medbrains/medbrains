import { Text } from "@mantine/core";
import type { NhcxParticipant } from "@medbrains/types";
import { Badge } from "@/components/ui";
import { directoryCertLabel } from "./nhcxSummary";

/** The payer directory's table columns: who the payer is, where the row came
 * from, and whether a message to it can be encrypted. */
export const DIRECTORY_COLUMNS = [
  {
    key: "participant_name" as const,
    label: "Payer",
    render: (p: NhcxParticipant) => p.participant_name,
  },
  {
    key: "participant_code" as const,
    label: "HCX code",
    render: (p: NhcxParticipant) => (
      <Text size="sm" ff="monospace">
        {p.participant_code}
      </Text>
    ),
  },
  {
    key: "role" as const,
    label: "Role",
    render: (p: NhcxParticipant) => <Badge tone="neutral">{p.role}</Badge>,
  },
  {
    key: "source" as const,
    label: "Source",
    render: (p: NhcxParticipant) =>
      p.source === "registry" ? (
        <Badge tone="info">NHCX{p.entity_type ? ` · ${p.entity_type}` : ""}</Badge>
      ) : (
        <Badge tone="neutral">Added by hand</Badge>
      ),
  },
  {
    key: "has_encryption_cert" as const,
    label: "Encryption certificate",
    render: (p: NhcxParticipant) => {
      const cert = directoryCertLabel(p);
      return <Badge tone={cert.tone}>{cert.label}</Badge>;
    },
  },
];
