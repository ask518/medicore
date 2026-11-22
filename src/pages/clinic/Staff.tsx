// ============================================================================
// MEDICORE – Staff & Role-Based Access Control (RBAC) Management
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { AppRole, User } from '../../types/database';
import { UserCog, Plus, Shield, Mail, Phone, CheckCircle2, X } from 'lucide-react';

export const Staff: React.FC = () => {
  const { organization } = useAuth();
  const { locale, t } = useLanguage();
  const { success } = useToast();

  if (!organization) return null;
  const orgId = organization.id;

  const staff = dbClient.getUsers(orgId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-medicore-600" />
            {t.nav.staff}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' ? 'فريق العمل الطبي والإداري والصلاحيات ونظام التحكم بالأدوار (RBAC)' : 'Clinical & Administrative team with Role-Based Access Control (RBAC)'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">
            {staff.length} {locale === 'ar' ? 'أعضاء في فريق العمل' : 'Staff Members'}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {staff.map(member => (
            <div key={member.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-medicore-50 text-medicore-700 font-bold text-xs flex items-center justify-center shrink-0">
                  {member.name_ar.slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      {member[locale === 'ar' ? 'name_ar' : 'name_en']}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {t.roles[member.role] || member.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span>{member.email}</span>
                    {member.phone && <span>• {member.phone}</span>}
                    {member.license_number && <span>• ترخيص: {member.license_number}</span>}
                  </div>
                </div>
              </div>

              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 self-end sm:self-auto">
                {t.common.active}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
