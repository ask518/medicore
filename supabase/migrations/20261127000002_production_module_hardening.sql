-- Inventory quantities are only changed through audited security-definer RPCs.
CREATE OR REPLACE FUNCTION public.guard_inventory_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.current_quantity <> 0 THEN
    RAISE EXCEPTION 'Create inventory items with zero quantity and record opening stock through the inventory RPC';
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.current_quantity IS DISTINCT FROM OLD.current_quantity
     AND current_setting('app.inventory_rpc', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Inventory quantity must be changed through the inventory movement RPC';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_inventory_quantity_trigger ON public.inventory_items;
CREATE TRIGGER guard_inventory_quantity_trigger
  BEFORE INSERT OR UPDATE OF current_quantity ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_quantity();

CREATE OR REPLACE FUNCTION public.create_inventory_item(
  p_organization_id UUID,
  p_branch_id UUID,
  p_sku TEXT,
  p_name_ar TEXT,
  p_name_en TEXT,
  p_category TEXT,
  p_initial_quantity INTEGER,
  p_reorder_threshold INTEGER,
  p_unit TEXT,
  p_unit_cost NUMERIC,
  p_selling_price NUMERIC,
  p_batch_number TEXT DEFAULT NULL,
  p_expiry_date DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id UUID;
  v_actor UUID := auth.uid();
BEGIN
  IF p_initial_quantity IS NULL OR p_initial_quantity < 0
     OR p_reorder_threshold IS NULL OR p_reorder_threshold < 0
     OR COALESCE(p_unit_cost, 0) < 0 OR COALESCE(p_selling_price, 0) < 0 THEN
    RAISE EXCEPTION 'Quantity, threshold, and prices must be zero or greater';
  END IF;
  IF NOT public.is_platform_super_admin()
     AND (p_organization_id IS DISTINCT FROM public.current_user_organization_id()
       OR NOT public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'pharmacist', 'inventory_manager'])
       OR NOT public.user_has_branch_access(p_branch_id)) THEN
    RAISE EXCEPTION 'Insufficient permission for this inventory branch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = p_branch_id AND b.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Branch does not belong to the selected organization';
  END IF;
  IF NULLIF(BTRIM(p_sku), '') IS NULL OR NULLIF(BTRIM(p_name_ar), '') IS NULL THEN
    RAISE EXCEPTION 'SKU and Arabic name are required';
  END IF;

  INSERT INTO public.inventory_items (
    organization_id, branch_id, sku, name_ar, name_en, category,
    current_quantity, reorder_threshold, unit, unit_cost, selling_price,
    batch_number, expiry_date, is_active
  ) VALUES (
    p_organization_id, p_branch_id, UPPER(BTRIM(p_sku)), BTRIM(p_name_ar),
    COALESCE(NULLIF(BTRIM(p_name_en), ''), BTRIM(p_name_ar)), p_category,
    0, p_reorder_threshold, COALESCE(NULLIF(BTRIM(p_unit), ''), 'piece'),
    COALESCE(p_unit_cost, 0), COALESCE(p_selling_price, 0),
    NULLIF(BTRIM(p_batch_number), ''), p_expiry_date, true
  ) RETURNING id INTO v_item_id;

  IF p_initial_quantity > 0 THEN
    PERFORM set_config('app.inventory_rpc', 'on', true);
    UPDATE public.inventory_items SET current_quantity = p_initial_quantity WHERE id = v_item_id;
    INSERT INTO public.inventory_movements (
      organization_id, item_id, movement_type, quantity, unit_price, notes, created_by
    ) VALUES (
      p_organization_id, v_item_id, 'purchase', p_initial_quantity,
      COALESCE(p_unit_cost, 0), 'Opening balance', v_actor
    );
  END IF;
  RETURN v_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_inventory_item(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, NUMERIC, NUMERIC, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_inventory_item(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, NUMERIC, NUMERIC, TEXT, DATE) TO authenticated;

-- Allow branch-scoped inventory staff to manage item metadata. Quantity writes
-- remain blocked by the trigger and can only be recorded via the RPC above.
DROP POLICY IF EXISTS tenant_isolation_insert_inventory_items ON public.inventory_items;
CREATE POLICY tenant_isolation_insert_inventory_items ON public.inventory_items
  FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS tenant_isolation_update_inventory_items ON public.inventory_items;
CREATE POLICY tenant_isolation_update_inventory_items ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (public.is_platform_super_admin() OR (
    organization_id = public.current_user_organization_id()
    AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'pharmacist', 'inventory_manager'])
    AND public.user_has_branch_access(branch_id)
  ))
  WITH CHECK (public.is_platform_super_admin() OR (
    organization_id = public.current_user_organization_id()
    AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'pharmacist', 'inventory_manager'])
    AND public.user_has_branch_access(branch_id)
  ));

