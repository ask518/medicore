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

const resolveOrigin = (request: Request): string | null => {
  const origin = request.headers.get('origin')?.replace(/\/+$/, '') || '';
  if (!origin) return configuredOrigins[0] || 'https://medicore-zeta-green.vercel.app';
  return allowedOrigins.has(origin) ? origin : null;
};

const buildCors = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

const roles = [
  'super_admin', 'org_owner', 'general_manager', 'branch_manager', 'doctor',
  'assistant_doctor', 'nurse', 'receptionist', 'accountant', 'lab_technician',
  'radiology_technician', 'pharmacist', 'insurance_officer', 'inventory_manager',
  'records_officer', 'patient',
];
const facilityTypes = ['private_clinic', 'poly_clinic', 'medical_center', 'specialized_center', 'complex', 'hospital'];
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
  const resolvedOrigin = resolveOrigin(request);
  if (!resolvedOrigin) {
    return Response.json({ error: 'Origin is not allowed.' }, { status: 403, headers: buildCors('null') });
  }
  const cors = buildCors(resolvedOrigin);
  const response = (payload: Record<string, unknown>, status = 200) =>
    Response.json(payload, { status, headers: cors });

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
      const specialties = Array.isArray(body.specialties)
        ? body.specialties.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 40)
        : null;
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
        ...(specialties && specialties.length > 0 ? { p_specialties: specialties } : {}),
      });
      if (updateError || !update?.[0]) return response({ error: updateError?.message || 'Facility update was not saved; no changes were committed.' }, 500);
      return response({ success: true, organization_id: organizationId, main_branch_id: update[0].main_branch_id });
    }

    if (action === 'create_user') {
      const identifier = normalizeIdentifier(String(body.email || body.username || ''));
      const password = String(body.password || '');
      const nameAr = String(body.name_ar || '').trim();
      const nameEn = String(body.name_en || nameAr).trim();
      const phone = String(body.phone || '').trim();
      const role = String(body.role || '');
      const organizationId = body.organization_id ? String(body.organization_id) : null;
      const branchId = body.branch_id ? String(body.branch_id) : null;

      if (!emailPattern.test(identifier) || !nameAr || !roles.includes(role)) {
        return response({ error: 'Enter a valid email or username, Arabic name, and role.' }, 400);
      }
      if (!isStrongPassword(password)) {
        return response({ error: 'Password must be at least 12 characters with a letter and a number.' }, 400);
      }
      if (role !== 'super_admin' && !organizationId) {
        return response({ error: 'Select a facility for non-platform roles.' }, 400);
      }
      if (organizationId && role === 'super_admin') {
        return response({ error: 'Super admin cannot belong to a clinic organization.' }, 400);
      }

      const { data: existing } = await admin.from('users').select('id').eq('email', identifier).maybeSingle();
      if (existing) {
        return response({ error: 'This username/email already has an account.' }, 409);
      }

      let resolvedBranchId = branchId;
      if (organizationId) {
        const { data: branch } = await admin
          .from('branches')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('is_main_branch', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!resolvedBranchId) resolvedBranchId = branch?.id || null;
        if (!resolvedBranchId) {
          return response({ error: 'The selected facility has no active branch.' }, 400);
        }
      }

      const { data: createdAuth, error: createAuthError } = await admin.auth.admin.createUser({
        email: identifier,
        password,
        email_confirm: true,
        user_metadata: { name_ar: nameAr, name_en: nameEn, phone },
      });
      if (createAuthError || !createdAuth?.user) {
        return response({ error: createAuthError?.message || 'Could not create auth user.' }, 400);
      }

      const newUserId = createdAuth.user.id;
      const { error: profileError } = await admin.from('users').upsert({
        id: newUserId,
        email: identifier,
        name_ar: nameAr,
        name_en: nameEn,
        phone: phone || null,
        organization_id: organizationId,
        primary_branch_id: resolvedBranchId,
        role,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (profileError) {
        await admin.auth.admin.deleteUser(newUserId);
        return response({ error: `Profile creation failed: ${profileError.message}` }, 500);
      }

      if (organizationId && resolvedBranchId) {
        await admin.from('user_branch_access').upsert(
          { organization_id: organizationId, user_id: newUserId, branch_id: resolvedBranchId, is_default: true },
          { onConflict: 'user_id,branch_id' }
        );
      }

      if (organizationId && ['doctor', 'assistant_doctor'].includes(role)) {
        const { error: docErr } = await admin.from('doctors').insert({
          organization_id: organizationId,
          user_id: newUserId,
          specialty_code: String(body.specialty_code || 'general_medicine'),
          specialty_title_ar: String(body.specialty_title_ar || 'طب عام'),
          specialty_title_en: String(body.specialty_title_en || 'General Practice'),
          consultation_fee: Number(body.consultation_fee || 0),
          follow_up_fee: Number(body.follow_up_fee || 0),
          commission_rate: Number(body.commission_rate || 0),
          is_active: true,
        });
        if (docErr) {
          console.error('Doctor profile insert notice:', docErr.message);
        }
      }

      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        user_id: actor.id,
        user_name: actor.name_en || actor.email,
        action: 'CREATE',
        entity_type: 'users',
        entity_id: newUserId,
        new_values: { email: identifier, role, organization_id: organizationId, provisioning: 'direct_password' },
      });

      return response({ success: true, user_id: newUserId, email: identifier });
    }

    if (action === 'update_user') {
      const targetId = String(body.user_id || '');
      const nameAr = String(body.name_ar || '').trim();
      const nameEn = String(body.name_en || nameAr).trim();
      const role = String(body.role || '');
      const isActive = body.is_active;
      const newPassword = body.password ? String(body.password) : '';
      if (!targetId || !nameAr || nameAr.length > 255 || nameEn.length > 255 || !roles.includes(role) || typeof isActive !== 'boolean') {
        return response({ error: 'Invalid account details.' }, 400);
      }
      if (newPassword && !isStrongPassword(newPassword)) {
        return response({ error: 'New password must be at least 12 characters with a letter and a number.' }, 400);
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

      if (target.is_active !== isActive || newPassword) {
        const authPayload: Record<string, unknown> = {};
        if (target.is_active !== isActive) authPayload.ban_duration = isActive ? 'none' : '876000h';
        if (newPassword) {
          authPayload.password = newPassword;
          authPayload.email_confirm = true;
        }
        const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetId, authPayload);
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
        new_values: { role, is_active: isActive, name_ar: nameAr, name_en: nameEn, password_reset: Boolean(newPassword) },
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
      const ownerEmail = normalizeIdentifier(String(body.owner_email || ''));
      const ownerPassword = String(body.owner_password || '');
      const ownerNameAr = String(body.owner_name_ar || '').trim();
      const ownerNameEn = String(body.owner_name_en || ownerNameAr).trim();
      const nameAr = String(body.name_ar || '').trim();
      const nameEn = String(body.name_en || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const phone = String(body.phone || '').trim();
      const city = String(body.city || '').trim();
      const address = String(body.address || '').trim();
      const facilityType = String(body.facility_type || 'private_clinic');
      const specialties = Array.isArray(body.specialties)
        ? body.specialties.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 40)
        : ['general_practice'];
      const cleanSpecialties = specialties.length > 0 ? specialties : ['general_practice'];
      const planId = body.plan_id ? String(body.plan_id).trim() : null;
      const cycle = ['monthly', 'annual'].includes(String(body.cycle || '')) ? String(body.cycle) : 'monthly';
      if (!emailPattern.test(ownerEmail) || !ownerNameAr || !nameAr || !nameEn || !emailPattern.test(email)
          || !phone || !city || !address || !facilityTypes.includes(facilityType)) {
        return response({ error: 'Complete all facility and owner fields with a valid email or username.' }, 400);
      }
      if (ownerPassword && !isStrongPassword(ownerPassword)) {
        return response({ error: 'Owner password must be at least 12 characters with a letter and a number.' }, 400);
      }
      if (ownerEmail === actor.email?.toLowerCase()) return response({ error: 'Use a separate account for the facility owner.' }, 409);
      const { data: existing, error: existingError } = await admin.from('users').select('id').eq('email', ownerEmail).maybeSingle();
      if (existingError) return response({ error: 'Could not check the owner email.' }, 500);
      if (existing) return response({ error: 'This email/username already has a MEDICORE account. Use an unregistered owner account.' }, 409);

      const ownerMetadata = { name_ar: ownerNameAr, name_en: ownerNameEn };
      let ownerUser: { id: string } | null = null;
      let manualInvitationLink: string | null = null;
      let deliveryMode: 'direct_password' | 'manual_link' | 'email' = 'email';

      if (ownerPassword) {
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: ownerEmail,
          password: ownerPassword,
          email_confirm: true,
          user_metadata: ownerMetadata,
        });
        if (createError || !created?.user) {
          return response({ error: createError?.message || 'Direct owner account creation failed.' }, 400);
        }
        ownerUser = created.user;
        deliveryMode = 'direct_password';
      } else {
        const redirectTo = `${resolvedOrigin}/`;
        const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(ownerEmail, {
          data: ownerMetadata,
          redirectTo,
        });
        ownerUser = invite?.user || null;
        const emailRateLimited = /email rate limit exceeded|over_email_send_rate_limit/i.test(inviteError?.message || '');
        if (inviteError && emailRateLimited) {
          const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
            type: 'invite',
            email: ownerEmail,
            options: { data: ownerMetadata, redirectTo },
          });
          if (!linkError && generated?.user && generated.properties?.action_link) {
            ownerUser = generated.user;
            manualInvitationLink = generated.properties.action_link;
            deliveryMode = 'manual_link';
          } else {
            return response({
              error: `Supabase email is rate limited and a one-time invitation link could not be generated. ${linkError?.message || 'Supply a direct password instead.'}`,
            }, 429);
          }
        } else if (inviteError || !ownerUser) {
          return response({ error: inviteError?.message || 'Owner invitation failed.' }, 400);
        }
      }

      const { data: provision, error: provisionError } = await admin.rpc('platform_provision_facility', {
        p_actor_id: actor.id,
        p_owner_user_id: ownerUser.id,
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
        p_specialties: cleanSpecialties,
        ...(planId ? { p_plan_id: planId } : {}),
        p_cycle: cycle,
      });
      if (provisionError || !provision?.[0]) {
        await admin.from('users').update({ is_active: false }).eq('id', ownerUser.id);
        await admin.auth.admin.updateUserById(ownerUser.id, { ban_duration: '876000h' });
        return response({ error: `The owner account was prepared, but facility setup failed. The account was disabled. ${provisionError?.message || 'Contact support before retrying.'}` }, 500);
      }
      return response({
        success: true,
        organization_id: provision[0].organization_id,
        branch_id: provision[0].branch_id,
        owner_email: ownerEmail,
        invitation_delivery: deliveryMode,
        ...(manualInvitationLink ? { invitation_link: manualInvitationLink } : {}),
      });
    }

    if (action === 'set_facility_status') {
      const organizationId = String(body.organization_id || '');
      const status = String(body.status || '');
      if (!organizationId || !['pending_approval', 'active', 'suspended', 'archived'].includes(status)) {
        return response({ error: 'Provide a valid organization and status.' }, 400);
      }
      const { data: updatedStatus, error: statusError } = await admin.rpc('platform_set_facility_status', {
        p_actor_id: actor.id,
        p_organization_id: organizationId,
        p_status: status,
      });
      if (statusError) return response({ error: statusError.message || 'Could not update facility status.' }, 400);
      return response({ success: true, organization_id: organizationId, status: updatedStatus });
    }

    if (action === 'update_subscription') {
      const organizationId = String(body.organization_id || '');
      const planId = String(body.plan_id || '');
      const status = String(body.status || '');
      const cycle = String(body.cycle || '');
      const periodEnd = body.current_period_end ? String(body.current_period_end) : null;
      if (!organizationId || !planId || !['trialing', 'active', 'past_due', 'canceled', 'expired', 'suspended'].includes(status)
          || !['monthly', 'annual', 'lifetime', 'trial'].includes(cycle)) {
        return response({ error: 'Provide a valid facility, plan, status, and billing cycle.' }, 400);
      }
      const { data: subId, error: subError } = await admin.rpc('platform_update_subscription', {
        p_actor_id: actor.id,
        p_organization_id: organizationId,
        p_plan_id: planId,
        p_status: status,
        p_cycle: cycle,
        p_period_end: periodEnd,
      });
      if (subError) return response({ error: subError.message || 'Could not update subscription.' }, 400);
      return response({ success: true, subscription_id: subId });
    }

    if (action === 'delete_facility') {
      const organizationId = String(body.organization_id || '');
      if (!organizationId || body.confirm !== true) {
        return response({ error: 'Explicit confirmation is required to delete a facility.' }, 400);
      }

      const removeStorageFolder = async (prefix: string) => {
        const { data: items } = await admin.storage.from('medical-attachments').list(prefix, { limit: 1000 });
        if (!items || items.length === 0) return;
        const filePaths: string[] = [];
        for (const item of items) {
          const fullPath = `${prefix}/${item.name}`;
          if (item.id === null) {
            await removeStorageFolder(fullPath);
          } else {
            filePaths.push(fullPath);
          }
        }
        if (filePaths.length > 0) {
          await admin.storage.from('medical-attachments').remove(filePaths);
        }
      };

      try {
        await removeStorageFolder(organizationId);
      } catch (storageErr) {
        console.error('Storage cleanup notice during delete_facility:', storageErr);
      }

      const { data: delRows, error: delError } = await admin.rpc('platform_delete_facility', {
        p_actor_id: actor.id,
        p_organization_id: organizationId,
      });
      if (delError || !delRows?.[0]) {
        return response({ error: delError?.message || 'Facility deletion failed.' }, 500);
      }

      const deletedUserIds: string[] = Array.isArray(delRows[0].deleted_user_ids) ? delRows[0].deleted_user_ids : [];
      const failedAuthDeletions: string[] = [];
      for (const uid of deletedUserIds) {
        const { error: authDelError } = await admin.auth.admin.deleteUser(uid);
        if (authDelError) failedAuthDeletions.push(uid);
      }

      return response({
        success: true,
        deleted_org_id: delRows[0].deleted_org_id,
        deleted_users_count: deletedUserIds.length,
        failed_auth_deletions: failedAuthDeletions,
      });
    }

    if (action === 'save_plan') {
      const planId = body.plan_id ? String(body.plan_id) : null;
      const slug = String(body.slug || '').trim().toLowerCase();
      const nameAr = String(body.name_ar || '').trim();
      const nameEn = String(body.name_en || '').trim();
      const tier = String(body.tier || 'starter');
      if (!nameAr || !nameEn || !['starter', 'professional', 'medical_center', 'enterprise'].includes(tier)) {
        return response({ error: 'Enter valid Arabic and English names and plan tier.' }, 400);
      }
      const { data: savedPlanId, error: planError } = await admin.rpc('platform_save_subscription_plan', {
        p_actor_id: actor.id,
        p_plan_id: planId,
        p_slug: slug || nameEn,
        p_name_ar: nameAr,
        p_name_en: nameEn,
        p_tier: tier,
        p_price_monthly: Number(body.price_monthly ?? 0),
        p_price_annual: Number(body.price_annual ?? 0),
        p_currency: String(body.currency || 'EGP'),
        p_max_branches: Math.max(0, parseInt(String(body.max_branches ?? 1), 10) || 0),
        p_max_doctors: Math.max(0, parseInt(String(body.max_doctors ?? 3), 10) || 0),
        p_max_users: Math.max(0, parseInt(String(body.max_users ?? 10), 10) || 0),
        p_max_patients: Math.max(0, parseInt(String(body.max_patients ?? 500), 10) || 0),
        p_max_storage_mb: Math.max(100, parseInt(String(body.max_storage_mb ?? 2048), 10) || 2048),
        p_has_laboratory: Boolean(body.has_laboratory),
        p_has_radiology: Boolean(body.has_radiology),
        p_has_inventory: Boolean(body.has_inventory),
        p_has_insurance: Boolean(body.has_insurance),
        p_has_specialty_canvas: Boolean(body.has_specialty_canvas),
        p_has_accounting_ledger: Boolean(body.has_accounting_ledger),
        p_has_patient_portal: Boolean(body.has_patient_portal),
        p_has_dedicated_db: Boolean(body.has_dedicated_db),
        p_is_active: body.is_active !== false,
      });
      if (planError) return response({ error: planError.message || 'Could not save subscription plan.' }, 400);
      return response({ success: true, plan_id: savedPlanId });
    }

    if (action === 'delete_plan') {
      const planId = String(body.plan_id || '');
      if (!planId) return response({ error: 'Select a subscription plan.' }, 400);
      const { error: delPlanErr } = await admin.rpc('platform_delete_subscription_plan', {
        p_actor_id: actor.id,
        p_plan_id: planId,
      });
      if (delPlanErr) return response({ error: delPlanErr.message || 'Could not delete subscription plan.' }, 400);
      return response({ success: true, plan_id: planId });
    }

    return response({ error: 'Unsupported platform administration action.' }, 400);
  } catch (err) {
    console.error('Platform admin request failed:', err);
    return response({ error: 'Invalid request.' }, 400);
  }
});
