-- 118: Custom Code Node — multi-language code execution in pipelines
-- Supports: expression, json_logic, lua, rust (→WASM), pre-compiled wasm

-- Add custom code node template
INSERT INTO integration_node_templates (
    tenant_id, node_type, code, name, description, icon, color,
    category, config_schema, default_config, output_schema, is_system
) VALUES (
    NULL, 'transform', 'transform.custom_code', 'Custom Code',
    'Execute custom logic — expression, Lua, Rust→WASM, or pre-compiled WASM',
    'IconCode', 'indigo', 'Logic',
    '{
        "type": "object",
        "properties": {
            "language": {
                "type": "string",
                "enum": ["expression", "json_logic", "lua", "rust", "wasm"],
                "title": "Language",
                "default": "expression"
            },
            "code": { "type": "string", "title": "Code" },
            "snippet_id": { "type": "string", "title": "Saved Snippet", "format": "uuid" },
            "wasm_bytes": { "type": "string", "title": "Compiled WASM (base64)" },
            "timeout_ms": {
                "type": "integer", "title": "Timeout (ms)",
                "default": 5000, "minimum": 100, "maximum": 30000
            },
            "retry_policy": {
                "type": "string",
                "enum": ["none", "fixed", "exponential"],
                "title": "Retry Policy", "default": "none"
            },
            "max_retries": { "type": "integer", "title": "Max Retries", "default": 3 },
            "on_failure": {
                "type": "string",
                "enum": ["stop", "skip", "log_continue"],
                "title": "On Failure", "default": "stop"
            }
        }
    }',
    '{"language": "expression", "timeout_ms": 5000, "retry_policy": "none", "on_failure": "stop"}',
    '{"fields": [{"path": "result", "type": "any", "label": "Code output"}]}',
    TRUE
) ON CONFLICT (code) DO NOTHING;

-- Add more clinical/comms/finance action templates for the Design D palette
INSERT INTO integration_node_templates (tenant_id, node_type, code, name, description, icon, color, category, config_schema, default_config, output_schema, is_system) VALUES
    -- Actions · Clinical
    (NULL, 'action', 'action.bed_cleaning', 'Bed Cleaning Task', 'Create housekeeping task for bed cleaning', 'IconBed', 'teal', 'Actions · Clinical',
     '{"type":"object","properties":{"bed_id":{"type":"string","title":"Bed ID"},"priority":{"type":"string","enum":["normal","urgent"],"default":"normal"}}}',
     '{"priority":"normal"}', '{"fields":[{"path":"task_id","type":"string","label":"Task ID"}]}', TRUE),

    (NULL, 'action', 'action.lab_order', 'Lab Order', 'Create laboratory order', 'IconFlask', 'teal', 'Actions · Clinical',
     '{"type":"object","properties":{"test_ids":{"type":"array","title":"Test IDs"},"priority":{"type":"string","enum":["routine","urgent","stat"],"default":"routine"}}}',
     '{"priority":"routine"}', '{"fields":[{"path":"order_id","type":"string","label":"Order ID"}]}', TRUE),

    (NULL, 'action', 'action.pharmacy_notify', 'Pharmacy Notify', 'Send prescription to pharmacy queue', 'IconPill', 'teal', 'Actions · Clinical',
     '{"type":"object","properties":{"prescription_id":{"type":"string","title":"Prescription ID"}}}',
     '{}', '{"fields":[{"path":"rx_id","type":"string","label":"Rx Queue ID"}]}', TRUE),

    -- Actions · Comms
    (NULL, 'action', 'action.whatsapp_send', 'WhatsApp Message', 'Send WhatsApp via Business API', 'IconBrandWhatsapp', 'green', 'Actions · Comms',
     '{"type":"object","properties":{"recipient":{"type":"string","enum":["patient","attendant","doctor","custom"],"title":"Recipient"},"template":{"type":"string","title":"Template Code"},"variables":{"type":"object","title":"Template Variables"}}}',
     '{"recipient":"patient"}', '{"fields":[{"path":"message_id","type":"string","label":"Message ID"}]}', TRUE),

    (NULL, 'action', 'action.sms_send', 'SMS', 'Send SMS notification', 'IconMessage', 'green', 'Actions · Comms',
     '{"type":"object","properties":{"recipient":{"type":"string","title":"Phone Number"},"message":{"type":"string","title":"Message"}}}',
     '{}', '{"fields":[{"path":"sms_id","type":"string","label":"SMS ID"}]}', TRUE),

    (NULL, 'action', 'action.email_send', 'Email', 'Send email via SMTP', 'IconMail', 'green', 'Actions · Comms',
     '{"type":"object","properties":{"to":{"type":"string","title":"To"},"subject":{"type":"string","title":"Subject"},"body":{"type":"string","title":"Body"}}}',
     '{}', '{"fields":[{"path":"email_id","type":"string","label":"Email ID"}]}', TRUE),

    (NULL, 'action', 'action.in_app_notify', 'In-App Notification', 'Push notification to user', 'IconBell', 'green', 'Actions · Comms',
     '{"type":"object","properties":{"user_id":{"type":"string","title":"User ID"},"title":{"type":"string","title":"Title"},"message":{"type":"string","title":"Message"},"severity":{"type":"string","enum":["info","warning","critical"],"default":"info"}}}',
     '{"severity":"info"}', '{"fields":[{"path":"notification_id","type":"string","label":"Notification ID"}]}', TRUE),

    -- Actions · Finance
    (NULL, 'action', 'action.tpa_submit', 'TPA Claim Submit', 'Package and submit insurance claim to TPA', 'IconCurrencyRupee', 'yellow', 'Actions · Finance',
     '{"type":"object","properties":{"invoice_id":{"type":"string","title":"Invoice ID"},"tpa_connector":{"type":"string","title":"TPA Connector ID"}}}',
     '{}', '{"fields":[{"path":"claim_id","type":"string","label":"Claim ID"},{"path":"status","type":"string","label":"Submission Status"}]}', TRUE),

    (NULL, 'action', 'action.generate_invoice', 'Generate Invoice', 'Create billing invoice', 'IconReceipt', 'yellow', 'Actions · Finance',
     '{"type":"object","properties":{"patient_id":{"type":"string","title":"Patient ID"},"items":{"type":"array","title":"Line Items"}}}',
     '{}', '{"fields":[{"path":"invoice_id","type":"string","label":"Invoice ID"},{"path":"total","type":"number","label":"Total Amount"}]}', TRUE),

    -- Conditions (additional)
    (NULL, 'condition', 'condition.filter', 'Filter', 'Filter data based on conditions', 'IconFilter', 'orange', 'Conditions',
     '{"type":"object","properties":{"field":{"type":"string","title":"Field"},"operator":{"type":"string","enum":["equals","not_equals","contains","gt","lt","in"],"title":"Operator"},"value":{"type":"string","title":"Value"}}}',
     '{"operator":"equals"}', '{"fields":[{"path":"passed","type":"boolean","label":"Filter Result"}]}', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Execution steps table for trace panel
CREATE TABLE IF NOT EXISTS integration_execution_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id    UUID NOT NULL REFERENCES integration_executions(id) ON DELETE CASCADE,
    node_id         TEXT NOT NULL,
    node_label      TEXT,
    step_type       TEXT NOT NULL CHECK (step_type IN ('enter', 'execute', 'retry', 'complete', 'fail', 'skip')),
    input_data      JSONB,
    output_data     JSONB,
    error           TEXT,
    duration_ms     INTEGER,
    retry_attempt   INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exec_steps_exec ON integration_execution_steps(execution_id, created_at);
