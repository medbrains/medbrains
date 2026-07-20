import { Stack, Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconBook,
  IconCertificate,
  IconChartBar,
  IconClipboardCheck,
  IconRoute,
  IconSchool,
} from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { CertificatesTab } from "./lms/certificates-tab";
import { ComplianceTab } from "./lms/compliance-tab";
import { CourseCatalogTab } from "./lms/course-catalog-tab";
import { LearningPathsTab } from "./lms/learning-paths-tab";
import { MyLearningTab } from "./lms/my-learning-tab";
import { QuizzesTab } from "./lms/quizzes-tab";

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
            <Tabs.Tab value="catalog" leftSection={<IconBook size={16} />}>
              Course Catalog
            </Tabs.Tab>
          )}
          <Tabs.Tab value="my-learning" leftSection={<IconSchool size={16} />}>
            My Learning
          </Tabs.Tab>
          {canAttemptQuizzes && (
            <Tabs.Tab value="quizzes" leftSection={<IconClipboardCheck size={16} />}>
              Quizzes
            </Tabs.Tab>
          )}
          {canViewPaths && (
            <Tabs.Tab value="paths" leftSection={<IconRoute size={16} />}>
              Learning Paths
            </Tabs.Tab>
          )}
          {canViewCompliance && (
            <Tabs.Tab value="compliance" leftSection={<IconChartBar size={16} />}>
              Compliance
            </Tabs.Tab>
          )}
          {canViewCertificates && (
            <Tabs.Tab value="certificates" leftSection={<IconCertificate size={16} />}>
              Certificates
            </Tabs.Tab>
          )}
        </Tabs.List>

        {canViewCourses && (
          <Tabs.Panel value="catalog" pt="md">
            <CourseCatalogTab />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="my-learning" pt="md">
          <MyLearningTab />
        </Tabs.Panel>
        {canAttemptQuizzes && (
          <Tabs.Panel value="quizzes" pt="md">
            <QuizzesTab />
          </Tabs.Panel>
        )}
        {canViewPaths && (
          <Tabs.Panel value="paths" pt="md">
            <LearningPathsTab />
          </Tabs.Panel>
        )}
        {canViewCompliance && (
          <Tabs.Panel value="compliance" pt="md">
            <ComplianceTab />
          </Tabs.Panel>
        )}
        {canViewCertificates && (
          <Tabs.Panel value="certificates" pt="md">
            <CertificatesTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </Stack>
  );
}
