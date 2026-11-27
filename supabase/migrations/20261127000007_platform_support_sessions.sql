-- Short-lived, audited platform support workspaces for test facilities only.
-- This does not change tenant RLS or impersonate a facility owner. Actions stay
-- attributed to the authenticated super admin.
CREATE TABLE public.platform_support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  ended_at TIMESTAMPTZ,
  end_reason TEXT CHECK (end_reason IN ('user_exit', 'expired', 'setup_failed')),
  CHECK (expires_at > started_at),
  CHECK ((ended_at IS NULL AND end_reason IS NULL) OR (ended_at IS NOT NULL AND end_reason IS NOT NULL))
);

CREATE INDEX platform_support_sessions_actor_recent_idx
  ON public.platform_support_sessions(platform_user_id, started_at DESC);
ALTER TABLE public.platform_support_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_support_sessions FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_start_support_session(p_organization_id UUID)
RETURNS TABLE(session_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_org_email TEXT;
  v_org_status TEXT;
  v_session_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_actor_name TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.is_platform_super_admin() THEN
    RAISE EXCEPTION 'An active platform super admin is required' USING ERRCODE = '42501';
  END IF;

  SELECT o.email, o.status::TEXT INTO v_org_email, v_org_status
  FROM public.organizations o WHERE o.id = p_organization_id;
  IF v_org_email IS NULL OR v_org_status <> 'active'
     OR LOWER(SPLIT_PART(v_org_email, '@', 2)) <> 'example.test' THEN
    RAISE EXCEPTION 'Support entry is limited to active test facilities' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.platform_support_sessions (organization_id, platform_user_id)
  VALUES (p_organization_id, v_actor)
  RETURNING id, platform_support_sessions.expires_at INTO v_session_id, v_expires_at;

  SELECT COALESCE(u.name_en, u.email) INTO v_actor_name FROM public.users u WHERE u.id = v_actor;
  INSERT INTO public.audit_logs (organization_id, user_id, user_name, action, entity_type, entity_id, new_values)
  VALUES (
    p_organization_id, v_actor, v_actor_name, 'PLATFORM_SUPPORT_START',
    'platform_support_session', v_session_id::TEXT,
    jsonb_build_object('expires_at', v_expires_at, 'actor_role', 'super_admin')
  );

  RETURN QUERY SELECT v_session_id, v_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_end_support_session(p_session_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_org_id UUID;
  v_actor_name TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.is_platform_super_admin() THEN
    RAISE EXCEPTION 'An active platform super admin is required' USING ERRCODE = '42501';
  END IF;
  IF p_reason NOT IN ('user_exit', 'expired', 'setup_failed') THEN
    RAISE EXCEPTION 'Unsupported support-session end reason';
  END IF;

  UPDATE public.platform_support_sessions s
  SET ended_at = NOW(), end_reason = p_reason
  WHERE s.id = p_session_id AND s.platform_user_id = v_actor AND s.ended_at IS NULL
  RETURNING s.organization_id INTO v_org_id;
  IF v_org_id IS NULL THEN
    -- Repeated exits are harmless, but a session owned by another user is not.
    IF NOT EXISTS (
      SELECT 1 FROM public.platform_support_sessions s
      WHERE s.id = p_session_id AND s.platform_user_id = v_actor
    ) THEN
      RAISE EXCEPTION 'Support session not found' USING ERRCODE = '42501';
    END IF;
    RETURN;
  END IF;

  SELECT COALESCE(u.name_en, u.email) INTO v_actor_name FROM public.users u WHERE u.id = v_actor;
  INSERT INTO public.audit_logs (organization_id, user_id, user_name, action, entity_type, entity_id, new_values)
  VALUES (
    v_org_id, v_actor, v_actor_name, 'PLATFORM_SUPPORT_END',
    'platform_support_session', p_session_id::TEXT,
    jsonb_build_object('ended_at', NOW(), 'reason', p_reason, 'actor_role', 'super_admin')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_start_support_session(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_end_support_session(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_start_support_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_end_support_session(UUID, TEXT) TO authenticated;
