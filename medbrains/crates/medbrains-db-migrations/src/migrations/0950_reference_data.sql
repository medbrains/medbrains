-- Data for Name: asset_categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.asset_categories (id, tenant_id, name, created_at, code, parent_id, asset_domain, description, regulatory_class, default_pm_frequency, default_calibration_frequency, requires_pm, requires_calibration, is_camp_eligible, is_active, sort_order, updated_at, deleted_at, deleted_by, delete_reason) VALUES
	('270616b0-f8ec-41f4-8660-6ef5209deed7', NULL, 'Biomedical diagnostic and monitoring', '2026-08-12 05:33:21.660576+00', 'BIOMEDICAL_DIAGNOSTIC', NULL, 'diagnostic_monitoring', 'BP apparatus, ECG, monitors, oximeters, glucometers and similar diagnostic devices', NULL, NULL, NULL, true, true, true, true, 10, '2026-08-12 05:33:21.660576+00', NULL, NULL, NULL),
	('20cdb588-2138-4dac-83e0-869b6570ea2b', NULL, 'Biomedical therapeutic and life support', '2026-08-12 05:33:21.660576+00', 'BIOMEDICAL_THERAPEUTIC', NULL, 'therapeutic_life_support', 'Ventilators, infusion pumps, defibrillators and life-support devices', NULL, NULL, NULL, true, true, true, true, 20, '2026-08-12 05:33:21.660576+00', NULL, NULL, NULL),
	('a7d58cad-4dc5-42f7-97ae-87b9d9ff3ccc', NULL, 'Laboratory equipment', '2026-08-12 05:33:21.660576+00', 'LAB_EQUIPMENT', NULL, 'lab', 'Analyzers, centrifuges, microscopes and lab instruments', NULL, NULL, NULL, true, true, false, true, 30, '2026-08-12 05:33:21.660576+00', NULL, NULL, NULL),
	('70c39b89-452c-4f71-b677-3b1fc59f0f60', NULL, 'OT and CSSD equipment', '2026-08-12 05:33:21.660576+00', 'OT_CSSD_EQUIPMENT', NULL, 'ot_cssd', 'Sterilizers, surgical sets and procedural equipment', NULL, NULL, NULL, true, true, false, true, 40, '2026-08-12 05:33:21.660576+00', NULL, NULL, NULL),
	('f2e38297-26cd-4342-8f87-43302d16fde6', NULL, 'Facility utility equipment', '2026-08-12 05:33:21.660576+00', 'FACILITY_UTILITY', NULL, 'facility_utility', 'Power, water, gas, HVAC and engineering utility assets', NULL, NULL, NULL, true, false, false, true, 50, '2026-08-12 05:33:21.660576+00', NULL, NULL, NULL),
	('6254c563-5b93-4ffd-9fe0-f9e7f5532dd8', NULL, 'Fire and safety equipment', '2026-08-12 05:33:21.660576+00', 'FIRE_SAFETY', NULL, 'fire_safety', 'Extinguishers, hydrants, alarms, detectors and emergency lights', NULL, NULL, NULL, true, false, true, true, 60, '2026-08-12 05:33:21.660576+00', NULL, NULL, NULL),
	('cde596c4-6de8-44e1-be58-c22c798ab853', NULL, 'IT, printers and barcode devices', '2026-08-12 05:33:21.660576+00', 'IT_DEVICES', NULL, 'it_device', 'Computers, printers, scanners, tablets, routers and barcode devices', NULL, NULL, NULL, true, false, true, true, 70, '2026-08-12 05:33:21.660576+00', NULL, NULL, NULL),
	('0531f47e-eb48-4a19-aab0-dbb084cf3f5c', NULL, 'Mobility and transport assets', '2026-08-12 05:33:21.660576+00', 'MOBILITY_TRANSPORT', NULL, 'mobility_transport', 'Ambulances, wheelchairs, stretchers and transport equipment', NULL, NULL, NULL, true, false, true, true, 80, '2026-08-12 05:33:21.660576+00', NULL, NULL, NULL),
	('98cd11a7-2580-4a88-98af-0b2fede6cb95', NULL, 'Housekeeping and laundry assets', '2026-08-12 05:33:21.660576+00', 'HOUSEKEEPING_LAUNDRY', NULL, 'housekeeping_laundry', 'Laundry equipment, cleaning machines and reusable linen assets', NULL, NULL, NULL, true, false, false, true, 90, '2026-08-12 05:33:21.660576+00', NULL, NULL, NULL),
	('24ed17ea-b06c-4632-b136-9c618ecfbe71', NULL, 'Camp and mobile kit assets', '2026-08-12 05:33:21.660576+00', 'CAMP_MOBILE', NULL, 'camp_mobile', 'Reusable outreach camp kits and mobile clinical equipment', NULL, NULL, NULL, true, true, true, true, 100, '2026-08-12 05:33:21.660576+00', NULL, NULL, NULL);

