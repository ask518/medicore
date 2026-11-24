-- Tighten the function execution surface after the initial hardening pass.
-- The previous RBAC migration granted ALL routines to authenticated users.
ALTER EXTENSION btree_gist SET SCHEMA extensions;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Trigger functions execute only through their table triggers. Give them a
-- fixed search path and definer rights so audit and ledger updates still work
-- after direct table writes are removed from the client API.
ALTER FUNCTION public.log_record_audit() SECURITY DEFINER;
ALTER FUNCTION public.log_record_audit() SET search_path = public;
ALTER FUNCTION public.update_cashbox_balance() SECURITY DEFINER;
ALTER FUNCTION public.update_cashbox_balance() SET search_path = public;
ALTER FUNCTION public.update_invoice_financials() SECURITY DEFINER;
ALTER FUNCTION public.update_invoice_financials() SET search_path = public;
ALTER FUNCTION public.auth_uid() SET search_path = public;

-- RLS predicates and the explicitly validated application RPCs are the only
-- public-schema functions that the authenticated REST role can call.
GRANT EXECUTE ON FUNCTION public.auth_uid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_branch_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_initial_organization(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice(UUID, UUID, UUID, INTEGER, NUMERIC, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(UUID, NUMERIC, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_service(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_prescription(UUID, JSONB, TEXT, TEXT) TO authenticated;
