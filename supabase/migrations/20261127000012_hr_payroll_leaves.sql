-- ============================================================================
-- MEDICORE – Human Resources, Payroll, Leave Management & Expenses Integration
-- Server-enforced payroll state machine, cashbox-linked salary payout,
-- no self-approval & date-overlap protection on leaves, and HR directory RPC.
-- ============================================================================

-- 1. Payroll Slips Table
CREATE TABLE IF NOT EXISTS public.payroll_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  base_salary NUMERIC(12, 2) NOT NULL CHECK (base_salary >= 0),
  allowances NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
  deductions NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  net_salary NUMERIC(12, 2) NOT NULL CHECK (net_salary >= 0),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (payment_status IN ('draft', 'approved', 'paid')),
  payment_date DATE,
  payment_method VARCHAR(30) CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque')),
  cashbox_id UUID REFERENCES public.cashboxes(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_slips_org_month
  ON public.payroll_slips(organization_id, month DESC, branch_id);

-- 2. Leave Requests Table
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leave_type VARCHAR(30) NOT NULL CHECK (leave_type IN ('annual', 'sick', 'casual', 'unpaid', 'maternity', 'emergency')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL CHECK (total_days >= 1 AND total_days <= 365),
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_org_created
  ON public.leave_requests(organization_id, created_at DESC);

-- 3. RLS for payroll_slips and leave_requests
ALTER TABLE public.payroll_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant select payroll_slips" ON public.payroll_slips;
DROP POLICY IF EXISTS "Tenant insert payroll_slips" ON public.payroll_slips;
DROP POLICY IF EXISTS "Tenant update payroll_slips" ON public.payroll_slips;
DROP POLICY IF EXISTS "Tenant delete payroll_slips" ON public.payroll_slips;

CREATE POLICY "Tenant select payroll_slips"
  ON public.payroll_slips FOR SELECT TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND (
        user_id = auth.uid()
        OR (
          public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant'])
          AND public.user_has_branch_access(branch_id)
        )
      )
    )
  );

-- Direct inserts/updates only for drafts by authorized HR/Finance; approvals & payouts go via RPCs
CREATE POLICY "Tenant insert payroll_slips"
  ON public.payroll_slips FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND payment_status = 'draft'
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant'])
      AND public.user_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Tenant update payroll_slips"
  ON public.payroll_slips FOR UPDATE TO authenticated
  USING (public.is_platform_super_admin())
  WITH CHECK (public.is_platform_super_admin());

CREATE POLICY "Tenant delete payroll_slips"
  ON public.payroll_slips FOR DELETE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "Tenant select leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Tenant insert leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Tenant update leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Tenant delete leave_requests" ON public.leave_requests;

CREATE POLICY "Tenant select leave_requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND (
        user_id = auth.uid()
        OR public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager'])
      )
    )
  );

CREATE POLICY "Tenant insert leave_requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND status = 'pending'
      AND (
        user_id = auth.uid()
        OR public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager'])
      )
    )
  );

CREATE POLICY "Tenant update leave_requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (public.is_platform_super_admin())
  WITH CHECK (public.is_platform_super_admin());

CREATE POLICY "Tenant delete leave_requests"
  ON public.leave_requests FOR DELETE TO authenticated
  USING (false);

-- 4. Validation triggers (net salary computation, overlap guard, audit trail)
CREATE OR REPLACE FUNCTION public.validate_payroll_slip()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = NEW.user_id AND u.organization_id = NEW.organization_id AND u.role <> 'patient'
  ) THEN
    RAISE EXCEPTION 'Employee does not belong to this organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = NEW.branch_id AND b.organization_id = NEW.organization_id AND b.is_active
  ) THEN
    RAISE EXCEPTION 'Branch is not active in this organization';
  END IF;

  NEW.net_salary := ROUND(GREATEST(0, NEW.base_salary + NEW.allowances - NEW.deductions), 2);
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payroll_slip ON public.payroll_slips;
CREATE TRIGGER trg_validate_payroll_slip
  BEFORE INSERT OR UPDATE ON public.payroll_slips
  FOR EACH ROW EXECUTE FUNCTION public.validate_payroll_slip();

CREATE OR REPLACE FUNCTION public.validate_leave_request()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = NEW.user_id AND u.organization_id = NEW.organization_id AND u.role <> 'patient'
  ) THEN
    RAISE EXCEPTION 'Employee does not belong to this organization';
  END IF;

  NEW.total_days := (NEW.end_date - NEW.start_date) + 1;

  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.user_id = NEW.user_id
        AND lr.organization_id = NEW.organization_id
        AND lr.status IN ('pending', 'approved')
        AND daterange(lr.start_date, lr.end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
    ) THEN
      RAISE EXCEPTION 'Overlapping leave request exists for these dates';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_leave_request ON public.leave_requests;
CREATE TRIGGER trg_validate_leave_request
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_leave_request();

