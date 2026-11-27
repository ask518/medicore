-- Add the inventory role in its own migration so the enum value is committed
-- before any policy or profile starts using it.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'inventory_manager';
