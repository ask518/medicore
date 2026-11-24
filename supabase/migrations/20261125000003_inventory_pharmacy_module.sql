-- ============================================================================
-- MEDICORE HEALTHCARE PLATFORM – INVENTORY & PHARMACY MANAGEMENT MODULE
-- Suppliers, Batch/Expiry Tracking & Atomic Stock Movement Ledger
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    contact_person VARCHAR(150),
    phone VARCHAR(50),
    email VARCHAR(255),
    tax_id VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org_branch ON inventory_items(organization_id, branch_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_org_item ON inventory_movements(organization_id, item_id, created_at DESC);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation on suppliers" ON suppliers;
CREATE POLICY "Tenant isolation on suppliers"
  ON suppliers
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'pharmacist', 'inventory_manager', 'accountant'])
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'pharmacist', 'inventory_manager'])
    )
  );

-- Atomic Stock Movement RPC: prevents race conditions & negative inventory
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
  v_current_qty INTEGER;
  v_new_qty INTEGER;
  v_movement_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF p_movement_type NOT IN ('purchase', 'dispense', 'adjustment', 'transfer_in', 'transfer_out', 'damage') THEN
    RAISE EXCEPTION 'Invalid inventory movement type: %', p_movement_type;
  END IF;

  IF NOT public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'pharmacist', 'inventory_manager']) THEN
    RAISE EXCEPTION 'Insufficient permissions to record inventory movements';
  END IF;

  v_org_id := public.current_user_organization_id();

  SELECT organization_id, current_quantity
  INTO v_item_org_id, v_current_qty
  FROM public.inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;

  IF NOT public.is_platform_super_admin() AND v_item_org_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'Cross-tenant inventory access denied';
  END IF;

  IF p_movement_type IN ('purchase', 'transfer_in') THEN
    v_new_qty := v_current_qty + p_quantity;
  ELSIF p_movement_type IN ('dispense', 'transfer_out', 'damage') THEN
    IF v_current_qty < p_quantity THEN
      RAISE EXCEPTION 'Insufficient stock: available %, requested %', v_current_qty, p_quantity;
    END IF;
    v_new_qty := v_current_qty - p_quantity;
  ELSE
    -- adjustment: sets exact physical count
    v_new_qty := p_quantity;
  END IF;

  UPDATE public.inventory_items
  SET current_quantity = v_new_qty
  WHERE id = p_item_id;

  INSERT INTO public.inventory_movements (
    organization_id, item_id, movement_type, quantity, unit_price, reference_id, notes, created_by
  ) VALUES (
    v_item_org_id, p_item_id, p_movement_type, p_quantity, COALESCE(p_unit_price, 0.00), p_reference_id, p_notes, auth.uid()
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_inventory_movement(UUID, VARCHAR, INTEGER, NUMERIC, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_inventory_movement(UUID, VARCHAR, INTEGER, NUMERIC, VARCHAR, TEXT) TO authenticated;
