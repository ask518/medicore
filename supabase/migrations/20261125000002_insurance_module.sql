-- ============================================================================
-- MEDICORE HEALTHCARE PLATFORM – INSURANCE & CLAIMS MANAGEMENT MODULE
-- Corporate Contracts, Coverage Tiers, Co-payments, Claims & Pre-Approvals
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    insurance_company_id UUID NOT NULL REFERENCES insurance_companies(id) ON DELETE CASCADE,
    contract_code VARCHAR(80) NOT NULL,
    plan_name_ar VARCHAR(150) NOT NULL,
    plan_name_en VARCHAR(150) NOT NULL,
    coverage_percent DECIMAL(5, 2) NOT NULL DEFAULT 80.00 CHECK (coverage_percent >= 0 AND coverage_percent <= 100),
    co_payment_percent DECIMAL(5, 2) NOT NULL DEFAULT 20.00 CHECK (co_payment_percent >= 0 AND co_payment_percent <= 100),
    annual_limit DECIMAL(12, 2) NOT NULL DEFAULT 50000.00 CHECK (annual_limit >= 0),
    requires_pre_approval_above DECIMAL(12, 2) DEFAULT 1000.00,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, contract_code)
);

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS insurance_contract_id UUID REFERENCES insurance_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS insurance_expiry_date DATE;

ALTER TABLE insurance_claims
  ADD COLUMN IF NOT EXISTS pre_approval_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_insurance_contracts_org ON insurance_contracts(organization_id, insurance_company_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_org_status ON insurance_claims(organization_id, status, submission_date DESC);

-- Enable strict Row Level Security on insurance_contracts
ALTER TABLE insurance_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation on insurance_contracts" ON insurance_contracts;
CREATE POLICY "Tenant isolation on insurance_contracts"
  ON insurance_contracts
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant', 'insurance_officer', 'receptionist', 'doctor'])
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant', 'insurance_officer'])
    )
  );
