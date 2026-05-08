import { Card, Divider, SimpleGrid, Text, ThemeIcon } from "@mantine/core";
import type { ReactNode } from "react";
import styles from "./detail-section.module.scss";

interface DetailField {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

interface DetailSectionProps {
  title: string;
  icon?: ReactNode;
  color?: string;
  fields: DetailField[];
  columns?: number;
}

export function DetailSection({
  title,
  icon,
  color = "primary",
  fields,
  columns = 3,
}: DetailSectionProps) {
  return (
    <Card className={styles.card} padding={0} radius="md" shadow="xs">
      <div
        className={styles.leftBorder}
        style={{ backgroundColor: `var(--mantine-color-${color}-5)` }}
      />

      <div className={styles.header}>
        {icon && (
          <ThemeIcon variant="light" color={color} size={28} radius="md">
            {icon}
          </ThemeIcon>
        )}
        <Text size="sm" fw={600} c="var(--mb-text-primary)">
          {title}
        </Text>
      </div>

      <Divider />

      <div className={styles.content}>
        <SimpleGrid cols={{ base: 1, sm: 2, md: columns }} spacing="md" mt="sm">
          {fields.map((field) => (
            <div key={field.label} className={styles.fieldItem}>
              <span className={styles.fieldLabel}>{field.label}</span>
              <span className={styles.fieldValue}>
                {field.value || (
                  <Text component="span" c="var(--mb-text-faint)">
                    --
                  </Text>
                )}
              </span>
            </div>
          ))}
        </SimpleGrid>
      </div>
    </Card>
  );
}