-- Data for Name: clinical_corpus_entries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.clinical_corpus_entries (id, tenant_id, entry_key, corpus_type, section, term, aliases, short_text, insert_text, source_name, source_url, license_name, license_status, source_version, language, priority, is_active, created_by, updated_by, created_at, updated_at, deleted_at, deleted_by, delete_reason) VALUES
	('871eaabe-2887-4445-9bcf-3d04353d1346', NULL, 'soap:s:visit-header', 'soap_phrase', 'chief_complaint', 'visit header', '{date,time,provider,visit,present,chief}', 'Date, time, provider and presenting complaint', 'Date:
Time:
Provider:
This ___ year old ___ presents for ___.', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 10, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('30ceff33-c6b5-4930-a5ed-9e42dcc6fb54', NULL, 'soap:s:hpi', 'soap_phrase', 'chief_complaint', 'HPI scaffold', '{hpi,history,onset,location,duration,severity,timing}', 'Location, quality, severity, timing, context and associated symptoms', 'History of present illness:
Location:
Quality:
Severity:
Duration:
Timing/onset:
Timing/frequency:
Context:
Relieved by:
Worsened by:
Associated signs and symptoms:', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 20, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('ada3b0cc-a7ce-41d8-adce-ad5e7277c8fe', NULL, 'soap:s:ros', 'soap_phrase', 'chief_complaint', 'ROS systems', '{ros,review,symptoms,systems,constitutional,cardio,neuro}', 'Problem-focused review of systems', 'Review of systems:
Constitutional:
Eyes:
ENT:
Cardiovascular:
Respiratory:
Gastrointestinal:
Genitourinary:
Musculoskeletal:
Skin/breast:
Neurological:
Psychiatric:
Endocrine:
Hematologic/lymphatic:
Allergic/immunologic:', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 30, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('c30a056b-08ed-47a5-9cfb-4cb0d3f83234', NULL, 'soap:s:social-history', 'soap_phrase', 'chief_complaint', 'social history', '{social,culture,education,housing,occupation,tobacco,alcohol}', 'Social determinants and habits relevant to care', 'Social history:
Cultural background:
Education level:
Economic condition:
Housing:
Number in household:
Marital status:
Lives with:
Children:
Occupation:
Occupational hazards:
Nutrition:
Exercise:
Tobacco use:
Caffeine:
Sexual activity/contraception:
Alcohol/recreational drug use:', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 40, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('487cdc0c-5938-4c79-bbd3-d831b5132eb9', NULL, 'soap:s:past-medical-history', 'soap_phrase', 'chief_complaint', 'past medical history', '{pmh,past,medical,hospitalization,surgery,chronic}', 'Hospitalizations, surgeries and chronic problems', 'Past medical history:
Hospitalizations:
Surgical history:
Chronic medical problems: hypertension, diabetes, coronary heart disease, cerebrovascular disease, asthma/COPD, arthritis, gout, renal disease, thyroid disease, other.', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 50, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('16317a5f-a0d8-4e6f-9446-71085e49d882', NULL, 'soap:o:vitals', 'soap_phrase', 'examination', 'vitals block', '{vitals,bp,pulse,temperature,spo2,weight,height}', 'Vitals in objective format', 'Vitals: height ___, weight ___, temperature ___, BP ___, pulse ___, RR ___, SpO2 ___.', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 10, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('a63e9c28-156c-4e59-9aab-d7b6470fd19b', NULL, 'soap:o:general-normal', 'soap_phrase', 'examination', 'general normal', '{general,appearance,oriented,distress,ambulating}', 'General examination line', 'General: well appearing, well nourished, no distress. Oriented x3, normal mood and affect. Ambulating without difficulty.', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 20, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('37e16fc6-0ab8-40f0-b742-804ced65302d', NULL, 'soap:o:heent', 'soap_phrase', 'examination', 'HEENT normal', '{heent,head,eyes,ears,nose,mouth,pharynx}', 'Head, eyes, ears, nose, mouth and pharynx', 'HEENT:
Head: normocephalic, atraumatic.
Eyes: conjunctiva clear, sclera non-icteric, EOM intact, PERRL.
Ears: canals clear, tympanic membranes mobile, hearing intact.
Nose: mucosa non-inflamed, septum and turbinates normal.
Mouth/pharynx: mucous membranes moist, no mucosal lesions or exudate.', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 30, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('9cb94fc1-5b53-4646-85d7-cb2d12bf7a07', NULL, 'soap:o:neck-heart-lungs', 'soap_phrase', 'examination', 'neck heart lungs', '{neck,heart,cardio,lungs,respiratory,chest}', 'Neck and cardiorespiratory examination', 'Neck: supple, no lesions, bruits or adenopathy; thyroid non-enlarged and non-tender.
Heart: regular rate and rhythm, no murmur or gallop.
Lungs: clear to auscultation and percussion.', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 40, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('00615054-e4d7-4b0f-a2aa-90df68365775', NULL, 'soap:o:abdomen-back', 'soap_phrase', 'examination', 'abdomen back', '{abdomen,back,bowel,cva,gastro}', 'Abdomen and back examination', 'Abdomen: bowel sounds normal, no tenderness, organomegaly, masses or hernia.
Back: spine normal without deformity or tenderness; no CVA tenderness.', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 50, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('ca7b1d13-8abb-4c71-a35e-cef821cb52ab', NULL, 'soap:o:msk-neuro', 'soap_phrase', 'examination', 'MSK/neuro', '{msk,musculoskeletal,neuro,gait,spine,reflex}', 'Musculoskeletal and neurological examination', 'Musculoskeletal: normal gait and station, no deformity, focal tenderness, effusion, instability or abnormal tone.
Neurologic: cranial nerves grossly intact, sensation intact, reflexes appropriate.', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 60, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('22a02fcf-2c49-42c0-9a5d-edd35a8b7827', NULL, 'soap:a:assessment', 'soap_phrase', 'history', 'assessment scaffold', '{assessment,impression,diagnosis,differential,risk}', 'Clinical impression and differential', 'Assessment:
Health status and lifestyle risks:
Primary diagnosis:
Differential diagnosis:
Severity/risk:', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 10, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('ccd8a1b1-4777-4ba5-a024-094dd0fb07ed', NULL, 'soap:a:problem-list', 'soap_phrase', 'history', 'problem list', '{problem,problems,status,evidence}', 'Problem-oriented assessment', 'Problem list:
1. ___ - status ___ - evidence ___.
2. ___ - status ___ - evidence ___.', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 20, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('d82b86aa-5a80-406c-b2ea-cc072726e765', NULL, 'soap:p:labs-imaging', 'soap_phrase', 'plan', 'labs/imaging', '{lab,labs,xray,x-ray,imaging,investigation}', 'Investigation orders', 'Laboratory:
X-rays/imaging:
Other investigations:', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 10, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('8877bb80-f130-4d97-8b6b-76a5dc9475e6', NULL, 'soap:p:medication-plan', 'soap_phrase', 'plan', 'medication plan', '{med,meds,medicine,drug,dose,rx}', 'Medicine dose, duration and reconciliation', 'Medications:
Dose/frequency/duration:
Allergy and interaction risk reviewed:
Medication reconciliation updated:', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 20, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL),
	('3b7ce337-5bda-452b-b01d-1fe2e9f40f12', NULL, 'soap:p:education-followup', 'soap_phrase', 'plan', 'education and follow-up', '{education,counsel,warning,advice,explain,follow,review,return}', 'Patient education, warning signs and follow-up', 'Patient education: diagnosis explained, warning signs discussed, medicine use explained, questions answered.
Follow-up: review in ___ days/weeks, earlier if ___.', 'MedBrains SOAP starter corpus', NULL, 'MedBrains owned template', 'owned', NULL, 'en', 30, true, NULL, NULL, '2026-08-12 05:33:20.057661+00', '2026-08-12 05:33:20.057661+00', NULL, NULL, NULL);

-- Data for Name: device_adapter_catalog; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.device_adapter_catalog (id, adapter_code, manufacturer, manufacturer_code, model, model_code, device_category, device_subcategory, data_direction, protocol, transport, default_port, default_baud_rate, default_data_bits, default_parity, default_stop_bits, default_ae_title, default_config, field_mappings, data_transforms, qc_recommendations, known_quirks, supported_tests, adapter_version, sdk_version, wasm_hash, wasm_size_bytes, is_verified, contributed_by, documentation_url, download_count, install_count, is_active, created_at, updated_at, deleted_at, deleted_by, delete_reason) VALUES
	('1a6ede36-f4b5-49fa-b7d6-fcd3006efa80', 'roche_cobas_c311', 'Roche', 'roche', 'cobas c311', 'cobas_c311', 'lab_chemistry', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '["8N1 framing", "Sends ENQ before each ASTM frame"]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('cae0893b-d685-4295-8009-ce4ae624f693', 'roche_cobas_c501', 'Roche', 'roche', 'cobas c501', 'cobas_c501', 'lab_chemistry', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('9b5ec8b3-7ed2-4ca8-b76a-d5d22e0ec1c3', 'roche_cobas_e411', 'Roche', 'roche', 'cobas e411', 'cobas_e411', 'lab_immunoassay', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('2d01686a-1a23-4250-afd3-44fc66ad7f0b', 'roche_cobas_h232', 'Roche', 'roche', 'cobas h232', 'cobas_h232', 'lab_immunoassay', NULL, 'producer', 'hl7_v2', 'tcp', 5100, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('86cf99c7-f6ec-44ca-a1d6-f326473ea80a', 'sysmex_xn1000', 'Sysmex', 'sysmex', 'XN-1000', 'xn_1000', 'lab_hematology', NULL, 'producer', 'astm_e1381', 'tcp', 12000, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '["Uses ASTM over TCP, not serial"]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('39a05b85-e278-4870-a9c6-8659ee9c9aef', 'sysmex_xn550', 'Sysmex', 'sysmex', 'XN-550', 'xn_550', 'lab_hematology', NULL, 'producer', 'astm_e1381', 'tcp', 12000, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('80e7fa4c-2ed7-4ced-8410-ad47afd17daa', 'sysmex_xp100', 'Sysmex', 'sysmex', 'XP-100', 'xp_100', 'lab_hematology', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('fd2466f2-dbaa-49be-be31-2f032d72d470', 'sysmex_kx21', 'Sysmex', 'sysmex', 'KX-21', 'kx_21', 'lab_hematology', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '["Older RS-232 only model still common in India"]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('25e449e6-4aaf-4f5b-8854-27bcb8a4e4f5', 'beckman_au480', 'Beckman Coulter', 'beckman', 'AU480', 'au480', 'lab_chemistry', NULL, 'producer', 'astm_e1381', 'tcp', 5000, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('96645656-fa87-4f8e-a81e-7bf3e037c5e6', 'beckman_dxh800', 'Beckman Coulter', 'beckman', 'DxH 800', 'dxh_800', 'lab_hematology', NULL, 'producer', 'astm_e1381', 'tcp', 5000, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('b71b7e3b-4d30-49a7-afa6-b8d7e55c1037', 'beckman_access2', 'Beckman Coulter', 'beckman', 'Access 2', 'access_2', 'lab_immunoassay', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('03a3b128-c11d-47bb-8f74-c8e60b5fb5df', 'mindray_bs240', 'Mindray', 'mindray', 'BS-240', 'bs_240', 'lab_chemistry', NULL, 'producer', 'hl7_v2', 'tcp', 5100, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('fefdeab3-c4a9-468b-b92a-763b15240cc5', 'mindray_bc5150', 'Mindray', 'mindray', 'BC-5150', 'bc_5150', 'lab_hematology', NULL, 'producer', 'hl7_v2', 'tcp', 5100, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('2d1c8d9d-9455-4dc9-a14a-945b83280317', 'mindray_bc3000', 'Mindray', 'mindray', 'BC-3000 Plus', 'bc_3000_plus', 'lab_hematology', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('1d1482d5-996b-4435-a810-b723339e9b0c', 'mindray_benevision_n1', 'Mindray', 'mindray', 'BeneVision N1', 'benevision_n1', 'patient_monitor', NULL, 'producer', 'hl7_v2', 'tcp', 2575, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('d62f9276-fbe3-4bed-a409-81e0722affaf', 'abbott_architect_c4000', 'Abbott', 'abbott', 'Architect c4000', 'architect_c4000', 'lab_chemistry', NULL, 'producer', 'astm_e1381', 'tcp', 5000, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('d96038c8-0ddd-4a36-89d3-7c65b0ac1dff', 'abbott_celldyn_ruby', 'Abbott', 'abbott', 'CELL-DYN Ruby', 'celldyn_ruby', 'lab_hematology', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('698c2b67-223c-445e-8303-48500fdafb24', 'siemens_atellica_ch', 'Siemens', 'siemens', 'Atellica CH 930', 'atellica_ch930', 'lab_chemistry', NULL, 'producer', 'hl7_v2', 'tcp', 5101, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('dd5e2605-35ec-4e97-af2b-6ad693c33b1a', 'siemens_dimension_exl', 'Siemens', 'siemens', 'Dimension EXL 200', 'dimension_exl200', 'lab_chemistry', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('c9edd7c1-efac-454b-bfe2-7b5e4580a4c2', 'erba_em200', 'Transasia Erba', 'erba', 'EM 200', 'em_200', 'lab_chemistry', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '["Very common in Indian mid-size labs"]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('c6b442dc-6af1-45ae-a948-239142bfac90', 'erba_xl200', 'Transasia Erba', 'erba', 'XL-200', 'xl_200', 'lab_chemistry', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('013740c7-174a-4b79-b916-f3218609159a', 'erba_elite5', 'Transasia Erba', 'erba', 'Elite 5', 'elite_5', 'lab_hematology', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('c89b3587-66ce-4455-a52d-665c4b808105', 'horiba_yumizen_h500', 'Horiba', 'horiba', 'Yumizen H500', 'yumizen_h500', 'lab_hematology', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('71029d46-7da7-41c1-9485-65e2f6727069', 'horiba_pentra_c400', 'Horiba', 'horiba', 'Pentra C400', 'pentra_c400', 'lab_chemistry', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('24e424f1-a043-4612-a2a1-93b0814556c2', 'werfen_acl_elite_pro', 'Werfen', 'werfen', 'ACL Elite Pro', 'acl_elite_pro', 'lab_coagulation', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('b208e5e9-4de0-49d3-a7cd-65702ed85dde', 'stago_sta_compact', 'Stago', 'stago', 'STA Compact Max', 'sta_compact_max', 'lab_coagulation', NULL, 'producer', 'astm_e1381', 'serial', NULL, 9600, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('f884d5f0-891c-4848-b57b-548ca72c7299', 'radiometer_abl90', 'Radiometer', 'radiometer', 'ABL90 FLEX', 'abl90_flex', 'lab_blood_gas', NULL, 'producer', 'hl7_v2', 'tcp', 6000, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('0fb77458-2b63-483a-a120-5450575586fc', 'philips_intellivue_mx450', 'Philips', 'philips', 'IntelliVue MX450', 'intellivue_mx450', 'patient_monitor', NULL, 'producer', 'hl7_v2', 'tcp', 2575, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '["HL7 MLLP framing (0x0B/0x1C0x0D)"]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('e4424fb1-6aef-4901-b788-8024c92651a2', 'ge_carescape_b650', 'GE Healthcare', 'ge', 'CARESCAPE B650', 'carescape_b650', 'patient_monitor', NULL, 'producer', 'hl7_v2', 'tcp', 2575, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('fa434ead-b8ae-4e27-a8c2-a8be58b824e4', 'nihon_kohden_lifescope', 'Nihon Kohden', 'nihon_kohden', 'Life Scope G9', 'lifescope_g9', 'patient_monitor', NULL, 'producer', 'hl7_v2', 'tcp', 2575, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL),
	('79f029f8-865b-4804-9500-13626c8090ad', 'ge_mac2000', 'GE Healthcare', 'ge', 'MAC 2000 ECG', 'mac_2000', 'ecg_machine', NULL, 'producer', 'hl7_v2', 'tcp', 9100, NULL, 8, 'none', 1, NULL, '{}', '[]', '[]', '[]', '[]', '[]', '1.0.0', '0.1.0', NULL, NULL, true, 'medbrains', NULL, 0, 0, true, '2026-08-12 05:33:27.407981+00', '2026-08-12 05:33:27.407981+00', NULL, NULL, NULL);

-- Data for Name: geo_countries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.geo_countries (id, code, name, phone_code, currency, is_active, default_locale, default_timezone, date_format, measurement_system, deleted_at, deleted_by, delete_reason) VALUES
	('c6c00974-355d-40b0-a6e2-12cea53a7147', 'IN', 'India', '+91', 'INR', true, 'en', 'Asia/Kolkata', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL),
	('b13d8cb1-e1d8-4448-8bd9-45eae3c28ab4', 'AE', 'United Arab Emirates', '+971', 'AED', true, 'en', 'Asia/Dubai', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL),
	('d2239bf3-5d5c-4276-b736-bcad02adceae', 'SA', 'Saudi Arabia', '+966', 'SAR', true, 'ar', 'Asia/Riyadh', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL),
	('53dbac3d-cc8c-4c2e-8a36-3a65400ea4da', 'QA', 'Qatar', '+974', 'QAR', true, 'ar', 'Asia/Qatar', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL),
	('d686f0a7-22fe-470f-8f95-ae4f357096b4', 'KW', 'Kuwait', '+965', 'KWD', true, 'ar', 'Asia/Kuwait', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL),
	('59fc5a60-d26a-4170-80bc-6cfb68fc088e', 'OM', 'Oman', '+968', 'OMR', true, 'ar', 'Asia/Muscat', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL),
	('14a0ff84-768a-4594-a8ab-7efc8cc64c33', 'NP', 'Nepal', '+977', 'NPR', true, 'en', 'Asia/Kathmandu', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL),
	('72ece763-cc12-4b2a-9381-b60d1078212e', 'BD', 'Bangladesh', '+880', 'BDT', true, 'en', 'Asia/Dhaka', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL),
	('b6658f95-9884-407a-90e0-850896bf4329', 'LK', 'Sri Lanka', '+94', 'LKR', true, 'en', 'Asia/Colombo', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL),
	('189e7465-b00a-4376-9d50-9644de1cbf46', 'SG', 'Singapore', '+65', 'SGD', true, 'en', 'Asia/Singapore', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL),
	('8c4538c6-3802-450c-b7a0-871a89e68ebb', 'GB', 'United Kingdom', '+44', 'GBP', true, 'en', 'Europe/London', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL),
	('e8c8acc1-2aa4-4d9f-8be7-5f627b0b3684', 'US', 'United States', '+1', 'USD', true, 'en', 'America/New_York', 'MM/DD/YYYY', 'imperial', NULL, NULL, NULL),
	('c56f7803-fdcc-4f44-af28-4aff1e481c84', 'CA', 'Canada', '+1', 'CAD', true, 'en', 'America/Toronto', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL),
	('8931a5bc-9790-4d43-a31c-9ddbddb41861', 'AU', 'Australia', '+61', 'AUD', true, 'en', 'Australia/Sydney', 'DD/MM/YYYY', 'metric', NULL, NULL, NULL);

-- Data for Name: geo_states; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.geo_states (id, country_id, code, name, is_active, deleted_at, deleted_by, delete_reason) VALUES
	('8514a50f-2aee-43de-b3e3-1f7cf174f40c', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'AP', 'Andhra Pradesh', true, NULL, NULL, NULL),
	('c9372677-dcb8-4479-831b-daf435ece8ca', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'AR', 'Arunachal Pradesh', true, NULL, NULL, NULL),
	('c358995c-bd1c-4340-8774-88fe18c567d1', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'AS', 'Assam', true, NULL, NULL, NULL),
	('afa2e230-5b33-4d8d-a741-73e620cf3064', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'BR', 'Bihar', true, NULL, NULL, NULL),
	('1ae35376-3baa-40fd-a805-32cdf9466e0d', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'CG', 'Chhattisgarh', true, NULL, NULL, NULL),
	('3b0e516e-0ead-41b4-aa9f-037d98f889cb', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'GA', 'Goa', true, NULL, NULL, NULL),
	('1e68e8e8-1fc7-4648-a28f-3ae489b3efb2', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'GJ', 'Gujarat', true, NULL, NULL, NULL),
	('9ad0d3b4-46a4-4c47-bcaa-fd768ac61555', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'HR', 'Haryana', true, NULL, NULL, NULL),
	('71c4b372-d83d-4fd9-8d0c-c5163b698c5b', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'HP', 'Himachal Pradesh', true, NULL, NULL, NULL),
	('21e28505-db01-4a7d-ab31-24059ab5143f', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'JH', 'Jharkhand', true, NULL, NULL, NULL),
	('44109733-bf82-46d1-847b-fe05f09e2a2e', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'KA', 'Karnataka', true, NULL, NULL, NULL),
	('e5b92018-e02e-49f5-b6e0-5be026497fa5', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'KL', 'Kerala', true, NULL, NULL, NULL),
	('c8755685-eca2-4b3f-bece-530d55b76d73', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'MP', 'Madhya Pradesh', true, NULL, NULL, NULL),
	('fc7c90b3-cb94-4d67-b5ea-2dffd3092657', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'MH', 'Maharashtra', true, NULL, NULL, NULL),
	('f04fdd38-6faf-4369-9458-af6e7d144b1d', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'MN', 'Manipur', true, NULL, NULL, NULL),
	('77a1be35-7181-4e56-8259-740bd2c3b968', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'ML', 'Meghalaya', true, NULL, NULL, NULL),
	('b41ef1b2-81dd-4b40-9eef-6feabf565936', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'MZ', 'Mizoram', true, NULL, NULL, NULL),
	('50736b4d-53ec-4891-b6b8-80e1fd511c81', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'NL', 'Nagaland', true, NULL, NULL, NULL),
	('67978e98-3e4d-4a91-80f6-6d0107561bea', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'OD', 'Odisha', true, NULL, NULL, NULL),
	('479df370-cfbb-4e40-9292-2d564ed521cf', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'PB', 'Punjab', true, NULL, NULL, NULL),
	('5b6570f5-39b8-4eae-a04c-ad6cc195d334', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'RJ', 'Rajasthan', true, NULL, NULL, NULL),
	('24dc5591-4814-4dea-9684-9c96b745f2d1', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'SK', 'Sikkim', true, NULL, NULL, NULL),
	('f8a96d4d-864b-495b-b0bf-51264e928dfe', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'TN', 'Tamil Nadu', true, NULL, NULL, NULL),
	('6e193b59-a591-4c4f-ae7d-94a0ceb8b466', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'TS', 'Telangana', true, NULL, NULL, NULL),
	('ea983bbe-ca34-4337-8447-491a0f3c0743', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'TR', 'Tripura', true, NULL, NULL, NULL),
	('66ff4cf1-6429-4643-8222-1498632c82e0', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'UP', 'Uttar Pradesh', true, NULL, NULL, NULL),
	('8a6055d2-f55d-4a42-9317-8bba08b25a42', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'UK', 'Uttarakhand', true, NULL, NULL, NULL),
	('3ff94939-bf36-4ba4-b838-9c2bf50a0f28', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'WB', 'West Bengal', true, NULL, NULL, NULL),
	('4ae9c1c1-d90a-4a79-86cb-9fa05a186651', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'AN', 'Andaman and Nicobar Islands', true, NULL, NULL, NULL),
	('a1a68b3d-7a28-465a-9b47-6b59d53b608c', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'CH', 'Chandigarh', true, NULL, NULL, NULL),
	('cbe1f710-de26-435a-a667-989f2203e4de', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'DH', 'Dadra and Nagar Haveli and Daman and Diu', true, NULL, NULL, NULL),
	('16a33b32-36e8-4609-b4c3-92639ece6bb9', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'DL', 'Delhi', true, NULL, NULL, NULL),
	('d70c8ae4-b581-4b2d-a45e-4fe1e9ad6664', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'JK', 'Jammu and Kashmir', true, NULL, NULL, NULL),
	('8d45aad3-46ab-4322-9985-277f71f869ea', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'LA', 'Ladakh', true, NULL, NULL, NULL),
	('31ce58b6-b26d-4791-9fdd-9963457ef4f4', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'LD', 'Lakshadweep', true, NULL, NULL, NULL),
	('403c6326-302b-453b-975c-2906d4c6e349', 'c6c00974-355d-40b0-a6e2-12cea53a7147', 'PY', 'Puducherry', true, NULL, NULL, NULL);

-- Data for Name: store_categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.store_categories (id, tenant_id, code, name, parent_id, store_domain, description, requires_batch_tracking, requires_expiry_tracking, requires_temperature_log, requires_license_tracking, is_camp_source, is_active, sort_order, created_at, updated_at, deleted_at, deleted_by, delete_reason) VALUES
	('2cd7e233-47a9-4c97-bee4-5a72d703b09c', NULL, 'PHARMACY', 'Pharmacy store', NULL, 'pharmacy', 'Medicines and pharmacy stock', true, true, true, true, true, true, 10, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('c5b71106-34bb-4aad-b97b-d20d7fc21c45', NULL, 'NDPS_CONTROLLED', 'NDPS / controlled drug store', NULL, 'ndps_controlled', 'Narcotic and controlled medicine stock requiring extra registers', true, true, true, true, false, true, 20, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('c63d2c21-4919-4c02-ac36-8592d1ec8ee7', NULL, 'MEDICAL_CONSUMABLES', 'Medical consumables store', NULL, 'medical_consumables', 'Syringes, cannulas, dressings, strips and ward consumables', true, true, false, false, true, true, 30, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('a08bbe30-f2ac-4d02-8e0b-27cbe0f76c78', NULL, 'SURGICAL_CONSUMABLES', 'Surgical consumables store', NULL, 'surgical_consumables', 'Sutures, implants, OT disposables and procedure packs', true, true, false, false, false, true, 40, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('569e114f-2241-4271-bfb8-29ac5782d536', NULL, 'LAB_REAGENTS', 'Lab reagents and chemicals', NULL, 'lab_reagents', 'Reagents, controls, calibrators and lab chemicals', true, true, true, false, false, true, 50, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('d5a84941-b59f-4a77-a59b-44ff104661a9', NULL, 'CSSD_STERILE', 'CSSD sterile store', NULL, 'cssd_sterile', 'Sterile packs, instruments and sterilisation supplies', true, true, false, false, false, true, 60, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('814f9972-6390-4f11-94f6-7b4c2d689bcb', NULL, 'LINEN_LAUNDRY', 'Linen and laundry store', NULL, 'linen_laundry', 'Linen stock, movement and condemnation', false, false, false, false, false, true, 70, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('2f9f8642-d3b1-4543-88af-577baad0305d', NULL, 'KITCHEN_DIETARY', 'Kitchen and dietary store', NULL, 'kitchen_dietary', 'Food ingredients and dietary supplies', true, true, true, false, false, true, 80, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('94fa093b-8cf4-4e90-a770-f15e773f866b', NULL, 'HOUSEKEEPING', 'Housekeeping store', NULL, 'housekeeping', 'Cleaning supplies and housekeeping consumables', true, true, false, false, false, true, 90, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('1d3700f1-e72c-4623-b24b-18eb4356d2d2', NULL, 'BIOMEDICAL_SPARES', 'Biomedical spares store', NULL, 'biomedical_spares', 'Biomedical spare parts and service stock', true, false, false, false, false, true, 100, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('404434a0-ae31-4687-8031-cc166121883f', NULL, 'IT_STORE', 'IT store', NULL, 'it_store', 'IT accessories, printer media, labels and devices', true, false, false, false, true, true, 110, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('c4cd50c7-9678-438e-9b7f-db19fd4e6755', NULL, 'MAINTENANCE_ENGINEERING', 'Maintenance and engineering store', NULL, 'maintenance_engineering', 'Electrical, plumbing, gas and civil maintenance stock', true, false, false, false, false, true, 120, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('12dd3092-3ece-4442-a02d-f06d77138c2b', NULL, 'PPE_INFECTION_CONTROL', 'PPE and infection control store', NULL, 'ppe_infection_control', 'PPE, disinfectants and infection-control supplies', true, true, false, false, true, true, 130, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('c201b61d-310c-4647-8d9a-6f1021cc75ae', NULL, 'BMW', 'Biomedical waste supplies', NULL, 'biomedical_waste', 'BMW bags, bins, liners, labels and handoff material', true, true, false, true, true, true, 140, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL),
	('3f728f95-c1f1-4442-82e2-cc4163d0274b', NULL, 'CAMP_MOBILE_STORE', 'Camp mobile store', NULL, 'camp_mobile', 'Dedicated camp kits, outreach stock and mobile issue locations', true, true, false, false, true, true, 150, '2026-08-12 05:33:21.661321+00', '2026-08-12 05:33:21.661321+00', NULL, NULL, NULL);
