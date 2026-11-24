import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const appOrigin = Deno.env.get('APP_ORIGIN');
const cors = {
  'Access-Control-Allow-Origin': appOrigin || 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async request => {
  if (!appOrigin) return Response.json({ error: 'Staff invitation endpoint is not configured.' }, { status: 503 });
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin && requestOrigin !== appOrigin) return Response.json({ error: 'Origin is not allowed.' }, { status: 403, headers: cors });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = request.headers.get('Authorization');
  if (!url || !anonKey || !serviceKey || !authHeader?.startsWith('Bearer ')) return Response.json({ error: 'Not configured or not authenticated' }, { status: 401, headers: cors });

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
  if (authError || !caller) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });

  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const nameAr = String(body.name_ar || '').trim();
    const nameEn = String(body.name_en || nameAr).trim();
    const phone = String(body.phone || '').trim();
    const role = String(body.role || '');
    const branchId = String(body.branch_id || '');
    const allowed = ['general_manager', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse', 'receptionist', 'accountant', 'lab_technician', 'radiology_technician', 'pharmacist', 'insurance_officer', 'records_officer'];
    if (!/^\S+@\S+\.\S+$/.test(email) || !nameAr || !branchId || !allowed.includes(role)) return Response.json({ error: 'Invalid staff details' }, { status: 400, headers: cors });
    const consultationFee = Number(body.consultation_fee || 0);
    const followUpFee = Number(body.follow_up_fee || 0);
    const commissionRate = Number(body.commission_rate || 0);
    if (['doctor', 'assistant_doctor'].includes(role) && (![consultationFee, followUpFee, commissionRate].every(Number.isFinite) || consultationFee < 0 || followUpFee < 0 || commissionRate < 0 || commissionRate > 100)) return Response.json({ error: 'Invalid doctor compensation details' }, { status: 400, headers: cors });

    const { data: actor, error: actorError } = await admin.from('users').select('organization_id,role,is_active').eq('id', caller.id).maybeSingle();
    if (actorError || !actor?.is_active || !actor.organization_id || !['org_owner', 'general_manager'].includes(actor.role)) return Response.json({ error: 'Insufficient permissions' }, { status: 403, headers: cors });
    if (role === 'general_manager' && actor.role !== 'org_owner') return Response.json({ error: 'Only the organization owner can invite a general manager.' }, { status: 403, headers: cors });
    const { data: branch, error: branchError } = await admin.from('branches').select('id').eq('id', branchId).eq('organization_id', actor.organization_id).eq('is_active', true).maybeSingle();
    if (branchError || !branch) return Response.json({ error: 'Branch not found' }, { status: 400, headers: cors });
    const { data: existingProfile, error: existingProfileError } = await admin.from('users').select('id').eq('email', email).maybeSingle();
    if (existingProfileError) return Response.json({ error: 'Could not verify whether this email is already registered.' }, { status: 500, headers: cors });
    if (existingProfile) return Response.json({ error: 'This email already has an account. Ask the account holder to contact the facility owner.' }, { status: 409, headers: cors });

    const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name_ar: nameAr, name_en: nameEn, phone },
      redirectTo: `${appOrigin.replace(/\/$/, '')}/`,
    });
    if (inviteError || !invitation.user) return Response.json({ error: inviteError?.message || 'Invitation failed' }, { status: 400, headers: cors });

    const { data: profile, error: profileError } = await admin.from('users').upsert({
      id: invitation.user.id, email, name_ar: nameAr, name_en: nameEn, phone: phone || null,
      organization_id: actor.organization_id, primary_branch_id: branchId, role, is_active: true,
    }, { onConflict: 'id' }).select('id').single();
    if (profileError || !profile) {
      await admin.auth.admin.updateUserById(invitation.user.id, { ban_duration: '876000h' });
      return Response.json({ error: 'Invitation created but staff profile could not be provisioned; account was disabled.' }, { status: 500, headers: cors });
    }

    const { error: accessError } = await admin.from('user_branch_access').upsert({ organization_id: actor.organization_id, user_id: profile.id, branch_id: branchId, is_default: true }, { onConflict: 'user_id,branch_id' });
    if (accessError) {
      await admin.from('users').update({ is_active: false }).eq('id', profile.id);
      await admin.auth.admin.updateUserById(profile.id, { ban_duration: '876000h' });
      return Response.json({ error: 'Branch access could not be assigned; the invited account was disabled.' }, { status: 500, headers: cors });
    }

    if (['doctor', 'assistant_doctor'].includes(role)) {
      const specialtyCode = String(body.specialty_code || 'general_medicine');
      const specialtyAr = String(body.specialty_title_ar || 'طب عام');
      const specialtyEn = String(body.specialty_title_en || 'General Practice');
      const { error: doctorError } = await admin.from('doctors').insert({ organization_id: actor.organization_id, user_id: profile.id, specialty_code: specialtyCode, specialty_title_ar: specialtyAr, specialty_title_en: specialtyEn, consultation_fee: consultationFee, follow_up_fee: followUpFee, commission_rate: commissionRate, is_active: true });
      if (doctorError) {
        await admin.from('users').update({ is_active: false }).eq('id', profile.id);
        await admin.auth.admin.updateUserById(profile.id, { ban_duration: '876000h' });
        return Response.json({ error: 'Doctor profile could not be provisioned; the invited account was disabled.' }, { status: 500, headers: cors });
      }
    }
    return Response.json({ success: true, staff_id: profile.id }, { status: 200, headers: cors });
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400, headers: cors });
  }
});
