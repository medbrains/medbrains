-- ====================================================================
-- Migration: 1173_seed_default_radiology_catalogue.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Every hospital starts with a radiology catalogue.
--
-- radiology_modalities and radiology_exams shipped empty, so a new hospital's
-- doctor opened the order basket's Radiology tab, met "No imaging modality is
-- set up yet" and could order nothing. One function seeds the common
-- modalities (DICOM codes) and the exams Indian OPD/IPD order most, called by
-- a trigger on every new tenant and once below for the ones that have none.
--
-- A hospital that already set up its own modalities is left alone entirely:
-- its codes would sit beside ours as duplicates. Exams carry body part,
-- laterality, contrast and the preparation patients are told; charge codes
-- and SNOMED body-site codes stay empty for the hospital to map.
--
-- radiology_exams FORCEs row-level security, so the function sets the
-- tenant context for its own inserts and puts the caller's back after.

CREATE OR REPLACE FUNCTION seed_default_radiology_catalogue(p_tenant uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prior text := current_setting('app.tenant_id', true);
BEGIN
  IF EXISTS (SELECT 1 FROM radiology_modalities WHERE tenant_id = p_tenant) THEN
    RETURN;
  END IF;
  PERFORM set_config('app.tenant_id', p_tenant::text, true);

  INSERT INTO radiology_modalities (tenant_id, code, name, description)
  SELECT p_tenant, m.code, m.name, m.description
    FROM (VALUES
      ('DX',  'X-ray',              'Digital radiography'),
      ('CT',  'CT',                 'Computed tomography'),
      ('MR',  'MRI',                'Magnetic resonance imaging'),
      ('US',  'Ultrasound',         'Ultrasonography and Doppler'),
      ('MG',  'Mammography',        'Breast imaging'),
      ('RF',  'Fluoroscopy',        'Contrast studies under fluoroscopy'),
      ('BMD', 'DEXA',               'Bone densitometry')
    ) AS m(code, name, description)
  ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL DO NOTHING;

  INSERT INTO radiology_exams
    (tenant_id, modality_id, code, name, body_part, laterality_required, contrast, synonyms, preparation)
  SELECT p_tenant, rm.id, e.code, e.name, e.body_part, e.laterality, e.contrast, e.synonyms, e.preparation
    FROM (VALUES
      -- X-ray
      ('DX','XR-CHEST-PA','X-ray chest PA','Chest',false,'none','{cxr,"chest x-ray"}'::text[],NULL),
      ('DX','XR-CHEST-AP','X-ray chest AP (portable)','Chest',false,'none','{"portable chest","bedside x-ray"}',NULL),
      ('DX','XR-ABD-ERECT','X-ray abdomen erect','Abdomen',false,'none','{axr,"abdomen x-ray"}',NULL),
      ('DX','XR-KUB','X-ray KUB','Kidneys, ureters, bladder',false,'none','{kub}',NULL),
      ('DX','XR-PNS','X-ray PNS (Waters view)','Paranasal sinuses',false,'none','{"sinus x-ray",waters}',NULL),
      ('DX','XR-SKULL','X-ray skull AP/lateral','Skull',false,'none','{}',NULL),
      ('DX','XR-CSPINE','X-ray cervical spine AP/lateral','Cervical spine',false,'none','{"c spine","neck x-ray"}',NULL),
      ('DX','XR-LSSPINE','X-ray lumbosacral spine AP/lateral','Lumbosacral spine',false,'none','{"ls spine","back x-ray"}',NULL),
      ('DX','XR-PELVIS','X-ray pelvis AP','Pelvis',false,'none','{}',NULL),
      ('DX','XR-SHOULDER','X-ray shoulder','Shoulder',true,'none','{}',NULL),
      ('DX','XR-ELBOW','X-ray elbow','Elbow',true,'none','{}',NULL),
      ('DX','XR-FOREARM','X-ray forearm','Forearm',true,'none','{}',NULL),
      ('DX','XR-WRIST','X-ray wrist','Wrist',true,'none','{}',NULL),
      ('DX','XR-HAND','X-ray hand','Hand',true,'none','{}',NULL),
      ('DX','XR-HIP','X-ray hip','Hip',true,'none','{}',NULL),
      ('DX','XR-KNEE','X-ray knee AP/lateral','Knee',true,'none','{}',NULL),
      ('DX','XR-LEG','X-ray leg (tibia and fibula)','Leg',true,'none','{"tibia fibula"}',NULL),
      ('DX','XR-ANKLE','X-ray ankle','Ankle',true,'none','{}',NULL),
      ('DX','XR-FOOT','X-ray foot','Foot',true,'none','{}',NULL),
      -- Ultrasound
      ('US','US-ABD','Ultrasound abdomen','Abdomen',false,'none','{usg,"usg abdomen"}','Fast for 6 hours. Water is allowed.'),
      ('US','US-ABD-PELVIS','Ultrasound abdomen and pelvis','Abdomen and pelvis',false,'none','{"usg whole abdomen"}','Fast for 6 hours. Drink 1 litre of water an hour before and do not pass urine.'),
      ('US','US-KUB','Ultrasound KUB','Kidneys, ureters, bladder',false,'none','{"usg kub"}','Drink 1 litre of water an hour before and do not pass urine.'),
      ('US','US-PELVIS','Ultrasound pelvis','Pelvis',false,'none','{"usg pelvis"}','Drink 1 litre of water an hour before and do not pass urine.'),
      ('US','US-OBS','Ultrasound obstetric','Gravid uterus',false,'none','{"obstetric scan","anomaly scan","growth scan","nt scan"}','Early pregnancy: come with a full bladder.'),
      ('US','US-TVS','Transvaginal ultrasound','Pelvis',false,'none','{tvs}','Empty your bladder before the scan.'),
      ('US','US-THYROID','Ultrasound neck (thyroid)','Neck',false,'none','{"usg thyroid"}',NULL),
      ('US','US-BREAST','Ultrasound breast','Breast',true,'none','{"usg breast"}',NULL),
      ('US','US-SCROTUM','Ultrasound scrotum','Scrotum',false,'none','{"usg testis"}',NULL),
      ('US','US-SOFT','Ultrasound soft tissue (swelling)','Soft tissue',false,'none','{"usg swelling"}',NULL),
      ('US','US-DOP-LL-VEN','Venous Doppler lower limb','Lower limb',true,'none','{"dvt scan","venous doppler"}',NULL),
      ('US','US-DOP-CAROTID','Carotid Doppler','Neck',false,'none','{"carotid doppler"}',NULL),
      -- CT
      ('CT','CT-BRAIN','NCCT brain','Brain',false,'none','{"ct head","plain ct brain"}',NULL),
      ('CT','CT-BRAIN-C','CECT brain','Brain',false,'with','{"contrast ct brain"}','Serum creatinine within 7 days. Fast for 4 hours.'),
      ('CT','CT-PNS','CT PNS','Paranasal sinuses',false,'none','{"ct sinus"}',NULL),
      ('CT','CT-TEMPORAL','CT temporal bone','Temporal bone',false,'none','{}',NULL),
      ('CT','CT-CSPINE','CT cervical spine','Cervical spine',false,'none','{}',NULL),
      ('CT','CT-CHEST-HR','HRCT chest','Chest',false,'none','{hrct}',NULL),
      ('CT','CT-CHEST-C','CECT chest','Chest',false,'with','{}','Serum creatinine within 7 days. Fast for 4 hours.'),
      ('CT','CT-ABD-C','CECT abdomen and pelvis','Abdomen and pelvis',false,'with','{"cect abdomen","ct abdomen"}','Serum creatinine within 7 days. Fast for 4 hours. Drink the oral contrast as instructed.'),
      ('CT','CT-KUB','NCCT KUB','Kidneys, ureters, bladder',false,'none','{"ct kub","stone protocol"}',NULL),
      ('CT','CTA-BRAIN','CT angiography brain','Brain',false,'with','{"cta brain"}','Serum creatinine within 7 days. Fast for 4 hours.'),
      ('CT','CTPA','CT pulmonary angiography','Chest',false,'with','{ctpa}','Serum creatinine within 7 days.'),
      -- MRI
      ('MR','MR-BRAIN','MRI brain','Brain',false,'none','{"mri head"}','Remove all metal. Tell staff about a pacemaker, implants, clips or pregnancy.'),
      ('MR','MR-BRAIN-C','MRI brain with contrast','Brain',false,'with','{}','Serum creatinine within 7 days. Remove all metal. Tell staff about a pacemaker, implants, clips or pregnancy.'),
      ('MR','MRA-BRAIN','MR angiography brain','Brain',false,'none','{mra}','Remove all metal. Tell staff about a pacemaker, implants, clips or pregnancy.'),
      ('MR','MR-CSPINE','MRI cervical spine','Cervical spine',false,'none','{"mri c spine"}','Remove all metal. Tell staff about a pacemaker, implants, clips or pregnancy.'),
      ('MR','MR-DSPINE','MRI dorsal spine','Dorsal spine',false,'none','{"mri d spine"}','Remove all metal. Tell staff about a pacemaker, implants, clips or pregnancy.'),
      ('MR','MR-LSSPINE','MRI lumbosacral spine','Lumbosacral spine',false,'none','{"mri ls spine","mri back"}','Remove all metal. Tell staff about a pacemaker, implants, clips or pregnancy.'),
      ('MR','MR-SHOULDER','MRI shoulder','Shoulder',true,'none','{}','Remove all metal. Tell staff about a pacemaker, implants, clips or pregnancy.'),
      ('MR','MR-KNEE','MRI knee','Knee',true,'none','{}','Remove all metal. Tell staff about a pacemaker, implants, clips or pregnancy.'),
      ('MR','MR-ABD','MRI abdomen','Abdomen',false,'none','{}','Fast for 4 hours. Remove all metal. Tell staff about a pacemaker, implants, clips or pregnancy.'),
      ('MR','MRCP','MRCP','Biliary tree',false,'none','{}','Fast for 4 hours. Remove all metal. Tell staff about a pacemaker, implants, clips or pregnancy.'),
      ('MR','MR-PELVIS','MRI pelvis','Pelvis',false,'none','{}','Remove all metal. Tell staff about a pacemaker, implants, clips or pregnancy.'),
      -- Mammography
      ('MG','MG-SCREEN','Screening mammography (both breasts)','Breast',false,'none','{mammogram}','No deodorant, talc or lotion on the day.'),
      ('MG','MG-DIAG','Diagnostic mammography','Breast',true,'none','{}','No deodorant, talc or lotion on the day.'),
      -- Fluoroscopy
      ('RF','RF-BA-SWALLOW','Barium swallow','Oesophagus',false,'with','{}','Nothing by mouth for 6 hours.'),
      ('RF','RF-BA-MEAL','Barium meal follow-through','Stomach and small bowel',false,'with','{bmft}','Nothing by mouth for 8 hours.'),
      ('RF','RF-HSG','Hysterosalpingography','Uterus and fallopian tubes',false,'with','{hsg}','Book for day 7 to 10 of the cycle, after bleeding stops.'),
      ('RF','RF-MCU','Micturating cystourethrogram','Bladder and urethra',false,'with','{mcu,mcug}',NULL),
      ('RF','RF-IVU','Intravenous urography','Kidneys, ureters, bladder',false,'with','{ivu,ivp}','Serum creatinine within 7 days. Bowel preparation as instructed.'),
      -- DEXA
      ('BMD','DEXA','DEXA scan (spine and hip)','Lumbar spine and hip',false,'none','{"bone density",bmd}','No calcium supplements for 24 hours before.')
    ) AS e(modality, code, name, body_part, laterality, contrast, synonyms, preparation)
    JOIN radiology_modalities rm
      ON rm.tenant_id = p_tenant AND rm.code = e.modality AND rm.deleted_at IS NULL
   WHERE NOT EXISTS (SELECT 1 FROM radiology_exams x WHERE x.tenant_id = p_tenant AND x.code = e.code)
  ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL DO NOTHING;

  PERFORM set_config('app.tenant_id', coalesce(prior, ''), true);
END;
$$;

CREATE OR REPLACE FUNCTION trg_seed_default_radiology_catalogue() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM seed_default_radiology_catalogue(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_seed_radiology_catalogue ON tenants;
CREATE TRIGGER trg_tenants_seed_radiology_catalogue
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION trg_seed_default_radiology_catalogue();

SELECT seed_default_radiology_catalogue(id) FROM tenants;
