use serde_json::json;
use sqlx::{Postgres, Transaction};

struct AdapterSeed {
    adapter_code: &'static str,
    manufacturer: &'static str,
    manufacturer_code: &'static str,
    model: &'static str,
    model_code: &'static str,
    category: &'static str,
    subcategory: &'static str,
    direction: &'static str,
    protocol: &'static str,
    transport: &'static str,
    default_port: Option<i32>,
    default_baud_rate: Option<i32>,
    default_ae_title: Option<&'static str>,
    supported_tests: serde_json::Value,
    default_config: serde_json::Value,
    field_mappings: serde_json::Value,
    quirks: serde_json::Value,
}

struct DeviceSeed {
    adapter_code: &'static str,
    name: &'static str,
    code: &'static str,
    serial_number: &'static str,
    hostname: &'static str,
    port: i32,
    department_code: &'static str,
    protocol_config: serde_json::Value,
    field_mappings: serde_json::Value,
    notes: &'static str,
    tags: Vec<String>,
}

struct LabResultSeed {
    uhid: &'static str,
    test_code: &'static str,
    sample_barcode: &'static str,
    priority: &'static str,
    parameters: &'static [(
        &'static str,
        &'static str,
        &'static str,
        &'static str,
        &'static str,
    )],
}

const HL7_COBAS_PAYLOAD: &str = "MSH|^~\\&|COBAS_C311|BIOCHEM|MEDBRAINS|HMS|20260511101000||ORU^R01|MB-LAB-0001|P|2.5\rPID|1||DEMO-00001||DEMO^RAJESH||19850315|M\rOBR|1|LAB-DEMO-RBS-0001|LAB-DEMO-RBS-0001|RBS^Random Blood Sugar^L\rOBX|1|NM|RBS^Random Blood Sugar^L||186|mg/dL|70-140|H|||F\r";

const ASTM_SYSMEX_PAYLOAD: &str = "H|\\^&|||SYSMEX-XN1000^01|||||||P|1|20260511101500\rP|1|DEMO-00003|||DEMO^ARUN||19781108|M\rO|1|LAB-DEMO-CBC-0003||CBC^Complete Blood Count|R|20260511101200|||||N||||||||||||||F\rR|1|WBC^White Blood Cells|12.8|10^3/uL|4.0-11.0|H|||F\rR|2|HGB^Hemoglobin|13.2|g/dL|13-17|N|||F\rL|1|N\r";