-- Permit zero-count adjustments, while keeping every movement branch scoped.
CREATE OR REPLACE FUNCTION public.record_inventory_movement(
  p_item_id UUID,
  p_movement_type VARCHAR,
  p_quantity INTEGER,
  p_unit_price NUMERIC DEFAULT 0.00,
  p_reference_id VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_item_org_id UUID;
  v_item_branch_id UUID;
  v_current_qty INTEGER;
  v_new_qty INTEGER;
  v_movement_id UUID;
BEGIN
  IF p_movement_type IS NULL OR p_quantity IS NULL OR p_quantity < 0 OR (p_movement_type <> 'adjustment' AND p_quantity = 0) THEN
    RAISE EXCEPTION 'Quantity must be positive (zero is allowed only for physical-count adjustments)';
  END IF;
  IF p_movement_type IS NULL OR p_movement_type NOT IN ('purchase', 'dispense', 'adjustment', 'transfer_in', 'transfer_out', 'damage') THEN
    RAISE EXCEPTION 'Invalid inventory movement type: %', p_movement_type;
  END IF;
  IF NOT public.is_platform_super_admin()
     AND NOT public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'pharmacist', 'inventory_manager']) THEN
    RAISE EXCEPTION 'Insufficient permissions to record inventory movements';
  END IF;

  v_org_id := public.current_user_organization_id();
  SELECT organization_id, branch_id, current_quantity
    INTO v_item_org_id, v_item_branch_id, v_current_qty
    FROM public.inventory_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
  IF NOT public.is_platform_super_admin() AND v_item_org_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'Cross-tenant inventory access denied';
  END IF;
  IF NOT public.is_platform_super_admin() AND NOT public.user_has_branch_access(v_item_branch_id) THEN
    RAISE EXCEPTION 'No access to inventory item branch';
  END IF;

  IF p_movement_type IN ('purchase', 'transfer_in') THEN
    v_new_qty := v_current_qty + p_quantity;
  ELSIF p_movement_type IN ('dispense', 'transfer_out', 'damage') THEN
    IF v_current_qty < p_quantity THEN
      RAISE EXCEPTION 'Insufficient stock: available %, requested %', v_current_qty, p_quantity;
    END IF;
    v_new_qty := v_current_qty - p_quantity;
  ELSE
    v_new_qty := p_quantity;
  END IF;

  PERFORM set_config('app.inventory_rpc', 'on', true);
  UPDATE public.inventory_items SET current_quantity = v_new_qty WHERE id = p_item_id;
  INSERT INTO public.inventory_movements (
    organization_id, item_id, movement_type, quantity, unit_price, reference_id, notes, created_by
  ) VALUES (
    v_item_org_id, p_item_id, p_movement_type, p_quantity, COALESCE(p_unit_price, 0), p_reference_id, p_notes, auth.uid()
  ) RETURNING id INTO v_movement_id;
  RETURN v_movement_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_inventory_movement(UUID, VARCHAR, INTEGER, NUMERIC, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_inventory_movement(UUID, VARCHAR, INTEGER, NUMERIC, VARCHAR, TEXT) TO authenticated;

-- Align insurance writes with the dedicated insurance role and preserve branch
-- boundaries on claims. Receptionists may submit claims, but cannot settle them.
DROP POLICY IF EXISTS tenant_isolation_insert_insurance_companies ON public.insurance_companies;
CREATE POLICY tenant_isolation_insert_insurance_companies ON public.insurance_companies
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_super_admin() OR (
    organization_id = public.current_user_organization_id()
    AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'insurance_officer'])
  ));
DROP POLICY IF EXISTS tenant_isolation_update_insurance_companies ON public.insurance_companies;
CREATE POLICY tenant_isolation_update_insurance_companies ON public.insurance_companies
  FOR UPDATE TO authenticated
  USING (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'insurance_officer'])))
  WITH CHECK (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'insurance_officer'])));

DROP POLICY IF EXISTS "Tenant isolation on insurance_contracts" ON public.insurance_contracts;
CREATE POLICY "Tenant isolation on insurance_contracts" ON public.insurance_contracts
  FOR ALL TO authenticated
  USING (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'accountant', 'insurance_officer'])))
  WITH CHECK (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'insurance_officer'])));

DROP POLICY IF EXISTS tenant_isolation_select_insurance_claims ON public.insurance_claims;
CREATE POLICY tenant_isolation_select_insurance_claims ON public.insurance_claims
  FOR SELECT TO authenticated USING (public.is_platform_super_admin() OR (
    organization_id = public.current_user_organization_id()
    AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'accountant', 'receptionist', 'insurance_officer'])
    AND public.user_has_branch_access(branch_id)
  ));
DROP POLICY IF EXISTS tenant_isolation_insert_insurance_claims ON public.insurance_claims;
CREATE POLICY tenant_isolation_insert_insurance_claims ON public.insurance_claims
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_super_admin() OR (
    organization_id = public.current_user_organization_id()
    AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'accountant', 'receptionist', 'insurance_officer'])
    AND public.user_has_branch_access(branch_id)
  ));
DROP POLICY IF EXISTS tenant_isolation_update_insurance_claims ON public.insurance_claims;
CREATE POLICY tenant_isolation_update_insurance_claims ON public.insurance_claims
  FOR UPDATE TO authenticated
  USING (public.is_platform_super_admin() OR (
    organization_id = public.current_user_organization_id()
    AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'accountant', 'insurance_officer'])
    AND public.user_has_branch_access(branch_id)
  ))
  WITH CHECK (public.is_platform_super_admin() OR (
    organization_id = public.current_user_organization_id()
    AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'accountant', 'insurance_officer'])
    AND public.user_has_branch_access(branch_id)
  ));
