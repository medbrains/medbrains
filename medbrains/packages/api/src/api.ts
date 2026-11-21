/**
 * The whole client, every API area in one object — the same surface `api` always had.
 * For package tests, the simulator and test mocks: web source imports the area it
 * calls from `@medbrains/api/modules/<area>`, so a screen downloads only its own areas.
 */
import { abdmApi } from "./modules/abdm.js";
import { accessApi } from "./modules/access.js";
import { accessAlertsApi } from "./modules/access-alerts.js";
import { accessGroupsApi } from "./modules/access-groups.js";
import { adminApi } from "./modules/admin.js";
import { advanceDirectivesApi } from "./modules/advance-directives.js";
import { aebasApi } from "./modules/aebas.js";
import { aiApi } from "./modules/ai.js";
import { ambulanceApi } from "./modules/ambulance.js";
import { analyticsApi } from "./modules/analytics.js";
import { apiApi } from "./modules/api.js";
import { appApi } from "./modules/app.js";
import { approvalsApi } from "./modules/approvals.js";
import { assetsApi } from "./modules/assets.js";
import { auditApi } from "./modules/audit.js";
import { authApi } from "./modules/auth.js";
import { backupsApi } from "./modules/backups.js";
import { bedsideApi } from "./modules/bedside.js";
import { bereavementApi } from "./modules/bereavement.js";
import { billingApi } from "./modules/billing.js";
import { blogApi } from "./modules/blog.js";
import { bloodBankApi } from "./modules/blood-bank.js";
import { bmeApi } from "./modules/bme.js";
import { brandingApi } from "./modules/branding.js";
import { breakGlassApi } from "./modules/break-glass.js";
import { bridgeApi } from "./modules/bridge.js";
import { campApi } from "./modules/camp.js";
import { careViewApi } from "./modules/care-view.js";
import { caseMgmtApi } from "./modules/case-mgmt.js";
import { caseSheetsApi } from "./modules/case-sheets.js";
import { cdsApi } from "./modules/cds.js";
import { chronicCareApi } from "./modules/chronic-care.js";
import { ckbApi } from "./modules/ckb.js";
import { clientErrorsApi } from "./modules/client-errors.js";
import { clinicalApi } from "./modules/clinical.js";
import { clinicalNotesApi } from "./modules/clinical-notes.js";
import { clinicalTrialsApi } from "./modules/clinical-trials.js";
import { cmsApi } from "./modules/cms.js";
import { commandCenterApi } from "./modules/command-center.js";
import { communicationsApi } from "./modules/communications.js";
import { complianceRequirementsApi } from "./modules/compliance-requirements.js";
import { consentApi } from "./modules/consent.js";
import { counterDisplayApi } from "./modules/counter-display.js";
import { cssdApi } from "./modules/cssd.js";
import { dashboardApi } from "./modules/dashboard.js";
import { dashboardsApi } from "./modules/dashboards.js";
import { dataProcessorsApi } from "./modules/data-processors.js";
import { dataQualityApi } from "./modules/data-quality.js";
import { debugApi } from "./modules/debug.js";
import { deviceApi } from "./modules/device.js";
import { deviceIngestApi } from "./modules/device-ingest.js";
import { devicePairingApi } from "./modules/device-pairing.js";
import { devicesApi } from "./modules/devices.js";
import { dietApi } from "./modules/diet.js";
import { digestApi } from "./modules/digest.js";
import { disposalsApi } from "./modules/disposals.js";
import { doctorApi } from "./modules/doctor.js";
import { doctorPayoutsApi } from "./modules/doctor-payouts.js";
import { doctorsApi } from "./modules/doctors.js";
import { documentIngestionApi } from "./modules/document-ingestion.js";
import { documentsApi } from "./modules/documents.js";
import { emergencyApi } from "./modules/emergency.js";
import { encountersApi } from "./modules/encounters.js";
import { facilitiesApi } from "./modules/facilities.js";
import { fhirApi } from "./modules/fhir.js";
import { flowApi } from "./modules/flow.js";
import { flowsApi } from "./modules/flows.js";
import { formsApi } from "./modules/forms.js";
import { frontOfficeApi } from "./modules/front-office.js";
import { geoApi } from "./modules/geo.js";
import { healthApi } from "./modules/health.js";
import { healthIntelApi } from "./modules/health-intel.js";
import { historyImportApi } from "./modules/history-import.js";
import { homeHealthApi } from "./modules/home-health.js";
import { homeVisitsApi } from "./modules/home-visits.js";
import { hospiceApi } from "./modules/hospice.js";
import { housekeepingApi } from "./modules/housekeeping.js";
import { hrApi } from "./modules/hr.js";
import { hrmsApi } from "./modules/hrms.js";
import { iamApi } from "./modules/iam.js";
import { icuApi } from "./modules/icu.js";
import { immunizationsApi } from "./modules/immunizations.js";
import { indentApi } from "./modules/indent.js";
import { infectionControlApi } from "./modules/infection-control.js";
import { insuranceApi } from "./modules/insurance.js";
import { integrationApi } from "./modules/integration.js";
import { integrationsApi } from "./modules/integrations.js";
import { ipdApi } from "./modules/ipd.js";
import { knowledgeApi } from "./modules/knowledge.js";
import { labApi } from "./modules/lab.js";
import { lmsApi } from "./modules/lms.js";
import { ltcApi } from "./modules/ltc.js";
import { marketingApi } from "./modules/marketing.js";
import { mastersApi } from "./modules/masters.js";
import { materialsApi } from "./modules/materials.js";
import { micrositeApi } from "./modules/microsite.js";
import { migrationsApi } from "./modules/migrations.js";
import { mrdApi } from "./modules/mrd.js";
import { multiHospitalApi } from "./modules/multi-hospital.js";
import { nabhApi } from "./modules/nabh.js";
import { newsApi } from "./modules/news.js";
import { newsFeedApi } from "./modules/news-feed.js";
import { nhcxApi } from "./modules/nhcx.js";
import { notesApi } from "./modules/notes.js";
import { notificationsApi } from "./modules/notifications.js";
import { nurseApi } from "./modules/nurse.js";
import { oauthApi } from "./modules/oauth.js";
import { occHealthApi } from "./modules/occ-health.js";
import { onboardingApi } from "./modules/onboarding.js";
import { opdApi } from "./modules/opd.js";
import { openapiApi } from "./modules/openapi.js";
import { orchestrationApi } from "./modules/orchestration.js";
import { orderSetsApi } from "./modules/order-sets.js";
import { ordersApi } from "./modules/orders.js";
import { otApi } from "./modules/ot.js";
import { patientPackagesApi } from "./modules/patient-packages.js";
import { patientsApi } from "./modules/patients.js";
import { paymentsApi } from "./modules/payments.js";
import { pharmacyApi } from "./modules/pharmacy.js";
import { portalApi } from "./modules/portal.js";
import { printDataApi } from "./modules/print-data.js";
import { privacyRequestsApi } from "./modules/privacy-requests.js";
import { procurementApi } from "./modules/procurement.js";
import { publicApi } from "./modules/public.js";
import { qaApi } from "./modules/qa.js";
import { qualityApi } from "./modules/quality.js";
import { queuesApi } from "./modules/queues.js";
import { radiologyApi } from "./modules/radiology.js";
import { registrationApi } from "./modules/registration.js";
import { regulatoryApi } from "./modules/regulatory.js";
import { reportsApi } from "./modules/reports.js";
import { researchApi } from "./modules/research.js";
import { retrospectiveApi } from "./modules/retrospective.js";
import { roiRequestsApi } from "./modules/roi-requests.js";
import { schedulingApi } from "./modules/scheduling.js";
import { schemaApi } from "./modules/schema.js";
import { securityApi } from "./modules/security.js";
import { sensitivePatientsApi } from "./modules/sensitive-patients.js";
import { setupApi } from "./modules/setup.js";
import { sharingApi } from "./modules/sharing.js";
import { signaturesApi } from "./modules/signatures.js";
import { specialtyApi } from "./modules/specialty.js";
import { stationHandoffsApi } from "./modules/station-handoffs.js";
import { stationsApi } from "./modules/stations.js";
import { storeApi } from "./modules/store.js";
import { systemHealthApi } from "./modules/system-health.js";
import { tatApi } from "./modules/tat.js";
import { telemedicineApi } from "./modules/telemedicine.js";
import { terminologyApi } from "./modules/terminology.js";
import { tokensApi } from "./modules/tokens.js";
import { trialAdverseEventsApi } from "./modules/trial-adverse-events.js";
import { trialIrbApi } from "./modules/trial-irb.js";
import { trialRandomizationsApi } from "./modules/trial-randomizations.js";
import { trialVisitsApi } from "./modules/trial-visits.js";
import { tvApi } from "./modules/tv.js";
import { uhiApi } from "./modules/uhi.js";
import { uploadApi } from "./modules/upload.js";
import { usersApi } from "./modules/users.js";
import { utilizationReviewApi } from "./modules/utilization-review.js";
import { vpnApi } from "./modules/vpn.js";
import { vteAssessmentsApi } from "./modules/vte-assessments.js";
import { vulnerabilitiesApi } from "./modules/vulnerabilities.js";
import { webhooksApi } from "./modules/webhooks.js";
import { widgetTemplatesApi } from "./modules/widget-templates.js";