pub(super) async fn seed_device_integration_fixtures(
    pool: &sqlx::PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    seed_adapter_catalog(&mut tx).await?;

    let admin_user_id: uuid::Uuid =
        sqlx::query_scalar("SELECT id FROM users WHERE tenant_id = $1 AND username = 'admin'")
            .bind(tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let bridge_agent_id = seed_bridge_agent(&mut tx, tenant_id).await?;
    let device_ids =
        seed_device_instances(&mut tx, tenant_id, bridge_agent_id, admin_user_id).await?;
    seed_routing_rules(&mut tx, tenant_id, admin_user_id, &device_ids).await?;
    let first_result_id = seed_lab_machine_results(&mut tx, tenant_id, admin_user_id).await?;
    seed_device_messages(&mut tx, tenant_id, &device_ids, first_result_id).await?;

    tx.commit().await?;
    tracing::info!("Seeded live-machine integration fixtures");
    Ok(())
}

async fn seed_adapter_catalog(
    tx: &mut Transaction<'_, Postgres>,
) -> Result<(), Box<dyn std::error::Error>> {
    let adapters = vec![
        AdapterSeed {
            adapter_code: "demo_roche_cobas_c311_hl7",
            manufacturer: "Roche Diagnostics",
            manufacturer_code: "ROCHE",
            model: "cobas c 311 chemistry analyzer",
            model_code: "COBAS_C311",
            category: "lab_chemistry",
            subcategory: "biochemistry",
            direction: "producer",
            protocol: "hl7_v2",
            transport: "tcp",
            default_port: Some(2575),
            default_baud_rate: None,
            default_ae_title: None,
            supported_tests: json!(["RBS", "FBS", "PPBS", "CREAT", "ALT", "AST", "CHOL"]),
            default_config: json!({
                "hl7_version": "2.5",
                "message_type": "ORU^R01",
                "framing": "mllp",
                "ack_mode": "application",
                "simulator_command": "node scripts/simulators/hl7_oru_sender.mjs"
            }),
            field_mappings: json!([
                {"source": "PID.3", "target": "identifiers.patient_id"},
                {"source": "OBR.3", "target": "identifiers.sample_barcode"},
                {"source": "OBX.3", "target": "results[].test_code"},
                {"source": "OBX.5", "target": "results[].value"},
                {"source": "OBX.6", "target": "results[].unit"},
                {"source": "OBX.7", "target": "results[].reference_range"},
                {"source": "OBX.8", "target": "results[].abnormal_flag"}
            ]),
            quirks: json!(["Some installations use OBR.2 instead of OBR.3 for sample barcode"]),
        },
        AdapterSeed {
            adapter_code: "demo_sysmex_xn1000_astm",
            manufacturer: "Sysmex",
            manufacturer_code: "SYSMEX",
            model: "XN-1000 hematology analyzer",
            model_code: "XN1000",
            category: "lab_hematology",
            subcategory: "cbc",
            direction: "producer",
            protocol: "astm_e1381",
            transport: "serial",
            default_port: None,
            default_baud_rate: Some(9600),
            default_ae_title: None,
            supported_tests: json!(["CBC", "HB", "WBC", "PLT"]),
            default_config: json!({
                "serial": {"baud_rate": 9600, "data_bits": 8, "parity": "none", "stop_bits": 1},
                "checksum": "ASTM",
                "handshake": "ENQ_ACK_EOT",
                "simulator_command": "node scripts/simulators/astm_result_sender.mjs"
            }),
            field_mappings: json!([
                {"source": "P.3", "target": "identifiers.patient_id"},
                {"source": "O.3", "target": "identifiers.sample_barcode"},
                {"source": "R.2", "target": "results[].test_code"},
                {"source": "R.3", "target": "results[].value"},
                {"source": "R.4", "target": "results[].unit"},
                {"source": "R.5", "target": "results[].reference_range"},
                {"source": "R.6", "target": "results[].abnormal_flag"}
            ]),
            quirks: json!(["Serial bridges must preserve CR terminators"]),
        },
        AdapterSeed {
            adapter_code: "demo_orthanc_pacs_dicomweb",
            manufacturer: "Orthanc",
            manufacturer_code: "ORTHANC",
            model: "Orthanc PACS / DICOMweb Gateway",
            model_code: "ORTHANC_DICOMWEB",
            category: "pacs_server",
            subcategory: "dicomweb",
            direction: "bidirectional",
            protocol: "dicom",
            transport: "http",
            default_port: Some(8042),
            default_baud_rate: None,
            default_ae_title: Some("ORTHANC"),
            supported_tests: json!(["CT", "MR", "US", "CR", "DX"]),
            default_config: json!({
                "dicomweb": true,
                "qido_rs": "/dicom-web/studies",
                "wado_rs": "/dicom-web/studies/{study}/series/{series}/instances/{instance}",
                "stow_rs": "/dicom-web/studies",
                "simulator_url": "http://127.0.0.1:8042"
            }),
            field_mappings: json!([
                {"source": "StudyInstanceUID", "target": "study_instance_uid"},
                {"source": "AccessionNumber", "target": "accession_number"},
                {"source": "Modality", "target": "modality"},
                {"source": "PatientID", "target": "patient_uhid"}
            ]),
            quirks: json!(["DICOMweb metadata values are arrays of Value objects"]),
        },
        AdapterSeed {
            adapter_code: "demo_ct_modality_dicom",
            manufacturer: "Generic Modality Simulator",
            manufacturer_code: "DVTK",
            model: "CT/MR/X-Ray DICOM modality simulator",
            model_code: "MODALITY_SIM",
            category: "ct_scanner",
            subcategory: "modality",
            direction: "producer",
            protocol: "dicom",
            transport: "tcp",
            default_port: Some(104),
            default_baud_rate: None,
            default_ae_title: Some("CT_SIM"),
            supported_tests: json!(["CT", "MR", "CR", "DX"]),
            default_config: json!({
                "dicom_service_classes": ["C-ECHO", "C-STORE", "C-FIND"],
                "transfer_syntaxes": ["1.2.840.10008.1.2.1"],
                "storage_scp": "ORTHANC"
            }),
            field_mappings: json!([
                {"source": "C_STORE.StudyInstanceUID", "target": "radiology_dicom_studies.study_instance_uid"},
                {"source": "C_STORE.AccessionNumber", "target": "radiology_dicom_studies.accession_number"}
            ]),
            quirks: json!(["AE title and called AE title must match the scanner configuration"]),
        },
    ];

    for adapter in adapters {
        sqlx::query(
            "INSERT INTO device_adapter_catalog \
             (adapter_code, manufacturer, manufacturer_code, model, model_code, \
              device_category, device_subcategory, data_direction, protocol, transport, \
              default_port, default_baud_rate, default_ae_title, default_config, \
              field_mappings, data_transforms, qc_recommendations, known_quirks, \
              supported_tests, adapter_version, sdk_version, is_verified, documentation_url) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'[]','[]',$16,$17, \
              '1.0.0','0.1.0',true,'https://medbrains.localhost/admin/devices') \
             ON CONFLICT (adapter_code) DO UPDATE SET \
              manufacturer = EXCLUDED.manufacturer, manufacturer_code = EXCLUDED.manufacturer_code, \
              model = EXCLUDED.model, model_code = EXCLUDED.model_code, \
              device_category = EXCLUDED.device_category, device_subcategory = EXCLUDED.device_subcategory, \
              data_direction = EXCLUDED.data_direction, protocol = EXCLUDED.protocol, \
              transport = EXCLUDED.transport, default_port = EXCLUDED.default_port, \
              default_baud_rate = EXCLUDED.default_baud_rate, default_ae_title = EXCLUDED.default_ae_title, \
              default_config = EXCLUDED.default_config, field_mappings = EXCLUDED.field_mappings, \
              known_quirks = EXCLUDED.known_quirks, supported_tests = EXCLUDED.supported_tests, \
              is_verified = true, is_active = true, updated_at = now()",
        )
        .bind(adapter.adapter_code)
        .bind(adapter.manufacturer)
        .bind(adapter.manufacturer_code)
        .bind(adapter.model)
        .bind(adapter.model_code)
        .bind(adapter.category)
        .bind(adapter.subcategory)
        .bind(adapter.direction)
        .bind(adapter.protocol)
        .bind(adapter.transport)
        .bind(adapter.default_port)
        .bind(adapter.default_baud_rate)
        .bind(adapter.default_ae_title)
        .bind(adapter.default_config)
        .bind(adapter.field_mappings)
        .bind(adapter.quirks)
        .bind(adapter.supported_tests)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

async fn seed_bridge_agent(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: uuid::Uuid,
) -> Result<uuid::Uuid, sqlx::Error> {
    if let Some(id) = sqlx::query_scalar::<_, uuid::Uuid>(
        "SELECT id FROM bridge_agents WHERE tenant_id = $1 AND name = 'Demo Biomedical Bridge'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    {
        sqlx::query(
            "UPDATE bridge_agents SET status='online', last_heartbeat=now(), devices_connected=4, \
             buffer_depth=0, metadata=$2, updated_at=now() WHERE id=$1",
        )
        .bind(id)
        .bind(json!({
            "fixture_mode": true,
            "site": "Local biomedical LAN",
            "network": "192.168.10.0/24",
            "note": "Simulates on-prem machine bridge for HL7/ASTM/DICOM feeds."
        }))
        .execute(&mut **tx)
        .await?;
        return Ok(id);
    }

    sqlx::query_scalar::<_, uuid::Uuid>(
        "INSERT INTO bridge_agents \
         (tenant_id, name, agent_key_hash, deployment_mode, version, hostname, \
          capabilities, status, last_heartbeat, devices_connected, buffer_depth, metadata) \
         VALUES ($1,'Demo Biomedical Bridge','demo-fixture-key-hash','on_premise','0.1.0', \
          '127.0.0.1', $2, 'online', now(), 4, 0, $3) RETURNING id",
    )
    .bind(tenant_id)
    .bind(vec![
        "hl7_v2".to_owned(),
        "astm_e1381".to_owned(),
        "dicom".to_owned(),
        "dicomweb".to_owned(),
    ])
    .bind(json!({
        "fixture_mode": true,
        "site": "Local biomedical LAN",
        "network": "192.168.10.0/24",
        "note": "Simulates on-prem machine bridge for HL7/ASTM/DICOM feeds."
    }))
    .fetch_one(&mut **tx)
    .await
}

async fn seed_device_instances(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: uuid::Uuid,
    bridge_agent_id: uuid::Uuid,
    admin_user_id: uuid::Uuid,
) -> Result<Vec<(String, uuid::Uuid)>, Box<dyn std::error::Error>> {
    let devices = vec![
        DeviceSeed {
            adapter_code: "demo_roche_cobas_c311_hl7",
            name: "Demo Roche Cobas Chemistry Analyzer",
            code: "DEV-DEMO-COBAS-C311",
            serial_number: "SIM-COBAS-C311-001",
            hostname: "127.0.0.1",
            port: 2575,
            department_code: "PATHOLOGY",
            protocol_config: json!({"mllp": true, "hl7_version": "2.5", "ack_required": true}),
            field_mappings: json!([
                {"source": "OBR.3", "target": "sample_barcode"},
                {"source": "OBX.3", "target": "parameter_name"},
                {"source": "OBX.5", "target": "value"}
            ]),
            notes: "Local HL7 ORU simulator for chemistry result feeds.",
            tags: vec!["demo".to_owned(), "lab".to_owned(), "hl7".to_owned()],
        },
        DeviceSeed {
            adapter_code: "demo_sysmex_xn1000_astm",
            name: "Demo Sysmex Hematology Analyzer",
            code: "DEV-DEMO-SYSMEX-XN1000",
            serial_number: "SIM-SYSMEX-XN1000-001",
            hostname: "127.0.0.1",
            port: 9600,
            department_code: "PATHOLOGY",
            protocol_config: json!({"serial_profile": "9600-8-N-1", "astm_checksum": true}),
            field_mappings: json!([
                {"source": "O.3", "target": "sample_barcode"},
                {"source": "R.2", "target": "parameter_name"},
                {"source": "R.3", "target": "value"}
            ]),
            notes: "Local ASTM E1381 simulator for CBC result feeds.",
            tags: vec!["demo".to_owned(), "lab".to_owned(), "astm".to_owned()],
        },
        DeviceSeed {
            adapter_code: "demo_orthanc_pacs_dicomweb",
            name: "Demo Orthanc PACS",
            code: "DEV-DEMO-ORTHANC-PACS",
            serial_number: "SIM-ORTHANC-001",
            hostname: "127.0.0.1",
            port: 8042,
            department_code: "RADIOLOGY",
            protocol_config: json!({"dicomweb": true, "qido": true, "wado": true, "stow": true}),
            field_mappings: json!([
                {"source": "StudyInstanceUID", "target": "study_instance_uid"},
                {"source": "PatientID", "target": "patient_uhid"}
            ]),
            notes: "Local Orthanc/PACS fixture for DICOMweb metadata and viewer links.",
            tags: vec!["demo".to_owned(), "radiology".to_owned(), "pacs".to_owned()],
        },
        DeviceSeed {
            adapter_code: "demo_ct_modality_dicom",
            name: "Demo CT Modality",
            code: "DEV-DEMO-CT-MODALITY",
            serial_number: "SIM-CT-MODALITY-001",
            hostname: "192.168.10.41",
            port: 104,
            department_code: "RADIOLOGY",
            protocol_config: json!({"called_ae_title": "ORTHANC", "calling_ae_title": "CT_SIM"}),
            field_mappings: json!([
                {"source": "C_STORE.AccessionNumber", "target": "accession_number"}
            ]),
            notes: "Synthetic CT modality profile for C-ECHO/C-STORE acceptance testing.",
            tags: vec![
                "demo".to_owned(),
                "radiology".to_owned(),
                "dicom".to_owned(),
            ],
        },
    ];

    let mut ids = Vec::new();
    for device in devices {
        let department_id: Option<uuid::Uuid> =
            sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id=$1 AND code=$2")
                .bind(tenant_id)
                .bind(device.department_code)
                .fetch_optional(&mut **tx)
                .await?;

        let id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO device_instances \
             (tenant_id, adapter_code, name, code, department_id, serial_number, hostname, port, \
              protocol_config, field_mappings, data_transforms, qc_config, ai_config_version, \
              ai_confidence, config_source, status, last_heartbeat, last_message_at, \
              message_count_24h, bridge_agent_id, notes, tags, created_by, updated_by) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'[]','{}',1,0.96,'imported','active', \
              now(), now(), 2, $11, $12, $13, $14, $14) \
             ON CONFLICT (tenant_id, code) DO UPDATE SET \
              adapter_code=EXCLUDED.adapter_code, name=EXCLUDED.name, department_id=EXCLUDED.department_id, \
              serial_number=EXCLUDED.serial_number, hostname=EXCLUDED.hostname, port=EXCLUDED.port, \
              protocol_config=EXCLUDED.protocol_config, field_mappings=EXCLUDED.field_mappings, \
              status='active', last_heartbeat=now(), last_message_at=now(), bridge_agent_id=EXCLUDED.bridge_agent_id, \
              notes=EXCLUDED.notes, tags=EXCLUDED.tags, updated_by=EXCLUDED.updated_by, updated_at=now() \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(device.adapter_code)
        .bind(device.name)
        .bind(device.code)
        .bind(department_id)
        .bind(device.serial_number)
        .bind(device.hostname)
        .bind(device.port)
        .bind(device.protocol_config)
        .bind(device.field_mappings)
        .bind(bridge_agent_id)
        .bind(device.notes)
        .bind(device.tags)
        .bind(admin_user_id)
        .fetch_one(&mut **tx)
        .await?;

        ids.push((device.code.to_owned(), id));
    }

    Ok(ids)
}

async fn seed_routing_rules(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: uuid::Uuid,
    admin_user_id: uuid::Uuid,
    device_ids: &[(String, uuid::Uuid)],
) -> Result<(), Box<dyn std::error::Error>> {
    let cobas_id = device_id(device_ids, "DEV-DEMO-COBAS-C311");
    let sysmex_id = device_id(device_ids, "DEV-DEMO-SYSMEX-XN1000");
    let pacs_id = device_id(device_ids, "DEV-DEMO-ORTHANC-PACS");

    let rules = vec![
        (
            cobas_id,
            "Roche Cobas HL7 results to Lab",
            "Route ORU^R01 chemistry results by sample barcode into lab_results.",
            "lab",
            "sample_barcode",
            "OBR.3",
            "lab_results",
            json!([
                {"source": "OBX.3", "target": "parameter_name"},
                {"source": "OBX.5", "target": "value"},
                {"source": "OBX.6", "target": "unit"},
                {"source": "OBX.7", "target": "normal_range"},
                {"source": "OBX.8", "target": "flag"}
            ]),
            100,
        ),
        (
            sysmex_id,
            "Sysmex ASTM CBC results to Lab",
            "Route ASTM hematology R-records by sample barcode into lab_results.",
            "lab",
            "sample_barcode",
            "O.3",
            "lab_results",
            json!([
                {"source": "R.2", "target": "parameter_name"},
                {"source": "R.3", "target": "value"},
                {"source": "R.4", "target": "unit"},
                {"source": "R.5", "target": "normal_range"},
                {"source": "R.6", "target": "flag"}
            ]),
            90,
        ),
        (
            pacs_id,
            "Orthanc DICOM studies to Radiology",
            "Route DICOMweb study metadata into radiology_dicom_studies by accession number.",
            "radiology",
            "accession_number",
            "AccessionNumber",
            "radiology_dicom_studies",
            json!([
                {"source": "StudyInstanceUID", "target": "study_instance_uid"},
                {"source": "Modality", "target": "modality"},
                {"source": "PatientID", "target": "patient_uhid"}
            ]),
            80,
        ),
    ];

    for (
        device_instance_id,
        name,
        description,
        target_module,
        match_strategy,
        match_field,
        target_entity,
        field_mappings,
        priority,
    ) in rules
    {
        sqlx::query(
            "INSERT INTO device_routing_rules \
             (tenant_id, device_instance_id, name, description, target_module, match_strategy, \
              match_field, target_entity, field_mappings, transform_rules, auto_verify, \
              notify_on_critical, reject_duplicates, priority, created_by) \
             SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,'[]',false,true,true,$10,$11 \
             WHERE NOT EXISTS (SELECT 1 FROM device_routing_rules WHERE tenant_id=$1 AND name=$3)",
        )
        .bind(tenant_id)
        .bind(device_instance_id)
        .bind(name)
        .bind(description)
        .bind(target_module)
        .bind(match_strategy)
        .bind(match_field)
        .bind(target_entity)
        .bind(field_mappings)
        .bind(priority)
        .bind(admin_user_id)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

async fn seed_lab_machine_results(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: uuid::Uuid,
    admin_user_id: uuid::Uuid,
) -> Result<Option<uuid::Uuid>, Box<dyn std::error::Error>> {
    let seeds = [
        LabResultSeed {
            uhid: "DEMO-00001",
            test_code: "RBS",
            sample_barcode: "LAB-DEMO-RBS-0001",
            priority: "urgent",
            parameters: &[("Random Blood Sugar", "186", "mg/dL", "70-140", "high")],
        },
        LabResultSeed {
            uhid: "DEMO-00003",
            test_code: "CBC",
            sample_barcode: "LAB-DEMO-CBC-0003",
            priority: "routine",
            parameters: &[
                ("WBC", "12.8", "10^3/uL", "4.0-11.0", "high"),
                ("Hemoglobin", "13.2", "g/dL", "13-17", "normal"),
                ("Platelets", "2.4", "lakh/cumm", "1.5-4.0", "normal"),
            ],
        },
    ];

    let mut first_result_id = None;

    for seed in seeds {
        let patient_id: Option<uuid::Uuid> =
            sqlx::query_scalar("SELECT id FROM patients WHERE tenant_id=$1 AND uhid=$2")
                .bind(tenant_id)
                .bind(seed.uhid)
                .fetch_optional(&mut **tx)
                .await?;
        let Some(patient_id) = patient_id else {
            tracing::warn!(
                uhid = seed.uhid,
                "Skipping lab machine fixture; patient missing"
            );
            continue;
        };

        let encounter_id: Option<uuid::Uuid> = sqlx::query_scalar(
            "SELECT id FROM encounters WHERE tenant_id=$1 AND patient_id=$2 ORDER BY created_at DESC LIMIT 1",
        )
        .bind(tenant_id)
        .bind(patient_id)
        .fetch_optional(&mut **tx)
        .await?;
        let Some(encounter_id) = encounter_id else {
            tracing::warn!(
                uhid = seed.uhid,
                "Skipping lab machine fixture; encounter missing"
            );
            continue;
        };

        let test_id: Option<uuid::Uuid> =
            sqlx::query_scalar("SELECT id FROM lab_test_catalog WHERE tenant_id=$1 AND code=$2")
                .bind(tenant_id)
                .bind(seed.test_code)
                .fetch_optional(&mut **tx)
                .await?;
        let Some(test_id) = test_id else {
            tracing::warn!(
                test_code = seed.test_code,
                "Skipping lab machine fixture; lab catalog test missing"
            );
            continue;
        };

        let order_id = if let Some(id) = sqlx::query_scalar::<_, uuid::Uuid>(
            "SELECT id FROM lab_orders WHERE tenant_id=$1 AND sample_barcode=$2 LIMIT 1",
        )
        .bind(tenant_id)
        .bind(seed.sample_barcode)
        .fetch_optional(&mut **tx)
        .await?
        {
            sqlx::query(
                "UPDATE lab_orders SET status='verified', report_status='final', is_report_locked=true, \
                 verified_by=$3, verified_at=now(), completed_at=now(), updated_at=now() WHERE id=$1 AND tenant_id=$2",
            )
            .bind(id)
            .bind(tenant_id)
            .bind(admin_user_id)
            .execute(&mut **tx)
            .await?;
            id
        } else {
            sqlx::query_scalar::<_, uuid::Uuid>(
                "INSERT INTO lab_orders \
                 (tenant_id, encounter_id, patient_id, test_id, ordered_by, status, priority, \
                  collected_at, collected_by, verified_by, verified_at, sample_barcode, \
                  report_status, is_report_locked, completed_at, created_by, notes) \
                 VALUES ($1,$2,$3,$4,$5,'verified',$6::lab_priority,now(),$5,$5,now(),$7, \
                  'final',true,now(),$5,'Seeded from demo live-machine feed') RETURNING id",
            )
            .bind(tenant_id)
            .bind(encounter_id)
            .bind(patient_id)
            .bind(test_id)
            .bind(admin_user_id)
            .bind(seed.priority)
            .bind(seed.sample_barcode)
            .fetch_one(&mut **tx)
            .await?
        };

        for (parameter_name, value, unit, range, flag) in seed.parameters {
            let result_id = if let Some(id) = sqlx::query_scalar::<_, uuid::Uuid>(
                "SELECT id FROM lab_results WHERE tenant_id=$1 AND order_id=$2 AND parameter_name=$3 LIMIT 1",
            )
            .bind(tenant_id)
            .bind(order_id)
            .bind(parameter_name)
            .fetch_optional(&mut **tx)
            .await?
            {
                sqlx::query(
                    "UPDATE lab_results SET value=$4, unit=$5, normal_range=$6, flag=$7::lab_result_flag, \
                     entered_by=$8, is_auto_validated=true, updated_at=now() \
                     WHERE id=$1 AND tenant_id=$2 AND order_id=$3",
                )
                .bind(id)
                .bind(tenant_id)
                .bind(order_id)
                .bind(value)
                .bind(unit)
                .bind(range)
                .bind(flag)
                .bind(admin_user_id)
                .execute(&mut **tx)
                .await?;
                id
            } else {
                sqlx::query_scalar::<_, uuid::Uuid>(
                    "INSERT INTO lab_results \
                     (tenant_id, order_id, parameter_name, value, unit, normal_range, flag, \
                      entered_by, is_auto_validated, notes) \
                     VALUES ($1,$2,$3,$4,$5,$6,$7::lab_result_flag,$8,true, \
                      'Seeded from demo live-machine feed') RETURNING id",
                )
                .bind(tenant_id)
                .bind(order_id)
                .bind(parameter_name)
                .bind(value)
                .bind(unit)
                .bind(range)
                .bind(flag)
                .bind(admin_user_id)
                .fetch_one(&mut **tx)
                .await?
            };

            if first_result_id.is_none() {
                first_result_id = Some(result_id);
            }
        }
    }

    Ok(first_result_id)
}

async fn seed_device_messages(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: uuid::Uuid,
    device_ids: &[(String, uuid::Uuid)],
    first_result_id: Option<uuid::Uuid>,
) -> Result<(), Box<dyn std::error::Error>> {
    let cobas_id = device_id(device_ids, "DEV-DEMO-COBAS-C311");
    let sysmex_id = device_id(device_ids, "DEV-DEMO-SYSMEX-XN1000");
    let pacs_id = device_id(device_ids, "DEV-DEMO-ORTHANC-PACS");

    let messages = vec![
        (
            cobas_id,
            "hl7_v2",
            "cobas-rbs-hl7-001",
            HL7_COBAS_PAYLOAD.as_bytes().to_vec(),
            json!({
                "fixture_id": "cobas-rbs-hl7-001",
                "message_type": "ORU^R01",
                "MSH.3": "COBAS_C311",
                "PID.3": "DEMO-00001",
                "OBR.3": "LAB-DEMO-RBS-0001",
                "OBX.3": "RBS",
                "OBX.5": "186",
                "OBX.6": "mg/dL",
                "OBX.7": "70-140",
                "OBX.8": "H"
            }),
            json!({
                "fixture_id": "cobas-rbs-hl7-001",
                "identifiers": {"patient_id": "DEMO-00001", "sample_barcode": "LAB-DEMO-RBS-0001"},
                "results": [{
                    "test_code": "Random Blood Sugar",
                    "value": "186",
                    "unit": "mg/dL",
                    "reference_range": "70-140",
                    "abnormal_flag": "H"
                }]
            }),
            "lab",
            first_result_id,
        ),
        (
            sysmex_id,
            "astm_e1381",
            "sysmex-cbc-astm-001",
            ASTM_SYSMEX_PAYLOAD.as_bytes().to_vec(),
            json!({
                "fixture_id": "sysmex-cbc-astm-001",
                "H.5": "SYSMEX-XN1000",
                "P.3": "DEMO-00003",
                "O.3": "LAB-DEMO-CBC-0003",
                "R": ["WBC=12.8 H", "HGB=13.2 N"]
            }),
            json!({
                "fixture_id": "sysmex-cbc-astm-001",
                "identifiers": {"patient_id": "DEMO-00003", "sample_barcode": "LAB-DEMO-CBC-0003"},
                "results": [
                    {"test_code": "WBC", "value": "12.8", "unit": "10^3/uL", "reference_range": "4.0-11.0", "abnormal_flag": "H"},
                    {"test_code": "Hemoglobin", "value": "13.2", "unit": "g/dL", "reference_range": "13-17", "abnormal_flag": "N"}
                ]
            }),
            "lab",
            first_result_id,
        ),
        (
            pacs_id,
            "dicom",
            "orthanc-study-metadata-001",
            b"{\"StudyInstanceUID\":\"1.2.826.0.1.3680043.10.543.2026051101\"}".to_vec(),
            json!({
                "fixture_id": "orthanc-study-metadata-001",
                "StudyInstanceUID": "1.2.826.0.1.3680043.10.543.2026051101",
                "AccessionNumber": "RAD-DEMO-CT-0001",
                "PatientID": "DEMO-00001",
                "Modality": "CT"
            }),
            json!({
                "fixture_id": "orthanc-study-metadata-001",
                "study_instance_uid": "1.2.826.0.1.3680043.10.543.2026051101",
                "accession_number": "RAD-DEMO-CT-0001",
                "patient_uhid": "DEMO-00001",
                "modality": "CT"
            }),
            "radiology",
            None,
        ),
    ];

    for (
        device_id,
        protocol,
        fixture_id,
        raw_payload,
        parsed_payload,
        mapped_data,
        target_module,
        target_entity_id,
    ) in messages
    {
        sqlx::query(
            "INSERT INTO device_messages \
             (tenant_id, device_instance_id, direction, protocol, raw_payload, parsed_payload, \
              mapped_data, processing_status, target_module, target_entity_id, processing_duration_ms, \
              bridge_agent_id) \
             SELECT $1,$2,'inbound',$3,$4,$5,$6,'delivered',$7,$8,42, \
              (SELECT bridge_agent_id FROM device_instances WHERE id=$2) \
             WHERE NOT EXISTS ( \
              SELECT 1 FROM device_messages WHERE tenant_id=$1 AND device_instance_id=$2 \
              AND parsed_payload->>'fixture_id'=$9)",
        )
        .bind(tenant_id)
        .bind(device_id)
        .bind(protocol)
        .bind(raw_payload)
        .bind(parsed_payload)
        .bind(mapped_data)
        .bind(target_module)
        .bind(target_entity_id)
        .bind(fixture_id)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

fn device_id(device_ids: &[(String, uuid::Uuid)], code: &str) -> uuid::Uuid {
    device_ids
        .iter()
        .find_map(|(device_code, id)| (device_code == code).then_some(*id))
        .unwrap_or_else(uuid::Uuid::nil)
}
