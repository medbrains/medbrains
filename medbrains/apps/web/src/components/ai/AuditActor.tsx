import { Group, Text } from "@mantine/core";
import type { ActingAgent } from "@medbrains/types";
import { AiLabel } from "@/components/ui";

interface AuditActorProps {
  userName: string | null;
  actingAgent: ActingAgent | null;
  size?: "xs" | "sm";
}

/**
 * Who acted, on an audit or access row. A person's own action shows their
 * name; a request the AI assistant made shows "AI assistant on behalf of
 * <name>", so a read by the assistant is never mistaken for a click by the
 * clinician (RFC-AUTHZ-2026-001 §2A.5).
 */
export function AuditActor({ userName, actingAgent, size = "sm" }: AuditActorProps) {
  const person = userName ?? "System";
  if (!actingAgent) {
    return <Text size={size}>{person}</Text>;
  }
  return (
    <Group gap={4} wrap="nowrap">
      <AiLabel
        size="xs"
        text="assistant"
        aria-label={`AI assistant on behalf of ${person}`}
        explainer={{
          title: "Done by the AI assistant",
          description: `The AI assistant made this request on behalf of ${person}, with ${person}'s permissions and no more. Run ${actingAgent.run_id}.`,
          model: actingAgent.model,
        }}
      />
      <Text size={size}>on behalf of {person}</Text>
    </Group>
  );
}