DROP TRIGGER IF EXISTS trg_audit_payroll_slips ON public.payroll_slips;
CREATE TRIGGER trg_audit_payroll_slips
  AFTER INSERT OR UPDATE OR DELETE ON public.payroll_slips
  FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();

DROP TRIGGER IF EXISTS trg_audit_leave_requests ON public.leave_requests;
CREATE TRIGGER trg_audit_leave_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();

-- 5. HR Staff Directory RPC (scoped safely so Accountant / Branch Manager can process payroll)
CREATE OR REPLACE FUNCTION public.get_hr_staff_directory(p_organization_id UUID)
RETURNS TABLE(id UUID, name_ar TEXT, name_en TEXT, role TEXT, primary_branch_id UUID, is_active BOOLEAN)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.users WHERE users.id = auth.uid() AND users.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inactive user';
  END IF;

  IF v_actor.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(p_organization_id) THEN
      RAISE EXCEPTION 'Active support session required';
    END IF;
  ELSIF v_actor.organization_id IS DISTINCT FROM p_organization_id
     OR v_actor.role NOT IN ('org_owner', 'general_manager', 'medical_director', 'branch_manager', 'accountant') THEN
    RAISE EXCEPTION 'Insufficient permissions for HR staff directory';
  END IF;

  RETURN QUERY
  SELECT u.id, u.name_ar::TEXT, u.name_en::TEXT, u.role::TEXT, u.primary_branch_id, u.is_active
  FROM public.users u
  WHERE u.organization_id = p_organization_id
    AND u.role NOT IN ('patient', 'super_admin')
    AND u.is_active = true
  ORDER BY u.name_ar;
END;
$$;

-- 6. Approve Payroll Slip RPC
CREATE OR REPLACE FUNCTION public.approve_payroll_slip(p_slip_id UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
  v_slip public.payroll_slips%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inactive user'; END IF;

  SELECT * INTO v_slip FROM public.payroll_slips WHERE id = p_slip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll slip not found'; END IF;

  IF v_actor.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_slip.organization_id) THEN
      RAISE EXCEPTION 'Active support session required';
    END IF;
  ELSIF v_actor.organization_id IS DISTINCT FROM v_slip.organization_id
     OR v_actor.role NOT IN ('org_owner', 'general_manager', 'accountant')
     OR NOT public.user_has_branch_access(v_slip.branch_id) THEN
    RAISE EXCEPTION 'Insufficient permission to approve payroll';
  END IF;

  IF v_slip.payment_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft payroll slips can be approved';
  END IF;

  UPDATE public.payroll_slips
  SET payment_status = 'approved',
      approved_by = v_actor.id,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = v_slip.id;

  RETURN true;
END;
$$;

-- 7. Pay Approved Payroll Slip RPC (creates linked Expense + deducts Cashbox atomically)
CREATE OR REPLACE FUNCTION public.pay_payroll_slip(
  p_slip_id UUID,
  p_payment_method TEXT,
  p_cashbox_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
  v_slip public.payroll_slips%ROWTYPE;
  v_emp_name TEXT;
  v_expense_id UUID := gen_random_uuid();
BEGIN
  SELECT * INTO v_actor FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inactive user'; END IF;

  IF p_payment_method NOT IN ('cash', 'bank_transfer', 'cheque') THEN
    RAISE EXCEPTION 'Invalid payroll payment method';
  END IF;

  SELECT * INTO v_slip FROM public.payroll_slips WHERE id = p_slip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll slip not found'; END IF;

  IF v_actor.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_slip.organization_id) THEN
      RAISE EXCEPTION 'Active support session required';
    END IF;
  ELSIF v_actor.organization_id IS DISTINCT FROM v_slip.organization_id
     OR v_actor.role NOT IN ('org_owner', 'general_manager', 'accountant')
     OR NOT public.user_has_branch_access(v_slip.branch_id) THEN
    RAISE EXCEPTION 'Insufficient permission to disburse payroll';
  END IF;

  IF v_slip.payment_status <> 'approved' THEN
    RAISE EXCEPTION 'Payroll slip must be approved before payout';
  END IF;

  IF p_payment_method = 'cash' AND p_cashbox_id IS NULL THEN
    RAISE EXCEPTION 'Select a cashbox for cash payroll disbursement';
  END IF;

  IF p_cashbox_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cashboxes c
    WHERE c.id = p_cashbox_id
      AND c.organization_id = v_slip.organization_id
      AND c.branch_id = v_slip.branch_id
      AND c.is_active
  ) THEN
    RAISE EXCEPTION 'Selected cashbox is unavailable for this branch';
  END IF;

  SELECT COALESCE(u.name_ar, u.email) INTO v_emp_name FROM public.users u WHERE u.id = v_slip.user_id;

  INSERT INTO public.expenses (
    id, organization_id, branch_id, cashbox_id, category, title,
    amount, expense_date, vendor_name, notes, approved_by
  ) VALUES (
    v_expense_id,
    v_slip.organization_id,
    v_slip.branch_id,
    p_cashbox_id,
    'Salaries',
    'راتب ' || v_slip.month || ' — ' || COALESCE(v_emp_name, ''),
    v_slip.net_salary,
    CURRENT_DATE,
    v_emp_name,
    'Payroll payout (' || p_payment_method || ')',
    COALESCE(v_slip.approved_by, v_actor.id)
  );

  UPDATE public.payroll_slips
  SET payment_status = 'paid',
      payment_date = CURRENT_DATE,
      payment_method = p_payment_method,
      cashbox_id = p_cashbox_id,
      expense_id = v_expense_id,
      updated_at = NOW()
  WHERE id = v_slip.id;

  RETURN v_expense_id;
