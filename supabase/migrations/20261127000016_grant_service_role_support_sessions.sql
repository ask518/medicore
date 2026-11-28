-- Allow trusted service_role (Edge Functions such as invite-staff) to verify
-- active platform support sessions before creating facility staff accounts.
GRANT SELECT ON public.platform_support_sessions TO service_role;
