import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const appOrigin = Deno.env.get('APP_ORIGIN')?.replace(/\/+$/, '');
const cors = {
  'Access-Control-Allow-Origin': appOrigin || 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

const roles = [
  'super_admin', 'org_owner', 'general_manager', 'branch_manager', 'doctor',
  'assistant_doctor', 'nurse', 'receptionist', 'accountant', 'lab_technician',
  'radiology_technician', 'pharmacist', 'insurance_officer', 'inventory_manager',
  'records_officer', 'patient',
];
const facilityTypes = ['private_clinic', 'poly_clinic', 'medical_center', 'specialized_center', 'complex', 'hospital'];
const emailPattern = /^\S+@\S+\.\S+$/;

const response = (payload: Record<string, unknown>, status = 200) =>
  Response.json(payload, { status, headers: cors });

Deno.serve(async request => {
  if (!appOrigin) return response({ error: 'Platform administration endpoint is not configured.' }, 503);
  if (request.headers.get('origin') !== appOrigin) return response({ error: 'Origin is not allowed.' }, 403);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = request.headers.get('Authorization');
  if (!url || !anonKey || !serviceKey || !authHeader?.startsWith('Bearer ')) {
    return response({ error: 'Not configured or not authenticated.' }, 401);
  }

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
  if (authError || !caller) return response({ error: 'Unauthorized.' }, 401);

  const { data: actor, error: actorError } = await admin
    .from('users').select('id,role,is_active,email,name_en').eq('id', caller.id).maybeSingle();
  if (actorError) {
    console.error('Platform admin profile lookup failed:', actorError.code, actorError.message);
    return response({ error: `Could not verify platform admin profile (${actorError.code || 'unknown'}).` }, 500);
  }
  if (!actor) return response({ error: 'No platform user profile is linked to this sign-in.' }, 403);
  if (!actor.is_active) return response({ error: 'This platform account is inactive.' }, 403);
  if (actor.role !== 'super_admin') return response({ error: 'This account does not have the super admin role.' }, 403);

  try {
    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'update_facility') {
      const organizationId = String(body.organization_id || '');
      const nameAr = String(body.name_ar || '').trim();
      const nameEn = String(body.name_en || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const phone = String(body.phone || '').trim();
      const city = String(body.city || '').trim();
      const address = String(body.address || '').trim();
      const facilityType = String(body.facility_type || '');
      if (!organizationId || !nameAr || !nameEn || !emailPattern.test(email) || !phone || !city || !address
          || !facilityTypes.includes(facilityType)) {
        return response({ error: 'Complete all facility details with a valid email.' }, 400);
      }
      const { data: update, error: updateError } = await admin.rpc('platform_update_facility', {
        p_actor_id: actor.id,
        p_organization_id: organizationId,
        p_name_ar: nameAr,
        p_name_en: nameEn,
        p_facility_type: facilityType,
        p_email: email,
        p_phone: phone,
        p_city: city,
        p_address: address,
      });
      if (updateError || !update?.[0]) return response({ error: updateError?.message || 'Facility update was not saved; no changes were committed.' }, 500);
      return response({ success: true, organization_id: organizationId, main_branch_id: update[0].main_branch_id });
    }

    if (action === 'update_user') {
      const targetId = String(body.user_id || '');
      const nameAr = String(body.name_ar || '').trim();
      const nameEn = String(body.name_en || nameAr).trim();
      const role = String(body.role || '');
      const isActive = body.is_active;
      if (!targetId || !nameAr || nameAr.length > 255 || nameEn.length > 255 || !roles.includes(role) || typeof isActive !== 'boolean') {
        return response({ error: 'Invalid account details.' }, 400);
      }
      if (targetId === actor.id && (!isActive || role !== 'super_admin')) {
        return response({ error: 'You cannot deactivate or demote your own platform account.' }, 409);
      }

      const { data: target, error: targetError } = await admin
        .from('users').select('id,organization_id,role,is_active,email,name_ar,name_en').eq('id', targetId).maybeSingle();
      if (targetError || !target) return response({ error: 'Account not found.' }, 404);
      if (target.organization_id && role === 'super_admin') {
        return response({ error: 'A clinic account cannot be promoted to platform admin from this screen.' }, 400);
      }
      if (!target.organization_id && !['super_admin', 'patient'].includes(role)) {
        return response({ error: 'Assign a facility before choosing a clinic staff role.' }, 400);
      }
      if (target.role === 'super_admin' && (role !== 'super_admin' || !isActive)) {
        const { count, error: countError } = await admin.from('users')
          .select('id', { count: 'exact', head: true }).eq('role', 'super_admin').eq('is_active', true);
        if (countError) return response({ error: 'Could not verify platform administrator count.' }, 500);
        if ((count || 0) <= 1) return response({ error: 'The last active platform admin cannot be demoted or disabled.' }, 409);
      }
      if (target.organization_id && ['org_owner', 'general_manager'].includes(target.role)
          && (!isActive || !['org_owner', 'general_manager'].includes(role))) {
        const { count, error: managerCountError } = await admin.from('users')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', target.organization_id).eq('is_active', true)
          .in('role', ['org_owner', 'general_manager']);
        if (managerCountError) return response({ error: 'Could not verify facility administrator count.' }, 500);
        if ((count || 0) <= 1) return response({ error: 'The last active facility owner or manager cannot be disabled or demoted.' }, 409);
      }

      const { error: profileError } = await admin.from('users').update({
        name_ar: nameAr,
        name_en: nameEn,
        role,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      }).eq('id', targetId);
      if (profileError) return response({ error: `Could not save the account profile: ${profileError.message}` }, 500);

      if (target.is_active !== isActive) {
        const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetId, {
          ban_duration: isActive ? 'none' : '876000h',
        });
        if (authUpdateError) {
          await admin.from('users').update({
            name_ar: target.name_ar, name_en: target.name_en, is_active: target.is_active,
            role: target.role, updated_at: new Date().toISOString(),
          }).eq('id', targetId);
          return response({ error: `Account status could not be synchronized with authentication; no change was kept. ${authUpdateError.message}` }, 500);
        }
      }

      const { error: auditError } = await admin.from('audit_logs').insert({
        organization_id: target.organization_id,
        user_id: actor.id,
        user_name: actor.name_en || actor.email,
        action: 'UPDATE',
        entity_type: 'users',
        entity_id: targetId,
        old_values: { role: target.role, is_active: target.is_active, name_ar: target.name_ar, name_en: target.name_en },
        new_values: { role, is_active: isActive, name_ar: nameAr, name_en: nameEn },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        user_agent: request.headers.get('user-agent'),
      });
      if (auditError) {
        await admin.from('users').update({
          name_ar: target.name_ar, name_en: target.name_en, role: target.role,
          is_active: target.is_active, updated_at: new Date().toISOString(),
        }).eq('id', targetId);
        if (target.is_active !== isActive) {
          await admin.auth.admin.updateUserById(targetId, { ban_duration: target.is_active ? 'none' : '876000h' });
        }
        return response({ error: `The audit entry could not be saved; the account change was rolled back. ${auditError.message}` }, 500);
      }
      return response({ success: true });
    }

    if (action === 'create_facility') {
      const ownerEmail = String(body.owner_email || '').trim().toLowerCase();
      const ownerNameAr = String(body.owner_name_ar || '').trim();
      const ownerNameEn = String(body.owner_name_en || ownerNameAr).trim();
      const nameAr = String(body.name_ar || '').trim();
      const nameEn = String(body.name_en || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const phone = String(body.phone || '').trim();
      const city = String(body.city || '').trim();
      const address = String(body.address || '').trim();
      const facilityType = String(body.facility_type || 'private_clinic');
      if (!emailPattern.test(ownerEmail) || !ownerNameAr || !nameAr || !nameEn || !emailPattern.test(email)
          || !phone || !city || !address || !facilityTypes.includes(facilityType)) {
        return response({ error: 'Complete all facility and owner fields with a valid email.' }, 400);
      }
      if (ownerEmail === actor.email?.toLowerCase()) return response({ error: 'Use a separate account for the facility owner.' }, 409);
      const { data: existing, error: existingError } = await admin.from('users').select('id').eq('email', ownerEmail).maybeSingle();
      if (existingError) return response({ error: 'Could not check the owner email.' }, 500);
      if (existing) return response({ error: 'This email already has a MEDICORE account. Use an unregistered owner email.' }, 409);

      const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(ownerEmail, {
        data: { name_ar: ownerNameAr, name_en: ownerNameEn },
        redirectTo: `${appOrigin.replace(/\/$/, '')}/`,
      });
      if (inviteError || !invite.user) return response({ error: inviteError?.message || 'Owner invitation failed.' }, 400);

      const { data: provision, error: provisionError } = await admin.rpc('platform_provision_facility', {
        p_actor_id: actor.id,
        p_owner_user_id: invite.user.id,
        p_owner_email: ownerEmail,
        p_owner_name_ar: ownerNameAr,
        p_owner_name_en: ownerNameEn,
        p_name_ar: nameAr,
        p_name_en: nameEn,
        p_email: email,
        p_phone: phone,
        p_city: city,
        p_address: address,
        p_facility_type: facilityType,
      });
      if (provisionError || !provision?.[0]) {
        await admin.from('users').update({ is_active: false }).eq('id', invite.user.id);
        await admin.auth.admin.updateUserById(invite.user.id, { ban_duration: '876000h' });
        return response({ error: `The owner invitation was sent, but facility setup failed. The invited account was disabled. ${provisionError?.message || 'Contact support before retrying.'}` }, 500);
      }
      return response({ success: true, organization_id: provision[0].organization_id, branch_id: provision[0].branch_id });
    }

    return response({ error: 'Unsupported platform administration action.' }, 400);
  } catch {
    return response({ error: 'Invalid platform administration request.' }, 400);
  }
});
