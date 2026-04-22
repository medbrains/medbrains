import type {
  AddAmbulanceTripLogRequest,
  AddFieldToFormRequest,
  BedsideDailyScheduleItem,
  BedsideDietOrderItem,
  BedsideEducationVideoRow,
  BedsideEducationViewRow,
  BedsideLabResultItem,
  BedsideMedicationItem,
  BedsideNurseRequestRow,
  BedsideRealtimeFeedbackRow,
  BedsideSessionRow,
  BedsideVitalReading,
  CreateBedsideNurseRequestPayload,
  CreateBedsideSessionRequest,
  CreateBedsideVideoRequest,
  RecordBedsideVideoViewRequest,
  SubmitBedsideFeedbackRequest,
  UpdateBedsideRequestStatusPayload,
  UpdateBedsideVideoRequest,
  CommClinicalMessageRow,
  CommComplaintRow,
  CommCriticalAlertRow,
  CommFeedbackSurveyRow,
  CommMessageRow,
  CommTemplateRow,
  AmbulanceDriverRow,
  AmbulanceMaintenanceRow,
  AmbulanceRow,
  AmbulanceTripLogRow,
  AmbulanceTripRow,
  Appointment,
  AppointmentWithPatient,
  AvailableSlot,
  BedOccupancyRow,
  BedTypeRow,
  BookAppointmentRequest,
  CancelAppointmentRequest,
  ClinicalIndicatorRow,
  CreateAmbulanceDriverRequest,
  CreateAmbulanceMaintenanceRequest,
  CreateAmbulanceRequest,
  CreateAmbulanceTripRequest,
  CreateCommAlertRequest,
  CreateCommClinicalRequest,
  CreateCommComplaintRequest,
  CreateCommFeedbackRequest,
  CreateCommMessageRequest,
  CreateCommTemplateRequest,
  CreateFieldRequest,
  CreateFormRequest,
  CreateModuleLinkRequest,
  CreatePatientAddressRequest,
  CreatePatientAllergyRequest,
  CreatePatientConsentRequest,
  CreatePatientContactRequest,
  CreatePatientIdentifierRequest,
  CreatePatientRequest,
  CreateRegulatoryBodyRequest,
  CreateRegulatoryLinkRequest,
  CreateSectionRequest,
  CustomRole,
  DepartmentRow,
  DeptRevenueRow,
  AnalyticsDoctorRevenueRow,
  ErVolumeRow,
  Facility,
  FieldAccessLevel,
  FieldAuditEntry,
  FieldDetailResponse,
  FieldMasterFull,
  FieldRegulatoryLinkRow,
  FormDetailResponse,
  FormDiffResponse,
  FormMaster,
  FormVersionSnapshot,
  FormVersionSummary,
  GeoCountry,
  GeoDistrict,
  GeoState,
  GeoSubdistrict,
  GeoTown,
  HealthResponse,
  IpdCensusRow,
  LabTatRow,
  LocationRow,
  MasterItem,
  CreateMasterItemRequest,
  CreateScheduleExceptionRequest,
  CreateScheduleRequest,
  DoctorSchedule,
  DoctorScheduleException,
  FeedbackStatsResponse,
  ResolveCommAlertRequest,
  ResolveCommComplaintRequest,
  UpdateAmbulanceDriverRequest,
  UpdateAmbulanceLocationRequest,
  UpdateAmbulanceMaintenanceRequest,
  UpdateAmbulanceRequest,
  UpdateAmbulanceTripRequest,
  UpdateAmbulanceTripStatusRequest,
  UpdateCommComplaintRequest,
  UpdateCommMessageStatusRequest,
  UpdateCommTemplateRequest,
  UpdateMasterItemRequest,
  UpdateScheduleRequest,
  RescheduleAppointmentRequest,
  InsuranceProvider,
  CreateInsuranceProviderRequest,
  UpdateInsuranceProviderRequest,
  ModuleConfig,
  ModuleFormLink,
  ModuleFormLinkRow,
  MpiMatchRequest,
  MpiMatchResult,
  OpdFootfallRow,
  OtUtilizationRow,
  OnboardingInitRequest,
  OnboardingInitResponse,
  OnboardingProgress,
  OnboardingSetupRequest,
  OnboardingStatusResponse,
  Patient,
  PatientAddress,
  PatientAllergy,
  PatientAppointmentRow,
  PatientConsent,
  PatientContact,
  PatientIdentifier,
  PatientInvoiceRow,
  PatientLabOrderRow,
  PatientDocument,
  PatientFamilyLink,
  PatientListResponse,
  PatientMergeHistory,
  PatientVisitRow,
  PharmacySalesRow,
  FamilyLinkRow,
  CreateFamilyLinkRequest,
  MergePatientRequest,
  CreateDocumentRequest,
  PaymentMethodRow,
  PincodeResult,
  PublishFormRequest,
  RegulatoryBody,
  RegulatoryBodyFull,
  RegulatoryClauseWithContext,
  ReorderItem,
  RequirementLevel,
  ResolvedFormDefinition,
  SequenceRow,
  ServiceRow,
  SetupUser,
  TaxCategoryRow,
  UpdateSecureDeviceSettingRequest,
  TenantFieldOverride,
  SecureTenantSettingRow,
  TenantSettingsRow,
  TenantSummary,
  CsvImportRequest,
  CsvImportResult,
  SeedModuleMastersRequest,
  SeedModuleMastersResponse,
  PrintTemplateRequest,
  UpdateFieldRequest,
  UpdateFormFieldRequest,
  UpdateFormRequest,
  UpdatePatientRequest,
  UpdateRegulatoryBodyRequest,
  UpdateRegulatoryLinkRequest,
  UpdateSectionRequest,
  // Integration Hub
  CreatePipelineRequest,
  EventSchema,
  ExecutionListResponse,
  IntegrationExecution,
  IntegrationNodeTemplate,
  IntegrationPipeline,
  ModuleEntitySchema,
  ModuleSummary,
  PipelineListResponse,
  SchemaField,
  TriggerPipelineRequest,
  UpdatePipelineRequest,
  UpdatePipelineStatusRequest,
  // Indent / Store
  IndentRequisitionListResponse,
  IndentRequisitionDetailResponse,
  IndentRequisition,
  CreateIndentRequisitionRequest,
  ApproveIndentRequest,
  IssueIndentRequest,
  StoreCatalog,
  CreateStoreCatalogRequest,
  UpdateStoreCatalogRequest,
  StockMovementListResponse,
  StoreStockMovement,
  CreateStoreStockMovementRequest,
  // Inventory Phase 2
  ConsumptionAnalysisRow,
  DeadStockRow,
  PurchaseConsumptionTrendRow,
  InventoryValuationRow,
  ComplianceCheckRow,
  FsnAnalysisRow,
  AbcAnalysisRow,
  VedAnalysisRow,
  PatientConsumableIssue,
  IssueToPatientRequest,
  DepartmentIssueRequest,
  ReturnToStoreRequest,
  ImplantRegistryEntry,
  CreateImplantRequest,
  UpdateImplantRequest,
  EquipmentCondemnation,
  CreateCondemnationRequest,
  UpdateCondemnationStatusRequest,
  ReorderAlert,
  ConsignmentUsageRequest,
  VendorPerformanceRow,
  VendorComparisonRow,
  SupplierPayment,
  CreateSupplierPaymentRequest,
  UpdateSupplierPaymentRequest,
  CreateEmergencyPoRequest,
  // OPD
  EncounterListResponse,
  CreateEncounterRequest,
  CreateEncounterResponse,
  Encounter,
  UpdateEncounterRequest,
  QueueEntry,
  Vital,
  CreateVitalRequest,
  Consultation,
  CreateConsultationRequest,
  UpdateConsultationRequest,
  Diagnosis,
  CreateDiagnosisRequest,
  PrescriptionWithItems,
  CreatePrescriptionRequest,
  PrescriptionTemplate,
  CreatePrescriptionTemplateRequest,
  PrescriptionHistoryItem,
  MedicalCertificate,
  CreateMedicalCertificateRequest,
  VitalHistoryPoint,
  ReferralWithNames,
  CreateReferralRequest,
  ProcedureCatalog,
  ProcedureOrderWithName,
  CreateProcedureOrderRequest,
  DuplicateOrderInfo,
  Icd10Code,
  ChiefComplaintMaster,
  SnomedCode,
  BookAppointmentGroupRequest,
  WaitEstimate,
  AdmitFromOpdRequest,
  AdmitFromOpdResponse,
  AvailableBed,
  // Post-Consultation
  DoctorDocket,
  PatientReminder,
  CreateReminderRequest,
  PatientFeedback,
  CreateFeedbackRequest,
  ProcedureConsent,
  CreateConsentRequest,
  ConsultationTemplate,
  CreateConsultationTemplateRequest,
  PatientDiagnosisRow,
  // Billing
  InvoiceListResponse,
  CreateInvoiceRequest,
  InvoiceDetailResponse,
  Invoice,
  AddInvoiceItemRequest,
  InvoiceItem,
  RecordPaymentRequest,
  Payment,
  ChargeMaster,
  CreateChargeMasterRequest,
  UpdateChargeMasterRequest,
  BillingPackage,
  CreatePackageRequest,
  UpdatePackageRequest,
  PackageDetailResponse,
  RatePlan,
  CreateRatePlanRequest,
  UpdateRatePlanRequest,
  RatePlanDetailResponse,
  InvoiceDiscount,
  AddDiscountRequest,
  Refund,
  CreateRefundRequest,
  CreditNote,
  CreateCreditNoteRequest,
  Receipt,
  InsuranceClaim,
  CreateInsuranceClaimRequest,
  UpdateInsuranceClaimRequest,
  ManualAutoChargeRequest,
  ManualAutoChargeResponse,
  // Billing Phase 2
  PatientAdvance,
  AdvanceAdjustment,
  CreateAdvanceRequest,
  AdjustAdvanceRequest,
  RefundAdvanceRequest,
  CreateInterimInvoiceRequest,
  CorporateClient,
  CorporateEnrollment,
  CreateCorporateRequest,
  UpdateCorporateRequest,
  CreateEnrollmentRequest,
  BillingSummaryReport,
  DepartmentRevenueRow,
  CollectionEfficiencyReport,
  AgingBucket,
  DailySummary,
  // Billing Phase 2b
  DayEndClose,
  BadDebtWriteOff,
  TpaRateCard,
  CreateDayCloseRequest,
  CreateWriteOffRequest,
  ApproveWriteOffRequest,
  CreateTpaRateCardRequest,
  UpdateTpaRateCardRequest,
  DoctorRevenueRow,
  InsurancePanelRow,
  ReconciliationReport,
  AuditLogResponse,
  // Billing Phase 3
  ExchangeRate,
  CreateExchangeRateRequest,
  InvoicePrintData,
  BillingThresholdStatus,
  SchemeRateResult,
  CreditPatient,
  CreateCreditPatientRequest,
  UpdateCreditPatientRequest,
  CreditAgingRow,
  DualInsuranceResult,
  GlAccount,
  CreateGlAccountRequest,
  UpdateGlAccountRequest,
  JournalEntry,
  JournalEntryDetail,
  CreateJournalEntryRequest,
  BankTransaction,
  ImportBankTransactionsRequest,
  ImportBankTransactionsResponse,
  MatchBankTransactionRequest,
  AutoReconcileResponse,
  TdsDeduction,
  CreateTdsRequest,
  GstReturnSummary,
  GenerateGstrRequest,
  HsnSummaryRow,
  FinancialMisReport,
  ProfitLossDeptRow,
  ErpExportLog,
  ErpExportRequest,
  // Lab
  LabOrderListResponse,
  CreateLabOrderRequest,
  LabOrderDetailResponse,
  LabOrder,
  LabResult,
  AddResultsRequest,
  LabTestCatalog,
  CreateLabCatalogRequest,
  UpdateLabCatalogRequest,
  LabTestPanel,
  LabPanelDetailResponse,
  CreateLabPanelRequest,
  UpdateLabPanelRequest,
  RejectSampleRequest,
  // Lab Phase 2
  LabResultAmendment,
  LabCriticalAlert,
  LabReagentLot,
  LabQcResult,
  LabCalibration,
  LabOutsourcedOrder,
  LabPhlebotomyQueueItem,
  AmendResultRequest,
  UpdateReportStatusRequest,
  AddOnTestRequest,
  CreateReagentLotRequest,
  UpdateReagentLotRequest,
  CreateQcResultRequest,
  CreateCalibrationRequest,
  CreatePhlebotomyEntryRequest,
  UpdatePhlebotomyStatusRequest,
  CreateOutsourcedOrderRequest,
  UpdateOutsourcedOrderRequest,
  CumulativeReportResponse,
  TatMonitoringRow,
  // Lab Phase 3
  LabHomeCollection,
  LabCollectionCenter,
  LabSampleArchive,
  LabReportDispatch,
  LabReportTemplate,
  LabEqasResult,
  LabProficiencyTest,
  LabNablDocument,
  LabHistopathReport,
  LabCytologyReport,
  LabMolecularReport,
  LabB2bClient,
  LabB2bRate,
  LabTatAnalyticsRow,
  AutoValidateResult,
  LabCrossmatchLink,
  CreateHomeCollectionRequest,
  UpdateHomeCollectionRequest,
  HomeCollectionStatusRequest,
  CreateCollectionCenterRequest,
  UpdateCollectionCenterRequest,
  CreateSampleArchiveRequest,
  CreateReportDispatchRequest,
  CreateReportTemplateRequest,
  UpdateReportTemplateRequest,
  CreateEqasResultRequest,
  UpdateEqasResultRequest,
  CreateProficiencyTestRequest,
  CreateNablDocumentRequest,
  UpdateNablDocumentRequest,
  CreateHistopathReportRequest,
  CreateCytologyReportRequest,
  CreateMolecularReportRequest,
  CreateB2bClientRequest,
  UpdateB2bClientRequest,
  CreateB2bRateRequest,
  HomeCollectionStatsRow,
  ReagentConsumptionRow,
  // Radiology
  RadiologyOrderListResponse,
  CreateRadiologyOrderRequest,
  RadiologyOrderDetailResponse,
  RadiologyOrder,
  RadiologyReport,
  RadiologyModality,
  RadiationDoseRecord,
  RadiologyTatRow,
  CreateRadiologyAppointmentRequest,
  CancelRadiologyOrderRequest,
  CreateRadiologyReportRequest,
  CreateModalityRequest,
  UpdateModalityRequest,
  RecordDoseRequest,
  // Pharmacy
  PharmacyOrderListResponse,
  CreatePharmacyOrderRequest,
  PharmacyOrderDetailResponse,
  PharmacyOrder,
  PharmacyCatalog,
  CreatePharmacyCatalogRequest,
  UpdatePharmacyCatalogRequest,
  PharmacyStockTransaction,
  CreateStockTransactionRequest,
  // Pharmacy Phase 2
  PharmacyValidationResult,
  CreateOtcSaleRequest,
  CreateDischargeMedsRequest,
  NdpsListResponse,
  NdpsRegisterEntry,
  CreateNdpsEntryRequest,
  NdpsReportResponse,
  PharmacyBatch,
  CreatePharmacyBatchRequest,
  NearExpiryRow,
  PharmacyDeadStockRow,
  PharmacyStoreAssignment,
  CreateStoreAssignmentRequest,
  PharmacyTransferRequest,
  CreatePharmacyTransferRequest,
  PharmacyReturn,
  CreatePharmacyReturnRequest,
  ProcessPharmacyReturnRequest,
  PharmacyConsumptionRow,
  PharmacyAbcVedRow,
  DrugUtilizationRow,
  // Blood Bank
  DonorListResponse,
  BloodDonor,
  CreateDonorRequest,
  BloodDonation,
  CreateDonationRequest,
  UpdateDonationRequest,
  BloodComponent,
  CreateComponentRequest,
  UpdateComponentStatusRequest,
  CrossmatchRequest,
  CreateCrossmatchRequestBody,
  UpdateCrossmatchRequestBody,
  TransfusionRecord,
  CreateTransfusionRequest,
  RecordReactionRequest,
  TtiReport,
  HemovigilanceReport,
  // Blood Bank Phase 2
  BbRecruitmentCampaignRow,
  CreateBbCampaignRequest,
  UpdateBbCampaignRequest,
  BbColdChainDeviceRow,
  CreateBbDeviceRequest,
  BbColdChainReadingRow,
  AddBbReadingRequest,
  BbBloodReturnRow,
  CreateBbReturnRequest,
  InspectBbReturnRequest,
  BbMsbosGuidelineRow,
  CreateBbMsbosRequest,
  BbLookbackEventRow,
  CreateBbLookbackRequest,
  UpdateBbLookbackRequest,
  BbBillingItemRow,
  CreateBbBillingRequest,
  BbSbtcReport,
  // Consent Management
  ConsentTemplate,
  ConsentAuditEntry,
  ConsentSignatureMetadata,
  CreateConsentTemplateRequest,
  UpdateConsentTemplateRequest,
  VerifyConsentRequest,
  VerifyConsentResponse,
  ConsentSummaryItem,
  RevokeConsentRequest,
  CreateConsentSignatureRequest,
  // Camp Management
  Camp,
  CampTeamMember,
  CampRegistration,
  CampScreening,
  CampLabSample,
  CampBillingRecord,
  CampFollowup,
  CreateCampRequest,
  UpdateCampRequest,
  CancelCampRequest,
  AddCampTeamMemberRequest,
  CreateCampRegistrationRequest,
  UpdateCampRegistrationRequest,
  CreateCampScreeningRequest,
  CreateCampLabSampleRequest,
  LinkCampLabSampleRequest,
  CreateCampBillingRequest,
  CreateCampFollowupRequest,
  UpdateCampFollowupRequest,
  CampStatsResponse,
  // CSSD
  CssdSterilizer,
  CssdInstrument,
  CssdInstrumentSet,
  CssdSetItem,
  CssdSterilizationLoad,
  CssdLoadItem,
  CssdIndicatorResult,
  CssdIssuance,
  CssdMaintenanceLog,
  CreateCssdInstrumentRequest,
  UpdateCssdInstrumentRequest,
  CreateCssdSetRequest,
  CreateCssdSterilizerRequest,
  UpdateCssdSterilizerRequest,
  CreateCssdLoadRequest,
  UpdateCssdLoadStatusRequest,
  AddCssdLoadItemRequest,
  RecordCssdIndicatorRequest,
  CreateCssdIssuanceRequest,
  CreateCssdMaintenanceRequest,
  // Diet & Kitchen
  DietTemplate,
  DietOrder,
  KitchenMenu,
  KitchenMenuItem,
  MealPreparation,
  MealCount,
  KitchenInventory,
  KitchenAudit,
  CreateDietTemplateRequest,
  UpdateDietTemplateRequest,
  CreateDietOrderRequest,
  UpdateDietOrderRequest,
  CreateKitchenMenuRequest,
  CreateMenuItemRequest,
  CreateMealPrepRequest,
  UpdateMealPrepStatusRequest,
  CreateMealCountRequest,
  CreateKitchenInventoryRequest,
  UpdateKitchenInventoryRequest,
  CreateKitchenAuditRequest,
  // ICU
  IcuFlowsheet,
  IcuVentilatorRecord,
  IcuScore,
  IcuDevice,
  IcuBundleCheck,
  IcuNutrition,
  IcuNeonatalRecord,
  IcuLosAnalytics,
  DeviceInfectionRate,
  CreateIcuFlowsheetRequest,
  CreateIcuVentilatorRequest,
  CreateIcuScoreRequest,
  CreateIcuDeviceRequest,
  CreateIcuBundleCheckRequest,
  CreateIcuNutritionRequest,
  CreateIcuNeonatalRequest,
  // IPD
  AdmissionListResponse,
  CreateAdmissionRequest,
  CreateAdmissionResponse,
  AdmissionDetailResponse,
  Admission,
  UpdateAdmissionRequest,
  TransferBedRequest,
  DischargeRequest,
  NursingTask,
  CreateNursingTaskRequest,
  UpdateNursingTaskRequest,
  // IPD Clinical Expansion
  IpdProgressNote,
  CreateProgressNoteRequest,
  UpdateProgressNoteRequest,
  IpdClinicalAssessment,
  CreateAssessmentRequest,
  IpdMedicationAdministration,
  CreateMarRequest,
  UpdateMarRequest,
  IpdIntakeOutput,
  CreateIntakeOutputRequest,
  IoBalanceResponse,
  IpdNursingAssessment,
  CreateNursingAssessmentRequest,
  IpdCarePlan,
  CreateCarePlanRequest,
  UpdateCarePlanRequest,
  IpdHandoverReport,
  CreateHandoverRequest,
  IpdDischargeChecklist,
  UpdateDischargeChecklistRequest,
  // IPD Phase 2
  Ward,
  WardListRow,
  WardBedMapping,
  WardBedRow,
  CreateWardRequest,
  UpdateWardRequest,
  AssignBedToWardRequest,
  BedDashboardSummary,
  BedDashboardRow,
  UpdateBedStatusRequest,
  AdmissionAttender,
  CreateAttenderRequest,
  DischargeSummaryTemplate,
  CreateDischargeTemplateRequest,
  IpdDischargeSummary,
  CreateDischargeSummaryRequest,
  UpdateDischargeSummaryRequest,
  CensusWardRow,
  OccupancyRow,
  AlosRow,
  DischargeStatRow,
  // OT
  OtRoom,
  CreateOtRoomRequest,
  UpdateOtRoomRequest,
  OtBooking,
  OtBookingListResponse,
  CreateOtBookingRequest,
  UpdateOtBookingRequest,
  UpdateOtBookingStatusRequest,
  OtPreopAssessment,
  CreatePreopAssessmentRequest,
  UpdatePreopAssessmentRequest,
  OtSurgicalSafetyChecklist,
  CreateSafetyChecklistRequest,
  UpdateSafetyChecklistRequest,
  OtCaseRecord,
  CreateCaseRecordRequest,
  UpdateCaseRecordRequest,
  OtAnesthesiaRecord,
  CreateAnesthesiaRecordRequest,
  UpdateAnesthesiaRecordRequest,
  OtPostopRecord,
  CreatePostopRecordRequest,
  UpdatePostopRecordRequest,
  OtSurgeonPreference,
  CreateSurgeonPreferenceRequest,
  UpdateSurgeonPreferenceRequest,
  // IPD Phase 2b
  IpTypeConfiguration,
  CreateIpTypeRequest,
  UpdateIpTypeRequest,
  AdmissionChecklist,
  CreateChecklistItemsRequest,
  ToggleChecklistItemRequest,
  BedReservation,
  CreateBedReservationRequest,
  UpdateBedReservationStatusRequest,
  BedTurnaroundLog,
  CreateBedTurnaroundRequest,
  IpdClinicalDocumentation,
  CreateClinicalDocRequest,
  UpdateClinicalDocRequest,
  RestraintMonitoringLog,
  CreateRestraintCheckRequest,
  IpdTransferLog,
  CreateTransferRequest,
  IpdDeathSummary,
  CreateDeathSummaryRequest,
  UpdateDeathSummaryRequest,
  IpdBirthRecord,
  CreateBirthRecordRequest,
  UpdateBirthRecordRequest,
  IpdDischargeTatLog,
  InitDischargeTatRequest,
  UpdateDischargeTatRequest,
  OtConsumableUsage,
  CreateOtConsumableRequest,
  RoomUtilization,
  SurgeonCaseloadEntry,
  AnesthesiaComplicationEntry,
  // IPD Phase 3a
  InvestigationsResponse,
  EstimatedCostResponse,
  BillingSummaryResponse,
  AdmissionPrintData,
  LinkMlcRequest,
  CreateDashboardRequest,
  CreateWidgetRequest,
  Dashboard,
  DashboardStatsResponse,
  DashboardSummary,
  DashboardWidget,
  DashboardWithWidgets,
  PersonalizeDashboardRequest,
  UpdateDashboardRequest,
  UpdateLayoutRequest,
  UpdateWidgetRequest,
  WidgetAccessLevel,
  WidgetDataResponse,
  WidgetTemplate,
  // Screens
  CreateScreenRequest,
  CreateSidecarRequest,
  ResolvedScreen,
  ResolvedSidecar,
  ScreenMaster,
  ScreenOverrideRequest,
  ScreenSidecar,
  ScreenSummary,
  ScreenVersionSnapshot,
  ScreenVersionSummary,
  TenantScreenOverride,
  UpdateScreenRequest,
  // CDS
  CheckDrugInteractionsRequest,
  DrugSafetyCheckResult,
  DrugInteraction,
  CreateDrugInteractionRequest,
  CriticalValueRule,
  CreateCriticalValueRuleRequest,
  ClinicalProtocol,
  CreateClinicalProtocolRequest,
  RestrictedDrugApproval,
  CreateRestrictedDrugApprovalRequest,
  PreAuthorizationRequest,
  CreatePreAuthRequest,
  UpdatePreAuthRequest,
  PgLogbookEntry,
  CreatePgLogbookRequest,
  CoSignatureRequest,
  CreateCoSignatureRequest,
  // Emergency
  ErVisit,
  ErTriageAssessment,
  ErResuscitationLog,
  ErCodeActivation,
  MlcCase,
  MlcDocument,
  MlcPoliceIntimation,
  MassCasualtyEvent,
  AdmitFromErRequest,
  CreateErVisitRequest,
  UpdateErVisitRequest,
  CreateTriageRequest,
  CreateResuscitationLogRequest,
  CreateCodeActivationRequest,
  DeactivateCodeRequest,
  CreateMlcCaseRequest,
  UpdateMlcCaseRequest,
  CreateMlcDocumentRequest,
  CreatePoliceIntimationRequest,
  CreateMassCasualtyEventRequest,
  UpdateMassCasualtyEventRequest,
  // Procurement
  Vendor,
  CreateVendorRequest,
  UpdateVendorRequest,
  StoreLocation,
  CreateStoreLocationRequest,
  UpdateStoreLocationRequest,
  PurchaseOrder,
  PoListResponse,
  PoDetailResponse,
  CreatePurchaseOrderRequest,
  GoodsReceiptNote,
  GrnListResponse,
  GrnDetailResponse,
  CreateGrnRequest,
  RateContract,
  RcDetailResponse,
  CreateRateContractRequest,
  BatchStock,
  // Quality Management
  QualityIndicator,
  QualityIndicatorValue,
  QualityDocument,
  QualityIncident,
  QualityCapa,
  QualityCommittee,
  QualityCommitteeMeeting,
  QualityActionItem,
  QualityAccreditationStandard,
  QualityAccreditationCompliance,
  QualityAudit,
  CreateQualityIndicatorRequest,
  RecordIndicatorValueRequest,
  CreateQualityDocumentRequest,
  CreateQualityIncidentRequest,
  UpdateQualityIncidentRequest,
  CreateCapaRequest,
  CreateQualityCommitteeRequest,
  CreateMeetingRequest,
  CreateAccreditationStandardRequest,
  UpdateComplianceRequest,
  CreateQualityAuditRequest,
  PendingAckUser,
  AutoScheduleRequest,
  EvidenceCompilation,
  // Infection Control
  InfectionSurveillanceEvent,
  InfectionDeviceDay,
  AntibioticStewardshipRequest,
  AntibioticConsumptionRecord,
  BiowasteRecord,
  NeedleStickIncident,
  HandHygieneAudit,
  CultureSurveillance,
  OutbreakEvent,
  OutbreakContact,
  CreateSurveillanceEventRequest,
  RecordDeviceDaysRequest,
  CreateStewardshipRequest,
  ReviewStewardshipRequest,
  CreateBiowasteRecordRequest,
  CreateNeedleStickIncidentRequest,
  CreateHygieneAuditRequest,
  CreateCultureSurveillanceRequest,
  CreateOutbreakRequest,
  UpdateOutbreakRequest,
  CreateOutbreakContactRequest,
  // Housekeeping
  CleaningSchedule,
  CreateCleaningScheduleRequest,
  UpdateCleaningScheduleRequest,
  CleaningTask,
  CreateCleaningTaskRequest,
  UpdateTaskStatusRequest,
  RoomTurnaround,
  CreateTurnaroundRequest,
  PestControlSchedule,
  CreatePestControlScheduleRequest,
  UpdatePestControlScheduleRequest,
  PestControlLog,
  CreatePestControlLogRequest,
  LinenItem,
  CreateLinenItemRequest,
  UpdateLinenItemRequest,
  LinenMovement,
  CreateLinenMovementRequest,
  LaundryBatch,
  CreateLaundryBatchRequest,
  LinenParLevel,
  UpsertParLevelRequest,
  LinenCondemnation,
  CreateLinenCondemnationRequest,
  BmwScheduleEntry,
  SharpReplacementRequest,
  // HR & Staff Management
  Designation,
  CreateDesignationRequest,
  UpdateDesignationRequest,
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeCredential,
  CreateCredentialRequest,
  UpdateCredentialRequest,
  ShiftDefinition,
  CreateShiftRequest,
  UpdateShiftRequest,
  DutyRoster,
  CreateRosterRequest,
  AttendanceRecord,
  CreateAttendanceRequest,
  LeaveBalance,
  LeaveRequest,
  CreateLeaveRequestInput,
  LeaveActionRequest,
  OnCallSchedule,
  CreateOnCallRequest,
  TrainingProgram,
  CreateTrainingProgramRequest,
  TrainingRecord,
  CreateTrainingRecordRequest,
  Appraisal,
  CreateAppraisalRequest,
  StatutoryRecord,
  CreateStatutoryRecordRequest,
  UserFacilityAssignment,
  AssignUserFacilitiesRequest,
  ComplianceRow,
  // Front Office & Reception
  VisitingHours,
  UpsertVisitingHoursRequest,
  VisitorRegistration,
  CreateVisitorRequest,
  VisitorPass,
  CreateVisitorPassRequest,
  RevokePassRequest,
  VisitorLog,
  QueuePriorityRule,
  UpsertQueuePriorityRequest,
  QueueDisplayConfig,
  UpsertDisplayConfigRequest,
  FrontOfficeEnquiryLog,
  CreateEnquiryRequest,
  QueueStatsResponse,
  BmeEquipment,
  BmePmSchedule,
  BmeWorkOrder,
  BmeCalibration,
  BmeContract,
  BmeBreakdown,
  BmeVendorEvaluation,
  BmeStatsResponse,
  CreateBmeEquipmentRequest,
  UpdateBmeEquipmentRequest,
  CreateBmePmScheduleRequest,
  UpdateBmePmScheduleRequest,
  CreateBmeWorkOrderRequest,
  UpdateBmeWorkOrderStatusRequest,
  CreateBmeCalibrationRequest,
  UpdateBmeCalibrationRequest,
  CreateBmeContractRequest,
  UpdateBmeContractRequest,
  CreateBmeBreakdownRequest,
  UpdateBmeBreakdownStatusRequest,
  CreateBmeVendorEvaluationRequest,
  BmeMtbfRow,
  BmeUptimeRow,
  // Facilities Management
  FmsGasReading,
  FmsGasCompliance,
  FmsFireEquipment,
  FmsFireInspection,
  FmsFireDrill,
  FmsFireNoc,
  FmsWaterTest,
  FmsWaterSchedule,
  FmsEnergyReading,
  FmsWorkOrder,
  FmsStatsResponse,
  CreateFmsGasReadingRequest,
  CreateFmsGasComplianceRequest,
  UpdateFmsGasComplianceRequest,
  CreateFmsFireEquipmentRequest,
  UpdateFmsFireEquipmentRequest,
  CreateFmsFireInspectionRequest,
  CreateFmsFireDrillRequest,
  CreateFmsFireNocRequest,
  UpdateFmsFireNocRequest,
  CreateFmsWaterTestRequest,
  CreateFmsWaterScheduleRequest,
  UpdateFmsWaterScheduleRequest,
  CreateFmsEnergyReadingRequest,
  CreateFmsWorkOrderRequest,
  UpdateFmsWorkOrderStatusRequest,
  // Security
  SecurityZone,
  SecurityAccessLog,
  SecurityAccessCard,
  SecurityCamera,
  SecurityIncident,
  SecurityPatientTag,
  SecurityTagAlert,
  SecurityCodeDebrief,
  CreateSecurityZoneRequest,
  UpdateSecurityZoneRequest,
  CreateSecurityAccessLogRequest,
  CreateSecurityAccessCardRequest,
  UpdateSecurityAccessCardRequest,
  CreateSecurityCameraRequest,
  UpdateSecurityCameraRequest,
  CreateSecurityIncidentRequest,
  UpdateSecurityIncidentRequest,
  CreateSecurityPatientTagRequest,
  ResolveSecurityTagAlertRequest,
  CreateSecurityCodeDebriefRequest,
  // MRD
  MrdMedicalRecord,
  MrdRecordMovement,
  MrdBirthRegister,
  MrdDeathRegister,
  MrdRetentionPolicy,
  CreateMrdRecordRequest,
  UpdateMrdRecordRequest,
  IssueMrdRecordRequest,
  CreateMrdBirthRequest,
  CreateMrdDeathRequest,
  CreateMrdRetentionPolicyRequest,
  UpdateMrdRetentionPolicyRequest,
  MrdMorbidityMortalityResponse,
  MrdAdmissionDischargeSummary,
  // Specialty Clinical: Cath Lab
  CathProcedure,
  CreateCathProcedureRequest,
  CathHemodynamic,
  CreateCathHemodynamicRequest,
  CathDevice,
  CreateCathDeviceRequest,
  CathStemiTimeline,
  CreateCathStemiEventRequest,
  CathPostMonitoring,
  CreateCathPostMonitoringRequest,
  // Specialty Clinical: Endoscopy
  EndoscopyProcedure,
  CreateEndoscopyProcedureRequest,
  EndoscopyScope,
  CreateEndoscopyScopeRequest,
  ScopeStatus,
  EndoscopyReprocessing,
  CreateEndoscopyReprocessingRequest,
  EndoscopyBiopsySpecimen,
  CreateEndoscopyBiopsyRequest,
  // Specialty Clinical: Psychiatry
  PsychPatient,
  CreatePsychPatientRequest,
  PsychAssessment,
  CreatePsychAssessmentRequest,
  PsychEctSession,
  CreatePsychEctRequest,
  PsychRestraint,
  CreatePsychRestraintRequest,
  PsychMhrbNotification,
  CreatePsychMhrbRequest,
  PsychCounselingSession,
  CreatePsychCounselingRequest,
  // Specialty Clinical: Maternity
  MaternityRegistration,
  CreateMaternityRegistrationRequest,
  AncVisit,
  CreateAncVisitRequest,
  LaborRecord,
  CreateLaborRecordRequest,
  DeliveryType,
  NewbornRecord,
  CreateNewbornRecordRequest,
  PostnatalRecord,
  CreatePostnatalRecordRequest,
  // Specialty Clinical: PMR / Audiology
  RehabPlan,
  CreateRehabPlanRequest,
  RehabSession,
  CreateRehabSessionRequest,
  AudiologyTest,
  CreateAudiologyTestRequest,
  PsychometricTest,
  CreatePsychometricTestRequest,
  // Specialty Clinical: Palliative / Mortuary / Nuclear Med
  DnrOrder,
  CreateDnrOrderRequest,
  PainAssessment,
  CreatePainAssessmentRequest,
  MortuaryRecord,
  CreateMortuaryRecordRequest,
  BodyStatus,
  NuclearMedSource,
  CreateNuclearMedSourceRequest,
  NuclearMedAdministration,
  CreateNuclearMedAdminRequest,
  // Specialty Clinical: Other Specialties
  SpecialtyTemplate,
  CreateSpecialtyTemplateRequest,
  SpecialtyRecord,
  CreateSpecialtyRecordRequest,
  DialysisSession,
  CreateDialysisSessionRequest,
  ChemoProtocol,
  CreateChemoProtocolRequest,
  // Documents
  DocumentTemplate,
  DocumentTemplateVersion,
  DocumentOutput,
  DocumentOutputSignature,
  DocumentFormReviewSchedule,
  DocumentOutputStats,
  CreateDocumentTemplateRequest,
  UpdateDocumentTemplateRequest,
  GenerateDocumentRequest,
  BatchGenerateRequest,
  VoidDocumentRequest,
  AddDocumentSignatureRequest,
  CreateReviewScheduleRequest,
  // Regulatory
  ComplianceDashboard,
  ComplianceChecklist,
  ComplianceChecklistWithItems,
  ComplianceChecklistItem,
  ComplianceGap,
  CreateChecklistRequest,
  UpdateChecklistRequest,
  ChecklistItemInput,
  AdrReport,
  CreateAdrRequest,
  UpdateAdrRequest,
  MateriovigilanceReport,
  CreateMvRequest,
  UpdateMvRequest,
  PcpndtForm,
  CreatePcpndtRequest,
  UpdatePcpndtRequest,
  PcpndtQuarterlySummary,
  ComplianceCalendarEvent,
  CreateCalendarEventRequest,
  UpdateCalendarEventRequest,
  // Insurance & TPA
  InsuranceVerification,
  PriorAuthRequestRow,
  PriorAuthDocument,
  PriorAuthAppeal,
  PaRequirementRule,
  InsuranceDashboard,
  PaCheckResult,
  PriorAuthDetail,
  RunVerificationRequest,
  CreatePriorAuthRequestBody,
  UpdatePriorAuthRequestBody,
  RespondPriorAuthRequest,
  CheckPaRequiredRequest,
  AttachDocumentRequest,
  CreateAppealRequest,
  UpdateAppealRequest,
  CreatePaRuleRequest,
  UpdatePaRuleRequest,
  // Order Sets
  OrderSetTemplate,
  OrderSetTemplateItem,
  OrderSetActivation,
  OrderSetUsageStats,
  TemplateWithItems,
  ActivationWithItems,
  ActivationResult,
  OrderSetAnalyticsSummary,
  CreateOrderSetTemplateRequest,
  UpdateOrderSetTemplateRequest,
  AddOrderSetItemRequest,
  UpdateOrderSetItemRequest,
  ActivateOrderSetRequest,
  // Care View
  WardGridResponse,
  MyTasksResponse,
  VitalsChecklistRow,
  HandoverSummaryResponse,
  DischargeReadinessRow,
  UpdatePrimaryNurseRequest,
  ChronicProgram,
  ChronicEnrollmentRow,
  MedicationTimelineEvent,
  DrugTimelineWithLabsResponse,
  AdherenceRow,
  AdherenceSummaryResponse,
  PatientOutcomeTarget,
  OutcomeDashboardResponse,
  PolypharmacyInteractionAlert,
  TreatmentSummaryResponse,
  CreateChronicProgramRequest,
  CreateChronicEnrollmentRequest,
  UpdateEnrollmentStatusRequest,
  CreateTimelineEventRequest,
  RecordAdherenceRequest,
  CreateOutcomeTargetRequest,
  UpdateOutcomeTargetRequest,
  // Retrospective
  RetrospectiveEntry,
  RetrospectiveSettings,
  CreateRetroEncounterRequest,
  ApproveRejectRequest,
  // Occupational Health
  OccHealthScreening,
  OccHealthDrugScreen,
  OccHealthVaccination,
  OccHealthInjuryReport,
  VaccinationComplianceRow,
  EmployerViewResponse,
  CreateOccScreeningRequest,
  UpdateOccScreeningRequest,
  CreateDrugScreenRequest,
  UpdateDrugScreenRequest,
  CreateVaccinationRequest,
  CreateInjuryRequest,
  UpdateInjuryRequest,
  // Utilization Review
  UtilizationReview,
  UrPayerCommunication,
  UrStatusConversion,
  UrAnalyticsSummary,
  LosComparisonRow,
  CreateUrReviewRequest,
  UpdateUrReviewRequest,
  CreateUrCommunicationRequest,
  CreateUrConversionRequest,
  // Case Management
  CaseAssignment,
  DischargeBarrier,
  CaseReferral,
  CaseloadRow,
  DispositionRow,
  BarrierAnalyticsRow,
  OutcomeAnalytics,
  CreateCaseAssignmentRequest,
  UpdateCaseAssignmentRequest,
  AutoAssignRequest,
  CreateDischargeBarrierRequest,
  UpdateDischargeBarrierRequest,
  CreateCaseReferralRequest,
  UpdateCaseReferralRequest,
  // Scheduling
  NoshowPredictionScore,
  SchedulingWaitlistEntry,
  SchedulingOverbookingRule,
  OverbookingRecommendation,
  AutoFillResult,
  NoshowRateRow,
  PredictionAccuracyReport,
  WaitlistStatsResponse,
  ScoreAppointmentRequest,
  ScoreBatchRequest,
  CreateWaitlistRequest,
  UpdateWaitlistRequest,
  OfferSlotRequest,
  RespondToOfferRequest,
  CreateOverbookingRuleRequest,
  UpdateOverbookingRuleRequest,
  // Batch 2 — Analytics & Reporting
  HaiRateRow,
  DeviceUtilizationRow,
  AntimicrobialConsumptionRow,
  SurgicalProphylaxisRow,
  CultureSensitivityRow,
  MdroRow,
  CreateExposureRequest,
  IcMeeting,
  CreateIcMeetingRequest,
  MonthlySurveillanceReport,
  CreateOutbreakRcaRequest,
  ScheduleAuditsRequest,
  AuditFinding,
  CreateAuditFindingRequest,
  CommitteeDashboard,
  CreateMortalityReviewRequest,
  PatientSafetyIndicator,
  DepartmentScorecard,
  AutoPopulateRequest,
  RegulatorySubmission,
  CreateRegulatorySubmissionRequest,
  StaffCredentialSummary,
  LicenseDashboardItem,
  NablDocumentSummary,
  BulkCreateUsersRequest,
  CompletenessCheck,
  SystemHealth,
  SchedulingConflict,
  ScheduleAnalytics,
  CreateRecurringRequest,
  CreateBlockRequest,
  OccHealthHazard,
  CreateOccHealthHazardRequest,
  OccHealthAnalytics,
  ReturnToWorkClearanceRequest,
  PharmacyDispatchStatus,
  ReferralTrackingRow,
  FollowupComplianceRow,
  DischargeSummary,
  BedTransferRequest,
  ExpectedDischargeRow,
  DrugInteractionCheckRequest,
  DrugInteractionResult,
  PrescriptionAuditEntry,
  FormularyCheckResult,
  BillingServicePackage,
  CreateBillingServicePackageRequest,
  CopayCalculation,
  ErFastInvoiceRequest,
  CampAnalytics,
  CampReport,
  SchedulePmRequest,
  EnergyAnalytics,
  VisitorAnalytics,
  QueueMetrics,
  TrainingComplianceRow,
  // Command Center
  PatientFlowSnapshot,
  HourlyFlowRow,
  BottleneckRow,
  DepartmentLoadRow,
  DepartmentAlertRow,
  AlertThresholdRow,
  CreateAlertThresholdRequest,
  UpdateAlertThresholdRequest,
  PendingDischargeRow,
  BedTurnaroundRow,
  TurnaroundStatsRow,
  TransportRequestRow,
  CreateTransportRequest,
  UpdateTransportRequest,
  AssignTransportRequest,
  KpiTile,
  // Audit Trail
  AuditLogEntry,
  AuditLogSummary,
  AuditLogQuery,
  AccessLogEntry,
  AccessLogQuery,
  AuditStats,
  LogAccessRequest,
  // Print Data
  PrescriptionPrintData,
  LabReportPrintData,
  RadiologyReportPrintData,
  PatientCardPrintData,
  WristbandPrintData,
  DeathCertificatePrintData,
  DischargeSummaryPrintData,
  ReceiptPrintData,
  EstimatePrintData,
  CreditNotePrintData,
  TdsCertificatePrintData,
  GstInvoicePrintData,
  // Consent & MRD Print Data
  ConsentPrintData,
  TokenSlipPrintData,
  VisitorPassPrintData,
  ProgressNotePrintData,
  NursingAssessmentPrintData,
  MarPrintData,
  VitalsChartPrintData,
  IoChartPrintData,
  DischargeChecklistPrintData,
  // Phase 2 Print Data - Billing
  OpdBillPrintData,
  IpdInterimBillPrintData,
  IpdFinalBillPrintData,
  AdvanceReceiptPrintData,
  RefundReceiptPrintData,
  InsurancePreauthPrintData,
  CashlessClaimPrintData,
  PackageEstimatePrintData,
  // Phase 2 Print Data - Lab & Blood Bank
  CultureSensitivityPrintData,
  HistopathReportPrintData,
  CrossmatchReportPrintData,
  ComponentSlipPrintData,
  InvestigationRequisitionPrintData,
  // Phase 2 Print Data - Consent
  DnrConsentPrintData,
  OrganDonationConsentPrintData,
  ResearchConsentPrintData,
  AbdmConsentPrintData,
  TeachingConsentPrintData,
  // Phase 2 Print Data - Clinical & Identity
  TreatmentChartPrintData,
  TransferSummaryPrintData,
  PatientEducationPrintData,
  RegistrationCardPrintData,
  InfantWristbandPrintData,
  // Phase 3 Print Data - Surgical & OT
  CaseSheetCoverPrintData,
  PreopAssessmentPrintData,
  SurgicalSafetyChecklistPrintData,
  AnesthesiaRecordPrintData,
  OperationNotesPrintData,
  PostopOrdersPrintData,
  TransfusionMonitoringPrintData,
  // Phase 3 Print Data - Clinical Charts
  FluidBalanceChartPrintData,
  PainAssessmentPrintData,
  FallRiskAssessmentPrintData,
  PressureUlcerRiskPrintData,
  GcsChartPrintData,
  TransfusionRequisitionPrintData,
  // Phase 3 Print Data - Medico-Legal
  AmaFormPrintData,
  MlcRegisterPrintData,
  WoundCertificatePrintData,
  AgeEstimationPrintData,
  DeathDeclarationPrintData,
  MlcDocumentationPrintData,
  // Phase 3 Print Data - Quality & Safety
  IncidentReportPrintData,
  RcaTemplatePrintData,
  CapaFormPrintData,
  AdrReportPrintData,
  TransfusionReactionPrintData,
  // Phase 4 Print Data - Clinical Delivery
  OpdPrescriptionPrintData,
  LabReportFullPrintData,
  CumulativeLabReportPrintData,
  RadiologyReportFullPrintData,
  // Phase 4 Print Data - Billing
  PackageBillPrintData,
  InsuranceClaimPrintData,
  // Phase 4 Print Data - Regulatory
  NabhQualityReportPrintData,
  NmcComplianceReportPrintData,
  NablQualityReportPrintData,
  SpcbBmwReturnsPrintData,
  PesoComplianceReportPrintData,
  DrugLicenseReportPrintData,
  PcpndtReportPrintData,
  BirthRegisterPrintData,
  DeathRegisterPrintData,
  MlcRegisterSummaryPrintData,
  AebasAttendanceReportPrintData,
  NmcNarfAssessmentPrintData,
  // Phase 4 Print Data - Admin & Procurement
  IndentFormPrintData,
  PurchaseOrderPrintData,
  GrnPrintData,
  MaterialIssueVoucherPrintData,
  StockTransferNotePrintData,
  NdpsRegisterPrintData,
  DrugExpiryAlertPrintData,
  EquipmentCondemnationPrintData,
  WorkOrderPrintData,
  PmChecklistPrintData,
  // Phase 5: Admin/HR, BME, Blood Bank, OT, Clinical Print Data
  EmployeeIdCardPrintData,
  DutyRosterPrintData,
  LeaveApplicationPrintData,
  StaffAttendanceReportPrintData,
  TrainingCertificatePrintData,
  StaffCredentialFormPrintData,
  VisitorRegisterPrintData,
  AmcContractPrintData,
  CalibrationCertificatePrintData,
  EquipmentBreakdownReportPrintData,
  EquipmentHistoryCardPrintData,
  MgpsDailyLogPrintData,
  WaterQualityTestPrintData,
  DgUpsRunLogPrintData,
  FireEquipmentInspectionPrintData,
  MateriovigilanceReportPrintData,
  FireMockDrillReportPrintData,
  OtRegisterPrintData,
  BloodDonorFormPrintData,
  CrossMatchRequisitionPrintData,
  AppointmentSlipPrintData,
  DpdpConsentPrintData,
  VideoConsentPrintData,
  RestraintDocumentationPrintData,
  // Phase 6: Academic/Medical College Forms
  StudentAdmissionFormPrintData,
  InternRotationSchedulePrintData,
  PgLogbookEntryPrintData,
  InternalAssessmentMarksPrintData,
  ExamHallTicketPrintData,
  OsceScoringSheetPrintData,
  SimulationDebriefingPrintData,
  CmeCertificatePrintData,
  IecApprovalCertificatePrintData,
  ResearchProposalFormPrintData,
  HostelAllotmentOrderPrintData,
  AntiRaggingUndertakingPrintData,
  DisabilityAccommodationPlanPrintData,
  InternshipCompletionCertificatePrintData,
  ServiceBondAgreementPrintData,
  StipendPaymentAdvicePrintData,
  HospitalBrandingPrintData,
  // TV Displays & Queue
  TvDisplay,
  CreateTvDisplayRequest,
  UpdateTvDisplayRequest,
  QueueToken,
  DepartmentQueueState,
  TvAnnouncement,
  CreateQueueTokenRequest,
  CreateQueueTokenResponse,
  ListQueueTokensQuery,
  BroadcastAnnouncementRequest,
  // Specialty Queue Displays
  PharmacyQueueDisplay,
  LabQueueDisplay,
  RadiologyQueueDisplay,
  ErQueueDisplay,
  BillingQueueDisplay,
  BedAvailabilityDisplay,
  QueueAnalytics,
  QueueMetricsRealtime,
  // Multi-Hospital Management
  HospitalGroup,
  CreateHospitalGroup,
  UpdateHospitalGroup,
  HospitalRegion,
  CreateHospitalRegion,
  HospitalInGroup,
  AssignHospitalToGroup,
  UserHospitalAssignment,
  UserWithAssignments,
  CreateUserHospitalAssignment,
  PatientTransfer,
  PatientTransferDisplay,
  CreatePatientTransfer,
  UpdateTransferStatus,
  StockTransfer,
  StockTransferItem,
  CreateStockTransfer,
  GroupKpiSnapshot,
  HospitalKpiSummary,
  GroupDashboard,
  DoctorRotationSchedule,
  DoctorRotationDisplay,
  CreateDoctorRotation,
  GroupDrugMaster,
  GroupTestMaster,
  GroupTariffMaster,
  HospitalPriceOverride,
  GroupTemplate,
  CreateGroupTemplate,
  // CMS & Blog
  CmsCategory,
  CmsCategoryWithChildren,
  CreateCmsCategory,
  UpdateCmsCategory,
  CmsTag,
  CreateCmsTag,
  UpdateCmsTag,
  CmsAuthor,
  CreateCmsAuthor,
  UpdateCmsAuthor,
  CmsMedia,
  CreateCmsMedia,
  UpdateCmsMedia,
  CmsPost,
  CmsPostSummary,
  CmsPostDetail,
  CreateCmsPost,
  UpdateCmsPost,
  SubmitPostForReview,
  ReviewPostAction,
  SchedulePostRequest,
  CmsPostRevision,
  CmsPostAnalytics,
  CmsDashboardStats,
  CmsSubscriber,
  CreateCmsSubscriber,
  CmsPage,
  CreateCmsPage,
  UpdateCmsPage,
  CmsSettings,
  UpdateCmsSettings,
  CmsMenu,
  UpdateCmsMenu,
  CmsPublicPost,
  CmsPostList,
  // IT Security types
  BreakGlassEvent,
  BreakGlassEventSummary,
  CreateBreakGlassRequest,
  EndBreakGlassRequest,
  ReviewBreakGlassRequest,
  BreakGlassQuery,
  SensitivePatient,
  SensitivePatientSummary,
  CreateSensitivePatientRequest,
  AccessAlert,
  AcknowledgeAlertRequest,
  StockDisposalRequest,
  StockDisposalSummary,
  StockDisposalItem,
  CreateDisposalRequest,
  ApproveDisposalRequest,
  ExecuteDisposalRequest,
  DisposalQuery,
  TatBenchmark,
  CreateTatBenchmarkRequest,
  TatRecord,
  TatRecordSummary,
  CreateTatRecordRequest,
  CompleteTatRecordRequest,
  TatQuery,
  TatDashboard,
  DataMigration,
  CreateMigrationRequest,
  MigrationQuery,
  EodDigestSubscription,
  CreateDigestSubscriptionRequest,
  EodDigestHistory,
  DataQualityRule,
  CreateDataQualityRuleRequest,
  DataQualityIssue,
  ResolveIssueRequest,
  DataQualityQuery,
  DataQualityDashboard,
  CertInIncident,
  ReportToCertInRequest,
  CertInIncidentUpdate,
  AddCertInUpdateRequest,
  Vulnerability,
  CreateVulnerabilityRequest,
  UpdateVulnerabilityRequest,
  ComplianceRequirement,
  UpdateComplianceRequest as UpdateCertInComplianceRequest,
  SystemHealthDashboard,
  BackupHistory,
  ItSecurityOnboardingProgress,
  CompleteItSecurityOnboardingStepRequest,
  IncentivePlan,
  CreateIncentivePlanRequest,
  IncentivePlanRule,
  CreateIncentiveRuleRequest,
  DoctorIncentiveAssignment,
  AssignIncentivePlanRequest,
  IncentiveCalculation,
  CalculateIncentiveRequest,
  ApproveIncentiveRequest,
  MarkIncentivePaidRequest,
} from "@medbrains/types";
import { getApiBase } from "./config.js";
// Re-export type guards for use by consumers
export {
  // Error class
  TypeAssertionError,
  // Type guard functions (is*)
  isPatient,
  isPatientCreate,
  isPatientUpdate,
  isUser,
  isUserCreate,
  isEncounter,
  isEncounterCreate,
  isConsultation,
  isDiagnosis,
  isVital,
  isLabOrder,
  isInvoice,
  isAdmission,
  isOpdQueue,
  // Assertion functions (assert*)
  assertPatient,
  assertPatientCreate,
  assertPatientArray,
  assertUser,
  assertUserCreate,
  assertUserArray,
  assertEncounter,
  assertEncounterCreate,
  assertEncounterArray,
  assertConsultation,
  assertDiagnosis,
  assertVital,
  assertLabOrder,
  assertLabOrderArray,
  assertInvoice,
  assertInvoiceArray,
  assertAdmission,
  assertAdmissionArray,
  assertOpdQueue,
  // Array guards
  isPatientArray,
  isUserArray,
  isEncounterArray,
  isLabOrderArray,
  isInvoiceArray,
  isAdmissionArray,
  // Validation helpers
  validateApiResponse,
  validateApiArrayResponse,
} from "@medbrains/schemas";

// Import for internal use
import { validateApiResponse, validateApiArrayResponse, TypeAssertionError } from "@medbrains/schemas";

// ══════════════════════════════════════════════════════════════════════════════
// VALIDATED REQUEST - Runtime type checking for API responses
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Makes an API request and validates the response with a type guard.
 * Throws TypeAssertionError if validation fails.
 */
export async function validatedRequest<T>(
  path: string,
  guard: (value: unknown) => value is T,
  init?: RequestInit,
): Promise<T> {
  const data = await request<unknown>(path, init);
  return validateApiResponse(data, guard, path);
}

/**
 * Makes an API request expecting an array and validates each item.
 */
export async function validatedArrayRequest<T>(
  path: string,
  itemGuard: (value: unknown) => value is T,
  init?: RequestInit,
): Promise<T[]> {
  const data = await request<unknown>(path, init);
  return validateApiArrayResponse(data, itemGuard, path);
}

/**
 * Validates data before sending to API (for create/update payloads).
 * Throws TypeAssertionError if validation fails.
 */
export function validatePayload<T>(
  data: unknown,
  guard: (value: unknown) => value is T,
  context: string,
): asserts data is T {
  if (!guard(data)) {
    throw new TypeAssertionError(context, data, "payload validation");
  }
}

// CSRF token — set on login/refresh, sent as X-CSRF-Token header on mutations.
// Persisted to sessionStorage so it survives Vite HMR and page reloads.
const CSRF_STORAGE_KEY = "csrf_token";

// Platform-agnostic storage check
const isBrowser =
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
const hasDocument = typeof document !== "undefined";

function loadCsrfToken(): string | null {
  if (!isBrowser) return null;
  try {
    return window.sessionStorage.getItem(CSRF_STORAGE_KEY);
  } catch {
    return null;
  }
}

let _csrfToken: string | null = loadCsrfToken();

export function setCsrfToken(token: string | null): void {
  _csrfToken = token;
  if (!isBrowser) return;
  try {
    if (token) {
      window.sessionStorage.setItem(CSRF_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(CSRF_STORAGE_KEY);
    }
  } catch {
    // non-browser environment
  }
}

function getCsrfToken(): string | null {
  if (_csrfToken) return _csrfToken;
  // Fall back to reading the csrf_token cookie (readable, not HttpOnly)
  if (!hasDocument) return null;
  try {
    const match = document.cookie
      .split(";")
      .map((c: string) => c.trim())
      .find((c: string) => c.startsWith("csrf_token="));
    if (match) {
      return match.split("=")[1] ?? null;
    }
  } catch {
    // SSR or non-browser environment
  }
  return null;
}

/** Methods that require CSRF protection */
const MUTATION_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const method = (init?.method ?? "GET").toUpperCase();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  // Add CSRF header for mutation requests
  if (MUTATION_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers["X-CSRF-Token"] = csrf;
    }
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        const retry = await fetch(url, {
          ...init,
          headers: {
            ...headers,
            // Update CSRF token after refresh
            ...(MUTATION_METHODS.has(method) && _csrfToken
              ? { "X-CSRF-Token": _csrfToken }
              : {}),
          },
          credentials: "include",
        });
        if (retry.ok) {
          return retry.json() as Promise<T>;
        }
      }
      setCsrfToken(null);
      throw new Error("session_expired");
    }
    const body = await response.json().catch(() => ({}));

    // Parse 422 validation errors into a structured ValidationError
    if (
      response.status === 422 &&
      (body as { error?: string }).error === "validation_failed" &&
      (body as { fields?: Record<string, string[]> }).fields
    ) {
      const { ValidationError } = await import("@medbrains/utils");
      throw new ValidationError(
        (body as { fields: Record<string, string[]> }).fields,
      );
    }

    throw new Error(
      (body as { error?: string; detail?: string }).detail ??
        (body as { error?: string }).error ??
        `Request failed: ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const resp = await fetch(`${getApiBase()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });

    if (!resp.ok) return false;

    const data = (await resp.json()) as { csrf_token: string };
    setCsrfToken(data.csrf_token);
    return true;
  } catch {
    return false;
  }
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    tenant_id: string;
    username: string;
    email: string;
    full_name: string;
    role: string;
  };
  csrf_token: string;
  permissions: string[];
  field_access: Record<string, FieldAccessLevel>;
}

export interface MeResponse {
  id: string;
  tenant_id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  permissions: string[];
  field_access: Record<string, FieldAccessLevel>;
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  // Auth
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const resp = await request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    // Store CSRF token from login response
    setCsrfToken(resp.csrf_token);
    return resp;
  },
  me: () => request<MeResponse>("/auth/me"),
  refreshToken: () =>
    request<{ token: string }>("/auth/refresh", { method: "POST" }),
  logout: () =>
    request<{ status: string }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  changePassword: (data: { current_password: string; new_password: string }) =>
    request<{ status: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Onboarding
  onboardingStatus: () =>
    request<OnboardingStatusResponse>("/onboarding/status"),
  onboardingInit: (data: OnboardingInitRequest) =>
    request<OnboardingInitResponse>("/onboarding/init", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  onboardingProgress: () =>
    request<OnboardingProgress>("/onboarding/progress"),
  updateOnboardingProgress: (data: {
    current_step: number;
    completed_steps: number[];
  }) =>
    request<OnboardingProgress>("/onboarding/progress", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  onboardingSetup: (data: OnboardingSetupRequest) =>
    request<{ status: string }>("/onboarding/setup", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  completeOnboarding: () =>
    request<{ status: string }>("/onboarding/complete", { method: "POST" }),

  // Geo
  geoCountries: () => request<GeoCountry[]>("/geo/countries"),
  geoStates: (countryId: string) =>
    request<GeoState[]>(`/geo/countries/${countryId}/states`),
  geoDistricts: (stateId: string) =>
    request<GeoDistrict[]>(`/geo/states/${stateId}/districts`),
  geoSubdistricts: (districtId: string) =>
    request<GeoSubdistrict[]>(`/geo/districts/${districtId}/subdistricts`),
  geoTowns: (subdistrictId: string) =>
    request<GeoTown[]>(`/geo/subdistricts/${subdistrictId}/towns`),
  searchPincode: (pincode: string) =>
    request<PincodeResult[]>(`/geo/pincode/${encodeURIComponent(pincode)}`),
  geoRegulators: () => request<RegulatoryBody[]>("/geo/regulators"),
  geoAutoDetectRegulators: (params: {
    country_id?: string;
    state_id?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params.country_id) qs.set("country_id", params.country_id);
    if (params.state_id) qs.set("state_id", params.state_id);
    return request<{ regulators: RegulatoryBody[] }>(
      `/geo/regulators/auto-detect?${qs.toString()}`,
    );
  },

  // Setup — tenant
  getTenant: () => request<TenantSummary>("/setup/tenant"),
  updateTenant: (data: Partial<TenantSummary>) =>
    request<TenantSummary>("/setup/tenant", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  updateTenantGeo: (data: {
    country_id?: string;
    state_id?: string;
    district_id?: string;
  }) =>
    request<{ status: string; defaults_applied?: boolean }>("/setup/tenant/geo", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  createCompliance: (data: {
    facility_id: string;
    regulatory_body_id: string;
    license_number?: string;
    status?: string;
  }) =>
    request<unknown>("/setup/compliance", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Setup — facilities
  listFacilities: () => request<Facility[]>("/setup/facilities"),
  createFacility: (data: {
    code: string;
    name: string;
    facility_type: string;
    parent_id?: string;
    address_line1?: string;
    city?: string;
    phone?: string;
    email?: string;
    bed_count?: number;
    shared_billing?: boolean;
    shared_pharmacy?: boolean;
    shared_lab?: boolean;
    shared_hr?: boolean;
  }) =>
    request<Facility>("/setup/facilities", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateFacility: (id: string, data: Record<string, unknown>) =>
    request<Facility>(`/setup/facilities/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteFacility: (id: string) =>
    request<{ status: string }>(`/setup/facilities/${id}`, {
      method: "DELETE",
    }),

  // Setup — locations
  listLocations: () => request<LocationRow[]>("/setup/locations"),
  createLocation: (data: {
    parent_id?: string;
    level: string;
    code: string;
    name: string;
  }) =>
    request<LocationRow>("/setup/locations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLocation: (id: string, data: Record<string, unknown>) =>
    request<LocationRow>(`/setup/locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteLocation: (id: string) =>
    request<{ status: string }>(`/setup/locations/${id}`, {
      method: "DELETE",
    }),

  // Setup — departments
  listDepartments: () => request<DepartmentRow[]>("/setup/departments"),
  createDepartment: (data: {
    code: string;
    name: string;
    department_type: string;
    parent_id?: string;
  }) =>
    request<DepartmentRow>("/setup/departments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDepartment: (id: string, data: Record<string, unknown>) =>
    request<DepartmentRow>(`/setup/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteDepartment: (id: string) =>
    request<{ status: string }>(`/setup/departments/${id}`, {
      method: "DELETE",
    }),

  // Setup — roles
  listRoles: () => request<CustomRole[]>("/setup/roles"),
  createRole: (data: {
    code: string;
    name: string;
    description?: string;
    permissions?: Record<string, unknown>;
  }) =>
    request<CustomRole>("/setup/roles", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRole: (id: string, data: { name?: string; description?: string; permissions?: Record<string, unknown>; is_active?: boolean }) =>
    request<CustomRole>(`/setup/roles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRole: (id: string) =>
    request<{ status: string }>(`/setup/roles/${id}`, { method: "DELETE" }),
  updateRolePermissions: (id: string, permissions: string[]) =>
    request<CustomRole>(`/setup/roles/${id}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    }),
  updateRoleFieldAccess: (
    id: string,
    fieldAccess: Record<string, FieldAccessLevel>,
  ) =>
    request<CustomRole>(`/setup/roles/${id}/field-access`, {
      method: "PUT",
      body: JSON.stringify({ field_access: fieldAccess }),
    }),
  updateRoleWidgetAccess: (
    id: string,
    widgetAccess: Record<string, WidgetAccessLevel>,
  ) =>
    request<CustomRole>(`/setup/roles/${id}/widget-access`, {
      method: "PUT",
      body: JSON.stringify({ widget_access: widgetAccess }),
    }),

  // Setup — users
  listSetupUsers: () => request<SetupUser[]>("/setup/users"),
  listDoctors: () => request<SetupUser[]>("/setup/doctors"),
  createSetupUser: (data: {
    username: string;
    email: string;
    password: string;
    full_name: string;
    role: string;
    specialization?: string;
    medical_registration_number?: string;
    qualification?: string;
    consultation_fee?: number;
    department_ids?: string[];
  }) =>
    request<SetupUser>("/setup/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSetupUser: (id: string, data: Record<string, unknown>) =>
    request<SetupUser>(`/setup/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSetupUser: (id: string) =>
    request<{ status: string }>(`/setup/users/${id}`, { method: "DELETE" }),

  // Setup — user-facility assignments
  listUserFacilities: (userId: string) =>
    request<UserFacilityAssignment[]>(`/setup/users/${userId}/facilities`),
  assignUserFacilities: (userId: string, data: AssignUserFacilitiesRequest) =>
    request<UserFacilityAssignment[]>(`/setup/users/${userId}/facilities`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Setup — auto-create compliance checklist
  autoCreateCompliance: (facilityId: string) =>
    request<ComplianceRow[]>(`/setup/facilities/${facilityId}/auto-compliance`, {
      method: "POST",
    }),

  updateUserAccessMatrix: (
    id: string,
    data: {
      extra_permissions: string[];
      denied_permissions: string[];
      field_access?: Record<string, FieldAccessLevel>;
      widget_access?: Record<string, WidgetAccessLevel>;
    },
  ) =>
    request<{ status: string }>(`/setup/users/${id}/access-matrix`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Setup — modules
  listModules: () => request<ModuleConfig[]>("/setup/modules"),
  updateModule: (code: string, data: { status: string }) =>
    request<ModuleConfig>(`/setup/modules/${code}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Setup — sequences
  listSequences: () => request<SequenceRow[]>("/setup/sequences"),
  createSequence: (data: { seq_type: string; prefix: string; pad_width: number }) =>
    request<SequenceRow>("/setup/sequences", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSequence: (
    seqType: string,
    data: { prefix?: string; pad_width?: number },
  ) =>
    request<SequenceRow>(`/setup/sequences/${seqType}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSequence: (seqType: string) =>
    request<{ status: string }>(`/setup/sequences/${seqType}`, { method: "DELETE" }),

  // Setup — services
  listServices: () => request<ServiceRow[]>("/setup/services"),
  createService: (data: { code: string; name: string; service_type: string; base_price?: number; department_id?: string | null; description?: string }) =>
    request<ServiceRow>("/setup/services", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateService: (id: string, data: Record<string, unknown>) =>
    request<ServiceRow>(`/setup/services/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteService: (id: string) =>
    request<{ status: string }>(`/setup/services/${id}`, { method: "DELETE" }),

  // Setup — bed types
  listBedTypes: () => request<BedTypeRow[]>("/setup/bed-types"),
  createBedType: (data: { code: string; name: string; daily_rate: number; description?: string }) =>
    request<BedTypeRow>("/setup/bed-types", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBedType: (id: string, data: Record<string, unknown>) =>
    request<BedTypeRow>(`/setup/bed-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteBedType: (id: string) =>
    request<{ status: string }>(`/setup/bed-types/${id}`, { method: "DELETE" }),

  // Setup — tax categories
  listTaxCategories: () => request<TaxCategoryRow[]>("/setup/tax-categories"),
  createTaxCategory: (data: { code: string; name: string; rate_percent: number; applicability: string; description?: string }) =>
    request<TaxCategoryRow>("/setup/tax-categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTaxCategory: (id: string, data: Record<string, unknown>) =>
    request<TaxCategoryRow>(`/setup/tax-categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteTaxCategory: (id: string) =>
    request<{ status: string }>(`/setup/tax-categories/${id}`, { method: "DELETE" }),

  // Setup — payment methods
  listPaymentMethods: () => request<PaymentMethodRow[]>("/setup/payment-methods"),
  createPaymentMethod: (data: { code: string; name: string; is_default?: boolean }) =>
    request<PaymentMethodRow>("/setup/payment-methods", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePaymentMethod: (id: string, data: Record<string, unknown>) =>
    request<PaymentMethodRow>(`/setup/payment-methods/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePaymentMethod: (id: string) =>
    request<{ status: string }>(`/setup/payment-methods/${id}`, { method: "DELETE" }),

  // Setup — branding
  getBranding: () => request<TenantSettingsRow[]>("/setup/branding"),
  updateBranding: (data: { key: string; value: unknown }) =>
    request<TenantSettingsRow>("/setup/branding", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Setup — generic tenant settings
  getTenantSettings: (category: string) =>
    request<TenantSettingsRow[]>(`/setup/settings?category=${encodeURIComponent(category)}`),
  updateTenantSetting: (data: { category: string; key: string; value: unknown }) =>
    request<TenantSettingsRow>("/setup/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getSecureDeviceSettings: () =>
    request<SecureTenantSettingRow[]>("/setup/device-settings"),
  updateSecureDeviceSetting: (data: UpdateSecureDeviceSettingRequest) =>
    request<SecureTenantSettingRow>("/setup/device-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Setup — module master data seeding
  seedModuleMasters: (data: SeedModuleMastersRequest) =>
    request<SeedModuleMastersResponse>("/setup/module-masters", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Setup — CSV import
  importLocations: (data: CsvImportRequest) =>
    request<CsvImportResult>("/setup/locations/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  importDepartments: (data: CsvImportRequest) =>
    request<CsvImportResult>("/setup/departments/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  importUsers: (data: CsvImportRequest) =>
    request<CsvImportResult>("/setup/users/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Setup — print templates
  getPrintTemplates: () =>
    request<TenantSettingsRow[]>("/setup/print-templates"),
  upsertPrintTemplate: (data: PrintTemplateRequest) =>
    request<{ status: string; template_type: string; value: unknown }>("/setup/print-templates", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Forms — definition
  listForms: () => request<FormMaster[]>("/forms"),
  getFormDefinition: (
    formCode: string,
    params?: { quick_mode?: boolean },
  ) => {
    const qs = new URLSearchParams();
    if (params?.quick_mode) qs.set("quick_mode", "true");
    const query = qs.toString();
    return request<ResolvedFormDefinition>(
      `/forms/${formCode}/definition${query ? `?${query}` : ""}`,
    );
  },
  getModuleForms: (moduleCode: string) =>
    request<
      Array<
        ModuleFormLink & { form_code: string; form_name: string }
      >
    >(`/module-forms/${moduleCode}`),

  // Forms — tenant field overrides
  listFieldOverrides: () =>
    request<TenantFieldOverride[]>("/tenant/field-overrides"),
  upsertFieldOverride: (
    fieldCode: string,
    data: {
      form_id?: string;
      label_override?: string;
      requirement_override?: RequirementLevel;
      is_hidden?: boolean;
      validation_override?: Record<string, unknown>;
    },
  ) =>
    request<{ status: string }>(`/tenant/field-overrides/${fieldCode}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteFieldOverride: (fieldCode: string) =>
    request<{ status: string }>(`/tenant/field-overrides/${fieldCode}`, {
      method: "DELETE",
    }),

  // Patients
  listPatients: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    if (params?.search) qs.set("search", params.search);
    const query = qs.toString();
    return request<PatientListResponse>(
      `/patients${query ? `?${query}` : ""}`,
    );
  },
  getPatient: (id: string) => request<Patient>(`/patients/${id}`),
  createPatient: (data: CreatePatientRequest) =>
    request<Patient>("/patients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePatient: (id: string, data: UpdatePatientRequest) =>
    request<Patient>(`/patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Patient Visit History / Timeline
  listPatientVisits: (patientId: string) =>
    request<PatientVisitRow[]>(`/patients/${patientId}/visits`),
  listPatientLabOrders: (patientId: string) =>
    request<PatientLabOrderRow[]>(`/patients/${patientId}/lab-orders`),
  listPatientInvoices: (patientId: string) =>
    request<PatientInvoiceRow[]>(`/patients/${patientId}/invoices`),
  listPatientAppointments: (patientId: string) =>
    request<PatientAppointmentRow[]>(`/patients/${patientId}/appointments`),

  // Patient Sub-resources
  listPatientIdentifiers: (patientId: string) =>
    request<PatientIdentifier[]>(`/patients/${patientId}/identifiers`),
  createPatientIdentifier: (patientId: string, data: CreatePatientIdentifierRequest) =>
    request<PatientIdentifier>(`/patients/${patientId}/identifiers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePatientIdentifier: (patientId: string, id: string) =>
    request<{ status: string }>(`/patients/${patientId}/identifiers/${id}`, {
      method: "DELETE",
    }),
  updatePatientIdentifier: (patientId: string, id: string, data: Record<string, unknown>) =>
    request<PatientIdentifier>(`/patients/${patientId}/identifiers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listPatientAddresses: (patientId: string) =>
    request<PatientAddress[]>(`/patients/${patientId}/addresses`),
  createPatientAddress: (patientId: string, data: CreatePatientAddressRequest) =>
    request<PatientAddress>(`/patients/${patientId}/addresses`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePatientAddress: (patientId: string, id: string) =>
    request<{ status: string }>(`/patients/${patientId}/addresses/${id}`, {
      method: "DELETE",
    }),
  updatePatientAddress: (patientId: string, id: string, data: Record<string, unknown>) =>
    request<PatientAddress>(`/patients/${patientId}/addresses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listPatientContacts: (patientId: string) =>
    request<PatientContact[]>(`/patients/${patientId}/contacts`),
  createPatientContact: (patientId: string, data: CreatePatientContactRequest) =>
    request<PatientContact>(`/patients/${patientId}/contacts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePatientContact: (patientId: string, id: string) =>
    request<{ status: string }>(`/patients/${patientId}/contacts/${id}`, {
      method: "DELETE",
    }),
  updatePatientContact: (patientId: string, id: string, data: Record<string, unknown>) =>
    request<PatientContact>(`/patients/${patientId}/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listPatientAllergies: (patientId: string) =>
    request<PatientAllergy[]>(`/patients/${patientId}/allergies`),
  createPatientAllergy: (patientId: string, data: CreatePatientAllergyRequest) =>
    request<PatientAllergy>(`/patients/${patientId}/allergies`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePatientAllergy: (patientId: string, id: string) =>
    request<{ status: string }>(`/patients/${patientId}/allergies/${id}`, {
      method: "DELETE",
    }),
  updatePatientAllergy: (patientId: string, id: string, data: Record<string, unknown>) =>
    request<PatientAllergy>(`/patients/${patientId}/allergies/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Patient Insurance
  listPatientInsurance: (patientId: string) =>
    request<Record<string, unknown>[]>(`/patients/${patientId}/insurance`),
  createPatientInsurance: (patientId: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/patients/${patientId}/insurance`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePatientInsurance: (patientId: string, id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/patients/${patientId}/insurance/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePatientInsurance: (patientId: string, id: string) =>
    request<{ status: string }>(`/patients/${patientId}/insurance/${id}`, {
      method: "DELETE",
    }),

  listPatientConsents: (patientId: string) =>
    request<PatientConsent[]>(`/patients/${patientId}/consents`),
  createPatientConsent: (patientId: string, data: CreatePatientConsentRequest) =>
    request<PatientConsent>(`/patients/${patientId}/consents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePatientConsent: (patientId: string, id: string, data: Record<string, unknown>) =>
    request<PatientConsent>(`/patients/${patientId}/consents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePatientConsent: (patientId: string, id: string) =>
    request<{ status: string }>(`/patients/${patientId}/consents/${id}`, {
      method: "DELETE",
    }),

  // Masters (read-only for patient forms)
  listReligions: () => request<MasterItem[]>("/masters/religions"),
  listOccupations: () => request<MasterItem[]>("/masters/occupations"),
  listRelations: () => request<MasterItem[]>("/masters/relations"),

  // Masters — Admin CRUD
  adminListReligions: () => request<MasterItem[]>("/setup/masters/religions"),
  adminCreateReligion: (data: CreateMasterItemRequest) =>
    request<MasterItem>("/setup/masters/religions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateReligion: (id: string, data: UpdateMasterItemRequest) =>
    request<MasterItem>(`/setup/masters/religions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteReligion: (id: string) =>
    request<{ status: string }>(`/setup/masters/religions/${id}`, {
      method: "DELETE",
    }),

  adminListOccupations: () => request<MasterItem[]>("/setup/masters/occupations"),
  adminCreateOccupation: (data: CreateMasterItemRequest) =>
    request<MasterItem>("/setup/masters/occupations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateOccupation: (id: string, data: UpdateMasterItemRequest) =>
    request<MasterItem>(`/setup/masters/occupations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteOccupation: (id: string) =>
    request<{ status: string }>(`/setup/masters/occupations/${id}`, {
      method: "DELETE",
    }),

  adminListRelations: () => request<MasterItem[]>("/setup/masters/relations"),
  adminCreateRelation: (data: CreateMasterItemRequest) =>
    request<MasterItem>("/setup/masters/relations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateRelation: (id: string, data: UpdateMasterItemRequest) =>
    request<MasterItem>(`/setup/masters/relations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteRelation: (id: string) =>
    request<{ status: string }>(`/setup/masters/relations/${id}`, {
      method: "DELETE",
    }),

  adminListInsuranceProviders: () =>
    request<InsuranceProvider[]>("/setup/masters/insurance-providers"),
  adminCreateInsuranceProvider: (data: CreateInsuranceProviderRequest) =>
    request<InsuranceProvider>("/setup/masters/insurance-providers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateInsuranceProvider: (id: string, data: UpdateInsuranceProviderRequest) =>
    request<InsuranceProvider>(`/setup/masters/insurance-providers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteInsuranceProvider: (id: string) =>
    request<{ status: string }>(`/setup/masters/insurance-providers/${id}`, {
      method: "DELETE",
    }),

  // MPI
  matchPatients: (data: MpiMatchRequest) =>
    request<MpiMatchResult[]>("/patients/match", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Patient: Merge ─────────────────────────────

  mergePatients: (data: MergePatientRequest) =>
    request<PatientMergeHistory>("/patients/merge", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  unmergePatient: (mergeHistoryId: string) =>
    request<{ status: string }>(`/patients/unmerge/${mergeHistoryId}`, {
      method: "POST",
    }),
  listMergeHistory: (patientId: string) =>
    request<PatientMergeHistory[]>(`/patients/${patientId}/merge-history`),

  // ── Patient: Family Links ─────────────────────────────

  listFamilyLinks: (patientId: string) =>
    request<FamilyLinkRow[]>(`/patients/${patientId}/family-links`),
  createFamilyLink: (patientId: string, data: CreateFamilyLinkRequest) =>
    request<PatientFamilyLink>(`/patients/${patientId}/family-links`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteFamilyLink: (patientId: string, linkId: string) =>
    request<{ deleted: boolean }>(`/patients/${patientId}/family-links/${linkId}`, {
      method: "DELETE",
    }),

  // ── Patient: Documents ─────────────────────────────

  listPatientDocuments: (patientId: string) =>
    request<PatientDocument[]>(`/patients/${patientId}/documents`),
  createPatientDocument: (patientId: string, data: CreateDocumentRequest) =>
    request<PatientDocument>(`/patients/${patientId}/documents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePatientDocument: (patientId: string, docId: string) =>
    request<{ deleted: boolean }>(`/patients/${patientId}/documents/${docId}`, {
      method: "DELETE",
    }),

  // ── Patient: Photo ─────────────────────────────

  updatePatientPhoto: (patientId: string, photoUrl: string) =>
    request<{ photo_url: string }>(`/patients/${patientId}/photo`, {
      method: "PATCH",
      body: JSON.stringify({ photo_url: photoUrl }),
    }),

  // ── Admin: Form Management ─────────────────────────────

  adminListForms: () => request<FormMaster[]>("/admin/forms"),
  adminGetFormDetail: (id: string) =>
    request<FormDetailResponse>(`/admin/forms/${id}`),
  adminCreateForm: (data: CreateFormRequest) =>
    request<FormMaster>("/admin/forms", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateForm: (id: string, data: UpdateFormRequest) =>
    request<FormMaster>(`/admin/forms/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Admin: Field Management
  adminListFields: (search?: string) => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    const query = qs.toString();
    return request<FieldMasterFull[]>(
      `/admin/fields${query ? `?${query}` : ""}`,
    );
  },
  adminGetFieldDetail: (id: string) =>
    request<FieldDetailResponse>(`/admin/fields/${id}`),
  adminCreateField: (data: CreateFieldRequest) =>
    request<FieldMasterFull>("/admin/fields", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateField: (id: string, data: UpdateFieldRequest) =>
    request<FieldMasterFull>(`/admin/fields/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Admin: Sections
  adminCreateSection: (formId: string, data: CreateSectionRequest) =>
    request<{ id: string; code: string; name: string }>(
      `/admin/forms/${formId}/sections`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  adminUpdateSection: (
    formId: string,
    sectionId: string,
    data: UpdateSectionRequest,
  ) =>
    request<{ id: string; code: string; name: string }>(
      `/admin/forms/${formId}/sections/${sectionId}`,
      { method: "PUT", body: JSON.stringify(data) },
    ),
  adminDeleteSection: (formId: string, sectionId: string) =>
    request<{ status: string }>(
      `/admin/forms/${formId}/sections/${sectionId}`,
      { method: "DELETE" },
    ),
  adminReorderSections: (formId: string, items: ReorderItem[]) =>
    request<{ status: string }>(
      `/admin/forms/${formId}/sections/reorder`,
      { method: "PUT", body: JSON.stringify(items) },
    ),

  // Admin: Form Fields (field-to-section linking)
  adminAddFieldToForm: (formId: string, data: AddFieldToFormRequest) =>
    request<{ id: string }>(`/admin/forms/${formId}/fields`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateFormField: (
    formId: string,
    ffId: string,
    data: UpdateFormFieldRequest,
  ) =>
    request<{ id: string }>(`/admin/forms/${formId}/fields/${ffId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminRemoveFieldFromForm: (formId: string, ffId: string) =>
    request<{ status: string }>(`/admin/forms/${formId}/fields/${ffId}`, {
      method: "DELETE",
    }),
  adminReorderFields: (formId: string, items: ReorderItem[]) =>
    request<{ status: string }>(
      `/admin/forms/${formId}/fields/reorder`,
      { method: "PUT", body: JSON.stringify(items) },
    ),

  // Admin: Regulatory Clauses
  adminListRegulatoryClauses: (params?: {
    field_id?: string;
    body_code?: string;
    search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.field_id) qs.set("field_id", params.field_id);
    if (params?.body_code) qs.set("body_code", params.body_code);
    if (params?.search) qs.set("search", params.search);
    const query = qs.toString();
    return request<RegulatoryClauseWithContext[]>(
      `/admin/regulatory-clauses${query ? `?${query}` : ""}`,
    );
  },

  // Admin: Regulatory Bodies
  adminListRegulatoryBodies: () =>
    request<RegulatoryBodyFull[]>("/admin/regulatory-bodies"),
  adminCreateRegulatoryBody: (data: CreateRegulatoryBodyRequest) =>
    request<RegulatoryBodyFull>("/admin/regulatory-bodies", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateRegulatoryBody: (id: string, data: UpdateRegulatoryBodyRequest) =>
    request<RegulatoryBodyFull>(`/admin/regulatory-bodies/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Admin: Regulatory Links
  adminCreateRegulatoryLink: (data: CreateRegulatoryLinkRequest) =>
    request<FieldRegulatoryLinkRow>("/admin/regulatory-links", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateRegulatoryLink: (id: string, data: UpdateRegulatoryLinkRequest) =>
    request<FieldRegulatoryLinkRow>(`/admin/regulatory-links/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteRegulatoryLink: (id: string) =>
    request<{ status: string }>(`/admin/regulatory-links/${id}`, {
      method: "DELETE",
    }),

  // Admin: Module-Form Links
  adminListModuleLinks: () =>
    request<ModuleFormLinkRow[]>("/admin/module-links"),
  adminCreateModuleLink: (data: CreateModuleLinkRequest) =>
    request<{ status: string }>("/admin/module-links", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminDeleteModuleLink: (
    moduleCode: string,
    formId: string,
    context: string,
  ) =>
    request<{ status: string }>(
      `/admin/module-links/${moduleCode}/${formId}/${context}`,
      { method: "DELETE" },
    ),

  // Admin: Form Versioning
  adminPublishForm: (formId: string, data?: PublishFormRequest) =>
    request<FormMaster>(`/admin/forms/${formId}/publish`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  adminCreateNewVersion: (formId: string) =>
    request<FormMaster>(`/admin/forms/${formId}/new-version`, {
      method: "POST",
    }),
  adminListFormVersions: (formId: string) =>
    request<FormVersionSummary[]>(`/admin/forms/${formId}/versions`),
  adminGetFormVersion: (formId: string, version: number) =>
    request<FormVersionSnapshot>(
      `/admin/forms/${formId}/versions/${version}`,
    ),
  adminRestoreFormVersion: (formId: string, version: number) =>
    request<FormMaster>(`/admin/forms/${formId}/restore/${version}`, {
      method: "POST",
    }),
  adminDiffFormVersions: (formId: string, v1: number, v2: number) =>
    request<FormDiffResponse>(
      `/admin/forms/${formId}/diff?v1=${v1}&v2=${v2}`,
    ),

  // Admin: Field Audit Log
  adminGetFieldAuditLog: (fieldId: string) =>
    request<FieldAuditEntry[]>(`/admin/fields/${fieldId}/audit`),

  // ── Dashboards — User-Facing ──────────────────────────
  getDashboardStats: () =>
    request<DashboardStatsResponse>("/dashboard/summary"),
  listDashboards: () =>
    request<DashboardSummary[]>("/dashboards"),
  getMyDashboard: () =>
    request<DashboardWithWidgets>("/dashboards/my"),
  getDashboard: (id: string) =>
    request<DashboardWithWidgets>(`/dashboards/${id}`),
  personalizeDashboard: (data: PersonalizeDashboardRequest) =>
    request<DashboardWithWidgets>("/dashboards/my/personalize", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listWidgetTemplates: () =>
    request<WidgetTemplate[]>("/widget-templates"),
  getWidgetData: (widgetId: string) =>
    request<WidgetDataResponse>(`/dashboard/widget-data/${widgetId}`),
  batchWidgetData: (widgetIds: string[]) =>
    request<WidgetDataResponse[]>("/dashboard/widget-data/batch", {
      method: "POST",
      body: JSON.stringify({ widget_ids: widgetIds }),
    }),

  // ── Dashboards — Admin ────────────────────────────────
  adminCreateDashboard: (data: CreateDashboardRequest) =>
    request<Dashboard>("/admin/dashboards", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateDashboard: (id: string, data: UpdateDashboardRequest) =>
    request<Dashboard>(`/admin/dashboards/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteDashboard: (id: string) =>
    request<{ status: string }>(`/admin/dashboards/${id}`, {
      method: "DELETE",
    }),
  adminDuplicateDashboard: (id: string) =>
    request<Dashboard>(`/admin/dashboards/${id}/duplicate`, {
      method: "POST",
    }),
  adminAddWidget: (dashboardId: string, data: CreateWidgetRequest) =>
    request<DashboardWidget>(`/admin/dashboards/${dashboardId}/widgets`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateWidget: (
    dashboardId: string,
    widgetId: string,
    data: UpdateWidgetRequest,
  ) =>
    request<DashboardWidget>(
      `/admin/dashboards/${dashboardId}/widgets/${widgetId}`,
      { method: "PUT", body: JSON.stringify(data) },
    ),
  adminDeleteWidget: (dashboardId: string, widgetId: string) =>
    request<{ status: string }>(
      `/admin/dashboards/${dashboardId}/widgets/${widgetId}`,
      { method: "DELETE" },
    ),
  adminUpdateLayout: (dashboardId: string, data: UpdateLayoutRequest) =>
    request<{ status: string }>(`/admin/dashboards/${dashboardId}/layout`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminListWidgetTemplates: () =>
    request<WidgetTemplate[]>("/admin/widget-templates"),
  adminCreateWidgetTemplate: (data: {
    name: string;
    description?: string;
    widget_type: string;
    icon?: string;
    color?: string;
    default_config?: Record<string, unknown>;
    default_source?: Record<string, unknown>;
    default_width?: number;
    default_height?: number;
    category?: string;
  }) =>
    request<WidgetTemplate>("/admin/widget-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Indent / Store ──────────────────────────────────

  listIndentRequisitions: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<IndentRequisitionListResponse>(`/indent/requisitions${qs}`);
  },
  createIndentRequisition: (data: CreateIndentRequisitionRequest) =>
    request<IndentRequisitionDetailResponse>("/indent/requisitions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getIndentRequisition: (id: string) =>
    request<IndentRequisitionDetailResponse>(`/indent/requisitions/${id}`),
  submitIndentRequisition: (id: string) =>
    request<IndentRequisition>(`/indent/requisitions/${id}/submit`, {
      method: "PUT",
    }),
  approveIndentRequisition: (id: string, data: ApproveIndentRequest) =>
    request<IndentRequisitionDetailResponse>(
      `/indent/requisitions/${id}/approve`,
      { method: "PUT", body: JSON.stringify(data) },
    ),
  rejectIndentRequisition: (id: string) =>
    request<IndentRequisition>(`/indent/requisitions/${id}/reject`, {
      method: "PUT",
    }),
  issueIndentRequisition: (id: string, data: IssueIndentRequest) =>
    request<IndentRequisitionDetailResponse>(
      `/indent/requisitions/${id}/issue`,
      { method: "PUT", body: JSON.stringify(data) },
    ),
  cancelIndentRequisition: (id: string) =>
    request<IndentRequisition>(`/indent/requisitions/${id}/cancel`, {
      method: "PUT",
    }),
  listStoreCatalog: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<StoreCatalog[]>(`/indent/catalog${qs}`);
  },
  createStoreCatalogItem: (data: CreateStoreCatalogRequest) =>
    request<StoreCatalog>("/indent/catalog", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStoreCatalogItem: (id: string, data: UpdateStoreCatalogRequest) =>
    request<StoreCatalog>(`/indent/catalog/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listStoreStockMovements: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<StockMovementListResponse>(`/indent/stock/movements${qs}`);
  },
  createStoreStockMovement: (data: CreateStoreStockMovementRequest) =>
    request<StoreStockMovement>("/indent/stock/movements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Indent Analytics ──────────────────────────────────
  getConsumptionAnalysis: (params?: Record<string, string>) =>
    request<ConsumptionAnalysisRow[]>(`/indent/analytics/consumption${params ? `?${new URLSearchParams(params)}` : ""}`),
  getDeadStockReport: (params?: Record<string, string>) =>
    request<DeadStockRow[]>(`/indent/analytics/dead-stock${params ? `?${new URLSearchParams(params)}` : ""}`),
  getPurchaseConsumptionTrend: (params?: Record<string, string>) =>
    request<PurchaseConsumptionTrendRow[]>(`/indent/analytics/purchase-vs-consumption${params ? `?${new URLSearchParams(params)}` : ""}`),
  getInventoryValuation: () =>
    request<InventoryValuationRow[]>("/indent/analytics/valuation"),
  getComplianceReport: () =>
    request<ComplianceCheckRow[]>("/indent/analytics/compliance"),
  getFsnAnalysis: (params?: Record<string, string>) =>
    request<FsnAnalysisRow[]>(`/indent/analytics/fsn${params ? `?${new URLSearchParams(params)}` : ""}`),
  getAbcAnalysis: () =>
    request<AbcAnalysisRow[]>("/indent/analytics/abc"),
  getVedAnalysis: () =>
    request<VedAnalysisRow[]>("/indent/analytics/ved"),

  // ── Indent Store Ops ──────────────────────────────────
  createDepartmentIssue: (data: DepartmentIssueRequest) =>
    request<StoreStockMovement>("/indent/department-issues", { method: "POST", body: JSON.stringify(data) }),
  issueToPatient: (data: IssueToPatientRequest) =>
    request<PatientConsumableIssue>("/indent/patient-consumables", { method: "POST", body: JSON.stringify(data) }),
  listPatientConsumables: (params?: Record<string, string>) =>
    request<PatientConsumableIssue[]>(`/indent/patient-consumables${params ? `?${new URLSearchParams(params)}` : ""}`),
  createReturnToStore: (data: ReturnToStoreRequest) =>
    request<StoreStockMovement>("/indent/returns", { method: "POST", body: JSON.stringify(data) }),
  listConsignmentStock: () =>
    request<BatchStock[]>("/indent/consignment-stock"),
  recordConsignmentUsage: (data: ConsignmentUsageRequest) =>
    request<StoreStockMovement>("/indent/consignment-usage", { method: "POST", body: JSON.stringify(data) }),

  // ── Indent Assets & Implants ──────────────────────────
  listImplantRegistry: (params?: Record<string, string>) =>
    request<ImplantRegistryEntry[]>(`/indent/implant-registry${params ? `?${new URLSearchParams(params)}` : ""}`),
  createImplantEntry: (data: CreateImplantRequest) =>
    request<ImplantRegistryEntry>("/indent/implant-registry", { method: "POST", body: JSON.stringify(data) }),
  updateImplantEntry: (id: string, data: UpdateImplantRequest) =>
    request<ImplantRegistryEntry>(`/indent/implant-registry/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  listCondemnations: (params?: Record<string, string>) =>
    request<EquipmentCondemnation[]>(`/indent/condemnations${params ? `?${new URLSearchParams(params)}` : ""}`),
  createCondemnation: (data: CreateCondemnationRequest) =>
    request<EquipmentCondemnation>("/indent/condemnations", { method: "POST", body: JSON.stringify(data) }),
  updateCondemnationStatus: (id: string, data: UpdateCondemnationStatusRequest) =>
    request<EquipmentCondemnation>(`/indent/condemnations/${id}/status`, { method: "PUT", body: JSON.stringify(data) }),

  // ── Indent Reorder Alerts ─────────────────────────────
  checkReorderAlerts: () =>
    request<ReorderAlert[]>("/indent/reorder-alerts/check", { method: "POST" }),
  listReorderAlerts: () =>
    request<ReorderAlert[]>("/indent/reorder-alerts"),
  acknowledgeReorderAlert: (id: string) =>
    request<ReorderAlert>(`/indent/reorder-alerts/${id}/acknowledge`, { method: "PUT" }),

  // ── OPD ──────────────────────────────────────────────

  listEncounters: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<EncounterListResponse>(`/opd/encounters${qs}`);
  },
  createEncounter: (data: CreateEncounterRequest) =>
    request<CreateEncounterResponse>("/opd/encounters", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getEncounter: (id: string) =>
    request<Encounter>(`/opd/encounters/${id}`),
  updateEncounter: (id: string, data: UpdateEncounterRequest) =>
    request<Encounter>(`/opd/encounters/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listQueue: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<QueueEntry[]>(`/opd/queue${qs}`);
  },
  callQueueEntry: (id: string) =>
    request<{ status: string }>(`/opd/queue/${id}/call`, { method: "PUT" }),
  startConsultation: (id: string) =>
    request<{ status: string }>(`/opd/queue/${id}/start`, { method: "PUT" }),
  completeQueueEntry: (id: string) =>
    request<{ status: string }>(`/opd/queue/${id}/complete`, { method: "PUT" }),
  markNoShow: (id: string) =>
    request<{ status: string }>(`/opd/queue/${id}/no-show`, { method: "PUT" }),
  listVitals: (encounterId: string) =>
    request<Vital[]>(`/opd/encounters/${encounterId}/vitals`),
  createVital: (encounterId: string, data: CreateVitalRequest) =>
    request<Vital>(`/opd/encounters/${encounterId}/vitals`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getConsultation: (encounterId: string) =>
    request<Consultation>(`/opd/encounters/${encounterId}/consultation`),
  createConsultation: (encounterId: string, data: CreateConsultationRequest) =>
    request<Consultation>(`/opd/encounters/${encounterId}/consultation`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateConsultation: (
    encounterId: string,
    consultationId: string,
    data: UpdateConsultationRequest,
  ) =>
    request<Consultation>(
      `/opd/encounters/${encounterId}/consultation/${consultationId}`,
      { method: "PUT", body: JSON.stringify(data) },
    ),
  listDiagnoses: (encounterId: string) =>
    request<Diagnosis[]>(`/opd/encounters/${encounterId}/diagnoses`),
  createDiagnosis: (encounterId: string, data: CreateDiagnosisRequest) =>
    request<Diagnosis>(`/opd/encounters/${encounterId}/diagnoses`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteDiagnosis: (encounterId: string, diagnosisId: string) =>
    request<{ status: string }>(
      `/opd/encounters/${encounterId}/diagnoses/${diagnosisId}`,
      { method: "DELETE" },
    ),
  listPrescriptions: (encounterId: string) =>
    request<PrescriptionWithItems[]>(
      `/opd/encounters/${encounterId}/prescriptions`,
    ),
  getPrescription: (prescriptionId: string) =>
    request<PrescriptionWithItems>(
      `/opd/prescriptions/${prescriptionId}`,
    ),
  createPrescription: (
    encounterId: string,
    data: CreatePrescriptionRequest,
  ) =>
    request<PrescriptionWithItems>(
      `/opd/encounters/${encounterId}/prescriptions`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  // ── Prescription Templates ──────────────────────────────
  listPrescriptionTemplates: () =>
    request<PrescriptionTemplate[]>("/opd/prescription-templates"),
  createPrescriptionTemplate: (data: CreatePrescriptionTemplateRequest) =>
    request<PrescriptionTemplate>("/opd/prescription-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePrescriptionTemplate: (id: string) =>
    request<{ status: string }>(`/opd/prescription-templates/${id}`, {
      method: "DELETE",
    }),

  // ── Patient Prescription History ───────────────────────
  listPatientPrescriptions: (patientId: string) =>
    request<PrescriptionHistoryItem[]>(`/opd/patients/${patientId}/prescriptions`),

  // ── Patient Diagnoses (cross-encounter) ────────────────
  listPatientDiagnoses: (patientId: string) =>
    request<PatientDiagnosisRow[]>(`/opd/patients/${patientId}/diagnoses`),

  // ── Medical Certificates ───────────────────────────────
  listCertificates: (patientId: string) =>
    request<MedicalCertificate[]>(`/opd/patients/${patientId}/certificates`),
  createCertificate: (data: CreateMedicalCertificateRequest) =>
    request<MedicalCertificate>("/opd/certificates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Vitals History (Trend Charts) ─────────────────────
  listPatientVitalsHistory: (patientId: string) =>
    request<VitalHistoryPoint[]>(`/opd/patients/${patientId}/vitals-history`),

  // ── Referrals ───────────────────────────────────────────
  listPatientReferrals: (patientId: string) =>
    request<ReferralWithNames[]>(`/opd/patients/${patientId}/referrals`),
  createReferral: (data: CreateReferralRequest) =>
    request<ReferralWithNames>("/opd/referrals", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Procedure Catalog & Orders ──────────────────────────
  listProcedureCatalog: () =>
    request<ProcedureCatalog[]>("/opd/procedure-catalog"),
  listProcedureOrders: (encounterId: string) =>
    request<ProcedureOrderWithName[]>(`/opd/encounters/${encounterId}/procedure-orders`),
  createProcedureOrder: (data: CreateProcedureOrderRequest) =>
    request<ProcedureOrderWithName>("/opd/procedure-orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  cancelProcedureOrder: (id: string) =>
    request<{ status: string }>(`/opd/procedure-orders/${id}`, { method: "DELETE" }),

  // ── Duplicate Order Detection ───────────────────────────
  checkDuplicateOrders: (params: { patient_id: string; test_id?: string; procedure_id?: string; hours?: number }) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
    return request<DuplicateOrderInfo[]>(`/opd/duplicate-check?${qs}`);
  },

  // ── ICD-10 & Chief Complaints ─────────────────────────
  searchIcd10: (q: string, limit?: number) =>
    request<Icd10Code[]>(`/opd/icd10/search?q=${encodeURIComponent(q)}&limit=${limit ?? 20}`),
  listChiefComplaints: () =>
    request<ChiefComplaintMaster[]>("/opd/chief-complaints"),

  // ── SNOMED CT Search ──────────────────────────────────
  searchSnomed: (q: string, limit?: number) =>
    request<SnomedCode[]>(`/opd/snomed/search?q=${encodeURIComponent(q)}&limit=${limit ?? 20}`),

  // ── Multi-Doctor Appointment Groups ───────────────────
  bookAppointmentGroup: (data: BookAppointmentGroupRequest) =>
    request<Appointment[]>("/opd/appointment-groups", { method: "POST", body: JSON.stringify(data) }),
  listAppointmentGroup: (groupId: string) =>
    request<Appointment[]>(`/opd/appointment-groups/${groupId}`),

  // ── Wait Time Estimation ──────────────────────────────
  getWaitEstimate: (params?: { department_id?: string; doctor_id?: string }) => {
    const qs = params
      ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}`
      : "";
    return request<WaitEstimate>(`/opd/queue/wait-estimate${qs}`);
  },

  // ── OPD → IPD Admission ───────────────────────────────
  admitFromOpd: (encounterId: string, data: AdmitFromOpdRequest) =>
    request<AdmitFromOpdResponse>(`/opd/encounters/${encounterId}/admit-to-ipd`, { method: "POST", body: JSON.stringify(data) }),

  // ── Available Beds ────────────────────────────────────
  listAvailableBeds: (params?: { ward_id?: string }) => {
    const qs = params?.ward_id ? `?ward_id=${params.ward_id}` : "";
    return request<AvailableBed[]>(`/ipd/beds/available${qs}`);
  },

  // ── Post-Consultation (Dockets, Reminders, Feedback, Consents) ──

  getDoctorDocket: (date?: string) => {
    const qs = date ? `?date=${date}` : "";
    return request<DoctorDocket | null>(`/opd/docket${qs}`);
  },
  generateDoctorDocket: (date?: string) => {
    const qs = date ? `?date=${date}` : "";
    return request<DoctorDocket>(`/opd/docket/generate${qs}`, { method: "POST" });
  },

  listReminders: (params?: { patient_id?: string; status?: string; from_date?: string; to_date?: string }) => {
    const qs = params
      ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}`
      : "";
    return request<PatientReminder[]>(`/opd/reminders${qs}`);
  },
  createReminder: (data: CreateReminderRequest) =>
    request<PatientReminder>("/opd/reminders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  completeReminder: (id: string) =>
    request<PatientReminder>(`/opd/reminders/${id}/complete`, { method: "PUT" }),
  cancelReminder: (id: string) =>
    request<PatientReminder>(`/opd/reminders/${id}/cancel`, { method: "PUT" }),

  listPatientFeedback: (patientId: string) =>
    request<PatientFeedback[]>(`/opd/patients/${patientId}/feedback`),
  createFeedback: (data: CreateFeedbackRequest) =>
    request<PatientFeedback>("/opd/feedback", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listProcedureConsents: (patientId: string) =>
    request<ProcedureConsent[]>(`/opd/patients/${patientId}/consents`),
  createProcedureConsent: (data: CreateConsentRequest) =>
    request<ProcedureConsent>("/opd/consents", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  signProcedureConsent: (id: string) =>
    request<ProcedureConsent>(`/opd/consents/${id}/sign`, { method: "PUT" }),

  // ── Consultation Templates ────────────────────────────
  listConsultationTemplates: () =>
    request<ConsultationTemplate[]>("/opd/consultation-templates"),
  createConsultationTemplate: (data: CreateConsultationTemplateRequest) =>
    request<ConsultationTemplate>("/opd/consultation-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteConsultationTemplate: (id: string) =>
    request<ConsultationTemplate>(`/opd/consultation-templates/${id}`, {
      method: "DELETE",
    }),

  // ── OPD Appointments ──────────────────────────────────

  // Doctor schedules
  listSchedules: (params?: { doctor_id?: string; department_id?: string }) => {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}` : "";
    return request<DoctorSchedule[]>(`/opd/schedules${qs}`);
  },
  createSchedule: (data: CreateScheduleRequest) =>
    request<DoctorSchedule>("/opd/schedules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSchedule: (id: string, data: UpdateScheduleRequest) =>
    request<DoctorSchedule>(`/opd/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSchedule: (id: string) =>
    request<{ status: string }>(`/opd/schedules/${id}`, {
      method: "DELETE",
    }),

  // Schedule exceptions
  listScheduleExceptions: (params: { doctor_id: string; from?: string; to?: string }) => {
    const qs = `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}`;
    return request<DoctorScheduleException[]>(`/opd/schedule-exceptions${qs}`);
  },
  createScheduleException: (data: CreateScheduleExceptionRequest) =>
    request<DoctorScheduleException>("/opd/schedule-exceptions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteScheduleException: (id: string) =>
    request<{ status: string }>(`/opd/schedule-exceptions/${id}`, {
      method: "DELETE",
    }),

  // Available slots
  getAvailableSlots: (doctorId: string, date: string) =>
    request<AvailableSlot[]>(`/opd/doctors/${doctorId}/slots?date=${date}`),

  // Appointments
  listAppointments: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<AppointmentWithPatient[]>(`/opd/appointments${qs}`);
  },
  bookAppointment: (data: BookAppointmentRequest) =>
    request<Appointment>("/opd/appointments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getAppointment: (id: string) =>
    request<Appointment>(`/opd/appointments/${id}`),
  rescheduleAppointment: (id: string, data: RescheduleAppointmentRequest) =>
    request<Appointment>(`/opd/appointments/${id}/reschedule`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  cancelAppointment: (id: string, data: CancelAppointmentRequest) =>
    request<Appointment>(`/opd/appointments/${id}/cancel`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  checkInAppointment: (id: string) =>
    request<Appointment>(`/opd/appointments/${id}/check-in`, {
      method: "PUT",
    }),
  completeAppointment: (id: string) =>
    request<Appointment>(`/opd/appointments/${id}/complete`, {
      method: "PUT",
    }),
  markAppointmentNoShow: (id: string) =>
    request<Appointment>(`/opd/appointments/${id}/no-show`, {
      method: "PUT",
    }),

  // ── Billing ────────────────────────────────────────────

  listInvoices: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<InvoiceListResponse>(`/billing/invoices${qs}`);
  },
  createInvoice: (data: CreateInvoiceRequest) =>
    request<Invoice>("/billing/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getInvoice: (id: string) =>
    request<InvoiceDetailResponse>(`/billing/invoices/${id}`),
  updateInvoice: (id: string, data: { notes?: string }) =>
    request<Invoice>(`/billing/invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  addInvoiceItem: (invoiceId: string, data: AddInvoiceItemRequest) =>
    request<InvoiceItem>(`/billing/invoices/${invoiceId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeInvoiceItem: (invoiceId: string, itemId: string) =>
    request<{ status: string }>(
      `/billing/invoices/${invoiceId}/items/${itemId}`,
      { method: "DELETE" },
    ),
  issueInvoice: (id: string) =>
    request<Invoice>(`/billing/invoices/${id}/issue`, { method: "POST" }),
  cancelInvoice: (id: string) =>
    request<Invoice>(`/billing/invoices/${id}/cancel`, { method: "POST" }),
  recordPayment: (invoiceId: string, data: RecordPaymentRequest) =>
    request<Payment>(`/billing/invoices/${invoiceId}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPayments: (invoiceId: string) =>
    request<Payment[]>(`/billing/invoices/${invoiceId}/payments`),
  listChargeMaster: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<ChargeMaster[]>(`/billing/charge-master${qs}`);
  },
  createChargeMaster: (data: CreateChargeMasterRequest) =>
    request<ChargeMaster>("/billing/charge-master", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateChargeMaster: (id: string, data: UpdateChargeMasterRequest) =>
    request<ChargeMaster>(`/billing/charge-master/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteChargeMaster: (id: string) =>
    request<{ status: string }>(`/billing/charge-master/${id}`, {
      method: "DELETE",
    }),

  // -- Billing Packages --
  listPackages: () => request<BillingPackage[]>("/billing/packages"),
  getPackage: (id: string) =>
    request<PackageDetailResponse>(`/billing/packages/${id}`),
  createPackage: (data: CreatePackageRequest) =>
    request<BillingPackage>("/billing/packages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePackage: (id: string, data: UpdatePackageRequest) =>
    request<BillingPackage>(`/billing/packages/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePackage: (id: string) =>
    request<{ deleted: boolean }>(`/billing/packages/${id}`, {
      method: "DELETE",
    }),

  // -- Rate Plans --
  listRatePlans: () => request<RatePlan[]>("/billing/rate-plans"),
  getRatePlan: (id: string) =>
    request<RatePlanDetailResponse>(`/billing/rate-plans/${id}`),
  createRatePlan: (data: CreateRatePlanRequest) =>
    request<RatePlan>("/billing/rate-plans", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRatePlan: (id: string, data: UpdateRatePlanRequest) =>
    request<RatePlan>(`/billing/rate-plans/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRatePlan: (id: string) =>
    request<{ deleted: boolean }>(`/billing/rate-plans/${id}`, {
      method: "DELETE",
    }),

  // -- Discounts --
  listInvoiceDiscounts: (invoiceId: string) =>
    request<InvoiceDiscount[]>(`/billing/invoices/${invoiceId}/discounts`),
  addDiscount: (invoiceId: string, data: AddDiscountRequest) =>
    request<InvoiceDiscount>(`/billing/invoices/${invoiceId}/discounts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeDiscount: (invoiceId: string, discountId: string) =>
    request<{ deleted: boolean }>(
      `/billing/invoices/${invoiceId}/discounts/${discountId}`,
      { method: "DELETE" },
    ),

  // -- Refunds --
  listRefunds: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<Refund[]>(`/billing/refunds${qs}`);
  },
  createRefund: (data: CreateRefundRequest) =>
    request<Refund>("/billing/refunds", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- Credit Notes --
  listCreditNotes: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<CreditNote[]>(`/billing/credit-notes${qs}`);
  },
  createCreditNote: (data: CreateCreditNoteRequest) =>
    request<CreditNote>("/billing/credit-notes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  applyCreditNote: (id: string, invoiceId: string) =>
    request<CreditNote>(`/billing/credit-notes/${id}/apply`, {
      method: "POST",
      body: JSON.stringify({ invoice_id: invoiceId }),
    }),

  // -- Receipts --
  listReceipts: (invoiceId: string) =>
    request<Receipt[]>(`/billing/invoices/${invoiceId}/receipts`),
  generateReceipt: (invoiceId: string, paymentId: string) =>
    request<Receipt>(`/billing/invoices/${invoiceId}/receipts`, {
      method: "POST",
      body: JSON.stringify({ payment_id: paymentId }),
    }),

  // -- Insurance Claims --
  listInsuranceClaims: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<InsuranceClaim[]>(`/billing/insurance-claims${qs}`);
  },
  getInsuranceClaim: (id: string) =>
    request<InsuranceClaim>(`/billing/insurance-claims/${id}`),
  createInsuranceClaim: (data: CreateInsuranceClaimRequest) =>
    request<InsuranceClaim>("/billing/insurance-claims", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateInsuranceClaim: (id: string, data: UpdateInsuranceClaimRequest) =>
    request<InsuranceClaim>(`/billing/insurance-claims/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // -- Auto Billing --
  triggerAutoCharge: (data: ManualAutoChargeRequest) =>
    request<ManualAutoChargeResponse>("/billing/auto-charge", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- Advances --
  listAdvances: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PatientAdvance[]>(`/billing/advances${qs}`);
  },
  createAdvance: (data: CreateAdvanceRequest) =>
    request<PatientAdvance>("/billing/advances", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adjustAdvance: (id: string, data: AdjustAdvanceRequest) =>
    request<AdvanceAdjustment>(`/billing/advances/${id}/adjust`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  refundAdvance: (id: string, data: RefundAdvanceRequest) =>
    request<PatientAdvance>(`/billing/advances/${id}/refund`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- Interim Billing --
  createInterimInvoice: (data: CreateInterimInvoiceRequest) =>
    request<Invoice>("/billing/invoices/interim", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- Corporate Clients --
  listCorporates: () => request<CorporateClient[]>("/billing/corporates"),
  getCorporate: (id: string) => request<CorporateClient>(`/billing/corporates/${id}`),
  createCorporate: (data: CreateCorporateRequest) =>
    request<CorporateClient>("/billing/corporates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCorporate: (id: string, data: UpdateCorporateRequest) =>
    request<CorporateClient>(`/billing/corporates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCorporateEnrollments: (corporateId: string) =>
    request<CorporateEnrollment[]>(`/billing/corporates/${corporateId}/enrollments`),
  createCorporateEnrollment: (corporateId: string, data: CreateEnrollmentRequest) =>
    request<CorporateEnrollment>(`/billing/corporates/${corporateId}/enrollments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteCorporateEnrollment: (corporateId: string, enrollmentId: string) =>
    request<{ deleted: boolean }>(`/billing/corporates/${corporateId}/enrollments/${enrollmentId}`, {
      method: "DELETE",
    }),
  listCorporateInvoices: (corporateId: string) =>
    request<Invoice[]>(`/billing/corporates/${corporateId}/invoices`),

  // -- Billing Reports --
  billingReportSummary: (from: string, to: string) =>
    request<BillingSummaryReport>(`/billing/reports/summary?from=${from}&to=${to}`),
  billingReportDepartmentRevenue: (from: string, to: string) =>
    request<DepartmentRevenueRow[]>(`/billing/reports/department-revenue?from=${from}&to=${to}`),
  billingReportCollectionEfficiency: (from: string, to: string) =>
    request<CollectionEfficiencyReport>(`/billing/reports/collection-efficiency?from=${from}&to=${to}`),
  billingReportAging: () => request<AgingBucket[]>("/billing/reports/aging"),
  billingReportDaily: (date: string) =>
    request<DailySummary>(`/billing/reports/daily?date=${date}`),
  billingReportDoctorRevenue: (from: string, to: string) =>
    request<DoctorRevenueRow[]>(`/billing/reports/doctor-revenue?from=${from}&to=${to}`),
  billingReportInsurancePanel: (from: string, to: string) =>
    request<InsurancePanelRow[]>(`/billing/reports/insurance-panel?from=${from}&to=${to}`),
  billingReportReconciliation: (date: string) =>
    request<ReconciliationReport>(`/billing/reports/reconciliation?date=${date}`),

  // -- Day Close --
  listDayCloses: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<DayEndClose[]>(`/billing/day-closes${qs}`);
  },
  createDayClose: (data: CreateDayCloseRequest) =>
    request<DayEndClose>("/billing/day-closes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  verifyDayClose: (id: string) =>
    request<DayEndClose>(`/billing/day-closes/${id}/verify`, { method: "POST" }),

  // -- Write-Offs --
  listWriteOffs: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<BadDebtWriteOff[]>(`/billing/write-offs${qs}`);
  },
  createWriteOff: (data: CreateWriteOffRequest) =>
    request<BadDebtWriteOff>("/billing/write-offs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approveWriteOff: (id: string, data: ApproveWriteOffRequest) =>
    request<BadDebtWriteOff>(`/billing/write-offs/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- TPA Rate Cards --
  listTpaRateCards: () => request<TpaRateCard[]>("/billing/tpa-rate-cards"),
  createTpaRateCard: (data: CreateTpaRateCardRequest) =>
    request<TpaRateCard>("/billing/tpa-rate-cards", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTpaRateCard: (id: string, data: UpdateTpaRateCardRequest) =>
    request<TpaRateCard>(`/billing/tpa-rate-cards/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteTpaRateCard: (id: string) =>
    request<{ deleted: boolean }>(`/billing/tpa-rate-cards/${id}`, { method: "DELETE" }),

  // -- Clone & Audit --
  cloneInvoice: (id: string) =>
    request<Invoice>(`/billing/invoices/${id}/clone`, { method: "POST" }),
  listBillingAuditLog: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<AuditLogResponse>(`/billing/audit-log${qs}`);
  },

  // -- Billing Phase 3: Exchange Rates --
  listExchangeRates: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<ExchangeRate[]>(`/billing/exchange-rates${qs}`);
  },
  createExchangeRate: (data: CreateExchangeRateRequest) =>
    request<ExchangeRate>("/billing/exchange-rates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- Billing Phase 3: Invoice Print & Threshold --
  getInvoicePrintData: (id: string) =>
    request<InvoicePrintData>(`/billing/invoices/${id}/print-data`),
  checkBillingThreshold: (encounterId: string) =>
    request<BillingThresholdStatus>(`/billing/threshold-check/${encounterId}`),
  getSchemeRate: (params: Record<string, string>) => {
    const qs = `?${new URLSearchParams(params)}`;
    return request<SchemeRateResult>(`/billing/scheme-rate${qs}`);
  },

  // -- Billing Phase 3: Credit Patients --
  listCreditPatients: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<CreditPatient[]>(`/billing/credit-patients${qs}`);
  },
  createCreditPatient: (data: CreateCreditPatientRequest) =>
    request<CreditPatient>("/billing/credit-patients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCreditPatient: (id: string, data: UpdateCreditPatientRequest) =>
    request<CreditPatient>(`/billing/credit-patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  reportCreditAging: () =>
    request<CreditAgingRow[]>("/billing/credit-patients/aging"),

  // -- Billing Phase 3: Dual Insurance --
  coordinateDualInsurance: (invoiceId: string) =>
    request<DualInsuranceResult>(`/billing/invoices/${invoiceId}/dual-insurance`, {
      method: "POST",
    }),
  getDualInsuranceStatus: (invoiceId: string) =>
    request<DualInsuranceResult>(`/billing/invoices/${invoiceId}/dual-insurance`),
  generateReimbursementDocs: (claimId: string, documents: unknown) =>
    request<InsuranceClaim>(`/billing/insurance-claims/${claimId}/reimbursement-docs`, {
      method: "POST",
      body: JSON.stringify({ documents }),
    }),
  updateReimbursementDocs: (claimId: string, documents: unknown) =>
    request<InsuranceClaim>(`/billing/insurance-claims/${claimId}/reimbursement-docs`, {
      method: "PUT",
      body: JSON.stringify({ documents }),
    }),

  // -- Billing Phase 3: GL Accounts --
  listGlAccounts: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<GlAccount[]>(`/billing/gl-accounts${qs}`);
  },
  createGlAccount: (data: CreateGlAccountRequest) =>
    request<GlAccount>("/billing/gl-accounts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateGlAccount: (id: string, data: UpdateGlAccountRequest) =>
    request<GlAccount>(`/billing/gl-accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // -- Billing Phase 3: Journal Entries --
  listJournalEntries: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<JournalEntry[]>(`/billing/journal-entries${qs}`);
  },
  getJournalEntry: (id: string) =>
    request<JournalEntryDetail>(`/billing/journal-entries/${id}`),
  createJournalEntry: (data: CreateJournalEntryRequest) =>
    request<JournalEntryDetail>("/billing/journal-entries", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  postJournalEntry: (id: string) =>
    request<JournalEntry>(`/billing/journal-entries/${id}/post`, { method: "POST" }),
  reverseJournalEntry: (id: string) =>
    request<JournalEntryDetail>(`/billing/journal-entries/${id}/reverse`, { method: "POST" }),

  // -- Billing Phase 3: Bank Reconciliation --
  listBankTransactions: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<BankTransaction[]>(`/billing/bank-transactions${qs}`);
  },
  importBankTransactions: (data: ImportBankTransactionsRequest) =>
    request<ImportBankTransactionsResponse>("/billing/bank-transactions/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  matchBankTransaction: (id: string, data: MatchBankTransactionRequest) =>
    request<BankTransaction>(`/billing/bank-transactions/${id}/match`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  autoReconcile: () =>
    request<AutoReconcileResponse>("/billing/bank-transactions/auto-reconcile", {
      method: "POST",
    }),

  // -- Billing Phase 3: TDS --
  listTdsDeductions: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<TdsDeduction[]>(`/billing/tds${qs}`);
  },
  createTdsDeduction: (data: CreateTdsRequest) =>
    request<TdsDeduction>("/billing/tds", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  depositTds: (id: string, data: { challan_number: string; challan_date: string }) =>
    request<TdsDeduction>(`/billing/tds/${id}/deposit`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  issueTdsCertificate: (id: string, data: { certificate_number: string; certificate_date: string }) =>
    request<TdsDeduction>(`/billing/tds/${id}/certificate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- Billing Phase 3: GST Returns --
  generateGstrSummary: (data: GenerateGstrRequest) =>
    request<GstReturnSummary>("/billing/gst-returns/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listGstrSummaries: () =>
    request<GstReturnSummary[]>("/billing/gst-returns"),
  fileGstr: (id: string) =>
    request<GstReturnSummary>(`/billing/gst-returns/${id}/file`, { method: "POST" }),
  reportHsnSummary: (period: string) =>
    request<HsnSummaryRow[]>(`/billing/reports/hsn-summary?period=${period}`),

  // -- Billing Phase 3: Financial MIS & P&L --
  reportFinancialMis: (dateFrom: string, dateTo: string) =>
    request<FinancialMisReport>(`/billing/reports/financial-mis?date_from=${dateFrom}&date_to=${dateTo}`),
  reportProfitLoss: (dateFrom: string, dateTo: string) =>
    request<ProfitLossDeptRow[]>(`/billing/reports/profit-loss?date_from=${dateFrom}&date_to=${dateTo}`),

  // -- Billing Phase 3: ERP Export --
  exportToErp: (data: ErpExportRequest) =>
    request<ErpExportLog>("/billing/erp/export", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listErpExports: () =>
    request<ErpExportLog[]>("/billing/erp/exports"),

  // ── Lab ────────────────────────────────────────────────

  listLabOrders: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabOrderListResponse>(`/lab/orders${qs}`);
  },
  createLabOrder: (data: CreateLabOrderRequest) =>
    request<LabOrder>("/lab/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getLabOrder: (id: string) =>
    request<LabOrderDetailResponse>(`/lab/orders/${id}`),
  collectSample: (id: string) =>
    request<LabOrder>(`/lab/orders/${id}/collect`, { method: "PUT" }),
  startProcessing: (id: string) =>
    request<LabOrder>(`/lab/orders/${id}/process`, { method: "PUT" }),
  completeLabOrder: (id: string) =>
    request<LabOrder>(`/lab/orders/${id}/complete`, { method: "PUT" }),
  verifyResults: (id: string) =>
    request<LabOrder>(`/lab/orders/${id}/verify`, { method: "PUT" }),
  cancelLabOrder: (id: string) =>
    request<LabOrder>(`/lab/orders/${id}/cancel`, { method: "PUT" }),
  addLabResults: (orderId: string, data: AddResultsRequest) =>
    request<LabResult[]>(`/lab/orders/${orderId}/results`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listLabResults: (orderId: string) =>
    request<LabResult[]>(`/lab/orders/${orderId}/results`),
  listLabCatalog: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabTestCatalog[]>(`/lab/catalog${qs}`);
  },
  createLabCatalogEntry: (data: CreateLabCatalogRequest) =>
    request<LabTestCatalog>("/lab/catalog", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLabCatalogEntry: (id: string, data: UpdateLabCatalogRequest) =>
    request<LabTestCatalog>(`/lab/catalog/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Panels
  listLabPanels: () =>
    request<LabTestPanel[]>("/lab/panels"),
  getLabPanel: (id: string) =>
    request<LabPanelDetailResponse>(`/lab/panels/${id}`),
  createLabPanel: (data: CreateLabPanelRequest) =>
    request<LabPanelDetailResponse>("/lab/panels", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLabPanel: (id: string, data: UpdateLabPanelRequest) =>
    request<LabPanelDetailResponse>(`/lab/panels/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteLabPanel: (id: string) =>
    request<{ deleted: boolean }>(`/lab/panels/${id}`, { method: "DELETE" }),

  // Sample Rejection
  rejectSample: (orderId: string, data: RejectSampleRequest) =>
    request<LabOrder>(`/lab/orders/${orderId}/reject`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — Amendments & Critical Alerts
  amendLabResult: (orderId: string, data: AmendResultRequest) =>
    request<LabResultAmendment>(`/lab/orders/${orderId}/results/amend`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listLabAmendments: (orderId: string) =>
    request<LabResultAmendment[]>(`/lab/orders/${orderId}/amendments`),
  listCriticalAlerts: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabCriticalAlert[]>(`/lab/critical-alerts${qs}`);
  },
  acknowledgeCriticalAlert: (alertId: string) =>
    request<LabCriticalAlert>(`/lab/critical-alerts/${alertId}/acknowledge`, { method: "PUT" }),

  // Lab Phase 2 — Report Status
  updateLabReportStatus: (orderId: string, data: UpdateReportStatusRequest) =>
    request<LabOrder>(`/lab/orders/${orderId}/report-status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  lockLabReport: (orderId: string) =>
    request<LabOrder>(`/lab/orders/${orderId}/lock-report`, { method: "PUT" }),

  // Lab Phase 2 — Cumulative & TAT
  getLabCumulativeReport: (patientId: string, testId: string) =>
    request<CumulativeReportResponse>(`/lab/patients/${patientId}/cumulative/${testId}`),
  getLabTatMonitoring: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<TatMonitoringRow[]>(`/lab/tat-monitoring${qs}`);
  },

  // Lab Phase 2 — Reagent Lots
  listReagentLots: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabReagentLot[]>(`/lab/reagent-lots${qs}`);
  },
  createReagentLot: (data: CreateReagentLotRequest) =>
    request<LabReagentLot>("/lab/reagent-lots", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateReagentLot: (id: string, data: UpdateReagentLotRequest) =>
    request<LabReagentLot>(`/lab/reagent-lots/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — QC Results
  listQcResults: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabQcResult[]>(`/lab/qc-results${qs}`);
  },
  createQcResult: (data: CreateQcResultRequest) =>
    request<LabQcResult>("/lab/qc-results", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — Calibrations
  listCalibrations: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabCalibration[]>(`/lab/calibrations${qs}`);
  },
  createCalibration: (data: CreateCalibrationRequest) =>
    request<LabCalibration>("/lab/calibrations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — Phlebotomy Queue
  listPhlebotomyQueue: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabPhlebotomyQueueItem[]>(`/lab/phlebotomy-queue${qs}`);
  },
  createPhlebotomyEntry: (data: CreatePhlebotomyEntryRequest) =>
    request<LabPhlebotomyQueueItem>("/lab/phlebotomy-queue", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePhlebotomyStatus: (id: string, data: UpdatePhlebotomyStatusRequest) =>
    request<LabPhlebotomyQueueItem>(`/lab/phlebotomy-queue/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — Outsourced Orders
  listOutsourcedOrders: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabOutsourcedOrder[]>(`/lab/outsourced${qs}`);
  },
  createOutsourcedOrder: (data: CreateOutsourcedOrderRequest) =>
    request<LabOutsourcedOrder>("/lab/outsourced", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateOutsourcedOrder: (id: string, data: UpdateOutsourcedOrderRequest) =>
    request<LabOutsourcedOrder>(`/lab/outsourced/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — Add-on Test
  addOnLabTest: (orderId: string, data: AddOnTestRequest) =>
    request<LabOrder>(`/lab/orders/${orderId}/add-on`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — Home Collections
  listHomeCollections: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabHomeCollection[]>(`/lab/home-collections${qs}`);
  },
  createHomeCollection: (data: CreateHomeCollectionRequest) =>
    request<LabHomeCollection>("/lab/home-collections", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateHomeCollection: (id: string, data: UpdateHomeCollectionRequest) =>
    request<LabHomeCollection>(`/lab/home-collections/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  updateHomeCollectionStatus: (id: string, data: HomeCollectionStatusRequest) =>
    request<LabHomeCollection>(`/lab/home-collections/${id}/status`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getHomeCollectionStats: () =>
    request<HomeCollectionStatsRow[]>("/lab/home-collections/stats"),

  // Lab Phase 3 — Collection Centers
  listCollectionCenters: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabCollectionCenter[]>(`/lab/collection-centers${qs}`);
  },
  createCollectionCenter: (data: CreateCollectionCenterRequest) =>
    request<LabCollectionCenter>("/lab/collection-centers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCollectionCenter: (id: string, data: UpdateCollectionCenterRequest) =>
    request<LabCollectionCenter>(`/lab/collection-centers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — Sample Archive
  listSampleArchive: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabSampleArchive[]>(`/lab/sample-archive${qs}`);
  },
  createSampleArchive: (data: CreateSampleArchiveRequest) =>
    request<LabSampleArchive>("/lab/sample-archive", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  retrieveSampleArchive: (id: string) =>
    request<LabSampleArchive>(`/lab/sample-archive/${id}/retrieve`, {
      method: "POST",
    }),

  // Lab Phase 3 — Report Dispatches
  listReportDispatches: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabReportDispatch[]>(`/lab/report-dispatches${qs}`);
  },
  createReportDispatch: (data: CreateReportDispatchRequest) =>
    request<LabReportDispatch>("/lab/report-dispatches", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  confirmReportDispatch: (id: string) =>
    request<LabReportDispatch>(`/lab/report-dispatches/${id}/confirm`, {
      method: "POST",
    }),

  // Lab Phase 3 — Report Templates
  listReportTemplates: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabReportTemplate[]>(`/lab/report-templates${qs}`);
  },
  createReportTemplate: (data: CreateReportTemplateRequest) =>
    request<LabReportTemplate>("/lab/report-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateReportTemplate: (id: string, data: UpdateReportTemplateRequest) =>
    request<LabReportTemplate>(`/lab/report-templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — STAT Orders
  listStatOrders: () =>
    request<TatMonitoringRow[]>("/lab/stat-orders"),

  // Lab Phase 3 — EQAS
  listEqasResults: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabEqasResult[]>(`/lab/eqas${qs}`);
  },
  createEqasResult: (data: CreateEqasResultRequest) =>
    request<LabEqasResult>("/lab/eqas", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateEqasResult: (id: string, data: UpdateEqasResultRequest) =>
    request<LabEqasResult>(`/lab/eqas/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — Proficiency Testing
  listProficiencyTests: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabProficiencyTest[]>(`/lab/proficiency-tests${qs}`);
  },
  createProficiencyTest: (data: CreateProficiencyTestRequest) =>
    request<LabProficiencyTest>("/lab/proficiency-tests", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — NABL Documents
  listNablDocuments: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabNablDocument[]>(`/lab/nabl-documents${qs}`);
  },
  createNablDocument: (data: CreateNablDocumentRequest) =>
    request<LabNablDocument>("/lab/nabl-documents", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNablDocument: (id: string, data: UpdateNablDocumentRequest) =>
    request<LabNablDocument>(`/lab/nabl-documents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — Reagent Consumption
  getReagentConsumption: () =>
    request<ReagentConsumptionRow[]>("/lab/reagent-consumption"),

  // Lab Phase 3 — Specialized Reports
  getHistopathReport: (orderId: string) =>
    request<LabHistopathReport>(`/lab/histopath/${orderId}`),
  createHistopathReport: (data: CreateHistopathReportRequest) =>
    request<LabHistopathReport>("/lab/histopath", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getCytologyReport: (orderId: string) =>
    request<LabCytologyReport>(`/lab/cytology/${orderId}`),
  createCytologyReport: (data: CreateCytologyReportRequest) =>
    request<LabCytologyReport>("/lab/cytology", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getMolecularReport: (orderId: string) =>
    request<LabMolecularReport>(`/lab/molecular/${orderId}`),
  createMolecularReport: (data: CreateMolecularReportRequest) =>
    request<LabMolecularReport>("/lab/molecular", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — B2B
  listB2bClients: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabB2bClient[]>(`/lab/b2b-clients${qs}`);
  },
  createB2bClient: (data: CreateB2bClientRequest) =>
    request<LabB2bClient>("/lab/b2b-clients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateB2bClient: (id: string, data: UpdateB2bClientRequest) =>
    request<LabB2bClient>(`/lab/b2b-clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listB2bRates: (clientId: string) =>
    request<LabB2bRate[]>(`/lab/b2b-clients/${clientId}/rates`),
  createB2bRate: (clientId: string, data: CreateB2bRateRequest) =>
    request<LabB2bRate>(`/lab/b2b-clients/${clientId}/rates`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  autoValidateResult: (resultId: string) =>
    request<AutoValidateResult>(`/lab/results/${resultId}/auto-validate`, {
      method: "POST",
    }),
  listDoctorCriticalAlerts: (doctorId: string) =>
    request<Record<string, unknown>[]>(`/lab/critical-alerts/doctor/${doctorId}`),
  getLabTatAnalytics: () =>
    request<LabTatAnalyticsRow[]>("/lab/analytics/tat"),
  getOrderCrossmatch: (orderId: string) =>
    request<LabCrossmatchLink>(`/lab/orders/${orderId}/crossmatch`),

  // ── Radiology ────────────────────────────────────────

  listRadiologyOrders: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<RadiologyOrderListResponse>(`/radiology/orders${qs}`);
  },

  createRadiologyOrder: (data: CreateRadiologyOrderRequest) =>
    request<RadiologyOrder>("/radiology/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getRadiologyOrder: (id: string) =>
    request<RadiologyOrderDetailResponse>(`/radiology/orders/${id}`),

  updateRadiologyOrderStatus: (id: string, status: string) =>
    request<RadiologyOrder>(`/radiology/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  cancelRadiologyOrder: (id: string, data: CancelRadiologyOrderRequest) =>
    request<RadiologyOrder>(`/radiology/orders/${id}/cancel`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  createRadiologyReport: (orderId: string, data: CreateRadiologyReportRequest) =>
    request<RadiologyReport>(`/radiology/orders/${orderId}/report`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  verifyRadiologyReport: (id: string) =>
    request<RadiologyReport>(`/radiology/reports/${id}/verify`, {
      method: "PUT",
    }),

  recordRadiationDose: (orderId: string, data: RecordDoseRequest) =>
    request<RadiationDoseRecord>(`/radiology/orders/${orderId}/dose`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listRadiologyModalities: () =>
    request<RadiologyModality[]>("/radiology/modalities"),

  createRadiologyModality: (data: CreateModalityRequest) =>
    request<RadiologyModality>("/radiology/modalities", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRadiologyModality: (id: string, data: UpdateModalityRequest) =>
    request<RadiologyModality>(`/radiology/modalities/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteRadiologyModality: (id: string) =>
    request<{ deleted: boolean }>(`/radiology/modalities/${id}`, {
      method: "DELETE",
    }),

  listRadiologyAppointments: (params?: { modality_id?: string; date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.modality_id) sp.set("modality_id", params.modality_id);
    if (params?.date) sp.set("date", params.date);
    const qs = sp.toString();
    return request<Record<string, unknown>[]>(`/radiology/appointments${qs ? `?${qs}` : ""}`);
  },
  createRadiologyAppointment: (data: CreateRadiologyAppointmentRequest) =>
    request<Record<string, unknown>>("/radiology/appointments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getRadiologyTat: () =>
    request<RadiologyTatRow[]>("/radiology/analytics/tat"),

  // ── Pharmacy ──────────────────────────────────────────

  listPharmacyOrders: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyOrderListResponse>(`/pharmacy/orders${qs}`);
  },
  createPharmacyOrder: (data: CreatePharmacyOrderRequest) =>
    request<PharmacyOrder>("/pharmacy/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPharmacyOrder: (id: string) =>
    request<PharmacyOrderDetailResponse>(`/pharmacy/orders/${id}`),
  dispenseOrder: (id: string) =>
    request<PharmacyOrder>(`/pharmacy/orders/${id}/dispense`, {
      method: "PUT",
    }),
  cancelPharmacyOrder: (id: string) =>
    request<PharmacyOrder>(`/pharmacy/orders/${id}/cancel`, {
      method: "PUT",
    }),
  listPharmacyCatalog: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyCatalog[]>(`/pharmacy/catalog${qs}`);
  },
  createPharmacyCatalog: (data: CreatePharmacyCatalogRequest) =>
    request<PharmacyCatalog>("/pharmacy/catalog", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePharmacyCatalog: (id: string, data: UpdatePharmacyCatalogRequest) =>
    request<PharmacyCatalog>(`/pharmacy/catalog/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listStock: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyCatalog[]>(`/pharmacy/stock${qs}`);
  },
  createStockTransaction: (data: CreateStockTransactionRequest) =>
    request<PharmacyStockTransaction>("/pharmacy/stock/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Pharmacy Phase 2
  validatePharmacyOrder: (id: string) =>
    request<PharmacyValidationResult>(`/pharmacy/orders/${id}/validate`, {
      method: "POST",
    }),
  createOtcSale: (data: CreateOtcSaleRequest) =>
    request<PharmacyOrderDetailResponse>("/pharmacy/otc-sale", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createDischargeMeds: (data: CreateDischargeMedsRequest) =>
    request<PharmacyOrderDetailResponse>("/pharmacy/discharge-dispensing", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listNdpsEntries: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<NdpsListResponse>(`/pharmacy/ndps-register${qs}`);
  },
  createNdpsEntry: (data: CreateNdpsEntryRequest) =>
    request<NdpsRegisterEntry>("/pharmacy/ndps-register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getNdpsBalance: () =>
    request<NdpsReportResponse>("/pharmacy/ndps-register/balance"),
  getNdpsReport: () =>
    request<NdpsReportResponse>("/pharmacy/ndps-register/report"),
  listPharmacyBatches: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyBatch[]>(`/pharmacy/batches${qs}`);
  },
  createPharmacyBatch: (data: CreatePharmacyBatchRequest) =>
    request<PharmacyBatch>("/pharmacy/batches", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getNearExpiryReport: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<NearExpiryRow[]>(`/pharmacy/batches/near-expiry${qs}`);
  },
  getPharmacyDeadStock: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyDeadStockRow[]>(`/pharmacy/batches/dead-stock${qs}`);
  },
  listPharmacyStoreAssignments: () =>
    request<PharmacyStoreAssignment[]>("/pharmacy/store-assignments"),
  createPharmacyStoreAssignment: (data: CreateStoreAssignmentRequest) =>
    request<PharmacyStoreAssignment>("/pharmacy/store-assignments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPharmacyTransfers: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyTransferRequest[]>(`/pharmacy/transfers${qs}`);
  },
  createPharmacyTransfer: (data: CreatePharmacyTransferRequest) =>
    request<PharmacyTransferRequest>("/pharmacy/transfers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approvePharmacyTransfer: (id: string) =>
    request<PharmacyTransferRequest>(`/pharmacy/transfers/${id}/approve`, {
      method: "PUT",
    }),
  listPharmacyReturns: () =>
    request<PharmacyReturn[]>("/pharmacy/returns"),
  createPharmacyReturn: (data: CreatePharmacyReturnRequest) =>
    request<PharmacyReturn>("/pharmacy/returns", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  processPharmacyReturn: (id: string, data: ProcessPharmacyReturnRequest) =>
    request<PharmacyReturn>(`/pharmacy/returns/${id}/process`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getPharmacyConsumption: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyConsumptionRow[]>(`/pharmacy/analytics/consumption${qs}`);
  },
  getPharmacyAbcVed: () =>
    request<PharmacyAbcVedRow[]>("/pharmacy/analytics/abc-ved"),
  getDrugUtilization: () =>
    request<DrugUtilizationRow[]>("/pharmacy/analytics/utilization"),

  // ── IPD ───────────────────────────────────────────────

  listAdmissions: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<AdmissionListResponse>(`/ipd/admissions${qs}`);
  },
  createAdmission: (data: CreateAdmissionRequest) =>
    request<CreateAdmissionResponse>("/ipd/admissions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getAdmission: (id: string) =>
    request<AdmissionDetailResponse>(`/ipd/admissions/${id}`),
  updateAdmission: (id: string, data: UpdateAdmissionRequest) =>
    request<Admission>(`/ipd/admissions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  transferBed: (id: string, data: TransferBedRequest) =>
    request<Admission>(`/ipd/admissions/${id}/transfer`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  dischargePatient: (id: string, data: DischargeRequest) =>
    request<Admission>(`/ipd/admissions/${id}/discharge`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listNursingTasks: (admissionId: string) =>
    request<NursingTask[]>(`/ipd/admissions/${admissionId}/tasks`),
  createNursingTask: (admissionId: string, data: CreateNursingTaskRequest) =>
    request<NursingTask>(`/ipd/admissions/${admissionId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNursingTask: (
    admissionId: string,
    taskId: string,
    data: UpdateNursingTaskRequest,
  ) =>
    request<NursingTask>(`/ipd/admissions/${admissionId}/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── IPD Clinical Expansion ────────────────────────────────

  // Progress Notes
  listProgressNotes: (admissionId: string) =>
    request<IpdProgressNote[]>(`/ipd/admissions/${admissionId}/progress-notes`),
  createProgressNote: (admissionId: string, data: CreateProgressNoteRequest) =>
    request<IpdProgressNote>(`/ipd/admissions/${admissionId}/progress-notes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateProgressNote: (admissionId: string, noteId: string, data: UpdateProgressNoteRequest) =>
    request<IpdProgressNote>(`/ipd/admissions/${admissionId}/progress-notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Clinical Assessments
  listAssessments: (admissionId: string) =>
    request<IpdClinicalAssessment[]>(`/ipd/admissions/${admissionId}/assessments`),
  createAssessment: (admissionId: string, data: CreateAssessmentRequest) =>
    request<IpdClinicalAssessment>(`/ipd/admissions/${admissionId}/assessments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // MAR (Medication Administration Record)
  listMar: (admissionId: string) =>
    request<IpdMedicationAdministration[]>(`/ipd/admissions/${admissionId}/mar`),
  createMar: (admissionId: string, data: CreateMarRequest) =>
    request<IpdMedicationAdministration>(`/ipd/admissions/${admissionId}/mar`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMar: (admissionId: string, marId: string, data: UpdateMarRequest) =>
    request<IpdMedicationAdministration>(`/ipd/admissions/${admissionId}/mar/${marId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // I/O Chart
  listIntakeOutput: (admissionId: string) =>
    request<IpdIntakeOutput[]>(`/ipd/admissions/${admissionId}/io`),
  createIntakeOutput: (admissionId: string, data: CreateIntakeOutputRequest) =>
    request<IpdIntakeOutput>(`/ipd/admissions/${admissionId}/io`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getIoBalance: (admissionId: string) =>
    request<IoBalanceResponse>(`/ipd/admissions/${admissionId}/io/balance`),

  // Nursing Assessment
  listNursingAssessments: (admissionId: string) =>
    request<IpdNursingAssessment[]>(`/ipd/admissions/${admissionId}/nursing-assessments`),
  createNursingAssessment: (admissionId: string, data: CreateNursingAssessmentRequest) =>
    request<IpdNursingAssessment>(`/ipd/admissions/${admissionId}/nursing-assessments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNursingAssessment: (admissionId: string, assessId: string, data: CreateNursingAssessmentRequest) =>
    request<IpdNursingAssessment>(`/ipd/admissions/${admissionId}/nursing-assessments/${assessId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Care Plans
  listCarePlans: (admissionId: string) =>
    request<IpdCarePlan[]>(`/ipd/admissions/${admissionId}/care-plans`),
  createCarePlan: (admissionId: string, data: CreateCarePlanRequest) =>
    request<IpdCarePlan>(`/ipd/admissions/${admissionId}/care-plans`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCarePlan: (admissionId: string, planId: string, data: UpdateCarePlanRequest) =>
    request<IpdCarePlan>(`/ipd/admissions/${admissionId}/care-plans/${planId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Handover Reports
  listHandovers: (admissionId: string) =>
    request<IpdHandoverReport[]>(`/ipd/admissions/${admissionId}/handovers`),
  createHandover: (admissionId: string, data: CreateHandoverRequest) =>
    request<IpdHandoverReport>(`/ipd/admissions/${admissionId}/handovers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  acknowledgeHandover: (admissionId: string, handoverId: string) =>
    request<IpdHandoverReport>(`/ipd/admissions/${admissionId}/handovers/${handoverId}/acknowledge`, {
      method: "PUT",
    }),

  // Discharge Checklist
  listDischargeChecklist: (admissionId: string) =>
    request<IpdDischargeChecklist[]>(`/ipd/admissions/${admissionId}/discharge-checklist`),
  initDischargeChecklist: (admissionId: string) =>
    request<IpdDischargeChecklist[]>(`/ipd/admissions/${admissionId}/discharge-checklist`, {
      method: "POST",
    }),
  updateDischargeChecklistItem: (admissionId: string, itemId: string, data: UpdateDischargeChecklistRequest) =>
    request<IpdDischargeChecklist>(`/ipd/admissions/${admissionId}/discharge-checklist/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── IPD Phase 2 — Wards ──────────────────────────────────

  listWards: () => request<WardListRow[]>("/ipd/wards"),
  getWard: (id: string) => request<Ward>(`/ipd/wards/${id}`),
  createWard: (data: CreateWardRequest) =>
    request<Ward>("/ipd/wards", { method: "POST", body: JSON.stringify(data) }),
  updateWard: (id: string, data: UpdateWardRequest) =>
    request<Ward>(`/ipd/wards/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  listWardBeds: (wardId: string) =>
    request<WardBedRow[]>(`/ipd/wards/${wardId}/beds`),
  assignBedToWard: (wardId: string, data: AssignBedToWardRequest) =>
    request<WardBedMapping>(`/ipd/wards/${wardId}/beds`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeBedFromWard: (wardId: string, mappingId: string) =>
    request<{ message: string }>(`/ipd/wards/${wardId}/beds/${mappingId}`, {
      method: "DELETE",
    }),

  // IPD Phase 2 — Bed Dashboard
  bedDashboardSummary: () =>
    request<BedDashboardSummary[]>("/ipd/bed-dashboard"),
  bedDashboardBeds: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<BedDashboardRow[]>(`/ipd/bed-dashboard/beds${qs}`);
  },
  updateBedStatus: (bedId: string, data: UpdateBedStatusRequest) =>
    request<{ message: string }>(`/ipd/bed-dashboard/beds/${bedId}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // IPD Phase 2 — Attenders
  listAttenders: (admissionId: string) =>
    request<AdmissionAttender[]>(`/ipd/admissions/${admissionId}/attenders`),
  createAttender: (admissionId: string, data: CreateAttenderRequest) =>
    request<AdmissionAttender>(`/ipd/admissions/${admissionId}/attenders`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteAttender: (admissionId: string, attenderId: string) =>
    request<{ message: string }>(`/ipd/admissions/${admissionId}/attenders/${attenderId}`, {
      method: "DELETE",
    }),

  // IPD Phase 2 — Discharge Summary
  listDischargeTemplates: () =>
    request<DischargeSummaryTemplate[]>("/ipd/discharge-templates"),
  createDischargeTemplate: (data: CreateDischargeTemplateRequest) =>
    request<DischargeSummaryTemplate>("/ipd/discharge-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getDischargeSummary: (admissionId: string) =>
    request<IpdDischargeSummary>(`/ipd/admissions/${admissionId}/discharge-summary`),
  createDischargeSummary: (admissionId: string, data: CreateDischargeSummaryRequest) =>
    request<IpdDischargeSummary>(`/ipd/admissions/${admissionId}/discharge-summary`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDischargeSummary: (admissionId: string, data: UpdateDischargeSummaryRequest) =>
    request<IpdDischargeSummary>(`/ipd/admissions/${admissionId}/discharge-summary`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  finalizeDischargeSummary: (admissionId: string) =>
    request<IpdDischargeSummary>(`/ipd/admissions/${admissionId}/discharge-summary/finalize`, {
      method: "POST",
    }),

  // IPD Phase 2 — Reports
  reportCensus: () => request<CensusWardRow[]>("/ipd/reports/census"),
  reportOccupancy: (params: Record<string, string>) => {
    const qs = `?${new URLSearchParams(params)}`;
    return request<OccupancyRow[]>(`/ipd/reports/occupancy${qs}`);
  },
  reportAlos: (params: Record<string, string>) => {
    const qs = `?${new URLSearchParams(params)}`;
    return request<AlosRow[]>(`/ipd/reports/alos${qs}`);
  },
  reportDischargeStats: (params: Record<string, string>) => {
    const qs = `?${new URLSearchParams(params)}`;
    return request<DischargeStatRow[]>(`/ipd/reports/discharge-stats${qs}`);
  },

  // ── Operation Theatre (OT) ────────────────────────────────

  // OT Rooms
  listOtRooms: () => request<OtRoom[]>("/ot/rooms"),
  createOtRoom: (data: CreateOtRoomRequest) =>
    request<OtRoom>("/ot/rooms", { method: "POST", body: JSON.stringify(data) }),
  updateOtRoom: (id: string, data: UpdateOtRoomRequest) =>
    request<OtRoom>(`/ot/rooms/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // OT Bookings
  listOtBookings: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<OtBookingListResponse>(`/ot/bookings${qs}`);
  },
  getOtBooking: (id: string) => request<OtBooking>(`/ot/bookings/${id}`),
  createOtBooking: (data: CreateOtBookingRequest) =>
    request<OtBooking>("/ot/bookings", { method: "POST", body: JSON.stringify(data) }),
  updateOtBooking: (id: string, data: UpdateOtBookingRequest) =>
    request<OtBooking>(`/ot/bookings/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateOtBookingStatus: (id: string, data: UpdateOtBookingStatusRequest) =>
    request<OtBooking>(`/ot/bookings/${id}/status`, { method: "PUT", body: JSON.stringify(data) }),
  cancelOtBooking: (id: string, data: { cancellation_reason?: string }) =>
    request<OtBooking>(`/ot/bookings/${id}/status`, { method: "PUT", body: JSON.stringify(data) }),

  // OT Pre-op
  listPreopAssessments: (bookingId: string) =>
    request<OtPreopAssessment[]>(`/ot/bookings/${bookingId}/preop`),
  createPreopAssessment: (bookingId: string, data: CreatePreopAssessmentRequest) =>
    request<OtPreopAssessment>(`/ot/bookings/${bookingId}/preop`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePreopAssessment: (bookingId: string, data: UpdatePreopAssessmentRequest) =>
    request<OtPreopAssessment>(`/ot/bookings/${bookingId}/preop`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // OT Safety Checklist
  listSafetyChecklists: (bookingId: string) =>
    request<OtSurgicalSafetyChecklist[]>(`/ot/bookings/${bookingId}/checklists`),
  createSafetyChecklist: (bookingId: string, data: CreateSafetyChecklistRequest) =>
    request<OtSurgicalSafetyChecklist>(`/ot/bookings/${bookingId}/checklists`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSafetyChecklist: (bookingId: string, id: string, data: UpdateSafetyChecklistRequest) =>
    request<OtSurgicalSafetyChecklist>(`/ot/bookings/${bookingId}/checklists/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // OT Case Record
  getCaseRecord: (bookingId: string) =>
    request<OtCaseRecord>(`/ot/bookings/${bookingId}/case-record`),
  createCaseRecord: (bookingId: string, data: CreateCaseRecordRequest) =>
    request<OtCaseRecord>(`/ot/bookings/${bookingId}/case-record`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCaseRecord: (bookingId: string, data: UpdateCaseRecordRequest) =>
    request<OtCaseRecord>(`/ot/bookings/${bookingId}/case-record`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // OT Anesthesia
  getAnesthesiaRecord: (bookingId: string) =>
    request<OtAnesthesiaRecord>(`/ot/bookings/${bookingId}/anesthesia`),
  createAnesthesiaRecord: (bookingId: string, data: CreateAnesthesiaRecordRequest) =>
    request<OtAnesthesiaRecord>(`/ot/bookings/${bookingId}/anesthesia`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAnesthesiaRecord: (bookingId: string, data: UpdateAnesthesiaRecordRequest) =>
    request<OtAnesthesiaRecord>(`/ot/bookings/${bookingId}/anesthesia`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // OT Post-op
  getPostopRecord: (bookingId: string) =>
    request<OtPostopRecord>(`/ot/bookings/${bookingId}/postop`),
  createPostopRecord: (bookingId: string, data: CreatePostopRecordRequest) =>
    request<OtPostopRecord>(`/ot/bookings/${bookingId}/postop`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePostopRecord: (bookingId: string, data: UpdatePostopRecordRequest) =>
    request<OtPostopRecord>(`/ot/bookings/${bookingId}/postop`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // OT Surgeon Preferences
  listSurgeonPreferences: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<OtSurgeonPreference[]>(`/ot/surgeon-preferences${qs}`);
  },
  createSurgeonPreference: (data: CreateSurgeonPreferenceRequest) =>
    request<OtSurgeonPreference>("/ot/surgeon-preferences", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSurgeonPreference: (id: string, data: UpdateSurgeonPreferenceRequest) =>
    request<OtSurgeonPreference>(`/ot/surgeon-preferences/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSurgeonPreference: (id: string) =>
    request<void>(`/ot/surgeon-preferences/${id}`, { method: "DELETE" }),

  // OT Schedule
  getOtSchedule: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<OtBooking[]>(`/ot/schedule${qs}`);
  },

  // ── Blood Bank ──────────────────────────────────────────

  listBloodDonors: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<DonorListResponse>(`/blood-bank/donors${qs}`);
  },
  createBloodDonor: (data: CreateDonorRequest) =>
    request<BloodDonor>("/blood-bank/donors", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getBloodDonor: (id: string) =>
    request<BloodDonor>(`/blood-bank/donors/${id}`),
  listDonations: (donorId: string) =>
    request<BloodDonation[]>(`/blood-bank/donors/${donorId}/donations`),
  createDonation: (donorId: string, data: CreateDonationRequest) =>
    request<BloodDonation>(`/blood-bank/donors/${donorId}/donations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDonation: (donationId: string, data: UpdateDonationRequest) =>
    request<BloodDonation>(`/blood-bank/donations/${donationId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listBloodComponents: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<BloodComponent[]>(`/blood-bank/components${qs}`);
  },
  createBloodComponent: (data: CreateComponentRequest) =>
    request<BloodComponent>("/blood-bank/components", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateComponentStatus: (id: string, data: UpdateComponentStatusRequest) =>
    request<BloodComponent>(`/blood-bank/components/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCrossmatchRequests: () =>
    request<CrossmatchRequest[]>("/blood-bank/crossmatch"),
  createCrossmatchRequest: (data: CreateCrossmatchRequestBody) =>
    request<CrossmatchRequest>("/blood-bank/crossmatch", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCrossmatchRequest: (id: string, data: UpdateCrossmatchRequestBody) =>
    request<CrossmatchRequest>(`/blood-bank/crossmatch/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listTransfusions: () =>
    request<TransfusionRecord[]>("/blood-bank/transfusions"),
  createTransfusion: (data: CreateTransfusionRequest) =>
    request<TransfusionRecord>("/blood-bank/transfusions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  recordTransfusionReaction: (id: string, data: RecordReactionRequest) =>
    request<TransfusionRecord>(`/blood-bank/transfusions/${id}/reaction`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getTtiReport: () =>
    request<TtiReport>("/blood-bank/tti-report"),
  getHemovigilanceReport: () =>
    request<HemovigilanceReport>("/blood-bank/hemovigilance"),

  // ── Blood Bank Phase 2 ──────────────────────────────────

  listBbCampaigns: (params?: { status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<BbRecruitmentCampaignRow[]>(`/blood-bank/recruitment${qs ? `?${qs}` : ""}`);
  },
  createBbCampaign: (data: CreateBbCampaignRequest) =>
    request<BbRecruitmentCampaignRow>("/blood-bank/recruitment", { method: "POST", body: JSON.stringify(data) }),
  updateBbCampaign: (id: string, data: UpdateBbCampaignRequest) =>
    request<BbRecruitmentCampaignRow>(`/blood-bank/recruitment/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  listBbDevices: () =>
    request<BbColdChainDeviceRow[]>("/blood-bank/cold-chain/devices"),
  createBbDevice: (data: CreateBbDeviceRequest) =>
    request<BbColdChainDeviceRow>("/blood-bank/cold-chain/devices", { method: "POST", body: JSON.stringify(data) }),
  addBbReading: (data: AddBbReadingRequest) =>
    request<BbColdChainReadingRow>("/blood-bank/cold-chain/readings", { method: "POST", body: JSON.stringify(data) }),
  listBbReadings: (deviceId: string) =>
    request<BbColdChainReadingRow[]>(`/blood-bank/cold-chain/readings?device_id=${deviceId}`),

  createBbReturn: (data: CreateBbReturnRequest) =>
    request<BbBloodReturnRow>("/blood-bank/returns", { method: "POST", body: JSON.stringify(data) }),
  inspectBbReturn: (id: string, data: InspectBbReturnRequest) =>
    request<BbBloodReturnRow>(`/blood-bank/returns/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  listBbMsbos: () =>
    request<BbMsbosGuidelineRow[]>("/blood-bank/msbos"),
  createBbMsbos: (data: CreateBbMsbosRequest) =>
    request<BbMsbosGuidelineRow>("/blood-bank/msbos", { method: "POST", body: JSON.stringify(data) }),

  listBbLookback: () =>
    request<BbLookbackEventRow[]>("/blood-bank/lookback"),
  createBbLookback: (data: CreateBbLookbackRequest) =>
    request<BbLookbackEventRow>("/blood-bank/lookback", { method: "POST", body: JSON.stringify(data) }),
  updateBbLookback: (id: string, data: UpdateBbLookbackRequest) =>
    request<BbLookbackEventRow>(`/blood-bank/lookback/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  listBbBilling: (params?: { status?: string; patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<BbBillingItemRow[]>(`/blood-bank/billing${qs ? `?${qs}` : ""}`);
  },
  createBbBilling: (data: CreateBbBillingRequest) =>
    request<BbBillingItemRow>("/blood-bank/billing", { method: "POST", body: JSON.stringify(data) }),

  getBbSbtcReport: () =>
    request<BbSbtcReport>("/blood-bank/sbtc-report"),

  // ── ICU / Critical Care ────────────────────────────────

  listIcuFlowsheets: (admissionId: string) =>
    request<IcuFlowsheet[]>(`/icu/admissions/${admissionId}/flowsheets`),
  createIcuFlowsheet: (admissionId: string, data: CreateIcuFlowsheetRequest) =>
    request<IcuFlowsheet>(`/icu/admissions/${admissionId}/flowsheets`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listIcuVentilatorRecords: (admissionId: string) =>
    request<IcuVentilatorRecord[]>(`/icu/admissions/${admissionId}/ventilator`),
  createIcuVentilatorRecord: (admissionId: string, data: CreateIcuVentilatorRequest) =>
    request<IcuVentilatorRecord>(`/icu/admissions/${admissionId}/ventilator`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listIcuScores: (admissionId: string) =>
    request<IcuScore[]>(`/icu/admissions/${admissionId}/scores`),
  createIcuScore: (admissionId: string, data: CreateIcuScoreRequest) =>
    request<IcuScore>(`/icu/admissions/${admissionId}/scores`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listIcuDevices: (admissionId: string) =>
    request<IcuDevice[]>(`/icu/admissions/${admissionId}/devices`),
  createIcuDevice: (admissionId: string, data: CreateIcuDeviceRequest) =>
    request<IcuDevice>(`/icu/admissions/${admissionId}/devices`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeIcuDevice: (admissionId: string, deviceId: string) =>
    request<IcuDevice>(`/icu/admissions/${admissionId}/devices/${deviceId}`, {
      method: "PUT",
    }),
  listIcuBundleChecks: (admissionId: string, deviceId: string) =>
    request<IcuBundleCheck[]>(`/icu/admissions/${admissionId}/devices/${deviceId}/bundle-checks`),
  createIcuBundleCheck: (admissionId: string, deviceId: string, data: CreateIcuBundleCheckRequest) =>
    request<IcuBundleCheck>(`/icu/admissions/${admissionId}/devices/${deviceId}/bundle-checks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listIcuNutrition: (admissionId: string) =>
    request<IcuNutrition[]>(`/icu/admissions/${admissionId}/nutrition`),
  createIcuNutrition: (admissionId: string, data: CreateIcuNutritionRequest) =>
    request<IcuNutrition>(`/icu/admissions/${admissionId}/nutrition`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listIcuNeonatalRecords: (admissionId: string) =>
    request<IcuNeonatalRecord[]>(`/icu/admissions/${admissionId}/neonatal`),
  createIcuNeonatalRecord: (admissionId: string, data: CreateIcuNeonatalRequest) =>
    request<IcuNeonatalRecord>(`/icu/admissions/${admissionId}/neonatal`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getIcuLosAnalytics: () =>
    request<IcuLosAnalytics>("/icu/analytics/los"),
  getIcuDeviceInfectionRates: () =>
    request<DeviceInfectionRate[]>("/icu/analytics/device-infections"),

  // ── Ambulance Fleet Management ─────────────────────────

  listAmbulances: (params?: { status?: string; ambulance_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.ambulance_type) sp.set("ambulance_type", params.ambulance_type);
    const qs = sp.toString();
    return request<AmbulanceRow[]>(`/ambulance/fleet${qs ? `?${qs}` : ""}`);
  },
  getAmbulance: (id: string) => request<AmbulanceRow>(`/ambulance/fleet/${id}`),
  createAmbulance: (data: CreateAmbulanceRequest) =>
    request<AmbulanceRow>("/ambulance/fleet", { method: "POST", body: JSON.stringify(data) }),
  updateAmbulance: (id: string, data: UpdateAmbulanceRequest) =>
    request<AmbulanceRow>(`/ambulance/fleet/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateAmbulanceLocation: (id: string, data: UpdateAmbulanceLocationRequest) =>
    request<AmbulanceRow>(`/ambulance/fleet/${id}/location`, { method: "PUT", body: JSON.stringify(data) }),

  listAmbulanceDrivers: (params?: { is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<AmbulanceDriverRow[]>(`/ambulance/drivers${qs ? `?${qs}` : ""}`);
  },
  createAmbulanceDriver: (data: CreateAmbulanceDriverRequest) =>
    request<AmbulanceDriverRow>("/ambulance/drivers", { method: "POST", body: JSON.stringify(data) }),
  updateAmbulanceDriver: (id: string, data: UpdateAmbulanceDriverRequest) =>
    request<AmbulanceDriverRow>(`/ambulance/drivers/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  listAmbulanceTrips: (params?: { status?: string; trip_type?: string; ambulance_id?: string; priority?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.trip_type) sp.set("trip_type", params.trip_type);
    if (params?.ambulance_id) sp.set("ambulance_id", params.ambulance_id);
    if (params?.priority) sp.set("priority", params.priority);
    const qs = sp.toString();
    return request<AmbulanceTripRow[]>(`/ambulance/trips${qs ? `?${qs}` : ""}`);
  },
  getAmbulanceTrip: (id: string) => request<AmbulanceTripRow>(`/ambulance/trips/${id}`),
  createAmbulanceTrip: (data: CreateAmbulanceTripRequest) =>
    request<AmbulanceTripRow>("/ambulance/trips", { method: "POST", body: JSON.stringify(data) }),
  updateAmbulanceTrip: (id: string, data: UpdateAmbulanceTripRequest) =>
    request<AmbulanceTripRow>(`/ambulance/trips/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateAmbulanceTripStatus: (id: string, data: UpdateAmbulanceTripStatusRequest) =>
    request<AmbulanceTripRow>(`/ambulance/trips/${id}/status`, { method: "PUT", body: JSON.stringify(data) }),
  listAmbulanceTripLogs: (tripId: string) =>
    request<AmbulanceTripLogRow[]>(`/ambulance/trips/${tripId}/logs`),
  addAmbulanceTripLog: (tripId: string, data: AddAmbulanceTripLogRequest) =>
    request<AmbulanceTripLogRow>(`/ambulance/trips/${tripId}/logs`, { method: "POST", body: JSON.stringify(data) }),

  listAmbulanceMaintenance: (params?: { ambulance_id?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.ambulance_id) sp.set("ambulance_id", params.ambulance_id);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<AmbulanceMaintenanceRow[]>(`/ambulance/maintenance${qs ? `?${qs}` : ""}`);
  },
  createAmbulanceMaintenance: (data: CreateAmbulanceMaintenanceRequest) =>
    request<AmbulanceMaintenanceRow>("/ambulance/maintenance", { method: "POST", body: JSON.stringify(data) }),
  updateAmbulanceMaintenance: (id: string, data: UpdateAmbulanceMaintenanceRequest) =>
    request<AmbulanceMaintenanceRow>(`/ambulance/maintenance/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // ── Communication Hub ──────────────────────────────────

  listCommTemplates: (params?: { channel?: string; template_type?: string; is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.channel) sp.set("channel", params.channel);
    if (params?.template_type) sp.set("template_type", params.template_type);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<CommTemplateRow[]>(`/communications/templates${qs ? `?${qs}` : ""}`);
  },
  createCommTemplate: (data: CreateCommTemplateRequest) =>
    request<CommTemplateRow>("/communications/templates", { method: "POST", body: JSON.stringify(data) }),
  updateCommTemplate: (id: string, data: UpdateCommTemplateRequest) =>
    request<CommTemplateRow>(`/communications/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  listCommMessages: (params?: { channel?: string; status?: string; recipient_type?: string; context_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.channel) sp.set("channel", params.channel);
    if (params?.status) sp.set("status", params.status);
    if (params?.recipient_type) sp.set("recipient_type", params.recipient_type);
    if (params?.context_type) sp.set("context_type", params.context_type);
    const qs = sp.toString();
    return request<CommMessageRow[]>(`/communications/messages${qs ? `?${qs}` : ""}`);
  },
  getCommMessage: (id: string) => request<CommMessageRow>(`/communications/messages/${id}`),
  createCommMessage: (data: CreateCommMessageRequest) =>
    request<CommMessageRow>("/communications/messages", { method: "POST", body: JSON.stringify(data) }),
  updateCommMessageStatus: (id: string, data: UpdateCommMessageStatusRequest) =>
    request<CommMessageRow>(`/communications/messages/${id}/status`, { method: "PUT", body: JSON.stringify(data) }),

  listClinicalMessages: (params?: { sender_id?: string; recipient_id?: string; patient_id?: string; priority?: string; message_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.sender_id) sp.set("sender_id", params.sender_id);
    if (params?.recipient_id) sp.set("recipient_id", params.recipient_id);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.priority) sp.set("priority", params.priority);
    if (params?.message_type) sp.set("message_type", params.message_type);
    const qs = sp.toString();
    return request<CommClinicalMessageRow[]>(`/communications/clinical${qs ? `?${qs}` : ""}`);
  },
  getClinicalMessage: (id: string) => request<CommClinicalMessageRow>(`/communications/clinical/${id}`),
  createClinicalMessage: (data: CreateCommClinicalRequest) =>
    request<CommClinicalMessageRow>("/communications/clinical", { method: "POST", body: JSON.stringify(data) }),
  acknowledgeClinicalMessage: (id: string) =>
    request<CommClinicalMessageRow>(`/communications/clinical/${id}/acknowledge`, { method: "PUT", body: "{}" }),

  listCommAlerts: (params?: { status?: string; priority?: string; alert_source?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.priority) sp.set("priority", params.priority);
    if (params?.alert_source) sp.set("alert_source", params.alert_source);
    const qs = sp.toString();
    return request<CommCriticalAlertRow[]>(`/communications/alerts${qs ? `?${qs}` : ""}`);
  },
  createCommAlert: (data: CreateCommAlertRequest) =>
    request<CommCriticalAlertRow>("/communications/alerts", { method: "POST", body: JSON.stringify(data) }),
  acknowledgeCommAlert: (id: string) =>
    request<CommCriticalAlertRow>(`/communications/alerts/${id}/acknowledge`, { method: "PUT", body: "{}" }),
  resolveCommAlert: (id: string, data: ResolveCommAlertRequest) =>
    request<CommCriticalAlertRow>(`/communications/alerts/${id}/resolve`, { method: "PUT", body: JSON.stringify(data) }),

  listComplaints: (params?: { status?: string; source?: string; severity?: string; department_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.source) sp.set("source", params.source);
    if (params?.severity) sp.set("severity", params.severity);
    if (params?.department_id) sp.set("department_id", params.department_id);
    const qs = sp.toString();
    return request<CommComplaintRow[]>(`/communications/complaints${qs ? `?${qs}` : ""}`);
  },
  createComplaint: (data: CreateCommComplaintRequest) =>
    request<CommComplaintRow>("/communications/complaints", { method: "POST", body: JSON.stringify(data) }),
  updateComplaint: (id: string, data: UpdateCommComplaintRequest) =>
    request<CommComplaintRow>(`/communications/complaints/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  resolveComplaint: (id: string, data: ResolveCommComplaintRequest) =>
    request<CommComplaintRow>(`/communications/complaints/${id}/resolve`, { method: "PUT", body: JSON.stringify(data) }),

  listCommFeedback: (params?: { feedback_type?: string; department_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.feedback_type) sp.set("feedback_type", params.feedback_type);
    if (params?.department_id) sp.set("department_id", params.department_id);
    const qs = sp.toString();
    return request<CommFeedbackSurveyRow[]>(`/communications/feedback${qs ? `?${qs}` : ""}`);
  },
  createCommFeedback: (data: CreateCommFeedbackRequest) =>
    request<CommFeedbackSurveyRow>("/communications/feedback", { method: "POST", body: JSON.stringify(data) }),
  getCommFeedbackStats: (params?: { feedback_type?: string; department_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.feedback_type) sp.set("feedback_type", params.feedback_type);
    if (params?.department_id) sp.set("department_id", params.department_id);
    const qs = sp.toString();
    return request<FeedbackStatsResponse>(`/communications/feedback/stats${qs ? `?${qs}` : ""}`);
  },

  // ── Camp Management ────────────────────────────────────

  listCamps: (params?: { status?: string; camp_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.camp_type) sp.set("camp_type", params.camp_type);
    const qs = sp.toString();
    return request<Camp[]>(`/camp/camps${qs ? `?${qs}` : ""}`);
  },
  getCamp: (id: string) => request<Camp>(`/camp/camps/${id}`),
  createCamp: (data: CreateCampRequest) =>
    request<Camp>("/camp/camps", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCamp: (id: string, data: UpdateCampRequest) =>
    request<Camp>(`/camp/camps/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  approveCamp: (id: string) =>
    request<Camp>(`/camp/camps/${id}/approve`, { method: "PUT" }),
  activateCamp: (id: string) =>
    request<Camp>(`/camp/camps/${id}/activate`, { method: "PUT" }),
  completeCamp: (id: string) =>
    request<Camp>(`/camp/camps/${id}/complete`, { method: "PUT" }),
  cancelCamp: (id: string, data: CancelCampRequest) =>
    request<Camp>(`/camp/camps/${id}/cancel`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCampTeamMembers: (campId: string) =>
    request<CampTeamMember[]>(`/camp/camps/${campId}/team`),
  addCampTeamMember: (campId: string, data: AddCampTeamMemberRequest) =>
    request<CampTeamMember>(`/camp/camps/${campId}/team`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeCampTeamMember: (campId: string, memberId: string) =>
    request<{ deleted: boolean }>(`/camp/camps/${campId}/team/${memberId}`, {
      method: "DELETE",
    }),
  getCampStats: (campId: string) =>
    request<CampStatsResponse>(`/camp/camps/${campId}/stats`),
  listCampRegistrations: (params: { camp_id: string; status?: string }) => {
    const sp = new URLSearchParams();
    sp.set("camp_id", params.camp_id);
    if (params.status) sp.set("status", params.status);
    return request<CampRegistration[]>(`/camp/registrations?${sp.toString()}`);
  },
  createCampRegistration: (data: CreateCampRegistrationRequest) =>
    request<CampRegistration>("/camp/registrations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCampRegistration: (id: string, data: UpdateCampRegistrationRequest) =>
    request<CampRegistration>(`/camp/registrations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCampScreenings: (params?: { camp_id?: string; registration_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.camp_id) sp.set("camp_id", params.camp_id);
    if (params?.registration_id) sp.set("registration_id", params.registration_id);
    const qs = sp.toString();
    return request<CampScreening[]>(`/camp/screenings${qs ? `?${qs}` : ""}`);
  },
  createCampScreening: (data: CreateCampScreeningRequest) =>
    request<CampScreening>("/camp/screenings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listCampLabSamples: (params?: { camp_id?: string; registration_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.camp_id) sp.set("camp_id", params.camp_id);
    if (params?.registration_id) sp.set("registration_id", params.registration_id);
    const qs = sp.toString();
    return request<CampLabSample[]>(`/camp/lab-samples${qs ? `?${qs}` : ""}`);
  },
  createCampLabSample: (data: CreateCampLabSampleRequest) =>
    request<CampLabSample>("/camp/lab-samples", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  linkCampLabSample: (id: string, data: LinkCampLabSampleRequest) =>
    request<CampLabSample>(`/camp/lab-samples/${id}/link`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCampBilling: (params?: { camp_id?: string; registration_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.camp_id) sp.set("camp_id", params.camp_id);
    if (params?.registration_id) sp.set("registration_id", params.registration_id);
    const qs = sp.toString();
    return request<CampBillingRecord[]>(`/camp/billing${qs ? `?${qs}` : ""}`);
  },
  createCampBilling: (data: CreateCampBillingRequest) =>
    request<CampBillingRecord>("/camp/billing", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listCampFollowups: (params?: { camp_id?: string; registration_id?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.camp_id) sp.set("camp_id", params.camp_id);
    if (params?.registration_id) sp.set("registration_id", params.registration_id);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<CampFollowup[]>(`/camp/followups${qs ? `?${qs}` : ""}`);
  },
  createCampFollowup: (data: CreateCampFollowupRequest) =>
    request<CampFollowup>("/camp/followups", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCampFollowup: (id: string, data: UpdateCampFollowupRequest) =>
    request<CampFollowup>(`/camp/followups/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── Consent Management ─────────────────────────────────

  listConsentTemplates: (params?: { category?: string; is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set("category", params.category);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<ConsentTemplate[]>(`/consent/templates${qs ? `?${qs}` : ""}`);
  },
  getConsentTemplate: (id: string) =>
    request<ConsentTemplate>(`/consent/templates/${id}`),
  createConsentTemplate: (data: CreateConsentTemplateRequest) =>
    request<ConsentTemplate>("/consent/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateConsentTemplate: (id: string, data: UpdateConsentTemplateRequest) =>
    request<ConsentTemplate>(`/consent/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteConsentTemplate: (id: string) =>
    request<{ deleted: boolean }>(`/consent/templates/${id}`, {
      method: "DELETE",
    }),
  listConsentAudit: (params?: {
    patient_id?: string;
    consent_source?: string;
    action?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.consent_source) sp.set("consent_source", params.consent_source);
    if (params?.action) sp.set("action", params.action);
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<ConsentAuditEntry[]>(`/consent/audit${qs ? `?${qs}` : ""}`);
  },
  listPatientConsentAudit: (patientId: string) =>
    request<ConsentAuditEntry[]>(`/consent/audit/patient/${patientId}`),
  verifyConsent: (data: VerifyConsentRequest) =>
    request<VerifyConsentResponse>("/consent/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPatientConsentSummary: (patientId: string) =>
    request<ConsentSummaryItem[]>(`/consent/verify/patient/${patientId}`),
  revokeConsent: (data: RevokeConsentRequest) =>
    request<{ revoked: boolean }>("/consent/revoke", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listConsentSignatures: (params?: {
    consent_source?: string;
    consent_id?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.consent_source) sp.set("consent_source", params.consent_source);
    if (params?.consent_id) sp.set("consent_id", params.consent_id);
    const qs = sp.toString();
    return request<ConsentSignatureMetadata[]>(`/consent/signatures${qs ? `?${qs}` : ""}`);
  },
  getConsentSignature: (id: string) =>
    request<ConsentSignatureMetadata>(`/consent/signatures/${id}`),
  createConsentSignature: (data: CreateConsentSignatureRequest) =>
    request<ConsentSignatureMetadata>("/consent/signatures", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteConsentSignature: (id: string) =>
    request<{ deleted: boolean }>(`/consent/signatures/${id}`, {
      method: "DELETE",
    }),

  // ── CSSD ───────────────────────────────────────────────

  listCssdInstruments: () =>
    request<CssdInstrument[]>("/cssd/instruments"),
  createCssdInstrument: (data: CreateCssdInstrumentRequest) =>
    request<CssdInstrument>("/cssd/instruments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCssdInstrument: (id: string, data: UpdateCssdInstrumentRequest) =>
    request<CssdInstrument>(`/cssd/instruments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCssdSets: () =>
    request<CssdInstrumentSet[]>("/cssd/sets"),
  createCssdSet: (data: CreateCssdSetRequest) =>
    request<CssdInstrumentSet>("/cssd/sets", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getCssdSetItems: (setId: string) =>
    request<CssdSetItem[]>(`/cssd/sets/${setId}/items`),
  listCssdSterilizers: () =>
    request<CssdSterilizer[]>("/cssd/sterilizers"),
  createCssdSterilizer: (data: CreateCssdSterilizerRequest) =>
    request<CssdSterilizer>("/cssd/sterilizers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCssdSterilizer: (id: string, data: UpdateCssdSterilizerRequest) =>
    request<CssdSterilizer>(`/cssd/sterilizers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCssdMaintenanceLogs: (sterilizerId: string) =>
    request<CssdMaintenanceLog[]>(`/cssd/sterilizers/${sterilizerId}/maintenance`),
  createCssdMaintenanceLog: (sterilizerId: string, data: CreateCssdMaintenanceRequest) =>
    request<CssdMaintenanceLog>(`/cssd/sterilizers/${sterilizerId}/maintenance`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listCssdLoads: () =>
    request<CssdSterilizationLoad[]>("/cssd/loads"),
  createCssdLoad: (data: CreateCssdLoadRequest) =>
    request<CssdSterilizationLoad>("/cssd/loads", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCssdLoadStatus: (id: string, data: UpdateCssdLoadStatusRequest) =>
    request<CssdSterilizationLoad>(`/cssd/loads/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  addCssdLoadItem: (loadId: string, data: AddCssdLoadItemRequest) =>
    request<CssdLoadItem>(`/cssd/loads/${loadId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listCssdIndicators: (loadId: string) =>
    request<CssdIndicatorResult[]>(`/cssd/loads/${loadId}/indicators`),
  recordCssdIndicator: (loadId: string, data: RecordCssdIndicatorRequest) =>
    request<CssdIndicatorResult>(`/cssd/loads/${loadId}/indicators`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listCssdIssuances: () =>
    request<CssdIssuance[]>("/cssd/issuances"),
  createCssdIssuance: (data: CreateCssdIssuanceRequest) =>
    request<CssdIssuance>("/cssd/issuances", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  returnCssdIssuance: (id: string) =>
    request<CssdIssuance>(`/cssd/issuances/${id}/return`, {
      method: "PUT",
      body: JSON.stringify({}),
    }),
  recallCssdIssuance: (id: string, reason: string) =>
    request<CssdIssuance>(`/cssd/issuances/${id}/recall`, {
      method: "PUT",
      body: JSON.stringify({ recall_reason: reason }),
    }),

  // ── Diet & Kitchen ────────────────────────────────────

  listDietTemplates: () =>
    request<DietTemplate[]>("/diet/templates"),

  createDietTemplate: (data: CreateDietTemplateRequest) =>
    request<DietTemplate>("/diet/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDietTemplate: (id: string, data: UpdateDietTemplateRequest) =>
    request<DietTemplate>(`/diet/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listDietOrders: () =>
    request<DietOrder[]>("/diet/orders"),

  createDietOrder: (data: CreateDietOrderRequest) =>
    request<DietOrder>("/diet/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDietOrder: (id: string, data: UpdateDietOrderRequest) =>
    request<DietOrder>(`/diet/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listKitchenMenus: () =>
    request<KitchenMenu[]>("/diet/menus"),

  createKitchenMenu: (data: CreateKitchenMenuRequest) =>
    request<KitchenMenu>("/diet/menus", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listKitchenMenuItems: (menuId: string) =>
    request<KitchenMenuItem[]>(`/diet/menus/${menuId}/items`),

  createKitchenMenuItem: (menuId: string, data: CreateMenuItemRequest) =>
    request<KitchenMenuItem>(`/diet/menus/${menuId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listMealPreps: () =>
    request<MealPreparation[]>("/diet/meal-preps"),

  createMealPrep: (data: CreateMealPrepRequest) =>
    request<MealPreparation>("/diet/meal-preps", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMealPrepStatus: (id: string, data: UpdateMealPrepStatusRequest) =>
    request<MealPreparation>(`/diet/meal-preps/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listMealCounts: () =>
    request<MealCount[]>("/diet/meal-counts"),

  createMealCount: (data: CreateMealCountRequest) =>
    request<MealCount>("/diet/meal-counts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listKitchenInventory: () =>
    request<KitchenInventory[]>("/diet/inventory"),

  createKitchenInventoryItem: (data: CreateKitchenInventoryRequest) =>
    request<KitchenInventory>("/diet/inventory", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateKitchenInventoryItem: (id: string, data: UpdateKitchenInventoryRequest) =>
    request<KitchenInventory>(`/diet/inventory/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listKitchenAudits: () =>
    request<KitchenAudit[]>("/diet/audits"),

  createKitchenAudit: (data: CreateKitchenAuditRequest) =>
    request<KitchenAudit>("/diet/audits", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Integration Hub ────────────────────────────────────

  listPipelines: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PipelineListResponse>(`/integration/pipelines${qs}`);
  },
  createPipeline: (data: CreatePipelineRequest) =>
    request<IntegrationPipeline>("/integration/pipelines", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPipeline: (id: string) =>
    request<IntegrationPipeline>(`/integration/pipelines/${id}`),
  updatePipeline: (id: string, data: UpdatePipelineRequest) =>
    request<IntegrationPipeline>(`/integration/pipelines/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePipeline: (id: string) =>
    request<void>(`/integration/pipelines/${id}`, { method: "DELETE" }),
  updatePipelineStatus: (id: string, data: UpdatePipelineStatusRequest) =>
    request<IntegrationPipeline>(`/integration/pipelines/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  triggerPipeline: (id: string, data?: TriggerPipelineRequest) =>
    request<IntegrationExecution>(`/integration/pipelines/${id}/trigger`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  listPipelineExecutions: (
    pipelineId: string,
    params?: Record<string, string>,
  ) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<ExecutionListResponse>(
      `/integration/pipelines/${pipelineId}/executions${qs}`,
    );
  },
  getExecution: (id: string) =>
    request<IntegrationExecution>(`/integration/executions/${id}`),
  listNodeTemplates: () =>
    request<IntegrationNodeTemplate[]>("/integration/node-templates"),
  createNodeTemplate: (data: Record<string, unknown>) =>
    request<IntegrationNodeTemplate>("/integration/node-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Schema Registry ─────────────────────────────────────

  listSchemaModules: () => request<ModuleSummary[]>("/schema/modules"),
  listModuleEntities: (code: string) =>
    request<ModuleEntitySchema[]>(`/schema/modules/${code}/entities`),
  listEventSchemas: () => request<EventSchema[]>("/schema/events"),
  getEventSchema: (eventType: string) =>
    request<EventSchema>(
      `/schema/events/${encodeURIComponent(eventType)}`,
    ),
  getFormFieldSchema: (formCode: string) =>
    request<SchemaField[]>(
      `/schema/form-fields/${encodeURIComponent(formCode)}`,
    ),

  // ── Screens — Admin ──────────────────────────────────────

  adminListScreens: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<ScreenSummary[]>(`/admin/screens${qs}`);
  },
  adminCreateScreen: (data: CreateScreenRequest) =>
    request<{ id: string }>("/admin/screens", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminGetScreen: (id: string) =>
    request<ScreenMaster>(`/admin/screens/${id}`),
  adminUpdateScreen: (id: string, data: UpdateScreenRequest) =>
    request<{ status: string }>(`/admin/screens/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteScreen: (id: string) =>
    request<{ status: string }>(`/admin/screens/${id}`, { method: "DELETE" }),
  adminPublishScreen: (id: string, data?: { change_summary?: string }) =>
    request<{ status: string }>(`/admin/screens/${id}/publish`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  adminNewScreenVersion: (id: string) =>
    request<{ id: string }>(`/admin/screens/${id}/new-version`, {
      method: "POST",
    }),
  adminListScreenVersions: (id: string) =>
    request<ScreenVersionSummary[]>(`/admin/screens/${id}/versions`),
  adminGetScreenVersion: (id: string, ver: number) =>
    request<ScreenVersionSnapshot>(`/admin/screens/${id}/versions/${ver}`),
  adminRestoreScreenVersion: (id: string, ver: number) =>
    request<{ status: string }>(`/admin/screens/${id}/restore/${ver}`, {
      method: "POST",
    }),
  adminListScreenSidecars: (id: string) =>
    request<ScreenSidecar[]>(`/admin/screens/${id}/sidecars`),
  adminCreateScreenSidecar: (id: string, data: CreateSidecarRequest) =>
    request<{ id: string }>(`/admin/screens/${id}/sidecars`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateScreenSidecar: (
    id: string,
    sid: string,
    data: Record<string, unknown>,
  ) =>
    request<{ status: string }>(`/admin/screens/${id}/sidecars/${sid}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteScreenSidecar: (id: string, sid: string) =>
    request<{ status: string }>(`/admin/screens/${id}/sidecars/${sid}`, {
      method: "DELETE",
    }),
  adminListScreenOverrides: () =>
    request<TenantScreenOverride[]>("/admin/screen-overrides"),
  adminUpsertScreenOverride: (
    screenId: string,
    data: ScreenOverrideRequest,
  ) =>
    request<{ status: string }>(`/admin/screen-overrides/${screenId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteScreenOverride: (screenId: string) =>
    request<{ status: string }>(`/admin/screen-overrides/${screenId}`, {
      method: "DELETE",
    }),

  // ── Screens — User-facing ─────────────────────────────────

  resolveScreen: (code: string) =>
    request<ResolvedScreen>(`/screens/${encodeURIComponent(code)}`),
  listModuleScreens: (moduleCode: string) =>
    request<ScreenSummary[]>(
      `/screens/module/${encodeURIComponent(moduleCode)}`,
    ),
  listModuleSidecars: (
    moduleCode: string,
    context?: string,
  ) =>
    request<ResolvedSidecar[]>(
      `/modules/${encodeURIComponent(moduleCode)}/sidecars${context ? `?context=${encodeURIComponent(context)}` : ""}`,
    ),

  // ── Clinical Decision Support ─────────────────────────────

  checkDrugSafety: (data: CheckDrugInteractionsRequest) =>
    request<DrugSafetyCheckResult>("/cds/drug-safety-check", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listDrugInteractions: () =>
    request<DrugInteraction[]>("/cds/drug-interactions"),
  createDrugInteraction: (data: CreateDrugInteractionRequest) =>
    request<DrugInteraction>("/cds/drug-interactions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteDrugInteraction: (id: string) =>
    request<DrugInteraction>(`/cds/drug-interactions/${id}`, {
      method: "DELETE",
    }),
  listCriticalValueRules: () =>
    request<CriticalValueRule[]>("/cds/critical-value-rules"),
  createCriticalValueRule: (data: CreateCriticalValueRuleRequest) =>
    request<CriticalValueRule>("/cds/critical-value-rules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteCriticalValueRule: (id: string) =>
    request<CriticalValueRule>(`/cds/critical-value-rules/${id}`, {
      method: "DELETE",
    }),
  listClinicalProtocols: () =>
    request<ClinicalProtocol[]>("/cds/protocols"),
  createClinicalProtocol: (data: CreateClinicalProtocolRequest) =>
    request<ClinicalProtocol>("/cds/protocols", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteClinicalProtocol: (id: string) =>
    request<ClinicalProtocol>(`/cds/protocols/${id}`, {
      method: "DELETE",
    }),
  listRestrictedDrugApprovals: () =>
    request<RestrictedDrugApproval[]>("/cds/restricted-drug-approvals"),
  createRestrictedDrugApproval: (data: CreateRestrictedDrugApprovalRequest) =>
    request<RestrictedDrugApproval>("/cds/restricted-drug-approvals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRestrictedDrugApproval: (id: string, data: { status: string; denied_reason?: string }) =>
    request<RestrictedDrugApproval>(`/cds/restricted-drug-approvals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listPreAuthRequests: (patientId?: string) =>
    request<PreAuthorizationRequest[]>(
      `/cds/pre-auth-requests${patientId ? `?patient_id=${patientId}` : ""}`,
    ),
  createPreAuthRequest: (data: CreatePreAuthRequest) =>
    request<PreAuthorizationRequest>("/cds/pre-auth-requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePreAuthRequest: (id: string, data: UpdatePreAuthRequest) =>
    request<PreAuthorizationRequest>(`/cds/pre-auth-requests/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listPgLogbook: (params?: { user_id?: string; supervisor_id?: string; pending_verification?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.user_id) searchParams.set("user_id", params.user_id);
    if (params?.supervisor_id) searchParams.set("supervisor_id", params.supervisor_id);
    if (params?.pending_verification) searchParams.set("pending_verification", "true");
    const qs = searchParams.toString();
    return request<PgLogbookEntry[]>(`/cds/pg-logbook${qs ? `?${qs}` : ""}`);
  },
  createPgLogbookEntry: (data: CreatePgLogbookRequest) =>
    request<PgLogbookEntry>("/cds/pg-logbook", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  verifyPgLogbookEntry: (id: string) =>
    request<PgLogbookEntry>(`/cds/pg-logbook/${id}/verify`, {
      method: "PUT",
    }),
  listCoSignatures: () =>
    request<CoSignatureRequest[]>("/cds/co-signatures"),
  createCoSignature: (data: CreateCoSignatureRequest) =>
    request<CoSignatureRequest>("/cds/co-signatures", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCoSignature: (id: string, data: { status: string; denied_reason?: string }) =>
    request<CoSignatureRequest>(`/cds/co-signatures/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── Emergency ─────────────────────────────────────────

  listErVisits: () =>
    request<ErVisit[]>("/emergency/visits"),

  getErVisit: (id: string) =>
    request<ErVisit>(`/emergency/visits/${id}`),

  createErVisit: (data: CreateErVisitRequest) =>
    request<ErVisit>("/emergency/visits", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateErVisit: (id: string, data: UpdateErVisitRequest) =>
    request<ErVisit>(`/emergency/visits/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listTriageAssessments: (visitId: string) =>
    request<ErTriageAssessment[]>(`/emergency/visits/${visitId}/triage`),

  createTriageAssessment: (visitId: string, data: CreateTriageRequest) =>
    request<ErTriageAssessment>(`/emergency/visits/${visitId}/triage`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listResuscitationLogs: (visitId: string) =>
    request<ErResuscitationLog[]>(`/emergency/visits/${visitId}/resuscitation`),

  createResuscitationLog: (visitId: string, data: CreateResuscitationLogRequest) =>
    request<ErResuscitationLog>(`/emergency/visits/${visitId}/resuscitation`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listCodeActivations: () =>
    request<ErCodeActivation[]>("/emergency/codes"),

  createCodeActivation: (data: CreateCodeActivationRequest) =>
    request<ErCodeActivation>("/emergency/codes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deactivateCode: (id: string, data: DeactivateCodeRequest) =>
    request<ErCodeActivation>(`/emergency/codes/${id}/deactivate`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listMlcCases: () =>
    request<MlcCase[]>("/emergency/mlc"),

  createMlcCase: (data: CreateMlcCaseRequest) =>
    request<MlcCase>("/emergency/mlc", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMlcCase: (id: string, data: UpdateMlcCaseRequest) =>
    request<MlcCase>(`/emergency/mlc/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listMlcDocuments: (mlcId: string) =>
    request<MlcDocument[]>(`/emergency/mlc/${mlcId}/documents`),

  createMlcDocument: (mlcId: string, data: CreateMlcDocumentRequest) =>
    request<MlcDocument>(`/emergency/mlc/${mlcId}/documents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listPoliceIntimations: (mlcId: string) =>
    request<MlcPoliceIntimation[]>(`/emergency/mlc/${mlcId}/police-intimations`),

  createPoliceIntimation: (mlcId: string, data: CreatePoliceIntimationRequest) =>
    request<MlcPoliceIntimation>(`/emergency/mlc/${mlcId}/police-intimations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  confirmPoliceReceipt: (id: string) =>
    request<MlcPoliceIntimation>(`/emergency/mlc/police-intimations/${id}/confirm`, {
      method: "PUT",
    }),

  listMassCasualtyEvents: () =>
    request<MassCasualtyEvent[]>("/emergency/mass-casualty"),

  createMassCasualtyEvent: (data: CreateMassCasualtyEventRequest) =>
    request<MassCasualtyEvent>("/emergency/mass-casualty", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMassCasualtyEvent: (id: string, data: UpdateMassCasualtyEventRequest) =>
    request<MassCasualtyEvent>(`/emergency/mass-casualty/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  admitFromEr: (visitId: string, data: AdmitFromErRequest) =>
    request<Record<string, unknown>>(`/emergency/visits/${visitId}/admit`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Procurement ──────────────────────────────────────────

  // Vendors
  listVendors: (params?: Record<string, string>) =>
    request<Vendor[]>(`/procurement/vendors${params ? `?${new URLSearchParams(params)}` : ""}`),

  getVendor: (id: string) =>
    request<Vendor>(`/procurement/vendors/${id}`),

  createVendor: (data: CreateVendorRequest) =>
    request<Vendor>("/procurement/vendors", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateVendor: (id: string, data: UpdateVendorRequest) =>
    request<Vendor>(`/procurement/vendors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Store Locations
  listStoreLocations: () =>
    request<StoreLocation[]>("/procurement/store-locations"),

  createStoreLocation: (data: CreateStoreLocationRequest) =>
    request<StoreLocation>("/procurement/store-locations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateStoreLocation: (id: string, data: UpdateStoreLocationRequest) =>
    request<StoreLocation>(`/procurement/store-locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Purchase Orders
  listPurchaseOrders: (params?: Record<string, string>) =>
    request<PoListResponse>(`/procurement/purchase-orders${params ? `?${new URLSearchParams(params)}` : ""}`),

  getPurchaseOrder: (id: string) =>
    request<PoDetailResponse>(`/procurement/purchase-orders/${id}`),

  createPurchaseOrder: (data: CreatePurchaseOrderRequest) =>
    request<PoDetailResponse>("/procurement/purchase-orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  approvePurchaseOrder: (id: string) =>
    request<PurchaseOrder>(`/procurement/purchase-orders/${id}/approve`, {
      method: "PUT",
    }),

  sendPurchaseOrder: (id: string) =>
    request<PurchaseOrder>(`/procurement/purchase-orders/${id}/send`, {
      method: "PUT",
    }),

  cancelPurchaseOrder: (id: string) =>
    request<PurchaseOrder>(`/procurement/purchase-orders/${id}/cancel`, {
      method: "PUT",
    }),

  // GRN
  listGrns: (params?: Record<string, string>) =>
    request<GrnListResponse>(`/procurement/grns${params ? `?${new URLSearchParams(params)}` : ""}`),

  getGrn: (id: string) =>
    request<GrnDetailResponse>(`/procurement/grns/${id}`),

  createGrn: (data: CreateGrnRequest) =>
    request<GrnDetailResponse>("/procurement/grns", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  completeGrn: (id: string) =>
    request<GoodsReceiptNote>(`/procurement/grns/${id}/complete`, {
      method: "PUT",
    }),

  // Rate Contracts
  listRateContracts: (params?: Record<string, string>) =>
    request<RateContract[]>(`/procurement/rate-contracts${params ? `?${new URLSearchParams(params)}` : ""}`),

  getRateContract: (id: string) =>
    request<RcDetailResponse>(`/procurement/rate-contracts/${id}`),

  createRateContract: (data: CreateRateContractRequest) =>
    request<RcDetailResponse>("/procurement/rate-contracts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Batch Stock
  listBatchStock: (params?: Record<string, string>) =>
    request<BatchStock[]>(`/procurement/batch-stock${params ? `?${new URLSearchParams(params)}` : ""}`),

  // ── Procurement Phase 2 ──
  getVendorPerformance: () =>
    request<VendorPerformanceRow[]>("/procurement/vendor-performance"),
  getVendorComparison: (catalogItemId: string) =>
    request<VendorComparisonRow[]>(`/procurement/vendor-comparison?catalog_item_id=${catalogItemId}`),
  createEmergencyPo: (data: CreateEmergencyPoRequest) =>
    request<PoDetailResponse>("/procurement/emergency-purchase", { method: "POST", body: JSON.stringify(data) }),
  listSupplierPayments: (params?: Record<string, string>) =>
    request<SupplierPayment[]>(`/procurement/supplier-payments${params ? `?${new URLSearchParams(params)}` : ""}`),
  createSupplierPayment: (data: CreateSupplierPaymentRequest) =>
    request<SupplierPayment>("/procurement/supplier-payments", { method: "POST", body: JSON.stringify(data) }),
  updateSupplierPayment: (id: string, data: UpdateSupplierPaymentRequest) =>
    request<SupplierPayment>(`/procurement/supplier-payments/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // ── Quality Management ──
  listQualityIndicators: (params?: { category?: string }) =>
    request<QualityIndicator[]>(`/quality/indicators${params?.category ? `?category=${encodeURIComponent(params.category)}` : ""}`),

  createQualityIndicator: (data: CreateQualityIndicatorRequest) =>
    request<QualityIndicator>("/quality/indicators", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listIndicatorValues: (params?: { indicator_id?: string; period?: string }) => {
    const qs = new URLSearchParams();
    if (params?.indicator_id) qs.set("indicator_id", params.indicator_id);
    if (params?.period) qs.set("period", params.period);
    const q = qs.toString();
    return request<QualityIndicatorValue[]>(`/quality/indicator-values${q ? `?${q}` : ""}`);
  },

  recordIndicatorValue: (data: RecordIndicatorValueRequest) =>
    request<QualityIndicatorValue>("/quality/indicator-values", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listQualityDocuments: (params?: { status?: string; category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.category) qs.set("category", params.category);
    const q = qs.toString();
    return request<QualityDocument[]>(`/quality/documents${q ? `?${q}` : ""}`);
  },

  getQualityDocument: (id: string) =>
    request<QualityDocument>(`/quality/documents/${id}`),

  createQualityDocument: (data: CreateQualityDocumentRequest) =>
    request<QualityDocument>("/quality/documents", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDocumentStatus: (id: string, data: { status: string }) =>
    request<QualityDocument>(`/quality/documents/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  acknowledgeDocument: (id: string) =>
    request<{ acknowledged: boolean }>(`/quality/documents/${id}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  listQualityIncidents: (params?: { status?: string; severity?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.severity) qs.set("severity", params.severity);
    const q = qs.toString();
    return request<QualityIncident[]>(`/quality/incidents${q ? `?${q}` : ""}`);
  },

  getQualityIncident: (id: string) =>
    request<QualityIncident>(`/quality/incidents/${id}`),

  createQualityIncident: (data: CreateQualityIncidentRequest) =>
    request<QualityIncident>("/quality/incidents", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateQualityIncident: (id: string, data: UpdateQualityIncidentRequest) =>
    request<QualityIncident>(`/quality/incidents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listCapa: (params?: { incident_id?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.incident_id) qs.set("incident_id", params.incident_id);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return request<QualityCapa[]>(`/quality/capa${q ? `?${q}` : ""}`);
  },

  createCapa: (data: CreateCapaRequest) =>
    request<QualityCapa>("/quality/capa", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCapa: (id: string, data: { status?: string; effectiveness_check?: string }) =>
    request<QualityCapa>(`/quality/capa/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listQualityCommittees: () =>
    request<QualityCommittee[]>("/quality/committees"),

  createQualityCommittee: (data: CreateQualityCommitteeRequest) =>
    request<QualityCommittee>("/quality/committees", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listCommitteeMeetings: (params?: { committee_id?: string }) =>
    request<QualityCommitteeMeeting[]>(`/quality/meetings${params?.committee_id ? `?committee_id=${encodeURIComponent(params.committee_id)}` : ""}`),

  createCommitteeMeeting: (data: CreateMeetingRequest) =>
    request<QualityCommitteeMeeting>("/quality/meetings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCommitteeMeeting: (id: string, data: Record<string, unknown>) =>
    request<QualityCommitteeMeeting>(`/quality/meetings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listActionItems: (params?: { source_type?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.source_type) qs.set("source_type", params.source_type);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return request<QualityActionItem[]>(`/quality/action-items${q ? `?${q}` : ""}`);
  },

  createActionItem: (data: { source_type: string; source_id: string; description?: string; assigned_to: string; due_date: string }) =>
    request<QualityActionItem>("/quality/action-items", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listAccreditationStandards: (params?: { body?: string }) =>
    request<QualityAccreditationStandard[]>(`/quality/standards${params?.body ? `?body=${encodeURIComponent(params.body)}` : ""}`),

  createAccreditationStandard: (data: CreateAccreditationStandardRequest) =>
    request<QualityAccreditationStandard>("/quality/standards", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listAccreditationCompliance: (params?: { standard_id?: string }) =>
    request<QualityAccreditationCompliance[]>(`/quality/compliance${params?.standard_id ? `?standard_id=${encodeURIComponent(params.standard_id)}` : ""}`),

  updateAccreditationCompliance: (data: UpdateComplianceRequest) =>
    request<QualityAccreditationCompliance>("/quality/compliance", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listQualityAudits: (params?: { status?: string; department_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.department_id) qs.set("department_id", params.department_id);
    const q = qs.toString();
    return request<QualityAudit[]>(`/quality/audits${q ? `?${q}` : ""}`);
  },

  getQualityAudit: (id: string) =>
    request<QualityAudit>(`/quality/audits/${id}`),

  createQualityAudit: (data: CreateQualityAuditRequest) =>
    request<QualityAudit>("/quality/audits", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateQualityAudit: (id: string, data: Record<string, unknown>) =>
    request<QualityAudit>(`/quality/audits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  calculateIndicator: (id: string) =>
    request<Record<string, unknown>>(`/quality/indicators/${id}/calculate`, {
      method: "POST",
    }),
  listPendingAcks: (documentId: string) =>
    request<PendingAckUser[]>(`/quality/documents/${documentId}/pending-acks`),
  autoScheduleMeetings: (committeeId: string, data: AutoScheduleRequest) =>
    request<Record<string, unknown>>(`/quality/committees/${committeeId}/auto-schedule`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  compileEvidence: (body: string) =>
    request<EvidenceCompilation>(`/quality/accreditation/${body}/evidence`),

  // ── Infection Control - Surveillance ──────────────────
  listSurveillanceEvents: (params?: { hai_type?: string; infection_status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.hai_type) qs.set("hai_type", params.hai_type);
    if (params?.infection_status) qs.set("infection_status", params.infection_status);
    const q = qs.toString();
    return request<InfectionSurveillanceEvent[]>(`/infection-control/surveillance${q ? `?${q}` : ""}`);
  },

  createSurveillanceEvent: (data: CreateSurveillanceEventRequest) =>
    request<InfectionSurveillanceEvent>("/infection-control/surveillance", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listDeviceDays: (params?: { location_id?: string; record_date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.location_id) qs.set("location_id", params.location_id);
    if (params?.record_date) qs.set("record_date", params.record_date);
    const q = qs.toString();
    return request<InfectionDeviceDay[]>(`/infection-control/device-days${q ? `?${q}` : ""}`);
  },

  recordDeviceDays: (data: RecordDeviceDaysRequest) =>
    request<InfectionDeviceDay>("/infection-control/device-days", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Infection Control - Stewardship ───────────────────
  listStewardshipRequests: (params?: { request_status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.request_status) qs.set("request_status", params.request_status);
    const q = qs.toString();
    return request<AntibioticStewardshipRequest[]>(`/infection-control/stewardship${q ? `?${q}` : ""}`);
  },

  createStewardshipRequest: (data: CreateStewardshipRequest) =>
    request<AntibioticStewardshipRequest>("/infection-control/stewardship", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  reviewStewardshipRequest: (id: string, data: ReviewStewardshipRequest) =>
    request<AntibioticStewardshipRequest>(`/infection-control/stewardship/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listConsumptionRecords: (params?: { department_id?: string; record_month?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.record_month) qs.set("record_month", params.record_month);
    const q = qs.toString();
    return request<AntibioticConsumptionRecord[]>(`/infection-control/consumption${q ? `?${q}` : ""}`);
  },

  recordConsumption: (data: Record<string, unknown>) =>
    request<AntibioticConsumptionRecord>("/infection-control/consumption", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Infection Control - Biowaste ──────────────────────
  listBiowasteRecords: (params?: { department_id?: string; waste_category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.waste_category) qs.set("waste_category", params.waste_category);
    const q = qs.toString();
    return request<BiowasteRecord[]>(`/infection-control/biowaste${q ? `?${q}` : ""}`);
  },

  createBiowasteRecord: (data: CreateBiowasteRecordRequest) =>
    request<BiowasteRecord>("/infection-control/biowaste", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listNeedleStickIncidents: (params?: { department_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    const q = qs.toString();
    return request<NeedleStickIncident[]>(`/infection-control/needle-stick${q ? `?${q}` : ""}`);
  },

  createNeedleStickIncident: (data: CreateNeedleStickIncidentRequest) =>
    request<NeedleStickIncident>("/infection-control/needle-stick", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Infection Control - Hygiene ───────────────────────
  listHygieneAudits: (params?: { department_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    const q = qs.toString();
    return request<HandHygieneAudit[]>(`/infection-control/hygiene-audits${q ? `?${q}` : ""}`);
  },

  createHygieneAudit: (data: CreateHygieneAuditRequest) =>
    request<HandHygieneAudit>("/infection-control/hygiene-audits", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listCultureSurveillance: (params?: { department_id?: string; culture_type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.culture_type) qs.set("culture_type", params.culture_type);
    const q = qs.toString();
    return request<CultureSurveillance[]>(`/infection-control/cultures${q ? `?${q}` : ""}`);
  },

  createCultureSurveillance: (data: CreateCultureSurveillanceRequest) =>
    request<CultureSurveillance>("/infection-control/cultures", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Infection Control - Outbreaks ─────────────────────
  listOutbreaks: (params?: { outbreak_status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.outbreak_status) qs.set("outbreak_status", params.outbreak_status);
    const q = qs.toString();
    return request<OutbreakEvent[]>(`/infection-control/outbreaks${q ? `?${q}` : ""}`);
  },

  createOutbreak: (data: CreateOutbreakRequest) =>
    request<OutbreakEvent>("/infection-control/outbreaks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOutbreak: (id: string, data: UpdateOutbreakRequest) =>
    request<OutbreakEvent>(`/infection-control/outbreaks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listOutbreakContacts: (id: string) =>
    request<OutbreakContact[]>(`/infection-control/outbreaks/${id}/contacts`),

  addOutbreakContact: (id: string, data: CreateOutbreakContactRequest) =>
    request<OutbreakContact>(`/infection-control/outbreaks/${id}/contacts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── HR & Staff Management ──────────────────────────────

  // Designations
  listDesignations: () =>
    request<Designation[]>("/hr/designations"),

  createDesignation: (data: CreateDesignationRequest) =>
    request<Designation>("/hr/designations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDesignation: (id: string, data: UpdateDesignationRequest) =>
    request<Designation>(`/hr/designations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Employees
  listEmployees: (params?: { search?: string; department_id?: string; status?: string; employment_type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.status) qs.set("status", params.status);
    if (params?.employment_type) qs.set("employment_type", params.employment_type);
    const q = qs.toString();
    return request<Employee[]>(`/hr/employees${q ? `?${q}` : ""}`);
  },

  getEmployee: (id: string) =>
    request<Employee>(`/hr/employees/${id}`),

  createEmployee: (data: CreateEmployeeRequest) =>
    request<Employee>("/hr/employees", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateEmployee: (id: string, data: UpdateEmployeeRequest) =>
    request<Employee>(`/hr/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Credentials
  listCredentials: (employeeId: string) =>
    request<EmployeeCredential[]>(`/hr/employees/${employeeId}/credentials`),

  createCredential: (employeeId: string, data: CreateCredentialRequest) =>
    request<EmployeeCredential>(`/hr/employees/${employeeId}/credentials`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCredential: (employeeId: string, credentialId: string, data: UpdateCredentialRequest) =>
    request<EmployeeCredential>(`/hr/employees/${employeeId}/credentials/${credentialId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Shifts
  listShifts: () =>
    request<ShiftDefinition[]>("/hr/shifts"),

  createShift: (data: CreateShiftRequest) =>
    request<ShiftDefinition>("/hr/shifts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateShift: (id: string, data: UpdateShiftRequest) =>
    request<ShiftDefinition>(`/hr/shifts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Duty Rosters
  listRosters: (params?: { department_id?: string; date_from?: string; date_to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.date_from) qs.set("date_from", params.date_from);
    if (params?.date_to) qs.set("date_to", params.date_to);
    const q = qs.toString();
    return request<DutyRoster[]>(`/hr/rosters${q ? `?${q}` : ""}`);
  },

  createRoster: (data: CreateRosterRequest) =>
    request<DutyRoster>("/hr/rosters", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  approveSwap: (id: string) =>
    request<DutyRoster>(`/hr/rosters/${id}/approve-swap`, {
      method: "PUT",
    }),

  // Attendance
  listAttendance: (params?: { department_id?: string; date_from?: string; date_to?: string; employee_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.date_from) qs.set("date_from", params.date_from);
    if (params?.date_to) qs.set("date_to", params.date_to);
    if (params?.employee_id) qs.set("employee_id", params.employee_id);
    const q = qs.toString();
    return request<AttendanceRecord[]>(`/hr/attendance${q ? `?${q}` : ""}`);
  },

  createAttendance: (data: CreateAttendanceRequest) =>
    request<AttendanceRecord>("/hr/attendance", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Leave Balances
  listLeaveBalances: (employeeId: string) =>
    request<LeaveBalance[]>(`/hr/employees/${employeeId}/leave-balances`),

  // Leave Requests
  listLeaveRequests: (params?: { employee_id?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.employee_id) qs.set("employee_id", params.employee_id);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return request<LeaveRequest[]>(`/hr/leaves${q ? `?${q}` : ""}`);
  },

  createLeaveRequest: (data: CreateLeaveRequestInput) =>
    request<LeaveRequest>("/hr/leaves", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  leaveAction: (id: string, data: LeaveActionRequest) =>
    request<LeaveRequest>(`/hr/leaves/${id}/action`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  cancelLeave: (id: string) =>
    request<LeaveRequest>(`/hr/leaves/${id}/cancel`, {
      method: "PUT",
    }),

  // On-Call
  listOnCall: (params?: { department_id?: string; schedule_date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.schedule_date) qs.set("schedule_date", params.schedule_date);
    const q = qs.toString();
    return request<OnCallSchedule[]>(`/hr/on-call${q ? `?${q}` : ""}`);
  },

  createOnCall: (data: CreateOnCallRequest) =>
    request<OnCallSchedule>("/hr/on-call", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Training Programs
  listTrainingPrograms: () =>
    request<TrainingProgram[]>("/hr/training-programs"),

  createTrainingProgram: (data: CreateTrainingProgramRequest) =>
    request<TrainingProgram>("/hr/training-programs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Training Records
  listTrainingRecords: (employeeId: string) =>
    request<TrainingRecord[]>(`/hr/employees/${employeeId}/training-records`),

  createTrainingRecord: (data: CreateTrainingRecordRequest) =>
    request<TrainingRecord>("/hr/training-records", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Appraisals
  listAppraisals: (employeeId: string) =>
    request<Appraisal[]>(`/hr/employees/${employeeId}/appraisals`),

  createAppraisal: (data: CreateAppraisalRequest) =>
    request<Appraisal>("/hr/appraisals", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Statutory Records
  listStatutoryRecords: (employeeId: string) =>
    request<StatutoryRecord[]>(`/hr/employees/${employeeId}/statutory-records`),

  createStatutoryRecord: (data: CreateStatutoryRecordRequest) =>
    request<StatutoryRecord>("/hr/statutory-records", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Housekeeping ────────────────────────────────────────

  // Cleaning Schedules
  listCleaningSchedules: (areaType?: string) =>
    request<CleaningSchedule[]>(`/housekeeping/schedules${areaType ? `?area_type=${areaType}` : ""}`),

  createCleaningSchedule: (data: CreateCleaningScheduleRequest) =>
    request<CleaningSchedule>("/housekeeping/schedules", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCleaningSchedule: (id: string, data: UpdateCleaningScheduleRequest) =>
    request<CleaningSchedule>(`/housekeeping/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Cleaning Tasks
  listCleaningTasks: (params?: { date?: string; status?: string; area_type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.date) qs.set("date", params.date);
    if (params?.status) qs.set("status", params.status);
    if (params?.area_type) qs.set("area_type", params.area_type);
    const q = qs.toString();
    return request<CleaningTask[]>(`/housekeeping/tasks${q ? `?${q}` : ""}`);
  },

  createCleaningTask: (data: CreateCleaningTaskRequest) =>
    request<CleaningTask>("/housekeeping/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCleaningTaskStatus: (id: string, data: UpdateTaskStatusRequest) =>
    request<CleaningTask>(`/housekeeping/tasks/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  verifyCleaningTask: (id: string) =>
    request<CleaningTask>(`/housekeeping/tasks/${id}/verify`, {
      method: "PUT",
    }),

  // Room Turnarounds
  listTurnarounds: (params?: { from_date?: string; to_date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.from_date) qs.set("from_date", params.from_date);
    if (params?.to_date) qs.set("to_date", params.to_date);
    const q = qs.toString();
    return request<RoomTurnaround[]>(`/housekeeping/turnarounds${q ? `?${q}` : ""}`);
  },

  createTurnaround: (data: CreateTurnaroundRequest) =>
    request<RoomTurnaround>("/housekeeping/turnarounds", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  completeTurnaround: (id: string) =>
    request<RoomTurnaround>(`/housekeeping/turnarounds/${id}/complete`, {
      method: "PUT",
    }),

  // Pest Control
  listPestControlSchedules: () =>
    request<PestControlSchedule[]>("/housekeeping/pest-control"),

  createPestControlSchedule: (data: CreatePestControlScheduleRequest) =>
    request<PestControlSchedule>("/housekeeping/pest-control", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePestControlSchedule: (id: string, data: UpdatePestControlScheduleRequest) =>
    request<PestControlSchedule>(`/housekeeping/pest-control/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listPestControlLogs: () =>
    request<PestControlLog[]>("/housekeeping/pest-control-logs"),

  createPestControlLog: (data: CreatePestControlLogRequest) =>
    request<PestControlLog>("/housekeeping/pest-control-logs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Linen Items
  listLinenItems: (params?: { status?: string; item_type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.item_type) qs.set("item_type", params.item_type);
    const q = qs.toString();
    return request<LinenItem[]>(`/housekeeping/linen${q ? `?${q}` : ""}`);
  },

  createLinenItem: (data: CreateLinenItemRequest) =>
    request<LinenItem>("/housekeeping/linen", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateLinenItem: (id: string, data: UpdateLinenItemRequest) =>
    request<LinenItem>(`/housekeeping/linen/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Linen Movements
  listLinenMovements: () =>
    request<LinenMovement[]>("/housekeeping/linen-movements"),

  createLinenMovement: (data: CreateLinenMovementRequest) =>
    request<LinenMovement>("/housekeeping/linen-movements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Laundry Batches
  listLaundryBatches: () =>
    request<LaundryBatch[]>("/housekeeping/laundry-batches"),

  createLaundryBatch: (data: CreateLaundryBatchRequest) =>
    request<LaundryBatch>("/housekeeping/laundry-batches", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  completeLaundryBatch: (id: string) =>
    request<LaundryBatch>(`/housekeeping/laundry-batches/${id}/complete`, {
      method: "PUT",
    }),

  // Par Levels
  listParLevels: () =>
    request<LinenParLevel[]>("/housekeeping/par-levels"),

  upsertParLevel: (data: UpsertParLevelRequest) =>
    request<LinenParLevel>("/housekeeping/par-levels", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Linen Condemnations
  listLinenCondemnations: () =>
    request<LinenCondemnation[]>("/housekeeping/condemnations"),

  createLinenCondemnation: (data: CreateLinenCondemnationRequest) =>
    request<LinenCondemnation>("/housekeeping/condemnations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getBmwSchedule: (params?: { ward_id?: string }) => {
    const qs = params?.ward_id ? `?ward_id=${params.ward_id}` : "";
    return request<BmwScheduleEntry[]>(`/housekeeping/bmw/schedule${qs}`);
  },
  createSharpReplacement: (data: SharpReplacementRequest) =>
    request<Record<string, unknown>>("/housekeeping/bmw/sharp-replacement", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ══════════════════════════════════════════════════════════
  //  Front Office & Reception
  // ══════════════════════════════════════════════════════════

  // Visiting Hours
  listVisitingHours: () =>
    request<VisitingHours[]>("/front-office/visiting-hours"),

  upsertVisitingHours: (data: UpsertVisitingHoursRequest) =>
    request<VisitingHours>("/front-office/visiting-hours", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Visitor Registrations
  listVisitors: (params?: { patient_id?: string; category?: string }) =>
    request<VisitorRegistration[]>(
      `/api/front-office/visitors${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`,
    ),

  createVisitor: (data: CreateVisitorRequest) =>
    request<VisitorRegistration>("/front-office/visitors", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Visitor Passes
  listVisitorPasses: (params?: { status?: string; registration_id?: string }) =>
    request<VisitorPass[]>(
      `/api/front-office/passes${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`,
    ),

  createVisitorPass: (data: CreateVisitorPassRequest) =>
    request<VisitorPass>("/front-office/passes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  revokeVisitorPass: (id: string, data: RevokePassRequest) =>
    request<VisitorPass>(`/front-office/passes/${id}/revoke`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Visitor Logs
  listVisitorLogs: (params?: { pass_id?: string; active_only?: string }) =>
    request<VisitorLog[]>(
      `/api/front-office/visitor-logs${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`,
    ),

  checkInVisitor: (passId: string) =>
    request<VisitorLog>(`/front-office/visitor-logs/${passId}/check-in`, {
      method: "POST",
    }),

  checkOutVisitor: (passId: string) =>
    request<VisitorLog>(`/front-office/visitor-logs/${passId}/check-out`, {
      method: "PUT",
    }),

  // Queue Priority Rules
  listQueuePriorityRules: () =>
    request<QueuePriorityRule[]>("/front-office/queue-priority"),

  upsertQueuePriorityRule: (data: UpsertQueuePriorityRequest) =>
    request<QueuePriorityRule>("/front-office/queue-priority", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Queue Display Config
  listQueueDisplayConfig: () =>
    request<QueueDisplayConfig[]>("/front-office/display-config"),

  upsertQueueDisplayConfig: (data: UpsertDisplayConfigRequest) =>
    request<QueueDisplayConfig>("/front-office/display-config", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Enquiries
  listEnquiries: (params?: { enquiry_type?: string; resolved?: string }) =>
    request<FrontOfficeEnquiryLog[]>(
      `/api/front-office/enquiries${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`,
    ),

  createEnquiry: (data: CreateEnquiryRequest) =>
    request<FrontOfficeEnquiryLog>("/front-office/enquiries", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  resolveEnquiry: (id: string) =>
    request<FrontOfficeEnquiryLog>(`/front-office/enquiries/${id}/resolve`, {
      method: "PUT",
    }),

  // Queue Stats
  getQueueStats: (params?: { department_id?: string }) =>
    request<QueueStatsResponse[]>(
      `/api/front-office/queue-stats${params?.department_id ? `?department_id=${params.department_id}` : ""}`,
    ),

  // ═══════════════════════════════════════════════════════
  //  BME / CMMS
  // ═══════════════════════════════════════════════════════

  // Equipment
  listBmeEquipment: (params?: { status?: string; department_id?: string; risk_category?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.risk_category) sp.set("risk_category", params.risk_category);
    const qs = sp.toString();
    return request<BmeEquipment[]>(`/bme/equipment${qs ? `?${qs}` : ""}`);
  },
  getBmeEquipment: (id: string) =>
    request<BmeEquipment>(`/bme/equipment/${id}`),
  createBmeEquipment: (body: CreateBmeEquipmentRequest) =>
    request<BmeEquipment>("/bme/equipment", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateBmeEquipment: (id: string, body: UpdateBmeEquipmentRequest) =>
    request<BmeEquipment>(`/bme/equipment/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // PM Schedules
  listBmePmSchedules: (params?: { equipment_id?: string; is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_id) sp.set("equipment_id", params.equipment_id);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<BmePmSchedule[]>(`/bme/pm-schedules${qs ? `?${qs}` : ""}`);
  },
  createBmePmSchedule: (body: CreateBmePmScheduleRequest) =>
    request<BmePmSchedule>("/bme/pm-schedules", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateBmePmSchedule: (id: string, body: UpdateBmePmScheduleRequest) =>
    request<BmePmSchedule>(`/bme/pm-schedules/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Work Orders
  listBmeWorkOrders: (params?: { equipment_id?: string; status?: string; order_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_id) sp.set("equipment_id", params.equipment_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.order_type) sp.set("order_type", params.order_type);
    const qs = sp.toString();
    return request<BmeWorkOrder[]>(`/bme/work-orders${qs ? `?${qs}` : ""}`);
  },
  getBmeWorkOrder: (id: string) =>
    request<BmeWorkOrder>(`/bme/work-orders/${id}`),
  createBmeWorkOrder: (body: CreateBmeWorkOrderRequest) =>
    request<BmeWorkOrder>("/bme/work-orders", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateBmeWorkOrderStatus: (id: string, body: UpdateBmeWorkOrderStatusRequest) =>
    request<BmeWorkOrder>(`/bme/work-orders/${id}/status`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Calibrations
  listBmeCalibrations: (params?: { equipment_id?: string; calibration_status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_id) sp.set("equipment_id", params.equipment_id);
    if (params?.calibration_status) sp.set("calibration_status", params.calibration_status);
    const qs = sp.toString();
    return request<BmeCalibration[]>(`/bme/calibrations${qs ? `?${qs}` : ""}`);
  },
  createBmeCalibration: (body: CreateBmeCalibrationRequest) =>
    request<BmeCalibration>("/bme/calibrations", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateBmeCalibration: (id: string, body: UpdateBmeCalibrationRequest) =>
    request<BmeCalibration>(`/bme/calibrations/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Contracts
  listBmeContracts: (params?: { equipment_id?: string; contract_type?: string; is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_id) sp.set("equipment_id", params.equipment_id);
    if (params?.contract_type) sp.set("contract_type", params.contract_type);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<BmeContract[]>(`/bme/contracts${qs ? `?${qs}` : ""}`);
  },
  createBmeContract: (body: CreateBmeContractRequest) =>
    request<BmeContract>("/bme/contracts", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateBmeContract: (id: string, body: UpdateBmeContractRequest) =>
    request<BmeContract>(`/bme/contracts/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Breakdowns
  listBmeBreakdowns: (params?: { equipment_id?: string; status?: string; priority?: string }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_id) sp.set("equipment_id", params.equipment_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.priority) sp.set("priority", params.priority);
    const qs = sp.toString();
    return request<BmeBreakdown[]>(`/bme/breakdowns${qs ? `?${qs}` : ""}`);
  },
  createBmeBreakdown: (body: CreateBmeBreakdownRequest) =>
    request<BmeBreakdown>("/bme/breakdowns", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateBmeBreakdownStatus: (id: string, body: UpdateBmeBreakdownStatusRequest) =>
    request<BmeBreakdown>(`/bme/breakdowns/${id}/status`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Vendor Evaluations
  listBmeVendorEvaluations: (params?: { vendor_id?: string }) =>
    request<BmeVendorEvaluation[]>(
      `/api/bme/vendor-evaluations${params?.vendor_id ? `?vendor_id=${params.vendor_id}` : ""}`,
    ),
  createBmeVendorEvaluation: (body: CreateBmeVendorEvaluationRequest) =>
    request<BmeVendorEvaluation>("/bme/vendor-evaluations", {
      method: "POST", body: JSON.stringify(body),
    }),

  // Stats
  getBmeStats: () => request<BmeStatsResponse>("/bme/stats"),
  getBmeMtbfAnalytics: () =>
    request<BmeMtbfRow[]>("/bme/analytics/mtbf"),
  getBmeUptimeAnalytics: () =>
    request<BmeUptimeRow[]>("/bme/analytics/uptime"),

  // ── Facilities Management ─────────────────────────────────

  // Gas Readings
  listFmsGasReadings: (params?: { gas_type?: string; source_type?: string; location_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.gas_type) sp.set("gas_type", params.gas_type);
    if (params?.source_type) sp.set("source_type", params.source_type);
    if (params?.location_id) sp.set("location_id", params.location_id);
    const qs = sp.toString();
    return request<FmsGasReading[]>(`/facilities/gas-readings${qs ? `?${qs}` : ""}`);
  },
  createFmsGasReading: (body: CreateFmsGasReadingRequest) =>
    request<FmsGasReading>("/facilities/gas-readings", {
      method: "POST", body: JSON.stringify(body),
    }),

  // Gas Compliance
  listFmsGasCompliance: () =>
    request<FmsGasCompliance[]>("/facilities/gas-compliance"),
  createFmsGasCompliance: (body: CreateFmsGasComplianceRequest) =>
    request<FmsGasCompliance>("/facilities/gas-compliance", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateFmsGasCompliance: (id: string, body: UpdateFmsGasComplianceRequest) =>
    request<FmsGasCompliance>(`/facilities/gas-compliance/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Fire Equipment
  listFmsFireEquipment: (params?: { equipment_type?: string; location_id?: string; is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_type) sp.set("equipment_type", params.equipment_type);
    if (params?.location_id) sp.set("location_id", params.location_id);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<FmsFireEquipment[]>(`/facilities/fire-equipment${qs ? `?${qs}` : ""}`);
  },
  createFmsFireEquipment: (body: CreateFmsFireEquipmentRequest) =>
    request<FmsFireEquipment>("/facilities/fire-equipment", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateFmsFireEquipment: (id: string, body: UpdateFmsFireEquipmentRequest) =>
    request<FmsFireEquipment>(`/facilities/fire-equipment/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Fire Inspections
  listFmsFireInspections: (params?: { equipment_id?: string }) =>
    request<FmsFireInspection[]>(
      `/api/facilities/fire-inspections${params?.equipment_id ? `?equipment_id=${params.equipment_id}` : ""}`,
    ),
  createFmsFireInspection: (body: CreateFmsFireInspectionRequest) =>
    request<FmsFireInspection>("/facilities/fire-inspections", {
      method: "POST", body: JSON.stringify(body),
    }),

  // Fire Drills
  listFmsFireDrills: () =>
    request<FmsFireDrill[]>("/facilities/fire-drills"),
  createFmsFireDrill: (body: CreateFmsFireDrillRequest) =>
    request<FmsFireDrill>("/facilities/fire-drills", {
      method: "POST", body: JSON.stringify(body),
    }),

  // Fire NOC
  listFmsFireNoc: () =>
    request<FmsFireNoc[]>("/facilities/fire-noc"),
  createFmsFireNoc: (body: CreateFmsFireNocRequest) =>
    request<FmsFireNoc>("/facilities/fire-noc", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateFmsFireNoc: (id: string, body: UpdateFmsFireNocRequest) =>
    request<FmsFireNoc>(`/facilities/fire-noc/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Water Tests
  listFmsWaterTests: (params?: { source_type?: string; test_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.source_type) sp.set("source_type", params.source_type);
    if (params?.test_type) sp.set("test_type", params.test_type);
    const qs = sp.toString();
    return request<FmsWaterTest[]>(`/facilities/water-tests${qs ? `?${qs}` : ""}`);
  },
  createFmsWaterTest: (body: CreateFmsWaterTestRequest) =>
    request<FmsWaterTest>("/facilities/water-tests", {
      method: "POST", body: JSON.stringify(body),
    }),

  // Water Schedules
  listFmsWaterSchedules: () =>
    request<FmsWaterSchedule[]>("/facilities/water-schedules"),
  createFmsWaterSchedule: (body: CreateFmsWaterScheduleRequest) =>
    request<FmsWaterSchedule>("/facilities/water-schedules", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateFmsWaterSchedule: (id: string, body: UpdateFmsWaterScheduleRequest) =>
    request<FmsWaterSchedule>(`/facilities/water-schedules/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Energy Readings
  listFmsEnergyReadings: (params?: { source_type?: string; location_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.source_type) sp.set("source_type", params.source_type);
    if (params?.location_id) sp.set("location_id", params.location_id);
    const qs = sp.toString();
    return request<FmsEnergyReading[]>(`/facilities/energy-readings${qs ? `?${qs}` : ""}`);
  },
  createFmsEnergyReading: (body: CreateFmsEnergyReadingRequest) =>
    request<FmsEnergyReading>("/facilities/energy-readings", {
      method: "POST", body: JSON.stringify(body),
    }),

  // Work Orders
  listFmsWorkOrders: (params?: { status?: string; priority?: string; department_id?: string; category?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.priority) sp.set("priority", params.priority);
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.category) sp.set("category", params.category);
    const qs = sp.toString();
    return request<FmsWorkOrder[]>(`/facilities/work-orders${qs ? `?${qs}` : ""}`);
  },
  getFmsWorkOrder: (id: string) =>
    request<FmsWorkOrder>(`/facilities/work-orders/${id}`),
  createFmsWorkOrder: (body: CreateFmsWorkOrderRequest) =>
    request<FmsWorkOrder>("/facilities/work-orders", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateFmsWorkOrderStatus: (id: string, body: UpdateFmsWorkOrderStatusRequest) =>
    request<FmsWorkOrder>(`/facilities/work-orders/${id}/status`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Stats
  getFmsStats: () => request<FmsStatsResponse>("/facilities/stats"),

  // ── Security Department ─────────────────────────────────

  // Zones
  listSecurityZones: () =>
    request<SecurityZone[]>("/security/zones"),
  createSecurityZone: (body: CreateSecurityZoneRequest) =>
    request<SecurityZone>("/security/zones", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateSecurityZone: (id: string, body: UpdateSecurityZoneRequest) =>
    request<SecurityZone>(`/security/zones/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Access Logs
  listSecurityAccessLogs: (params?: { zone_id?: string; employee_id?: string; is_after_hours?: boolean; from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.zone_id) sp.set("zone_id", params.zone_id);
    if (params?.employee_id) sp.set("employee_id", params.employee_id);
    if (params?.is_after_hours != null) sp.set("is_after_hours", String(params.is_after_hours));
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<SecurityAccessLog[]>(`/security/access-logs${qs ? `?${qs}` : ""}`);
  },
  createSecurityAccessLog: (body: CreateSecurityAccessLogRequest) =>
    request<SecurityAccessLog>("/security/access-logs", {
      method: "POST", body: JSON.stringify(body),
    }),

  // Access Cards
  listSecurityAccessCards: (params?: { employee_id?: string; is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.employee_id) sp.set("employee_id", params.employee_id);
    if (params?.is_active != null) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<SecurityAccessCard[]>(`/security/cards${qs ? `?${qs}` : ""}`);
  },
  createSecurityAccessCard: (body: CreateSecurityAccessCardRequest) =>
    request<SecurityAccessCard>("/security/cards", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateSecurityAccessCard: (id: string, body: UpdateSecurityAccessCardRequest) =>
    request<SecurityAccessCard>(`/security/cards/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),
  deactivateSecurityAccessCard: (id: string, reason?: string) =>
    request<SecurityAccessCard>(`/security/cards/${id}/deactivate`, {
      method: "PUT", body: JSON.stringify({ reason }),
    }),

  // Cameras
  listSecurityCameras: (params?: { zone_id?: string; is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.zone_id) sp.set("zone_id", params.zone_id);
    if (params?.is_active != null) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<SecurityCamera[]>(`/security/cameras${qs ? `?${qs}` : ""}`);
  },
  createSecurityCamera: (body: CreateSecurityCameraRequest) =>
    request<SecurityCamera>("/security/cameras", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateSecurityCamera: (id: string, body: UpdateSecurityCameraRequest) =>
    request<SecurityCamera>(`/security/cameras/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Incidents
  listSecurityIncidents: (params?: { severity?: string; status?: string; category?: string }) => {
    const sp = new URLSearchParams();
    if (params?.severity) sp.set("severity", params.severity);
    if (params?.status) sp.set("status", params.status);
    if (params?.category) sp.set("category", params.category);
    const qs = sp.toString();
    return request<SecurityIncident[]>(`/security-incidents${qs ? `?${qs}` : ""}`);
  },
  getSecurityIncident: (id: string) =>
    request<SecurityIncident>(`/security-incidents/${id}`),
  createSecurityIncident: (body: CreateSecurityIncidentRequest) =>
    request<SecurityIncident>("/security-incidents", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateSecurityIncident: (id: string, body: UpdateSecurityIncidentRequest) =>
    request<SecurityIncident>(`/security-incidents/${id}`, {
      method: "PATCH", body: JSON.stringify(body),
    }),

  // Patient Tags
  listSecurityPatientTags: (params?: { patient_id?: string; tag_type?: string; alert_status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.tag_type) sp.set("tag_type", params.tag_type);
    if (params?.alert_status) sp.set("alert_status", params.alert_status);
    const qs = sp.toString();
    return request<SecurityPatientTag[]>(`/security/patient-tags${qs ? `?${qs}` : ""}`);
  },
  createSecurityPatientTag: (body: CreateSecurityPatientTagRequest) =>
    request<SecurityPatientTag>("/security/patient-tags", {
      method: "POST", body: JSON.stringify(body),
    }),
  deactivateSecurityPatientTag: (id: string) =>
    request<SecurityPatientTag>(`/security/patient-tags/${id}/deactivate`, {
      method: "PUT",
    }),

  // Tag Alerts
  listSecurityTagAlerts: (params?: { tag_id?: string; is_resolved?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.tag_id) sp.set("tag_id", params.tag_id);
    if (params?.is_resolved != null) sp.set("is_resolved", String(params.is_resolved));
    const qs = sp.toString();
    return request<SecurityTagAlert[]>(`/security/tag-alerts${qs ? `?${qs}` : ""}`);
  },
  resolveSecurityTagAlert: (id: string, body: ResolveSecurityTagAlertRequest) =>
    request<SecurityTagAlert>(`/security/tag-alerts/${id}/resolve`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Code Debriefs
  listSecurityCodeDebriefs: () =>
    request<SecurityCodeDebrief[]>("/security/debriefs"),
  getSecurityCodeDebrief: (id: string) =>
    request<SecurityCodeDebrief>(`/security/debriefs/${id}`),
  createSecurityCodeDebrief: (body: CreateSecurityCodeDebriefRequest) =>
    request<SecurityCodeDebrief>("/security/debriefs", {
      method: "POST", body: JSON.stringify(body),
    }),

  // ── MRD (Medical Records Department) ────────────────────

  // Medical Records
  listMrdRecords: (params?: { status?: string; patient_id?: string; record_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.record_type) sp.set("record_type", params.record_type);
    const qs = sp.toString();
    return request<MrdMedicalRecord[]>(`/mrd/records${qs ? `?${qs}` : ""}`);
  },
  createMrdRecord: (body: CreateMrdRecordRequest) =>
    request<MrdMedicalRecord>("/mrd/records", {
      method: "POST", body: JSON.stringify(body),
    }),
  getMrdRecord: (id: string) =>
    request<MrdMedicalRecord>(`/mrd/records/${id}`),
  updateMrdRecord: (id: string, body: UpdateMrdRecordRequest) =>
    request<MrdMedicalRecord>(`/mrd/records/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Record Movements
  listMrdMovements: (recordId: string) =>
    request<MrdRecordMovement[]>(`/mrd/records/${recordId}/movements`),
  issueMrdRecord: (recordId: string, body: IssueMrdRecordRequest) =>
    request<MrdRecordMovement>(`/mrd/records/${recordId}/issue`, {
      method: "POST", body: JSON.stringify(body),
    }),
  returnMrdRecord: (recordId: string, movementId: string) =>
    request<MrdRecordMovement>(`/mrd/records/${recordId}/movements/${movementId}/return`, {
      method: "POST",
    }),

  // Birth Register
  listMrdBirths: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<MrdBirthRegister[]>(`/mrd/births${qs ? `?${qs}` : ""}`);
  },
  createMrdBirth: (body: CreateMrdBirthRequest) =>
    request<MrdBirthRegister>("/mrd/births", {
      method: "POST", body: JSON.stringify(body),
    }),
  getMrdBirth: (id: string) =>
    request<MrdBirthRegister>(`/mrd/births/${id}`),

  // Death Register
  listMrdDeaths: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<MrdDeathRegister[]>(`/mrd/deaths${qs ? `?${qs}` : ""}`);
  },
  createMrdDeath: (body: CreateMrdDeathRequest) =>
    request<MrdDeathRegister>("/mrd/deaths", {
      method: "POST", body: JSON.stringify(body),
    }),
  getMrdDeath: (id: string) =>
    request<MrdDeathRegister>(`/mrd/deaths/${id}`),

  // Retention Policies
  listMrdRetentionPolicies: () =>
    request<MrdRetentionPolicy[]>("/mrd/retention-policies"),
  createMrdRetentionPolicy: (body: CreateMrdRetentionPolicyRequest) =>
    request<MrdRetentionPolicy>("/mrd/retention-policies", {
      method: "POST", body: JSON.stringify(body),
    }),
  updateMrdRetentionPolicy: (id: string, body: UpdateMrdRetentionPolicyRequest) =>
    request<MrdRetentionPolicy>(`/mrd/retention-policies/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  // Stats
  getMrdMorbidityMortality: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<MrdMorbidityMortalityResponse>(`/mrd/stats/morbidity-mortality${qs ? `?${qs}` : ""}`);
  },
  getMrdAdmissionDischarge: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<MrdAdmissionDischargeSummary>(`/mrd/stats/admission-discharge${qs ? `?${qs}` : ""}`);
  },

    // ── Specialty Clinical: Cath Lab ────────────────────────────

    listCathProcedures: (params?: { patient_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      const qs = sp.toString();
      return request<CathProcedure[]>(`/specialty/cath-lab/procedures${qs ? `?${qs}` : ""}`);
    },
    getCathProcedure: (id: string) =>
      request<CathProcedure>(`/specialty/cath-lab/procedures/${id}`),
    createCathProcedure: (data: CreateCathProcedureRequest) =>
      request<CathProcedure>("/specialty/cath-lab/procedures", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateCathProcedure: (id: string, data: Partial<CreateCathProcedureRequest>) =>
      request<CathProcedure>(`/specialty/cath-lab/procedures/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    listCathHemodynamics: (procedureId: string) =>
      request<CathHemodynamic[]>(`/specialty/cath-lab/procedures/${procedureId}/hemodynamics`),
    createCathHemodynamic: (procedureId: string, data: CreateCathHemodynamicRequest) =>
      request<CathHemodynamic>(`/specialty/cath-lab/procedures/${procedureId}/hemodynamics`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listCathDevices: (procedureId: string) =>
      request<CathDevice[]>(`/specialty/cath-lab/procedures/${procedureId}/devices`),
    createCathDevice: (procedureId: string, data: CreateCathDeviceRequest) =>
      request<CathDevice>(`/specialty/cath-lab/procedures/${procedureId}/devices`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listStemiTimeline: (procedureId: string) =>
      request<CathStemiTimeline[]>(`/specialty/cath-lab/procedures/${procedureId}/stemi-timeline`),
    createStemiEvent: (procedureId: string, data: CreateCathStemiEventRequest) =>
      request<CathStemiTimeline>(`/specialty/cath-lab/procedures/${procedureId}/stemi-timeline`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listPostMonitoring: (procedureId: string) =>
      request<CathPostMonitoring[]>(`/specialty/cath-lab/procedures/${procedureId}/post-monitoring`),
    createPostMonitoring: (procedureId: string, data: CreateCathPostMonitoringRequest) =>
      request<CathPostMonitoring>(`/specialty/cath-lab/procedures/${procedureId}/post-monitoring`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // ── Specialty Clinical: Endoscopy ───────────────────────────

    listEndoscopyProcedures: (params?: { patient_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      const qs = sp.toString();
      return request<EndoscopyProcedure[]>(`/specialty/endoscopy/procedures${qs ? `?${qs}` : ""}`);
    },
    createEndoscopyProcedure: (data: CreateEndoscopyProcedureRequest) =>
      request<EndoscopyProcedure>("/specialty/endoscopy/procedures", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateEndoscopyProcedure: (id: string, data: Partial<CreateEndoscopyProcedureRequest>) =>
      request<EndoscopyProcedure>(`/specialty/endoscopy/procedures/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    listEndoscopyScopes: (params?: { status?: string }) => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set("status", params.status);
      const qs = sp.toString();
      return request<EndoscopyScope[]>(`/specialty/endoscopy/scopes${qs ? `?${qs}` : ""}`);
    },
    createEndoscopyScope: (data: CreateEndoscopyScopeRequest) =>
      request<EndoscopyScope>("/specialty/endoscopy/scopes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateEndoscopyScope: (id: string, data: Partial<CreateEndoscopyScopeRequest> & { status?: ScopeStatus }) =>
      request<EndoscopyScope>(`/specialty/endoscopy/scopes/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    listEndoscopyReprocessing: (params?: { scope_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.scope_id) sp.set("scope_id", params.scope_id);
      const qs = sp.toString();
      return request<EndoscopyReprocessing[]>(`/specialty/endoscopy/reprocessing${qs ? `?${qs}` : ""}`);
    },
    createEndoscopyReprocessing: (data: CreateEndoscopyReprocessingRequest) =>
      request<EndoscopyReprocessing>("/specialty/endoscopy/reprocessing", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listBiopsySpecimens: (procedureId: string) =>
      request<EndoscopyBiopsySpecimen[]>(`/specialty/endoscopy/procedures/${procedureId}/biopsies`),
    createBiopsySpecimen: (procedureId: string, data: CreateEndoscopyBiopsyRequest) =>
      request<EndoscopyBiopsySpecimen>(`/specialty/endoscopy/procedures/${procedureId}/biopsies`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // ── Specialty Clinical: Psychiatry ──────────────────────────

    listPsychPatients: (params?: { patient_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      const qs = sp.toString();
      return request<PsychPatient[]>(`/specialty/psychiatry/patients${qs ? `?${qs}` : ""}`);
    },
    getPsychPatient: (id: string) =>
      request<PsychPatient>(`/specialty/psychiatry/patients/${id}`),
    createPsychPatient: (data: CreatePsychPatientRequest) =>
      request<PsychPatient>("/specialty/psychiatry/patients", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updatePsychPatient: (id: string, data: Partial<CreatePsychPatientRequest>) =>
      request<PsychPatient>(`/specialty/psychiatry/patients/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    listPsychAssessments: (patientId: string) =>
      request<PsychAssessment[]>(`/specialty/psychiatry/patients/${patientId}/assessments`),
    createPsychAssessment: (patientId: string, data: CreatePsychAssessmentRequest) =>
      request<PsychAssessment>(`/specialty/psychiatry/patients/${patientId}/assessments`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listEctSessions: (patientId: string) =>
      request<PsychEctSession[]>(`/specialty/psychiatry/patients/${patientId}/ect`),
    createEctSession: (patientId: string, data: CreatePsychEctRequest) =>
      request<PsychEctSession>(`/specialty/psychiatry/patients/${patientId}/ect`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listRestraints: (patientId: string) =>
      request<PsychRestraint[]>(`/specialty/psychiatry/patients/${patientId}/restraints`),
    createRestraint: (patientId: string, data: CreatePsychRestraintRequest) =>
      request<PsychRestraint>(`/specialty/psychiatry/patients/${patientId}/restraints`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    releaseRestraint: (id: string) =>
      request<PsychRestraint>(`/specialty/psychiatry/restraints/${id}/release`, {
        method: "PUT",
      }),
    listMhrbNotifications: (patientId: string) =>
      request<PsychMhrbNotification[]>(`/specialty/psychiatry/patients/${patientId}/mhrb`),
    createMhrbNotification: (patientId: string, data: CreatePsychMhrbRequest) =>
      request<PsychMhrbNotification>(`/specialty/psychiatry/patients/${patientId}/mhrb`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateMhrbNotification: (id: string, data: Partial<CreatePsychMhrbRequest> & { status?: string }) =>
      request<PsychMhrbNotification>(`/specialty/psychiatry/mhrb/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    listCounselingSessions: (patientId: string) =>
      request<PsychCounselingSession[]>(`/specialty/psychiatry/patients/${patientId}/counseling`),
    createCounselingSession: (patientId: string, data: CreatePsychCounselingRequest) =>
      request<PsychCounselingSession>(`/specialty/psychiatry/patients/${patientId}/counseling`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // ── Specialty Clinical: Maternity ───────────────────────────

    listMaternityRegistrations: (params?: { patient_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      const qs = sp.toString();
      return request<MaternityRegistration[]>(`/specialty/maternity/registrations${qs ? `?${qs}` : ""}`);
    },
    getMaternityRegistration: (id: string) =>
      request<MaternityRegistration>(`/specialty/maternity/registrations/${id}`),
    createMaternityRegistration: (data: CreateMaternityRegistrationRequest) =>
      request<MaternityRegistration>("/specialty/maternity/registrations", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listAncVisits: (registrationId: string) =>
      request<AncVisit[]>(`/specialty/maternity/registrations/${registrationId}/anc`),
    createAncVisit: (registrationId: string, data: CreateAncVisitRequest) =>
      request<AncVisit>(`/specialty/maternity/registrations/${registrationId}/anc`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listLaborRecords: (registrationId: string) =>
      request<LaborRecord[]>(`/specialty/maternity/registrations/${registrationId}/labor`),
    createLaborRecord: (registrationId: string, data: CreateLaborRecordRequest) =>
      request<LaborRecord>(`/specialty/maternity/registrations/${registrationId}/labor`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateLaborRecord: (id: string, data: Partial<CreateLaborRecordRequest> & { delivery_type?: DeliveryType; apgar_1min?: number; apgar_5min?: number; baby_weight_gm?: number }) =>
      request<LaborRecord>(`/specialty/maternity/labor/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    listNewborns: (laborId: string) =>
      request<NewbornRecord[]>(`/specialty/maternity/labor/${laborId}/newborns`),
    createNewborn: (laborId: string, data: CreateNewbornRecordRequest) =>
      request<NewbornRecord>(`/specialty/maternity/labor/${laborId}/newborns`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listPostnatalRecords: (registrationId: string) =>
      request<PostnatalRecord[]>(`/specialty/maternity/registrations/${registrationId}/postnatal`),
    createPostnatalRecord: (registrationId: string, data: CreatePostnatalRecordRequest) =>
      request<PostnatalRecord>(`/specialty/maternity/registrations/${registrationId}/postnatal`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // ── Specialty Clinical: PMR / Audiology ─────────────────────

    listRehabPlans: (params?: { patient_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      const qs = sp.toString();
      return request<RehabPlan[]>(`/specialty/pmr/rehab-plans${qs ? `?${qs}` : ""}`);
    },
    createRehabPlan: (data: CreateRehabPlanRequest) =>
      request<RehabPlan>("/specialty/pmr/rehab-plans", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listRehabSessions: (planId: string) =>
      request<RehabSession[]>(`/specialty/pmr/rehab-plans/${planId}/sessions`),
    createRehabSession: (planId: string, data: CreateRehabSessionRequest) =>
      request<RehabSession>(`/specialty/pmr/rehab-plans/${planId}/sessions`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listAudiologyTests: (params?: { patient_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      const qs = sp.toString();
      return request<AudiologyTest[]>(`/specialty/pmr/audiology${qs ? `?${qs}` : ""}`);
    },
    createAudiologyTest: (data: CreateAudiologyTestRequest) =>
      request<AudiologyTest>("/specialty/pmr/audiology", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listPsychometricTests: (params?: { patient_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      const qs = sp.toString();
      return request<PsychometricTest[]>(`/specialty/pmr/psychometric${qs ? `?${qs}` : ""}`);
    },
    createPsychometricTest: (data: CreatePsychometricTestRequest) =>
      request<PsychometricTest>("/specialty/pmr/psychometric", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // ── Specialty Clinical: Palliative / Mortuary / Nuclear Med ──

    listDnrOrders: (params?: { patient_id?: string; status?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      if (params?.status) sp.set("status", params.status);
      const qs = sp.toString();
      return request<DnrOrder[]>(`/specialty/palliative/dnr${qs ? `?${qs}` : ""}`);
    },
    createDnrOrder: (data: CreateDnrOrderRequest) =>
      request<DnrOrder>("/specialty/palliative/dnr", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    revokeDnrOrder: (id: string) =>
      request<DnrOrder>(`/specialty/palliative/dnr/${id}/revoke`, {
        method: "PUT",
      }),
    listPainAssessments: (params?: { patient_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      const qs = sp.toString();
      return request<PainAssessment[]>(`/specialty/palliative/pain${qs ? `?${qs}` : ""}`);
    },
    createPainAssessment: (data: CreatePainAssessmentRequest) =>
      request<PainAssessment>("/specialty/palliative/pain", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listMortuaryRecords: (params?: { status?: string }) => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set("status", params.status);
      const qs = sp.toString();
      return request<MortuaryRecord[]>(`/specialty/mortuary/records${qs ? `?${qs}` : ""}`);
    },
    createMortuaryRecord: (data: CreateMortuaryRecordRequest) =>
      request<MortuaryRecord>("/specialty/mortuary/records", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateMortuaryRecord: (id: string, data: Partial<CreateMortuaryRecordRequest> & { status?: BodyStatus; pm_requested?: boolean; pm_conducted_by?: string; pm_date?: string; pm_findings?: string }) =>
      request<MortuaryRecord>(`/specialty/mortuary/records/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    listNuclearSources: () =>
      request<NuclearMedSource[]>("/specialty/nuclear-med/sources"),
    createNuclearSource: (data: CreateNuclearMedSourceRequest) =>
      request<NuclearMedSource>("/specialty/nuclear-med/sources", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listNuclearAdministrations: (params?: { patient_id?: string; source_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      if (params?.source_id) sp.set("source_id", params.source_id);
      const qs = sp.toString();
      return request<NuclearMedAdministration[]>(`/specialty/nuclear-med/administrations${qs ? `?${qs}` : ""}`);
    },
    createNuclearAdministration: (data: CreateNuclearMedAdminRequest) =>
      request<NuclearMedAdministration>("/specialty/nuclear-med/administrations", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // ── Specialty Clinical: Other Specialties ───────────────────

    listSpecialtyTemplates: (params?: { specialty?: string }) => {
      const sp = new URLSearchParams();
      if (params?.specialty) sp.set("specialty", params.specialty);
      const qs = sp.toString();
      return request<SpecialtyTemplate[]>(`/specialty/templates${qs ? `?${qs}` : ""}`);
    },
    createSpecialtyTemplate: (data: CreateSpecialtyTemplateRequest) =>
      request<SpecialtyTemplate>("/specialty/templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listSpecialtyRecords: (params?: { patient_id?: string; specialty?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      if (params?.specialty) sp.set("specialty", params.specialty);
      const qs = sp.toString();
      return request<SpecialtyRecord[]>(`/specialty/records${qs ? `?${qs}` : ""}`);
    },
    createSpecialtyRecord: (data: CreateSpecialtyRecordRequest) =>
      request<SpecialtyRecord>("/specialty/records", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listDialysisSessions: (params?: { patient_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      const qs = sp.toString();
      return request<DialysisSession[]>(`/specialty/dialysis/sessions${qs ? `?${qs}` : ""}`);
    },
    createDialysisSession: (data: CreateDialysisSessionRequest) =>
      request<DialysisSession>("/specialty/dialysis/sessions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateDialysisSession: (id: string, data: Partial<CreateDialysisSessionRequest> & { post_weight_kg?: number; uf_achieved_ml?: number; post_vitals?: Record<string, unknown>; kt_v?: number; urr_pct?: number }) =>
      request<DialysisSession>(`/specialty/dialysis/sessions/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    listChemoProtocols: (params?: { patient_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      const qs = sp.toString();
      return request<ChemoProtocol[]>(`/specialty/chemo/protocols${qs ? `?${qs}` : ""}`);
    },
    createChemoProtocol: (data: CreateChemoProtocolRequest) =>
      request<ChemoProtocol>("/specialty/chemo/protocols", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateChemoProtocol: (id: string, data: Partial<CreateChemoProtocolRequest>) =>
      request<ChemoProtocol>(`/specialty/chemo/protocols/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    // ── Documents Module ─────────────────────────────────────

    // Templates
    listDocumentTemplates: (params?: { category?: string; module_code?: string; is_active?: boolean }) => {
      const sp = new URLSearchParams();
      if (params?.category) sp.set("category", params.category);
      if (params?.module_code) sp.set("module_code", params.module_code);
      if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
      const qs = sp.toString();
      return request<DocumentTemplate[]>(`/documents/templates${qs ? `?${qs}` : ""}`);
    },
    createDocumentTemplate: (data: CreateDocumentTemplateRequest) =>
      request<DocumentTemplate>("/documents/templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getDocumentTemplate: (id: string) =>
      request<DocumentTemplate>(`/documents/templates/${id}`),
    updateDocumentTemplate: (id: string, data: UpdateDocumentTemplateRequest) =>
      request<DocumentTemplate>(`/documents/templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteDocumentTemplate: (id: string) =>
      request<{ status: string }>(`/documents/templates/${id}`, {
        method: "DELETE",
      }),
    listTemplateVersions: (id: string) =>
      request<DocumentTemplateVersion[]>(`/documents/templates/${id}/versions`),
    listDefaultTemplates: () =>
      request<DocumentTemplate[]>("/documents/templates/defaults"),
    setDefaultTemplate: (id: string) =>
      request<DocumentTemplate>(`/documents/templates/${id}/set-default`, {
        method: "POST",
        body: JSON.stringify({}),
      }),

    // Document Generation
    generateDocument: (data: GenerateDocumentRequest) =>
      request<DocumentOutput>("/documents/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    previewDocument: (data: GenerateDocumentRequest) =>
      request<DocumentOutput>("/documents/generate/preview", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    batchGenerateDocuments: (data: BatchGenerateRequest) =>
      request<DocumentOutput[]>("/documents/generate/batch", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // Document Outputs
    listDocumentOutputs: (params?: { category?: string; status?: string; patient_id?: string; module_code?: string }) => {
      const sp = new URLSearchParams();
      if (params?.category) sp.set("category", params.category);
      if (params?.status) sp.set("status", params.status);
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      if (params?.module_code) sp.set("module_code", params.module_code);
      const qs = sp.toString();
      return request<DocumentOutput[]>(`/documents/outputs${qs ? `?${qs}` : ""}`);
    },
    getDocumentOutput: (id: string) =>
      request<DocumentOutput>(`/documents/outputs/${id}`),
    recordDocumentPrint: (id: string) =>
      request<DocumentOutput>(`/documents/outputs/${id}/print`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    voidDocumentOutput: (id: string, data: VoidDocumentRequest) =>
      request<DocumentOutput>(`/documents/outputs/${id}/void`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listPatientDocumentOutputs: (patientId: string) =>
      request<DocumentOutput[]>(`/documents/outputs/patient/${patientId}`),
    getDocumentOutputStats: () =>
      request<DocumentOutputStats>("/documents/outputs/stats"),

    // Document Signatures
    listDocumentSignatures: (docId: string) =>
      request<DocumentOutputSignature[]>(`/documents/outputs/${docId}/signatures`),
    addDocumentSignature: (docId: string, data: AddDocumentSignatureRequest) =>
      request<DocumentOutputSignature>(`/documents/outputs/${docId}/signatures`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteDocumentSignature: (docId: string, sigId: string) =>
      request<{ status: string }>(`/documents/outputs/${docId}/signatures/${sigId}`, {
        method: "DELETE",
      }),

    // Review Schedule
    listReviewSchedule: (params?: { template_id?: string; review_status?: string }) => {
      const sp = new URLSearchParams();
      if (params?.template_id) sp.set("template_id", params.template_id);
      if (params?.review_status) sp.set("review_status", params.review_status);
      const qs = sp.toString();
      return request<DocumentFormReviewSchedule[]>(`/documents/review-schedule${qs ? `?${qs}` : ""}`);
    },
    createReviewSchedule: (data: CreateReviewScheduleRequest) =>
      request<DocumentFormReviewSchedule>("/documents/review-schedule", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    markReviewed: (id: string) =>
      request<DocumentFormReviewSchedule>(`/documents/review-schedule/${id}`, {
        method: "PUT",
        body: JSON.stringify({}),
      }),

    // Printers & Print Jobs
    listPrinters: () =>
      request<unknown[]>("/documents/printers"),
    createPrinter: (data: Record<string, unknown>) =>
      request<unknown>("/documents/printers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listPrintJobs: () =>
      request<unknown[]>("/documents/print-jobs"),
    updatePrintJob: (id: string, data: Record<string, unknown>) =>
      request<unknown>(`/documents/print-jobs/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    // ── Regulatory & Compliance ──────────────────────────────

    // Dashboard
    getRegulatoryDashboard: () =>
      request<ComplianceDashboard>("/regulatory/dashboard"),

    getDepartmentCompliance: (deptId: string) =>
      request<ComplianceChecklist[]>(`/regulatory/dashboard/department/${deptId}`),

    getComplianceGaps: () =>
      request<ComplianceGap[]>("/regulatory/dashboard/gaps"),

    // Checklists
    listChecklists: (params?: { department_id?: string; accreditation_body?: string; status?: string }) => {
      const sp = new URLSearchParams();
      if (params?.department_id) sp.set("department_id", params.department_id);
      if (params?.accreditation_body) sp.set("accreditation_body", params.accreditation_body);
      if (params?.status) sp.set("status", params.status);
      const qs = sp.toString();
      return request<ComplianceChecklist[]>(`/regulatory/checklists${qs ? `?${qs}` : ""}`);
    },

    createChecklist: (data: CreateChecklistRequest) =>
      request<ComplianceChecklist>("/regulatory/checklists", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getChecklist: (id: string) =>
      request<ComplianceChecklistWithItems>(`/regulatory/checklists/${id}`),

    updateChecklist: (id: string, data: UpdateChecklistRequest) =>
      request<ComplianceChecklist>(`/regulatory/checklists/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    batchChecklistItems: (checklistId: string, items: ChecklistItemInput[]) =>
      request<ComplianceChecklistItem[]>(`/regulatory/checklists/${checklistId}/items`, {
        method: "POST",
        body: JSON.stringify({ items }),
      }),

    updateChecklistItem: (checklistId: string, itemId: string, data: Record<string, unknown>) =>
      request<ComplianceChecklistItem>(`/regulatory/checklists/${checklistId}/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    // ADR Reports
    listAdrReports: (params?: { status?: string; severity?: string }) => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set("status", params.status);
      if (params?.severity) sp.set("severity", params.severity);
      const qs = sp.toString();
      return request<AdrReport[]>(`/regulatory/adr-reports${qs ? `?${qs}` : ""}`);
    },

    createAdrReport: (data: CreateAdrRequest) =>
      request<AdrReport>("/regulatory/adr-reports", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getAdrReport: (id: string) =>
      request<AdrReport>(`/regulatory/adr-reports/${id}`),

    updateAdrReport: (id: string, data: UpdateAdrRequest) =>
      request<AdrReport>(`/regulatory/adr-reports/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    submitAdrToPvpi: (id: string) =>
      request<AdrReport>(`/regulatory/adr-reports/${id}/submit`, {
        method: "POST",
      }),

    // Materiovigilance
    listMvReports: (params?: { status?: string }) => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set("status", params.status);
      const qs = sp.toString();
      return request<MateriovigilanceReport[]>(`/regulatory/materiovigilance${qs ? `?${qs}` : ""}`);
    },

    createMvReport: (data: CreateMvRequest) =>
      request<MateriovigilanceReport>("/regulatory/materiovigilance", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getMvReport: (id: string) =>
      request<MateriovigilanceReport>(`/regulatory/materiovigilance/${id}`),

    updateMvReport: (id: string, data: UpdateMvRequest) =>
      request<MateriovigilanceReport>(`/regulatory/materiovigilance/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    submitMvToCdsco: (id: string) =>
      request<MateriovigilanceReport>(`/regulatory/materiovigilance/${id}/submit`, {
        method: "POST",
      }),

    // PCPNDT Forms
    listPcpndtForms: (params?: { status?: string }) => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set("status", params.status);
      const qs = sp.toString();
      return request<PcpndtForm[]>(`/regulatory/pcpndt-forms${qs ? `?${qs}` : ""}`);
    },

    createPcpndtForm: (data: CreatePcpndtRequest) =>
      request<PcpndtForm>("/regulatory/pcpndt-forms", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getPcpndtForm: (id: string) =>
      request<PcpndtForm>(`/regulatory/pcpndt-forms/${id}`),

    updatePcpndtForm: (id: string, data: UpdatePcpndtRequest) =>
      request<PcpndtForm>(`/regulatory/pcpndt-forms/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    getPcpndtQuarterly: () =>
      request<PcpndtQuarterlySummary>("/regulatory/pcpndt-forms/quarterly"),

    // Compliance Calendar
    listCalendarEvents: (params?: { status?: string; department_id?: string; from_date?: string; to_date?: string }) => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set("status", params.status);
      if (params?.department_id) sp.set("department_id", params.department_id);
      if (params?.from_date) sp.set("from_date", params.from_date);
      if (params?.to_date) sp.set("to_date", params.to_date);
      const qs = sp.toString();
      return request<ComplianceCalendarEvent[]>(`/regulatory/calendar${qs ? `?${qs}` : ""}`);
    },

    createCalendarEvent: (data: CreateCalendarEventRequest) =>
      request<ComplianceCalendarEvent>("/regulatory/calendar", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateCalendarEvent: (id: string, data: UpdateCalendarEventRequest) =>
      request<ComplianceCalendarEvent>(`/regulatory/calendar/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    getOverdueCalendarEvents: () =>
      request<ComplianceCalendarEvent[]>("/regulatory/calendar/overdue"),

    // ── Order Sets ──────────────────────────────────────

    listOrderSetTemplates: (params?: { context?: string; department_id?: string; search?: string; is_active?: boolean }) => {
      const sp = new URLSearchParams();
      if (params?.context) sp.set("context", params.context);
      if (params?.department_id) sp.set("department_id", params.department_id);
      if (params?.search) sp.set("search", params.search);
      if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
      const qs = sp.toString();
      return request<OrderSetTemplate[]>(`/order-sets/templates${qs ? `?${qs}` : ""}`);
    },

    getOrderSetTemplate: (id: string) =>
      request<TemplateWithItems>(`/order-sets/templates/${id}`),

    createOrderSetTemplate: (data: CreateOrderSetTemplateRequest) =>
      request<OrderSetTemplate>("/order-sets/templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateOrderSetTemplate: (id: string, data: UpdateOrderSetTemplateRequest) =>
      request<OrderSetTemplate>(`/order-sets/templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    deleteOrderSetTemplate: (id: string) =>
      request<OrderSetTemplate>(`/order-sets/templates/${id}`, {
        method: "DELETE",
      }),

    addOrderSetItem: (templateId: string, data: AddOrderSetItemRequest) =>
      request<OrderSetTemplateItem>(`/order-sets/templates/${templateId}/items`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateOrderSetItem: (templateId: string, itemId: string, data: UpdateOrderSetItemRequest) =>
      request<OrderSetTemplateItem>(`/order-sets/templates/${templateId}/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    deleteOrderSetItem: (templateId: string, itemId: string) =>
      request<{ deleted: boolean }>(`/order-sets/templates/${templateId}/items/${itemId}`, {
        method: "DELETE",
      }),

    createOrderSetVersion: (id: string) =>
      request<TemplateWithItems>(`/order-sets/templates/${id}/new-version`, {
        method: "POST",
      }),

    approveOrderSetTemplate: (id: string) =>
      request<OrderSetTemplate>(`/order-sets/templates/${id}/approve`, {
        method: "PUT",
      }),

    listOrderSetVersions: (id: string) =>
      request<OrderSetTemplate[]>(`/order-sets/templates/${id}/versions`),

    suggestOrderSets: (params?: { icd_code?: string; context?: string; department_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.icd_code) sp.set("icd_code", params.icd_code);
      if (params?.context) sp.set("context", params.context);
      if (params?.department_id) sp.set("department_id", params.department_id);
      const qs = sp.toString();
      return request<OrderSetTemplate[]>(`/order-sets/suggest${qs ? `?${qs}` : ""}`);
    },

    activateOrderSet: (data: ActivateOrderSetRequest) =>
      request<ActivationResult>("/order-sets/activate", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    listOrderSetActivations: (params?: { encounter_id?: string; patient_id?: string; template_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.encounter_id) sp.set("encounter_id", params.encounter_id);
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      if (params?.template_id) sp.set("template_id", params.template_id);
      const qs = sp.toString();
      return request<OrderSetActivation[]>(`/order-sets/activations${qs ? `?${qs}` : ""}`);
    },

    getOrderSetActivation: (id: string) =>
      request<ActivationWithItems>(`/order-sets/activations/${id}`),

    getOrderSetAnalytics: () =>
      request<OrderSetAnalyticsSummary>("/order-sets/analytics"),

    getOrderSetTemplateAnalytics: (templateId: string) =>
      request<OrderSetUsageStats[]>(`/order-sets/analytics/${templateId}`),

    // ── Insurance & TPA ─────────────────────────────────────

    // Verification
    listVerifications: (params?: { patient_id?: string; status?: string; from_date?: string; to_date?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      if (params?.status) sp.set("status", params.status);
      if (params?.from_date) sp.set("from_date", params.from_date);
      if (params?.to_date) sp.set("to_date", params.to_date);
      const qs = sp.toString();
      return request<InsuranceVerification[]>(`/insurance/verifications${qs ? `?${qs}` : ""}`);
    },

    runVerification: (data: RunVerificationRequest) =>
      request<InsuranceVerification>("/insurance/verifications", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getVerification: (id: string) =>
      request<InsuranceVerification>(`/insurance/verifications/${id}`),

    getPatientBenefits: (patientId: string) =>
      request<InsuranceVerification>(`/insurance/verifications/patient/${patientId}/benefits`),

    // Prior Auth
    listPriorAuths: (params?: { patient_id?: string; status?: string; urgency?: string; from_date?: string; to_date?: string }) => {
      const sp = new URLSearchParams();
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      if (params?.status) sp.set("status", params.status);
      if (params?.urgency) sp.set("urgency", params.urgency);
      if (params?.from_date) sp.set("from_date", params.from_date);
      if (params?.to_date) sp.set("to_date", params.to_date);
      const qs = sp.toString();
      return request<PriorAuthRequestRow[]>(`/insurance/prior-auths${qs ? `?${qs}` : ""}`);
    },

    getPriorAuth: (id: string) =>
      request<PriorAuthDetail>(`/insurance/prior-auths/${id}`),

    createPriorAuth: (data: CreatePriorAuthRequestBody) =>
      request<PriorAuthRequestRow>("/insurance/prior-auths", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updatePriorAuth: (id: string, data: UpdatePriorAuthRequestBody) =>
      request<PriorAuthRequestRow>(`/insurance/prior-auths/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    submitPriorAuth: (id: string) =>
      request<PriorAuthRequestRow>(`/insurance/prior-auths/${id}/submit`, {
        method: "POST",
      }),

    respondPriorAuth: (id: string, data: RespondPriorAuthRequest) =>
      request<PriorAuthRequestRow>(`/insurance/prior-auths/${id}/respond`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    cancelPriorAuth: (id: string) =>
      request<PriorAuthRequestRow>(`/insurance/prior-auths/${id}/cancel`, {
        method: "POST",
      }),

    checkPaRequired: (data: CheckPaRequiredRequest) =>
      request<PaCheckResult>("/insurance/check-pa", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // Documents
    listPaDocuments: (paId: string) =>
      request<PriorAuthDocument[]>(`/insurance/prior-auths/${paId}/documents`),

    attachPaDocument: (paId: string, data: AttachDocumentRequest) =>
      request<PriorAuthDocument>(`/insurance/prior-auths/${paId}/documents`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    removePaDocument: (paId: string, docId: string) =>
      request<{ deleted: boolean }>(`/insurance/prior-auths/${paId}/documents/${docId}`, {
        method: "DELETE",
      }),

    // Appeals
    listAppeals: (params?: { prior_auth_id?: string; status?: string }) => {
      const sp = new URLSearchParams();
      if (params?.prior_auth_id) sp.set("prior_auth_id", params.prior_auth_id);
      if (params?.status) sp.set("status", params.status);
      const qs = sp.toString();
      return request<PriorAuthAppeal[]>(`/insurance/appeals${qs ? `?${qs}` : ""}`);
    },

    createAppeal: (data: CreateAppealRequest) =>
      request<PriorAuthAppeal>("/insurance/appeals", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateAppeal: (id: string, data: UpdateAppealRequest) =>
      request<PriorAuthAppeal>(`/insurance/appeals/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    // PA Rules
    listPaRules: () =>
      request<PaRequirementRule[]>("/insurance/rules"),

    createPaRule: (data: CreatePaRuleRequest) =>
      request<PaRequirementRule>("/insurance/rules", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updatePaRule: (id: string, data: UpdatePaRuleRequest) =>
      request<PaRequirementRule>(`/insurance/rules/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    // Dashboard
    getInsuranceDashboard: () =>
      request<InsuranceDashboard>("/insurance/dashboard"),

    // ── IPD Phase 2b ──────────────────────────────────────────

    // IP Type Configuration
    listIpTypes: () =>
      request<IpTypeConfiguration[]>("/ipd/ip-types"),

    createIpType: (data: CreateIpTypeRequest) =>
      request<IpTypeConfiguration>("/ipd/ip-types", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateIpType: (id: string, data: UpdateIpTypeRequest) =>
      request<IpTypeConfiguration>(`/ipd/ip-types/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    // Admission Checklists
    listAdmissionChecklist: (admissionId: string) =>
      request<AdmissionChecklist[]>(`/ipd/admissions/${admissionId}/checklist`),

    createAdmissionChecklist: (admissionId: string, data: CreateChecklistItemsRequest) =>
      request<AdmissionChecklist[]>(`/ipd/admissions/${admissionId}/checklist`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    toggleChecklistItem: (admissionId: string, itemId: string, data: ToggleChecklistItemRequest) =>
      request<AdmissionChecklist>(`/ipd/admissions/${admissionId}/checklist/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    // Bed Reservations
    listBedReservations: (params?: { status?: string; bed_id?: string; patient_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set("status", params.status);
      if (params?.bed_id) sp.set("bed_id", params.bed_id);
      if (params?.patient_id) sp.set("patient_id", params.patient_id);
      const qs = sp.toString();
      return request<BedReservation[]>(`/ipd/bed-reservations${qs ? `?${qs}` : ""}`);
    },

    createBedReservation: (data: CreateBedReservationRequest) =>
      request<BedReservation>("/ipd/bed-reservations", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateBedReservationStatus: (id: string, data: UpdateBedReservationStatusRequest) =>
      request<BedReservation>(`/ipd/bed-reservations/${id}/status`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    listBedReservationsForBed: (bedId: string) =>
      request<BedReservation[]>(`/ipd/beds/${bedId}/reservations`),

    // Bed Turnaround
    listBedTurnaround: (params?: { from?: string; to?: string }) => {
      const sp = new URLSearchParams();
      if (params?.from) sp.set("from", params.from);
      if (params?.to) sp.set("to", params.to);
      const qs = sp.toString();
      return request<BedTurnaroundLog[]>(`/ipd/bed-turnaround${qs ? `?${qs}` : ""}`);
    },

    createBedTurnaround: (data: CreateBedTurnaroundRequest) =>
      request<BedTurnaroundLog>("/ipd/bed-turnaround", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    completeBedTurnaround: (id: string) =>
      request<BedTurnaroundLog>(`/ipd/bed-turnaround/${id}/complete`, {
        method: "POST",
      }),

    // Clinical Documentation
    listClinicalDocs: (admissionId: string, params?: { doc_type?: string }) => {
      const sp = new URLSearchParams();
      if (params?.doc_type) sp.set("doc_type", params.doc_type);
      const qs = sp.toString();
      return request<IpdClinicalDocumentation[]>(`/ipd/admissions/${admissionId}/clinical-docs${qs ? `?${qs}` : ""}`);
    },

    createClinicalDoc: (admissionId: string, data: CreateClinicalDocRequest) =>
      request<IpdClinicalDocumentation>(`/ipd/admissions/${admissionId}/clinical-docs`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateClinicalDoc: (admissionId: string, docId: string, data: UpdateClinicalDocRequest) =>
      request<IpdClinicalDocumentation>(`/ipd/admissions/${admissionId}/clinical-docs/${docId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    resolveClinicalDoc: (admissionId: string, docId: string) =>
      request<IpdClinicalDocumentation>(`/ipd/admissions/${admissionId}/clinical-docs/${docId}/resolve`, {
        method: "POST",
      }),

    // Restraint Monitoring
    listRestraintChecks: (admissionId: string, docId: string) =>
      request<RestraintMonitoringLog[]>(`/ipd/admissions/${admissionId}/restraint-checks/${docId}`),

    createRestraintCheck: (admissionId: string, data: CreateRestraintCheckRequest) =>
      request<RestraintMonitoringLog>(`/ipd/admissions/${admissionId}/restraint-checks`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // Transfers
    listTransfers: (admissionId: string) =>
      request<IpdTransferLog[]>(`/ipd/admissions/${admissionId}/transfers`),

    createTransfer: (admissionId: string, data: CreateTransferRequest) =>
      request<IpdTransferLog>(`/ipd/admissions/${admissionId}/transfers`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // Death Summary
    getDeathSummary: (admissionId: string) =>
      request<IpdDeathSummary>(`/ipd/admissions/${admissionId}/death-summary`),

    createDeathSummary: (admissionId: string, data: CreateDeathSummaryRequest) =>
      request<IpdDeathSummary>(`/ipd/admissions/${admissionId}/death-summary`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateDeathSummary: (admissionId: string, data: UpdateDeathSummaryRequest) =>
      request<IpdDeathSummary>(`/ipd/admissions/${admissionId}/death-summary`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    // Birth Records
    listBirthRecords: (admissionId: string) =>
      request<IpdBirthRecord[]>(`/ipd/admissions/${admissionId}/birth-records`),

    createBirthRecord: (admissionId: string, data: CreateBirthRecordRequest) =>
      request<IpdBirthRecord>(`/ipd/admissions/${admissionId}/birth-records`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateBirthRecord: (admissionId: string, recId: string, data: UpdateBirthRecordRequest) =>
      request<IpdBirthRecord>(`/ipd/admissions/${admissionId}/birth-records/${recId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    // Discharge TAT
    getDischargeTat: (admissionId: string) =>
      request<IpdDischargeTatLog>(`/ipd/admissions/${admissionId}/discharge-tat`),

    initiateDischargeTat: (admissionId: string, data?: InitDischargeTatRequest) =>
      request<IpdDischargeTatLog>(`/ipd/admissions/${admissionId}/discharge-tat`, {
        method: "POST",
        body: JSON.stringify(data ?? {}),
      }),

    updateDischargeTat: (admissionId: string, data: UpdateDischargeTatRequest) =>
      request<IpdDischargeTatLog>(`/ipd/admissions/${admissionId}/discharge-tat`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    // OT Consumables
    listOtConsumables: (bookingId: string) =>
      request<OtConsumableUsage[]>(`/ot/bookings/${bookingId}/consumables`),

    createOtConsumable: (bookingId: string, data: CreateOtConsumableRequest) =>
      request<OtConsumableUsage>(`/ot/bookings/${bookingId}/consumables`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    deleteOtConsumable: (bookingId: string, itemId: string) =>
      request<{ deleted: boolean }>(`/ot/bookings/${bookingId}/consumables/${itemId}`, {
        method: "DELETE",
      }),

    // OT Analytics
    otUtilization: (params?: { from?: string; to?: string }) => {
      const sp = new URLSearchParams();
      if (params?.from) sp.set("from", params.from);
      if (params?.to) sp.set("to", params.to);
      const qs = sp.toString();
      return request<RoomUtilization[]>(`/ot/analytics/utilization${qs ? `?${qs}` : ""}`);
    },

    getSurgeonCaseload: (params?: { from?: string; to?: string }) => {
      const sp = new URLSearchParams();
      if (params?.from) sp.set("from", params.from);
      if (params?.to) sp.set("to", params.to);
      const qs = sp.toString();
      return request<SurgeonCaseloadEntry[]>(`/ot/analytics/surgeon-caseload${qs ? `?${qs}` : ""}`);
    },

    listAnesthesiaComplications: (params?: { from?: string; to?: string }) => {
      const sp = new URLSearchParams();
      if (params?.from) sp.set("from", params.from);
      if (params?.to) sp.set("to", params.to);
      const qs = sp.toString();
      return request<AnesthesiaComplicationEntry[]>(`/ot/analytics/anesthesia-complications${qs ? `?${qs}` : ""}`);
    },

    // IPD Phase 3a — Cross-module reads
    getAdmissionInvestigations: (admissionId: string) =>
      request<InvestigationsResponse>(`/ipd/admissions/${admissionId}/investigations`),

    getEstimatedCost: (admissionId: string) =>
      request<EstimatedCostResponse>(`/ipd/admissions/${admissionId}/estimated-cost`),

    getAdmissionAdvances: (admissionId: string) =>
      request<Receipt[]>(`/ipd/admissions/${admissionId}/advances`),

    getAdmissionPriorAuth: (admissionId: string) =>
      request<PriorAuthRequestRow[]>(`/ipd/admissions/${admissionId}/prior-auth`),

    linkMlc: (admissionId: string, data: LinkMlcRequest) =>
      request<Admission>(`/ipd/admissions/${admissionId}/mlc`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    getAdmissionMlc: (admissionId: string) =>
      request<MlcCase | null>(`/ipd/admissions/${admissionId}/mlc`),

    getAdmissionBillingSummary: (admissionId: string) =>
      request<BillingSummaryResponse>(`/ipd/admissions/${admissionId}/billing-summary`),

    getAdmissionPrintData: (admissionId: string) =>
      request<AdmissionPrintData>(`/ipd/admissions/${admissionId}/print`),

    getAdmissionDietOrders: (admissionId: string) =>
      request<DietOrder[]>(`/ipd/admissions/${admissionId}/diet-orders`),

    getAdmissionConsents: (admissionId: string) =>
      request<ProcedureConsent[]>(`/ipd/admissions/${admissionId}/consents`),

    // ── Care View / Ward Dashboard ──────────────────────────

    wardPatientGrid: (wardId?: string) =>
      request<WardGridResponse>(
        `/care-view/ward-grid${wardId ? `?ward_id=${wardId}` : ""}`,
      ),

    careViewMyTasks: (params?: { ward_id?: string; category?: string }) => {
      const sp = new URLSearchParams();
      if (params?.ward_id) sp.set("ward_id", params.ward_id);
      if (params?.category) sp.set("category", params.category);
      const qs = sp.toString();
      return request<MyTasksResponse>(`/care-view/my-tasks${qs ? `?${qs}` : ""}`);
    },

    vitalsChecklist: (wardId?: string) =>
      request<VitalsChecklistRow[]>(
        `/care-view/vitals-checklist${wardId ? `?ward_id=${wardId}` : ""}`,
      ),

    handoverSummary: (wardId: string, shift: string) =>
      request<HandoverSummaryResponse>(
        `/care-view/handover?ward_id=${wardId}&shift=${shift}`,
      ),

    dischargeReadiness: (wardId?: string) =>
      request<DischargeReadinessRow[]>(
        `/care-view/discharge-tracker${wardId ? `?ward_id=${wardId}` : ""}`,
      ),

    completeCareViewTask: (taskId: string) =>
      request<{ completed: boolean }>(`/care-view/tasks/${taskId}/complete`, {
        method: "POST",
      }),

    updatePrimaryNurse: (admissionId: string, body: UpdatePrimaryNurseRequest) =>
      request<{ updated: boolean }>(
        `/care-view/admissions/${admissionId}/primary-nurse`,
        { method: "PUT", body: JSON.stringify(body) },
      ),

    // ── Chronic Care / Drug-o-gram ──────────────────────────

    listChronicPrograms: (params?: { program_type?: string; is_active?: boolean; search?: string }) => {
      const sp = new URLSearchParams();
      if (params?.program_type) sp.set("program_type", params.program_type);
      if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
      if (params?.search) sp.set("search", params.search);
      const qs = sp.toString();
      return request<ChronicProgram[]>(`/chronic-care/programs${qs ? `?${qs}` : ""}`);
    },

    createChronicProgram: (data: CreateChronicProgramRequest) =>
      request<ChronicProgram>("/chronic-care/programs", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateChronicProgram: (id: string, data: Partial<CreateChronicProgramRequest> & { is_active?: boolean }) =>
      request<ChronicProgram>(`/chronic-care/programs/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    deleteChronicProgram: (id: string) =>
      request<{ deleted: boolean }>(`/chronic-care/programs/${id}`, {
        method: "DELETE",
      }),

    listChronicEnrollments: (params?: { program_type?: string; status?: string; doctor_id?: string; search?: string }) => {
      const sp = new URLSearchParams();
      if (params?.program_type) sp.set("program_type", params.program_type);
      if (params?.status) sp.set("status", params.status);
      if (params?.doctor_id) sp.set("doctor_id", params.doctor_id);
      if (params?.search) sp.set("search", params.search);
      const qs = sp.toString();
      return request<ChronicEnrollmentRow[]>(`/chronic-care/enrollments${qs ? `?${qs}` : ""}`);
    },

    patientEnrollments: (patientId: string) =>
      request<ChronicEnrollmentRow[]>(`/chronic-care/patients/${patientId}/enrollments`),

    createEnrollment: (data: CreateChronicEnrollmentRequest) =>
      request<{ id: string }>("/chronic-care/enrollments", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateEnrollment: (id: string, data: { primary_doctor_id?: string; expected_end_date?: string; target_overrides?: unknown; notes?: string }) =>
      request<{ updated: boolean }>(`/chronic-care/enrollments/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    updateEnrollmentStatus: (id: string, data: UpdateEnrollmentStatusRequest) =>
      request<{ updated: boolean }>(`/chronic-care/enrollments/${id}/status`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    drugTimeline: (patientId: string, params?: { from_date?: string; to_date?: string; enrollment_id?: string }) => {
      const sp = new URLSearchParams();
      if (params?.from_date) sp.set("from_date", params.from_date);
      if (params?.to_date) sp.set("to_date", params.to_date);
      if (params?.enrollment_id) sp.set("enrollment_id", params.enrollment_id);
      const qs = sp.toString();
      return request<MedicationTimelineEvent[]>(`/chronic-care/patients/${patientId}/drug-timeline${qs ? `?${qs}` : ""}`);
    },

    drugTimelineWithLabs: (patientId: string, params?: { from_date?: string; to_date?: string }) => {
      const sp = new URLSearchParams();
      if (params?.from_date) sp.set("from_date", params.from_date);
      if (params?.to_date) sp.set("to_date", params.to_date);
      const qs = sp.toString();
      return request<DrugTimelineWithLabsResponse>(`/chronic-care/patients/${patientId}/drug-timeline/with-labs${qs ? `?${qs}` : ""}`);
    },

    createTimelineEvent: (data: CreateTimelineEventRequest) =>
      request<{ id: string }>("/chronic-care/timeline-events", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    listAdherence: (enrollmentId: string, params?: { event_type?: string; from_date?: string; to_date?: string }) => {
      const sp = new URLSearchParams();
      if (params?.event_type) sp.set("event_type", params.event_type);
      if (params?.from_date) sp.set("from_date", params.from_date);
      if (params?.to_date) sp.set("to_date", params.to_date);
      const qs = sp.toString();
      return request<AdherenceRow[]>(`/chronic-care/enrollments/${enrollmentId}/adherence${qs ? `?${qs}` : ""}`);
    },

    recordAdherence: (data: RecordAdherenceRequest) =>
      request<{ id: string }>("/chronic-care/adherence", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    adherenceSummary: (enrollmentId: string) =>
      request<AdherenceSummaryResponse>(`/chronic-care/enrollments/${enrollmentId}/adherence-summary`),

    listOutcomeTargets: (patientId: string) =>
      request<PatientOutcomeTarget[]>(`/chronic-care/patients/${patientId}/targets`),

    createOutcomeTarget: (data: CreateOutcomeTargetRequest) =>
      request<{ id: string }>("/chronic-care/targets", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateOutcomeTarget: (id: string, data: UpdateOutcomeTargetRequest) =>
      request<{ updated: boolean }>(`/chronic-care/targets/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    outcomeDashboard: (patientId: string) =>
      request<OutcomeDashboardResponse>(`/chronic-care/patients/${patientId}/outcome-dashboard`),

    listInteractionAlerts: (patientId: string) =>
      request<PolypharmacyInteractionAlert[]>(`/chronic-care/patients/${patientId}/interaction-alerts`),

    checkPolypharmacy: (patientId: string) =>
      request<PolypharmacyInteractionAlert[]>(`/chronic-care/patients/${patientId}/check-interactions`, {
        method: "POST",
      }),

    acknowledgeAlert: (id: string, data: { status: string; override_reason?: string }) =>
      request<{ updated: boolean }>(`/chronic-care/interaction-alerts/${id}/acknowledge`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    treatmentSummary: (patientId: string) =>
      request<TreatmentSummaryResponse>(`/chronic-care/patients/${patientId}/treatment-summary`),

  // ══════════════════════════════════════════════════════════
  //  Retrospective Data Entry
  // ══════════════════════════════════════════════════════════

    getRetroSettings: () =>
      request<RetrospectiveSettings>("/retrospective/settings"),

    updateRetroSettings: (data: Partial<RetrospectiveSettings>) =>
      request<{ updated: boolean }>("/retrospective/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    createRetroEncounter: (data: CreateRetroEncounterRequest) =>
      request<{ encounter_id: string; retrospective_entry_id: string; status: string }>("/retrospective/encounters", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    listRetroEntries: (params?: { status?: string; source_table?: string }) => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set("status", params.status);
      if (params?.source_table) sp.set("source_table", params.source_table);
      const qs = sp.toString();
      return request<RetrospectiveEntry[]>(`/retrospective/entries${qs ? `?${qs}` : ""}`);
    },

    getRetroEntry: (id: string) =>
      request<RetrospectiveEntry>(`/retrospective/entries/${id}`),

    approveRetroEntry: (id: string, data?: ApproveRejectRequest) =>
      request<{ approved: boolean }>(`/retrospective/entries/${id}/approve`, {
        method: "PUT",
        body: JSON.stringify(data ?? {}),
      }),

    rejectRetroEntry: (id: string, data?: ApproveRejectRequest) =>
      request<{ rejected: boolean }>(`/retrospective/entries/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify(data ?? {}),
      }),

    retroAuditTrail: (sourceTable: string, sourceId: string) =>
      request<RetrospectiveEntry[]>(`/retrospective/audit/${sourceTable}/${sourceId}`),

  // ══════════════════════════════════════════════════════════
  //  Occupational Health
  // ══════════════════════════════════════════════════════════

  listOccScreenings: (params?: { employee_id?: string; screening_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.employee_id) sp.set("employee_id", params.employee_id);
    if (params?.screening_type) sp.set("screening_type", params.screening_type);
    const qs = sp.toString();
    return request<OccHealthScreening[]>(`/occ-health/screenings${qs ? `?${qs}` : ""}`);
  },

  createOccScreening: (data: CreateOccScreeningRequest) =>
    request<OccHealthScreening>("/occ-health/screenings", { method: "POST", body: JSON.stringify(data) }),

  listDueScreenings: () =>
    request<OccHealthScreening[]>("/occ-health/screenings/due"),

  getOccScreening: (id: string) =>
    request<OccHealthScreening>(`/occ-health/screenings/${id}`),

  updateOccScreening: (id: string, data: UpdateOccScreeningRequest) =>
    request<OccHealthScreening>(`/occ-health/screenings/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  listDrugScreens: (params?: { employee_id?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.employee_id) sp.set("employee_id", params.employee_id);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<OccHealthDrugScreen[]>(`/occ-health/drug-screens${qs ? `?${qs}` : ""}`);
  },

  createDrugScreen: (data: CreateDrugScreenRequest) =>
    request<OccHealthDrugScreen>("/occ-health/drug-screens", { method: "POST", body: JSON.stringify(data) }),

  updateDrugScreen: (id: string, data: UpdateDrugScreenRequest) =>
    request<OccHealthDrugScreen>(`/occ-health/drug-screens/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  listVaccinations: (params?: { employee_id?: string; vaccine_name?: string }) => {
    const sp = new URLSearchParams();
    if (params?.employee_id) sp.set("employee_id", params.employee_id);
    if (params?.vaccine_name) sp.set("vaccine_name", params.vaccine_name);
    const qs = sp.toString();
    return request<OccHealthVaccination[]>(`/occ-health/vaccinations${qs ? `?${qs}` : ""}`);
  },

  createVaccination: (data: CreateVaccinationRequest) =>
    request<OccHealthVaccination>("/occ-health/vaccinations", { method: "POST", body: JSON.stringify(data) }),

  updateVaccination: (id: string, data: Partial<CreateVaccinationRequest>) =>
    request<OccHealthVaccination>(`/occ-health/vaccinations/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  vaccinationCompliance: () =>
    request<VaccinationComplianceRow[]>("/occ-health/vaccinations/compliance"),

  listInjuries: (params?: { employee_id?: string; rtw_status?: string; is_osha_recordable?: string }) => {
    const sp = new URLSearchParams();
    if (params?.employee_id) sp.set("employee_id", params.employee_id);
    if (params?.rtw_status) sp.set("rtw_status", params.rtw_status);
    if (params?.is_osha_recordable) sp.set("is_osha_recordable", params.is_osha_recordable);
    const qs = sp.toString();
    return request<OccHealthInjuryReport[]>(`/occ-health/injuries${qs ? `?${qs}` : ""}`);
  },

  createInjury: (data: CreateInjuryRequest) =>
    request<OccHealthInjuryReport>("/occ-health/injuries", { method: "POST", body: JSON.stringify(data) }),

  updateInjury: (id: string, data: UpdateInjuryRequest) =>
    request<OccHealthInjuryReport>(`/occ-health/injuries/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  getEmployerView: (id: string) =>
    request<EmployerViewResponse>(`/occ-health/injuries/${id}/employer-view`),

  // ══════════════════════════════════════════════════════════
  //  Utilization Review
  // ══════════════════════════════════════════════════════════

  listUrReviews: (params?: { admission_id?: string; review_type?: string; decision?: string; is_outlier?: string }) => {
    const sp = new URLSearchParams();
    if (params?.admission_id) sp.set("admission_id", params.admission_id);
    if (params?.review_type) sp.set("review_type", params.review_type);
    if (params?.decision) sp.set("decision", params.decision);
    if (params?.is_outlier) sp.set("is_outlier", params.is_outlier);
    const qs = sp.toString();
    return request<UtilizationReview[]>(`/utilization-review/reviews${qs ? `?${qs}` : ""}`);
  },

  createUrReview: (data: CreateUrReviewRequest) =>
    request<UtilizationReview>("/utilization-review/reviews", { method: "POST", body: JSON.stringify(data) }),

  listUrOutliers: () =>
    request<UtilizationReview[]>("/utilization-review/reviews/outliers"),

  getUrReview: (id: string) =>
    request<UtilizationReview>(`/utilization-review/reviews/${id}`),

  updateUrReview: (id: string, data: UpdateUrReviewRequest) =>
    request<UtilizationReview>(`/utilization-review/reviews/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  aiExtractStub: (id: string) =>
    request<{ status: string; message: string }>(`/utilization-review/reviews/${id}/ai-extract`, { method: "POST" }),

  listUrByAdmission: (admissionId: string) =>
    request<UtilizationReview[]>(`/utilization-review/reviews/admission/${admissionId}`),

  listUrCommunications: (params?: { review_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.review_id) sp.set("review_id", params.review_id);
    const qs = sp.toString();
    return request<UrPayerCommunication[]>(`/utilization-review/communications${qs ? `?${qs}` : ""}`);
  },

  createUrCommunication: (data: CreateUrCommunicationRequest) =>
    request<UrPayerCommunication>("/utilization-review/communications", { method: "POST", body: JSON.stringify(data) }),

  updateUrCommunication: (id: string, data: Partial<CreateUrCommunicationRequest>) =>
    request<UrPayerCommunication>(`/utilization-review/communications/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  listUrConversions: (params?: { admission_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.admission_id) sp.set("admission_id", params.admission_id);
    const qs = sp.toString();
    return request<UrStatusConversion[]>(`/utilization-review/conversions${qs ? `?${qs}` : ""}`);
  },

  createUrConversion: (data: CreateUrConversionRequest) =>
    request<UrStatusConversion>("/utilization-review/conversions", { method: "POST", body: JSON.stringify(data) }),

  urAnalyticsSummary: () =>
    request<UrAnalyticsSummary>("/utilization-review/analytics"),

  urLosComparison: () =>
    request<LosComparisonRow[]>("/utilization-review/analytics/los-comparison"),

  // ══════════════════════════════════════════════════════════
  //  Case Management
  // ══════════════════════════════════════════════════════════

  listCaseAssignments: (params?: { case_manager_id?: string; status?: string; priority?: string }) => {
    const sp = new URLSearchParams();
    if (params?.case_manager_id) sp.set("case_manager_id", params.case_manager_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.priority) sp.set("priority", params.priority);
    const qs = sp.toString();
    return request<CaseAssignment[]>(`/case-mgmt/assignments${qs ? `?${qs}` : ""}`);
  },

  createCaseAssignment: (data: CreateCaseAssignmentRequest) =>
    request<CaseAssignment>("/case-mgmt/assignments", { method: "POST", body: JSON.stringify(data) }),

  getCaseAssignment: (id: string) =>
    request<CaseAssignment>(`/case-mgmt/assignments/${id}`),

  updateCaseAssignment: (id: string, data: UpdateCaseAssignmentRequest) =>
    request<CaseAssignment>(`/case-mgmt/assignments/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  caseloadSummary: () =>
    request<CaseloadRow[]>("/case-mgmt/caseload"),

  autoAssignCase: (data: AutoAssignRequest) =>
    request<CaseAssignment>("/case-mgmt/auto-assign", { method: "POST", body: JSON.stringify(data) }),

  listDischargeBarriers: (params?: { case_assignment_id?: string; barrier_type?: string; is_resolved?: string }) => {
    const sp = new URLSearchParams();
    if (params?.case_assignment_id) sp.set("case_assignment_id", params.case_assignment_id);
    if (params?.barrier_type) sp.set("barrier_type", params.barrier_type);
    if (params?.is_resolved) sp.set("is_resolved", params.is_resolved);
    const qs = sp.toString();
    return request<DischargeBarrier[]>(`/case-mgmt/barriers${qs ? `?${qs}` : ""}`);
  },

  createDischargeBarrier: (data: CreateDischargeBarrierRequest) =>
    request<DischargeBarrier>("/case-mgmt/barriers", { method: "POST", body: JSON.stringify(data) }),

  updateDischargeBarrier: (id: string, data: UpdateDischargeBarrierRequest) =>
    request<DischargeBarrier>(`/case-mgmt/barriers/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  listCaseReferrals: (params?: { case_assignment_id?: string; referral_type?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.case_assignment_id) sp.set("case_assignment_id", params.case_assignment_id);
    if (params?.referral_type) sp.set("referral_type", params.referral_type);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<CaseReferral[]>(`/case-mgmt/referrals${qs ? `?${qs}` : ""}`);
  },

  createCaseReferral: (data: CreateCaseReferralRequest) =>
    request<CaseReferral>("/case-mgmt/referrals", { method: "POST", body: JSON.stringify(data) }),

  updateCaseReferral: (id: string, data: UpdateCaseReferralRequest) =>
    request<CaseReferral>(`/case-mgmt/referrals/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  dispositionAnalytics: () =>
    request<DispositionRow[]>("/case-mgmt/analytics/dispositions"),

  barrierAnalytics: () =>
    request<BarrierAnalyticsRow[]>("/case-mgmt/analytics/barriers"),

  outcomeAnalytics: () =>
    request<OutcomeAnalytics>("/case-mgmt/analytics/outcomes"),

  // ══════════════════════════════════════════════════════════
  //  Scheduling / No-Show AI
  // ══════════════════════════════════════════════════════════

  listPredictions: (params?: { patient_id?: string; risk_level?: string; appointment_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.risk_level) sp.set("risk_level", params.risk_level);
    if (params?.appointment_id) sp.set("appointment_id", params.appointment_id);
    const qs = sp.toString();
    return request<NoshowPredictionScore[]>(`/scheduling/predictions${qs ? `?${qs}` : ""}`);
  },

  scoreAppointment: (data: ScoreAppointmentRequest) =>
    request<NoshowPredictionScore>("/scheduling/predictions/score", { method: "POST", body: JSON.stringify(data) }),

  scoreBatch: (data: ScoreBatchRequest) =>
    request<NoshowPredictionScore[]>("/scheduling/predictions/score-batch", { method: "POST", body: JSON.stringify(data) }),

  listWaitlist: (params?: { doctor_id?: string; department_id?: string; status?: string; priority?: string }) => {
    const sp = new URLSearchParams();
    if (params?.doctor_id) sp.set("doctor_id", params.doctor_id);
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.priority) sp.set("priority", params.priority);
    const qs = sp.toString();
    return request<SchedulingWaitlistEntry[]>(`/scheduling/waitlist${qs ? `?${qs}` : ""}`);
  },

  createWaitlistEntry: (data: CreateWaitlistRequest) =>
    request<SchedulingWaitlistEntry>("/scheduling/waitlist", { method: "POST", body: JSON.stringify(data) }),

  updateWaitlistEntry: (id: string, data: UpdateWaitlistRequest) =>
    request<SchedulingWaitlistEntry>(`/scheduling/waitlist/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  offerSlot: (id: string, data: OfferSlotRequest) =>
    request<SchedulingWaitlistEntry>(`/scheduling/waitlist/${id}/offer`, { method: "POST", body: JSON.stringify(data) }),

  respondToOffer: (id: string, data: RespondToOfferRequest) =>
    request<SchedulingWaitlistEntry>(`/scheduling/waitlist/${id}/respond`, { method: "POST", body: JSON.stringify(data) }),

  autoFillSlots: () =>
    request<AutoFillResult>("/scheduling/auto-fill", { method: "POST" }),

  listOverbookingRules: (params?: { doctor_id?: string; department_id?: string; is_active?: string }) => {
    const sp = new URLSearchParams();
    if (params?.doctor_id) sp.set("doctor_id", params.doctor_id);
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.is_active) sp.set("is_active", params.is_active);
    const qs = sp.toString();
    return request<SchedulingOverbookingRule[]>(`/scheduling/overbooking-rules${qs ? `?${qs}` : ""}`);
  },

  createOverbookingRule: (data: CreateOverbookingRuleRequest) =>
    request<SchedulingOverbookingRule>("/scheduling/overbooking-rules", { method: "POST", body: JSON.stringify(data) }),

  updateOverbookingRule: (id: string, data: UpdateOverbookingRuleRequest) =>
    request<SchedulingOverbookingRule>(`/scheduling/overbooking-rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteOverbookingRule: (id: string) =>
    request<void>(`/scheduling/overbooking-rules/${id}`, { method: "DELETE" }),

  getOverbookingRecommendation: (params: { doctor_id: string; department_id: string; date: string }) => {
    const sp = new URLSearchParams();
    sp.set("doctor_id", params.doctor_id);
    sp.set("department_id", params.department_id);
    sp.set("date", params.date);
    return request<OverbookingRecommendation>(`/scheduling/overbooking/recommendation?${sp.toString()}`);
  },

  noshowRates: () =>
    request<NoshowRateRow[]>("/scheduling/analytics/noshow-rates"),

  predictionAccuracy: () =>
    request<PredictionAccuracyReport>("/scheduling/analytics/prediction-accuracy"),

  waitlistStats: () =>
    request<WaitlistStatsResponse>("/scheduling/analytics/waitlist-stats"),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Infection Control Analytics
  // ══════════════════════════════════════════════════════════

  icHaiRates: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<HaiRateRow[]>(`/infection-control/analytics/hai-rates${qs ? `?${qs}` : ""}`);
  },

  icDeviceUtilization: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<DeviceUtilizationRow[]>(`/infection-control/analytics/device-utilization${qs ? `?${qs}` : ""}`);
  },

  icAntimicrobialConsumption: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<AntimicrobialConsumptionRow[]>(`/infection-control/analytics/antimicrobial-consumption${qs ? `?${qs}` : ""}`);
  },

  icSurgicalProphylaxis: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<SurgicalProphylaxisRow[]>(`/infection-control/analytics/surgical-prophylaxis${qs ? `?${qs}` : ""}`);
  },

  icCultureSensitivityReport: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<CultureSensitivityRow[]>(`/infection-control/reports/culture-sensitivity${qs ? `?${qs}` : ""}`);
  },

  icMdroTracking: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<MdroRow[]>(`/infection-control/analytics/mdro${qs ? `?${qs}` : ""}`);
  },

  createIcExposure: (data: CreateExposureRequest) =>
    request<InfectionSurveillanceEvent>("/infection-control/exposures", { method: "POST", body: JSON.stringify(data) }),

  listIcMeetings: () =>
    request<IcMeeting[]>("/infection-control/meetings"),

  createIcMeeting: (data: CreateIcMeetingRequest) =>
    request<IcMeeting>("/infection-control/meetings", { method: "POST", body: JSON.stringify(data) }),

  icMonthlySurveillance: (params?: { month?: string }) => {
    const sp = new URLSearchParams();
    if (params?.month) sp.set("month", params.month);
    const qs = sp.toString();
    return request<MonthlySurveillanceReport>(`/infection-control/reports/monthly${qs ? `?${qs}` : ""}`);
  },

  createOutbreakRca: (outbreakId: string, data: CreateOutbreakRcaRequest) =>
    request<{ success: true }>(`/infection-control/outbreaks/${outbreakId}/rca`, { method: "POST", body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Quality Analytics
  // ══════════════════════════════════════════════════════════

  scheduleAudits: (data: ScheduleAuditsRequest) =>
    request<{ count: number }>("/quality/audits/schedule", { method: "POST", body: JSON.stringify(data) }),

  listAuditFindings: (auditId: string) =>
    request<AuditFinding[]>(`/quality/audits/${auditId}/findings`),

  createAuditFinding: (auditId: string, data: CreateAuditFindingRequest) =>
    request<AuditFinding>(`/quality/audits/${auditId}/findings`, { method: "POST", body: JSON.stringify(data) }),

  listOverdueCapas: () =>
    request<QualityCapa[]>("/quality/capas/overdue"),

  committeeDashboard: () =>
    request<CommitteeDashboard>("/quality/committees/dashboard"),

  createMortalityReview: (data: CreateMortalityReviewRequest) =>
    request<QualityIncident>("/quality/mortality-reviews", { method: "POST", body: JSON.stringify(data) }),

  listSentinelEvents: () =>
    request<QualityIncident[]>("/quality/incidents/sentinel"),

  patientSafetyIndicators: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<PatientSafetyIndicator[]>(`/quality/analytics/psi${qs ? `?${qs}` : ""}`);
  },

  departmentScorecard: () =>
    request<DepartmentScorecard[]>("/quality/analytics/scorecard"),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Regulatory
  // ══════════════════════════════════════════════════════════

  autoPopulateChecklist: (checklistId: string, data?: AutoPopulateRequest) =>
    request<{ updated: number }>(`/regulatory/checklists/${checklistId}/auto-populate`, { method: "POST", body: JSON.stringify(data ?? {}) }),

  listRegulatorySubmissions: () =>
    request<RegulatorySubmission[]>("/regulatory/submissions"),

  createRegulatorySubmission: (data: CreateRegulatorySubmissionRequest) =>
    request<RegulatorySubmission>("/regulatory/submissions", { method: "POST", body: JSON.stringify(data) }),

  listMockSurveys: () =>
    request<ComplianceChecklist[]>("/regulatory/mock-surveys"),

  createMockSurvey: (data: CreateChecklistRequest) =>
    request<ComplianceChecklist>("/regulatory/mock-surveys", { method: "POST", body: JSON.stringify(data) }),

  staffCredentials: () =>
    request<StaffCredentialSummary[]>("/regulatory/staff-credentials"),

  licenseDashboard: () =>
    request<LicenseDashboardItem[]>("/regulatory/licenses/dashboard"),

  nablDocumentTracking: () =>
    request<NablDocumentSummary[]>("/regulatory/nabl/documents"),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Setup
  // ══════════════════════════════════════════════════════════

  bulkCreateUsers: (data: BulkCreateUsersRequest) =>
    request<{ created: number }>("/setup/users/bulk", { method: "POST", body: JSON.stringify(data) }),

  seedDepartmentTemplate: () =>
    request<{ created: number }>("/setup/departments/template", { method: "POST" }),

  completenessCheck: () =>
    request<CompletenessCheck>("/setup/completeness"),

  systemHealth: () =>
    request<SystemHealth>("/setup/health"),

  exportConfig: () =>
    request<Record<string, unknown>>("/setup/config/export"),

  importConfig: (data: Record<string, unknown>) =>
    request<{ success: true }>("/setup/config/import", { method: "POST", body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Scheduling (extended)
  // ══════════════════════════════════════════════════════════

  schedulingConflicts: () =>
    request<SchedulingConflict[]>("/scheduling/conflicts"),

  promoteWaitlist: (data: { slot_id: string }) =>
    request<{ promoted: boolean }>("/scheduling/waitlist/promote", { method: "POST", body: JSON.stringify(data) }),

  scheduleAnalytics: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<ScheduleAnalytics>(`/scheduling/analytics/overview${qs ? `?${qs}` : ""}`);
  },

  createRecurringAppointment: (data: CreateRecurringRequest) =>
    request<{ created: number }>("/scheduling/recurring", { method: "POST", body: JSON.stringify(data) }),

  createScheduleBlock: (data: CreateBlockRequest) =>
    request<{ success: true }>("/scheduling/blocks", { method: "POST", body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Occupational Health (extended)
  // ══════════════════════════════════════════════════════════

  listOccHealthHazards: () =>
    request<OccHealthHazard[]>("/occ-health/hazards"),

  createOccHealthHazard: (data: CreateOccHealthHazardRequest) =>
    request<OccHealthHazard>("/occ-health/hazards", { method: "POST", body: JSON.stringify(data) }),

  occHealthAnalytics: () =>
    request<OccHealthAnalytics>("/occ-health/analytics"),

  returnToWorkClearance: (data: ReturnToWorkClearanceRequest) =>
    request<OccHealthScreening>("/occ-health/clearance", { method: "POST", body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — OPD (extended)
  // ══════════════════════════════════════════════════════════

  opdPharmacyDispatchStatus: (visitId: string) =>
    request<PharmacyDispatchStatus[]>(`/opd/visits/${visitId}/pharmacy-status`),

  opdReferralTracking: (params?: { status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<ReferralTrackingRow[]>(`/opd/referrals/tracking${qs ? `?${qs}` : ""}`);
  },

  opdFollowupCompliance: () =>
    request<FollowupComplianceRow[]>("/opd/analytics/followup"),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — IPD (extended)
  // ══════════════════════════════════════════════════════════

  generateDischargeSummary: (admissionId: string) =>
    request<DischargeSummary>(`/ipd/admissions/${admissionId}/discharge-summary`, { method: "POST" }),

  bedTransfer: (admissionId: string, data: BedTransferRequest) =>
    request<{ success: true }>(`/ipd/admissions/${admissionId}/transfer`, { method: "POST", body: JSON.stringify(data) }),

  expectedDischarges: (params?: { hours?: number }) => {
    const sp = new URLSearchParams();
    if (params?.hours != null) sp.set("hours", String(params.hours));
    const qs = sp.toString();
    return request<ExpectedDischargeRow[]>(`/ipd/discharges/expected${qs ? `?${qs}` : ""}`);
  },

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Pharmacy (extended)
  // ══════════════════════════════════════════════════════════

  checkDrugInteractions: (data: DrugInteractionCheckRequest) =>
    request<DrugInteractionResult[]>("/pharmacy/interactions/check", { method: "POST", body: JSON.stringify(data) }),

  prescriptionAudit: (prescriptionId: string) =>
    request<PrescriptionAuditEntry[]>(`/pharmacy/prescriptions/${prescriptionId}/audit`),

  formularyCheck: (data: { drug_id: string }) =>
    request<FormularyCheckResult>("/pharmacy/formulary/check", { method: "POST", body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Billing (extended)
  // ══════════════════════════════════════════════════════════

  listBillingPackages: () =>
    request<BillingServicePackage[]>("/billing/packages"),

  createBillingPackage: (data: CreateBillingServicePackageRequest) =>
    request<BillingServicePackage>("/billing/packages", { method: "POST", body: JSON.stringify(data) }),

  calculateCopay: (data: { invoice_id: string }) =>
    request<CopayCalculation>("/billing/copay/calculate", { method: "POST", body: JSON.stringify(data) }),

  erFastInvoice: (data: ErFastInvoiceRequest) =>
    request<Invoice>("/billing/er-invoice", { method: "POST", body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Camp (extended)
  // ══════════════════════════════════════════════════════════

  campAnalytics: () =>
    request<CampAnalytics>("/camp/analytics"),

  campReport: (campId: string) =>
    request<CampReport>(`/camp/camps/${campId}/report`),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Facilities (extended)
  // ══════════════════════════════════════════════════════════

  schedulePm: (data: SchedulePmRequest) =>
    request<{ created: number }>("/facilities/pm/schedule", { method: "POST", body: JSON.stringify(data) }),

  energyAnalytics: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<EnergyAnalytics>(`/facilities/energy/analytics${qs ? `?${qs}` : ""}`);
  },

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Front Office (extended)
  // ══════════════════════════════════════════════════════════

  visitorAnalytics: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<VisitorAnalytics>(`/front-office/analytics${qs ? `?${qs}` : ""}`);
  },

  queueMetrics: () =>
    request<QueueMetrics[]>("/front-office/queue/metrics"),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — HR (extended)
  // ══════════════════════════════════════════════════════════

  trainingCompliance: () =>
    request<TrainingComplianceRow[]>("/hr/training/compliance"),

  // ══════════════════════════════════════════════════════════
  //  Command Center
  // ══════════════════════════════════════════════════════════

  // Patient Flow
  getPatientFlow: () =>
    request<PatientFlowSnapshot>("/command-center/patient-flow"),

  getHourlyFlow: () =>
    request<HourlyFlowRow[]>("/command-center/patient-flow/hourly"),

  getBottlenecks: () =>
    request<BottleneckRow[]>("/command-center/bottlenecks"),

  // Department Load
  getDepartmentLoad: () =>
    request<DepartmentLoadRow[]>("/command-center/department-load"),

  getActiveAlerts: () =>
    request<DepartmentAlertRow[]>("/command-center/alerts"),

  acknowledgeDeptAlert: (id: string) =>
    request<DepartmentAlertRow>(`/command-center/alerts/${id}/acknowledge`, { method: "POST" }),

  listAlertThresholds: () =>
    request<AlertThresholdRow[]>("/command-center/alert-thresholds"),

  createAlertThreshold: (data: CreateAlertThresholdRequest) =>
    request<AlertThresholdRow>("/command-center/alert-thresholds", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAlertThreshold: (id: string, data: UpdateAlertThresholdRequest) =>
    request<AlertThresholdRow>(`/command-center/alert-thresholds/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Discharge Coordinator
  listPendingDischarges: () =>
    request<PendingDischargeRow[]>("/command-center/pending-discharges"),

  getDischargeBlockers: (admissionId: string) =>
    request<Record<string, unknown>>(`/command-center/discharge-blockers/${admissionId}`),

  // Environmental Services
  getBedTurnaround: () =>
    request<BedTurnaroundRow[]>("/command-center/bed-turnaround"),

  getTurnaroundStats: () =>
    request<TurnaroundStatsRow[]>("/command-center/bed-turnaround/stats"),

  // Transport
  listTransportRequests: () =>
    request<TransportRequestRow[]>("/command-center/transport"),

  createTransportRequest: (data: CreateTransportRequest) =>
    request<TransportRequestRow>("/command-center/transport", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTransportRequest: (id: string, data: UpdateTransportRequest) =>
    request<TransportRequestRow>(`/command-center/transport/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  assignTransport: (id: string, data: AssignTransportRequest) =>
    request<TransportRequestRow>(`/command-center/transport/${id}/assign`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  completeTransport: (id: string) =>
    request<TransportRequestRow>(`/command-center/transport/${id}/complete`, {
      method: "PUT",
    }),

  // KPIs
  getKpis: () =>
    request<KpiTile[]>("/command-center/kpis"),

  getKpiDetail: (code: string) =>
    request<Record<string, unknown>>(`/command-center/kpis/${code}`),

  // ══════════════════════════════════════════════════════════
  //  Audit Trail
  // ══════════════════════════════════════════════════════════

  listAuditLog: (params?: AuditLogQuery) => {
    const sp = new URLSearchParams();
    if (params?.module) sp.set("module", params.module);
    if (params?.entity_type) sp.set("entity_type", params.entity_type);
    if (params?.entity_id) sp.set("entity_id", params.entity_id);
    if (params?.user_id) sp.set("user_id", params.user_id);
    if (params?.action) sp.set("action", params.action);
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<AuditLogSummary[]>(`/audit/log${qs ? `?${qs}` : ""}`);
  },

  getAuditEntry: (id: string) =>
    request<AuditLogEntry>(`/audit/log/${id}`),

  getEntityAuditTrail: (entityType: string, entityId: string) =>
    request<AuditLogEntry[]>(`/audit/log/entity/${entityType}/${entityId}`),

  getAuditStats: () =>
    request<AuditStats>("/audit/stats"),

  listAccessLog: (params?: AccessLogQuery) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.user_id) sp.set("user_id", params.user_id);
    if (params?.entity_type) sp.set("entity_type", params.entity_type);
    if (params?.module) sp.set("module", params.module);
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<AccessLogEntry[]>(`/audit/access-log${qs ? `?${qs}` : ""}`);
  },

  logAccess: (data: LogAccessRequest) =>
    request<{ ok: boolean }>("/audit/access-log", { method: "POST", body: JSON.stringify(data) }),

  getPatientAccessLog: (patientId: string) =>
    request<AccessLogEntry[]>(`/audit/access-log/patient/${patientId}`),

  listAuditModules: () =>
    request<string[]>("/audit/modules"),

  listAuditEntityTypes: () =>
    request<string[]>("/audit/entity-types"),

  exportAuditLog: (params?: AuditLogQuery) => {
    const sp = new URLSearchParams();
    if (params?.module) sp.set("module", params.module);
    if (params?.entity_type) sp.set("entity_type", params.entity_type);
    if (params?.entity_id) sp.set("entity_id", params.entity_id);
    if (params?.user_id) sp.set("user_id", params.user_id);
    if (params?.action) sp.set("action", params.action);
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<string>(`/audit/export${qs ? `?${qs}` : ""}`);
  },

  getUserActivity: (userId: string) =>
    request<AuditLogSummary[]>(`/audit/user/${userId}/activity`),

  getEntityTimeline: (entityType: string, entityId: string) =>
    request<AuditLogEntry[]>(`/audit/timeline/${entityType}/${entityId}`),

  // ══════════════════════════════════════════════════════════
  //  Analytics & Dashboards
  // ══════════════════════════════════════════════════════════

  getDeptRevenue: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<DeptRevenueRow[]>(`/analytics/revenue/department${qs ? `?${qs}` : ""}`);
  },

  getDoctorRevenue: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<AnalyticsDoctorRevenueRow[]>(`/analytics/revenue/doctor${qs ? `?${qs}` : ""}`);
  },

  getIpdCensus: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<IpdCensusRow[]>(`/analytics/ipd/census${qs ? `?${qs}` : ""}`);
  },

  getLabTat: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<LabTatRow[]>(`/analytics/lab/tat${qs ? `?${qs}` : ""}`);
  },

  getPharmacySales: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<PharmacySalesRow[]>(`/analytics/pharmacy/sales${qs ? `?${qs}` : ""}`);
  },

  getOtUtilization: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<OtUtilizationRow[]>(`/analytics/ot/utilization${qs ? `?${qs}` : ""}`);
  },

  getErVolume: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<ErVolumeRow[]>(`/analytics/er/volume${qs ? `?${qs}` : ""}`);
  },

  getClinicalIndicators: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<ClinicalIndicatorRow[]>(`/analytics/clinical/indicators${qs ? `?${qs}` : ""}`);
  },

  getOpdFootfall: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<OpdFootfallRow[]>(`/analytics/opd/footfall${qs ? `?${qs}` : ""}`);
  },

  getBedOccupancy: () =>
    request<BedOccupancyRow[]>("/analytics/bed/occupancy"),

  exportAnalytics: (params: { report: string; from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    sp.set("report", params.report);
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    return request<string>(`/analytics/export?${sp.toString()}`);
  },

  // ══════════════════════════════════════════════════════════
  //  Print Data
  // ══════════════════════════════════════════════════════════

  getPrescriptionPrintData: (encounterId: string) =>
    request<PrescriptionPrintData>(`/print-data/prescription/${encounterId}`),

  getLabReportPrintData: (orderId: string) =>
    request<LabReportPrintData>(`/print-data/lab-report/${orderId}`),

  getRadiologyPrintData: (orderId: string) =>
    request<RadiologyReportPrintData>(`/print-data/radiology-report/${orderId}`),

  getPatientCardPrintData: (patientId: string) =>
    request<PatientCardPrintData>(`/print-data/patient-card/${patientId}`),

  getWristbandPrintData: (admissionId: string) =>
    request<WristbandPrintData>(`/print-data/wristband/${admissionId}`),

  getDeathCertPrintData: (admissionId: string) =>
    request<DeathCertificatePrintData>(`/print-data/death-certificate/${admissionId}`),

  getDischargePrintData: (admissionId: string) =>
    request<DischargeSummaryPrintData>(`/print-data/discharge/${admissionId}`),

  getReceiptPrintData: (paymentId: string) =>
    request<ReceiptPrintData>(`/print-data/receipt/${paymentId}`),

  getEstimatePrintData: (invoiceId: string) =>
    request<EstimatePrintData>(`/print-data/estimate/${invoiceId}`),

  getCreditNotePrintData: (id: string) =>
    request<CreditNotePrintData>(`/print-data/credit-note/${id}`),

  getTdsCertPrintData: (id: string) =>
    request<TdsCertificatePrintData>(`/print-data/tds-certificate/${id}`),

  getGstInvoicePrintData: (invoiceId: string) =>
    request<GstInvoicePrintData>(`/print-data/gst-invoice/${invoiceId}`),

  // ── Consent Form Print Data ─────────────────────────────

  getGeneralConsentPrintData: (admissionId: string) =>
    request<ConsentPrintData>(`/print-data/consent/general/${admissionId}`),

  getSurgicalConsentPrintData: (bookingId: string) =>
    request<ConsentPrintData>(`/print-data/consent/surgical/${bookingId}`),

  getAnesthesiaConsentPrintData: (bookingId: string) =>
    request<ConsentPrintData>(`/print-data/consent/anesthesia/${bookingId}`),

  getBloodConsentPrintData: (admissionId: string) =>
    request<ConsentPrintData>(`/print-data/consent/blood/${admissionId}`),

  getHivConsentPrintData: (patientId: string) =>
    request<ConsentPrintData>(`/print-data/consent/hiv/${patientId}`),

  getAmaConsentPrintData: (admissionId: string) =>
    request<ConsentPrintData>(`/print-data/consent/ama/${admissionId}`),

  getPhotoConsentPrintData: (patientId: string) =>
    request<ConsentPrintData>(`/print-data/consent/photo/${patientId}`),

  // ── MRD Form Print Data ─────────────────────────────────

  getProgressNotePrintData: (admissionId: string) =>
    request<ProgressNotePrintData>(`/print-data/mrd/progress-note/${admissionId}`),

  getNursingAssessmentPrintData: (admissionId: string) =>
    request<NursingAssessmentPrintData>(`/print-data/mrd/nursing-assessment/${admissionId}`),

  getMarPrintData: (admissionId: string) =>
    request<MarPrintData>(`/print-data/mrd/mar/${admissionId}`),

  getVitalsChartPrintData: (admissionId: string) =>
    request<VitalsChartPrintData>(`/print-data/mrd/vitals-chart/${admissionId}`),

  getIoChartPrintData: (admissionId: string) =>
    request<IoChartPrintData>(`/print-data/mrd/io-chart/${admissionId}`),

  getDischargeChecklistPrintData: (admissionId: string) =>
    request<DischargeChecklistPrintData>(`/print-data/mrd/discharge-checklist/${admissionId}`),

  // ── Token Slip & Visitor Pass ───────────────────────────

  getTokenSlipPrintData: (tokenId: string) =>
    request<TokenSlipPrintData>(`/print-data/token-slip/${tokenId}`),

  getVisitorPassPrintData: (passId: string) =>
    request<VisitorPassPrintData>(`/print-data/visitor-pass/${passId}`),

  // ── Phase 2: Billing Print Data ────────────────────────────

  getOpdBillPrintData: (invoiceId: string) =>
    request<OpdBillPrintData>(`/print-data/opd-bill/${invoiceId}`),

  getIpdInterimBillPrintData: (admissionId: string) =>
    request<IpdInterimBillPrintData>(`/print-data/ipd-interim-bill/${admissionId}`),

  getIpdFinalBillPrintData: (invoiceId: string) =>
    request<IpdFinalBillPrintData>(`/print-data/ipd-final-bill/${invoiceId}`),

  getAdvanceReceiptPrintData: (paymentId: string) =>
    request<AdvanceReceiptPrintData>(`/print-data/advance-receipt/${paymentId}`),

  getRefundReceiptPrintData: (refundId: string) =>
    request<RefundReceiptPrintData>(`/print-data/refund-receipt/${refundId}`),

  getInsurancePreauthPrintData: (requestId: string) =>
    request<InsurancePreauthPrintData>(`/print-data/insurance-preauth/${requestId}`),

  getCashlessClaimPrintData: (claimId: string) =>
    request<CashlessClaimPrintData>(`/print-data/cashless-claim/${claimId}`),

  getPackageEstimatePrintData: (packageId: string) =>
    request<PackageEstimatePrintData>(`/print-data/package-estimate/${packageId}`),

  // ── Phase 2: Lab & Blood Bank Report Print Data ────────────

  getCultureSensitivityPrintData: (orderId: string) =>
    request<CultureSensitivityPrintData>(`/print-data/culture-sensitivity/${orderId}`),

  getHistopathReportPrintData: (orderId: string) =>
    request<HistopathReportPrintData>(`/print-data/histopath-report/${orderId}`),

  getCrossmatchReportPrintData: (requestId: string) =>
    request<CrossmatchReportPrintData>(`/print-data/crossmatch-report/${requestId}`),

  getComponentSlipPrintData: (issueId: string) =>
    request<ComponentSlipPrintData>(`/print-data/component-slip/${issueId}`),

  getInvestigationRequisitionPrintData: (orderId: string) =>
    request<InvestigationRequisitionPrintData>(`/print-data/investigation-requisition/${orderId}`),

  // ── Phase 2: Additional Consent Print Data ─────────────────

  getDnrConsentPrintData: (admissionId: string) =>
    request<DnrConsentPrintData>(`/print-data/consent/dnr/${admissionId}`),

  getOrganDonationConsentPrintData: (patientId: string) =>
    request<OrganDonationConsentPrintData>(`/print-data/consent/organ-donation/${patientId}`),

  getResearchConsentPrintData: (enrollmentId: string) =>
    request<ResearchConsentPrintData>(`/print-data/consent/research/${enrollmentId}`),

  getAbdmConsentPrintData: (patientId: string) =>
    request<AbdmConsentPrintData>(`/print-data/consent/abdm/${patientId}`),

  getTeachingConsentPrintData: (admissionId: string) =>
    request<TeachingConsentPrintData>(`/print-data/consent/teaching/${admissionId}`),

  // ── Phase 2: Clinical & Identity Print Data ────────────────

  getTreatmentChartPrintData: (admissionId: string) =>
    request<TreatmentChartPrintData>(`/print-data/treatment-chart/${admissionId}`),

  getTransferSummaryPrintData: (transferId: string) =>
    request<TransferSummaryPrintData>(`/print-data/transfer-summary/${transferId}`),

  getPatientEducationPrintData: (materialId: string) =>
    request<PatientEducationPrintData>(`/print-data/patient-education/${materialId}`),

  getRegistrationCardPrintData: (patientId: string) =>
    request<RegistrationCardPrintData>(`/print-data/registration-card/${patientId}`),

  getInfantWristbandPrintData: (newbornId: string) =>
    request<InfantWristbandPrintData>(`/print-data/infant-wristband/${newbornId}`),

  // ── Phase 3: Surgical & OT Print Data ──
  getCaseSheetCoverPrintData: (admissionId: string) =>
    request<CaseSheetCoverPrintData>(`/print-data/case-sheet-cover/${admissionId}`),

  getPreopAssessmentPrintData: (admissionId: string) =>
    request<PreopAssessmentPrintData>(`/print-data/preop-assessment/${admissionId}`),

  getSurgicalSafetyChecklistPrintData: (surgeryId: string) =>
    request<SurgicalSafetyChecklistPrintData>(`/print-data/surgical-safety-checklist/${surgeryId}`),

  getAnesthesiaRecordPrintData: (surgeryId: string) =>
    request<AnesthesiaRecordPrintData>(`/print-data/anesthesia-record/${surgeryId}`),

  getOperationNotesPrintData: (surgeryId: string) =>
    request<OperationNotesPrintData>(`/print-data/operation-notes/${surgeryId}`),

  getPostopOrdersPrintData: (surgeryId: string) =>
    request<PostopOrdersPrintData>(`/print-data/postop-orders/${surgeryId}`),

  getTransfusionMonitoringPrintData: (transfusionId: string) =>
    request<TransfusionMonitoringPrintData>(`/print-data/transfusion-monitoring/${transfusionId}`),

  // ── Phase 3: Clinical Charts Print Data ──
  getFluidBalanceChartPrintData: (admissionId: string) =>
    request<FluidBalanceChartPrintData>(`/print-data/fluid-balance-chart/${admissionId}`),

  getPainAssessmentPrintData: (admissionId: string) =>
    request<PainAssessmentPrintData>(`/print-data/pain-assessment/${admissionId}`),

  getFallRiskAssessmentPrintData: (admissionId: string) =>
    request<FallRiskAssessmentPrintData>(`/print-data/fall-risk-assessment/${admissionId}`),

  getPressureUlcerRiskPrintData: (admissionId: string) =>
    request<PressureUlcerRiskPrintData>(`/print-data/pressure-ulcer-risk/${admissionId}`),

  getGcsChartPrintData: (admissionId: string) =>
    request<GcsChartPrintData>(`/print-data/gcs-chart/${admissionId}`),

  getTransfusionRequisitionPrintData: (requestId: string) =>
    request<TransfusionRequisitionPrintData>(`/print-data/transfusion-requisition/${requestId}`),

  // ── Phase 3: Medico-Legal Print Data ──
  getAmaFormPrintData: (admissionId: string) =>
    request<AmaFormPrintData>(`/print-data/ama-form/${admissionId}`),

  getMlcRegisterPrintData: (caseId: string) =>
    request<MlcRegisterPrintData>(`/print-data/mlc-register/${caseId}`),

  getWoundCertificatePrintData: (caseId: string) =>
    request<WoundCertificatePrintData>(`/print-data/wound-certificate/${caseId}`),

  getAgeEstimationPrintData: (caseId: string) =>
    request<AgeEstimationPrintData>(`/print-data/age-estimation/${caseId}`),

  getDeathDeclarationPrintData: (patientId: string) =>
    request<DeathDeclarationPrintData>(`/print-data/death-declaration/${patientId}`),

  getMlcDocumentationPrintData: (caseId: string) =>
    request<MlcDocumentationPrintData>(`/print-data/mlc-documentation/${caseId}`),

  // ── Phase 3: Quality & Safety Print Data ──
  getIncidentReportPrintData: (incidentId: string) =>
    request<IncidentReportPrintData>(`/print-data/incident-report/${incidentId}`),

  getRcaTemplatePrintData: (incidentId: string) =>
    request<RcaTemplatePrintData>(`/print-data/rca-template/${incidentId}`),

  getCapaFormPrintData: (capaId: string) =>
    request<CapaFormPrintData>(`/print-data/capa-form/${capaId}`),

  getAdrReportPrintData: (reportId: string) =>
    request<AdrReportPrintData>(`/print-data/adr-report/${reportId}`),

  getTransfusionReactionPrintData: (reactionId: string) =>
    request<TransfusionReactionPrintData>(`/print-data/transfusion-reaction/${reactionId}`),

  // ── Phase 4: Clinical Delivery Print Data ─────────────────
  getOpdPrescriptionPrintData: (encounterId: string) =>
    request<OpdPrescriptionPrintData>(`/print-data/opd-prescription/${encounterId}`),

  getLabReportFullPrintData: (orderId: string) =>
    request<LabReportFullPrintData>(`/print-data/lab-report-full/${orderId}`),

  getCumulativeLabReportPrintData: (patientId: string) =>
    request<CumulativeLabReportPrintData>(`/print-data/cumulative-lab-report/${patientId}`),

  getRadiologyReportFullPrintData: (orderId: string) =>
    request<RadiologyReportFullPrintData>(`/print-data/radiology-report-full/${orderId}`),

  getDeathCertificateFullPrintData: (patientId: string) =>
    request<DeathCertificatePrintData>(`/print-data/death-certificate/${patientId}`),

  // ── Phase 4: Billing Print Data ───────────────────────────
  getCreditNoteFullPrintData: (creditNoteId: string) =>
    request<CreditNotePrintData>(`/print-data/credit-note/${creditNoteId}`),

  getPackageBillPrintData: (packageId: string) =>
    request<PackageBillPrintData>(`/print-data/package-bill/${packageId}`),

  getInsuranceClaimPrintData: (claimId: string) =>
    request<InsuranceClaimPrintData>(`/print-data/insurance-claim/${claimId}`),

  getTdsCertificateFullPrintData: (tdsId: string) =>
    request<TdsCertificatePrintData>(`/print-data/tds-certificate/${tdsId}`),

  // ── Phase 4: Regulatory Print Data ────────────────────────
  getNabhQualityReportPrintData: (period: string) =>
    request<NabhQualityReportPrintData>(`/print-data/nabh-quality-report/${period}`),

  getNmcComplianceReportPrintData: (period: string) =>
    request<NmcComplianceReportPrintData>(`/print-data/nmc-compliance-report/${period}`),

  getNablQualityReportPrintData: (period: string) =>
    request<NablQualityReportPrintData>(`/print-data/nabl-quality-report/${period}`),

  getSpcbBmwReturnsPrintData: (quarter: string) =>
    request<SpcbBmwReturnsPrintData>(`/print-data/spcb-bmw-returns/${quarter}`),

  getPesoCompliancePrintData: (year: string) =>
    request<PesoComplianceReportPrintData>(`/print-data/peso-compliance/${year}`),

  getDrugLicenseReportPrintData: (licenseId: string) =>
    request<DrugLicenseReportPrintData>(`/print-data/drug-license-report/${licenseId}`),

  getPcpndtReportPrintData: (period: string) =>
    request<PcpndtReportPrintData>(`/print-data/pcpndt-report/${period}`),

  getBirthRegisterPrintData: (period: string) =>
    request<BirthRegisterPrintData>(`/print-data/birth-register/${period}`),

  getDeathRegisterPrintData: (period: string) =>
    request<DeathRegisterPrintData>(`/print-data/death-register/${period}`),

  getMlcRegisterSummaryPrintData: (period: string) =>
    request<MlcRegisterSummaryPrintData>(`/print-data/mlc-register-summary/${period}`),

  getAebasAttendancePrintData: (period: string) =>
    request<AebasAttendanceReportPrintData>(`/print-data/aebas-attendance/${period}`),

  getNmcNarfAssessmentPrintData: (year: string) =>
    request<NmcNarfAssessmentPrintData>(`/print-data/nmc-narf-assessment/${year}`),

  // ── Phase 4: Admin & Procurement Print Data ───────────────
  getIndentFormPrintData: (indentId: string) =>
    request<IndentFormPrintData>(`/print-data/indent-form/${indentId}`),

  getPurchaseOrderPrintData: (poId: string) =>
    request<PurchaseOrderPrintData>(`/print-data/purchase-order/${poId}`),

  getGrnPrintData: (grnId: string) =>
    request<GrnPrintData>(`/print-data/grn/${grnId}`),

  getMaterialIssueVoucherPrintData: (voucherId: string) =>
    request<MaterialIssueVoucherPrintData>(`/print-data/material-issue-voucher/${voucherId}`),

  getStockTransferNotePrintData: (transferId: string) =>
    request<StockTransferNotePrintData>(`/print-data/stock-transfer-note/${transferId}`),

  getNdpsRegisterPrintData: (period: string) =>
    request<NdpsRegisterPrintData>(`/print-data/ndps-register/${period}`),

  getDrugExpiryAlertPrintData: (storeId: string) =>
    request<DrugExpiryAlertPrintData>(`/print-data/drug-expiry-alert/${storeId}`),

  getEquipmentCondemnationPrintData: (condemnationId: string) =>
    request<EquipmentCondemnationPrintData>(`/print-data/equipment-condemnation/${condemnationId}`),

  getWorkOrderPrintData: (workOrderId: string) =>
    request<WorkOrderPrintData>(`/print-data/work-order/${workOrderId}`),

  getPmChecklistPrintData: (pmId: string) =>
    request<PmChecklistPrintData>(`/print-data/pm-checklist/${pmId}`),

  // ══════════════════════════════════════════════════════════
  //  Phase 5: Admin/HR, BME, Blood Bank, OT, Clinical Print Data
  // ══════════════════════════════════════════════════════════

  // ── Admin/HR Forms ──────────────────────────────────────────
  getEmployeeIdCardPrintData: (employeeId: string) =>
    request<EmployeeIdCardPrintData>(`/print-data/employee-id-card/${employeeId}`),

  getDutyRosterPrintData: (departmentId: string, period: string) =>
    request<DutyRosterPrintData>(`/print-data/duty-roster/${departmentId}/${period}`),

  getLeaveApplicationPrintData: (leaveId: string) =>
    request<LeaveApplicationPrintData>(`/print-data/leave-application/${leaveId}`),

  getStaffAttendancePrintData: (departmentId: string, month: number, year: number) =>
    request<StaffAttendanceReportPrintData>(`/print-data/staff-attendance/${departmentId}/${month}/${year}`),

  getTrainingCertificatePrintData: (trainingId: string) =>
    request<TrainingCertificatePrintData>(`/print-data/training-certificate/${trainingId}`),

  getStaffCredentialsPrintData: (employeeId: string) =>
    request<StaffCredentialFormPrintData>(`/print-data/staff-credentials/${employeeId}`),

  getVisitorRegisterPrintData: (date: string) =>
    request<VisitorRegisterPrintData>(`/print-data/visitor-register/${date}`),

  // ── BME/Engineering Forms ───────────────────────────────────
  getAmcContractPrintData: (contractId: string) =>
    request<AmcContractPrintData>(`/print-data/amc-contract/${contractId}`),

  getCalibrationCertificatePrintData: (calibrationId: string) =>
    request<CalibrationCertificatePrintData>(`/print-data/calibration-certificate/${calibrationId}`),

  getEquipmentBreakdownPrintData: (breakdownId: string) =>
    request<EquipmentBreakdownReportPrintData>(`/print-data/equipment-breakdown/${breakdownId}`),

  getEquipmentHistoryPrintData: (equipmentId: string) =>
    request<EquipmentHistoryCardPrintData>(`/print-data/equipment-history/${equipmentId}`),

  getMgpsLogPrintData: (date: string, shift: string) =>
    request<MgpsDailyLogPrintData>(`/print-data/mgps-log/${date}/${shift}`),

  getWaterQualityPrintData: (testId: string) =>
    request<WaterQualityTestPrintData>(`/print-data/water-quality/${testId}`),

  getDgUpsLogPrintData: (equipmentId: string, date: string) =>
    request<DgUpsRunLogPrintData>(`/print-data/dg-ups-log/${equipmentId}/${date}`),

  getFireInspectionPrintData: (inspectionId: string) =>
    request<FireEquipmentInspectionPrintData>(`/print-data/fire-inspection/${inspectionId}`),

  getMateriovigilancePrintData: (reportId: string) =>
    request<MateriovigilanceReportPrintData>(`/print-data/materiovigilance/${reportId}`),

  getFireMockDrillPrintData: (drillId: string) =>
    request<FireMockDrillReportPrintData>(`/print-data/fire-mock-drill/${drillId}`),

  // ── Blood Bank & OT Forms ───────────────────────────────────
  getOtRegisterPrintData: (otId: string, date: string) =>
    request<OtRegisterPrintData>(`/print-data/ot-register/${otId}/${date}`),

  getBloodDonorFormPrintData: (donorId: string) =>
    request<BloodDonorFormPrintData>(`/print-data/blood-donor-form/${donorId}`),

  getCrossMatchRequisitionPrintData: (requisitionId: string) =>
    request<CrossMatchRequisitionPrintData>(`/print-data/cross-match-requisition/${requisitionId}`),

  // ── Clinical/Identity Forms ─────────────────────────────────
  getAppointmentSlipPrintData: (appointmentId: string) =>
    request<AppointmentSlipPrintData>(`/print-data/appointment-slip/${appointmentId}`),

  getDpdpConsentPrintData: (consentId: string) =>
    request<DpdpConsentPrintData>(`/print-data/dpdp-consent/${consentId}`),

  getVideoConsentPrintData: (videoConsentId: string) =>
    request<VideoConsentPrintData>(`/print-data/video-consent/${videoConsentId}`),

  getRestraintDocumentationPrintData: (restraintId: string) =>
    request<RestraintDocumentationPrintData>(`/print-data/restraint-documentation/${restraintId}`),

  // ══════════════════════════════════════════════════════════
  // PHASE 6: ACADEMIC/SPECIALTY FORMS & BRANDING
  // ══════════════════════════════════════════════════════════

  // -- Phase 6: Academic/Medical College Forms --
  getStudentAdmissionFormPrintData: (admissionId: string) =>
    request<StudentAdmissionFormPrintData>(`/print-data/student-admission-form/${admissionId}`),

  getInternRotationSchedulePrintData: (scheduleId: string) =>
    request<InternRotationSchedulePrintData>(`/print-data/intern-rotation-schedule/${scheduleId}`),

  getPgLogbookEntryPrintData: (entryId: string) =>
    request<PgLogbookEntryPrintData>(`/print-data/pg-logbook-entry/${entryId}`),

  getInternalAssessmentMarksPrintData: (assessmentId: string) =>
    request<InternalAssessmentMarksPrintData>(`/print-data/internal-assessment-marks/${assessmentId}`),

  getExamHallTicketPrintData: (ticketId: string) =>
    request<ExamHallTicketPrintData>(`/print-data/exam-hall-ticket/${ticketId}`),

  getOsceScoringSheetPrintData: (examId: string, stationNumber: number) =>
    request<OsceScoringSheetPrintData>(`/print-data/osce-scoring-sheet/${examId}/${stationNumber}`),

  getSimulationDebriefingPrintData: (sessionId: string) =>
    request<SimulationDebriefingPrintData>(`/print-data/simulation-debriefing/${sessionId}`),

  getCmeCertificatePrintData: (certificateId: string) =>
    request<CmeCertificatePrintData>(`/print-data/cme-certificate/${certificateId}`),

  getIecApprovalCertificatePrintData: (approvalId: string) =>
    request<IecApprovalCertificatePrintData>(`/print-data/iec-approval-certificate/${approvalId}`),

  getResearchProposalFormPrintData: (proposalId: string) =>
    request<ResearchProposalFormPrintData>(`/print-data/research-proposal-form/${proposalId}`),

  getHostelAllotmentOrderPrintData: (orderId: string) =>
    request<HostelAllotmentOrderPrintData>(`/print-data/hostel-allotment-order/${orderId}`),

  getAntiRaggingUndertakingPrintData: (undertakingId: string) =>
    request<AntiRaggingUndertakingPrintData>(`/print-data/anti-ragging-undertaking/${undertakingId}`),

  getDisabilityAccommodationPlanPrintData: (planId: string) =>
    request<DisabilityAccommodationPlanPrintData>(`/print-data/disability-accommodation-plan/${planId}`),

  getInternshipCompletionCertificatePrintData: (certificateId: string) =>
    request<InternshipCompletionCertificatePrintData>(`/print-data/internship-completion-certificate/${certificateId}`),

  getServiceBondAgreementPrintData: (bondId: string) =>
    request<ServiceBondAgreementPrintData>(`/print-data/service-bond-agreement/${bondId}`),

  getStipendPaymentAdvicePrintData: (adviceId: string) =>
    request<StipendPaymentAdvicePrintData>(`/print-data/stipend-payment-advice/${adviceId}`),

  // -- Phase 6: Hospital Branding --
  getHospitalBrandingPrintData: () =>
    request<HospitalBrandingPrintData>(`/print-data/hospital-branding`),

  // ══════════════════════════════════════════════════════════
  //  Bedside Portal
  // ══════════════════════════════════════════════════════════

  listBedsideSessions: () =>
    request<BedsideSessionRow[]>("/bedside/sessions"),

  createBedsideSession: (data: CreateBedsideSessionRequest) =>
    request<BedsideSessionRow>("/bedside/sessions", { method: "POST", body: JSON.stringify(data) }),

  endBedsideSession: (id: string) =>
    request<BedsideSessionRow>(`/bedside/sessions/${id}/end`, { method: "PUT" }),

  getBedsideDailySchedule: (admissionId: string) =>
    request<BedsideDailyScheduleItem[]>(`/bedside/${admissionId}/schedule`),

  getBedsideMedications: (admissionId: string) =>
    request<BedsideMedicationItem[]>(`/bedside/${admissionId}/medications`),

  getBedsideVitals: (admissionId: string) =>
    request<BedsideVitalReading[]>(`/bedside/${admissionId}/vitals`),

  getBedsideLabResults: (admissionId: string) =>
    request<BedsideLabResultItem[]>(`/bedside/${admissionId}/lab-results`),

  getBedsideDietOrder: (admissionId: string) =>
    request<BedsideDietOrderItem[]>(`/bedside/${admissionId}/diet-order`),

  createBedsideNurseRequest: (admissionId: string, data: CreateBedsideNurseRequestPayload) =>
    request<BedsideNurseRequestRow>(`/bedside/${admissionId}/nurse-request`, { method: "POST", body: JSON.stringify(data) }),

  listBedsideNurseRequests: (admissionId: string, params?: { status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<BedsideNurseRequestRow[]>(`/bedside/${admissionId}/nurse-requests${qs ? `?${qs}` : ""}`);
  },

  updateBedsideRequestStatus: (id: string, data: UpdateBedsideRequestStatusPayload) =>
    request<BedsideNurseRequestRow>(`/bedside/nurse-requests/${id}/status`, { method: "PUT", body: JSON.stringify(data) }),

  listBedsideVideos: (params?: { category?: string }) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set("category", params.category);
    const qs = sp.toString();
    return request<BedsideEducationVideoRow[]>(`/bedside/videos${qs ? `?${qs}` : ""}`);
  },

  createBedsideVideo: (data: CreateBedsideVideoRequest) =>
    request<BedsideEducationVideoRow>("/bedside/videos", { method: "POST", body: JSON.stringify(data) }),

  updateBedsideVideo: (id: string, data: UpdateBedsideVideoRequest) =>
    request<BedsideEducationVideoRow>(`/bedside/videos/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  recordBedsideVideoView: (admissionId: string, data: RecordBedsideVideoViewRequest) =>
    request<BedsideEducationViewRow>(`/bedside/${admissionId}/video-view`, { method: "POST", body: JSON.stringify(data) }),

  submitBedsideFeedback: (admissionId: string, data: SubmitBedsideFeedbackRequest) =>
    request<BedsideRealtimeFeedbackRow>(`/bedside/${admissionId}/feedback`, { method: "POST", body: JSON.stringify(data) }),

  listBedsideFeedback: (admissionId: string) =>
    request<BedsideRealtimeFeedbackRow[]>(`/bedside/${admissionId}/feedback`),

  // ══════════════════════════════════════════════════════════════════════════════
  // TV Displays & Queue
  // ══════════════════════════════════════════════════════════════════════════════

  listTvDisplays: () => request<TvDisplay[]>("/tv/displays"),

  createTvDisplay: (data: CreateTvDisplayRequest) =>
    request<TvDisplay>("/tv/displays", { method: "POST", body: JSON.stringify(data) }),

  getTvDisplay: (id: string) => request<TvDisplay>(`/tv/displays/${id}`),

  updateTvDisplay: (id: string, data: UpdateTvDisplayRequest) =>
    request<TvDisplay>(`/tv/displays/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteTvDisplay: (id: string) =>
    request<void>(`/tv/displays/${id}`, { method: "DELETE" }),

  listQueueTokens: (params?: ListQueueTokensQuery) => {
    const sp = new URLSearchParams();
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.date) sp.set("date", params.date);
    const qs = sp.toString();
    return request<QueueToken[]>(`/tv/tokens${qs ? `?${qs}` : ""}`);
  },

  createQueueToken: (data: CreateQueueTokenRequest) =>
    request<CreateQueueTokenResponse>("/tv/tokens", { method: "POST", body: JSON.stringify(data) }),

  callQueueToken: (id: string) =>
    request<QueueToken>(`/tv/tokens/${id}/call`, { method: "POST" }),

  completeQueueToken: (id: string) =>
    request<QueueToken>(`/tv/tokens/${id}/complete`, { method: "POST" }),

  noShowQueueToken: (id: string) =>
    request<QueueToken>(`/tv/tokens/${id}/no-show`, { method: "POST" }),

  getQueueState: (departmentId: string) =>
    request<DepartmentQueueState>(`/tv/queue/${departmentId}`),

  broadcastAnnouncement: (data: BroadcastAnnouncementRequest) =>
    request<TvAnnouncement>("/tv/announcements", { method: "POST", body: JSON.stringify(data) }),

  // ── Specialty Queue Displays ─────────────────────────────────────────────
  getPharmacyQueueDisplay: () =>
    request<PharmacyQueueDisplay>("/tv/queue/pharmacy"),

  getLabQueueDisplay: () =>
    request<LabQueueDisplay>("/tv/queue/lab"),

  getRadiologyQueueDisplay: (modality: string) =>
    request<RadiologyQueueDisplay>(`/tv/queue/radiology/${modality}`),

  getErQueueDisplay: () =>
    request<ErQueueDisplay>("/tv/queue/er"),

  getBillingQueueDisplay: () =>
    request<BillingQueueDisplay>("/tv/queue/billing"),

  getBedAvailabilityDisplay: (wardType: string) =>
    request<BedAvailabilityDisplay>(`/tv/queue/beds/${wardType}`),

  getQueueAnalytics: (departmentId: string) =>
    request<QueueAnalytics>(`/tv/queue/analytics/${departmentId}`),

  getQueueMetricsRealtime: (departmentId: string) =>
    request<QueueMetricsRealtime>(`/tv/queue/metrics/${departmentId}`),

  // ══════════════════════════════════════════════════════════════════════════════
  // Multi-Hospital Management
  // ══════════════════════════════════════════════════════════════════════════════

  // Hospital Groups
  listHospitalGroups: () =>
    request<HospitalGroup[]>("/multi-hospital/groups"),

  getHospitalGroup: (id: string) =>
    request<HospitalGroup>(`/multi-hospital/groups/${id}`),

  createHospitalGroup: (data: CreateHospitalGroup) =>
    request<HospitalGroup>("/multi-hospital/groups", { method: "POST", body: JSON.stringify(data) }),

  updateHospitalGroup: (id: string, data: UpdateHospitalGroup) =>
    request<HospitalGroup>(`/multi-hospital/groups/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteHospitalGroup: (id: string) =>
    request<void>(`/multi-hospital/groups/${id}`, { method: "DELETE" }),

  // Regions
  listHospitalRegions: (groupId: string) => {
    const sp = new URLSearchParams({ group_id: groupId });
    return request<HospitalRegion[]>(`/multi-hospital/regions?${sp.toString()}`);
  },

  getHospitalRegion: (id: string) =>
    request<HospitalRegion>(`/multi-hospital/regions/${id}`),

  createHospitalRegion: (data: CreateHospitalRegion) =>
    request<HospitalRegion>("/multi-hospital/regions", { method: "POST", body: JSON.stringify(data) }),

  deleteHospitalRegion: (id: string) =>
    request<void>(`/multi-hospital/regions/${id}`, { method: "DELETE" }),

  // Hospitals in Group
  listHospitalsInGroup: (groupId: string) =>
    request<HospitalInGroup[]>(`/multi-hospital/groups/${groupId}/hospitals`),

  assignHospitalToGroup: (data: AssignHospitalToGroup) =>
    request<HospitalInGroup>("/multi-hospital/hospital-assignments", { method: "POST", body: JSON.stringify(data) }),

  removeHospitalFromGroup: (tenantId: string) =>
    request<void>(`/multi-hospital/hospital-assignments/${tenantId}`, { method: "DELETE" }),

  // User Assignments
  getUserHospitalAssignments: (userId: string) =>
    request<UserWithAssignments>(`/multi-hospital/users/${userId}/assignments`),

  listMultiHospitalUsers: (groupId: string) => {
    const sp = new URLSearchParams({ group_id: groupId });
    return request<UserWithAssignments[]>(`/multi-hospital/user-assignments?${sp.toString()}`);
  },

  createUserHospitalAssignment: (data: CreateUserHospitalAssignment) =>
    request<UserHospitalAssignment>("/multi-hospital/user-assignments", { method: "POST", body: JSON.stringify(data) }),

  deleteUserHospitalAssignment: (assignmentId: string) =>
    request<void>(`/multi-hospital/user-assignments/${assignmentId}`, { method: "DELETE" }),

  // Patient Transfers
  listOutgoingPatientTransfers: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<PatientTransferDisplay[]>(`/multi-hospital/transfers/patients/outgoing${qs ? `?${qs}` : ""}`);
  },

  listIncomingPatientTransfers: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<PatientTransferDisplay[]>(`/multi-hospital/transfers/patients/incoming${qs ? `?${qs}` : ""}`);
  },

  getPatientTransfer: (id: string) =>
    request<PatientTransfer>(`/multi-hospital/transfers/patients/${id}`),

  createPatientTransfer: (data: CreatePatientTransfer) =>
    request<PatientTransfer>("/multi-hospital/transfers/patients", { method: "POST", body: JSON.stringify(data) }),

  updatePatientTransferStatus: (id: string, data: UpdateTransferStatus) =>
    request<PatientTransfer>(`/multi-hospital/transfers/patients/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Stock Transfers
  listOutgoingStockTransfers: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<StockTransfer[]>(`/multi-hospital/transfers/stock/outgoing${qs ? `?${qs}` : ""}`);
  },

  listIncomingStockTransfers: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<StockTransfer[]>(`/multi-hospital/transfers/stock/incoming${qs ? `?${qs}` : ""}`);
  },

  getStockTransfer: (id: string) =>
    request<StockTransfer>(`/multi-hospital/transfers/stock/${id}`),

  getStockTransferItems: (transferId: string) =>
    request<StockTransferItem[]>(`/multi-hospital/transfers/stock/${transferId}/items`),

  createStockTransfer: (data: CreateStockTransfer) =>
    request<StockTransfer>("/multi-hospital/transfers/stock", { method: "POST", body: JSON.stringify(data) }),

  updateStockTransferStatus: (id: string, data: UpdateTransferStatus) =>
    request<StockTransfer>(`/multi-hospital/transfers/stock/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Group KPIs & Dashboard
  getGroupDashboard: (groupId: string, params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<GroupDashboard>(`/multi-hospital/groups/${groupId}/dashboard${qs ? `?${qs}` : ""}`);
  },

  listGroupKpis: (groupId: string, params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<GroupKpiSnapshot[]>(`/multi-hospital/groups/${groupId}/kpis${qs ? `?${qs}` : ""}`);
  },

  getHospitalKpi: (tenantId: string, params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<HospitalKpiSummary>(`/multi-hospital/hospitals/${tenantId}/kpi${qs ? `?${qs}` : ""}`);
  },

  // Doctor Rotation
  listDoctorRotations: (groupId: string, params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<DoctorRotationDisplay[]>(`/multi-hospital/groups/${groupId}/rotations${qs ? `?${qs}` : ""}`);
  },

  getDoctorRotation: (doctorId: string, params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<DoctorRotationSchedule[]>(`/multi-hospital/doctors/${doctorId}/rotations${qs ? `?${qs}` : ""}`);
  },

  createDoctorRotation: (groupId: string, data: CreateDoctorRotation) =>
    request<DoctorRotationSchedule>(`/multi-hospital/groups/${groupId}/rotations`, { method: "POST", body: JSON.stringify(data) }),

  deleteDoctorRotation: (id: string) =>
    request<void>(`/multi-hospital/rotations/${id}`, { method: "DELETE" }),

  // Group Masters
  listGroupDrugs: (groupId: string) =>
    request<GroupDrugMaster[]>(`/multi-hospital/groups/${groupId}/drugs`),

  listGroupTests: (groupId: string) =>
    request<GroupTestMaster[]>(`/multi-hospital/groups/${groupId}/tests`),

  listGroupTariffs: (groupId: string) =>
    request<GroupTariffMaster[]>(`/multi-hospital/groups/${groupId}/tariffs`),

  listPriceOverrides: () =>
    request<HospitalPriceOverride[]>("/multi-hospital/price-overrides"),

  // Group Templates
  listGroupTemplates: (groupId: string, templateType?: string) => {
    const sp = new URLSearchParams();
    if (templateType) sp.set("period", templateType);
    const qs = sp.toString();
    return request<GroupTemplate[]>(`/multi-hospital/groups/${groupId}/templates${qs ? `?${qs}` : ""}`);
  },

  getGroupTemplate: (id: string) =>
    request<GroupTemplate>(`/multi-hospital/templates/${id}`),

  createGroupTemplate: (groupId: string, data: CreateGroupTemplate) =>
    request<GroupTemplate>(`/multi-hospital/groups/${groupId}/templates`, { method: "POST", body: JSON.stringify(data) }),

  deleteGroupTemplate: (id: string) =>
    request<void>(`/multi-hospital/templates/${id}`, { method: "DELETE" }),

  // ══════════════════════════════════════════════════════════════════════════════
  // CMS & Blog
  // ══════════════════════════════════════════════════════════════════════════════

  // Dashboard
  getCmsDashboard: () =>
    request<CmsDashboardStats>("/cms/dashboard"),

  // Categories
  listCmsCategories: () =>
    request<CmsCategory[]>("/cms/categories"),

  listCmsCategoriesTree: () =>
    request<CmsCategoryWithChildren[]>("/cms/categories/tree"),

  getCmsCategory: (id: string) =>
    request<CmsCategory>(`/cms/categories/${id}`),

  createCmsCategory: (data: CreateCmsCategory) =>
    request<CmsCategory>("/cms/categories", { method: "POST", body: JSON.stringify(data) }),

  updateCmsCategory: (id: string, data: UpdateCmsCategory) =>
    request<CmsCategory>(`/cms/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCmsCategory: (id: string) =>
    request<void>(`/cms/categories/${id}`, { method: "DELETE" }),

  // Tags
  listCmsTags: () =>
    request<CmsTag[]>("/cms/tags"),

  getCmsTag: (id: string) =>
    request<CmsTag>(`/cms/tags/${id}`),

  createCmsTag: (data: CreateCmsTag) =>
    request<CmsTag>("/cms/tags", { method: "POST", body: JSON.stringify(data) }),

  updateCmsTag: (id: string, data: UpdateCmsTag) =>
    request<CmsTag>(`/cms/tags/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCmsTag: (id: string) =>
    request<void>(`/cms/tags/${id}`, { method: "DELETE" }),

  bulkDeleteCmsTags: (ids: string[]) =>
    request<void>("/cms/tags/bulk-delete", { method: "POST", body: JSON.stringify(ids) }),

  // Authors
  listCmsAuthors: () =>
    request<CmsAuthor[]>("/cms/authors"),

  getCmsAuthor: (id: string) =>
    request<CmsAuthor>(`/cms/authors/${id}`),

  createCmsAuthor: (data: CreateCmsAuthor) =>
    request<CmsAuthor>("/cms/authors", { method: "POST", body: JSON.stringify(data) }),

  updateCmsAuthor: (id: string, data: UpdateCmsAuthor) =>
    request<CmsAuthor>(`/cms/authors/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCmsAuthor: (id: string) =>
    request<void>(`/cms/authors/${id}`, { method: "DELETE" }),

  // Media Library
  listCmsMedia: (params?: { page?: number; per_page?: number; mime_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    if (params?.mime_type) sp.set("mime_type", params.mime_type);
    const qs = sp.toString();
    return request<CmsMedia[]>(`/cms/media${qs ? `?${qs}` : ""}`);
  },

  getCmsMedia: (id: string) =>
    request<CmsMedia>(`/cms/media/${id}`),

  createCmsMedia: (data: CreateCmsMedia) =>
    request<CmsMedia>("/cms/media", { method: "POST", body: JSON.stringify(data) }),

  updateCmsMedia: (id: string, data: UpdateCmsMedia) =>
    request<CmsMedia>(`/cms/media/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCmsMedia: (id: string) =>
    request<void>(`/cms/media/${id}`, { method: "DELETE" }),

  // Posts
  listCmsPosts: (params?: { page?: number; per_page?: number; status?: string; category_id?: string; author_id?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    if (params?.status) sp.set("status", params.status);
    if (params?.category_id) sp.set("category_id", params.category_id);
    if (params?.author_id) sp.set("author_id", params.author_id);
    if (params?.search) sp.set("search", params.search);
    const qs = sp.toString();
    return request<CmsPostSummary[]>(`/cms/posts${qs ? `?${qs}` : ""}`);
  },

  getCmsPost: (id: string) =>
    request<CmsPostDetail>(`/cms/posts/${id}`),

  createCmsPost: (data: CreateCmsPost) =>
    request<CmsPost>("/cms/posts", { method: "POST", body: JSON.stringify(data) }),

  updateCmsPost: (id: string, data: UpdateCmsPost) =>
    request<CmsPost>(`/cms/posts/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCmsPost: (id: string) =>
    request<void>(`/cms/posts/${id}`, { method: "DELETE" }),

  // Post Workflow
  submitCmsPostForReview: (id: string, data: SubmitPostForReview) =>
    request<CmsPost>(`/cms/posts/${id}/submit-review`, { method: "POST", body: JSON.stringify(data) }),

  reviewCmsPost: (id: string, data: ReviewPostAction) =>
    request<CmsPost>(`/cms/posts/${id}/review`, { method: "POST", body: JSON.stringify(data) }),

  medicalReviewCmsPost: (id: string, data: ReviewPostAction) =>
    request<CmsPost>(`/cms/posts/${id}/medical-review`, { method: "POST", body: JSON.stringify(data) }),

  publishCmsPost: (id: string) =>
    request<CmsPost>(`/cms/posts/${id}/publish`, { method: "POST" }),

  scheduleCmsPost: (id: string, data: SchedulePostRequest) =>
    request<CmsPost>(`/cms/posts/${id}/schedule`, { method: "POST", body: JSON.stringify(data) }),

  archiveCmsPost: (id: string) =>
    request<CmsPost>(`/cms/posts/${id}/archive`, { method: "POST" }),

  unarchiveCmsPost: (id: string) =>
    request<CmsPost>(`/cms/posts/${id}/unarchive`, { method: "POST" }),

  // Post Revisions
  listCmsPostRevisions: (postId: string) =>
    request<CmsPostRevision[]>(`/cms/posts/${postId}/revisions`),

  getCmsPostRevision: (postId: string, revisionNumber: number) =>
    request<CmsPostRevision>(`/cms/posts/${postId}/revisions/${revisionNumber}`),

  restoreCmsPostRevision: (postId: string, revisionNumber: number) =>
    request<CmsPost>(`/cms/posts/${postId}/revisions/${revisionNumber}/restore`, { method: "POST" }),

  // Post Analytics
  getCmsPostAnalytics: (id: string) =>
    request<CmsPostAnalytics>(`/cms/posts/${id}/analytics`),

  listCmsTopPosts: () =>
    request<CmsPostAnalytics[]>("/cms/analytics/top-posts"),

  // Subscribers
  listCmsSubscribers: (params?: { page?: number; per_page?: number; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<CmsSubscriber[]>(`/cms/subscribers${qs ? `?${qs}` : ""}`);
  },

  getCmsSubscriber: (id: string) =>
    request<CmsSubscriber>(`/cms/subscribers/${id}`),

  deleteCmsSubscriber: (id: string) =>
    request<void>(`/cms/subscribers/${id}`, { method: "DELETE" }),

  exportCmsSubscribers: () =>
    request<string>("/cms/subscribers/export"),

  // Pages
  listCmsPages: () =>
    request<CmsPage[]>("/cms/pages"),

  getCmsPage: (id: string) =>
    request<CmsPage>(`/cms/pages/${id}`),

  createCmsPage: (data: CreateCmsPage) =>
    request<CmsPage>("/cms/pages", { method: "POST", body: JSON.stringify(data) }),

  updateCmsPage: (id: string, data: UpdateCmsPage) =>
    request<CmsPage>(`/cms/pages/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCmsPage: (id: string) =>
    request<void>(`/cms/pages/${id}`, { method: "DELETE" }),

  // Settings
  getCmsSettings: () =>
    request<CmsSettings>("/cms/settings"),

  updateCmsSettings: (data: UpdateCmsSettings) =>
    request<CmsSettings>("/cms/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Menus
  listCmsMenus: () =>
    request<CmsMenu[]>("/cms/menus"),

  getCmsMenu: (location: string) =>
    request<CmsMenu>(`/cms/menus/${location}`),

  updateCmsMenu: (location: string, data: UpdateCmsMenu) =>
    request<CmsMenu>(`/cms/menus/${location}`, { method: "PUT", body: JSON.stringify(data) }),

  // Public API
  publicListCmsPosts: (params?: { page?: number; per_page?: number; category?: string; tag?: string; author?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    if (params?.category) sp.set("category", params.category);
    if (params?.tag) sp.set("tag", params.tag);
    if (params?.author) sp.set("author", params.author);
    const qs = sp.toString();
    return request<CmsPostList>(`/public/cms/posts${qs ? `?${qs}` : ""}`);
  },

  publicGetCmsPost: (slug: string) =>
    request<CmsPublicPost>(`/public/cms/posts/${slug}`),

  publicGetFeaturedPosts: () =>
    request<CmsPublicPost[]>("/public/cms/posts/featured"),

  publicRecordCmsView: (postId: string) =>
    request<void>(`/public/cms/posts/${postId}/view`, { method: "POST" }),

  publicGetCmsPage: (slug: string) =>
    request<CmsPage>(`/public/cms/pages/${slug}`),

  publicSubscribeCms: (data: CreateCmsSubscriber) =>
    request<CmsSubscriber>("/public/cms/subscribe", { method: "POST", body: JSON.stringify(data) }),

  publicConfirmCmsSubscription: (token: string) =>
    request<void>(`/public/cms/confirm/${token}`),

  publicUnsubscribeCms: (token: string) =>
    request<void>(`/public/cms/unsubscribe/${token}`),

  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: BREAK-GLASS
  // ══════════════════════════════════════════════════════════════

  startBreakGlass: (data: CreateBreakGlassRequest) =>
    request<BreakGlassEvent>("/break-glass", { method: "POST", body: JSON.stringify(data) }),

  listBreakGlass: (params?: BreakGlassQuery) => {
    const sp = new URLSearchParams();
    if (params?.user_id) sp.set("user_id", params.user_id);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    if (params?.reviewed !== undefined) sp.set("reviewed", String(params.reviewed));
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<BreakGlassEventSummary[]>(`/break-glass${qs ? `?${qs}` : ""}`);
  },

  getBreakGlass: (id: string) =>
    request<BreakGlassEvent>(`/break-glass/${id}`),

  endBreakGlass: (id: string, data: EndBreakGlassRequest) =>
    request<BreakGlassEvent>(`/break-glass/${id}/end`, { method: "POST", body: JSON.stringify(data) }),

  reviewBreakGlass: (id: string, data: ReviewBreakGlassRequest) =>
    request<BreakGlassEvent>(`/break-glass/${id}/review`, { method: "POST", body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: CLINICAL ACCESS MONITOR
  // ══════════════════════════════════════════════════════════════

  listSensitivePatients: () =>
    request<SensitivePatientSummary[]>("/sensitive-patients"),

  createSensitivePatient: (data: CreateSensitivePatientRequest) =>
    request<SensitivePatient>("/sensitive-patients", { method: "POST", body: JSON.stringify(data) }),

  deleteSensitivePatient: (id: string) =>
    request<{ deleted: boolean }>(`/sensitive-patients/${id}`, { method: "DELETE" }),

  listAccessAlerts: () =>
    request<AccessAlert[]>("/access-alerts"),

  acknowledgeAccessAlert: (id: string, data: AcknowledgeAlertRequest) =>
    request<AccessAlert>(`/access-alerts/${id}/acknowledge`, { method: "POST", body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: STOCK DISPOSAL
  // ══════════════════════════════════════════════════════════════

  listDisposals: (params?: DisposalQuery) => {
    const sp = new URLSearchParams();
    if (params?.store_id) sp.set("store_id", params.store_id);
    if (params?.disposal_type) sp.set("disposal_type", params.disposal_type);
    if (params?.status) sp.set("status", params.status);
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<StockDisposalSummary[]>(`/disposals${qs ? `?${qs}` : ""}`);
  },

  getDisposal: (id: string) =>
    request<StockDisposalRequest>(`/disposals/${id}`),

  getDisposalItems: (id: string) =>
    request<StockDisposalItem[]>(`/disposals/${id}/items`),

  createDisposal: (data: CreateDisposalRequest) =>
    request<StockDisposalRequest>("/disposals", { method: "POST", body: JSON.stringify(data) }),

  approveDisposal: (id: string, data: ApproveDisposalRequest) =>
    request<StockDisposalRequest>(`/disposals/${id}/approve`, { method: "POST", body: JSON.stringify(data) }),

  executeDisposal: (id: string, data: ExecuteDisposalRequest) =>
    request<StockDisposalRequest>(`/disposals/${id}/execute`, { method: "POST", body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: TAT TRACKING
  // ══════════════════════════════════════════════════════════════

  listTatBenchmarks: () =>
    request<TatBenchmark[]>("/tat/benchmarks"),

  createTatBenchmark: (data: CreateTatBenchmarkRequest) =>
    request<TatBenchmark>("/tat/benchmarks", { method: "POST", body: JSON.stringify(data) }),

  listTatRecords: (params?: TatQuery) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set("category", params.category);
    if (params?.status) sp.set("status", params.status);
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<TatRecordSummary[]>(`/tat/records${qs ? `?${qs}` : ""}`);
  },

  startTatRecord: (data: CreateTatRecordRequest) =>
    request<TatRecord>("/tat/records", { method: "POST", body: JSON.stringify(data) }),

  completeTatRecord: (id: string, data: CompleteTatRecordRequest) =>
    request<TatRecord>(`/tat/records/${id}/complete`, { method: "POST", body: JSON.stringify(data) }),

  getTatDashboard: () =>
    request<TatDashboard>("/tat/dashboard"),

  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: DATA MIGRATION
  // ══════════════════════════════════════════════════════════════

  listMigrations: (params?: MigrationQuery) => {
    const sp = new URLSearchParams();
    if (params?.direction) sp.set("direction", params.direction);
    if (params?.entity_type) sp.set("entity_type", params.entity_type);
    if (params?.status) sp.set("status", params.status);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<DataMigration[]>(`/migrations${qs ? `?${qs}` : ""}`);
  },

  getMigration: (id: string) =>
    request<DataMigration>(`/migrations/${id}`),

  createMigration: (data: CreateMigrationRequest) =>
    request<DataMigration>("/migrations", { method: "POST", body: JSON.stringify(data) }),

  cancelMigration: (id: string) =>
    request<DataMigration>(`/migrations/${id}/cancel`, { method: "POST" }),

  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: EOD DIGEST
  // ══════════════════════════════════════════════════════════════

  getMyDigestSubscription: () =>
    request<EodDigestSubscription | null>("/digest/subscription"),

  upsertDigestSubscription: (data: CreateDigestSubscriptionRequest) =>
    request<EodDigestSubscription>("/digest/subscription", { method: "POST", body: JSON.stringify(data) }),

  listDigestHistory: () =>
    request<EodDigestHistory[]>("/digest/history"),

  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: DATA QUALITY
  // ══════════════════════════════════════════════════════════════

  listDataQualityRules: () =>
    request<DataQualityRule[]>("/data-quality/rules"),

  createDataQualityRule: (data: CreateDataQualityRuleRequest) =>
    request<DataQualityRule>("/data-quality/rules", { method: "POST", body: JSON.stringify(data) }),

  listDataQualityIssues: (params?: DataQualityQuery) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set("category", params.category);
    if (params?.entity_type) sp.set("entity_type", params.entity_type);
    if (params?.severity) sp.set("severity", params.severity);
    if (params?.is_resolved !== undefined) sp.set("is_resolved", String(params.is_resolved));
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<DataQualityIssue[]>(`/data-quality/issues${qs ? `?${qs}` : ""}`);
  },

  resolveDataQualityIssue: (id: string, data: ResolveIssueRequest) =>
    request<DataQualityIssue>(`/data-quality/issues/${id}/resolve`, { method: "POST", body: JSON.stringify(data) }),

  getDataQualityDashboard: () =>
    request<DataQualityDashboard>("/data-quality/dashboard"),

  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: CERT-IN COMPLIANCE
  // ══════════════════════════════════════════════════════════════

  reportToCertIn: (id: string, data: ReportToCertInRequest) =>
    request<CertInIncident>(`/security-incidents/${id}/cert-in`, { method: "POST", body: JSON.stringify(data) }),

  getIncidentUpdates: (id: string) =>
    request<CertInIncidentUpdate[]>(`/security-incidents/${id}/updates`),

  addIncidentUpdate: (id: string, data: AddCertInUpdateRequest) =>
    request<CertInIncidentUpdate>(`/security-incidents/${id}/updates`, { method: "POST", body: JSON.stringify(data) }),

  listVulnerabilities: () =>
    request<Vulnerability[]>("/vulnerabilities"),

  createVulnerability: (data: CreateVulnerabilityRequest) =>
    request<Vulnerability>("/vulnerabilities", { method: "POST", body: JSON.stringify(data) }),

  updateVulnerability: (id: string, data: UpdateVulnerabilityRequest) =>
    request<Vulnerability>(`/vulnerabilities/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  listComplianceRequirements: () =>
    request<ComplianceRequirement[]>("/compliance-requirements"),

  updateComplianceRequirement: (id: string, data: UpdateCertInComplianceRequest) =>
    request<ComplianceRequirement>(`/compliance-requirements/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: SYSTEM HEALTH & MONITORING
  // ══════════════════════════════════════════════════════════════

  getSystemHealthDashboard: () =>
    request<SystemHealthDashboard>("/system-health"),

  listBackups: () =>
    request<BackupHistory[]>("/backups"),

  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: ONBOARDING WIZARD
  // ══════════════════════════════════════════════════════════════

  getOnboardingProgress: () =>
    request<ItSecurityOnboardingProgress | null>("/onboarding/progress"),

  completeOnboardingStep: (data: CompleteItSecurityOnboardingStepRequest) =>
    request<ItSecurityOnboardingProgress>("/onboarding/complete-step", { method: "POST", body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: INCENTIVE CONFIGURATION
  // ══════════════════════════════════════════════════════════════

  listIncentivePlans: () =>
    request<IncentivePlan[]>("/incentive-plans"),

  createIncentivePlan: (data: CreateIncentivePlanRequest) =>
    request<IncentivePlan>("/incentive-plans", { method: "POST", body: JSON.stringify(data) }),

  getIncentivePlanRules: (id: string) =>
    request<IncentivePlanRule[]>(`/incentive-plans/${id}/rules`),

  addIncentiveRule: (planId: string, data: CreateIncentiveRuleRequest) =>
    request<IncentivePlanRule>(`/incentive-plans/${planId}/rules`, { method: "POST", body: JSON.stringify(data) }),

  listDoctorIncentiveAssignments: () =>
    request<DoctorIncentiveAssignment[]>("/incentive-assignments"),

  assignIncentivePlan: (data: AssignIncentivePlanRequest) =>
    request<DoctorIncentiveAssignment>("/incentive-assignments", { method: "POST", body: JSON.stringify(data) }),

  listIncentiveCalculations: () =>
    request<IncentiveCalculation[]>("/incentive-calculations"),

  calculateIncentive: (data: CalculateIncentiveRequest) =>
    request<IncentiveCalculation>("/incentive-calculations", { method: "POST", body: JSON.stringify(data) }),

  approveIncentive: (id: string, data: ApproveIncentiveRequest) =>
    request<IncentiveCalculation>(`/incentive-calculations/${id}/approve`, { method: "POST", body: JSON.stringify(data) }),

  markIncentivePaid: (id: string, data: MarkIncentivePaidRequest) =>
    request<IncentiveCalculation>(`/incentive-calculations/${id}/paid`, { method: "POST", body: JSON.stringify(data) }),
};