export const api = {
  ...abdmApi,
  ...accessApi,
  ...accessAlertsApi,
  ...accessGroupsApi,
  ...adminApi,
  ...advanceDirectivesApi,
  ...aebasApi,
  ...aiApi,
  ...ambulanceApi,
  ...analyticsApi,
  ...apiApi,
  ...appApi,
  ...approvalsApi,
  ...assetsApi,
  ...auditApi,
  ...authApi,
  ...backupsApi,
  ...bedsideApi,
  ...bereavementApi,
  ...billingApi,
  ...blogApi,
  ...bloodBankApi,
  ...bmeApi,
  ...breakGlassApi,
  ...bridgeApi,
  ...campApi,
  ...careViewApi,
  ...caseMgmtApi,
  ...caseSheetsApi,
  ...cdsApi,
  ...chronicCareApi,
  ...ckbApi,
  ...clientErrorsApi,
  ...clinicalApi,
  ...clinicalNotesApi,
  ...clinicalTrialsApi,
  ...cmsApi,
  ...commandCenterApi,
  ...communicationsApi,
  ...complianceRequirementsApi,
  ...consentApi,
  ...counterDisplayApi,
  ...cssdApi,
  ...dashboardApi,
  ...dashboardsApi,
  ...dataProcessorsApi,
  ...dataQualityApi,
  ...debugApi,
  ...deviceApi,
  ...deviceIngestApi,
  ...devicePairingApi,
  ...devicesApi,
  ...dietApi,
  ...digestApi,
  ...disposalsApi,
  ...doctorApi,
  ...doctorPayoutsApi,
  ...doctorsApi,
  ...documentIngestionApi,
  ...documentsApi,
  ...emergencyApi,
  ...encountersApi,
  ...facilitiesApi,
  ...fhirApi,
  ...flowApi,
  ...flowsApi,
  ...formsApi,
  ...frontOfficeApi,
  ...geoApi,
  ...healthApi,
  ...healthIntelApi,
  ...historyImportApi,
  ...homeHealthApi,
  ...homeVisitsApi,
  ...hospiceApi,
  ...housekeepingApi,
  ...hrApi,
  ...hrmsApi,
  ...iamApi,
  ...icuApi,
  ...immunizationsApi,
  ...indentApi,
  ...infectionControlApi,
  ...insuranceApi,
  ...integrationApi,
  ...integrationsApi,
  ...ipdApi,
  ...knowledgeApi,
  ...labApi,
  ...lmsApi,
  ...ltcApi,
  ...marketingApi,
  ...mastersApi,
  ...materialsApi,
  ...micrositeApi,
  ...migrationsApi,
  ...mrdApi,
  ...multiHospitalApi,
  ...nabhApi,
  ...newsApi,
  ...newsFeedApi,
  ...nhcxApi,
  ...notesApi,
  ...notificationsApi,
  ...nurseApi,
  ...oauthApi,
  ...occHealthApi,
  ...onboardingApi,
  ...opdApi,
  ...brandingApi,
  ...registrationApi,
  ...openapiApi,
  ...orchestrationApi,
  ...orderSetsApi,
  ...ordersApi,
  ...otApi,
  ...patientPackagesApi,
  ...patientsApi,
  ...paymentsApi,
  ...pharmacyApi,
  ...portalApi,
  ...printDataApi,
  ...privacyRequestsApi,
  ...procurementApi,
  ...publicApi,
  ...qaApi,
  ...qualityApi,
  ...queuesApi,
  ...radiologyApi,
  ...regulatoryApi,
  ...reportsApi,
  ...researchApi,
  ...retrospectiveApi,
  ...roiRequestsApi,
  ...schedulingApi,
  ...schemaApi,
  ...securityApi,
  ...sensitivePatientsApi,
  ...setupApi,
  ...sharingApi,
  ...signaturesApi,
  ...specialtyApi,
  ...stationHandoffsApi,
  ...stationsApi,
  ...storeApi,
  ...systemHealthApi,
  ...tatApi,
  ...telemedicineApi,
  ...terminologyApi,
  ...tokensApi,
  ...trialAdverseEventsApi,
  ...trialIrbApi,
  ...trialRandomizationsApi,
  ...trialVisitsApi,
  ...tvApi,
  ...uhiApi,
  ...uploadApi,
  ...usersApi,
  ...utilizationReviewApi,
  ...vpnApi,
  ...vteAssessmentsApi,
  ...vulnerabilitiesApi,
  ...webhooksApi,
  ...widgetTemplatesApi,
};
