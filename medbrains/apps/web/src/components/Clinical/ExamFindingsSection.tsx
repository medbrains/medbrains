/**
 * Examination findings at a place on the body — "tenderness, right iliac
 * fossa" with the site coded, so the next visit can show where, not just
 * what. Each finding is a picked (or typed) site plus what was found there.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { ExamFinding } from "@medbrains/types";
import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { type BodySite, formatBodySite } from "@/components/BodySite/anatomy-atlas";
import { BodySitePicker } from "@/components/BodySite/BodySitePicker";
import { Button, IconButton, Input } from "@/components/ui";

export interface ExamFindingsSectionProps {
  findings: ExamFinding[];
  canUpdate: boolean;
  onChange: (findings: ExamFinding[]) => void;
}

function describe(f: ExamFinding): string {
  return `${formatBodySite({ label: f.site, code: f.site_code, laterality: f.laterality })}: ${f.finding}`;
}

export function ExamFindingsSection({ findings, canUpdate, onChange }: ExamFindingsSectionProps) {
  const [site, setSite] = useState<BodySite | null>(null);
  const [finding, setFinding] = useState("");
  const candidate = site
    ? {
        site: site.label,
        site_code: site.code,
        laterality: site.laterality,
        finding: finding.trim(),
      }
    : null;
  // The same finding twice at the same site is a duplicate entry, not a second finding.
  const isDuplicate =
    candidate !== null && findings.some((f) => describe(f) === describe(candidate));
  const canAdd = Boolean(site?.label.trim()) && finding.trim().length > 0 && !isDuplicate;

  const add = () => {
    if (!candidate || !canAdd) return;
    onChange([...findings, candidate]);
    setSite(null);
    setFinding("");
  };

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        Findings by site
      </Text>
      {findings.length === 0 ? (
        <Text size="sm" c="dimmed">
          No site findings recorded.
        </Text>
      ) : (
        findings.map((f) => (
          <Group key={describe(f)} justify="space-between" wrap="nowrap">
            <Text size="sm">{describe(f)}</Text>
            {canUpdate && (
              <IconButton
                tone="danger"
                size="sm"
                aria-label={`Remove finding: ${describe(f)}`}
                onClick={() => onChange(findings.filter((other) => other !== f))}
              >
                <IconTrash size={14} />
              </IconButton>
            )}
          </Group>
        ))
      )}
      {canUpdate && (
        <Group align="flex-start" grow>
          <BodySitePicker
            label="Site"
            value={site}
            onChange={setSite}
            placeholder="e.g. Right iliac fossa"
          />
          <Input
            label="Finding"
            placeholder="e.g. Tender, guarding"
            value={finding}
            onChange={(e) => setFinding(e.currentTarget.value)}
          />
          <Button tone="secondary" onClick={add} disabled={!canAdd} mt="xl">
            Add finding
          </Button>
        </Group>
      )}
    </Stack>
  );
}
