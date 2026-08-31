-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 2
-- Drops: none
-- EMI/Installment payments — split an invoice into N scheduled payments.

-- ══════════════════════════════════════════════════════════
--  payment_installments — top-level installment plan
-- ══════════════════════════════════════════════════════════

CREATE TABLE public.payment_installments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    installment_count integer NOT NULL,
    installment_amount numeric(12,2) NOT NULL,
    frequency text DEFAULT 'monthly' NOT NULL,
    interest_rate numeric(5,2) DEFAULT 0 NOT NULL,
    penalty_rate numeric(5,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'active' NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT payment_installments_pkey PRIMARY KEY (id),
    CONSTRAINT payment_installments_status_check CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled'))
);

CREATE INDEX idx_payment_installments_tenant ON public.payment_installments USING btree (tenant_id);
CREATE INDEX idx_payment_installments_invoice ON public.payment_installments USING btree (invoice_id);
CREATE INDEX idx_payment_installments_tenant_status ON public.payment_installments USING btree (tenant_id, status);

ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_payment_installments ON public.payment_installments
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TRIGGER audit_payment_installments
    AFTER INSERT OR DELETE OR UPDATE ON public.payment_installments
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('billing');

CREATE TRIGGER trg_payment_installments_updated_at
    BEFORE UPDATE ON public.payment_installments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ══════════════════════════════════════════════════════════
--  payment_installment_items — individual installment due dates
-- ══════════════════════════════════════════════════════════

CREATE TABLE public.payment_installment_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    installment_id uuid NOT NULL,
    installment_number integer NOT NULL,
    due_date date NOT NULL,
    amount numeric(12,2) NOT NULL,
    penalty_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    payment_id uuid,
    paid_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_installment_items_pkey PRIMARY KEY (id),
    CONSTRAINT payment_installment_items_status_check CHECK (status IN ('pending', 'paid', 'overdue', 'waived'))
);

CREATE INDEX idx_pii_tenant ON public.payment_installment_items USING btree (tenant_id);
CREATE INDEX idx_pii_installment ON public.payment_installment_items USING btree (installment_id);
CREATE INDEX idx_pii_status ON public.payment_installment_items USING btree (tenant_id, status);
CREATE INDEX idx_pii_due_date ON public.payment_installment_items USING btree (tenant_id, due_date);

ALTER TABLE public.payment_installment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_payment_installment_items ON public.payment_installment_items
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TRIGGER audit_payment_installment_items
    AFTER INSERT OR DELETE OR UPDATE ON public.payment_installment_items
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('billing');

CREATE TRIGGER trg_pii_updated_at
    BEFORE UPDATE ON public.payment_installment_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
