// Lms CourseCatalogTab — split from lms.tsx (pure move).

import { Card, Group, Select, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { LmsCourse } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { lmsService } from "@/services/lms.service";
import { EmptyState } from "./empty-state";

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "clinical", label: "Clinical" },
  { value: "compliance", label: "Compliance" },
  { value: "safety", label: "Safety" },
  { value: "soft_skills", label: "Soft Skills" },
  { value: "technical", label: "Technical" },
  { value: "onboarding", label: "Onboarding" },
];

export function CourseCatalogTab() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const canCreate = useHasPermission(P.LMS.COURSES_CREATE);
  const { data: courses = [], isLoading } = useQuery<LmsCourse[]>({
    queryKey: ["lms-courses", search, category],
    queryFn: () =>
      lmsService.listCourses({
        search: search || undefined,
        category: category || undefined,
      }),
  });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="sm">
          <TextInput
            placeholder="Search courses..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={280}
          />
          <Select
            data={CATEGORY_OPTIONS}
            value={category}
            onChange={(v) => setCategory(v ?? "")}
            placeholder="Category"
            clearable
            w={180}
          />
        </Group>
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} size="sm">
            Add Course
          </Button>
        )}
      </Group>
      {isLoading ? (
        <EmptyState message="Loading courses..." />
      ) : courses.length === 0 ? (
        <EmptyState message="No courses found." />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {courses.map((c: LmsCourse) => (
            <Card key={c.id} shadow="xs" radius="md" padding="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text fw={600} size="sm" lineClamp={1}>
                  {c.title}
                </Text>
                {c.is_mandatory && (
                  <Badge size="xs" tone="danger">
                    Mandatory
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed" lineClamp={2} mb="sm">
                {c.description ?? "No description"}
              </Text>
              <Group gap="xs">
                <Badge size="xs" variant="outline" tone="neutral">
                  {c.category}
                </Badge>
                {c.duration_hours ? (
                  <Badge size="xs" tone="info">
                    {c.duration_hours}h
                  </Badge>
                ) : null}
                <Badge size="xs" variant="dot" tone={c.is_active ? "success" : "neutral"}>
                  {c.is_active ? "Active" : "Inactive"}
                </Badge>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

// ── My Learning Tab ────────────────────────────────────
