import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const configuredOrigins = (Deno.env.get('APP_ORIGIN') || '')
  .split(',')
  .map(o => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = new Set<string>([
  ...configuredOrigins,
  'https://medicore-zeta-green.vercel.app',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
]);

const buildCors = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

const emailPattern = /^\S+@\S+\.\S+$/;
const usernamePattern = /^[a-zA-Z0-9._-]{3,50}$/;
const normalizeIdentifier = (raw: string): string => {
  const clean = raw.trim().toLowerCase();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  return usernamePattern.test(clean) ? `${clean}@medicore.local` : '';
};

const isStrongPassword = (pw: string): boolean =>
  pw.length >= 12 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);

Deno.serve(async request => {
  const rawOrigin = request.headers.get('origin')?.replace(/\/+$/, '') || '';
  if (rawOrigin && !allowedOrigins.has(rawOrigin)) {
    return Response.json({ error: 'Origin is not allowed.' }, { status: 403, headers: buildCors('null') });
  }
  const matchedOrigin = rawOrigin || configuredOrigins[0] || 'https://medicore-zeta-green.vercel.app';
  const cors = buildCors(matchedOrigin);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = request.headers.get('Authorization');
  if (!url || !anonKey || !serviceKey || !authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Not configured or not authenticated' }, { status: 401, headers: cors });
  }

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
  if (authError || !caller) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });

  try {
    const body = await request.json();
    const email = normalizeIdentifier(String(body.email || body.username || ''));
    const password = String(body.password || '');
    const nameAr = String(body.name_ar || '').trim();
    const nameEn = String(body.name_en || nameAr).trim();
    const phone = String(body.phone || '').trim();
    const role = String(body.role || '');
    const branchId = String(body.branch_id || '');
    const requestedOrgId = body.organization_id ? String(body.organization_id) : null;
    const allowed = ['general_manager', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse', 'receptionist', 'accountant', 'lab_technician', 'radiology_technician', 'pharmacist', 'insurance_officer', 'inventory_manager', 'records_officer'];

    if (!emailPattern.test(email) || !nameAr || !branchId || !allowed.includes(role)) {
      return Response.json({ error: 'Invalid staff details or email/username.' }, { status: 400, headers: cors });
    }
    if (password && !isStrongPassword(password)) {
      return Response.json({ error: 'Password must be at least 12 characters with a letter and a number.' }, { status: 400, headers: cors });
    }

    const consultationFee = Number(body.consultation_fee || 0);
    const followUpFee = Number(body.follow_up_fee || 0);
    const commissionRate = Number(body.commission_rate || 0);
    if (['doctor', 'assistant_doctor'].includes(role) && (![consultationFee, followUpFee, commissionRate].every(Number.isFinite) || consultationFee < 0 || followUpFee < 0 || commissionRate < 0 || commissionRate > 100)) {
      return Response.json({ error: 'Invalid doctor compensation details' }, { status: 400, headers: cors });
    }

    const { data: actor, error: actorError } = await admin.from('users').select('organization_id,role,is_active').eq('id', caller.id).maybeSingle();
    if (actorError || !actor?.is_active) return Response.json({ error: 'Insufficient permissions' }, { status: 403, headers: cors });

    let targetOrgId = actor.organization_id;
    if (actor.role === 'super_admin' && requestedOrgId) {
      const { data: support } = await admin
        .from('platform_support_sessions')
        .select('id')
        .eq('platform_user_id', caller.id)
        .eq('organization_id', requestedOrgId)
        .is('ended_at', null)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();
      if (!support) return Response.json({ error: 'An active facility support session is required.' }, { status: 403, headers: cors });
      targetOrgId = requestedOrgId;
    } else if (!actor.organization_id || !['org_owner', 'general_manager'].includes(actor.role)) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403, headers: cors });
    }

    if (role === 'general_manager' && !['org_owner', 'super_admin'].includes(actor.role)) {
      return Response.json({ error: 'Only the organization owner can create a general manager.' }, { status: 403, headers: cors });
    }

    const { data: branch, error: branchError } = await admin.from('branches').select('id').eq('id', branchId).eq('organization_id', targetOrgId).eq('is_active', true).maybeSingle();
    if (branchError || !branch) return Response.json({ error: 'Branch not found' }, { status: 400, headers: cors });

    const { data: existingProfile, error: existingProfileError } = await admin.from('users').select('id').eq('email', email).maybeSingle();
    if (existingProfileError) return Response.json({ error: 'Could not verify whether this email/username is already registered.' }, { status: 500, headers: cors });
    if (existingProfile) return Response.json({ error: 'This email/username already has an account.' }, { status: 409, headers: cors });

    let staffAuthUser: { id: string } | null = null;
    let manualInvitationLink: string | null = null;
    let deliveryMode: 'direct_password' | 'manual_link' | 'email' = 'email';
    const userMetadata = { name_ar: nameAr, name_en: nameEn, phone };

    if (password) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });
      if (createError || !created?.user) {
        return Response.json({ error: createError?.message || 'Account creation failed' }, { status: 400, headers: cors });
      }
      staffAuthUser = created.user;
      deliveryMode = 'direct_password';
    } else {
      const redirectTo = `${matchedOrigin}/`;
      const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: userMetadata,
        redirectTo,
      });
      staffAuthUser = invitation?.user || null;
      const emailRateLimited = /email rate limit exceeded|over_email_send_rate_limit/i.test(inviteError?.message || '');
      if (inviteError && emailRateLimited) {
        const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
          type: 'invite',
          email,
          options: { data: userMetadata, redirectTo },
        });
        if (!linkError && generated?.user && generated.properties?.action_link) {
          staffAuthUser = generated.user;
          manualInvitationLink = generated.properties.action_link;
          deliveryMode = 'manual_link';
        } else {
          return Response.json({ error: 'Supabase email limit reached; enter a direct password instead.' }, { status: 429, headers: cors });
        }
      } else if (inviteError || !staffAuthUser) {
        return Response.json({ error: inviteError?.message || 'Invitation failed' }, { status: 400, headers: cors });
      }
    }

    const { data: profile, error: profileError } = await admin.from('users').upsert({
      id: staffAuthUser.id, email, name_ar: nameAr, name_en: nameEn, phone: phone || null,
      organization_id: targetOrgId, primary_branch_id: branchId, role, is_active: true,
    }, { onConflict: 'id' }).select('id').single();

    if (profileError || !profile) {
      await admin.auth.admin.deleteUser(staffAuthUser.id).catch(() =>
        admin.auth.admin.updateUserById(staffAuthUser.id, { ban_duration: '876000h' })
      );
      const errMsg = profileError?.message || 'Staff profile could not be provisioned; account was disabled.';
      return Response.json({ error: errMsg }, { status: errMsg.includes('PLAN_LIMIT_REACHED') ? 400 : 500, headers: cors });
    }

    const { error: accessError } = await admin.from('user_branch_access').upsert({
      organization_id: targetOrgId, user_id: profile.id, branch_id: branchId, is_default: true,
    }, { onConflict: 'user_id,branch_id' });
    if (accessError) {
      await admin.from('users').update({ is_active: false }).eq('id', profile.id);
      await admin.auth.admin.updateUserById(profile.id, { ban_duration: '876000h' });
      return Response.json({ error: accessError.message || 'Branch access could not be assigned; account was disabled.' }, { status: 500, headers: cors });
    }

    if (['doctor', 'assistant_doctor'].includes(role)) {
      const specialtyCode = String(body.specialty_code || 'general_medicine');
      const specialtyAr = String(body.specialty_title_ar || 'طب عام');
      const specialtyEn = String(body.specialty_title_en || 'General Practice');
      const { error: doctorError } = await admin.from('doctors').insert({
        organization_id: targetOrgId, user_id: profile.id, specialty_code: specialtyCode,
        specialty_title_ar: specialtyAr, specialty_title_en: specialtyEn,
        consultation_fee: consultationFee, follow_up_fee: followUpFee, commission_rate: commissionRate, is_active: true,
      });
      if (doctorError) {
        await admin.from('users').update({ is_active: false }).eq('id', profile.id);
        await admin.auth.admin.updateUserById(profile.id, { ban_duration: '876000h' });
        const docMsg = doctorError.message || 'Doctor profile could not be provisioned; account was disabled.';
        return Response.json({ error: docMsg }, { status: docMsg.includes('PLAN_LIMIT_REACHED') ? 400 : 500, headers: cors });
      }
    }

    return Response.json({
      success: true,
      staff_id: profile.id,
      email,
      delivery_mode: deliveryMode,
      ...(manualInvitationLink ? { invitation_link: manualInvitationLink } : {}),
    }, { status: 200, headers: cors });
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400, headers: cors });
  }
});
