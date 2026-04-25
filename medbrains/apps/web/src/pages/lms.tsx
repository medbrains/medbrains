import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Select,
  Table,
} from "@mantine/core";
import {
  IconSchool,
  IconBook,
  IconCertificate,
  IconRoute,
  IconChartBar,
  IconSearch,
  IconPlus,
  IconClipboardCheck,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  LmsCourse,
  EnrollmentWithCourse,
  LmsLearningPath,
  LmsCertificate,
  LmsComplianceRow,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

// ── Constants ──────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  assigned: "blue",
  in_progress: "yellow",
  completed: "green",
  expired: "red",
  cancelled: "gray",
};

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "clinical", label: "Clinical" },
  { value: "compliance", label: "Compliance" },
  { value: "safety", label: "Safety" },
  { value: "soft_skills", label: "Soft Skills" },
  { value: "technical", label: "Technical" },
  { value: "onboarding", label: "Onboarding" },
];

function EmptyState({ message }: { message: string }) {
  return <Text c="dimmed" ta="center" py="xl">{message}</Text>;
}

// ── Course Catalog Tab ─────────────────────────────────

function CourseCatalogTab() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const canCreate = useHasPermission(P.LMS.COURSES_CREATE);
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["lms-courses", search, category],
    queryFn: () => api.listLmsCourses({
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
          <Button leftSection={<IconPlus size={16} />} size="sm">Add Course</Button>
        )}
      </Group>
      {isLoading ? <EmptyState message="Loading courses..." /> : courses.length === 0 ? (
        <EmptyState message="No courses found." />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {courses.map((c: LmsCourse) => (
            <Card key={c.id} shadow="xs" radius="md" padding="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text fw={600} size="sm" lineClamp={1}>{c.title}</Text>
                {c.is_mandatory && <Badge size="xs" color="red" variant="light">Mandatory</Badge>}
              </Group>
              <Text size="xs" c="dimmed" lineClamp={2} mb="sm">{c.description ?? "No description"}</Text>
              <Group gap="xs">
                <Badge size="xs" variant="outline">{c.category}</Badge>
                {c.duration_hours ? <Badge size="xs" variant="light" color="blue">{c.duration_hours}h</Badge> : null}
                <Badge size="xs" variant="dot" color={c.is_active ? "green" : "gray"}>
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

function MyLearningTab() {
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["lms-my-enrollments"],
    queryFn: () => api.myLmsEnrollments(),
  });

  if (isLoading) return <EmptyState message="Loading your enrollments..." />;
  if (enrollments.length === 0) return <EmptyState message="You have no course enrollments yet." />;

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {enrollments.map((e: EnrollmentWithCourse) => {
        const isOverdue = e.due_date && e.status !== "completed" && new Date(e.due_date) < new Date();
        return (
          <Card key={e.id} shadow="xs" radius="md" padding="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text fw={600} size="sm" lineClamp={1}>{e.course_title}</Text>
              <Badge size="xs" color={isOverdue ? "red" : STATUS_COLORS[e.status] ?? "gray"}>
                {isOverdue ? "Overdue" : e.status.replace("_", " ")}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              {e.course_code} &middot; {e.category}{e.is_mandatory ? " (Mandatory)" : ""}
            </Text>
            <Progress
              value={e.progress_percentage}
              size="sm"
              color={e.progress_percentage === 100 ? "green" : "blue"}
              mb="xs"
            />
            <Group justify="space-between">
              <Text size="xs" c="dimmed">{e.progress_percentage}% complete</Text>
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

function QuizzesTab() {
  return (
    <Stack align="center" py="xl" gap="md">
      <IconClipboardCheck size={48} stroke={1.2} color="var(--mantine-color-gray-5)" />
      <Text c="dimmed" size="lg" fw={500}>Select a course to take quizzes</Text>
      <Text c="dimmed" size="sm" maw={400} ta="center">
        Navigate to a course from the Course Catalog or My Learning tab, then access its quizzes
        from the course detail view.
      </Text>
    </Stack>
  );
}

// ── Learning Paths Tab ─────────────────────────────────

function LearningPathsTab() {
  const canCreate = useHasPermission(P.LMS.PATHS_CREATE);
  const { data: paths = [], isLoading } = useQuery({
    queryKey: ["lms-paths"],
    queryFn: () => api.listLmsPaths(),
  });

  return (
    <Stack gap="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button leftSection={<IconPlus size={16} />} size="sm">Create Path</Button>
        </Group>
      )}
      {isLoading ? <EmptyState message="Loading learning paths..." /> : paths.length === 0 ? (
        <EmptyState message="No learning paths defined yet." />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {paths.map((p: LmsLearningPath) => (
            <Card key={p.id} shadow="xs" radius="md" padding="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text fw={600} size="sm" lineClamp={1}>{p.title}</Text>
                {p.is_mandatory && <Badge size="xs" color="red" variant="light">Mandatory</Badge>}
              </Group>
              <Text size="xs" c="dimmed" lineClamp={2} mb="sm">{p.description ?? "No description"}</Text>
              <Group gap="xs">
                <Badge size="xs" variant="outline">{p.code}</Badge>
                <Badge size="xs" variant="dot" color={p.is_active ? "green" : "gray"}>
                  {p.is_active ? "Active" : "Inactive"}
                </Badge>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

// ── Compliance Tab ─────────────────────────────────────

function ComplianceTab() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["lms-compliance"],
    queryFn: () => api.lmsComplianceOverview(),
  });

  if (isLoading) return <EmptyState message="Loading compliance data..." />;
  if (rows.length === 0) return <EmptyState message="No compliance data available." />;

  return (
    <Table striped highlightOnHover withTableBorder withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Course</Table.Th>
          <Table.Th>Mandatory</Table.Th>
          <Table.Th ta="center">Enrolled</Table.Th>
          <Table.Th ta="center">Completed</Table.Th>
          <Table.Th ta="center">Overdue</Table.Th>
          <Table.Th ta="center">Completion %</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((row: LmsComplianceRow) => {
          const pct = row.total_enrolled > 0
            ? Math.round((row.completed / row.total_enrolled) * 100) : 0;
          return (
            <Table.Tr key={row.course_id}>
              <Table.Td>{row.course_title}</Table.Td>
              <Table.Td>
                {row.is_mandatory
                  ? <Badge size="xs" color="red" variant="light">Yes</Badge>
                  : <Text size="xs" c="dimmed">No</Text>}
              </Table.Td>
              <Table.Td ta="center">{row.total_enrolled}</Table.Td>
              <Table.Td ta="center">{row.completed}</Table.Td>
              <Table.Td ta="center">
                {row.overdue > 0 ? <Badge size="xs" color="red">{row.overdue}</Badge> : 0}
              </Table.Td>
              <Table.Td ta="center">
                <Progress value={pct} size="sm" color={pct >= 80 ? "green" : "yellow"} />
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

// ── Certificates Tab ───────────────────────────────────

function CertificatesTab() {
  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["lms-my-certificates"],
    queryFn: () => api.myLmsCertificates(),
  });

  if (isLoading) return <EmptyState message="Loading certificates..." />;
  if (certs.length === 0) return <EmptyState message="No certificates issued yet." />;

  return (
    <Table striped highlightOnHover withTableBorder withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Certificate No.</Table.Th>
          <Table.Th>Course / Path</Table.Th>
          <Table.Th>Issued Date</Table.Th>
          <Table.Th>Expiry</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {certs.map((c: LmsCertificate) => (
          <Table.Tr key={c.id}>
            <Table.Td><Text size="sm" ff="monospace">{c.certificate_no}</Text></Table.Td>
            <Table.Td>{c.course_id ?? c.path_id ?? "\u2014"}</Table.Td>
            <Table.Td>{new Date(c.issued_at).toLocaleDateString()}</Table.Td>
            <Table.Td>
              {c.expires_at ? (
                <Text size="sm" c={new Date(c.expires_at) < new Date() ? "red" : undefined}>
                  {new Date(c.expires_at).toLocaleDateString()}
                </Text>
              ) : <Text size="sm" c="dimmed">No expiry</Text>}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

// ── Main Page ──────────────────────────────────────────

export function LmsPage() {
  useRequirePermission(P.LMS.MY_LEARNING_VIEW);
  const [activeTab, setActiveTab] = useState<string | null>("catalog");
  const canViewCourses = useHasPermission(P.LMS.COURSES_LIST);
  const canViewPaths = useHasPermission(P.LMS.PATHS_LIST);
  const canViewCompliance = useHasPermission(P.LMS.COMPLIANCE_VIEW);
  const canViewCertificates = useHasPermission(P.LMS.CERTIFICATES_LIST);
  const canAttemptQuizzes = useHasPermission(P.LMS.QUIZZES_ATTEMPT);

  return (
    <Stack gap="md">
      <PageHeader
        title="Learning Management"
        subtitle="Training courses, quizzes, compliance tracking, and certifications"
        icon={<IconSchool size={22} />}
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          {canViewCourses && (
            <Tabs.Tab value="catalog" leftSection={<IconBook size={16} />}>Course Catalog</Tabs.Tab>
          )}
          <Tabs.Tab value="my-learning" leftSection={<IconSchool size={16} />}>My Learning</Tabs.Tab>
          {canAttemptQuizzes && (
            <Tabs.Tab value="quizzes" leftSection={<IconClipboardCheck size={16} />}>Quizzes</Tabs.Tab>
          )}
          {canViewPaths && (
            <Tabs.Tab value="paths" leftSection={<IconRoute size={16} />}>Learning Paths</Tabs.Tab>
          )}
          {canViewCompliance && (
            <Tabs.Tab value="compliance" leftSection={<IconChartBar size={16} />}>Compliance</Tabs.Tab>
          )}
          {canViewCertificates && (
            <Tabs.Tab value="certificates" leftSection={<IconCertificate size={16} />}>Certificates</Tabs.Tab>
          )}
        </Tabs.List>

        {canViewCourses && <Tabs.Panel value="catalog" pt="md"><CourseCatalogTab /></Tabs.Panel>}
        <Tabs.Panel value="my-learning" pt="md"><MyLearningTab /></Tabs.Panel>
        {canAttemptQuizzes && <Tabs.Panel value="quizzes" pt="md"><QuizzesTab /></Tabs.Panel>}
        {canViewPaths && <Tabs.Panel value="paths" pt="md"><LearningPathsTab /></Tabs.Panel>}
        {canViewCompliance && <Tabs.Panel value="compliance" pt="md"><ComplianceTab /></Tabs.Panel>}
        {canViewCertificates && <Tabs.Panel value="certificates" pt="md"><CertificatesTab /></Tabs.Panel>}
      </Tabs>
    </Stack>
  );
}