END;
$$;

-- 8. Decide Leave Request RPC (strict no self-approval)
CREATE OR REPLACE FUNCTION public.decide_leave_request(
  p_leave_id UUID,
  p_decision TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
  v_leave public.leave_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inactive user'; END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  SELECT * INTO v_leave FROM public.leave_requests WHERE id = p_leave_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave request not found'; END IF;

  IF v_actor.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_leave.organization_id) THEN
      RAISE EXCEPTION 'Active support session required';
    END IF;
  ELSIF v_actor.organization_id IS DISTINCT FROM v_leave.organization_id
     OR v_actor.role NOT IN ('org_owner', 'general_manager', 'medical_director', 'branch_manager') THEN
    RAISE EXCEPTION 'Insufficient permission to decide leave requests';
  END IF;

  IF v_leave.user_id = v_actor.id AND v_actor.role <> 'super_admin' THEN
    RAISE EXCEPTION 'Self-approval of leave requests is not permitted';
  END IF;

  IF v_leave.status <> 'pending' THEN
    RAISE EXCEPTION 'Leave request has already been decided';
  END IF;

  UPDATE public.leave_requests
  SET status = p_decision,
      approved_by = v_actor.id,
      decided_at = NOW(),
      notes = COALESCE(NULLIF(BTRIM(p_notes), ''), notes)
  WHERE id = v_leave.id;

  RETURN true;
END;
$$;

-- 9. Record Operating Expense RPC (validates cashbox & stamps approved_by server-side)
CREATE OR REPLACE FUNCTION public.record_facility_expense(
  p_branch_id UUID,
  p_cashbox_id UUID,
  p_category TEXT,
  p_title TEXT,
  p_amount NUMERIC,
  p_expense_date DATE,
  p_vendor_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
  v_org_id UUID;
  v_expense_id UUID := gen_random_uuid();
BEGIN
  SELECT * INTO v_actor FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inactive user'; END IF;

  SELECT b.organization_id INTO v_org_id FROM public.branches b WHERE b.id = p_branch_id AND b.is_active;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Branch not found'; END IF;

  IF v_actor.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_org_id) THEN
      RAISE EXCEPTION 'Active support session required';
    END IF;
  ELSIF v_actor.organization_id IS DISTINCT FROM v_org_id
     OR v_actor.role NOT IN ('org_owner', 'general_manager', 'branch_manager', 'accountant')
     OR NOT public.user_has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'Insufficient permission to record expenses';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero';
  END IF;

  IF NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_category), '') IS NULL THEN
    RAISE EXCEPTION 'Expense category and title are required';
  END IF;

  IF p_cashbox_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cashboxes c
    WHERE c.id = p_cashbox_id AND c.organization_id = v_org_id AND c.branch_id = p_branch_id AND c.is_active
  ) THEN
    RAISE EXCEPTION 'Cashbox is unavailable for this branch';
  END IF;

  INSERT INTO public.expenses (
    id, organization_id, branch_id, cashbox_id, category, title,
    amount, expense_date, vendor_name, notes, approved_by
  ) VALUES (
    v_expense_id, v_org_id, p_branch_id, p_cashbox_id, BTRIM(p_category), BTRIM(p_title),
    ROUND(p_amount, 2), COALESCE(p_expense_date, CURRENT_DATE), NULLIF(BTRIM(p_vendor_name), ''),
    NULLIF(BTRIM(p_notes), ''), v_actor.id
  );

  RETURN v_expense_id;
END;
$$;

GRANT SELECT, INSERT ON public.payroll_slips TO authenticated;
GRANT SELECT, INSERT ON public.leave_requests TO authenticated;

REVOKE ALL ON FUNCTION public.get_hr_staff_directory(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hr_staff_directory(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_payroll_slip(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payroll_slip(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.pay_payroll_slip(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_payroll_slip(UUID, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.decide_leave_request(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_leave_request(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.record_facility_expense(UUID, UUID, TEXT, TEXT, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_facility_expense(UUID, UUID, TEXT, TEXT, NUMERIC, DATE, TEXT, TEXT) TO authenticated;
