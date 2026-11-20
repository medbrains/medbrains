/** The `/lms` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AiGeneratedCourse,
  CourseWithModules,
  EnrollmentWithCourse,
  LearningPathWithCourses,
  LmsCertificate,
  LmsComplianceRow,
  LmsCourse,
  LmsCourseModule,
  LmsEnrollment,
  LmsLearningPath,
  LmsLearningPathCourse,
  LmsQuiz,
  LmsQuizQuestion,
  QuizAttemptResult,
  QuizAttemptStart,
} from "@medbrains/types";
import { request } from "../client.js";

export const lmsApi = {
  // ── LMS (Learning Management System) ──────────────────────

  listLmsCourses: (params?: { search?: string; category?: string; mandatory?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.category) qs.set("category", params.category);
    if (params?.mandatory !== undefined) qs.set("mandatory", String(params.mandatory));
    const q = qs.toString();
    return request<LmsCourse[]>(`/lms/courses${q ? `?${q}` : ""}`);
  },
  getLmsCourse: (id: string) => request<CourseWithModules>(`/lms/courses/${id}`),
  createLmsCourse: (data: {
    code: string;
    title: string;
    description?: string;
    category?: string;
    duration_hours?: number;
    is_mandatory?: boolean;
    target_roles?: string[];
    content_type?: string;
  }) => request<LmsCourse>("/lms/courses", { method: "POST", body: JSON.stringify(data) }),
  updateLmsCourse: (id: string, data: Record<string, unknown>) =>
    request<LmsCourse>(`/lms/courses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteLmsCourse: (id: string) =>
    request<{ deleted: boolean }>(`/lms/courses/${id}`, { method: "DELETE" }),

  addLmsModule: (
    courseId: string,
    data: {
      title: string;
      description?: string;
      sort_order?: number;
      content?: Record<string, unknown>;
    },
  ) =>
    request<LmsCourseModule>(`/lms/courses/${courseId}/modules`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLmsModule: (courseId: string, moduleId: string, data: Record<string, unknown>) =>
    request<LmsCourseModule>(`/lms/courses/${courseId}/modules/${moduleId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteLmsModule: (courseId: string, moduleId: string) =>
    request<{ deleted: boolean }>(`/lms/courses/${courseId}/modules/${moduleId}`, {
      method: "DELETE",
    }),
  reorderLmsModules: (courseId: string, moduleIds: string[]) =>
    request<{ reordered: boolean }>(`/lms/courses/${courseId}/modules/reorder`, {
      method: "PUT",
      body: JSON.stringify({ module_ids: moduleIds }),
    }),

  listLmsQuizzes: (courseId: string) => request<LmsQuiz[]>(`/lms/courses/${courseId}/quizzes`),
  createLmsQuiz: (
    courseId: string,
    data: {
      title: string;
      pass_percentage?: number;
      max_attempts?: number;
      time_limit_minutes?: number;
    },
  ) =>
    request<LmsQuiz>(`/lms/courses/${courseId}/quizzes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLmsQuiz: (id: string, data: Record<string, unknown>) =>
    request<LmsQuiz>(`/lms/quizzes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  addLmsQuestion: (
    quizId: string,
    data: {
      question_text: string;
      question_type?: string;
      options: unknown;
      correct_answer: unknown;
      explanation?: string;
      points?: number;
    },
  ) =>
    request<LmsQuizQuestion>(`/lms/quizzes/${quizId}/questions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLmsQuestion: (quizId: string, qid: string, data: Record<string, unknown>) =>
    request<LmsQuizQuestion>(`/lms/quizzes/${quizId}/questions/${qid}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteLmsQuestion: (quizId: string, qid: string) =>
    request<{ deleted: boolean }>(`/lms/quizzes/${quizId}/questions/${qid}`, { method: "DELETE" }),

  listLmsEnrollments: (params?: { user_id?: string; course_id?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.user_id) qs.set("user_id", params.user_id);
    if (params?.course_id) qs.set("course_id", params.course_id);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return request<EnrollmentWithCourse[]>(`/lms/enrollments${q ? `?${q}` : ""}`);
  },
  assignLmsCourse: (data: { user_id: string; course_id: string; due_date?: string }) =>
    request<LmsEnrollment>("/lms/enrollments", { method: "POST", body: JSON.stringify(data) }),
  bulkAssignByRole: (data: { course_id: string; role: string; due_date?: string }) =>
    request<{ enrolled: number }>("/lms/enrollments/bulk-role", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLmsEnrollment: (id: string, data: { status?: string; due_date?: string }) =>
    request<LmsEnrollment>(`/lms/enrollments/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  myLmsEnrollments: () => request<EnrollmentWithCourse[]>("/lms/my/enrollments"),
  myLmsCourseDetail: (enrollmentId: string) =>
    request<CourseWithModules>(`/lms/my/enrollments/${enrollmentId}`),
  updateLmsProgress: (
    enrollmentId: string,
    data: { module_id: string; progress_percentage: number },
  ) =>
    request<LmsEnrollment>(`/lms/my/enrollments/${enrollmentId}/progress`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  startQuizAttempt: (data: { quiz_id: string }) =>
    request<QuizAttemptStart>("/lms/my/quiz-attempts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  submitQuizAttempt: (
    attemptId: string,
    data: { answers: { question_id: string; selected: unknown }[] },
  ) =>
    request<QuizAttemptResult>(`/lms/my/quiz-attempts/${attemptId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listLmsPaths: () => request<LmsLearningPath[]>("/lms/paths"),
  getLmsPath: (id: string) => request<LearningPathWithCourses>(`/lms/paths/${id}`),
  createLmsPath: (data: {
    code: string;
    title: string;
    description?: string;
    target_roles?: string[];
    is_mandatory?: boolean;
  }) => request<LmsLearningPath>("/lms/paths", { method: "POST", body: JSON.stringify(data) }),
  updateLmsPath: (id: string, data: Record<string, unknown>) =>
    request<LmsLearningPath>(`/lms/paths/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  addLmsPathCourse: (
    pathId: string,
    data: { course_id: string; sort_order?: number; is_required?: boolean },
  ) =>
    request<LmsLearningPathCourse>(`/lms/paths/${pathId}/courses`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeLmsPathCourse: (pathId: string, courseId: string) =>
    request<{ deleted: boolean }>(`/lms/paths/${pathId}/courses/${courseId}`, { method: "DELETE" }),

  listLmsCertificates: (params?: { user_id?: string; course_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.user_id) qs.set("user_id", params.user_id);
    if (params?.course_id) qs.set("course_id", params.course_id);
    const q = qs.toString();
    return request<LmsCertificate[]>(`/lms/certificates${q ? `?${q}` : ""}`);
  },
  myLmsCertificates: () => request<LmsCertificate[]>("/lms/my/certificates"),
  issueLmsCertificate: (data: {
    user_id: string;
    course_id?: string;
    path_id?: string;
    enrollment_id?: string;
    expires_at?: string;
  }) =>
    request<LmsCertificate>("/lms/certificates", { method: "POST", body: JSON.stringify(data) }),

  lmsComplianceOverview: () => request<LmsComplianceRow[]>("/lms/compliance"),
  lmsComplianceByCourse: (courseId: string) =>
    request<EnrollmentWithCourse[]>(`/lms/compliance/courses/${courseId}`),
  lmsComplianceByUser: (userId: string) =>
    request<EnrollmentWithCourse[]>(`/lms/compliance/users/${userId}`),

  aiGenerateCourse: (data: {
    topic: string;
    target_roles?: string[];
    duration_hours?: number;
    num_modules?: number;
    num_quiz_questions?: number;
    category?: string;
    language?: string;
  }) =>
    request<AiGeneratedCourse>("/lms/courses/ai-generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  aiSaveCourse: (data: AiGeneratedCourse) =>
    request<LmsCourse>("/lms/courses/ai-save", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
