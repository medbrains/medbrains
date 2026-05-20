import { api } from "@medbrains/api";

export const lmsService = {
  listCourses: api.listLmsCourses,
  listMyEnrollments: api.myLmsEnrollments,
  listPaths: api.listLmsPaths,
  complianceOverview: api.lmsComplianceOverview,
  listMyCertificates: api.myLmsCertificates,
};
