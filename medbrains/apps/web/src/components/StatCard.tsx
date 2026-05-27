import { Card, Group, Text, ThemeIcon } from "@mantine/core";
import { IconArrowDownRight, IconArrowUpRight } from "@tabler/icons-react";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color?: string;
  trend?: { value: number; label?: string };
}

export function StatCard({ label, value, icon, color = "primary", trend }: StatCardProps) {
  return (
    <Card className="stat-card" padding="lg">
      <Group justify="space-between" mb="sm">
        <Text
          size="xs"
          tt="uppercase"
          c="var(--mb-text-caption)"
          fw={500}
          ff="var(--font-mono, 'JetBrains Mono', monospace)"
          style={{ fontSize: 11 }}
        >
          {label}
        </Text>
        <ThemeIcon variant="light" color={color} size={36} radius="lg">
          {icon}
        </ThemeIcon>
      </Group>
      <Text
        fz={28}
        fw={600}
        lh={1.1}
        c="var(--mb-text-heading)"
        ff="var(--font-display)"
        style={{ fontVariantNumeric: "lining-nums tabular-nums" }}
      >
        {value}
      </Text>
      {trend && (
        <Group gap={4} mt="sm">
          {trend.value >= 0 ? (
            <IconArrowUpRight size={14} color="var(--mb-success-accent, #10b981)" stroke={2} />
          ) : (
            <IconArrowDownRight size={14} color="var(--mb-danger-accent, #f43f5e)" stroke={2} />
          )}
          <Text size="xs" c={trend.value >= 0 ? "success" : "danger"} fw={600}>
            {Math.abs(trend.value)}%
          </Text>
          {trend.label && (
            <Text size="xs" c="var(--mb-text-caption)">
              {trend.label}
            </Text>
          )}
        </Group>
      )}
    </Card>
  );
}
