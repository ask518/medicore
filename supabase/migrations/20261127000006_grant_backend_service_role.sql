-- service_role is used only inside trusted Edge Functions and is never shipped
-- to the browser. Grant only the tables used by platform-admin/invite-staff.
GRANT SELECT, INSERT, UPDATE ON public.users TO service_role;
GRANT SELECT ON public.branches TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_branch_access TO service_role;
GRANT INSERT ON public.doctors TO service_role;
GRANT INSERT ON public.audit_logs TO service_role;
