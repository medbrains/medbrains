/**
 * Browse one concept: its terms, parents and children, all descendants
 * (capped), whether it is a kind of another concept, and a bounded ECL query.
 */
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { SnomedConceptSummary } from "@medbrains/types";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SnomedConceptSelect } from "@/components/Clinical/SnomedConceptSelect";
import { Alert, Badge, Button, Card, Input } from "@/components/ui";
import { snomedService } from "@/services/snomed.service";

interface Picked {
  id: string;
  label: string;
}

interface ConceptListProps {
  title: string;
  concepts: SnomedConceptSummary[];
  total?: number;
  onPick: (picked: Picked) => void;
}

function ConceptList({ title, concepts, total, onPick }: ConceptListProps) {
  return (
    <Stack gap={4}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
        {title}
        {total !== undefined && total > concepts.length
          ? ` · first ${concepts.length} of ${total}`
          : ""}
      </Text>
      {concepts.length === 0 ? (
        <Text size="sm" c="dimmed">
          None
        </Text>
      ) : (
        concepts.map((c) => (
          <Button
            key={c.concept_id}
            tone="ghost"
            size="compact-sm"
            justify="flex-start"
            onClick={() => onPick({ id: c.concept_id, label: c.preferred_term ?? c.concept_id })}
          >
            {c.preferred_term ?? c.concept_id}
            {c.semantic_tag ? ` (${c.semantic_tag})` : ""}
          </Button>
        ))
      )}
    </Stack>
  );
}

export function SnomedBrowseTab() {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [showDescendants, setShowDescendants] = useState(false);
  const [parent, setParent] = useState<Picked | null>(null);
  const [expression, setExpression] = useState("");

  const pick = (next: Picked | null) => {
    setPicked(next);
    setShowDescendants(false);
  };
  const concept = useQuery({
    queryKey: ["snomed-concept", picked?.id],
    queryFn: () => snomedService.getConcept(picked?.id ?? ""),
    enabled: Boolean(picked),
  });
  const descendants = useQuery({
    queryKey: ["snomed-descendants", picked?.id],
    queryFn: () => snomedService.getHierarchy(picked?.id ?? "", "descendants"),
    enabled: Boolean(picked) && showDescendants,
  });
  const subsumption = useQuery({
    queryKey: ["snomed-subsumes", picked?.id, parent?.id],
    queryFn: () => snomedService.checkSubsumption(picked?.id ?? "", parent?.id ?? ""),
    enabled: Boolean(picked && parent),
  });
  const ecl = useMutation({ mutationFn: snomedService.evaluateEcl });
  const detail = concept.data;

  return (
    <Stack gap="md">
      <SnomedConceptSelect
        label="Concept"
        value={picked?.id ?? null}
        displayValue={picked?.label}
        onChange={(hit) =>
          pick(hit ? { id: hit.concept_id, label: hit.preferred_term ?? hit.concept_id } : null)
        }
      />
      {concept.isError && <Alert tone="danger">The concept could not be loaded.</Alert>}
      {detail && (
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Group gap="xs">
              <Text fw={700}>{detail.preferred_term}</Text>
              <Text size="xs" ff="monospace" c="dimmed">
                {detail.concept_id}
              </Text>
              {!detail.active && <Badge tone="warning">Inactive</Badge>}
              <Badge tone="neutral">{detail.fully_defined ? "Fully defined" : "Primitive"}</Badge>
            </Group>
            <Text size="sm">{detail.fsn}</Text>
            <Group gap={6}>
              {detail.descriptions
                .filter((d) => d.description_type === "synonym")
                .map((d) => (
                  <Badge
                    key={d.description_id}
                    tone={d.acceptability === "preferred" ? "info" : "neutral"}
                  >
                    {d.term} · {d.language_code}
                    {d.acceptability ? ` · ${d.acceptability}` : ""}
                  </Badge>
                ))}
            </Group>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <ConceptList title="Parents" concepts={detail.parents} onPick={pick} />
              <ConceptList
                title="Children"
                concepts={detail.children}
                total={detail.children_count}
                onPick={pick}
              />
            </SimpleGrid>
            {detail.descendant_count > 0 && !showDescendants && (
              <Group>
                <Button tone="secondary" size="xs" onClick={() => setShowDescendants(true)}>
                  Show descendants ({detail.descendant_count.toLocaleString()})
                </Button>
              </Group>
            )}
            {descendants.data && (
              <ConceptList
                title="Descendants"
                concepts={descendants.data.concepts}
                total={descendants.data.total}
                onPick={pick}
              />
            )}
          </Stack>
        </Card>
      )}
      {picked && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Text fw={600}>Is {picked.label} a kind of…</Text>
            <SnomedConceptSelect
              aria-label="Possible ancestor concept"
              value={parent?.id ?? null}
              displayValue={parent?.label}
              onChange={(hit) =>
                setParent(
                  hit ? { id: hit.concept_id, label: hit.preferred_term ?? hit.concept_id } : null,
                )
              }
            />
            {subsumption.data && (
              <Badge tone={subsumption.data.is_a ? "success" : "neutral"}>
                {subsumption.data.is_a ? "Yes — it is subsumed" : "No — not a descendant"}
              </Badge>
            )}
          </Stack>
        </Card>
      )}
      <Card withBorder padding="md">
        <Stack gap="xs">
          <Text fw={600}>Expression constraint (ECL)</Text>
          <Text size="xs" c="dimmed">
            {"<< id, < id, >> id, > id, ^ refset, combined with AND, OR, MINUS and brackets. "}
            At most 50 concepts are listed.
          </Text>
          <Group align="flex-end" wrap="nowrap">
            <Input
              aria-label="ECL expression"
              placeholder="<< 404684003 MINUS << 64572001"
              value={expression}
              onChange={(e) => setExpression(e.currentTarget.value)}
              style={{ flex: 1 }}
              ff="monospace"
            />
            <Button
              tone="primary"
              leftSection={<IconPlayerPlay size={16} />}
              disabled={!expression.trim()}
              loading={ecl.isPending}
              onClick={() => ecl.mutate(expression)}
            >
              Run
            </Button>
          </Group>
          {ecl.error && <Alert tone="danger">{ecl.error.message}</Alert>}
          {ecl.data && (
            <ConceptList
              title={`${ecl.data.total.toLocaleString()}${ecl.data.total_capped ? "+" : ""} matching`}
              concepts={ecl.data.concepts}
              onPick={pick}
            />
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
