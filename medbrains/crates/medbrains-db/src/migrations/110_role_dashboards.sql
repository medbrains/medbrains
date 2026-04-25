-- 110: Role-Specific Dashboard Widget Templates
-- Adds ~14 new system widget templates for role-specific data sources.
-- These use "module_query" data sources resolved by dashboard.rs resolve_module_query().
-- Actual role dashboards are seeded in Rust (seed/role_dashboards.rs) because they need tenant_id.

INSERT INTO widget_templates (name, description, widget_type, icon, color, default_config, default_source, default_width, default_height, category, is_system, required_permissions) VALUES

    -- ── Doctor-specific ────────────────────────────────────
    ('My Patients Today', 'Encounters assigned to current doctor today', 'stat_card', 'stethoscope', 'teal',
     '{"format": "number"}',
     '{"type": "module_query", "module": "patients", "query": "my_patients_today"}',
     3, 2, 'metrics', true, '["opd.visit.list"]'),

    ('My OPD Queue', 'Doctor''s current OPD waiting list', 'data_table', 'list', 'teal',
     '{"columns": [{"key": "token_no", "label": "Token"}, {"key": "patient_name", "label": "Patient"}, {"key": "status", "label": "Status"}, {"key": "wait_time", "label": "Wait"}], "page_size": 10}',
     '{"type": "module_query", "module": "opd", "query": "my_queue"}',
     6, 4, 'data', true, '["opd.queue.list"]'),

    ('My Pending Labs', 'Lab orders placed by current doctor awaiting results', 'stat_card', 'test-pipe', 'orange',
     '{"format": "number"}',
     '{"type": "module_query", "module": "lab", "query": "my_pending"}',
     3, 2, 'metrics', true, '["lab.orders.list"]'),

    ('My Appointments', 'Doctor''s appointments for today', 'data_table', 'calendar', 'blue',
     '{"columns": [{"key": "patient_name", "label": "Patient"}, {"key": "scheduled_time", "label": "Time"}, {"key": "visit_type", "label": "Type"}, {"key": "status", "label": "Status"}], "page_size": 10}',
     '{"type": "module_query", "module": "opd", "query": "my_appointments"}',
     6, 4, 'data', true, '["opd.queue.list"]'),

    -- ── Nurse-specific ─────────────────────────────────────
    ('Ward Patients', 'Active admissions in nurse''s department', 'stat_card', 'bed', 'indigo',
     '{"format": "number"}',
     '{"type": "module_query", "module": "ipd", "query": "my_ward_patients"}',
     3, 2, 'metrics', true, '["ipd.admissions.list"]'),

    ('Medication Schedule', 'Upcoming medication administrations for department', 'data_table', 'pill', 'red',
     '{"columns": [{"key": "patient_name", "label": "Patient"}, {"key": "drug_name", "label": "Drug"}, {"key": "dose", "label": "Dose"}, {"key": "scheduled_time", "label": "Due At"}], "page_size": 10}',
     '{"type": "module_query", "module": "ipd", "query": "medication_schedule"}',
     6, 4, 'data', true, '["ipd.admissions.list"]'),

    -- ── Lab Technician-specific ────────────────────────────
    ('Lab TAT Today', 'Average turnaround time for lab orders completed today', 'stat_card', 'clock', 'cyan',
     '{"format": "duration_minutes"}',
     '{"type": "module_query", "module": "lab", "query": "tat_today"}',
     3, 2, 'metrics', true, '["lab.orders.list"]'),

    ('Phlebotomy Queue', 'Samples pending collection', 'data_table', 'droplet', 'red',
     '{"columns": [{"key": "patient_name", "label": "Patient"}, {"key": "test_name", "label": "Test"}, {"key": "priority", "label": "Priority"}, {"key": "ordered_at", "label": "Ordered"}], "page_size": 10}',
     '{"type": "module_query", "module": "lab", "query": "phlebotomy_queue"}',
     6, 4, 'data', true, '["lab.phlebotomy.list"]'),

    -- ── Pharmacist-specific ────────────────────────────────
    ('Pending Prescriptions', 'Pharmacy orders awaiting dispensing', 'stat_card', 'prescription', 'green',
     '{"format": "number"}',
     '{"type": "module_query", "module": "pharmacy", "query": "pending_prescriptions"}',
     3, 2, 'metrics', true, '["pharmacy.prescriptions.list"]'),

    ('Stock Alerts', 'Low stock and near-expiry drug alerts', 'list', 'alert-triangle', 'yellow',
     '{"max_items": 10, "show_timestamp": false, "show_icon": true}',
     '{"type": "module_query", "module": "pharmacy", "query": "stock_alerts"}',
     4, 4, 'data', true, '["pharmacy.stock.manage"]'),

    ('NDPS Recent', 'Recent controlled substance register entries', 'data_table', 'shield', 'red',
     '{"columns": [{"key": "drug_name", "label": "Drug"}, {"key": "action", "label": "Action"}, {"key": "quantity", "label": "Qty"}, {"key": "balance", "label": "Balance"}, {"key": "created_at", "label": "Time"}], "page_size": 8}',
     '{"type": "module_query", "module": "pharmacy", "query": "ndps_recent"}',
     6, 4, 'data', true, '["pharmacy.ndps.list"]'),

    -- ── Billing-specific ───────────────────────────────────
    ('Today''s Collections', 'Total payments collected today', 'stat_card', 'coin', 'green',
     '{"format": "currency"}',
     '{"type": "module_query", "module": "billing", "query": "today_collections"}',
     3, 2, 'metrics', true, '["billing.invoices.list"]'),

    ('Day Close Status', 'Today''s day-end close status', 'stat_card', 'calendar-check', 'violet',
     '{"format": "text"}',
     '{"type": "module_query", "module": "billing", "query": "day_close_status"}',
     3, 2, 'metrics', true, '["billing.day_close.create"]'),

    -- ── Facilities-specific ────────────────────────────────
    ('Open Work Orders', 'Active work orders (open + in progress)', 'stat_card', 'tool', 'orange',
     '{"format": "number"}',
     '{"type": "module_query", "module": "facilities", "query": "open_work_orders"}',
     3, 2, 'metrics', true, '["facilities.work_orders.list"]'),

    ('Equipment PM Due', 'Preventive maintenance schedules due within 7 days', 'list', 'settings', 'red',
     '{"max_items": 10, "show_timestamp": true, "show_icon": true}',
     '{"type": "module_query", "module": "facilities", "query": "equipment_pm_due"}',
     4, 4, 'data', true, '["bme.pm.list"]'),

    -- ── Admin/CEO-specific ─────────────────────────────────
    ('Revenue MTD', 'Month-to-date billing revenue', 'stat_card', 'trending-up', 'green',
     '{"format": "currency"}',
     '{"type": "module_query", "module": "billing", "query": "revenue_mtd"}',
     3, 2, 'metrics', true, '["billing.reports.view"]'),

    ('Staff on Duty', 'Employees checked in today', 'stat_card', 'users', 'blue',
     '{"format": "number"}',
     '{"type": "module_query", "module": "system", "query": "staff_on_duty"}',
     3, 2, 'metrics', true, '["hr.attendance.list"]'),

    ('Today''s Registrations', 'Patients registered today', 'stat_card', 'user-plus', 'primary',
     '{"format": "number"}',
     '{"type": "module_query", "module": "patients", "query": "today_count"}',
     3, 2, 'metrics', true, '["patients.list"]');
