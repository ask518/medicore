-- ============================================================================
-- MEDICORE – Platform Owner Finance Ledger, Internal Team Payroll & Leaves
-- Strictly scoped to active super_admin accounts via RLS and SECURITY DEFINER.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('subscription_income', 'operating_expense', 'payroll_payout', 'adjustment')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  staff_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reference_no TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_transactions_date_idx
  ON public.platform_transactions(transaction_date DESC, created_at DESC);

ALTER TABLE public.platform_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin manage platform transactions" ON public.platform_transactions;
CREATE POLICY "Super admin manage platform transactions" ON public.platform_transactions
  FOR ALL TO authenticated
  USING (public.is_platform_super_admin())
  WITH CHECK (public.is_platform_super_admin());

CREATE TABLE IF NOT EXISTS public.platform_staff_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_month VARCHAR(7) NOT NULL CHECK (period_month ~ '^\d{4}-\d{2}$'),
  base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  bonuses NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (bonuses >= 0),
  deductions NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  net_salary NUMERIC(12, 2) GENERATED ALWAYS AS (GREATEST(0, base_salary + bonuses - deductions)) STORED,
  currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_month)
);

ALTER TABLE public.platform_staff_payroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin manage platform payroll" ON public.platform_staff_payroll;
CREATE POLICY "Super admin manage platform payroll" ON public.platform_staff_payroll
  FOR ALL TO authenticated
  USING (public.is_platform_super_admin())
  WITH CHECK (public.is_platform_super_admin());

CREATE TABLE IF NOT EXISTS public.platform_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'unpaid', 'emergency')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL CHECK (days_count >= 1 AND days_count <= 365),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

ALTER TABLE public.platform_leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin manage platform leaves" ON public.platform_leave_requests;
CREATE POLICY "Super admin manage platform leaves" ON public.platform_leave_requests
  FOR ALL TO authenticated
  USING (public.is_platform_super_admin())
  WITH CHECK (public.is_platform_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_staff_payroll TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_leave_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_record_transaction(
  p_type TEXT,
  p_category TEXT,
  p_title TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'EGP',
  p_transaction_date DATE DEFAULT CURRENT_DATE,
  p_organization_id UUID DEFAULT NULL,
  p_reference_no TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_name TEXT;
  v_tx_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.is_platform_super_admin() THEN
    RAISE EXCEPTION 'An active platform super admin is required' USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('subscription_income', 'operating_expense', 'payroll_payout', 'adjustment')
     OR NULLIF(BTRIM(p_category), '') IS NULL
     OR NULLIF(BTRIM(p_title), '') IS NULL
     OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid transaction details';
  END IF;

  INSERT INTO public.platform_transactions (
    transaction_type, category, title, amount, currency, transaction_date,
    organization_id, reference_no, notes, created_by
  ) VALUES (
    p_type, BTRIM(p_category), BTRIM(p_title), p_amount,
    COALESCE(NULLIF(BTRIM(p_currency), ''), 'EGP'),
    COALESCE(p_transaction_date, CURRENT_DATE),
    p_organization_id, NULLIF(BTRIM(p_reference_no), ''), NULLIF(BTRIM(p_notes), ''), v_actor
  )
  RETURNING id INTO v_tx_id;

  SELECT COALESCE(name_en, email) INTO v_actor_name FROM public.users WHERE id = v_actor;
  INSERT INTO public.audit_logs (
    organization_id, user_id, user_name, action, entity_type, entity_id, new_values
  ) VALUES (
    NULL, v_actor, v_actor_name, 'PLATFORM_FINANCE_TX', 'platform_transactions', v_tx_id::TEXT,
    jsonb_build_object('type', p_type, 'category', p_category, 'title', p_title, 'amount', p_amount, 'currency', p_currency)
  );

  RETURN v_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_record_transaction(TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_record_transaction(TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_pay_payroll_slip(p_payroll_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_name TEXT;
  v_slip public.platform_staff_payroll%ROWTYPE;
  v_staff_name TEXT;
  v_tx_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.is_platform_super_admin() THEN
    RAISE EXCEPTION 'An active platform super admin is required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_slip FROM public.platform_staff_payroll WHERE id = p_payroll_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll slip not found';
  END IF;
  IF v_slip.status = 'paid' THEN
    RAISE EXCEPTION 'Payroll slip is already paid';
  END IF;

  UPDATE public.platform_staff_payroll
  SET status = 'paid', paid_at = NOW()
  WHERE id = p_payroll_id;

  SELECT COALESCE(name_ar, name_en, email) INTO v_staff_name FROM public.users WHERE id = v_slip.user_id;

  IF v_slip.net_salary > 0 THEN
    INSERT INTO public.platform_transactions (
      transaction_type, category, title, amount, currency, transaction_date, staff_user_id, created_by
    ) VALUES (
      'payroll_payout',
      'Payroll',
      format('%s (%s)', COALESCE(v_staff_name, 'Staff'), v_slip.period_month),
      v_slip.net_salary,
      v_slip.currency,
      CURRENT_DATE,
      v_slip.user_id,
      v_actor
    )
    RETURNING id INTO v_tx_id;
  END IF;

  SELECT COALESCE(name_en, email) INTO v_actor_name FROM public.users WHERE id = v_actor;
  INSERT INTO public.audit_logs (
    organization_id, user_id, user_name, action, entity_type, entity_id, new_values
  ) VALUES (
    NULL, v_actor, v_actor_name, 'PLATFORM_PAYROLL_PAID', 'platform_staff_payroll', p_payroll_id::TEXT,
    jsonb_build_object('period_month', v_slip.period_month, 'net_salary', v_slip.net_salary, 'tx_id', v_tx_id)
  );

  RETURN COALESCE(v_tx_id, p_payroll_id);
END;
$$;

REVOKE ALL ON FUNCTION public.platform_pay_payroll_slip(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_pay_payroll_slip(UUID) TO authenticated;
