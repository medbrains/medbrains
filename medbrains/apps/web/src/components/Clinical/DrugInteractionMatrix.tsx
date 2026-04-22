import { Badge, Group, Popover, Text, Tooltip } from "@mantine/core";
import type { DrugInteractionAlert } from "@medbrains/types";

interface DrugInteractionMatrixProps {
  drugNames: string[];
  interactions: DrugInteractionAlert[];
}

const SEVERITY_COLORS: Record<string, string> = {
  contraindicated: "danger",
  major: "orange",
  moderate: "warning",
  minor: "success",
};

const SEVERITY_BG: Record<string, string> = {
  contraindicated: "var(--mb-critical-bg)",
  major: "var(--mb-abnormal-bg)",
  moderate: "var(--mb-abnormal-bg)",
  minor: "var(--mb-normal-bg)",
};

export function DrugInteractionMatrix({ drugNames, interactions }: DrugInteractionMatrixProps) {
  if (drugNames.length < 2 || interactions.length === 0) return null;

  // Build a lookup: "drugA|drugB" → interaction
  const interactionMap = new Map<string, DrugInteractionAlert>();
  for (const ia of interactions) {
    const key1 = `${ia.drug_a}|${ia.drug_b}`;
    const key2 = `${ia.drug_b}|${ia.drug_a}`;
    interactionMap.set(key1, ia);
    interactionMap.set(key2, ia);
  }

  const truncate = (name: string, max = 12) =>
    name.length > max ? name.slice(0, max - 1) + "…" : name;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ padding: "4px 8px", textAlign: "left" }} />
            {drugNames.map((name) => (
              <th key={name} style={{ padding: "4px 6px", fontWeight: 500, writingMode: "vertical-rl", textOrientation: "mixed", maxHeight: 80 }}>
                <Tooltip label={name}>
                  <Text size="10px" fw={500}>{truncate(name)}</Text>
                </Tooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {drugNames.map((rowDrug, rowIdx) => (
            <tr key={rowDrug}>
              <td style={{ padding: "4px 8px", fontWeight: 500, whiteSpace: "nowrap" }}>
                <Tooltip label={rowDrug}>
                  <Text size="xs">{truncate(rowDrug, 18)}</Text>
                </Tooltip>
              </td>
              {drugNames.map((colDrug, colIdx) => {
                if (rowIdx === colIdx) {
                  return <td key={colDrug} style={{ padding: "2px", background: "var(--mb-bg-content)", width: 28, height: 28 }} />;
                }
                if (colIdx < rowIdx) {
                  return <td key={colDrug} style={{ padding: "2px", width: 28, height: 28 }} />;
                }

                const ia = interactionMap.get(`${rowDrug}|${colDrug}`);
                if (!ia) {
                  return (
                    <td key={colDrug} style={{ padding: "2px", width: 28, height: 28 }}>
                      <Tooltip label="No interaction">
                        <div style={{ width: 24, height: 24, borderRadius: 4, background: "var(--mb-normal-bg)", border: "1px solid var(--mb-normal-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Text size="9px" c="success">✓</Text>
                        </div>
                      </Tooltip>
                    </td>
                  );
                }

                const color = SEVERITY_COLORS[ia.severity] ?? "slate";
                const bg = SEVERITY_BG[ia.severity] ?? "var(--mb-bg-content)";

                return (
                  <td key={colDrug} style={{ padding: "2px", width: 28, height: 28 }}>
                    <Popover width={280} position="top" withArrow shadow="md">
                      <Popover.Target>
                        <div style={{ width: 24, height: 24, borderRadius: 4, background: bg, border: `1px solid var(--mantine-color-${color}-3)`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <Text size="9px" fw={700} c={color}>
                            {ia.severity.charAt(0).toUpperCase()}
                          </Text>
                        </div>
                      </Popover.Target>
                      <Popover.Dropdown>
                        <Group gap={4} mb={4}>
                          <Badge size="xs" color={color}>{ia.severity}</Badge>
                          <Text size="xs" fw={600}>{ia.drug_a} + {ia.drug_b}</Text>
                        </Group>
                        <Text size="xs">{ia.description}</Text>
                        {ia.management && (
                          <Text size="xs" c="dimmed" mt={4}>
                            <Text span fw={600}>Management:</Text> {ia.management}
                          </Text>
                        )}
                      </Popover.Dropdown>
                    </Popover>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
