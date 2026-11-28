-- Allow org owners / GMs (already gated by RLS policy "Org owner update own organization")
-- to persist facility specialties from Settings.tsx alongside profile fields.
GRANT UPDATE (specialties) ON public.organizations TO authenticated;
