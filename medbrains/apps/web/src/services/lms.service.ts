import { lmsApi } from "@medbrains/api/modules/lms";

export const lmsService = {
  listCourses: lmsApi.listLmsCourses,
  listMyEnrollments: lmsApi.myLmsEnrollments,
  listPaths: lmsApi.listLmsPaths,
  complianceOverview: lmsApi.lmsComplianceOverview,
  listMyCertificates: lmsApi.myLmsCertificates,
};
