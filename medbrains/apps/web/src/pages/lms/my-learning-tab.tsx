// Lms MyLearningTab — split from lms.tsx (pure move).

import { Card, Group, Progress, SimpleGrid, Text } from "@mantine/core";
import type { EnrollmentWithCourse } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Badge, type BadgeTone } from "@/components/ui";
import { lmsService } from "@/services/lms.service";
import { EmptyState } from "./empty-state";

const STATUS_COLORS: Record<string, BadgeTone> = {
  assigned: "info",
  in_progress: "warning",
  completed: "success",
  expired: "danger",
  cancelled: "neutral",
};

export function MyLearningTab() {
  const { data: enrollments = [], isLoading } = useQuery<EnrollmentWithCourse[]>({
    queryKey: ["lms-my-enrollments"],
    queryFn: () => lmsService.listMyEnrollments(),
  });

  if (isLoading) return <EmptyState message="Loading your enrollments..." />;
  if (enrollments.length === 0) return <EmptyState message="You have no course enrollments yet." />;

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {enrollments.map((e: EnrollmentWithCourse) => {
        const isOverdue =
          e.due_date && e.status !== "completed" && new Date(e.due_date) < new Date();
        return (
          <Card key={e.id} shadow="xs" radius="md" padding="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text fw={600} size="sm" lineClamp={1}>
                {e.course_title}
              </Text>
              <Badge size="xs" tone={isOverdue ? "danger" : (STATUS_COLORS[e.status] ?? "neutral")}>
                {isOverdue ? "Overdue" : e.status.replace("_", " ")}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              {e.course_code} &middot; {e.category}
              {e.is_mandatory ? " (Mandatory)" : ""}
            </Text>
            <Progress
              value={e.progress_percentage}
              size="sm"
              color={e.progress_percentage === 100 ? "green" : "blue"}
              mb="xs"
            />
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                {e.progress_percentage}% complete
              </Text>
              {e.due_date && (
                <Text size="xs" c={isOverdue ? "red" : "dimmed"}>
                  Due: {new Date(e.due_date).toLocaleDateString()}
                </Text>
              )}
            </Group>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}

// ── Quizzes Tab (placeholder) ──────────────────────────
