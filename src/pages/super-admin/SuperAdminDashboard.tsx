// ============================================================================
// MEDICORE – SaaS Platform Owner (Super Admin) Dashboard
// Multi-Tenant Oversight, MRR/ARR Engine, Plan Limits & Organization Governance
// ============================================================================

import React, { useState } from 'react';
import { dbClient } from '../../lib/dbClient';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { 
  Building2, CreditCard, DollarSign, HardDrive, ShieldCheck, 
  CheckCircle, AlertTriangle, Users, Plus, Edit2, Megaphone,
  Activity, ArrowUpRight, Lock
} from 'lucide-react';
import { SubscriptionPlan, Organization } from '../../types/database';

export const SuperAdminDashboard: React.FC = () => {
  const { locale, t } = useLanguage();
  const { success, info } = useToast();

  const orgs = dbClient.getOrganizations();
  const plans = dbClient.getPlans();
  const auditLogs = dbClient.getAuditLogs();
  const announcements = dbClient.getAnnouncements();

  // Metrics
  const totalOrgs = orgs.length;
  const activeSubs = orgs.filter(o => o.status === 'active').length;
  const totalStorage = orgs.reduce((acc, o) => acc + (o.storage_consumed_mb || 0), 0);
  
  // Calculate MRR
  const mrr = orgs.reduce((sum, o) => {
    const sub = dbClient.getSubscriptionByOrgId(o.id);
    return sum + (sub?.status === 'active' ? sub.amount : 0);
  }, 0);
  const arr = mrr * 12;

  // Selected plan to edit
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [newPlanPrice, setNewPlanPrice] = useState<number>(0);
  const [newMaxDoctors, setNewMaxDoctors] = useState<number>(0);
  const [newMaxBranches, setNewMaxBranches] = useState<number>(0);

  // New Organization Modal
  const [showAddOrgModal, setShowAddOrgModal] = useState(false);
  const [newOrgNameAr, setNewOrgNameAr] = useState('');
  const [newOrgNameEn, setNewOrgNameEn] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');
  const [newOrgPhone, setNewOrgPhone] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState('medical_center');

  const handleUpdateStatus = (orgId: string, newStatus: Organization['status']) => {
    dbClient.updateOrganizationStatus(orgId, newStatus);
    success(locale === 'ar' ? 'تم تحديث حالة المنشأة الطبية بنجاح' : 'Organization status updated');
  };

  const handleOpenEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setNewPlanPrice(plan.price_monthly);
    setNewMaxDoctors(plan.max_doctors);
    setNewMaxBranches(plan.max_branches);
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    dbClient.updatePlan(editingPlan.id, {
      price_monthly: newPlanPrice,
      max_doctors: newMaxDoctors,
      max_branches: newMaxBranches,
    });
    success(locale === 'ar' ? 'تم تحديث حدود وأسعار الباقة بنجاح' : 'Plan limits updated successfully');
    setEditingPlan(null);
  };

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgNameAr || !newOrgEmail || !newOrgPhone) return;

    dbClient.createOrganization({
      name_ar: newOrgNameAr,
      name_en: newOrgNameEn || newOrgNameAr,
      slug: newOrgNameEn.toLowerCase().replace(/\s+/g, '-') || `org-${Date.now()}`,
      facility_type: 'medical_center',
      status: 'active',
      email: newOrgEmail,
      phone: newOrgPhone,
      country: 'مصر',
      city: 'القاهرة',
      timezone: 'Africa/Cairo',
      default_currency: 'EGP',
      is_enterprise_dedicated: false,
    }, newOrgPlan);

    success(locale === 'ar' ? 'تم تسجيل المنشأة والفرع الرئيسي بنجاح' : 'Organization & Main branch registered');
    setShowAddOrgModal(false);
    setNewOrgNameAr('');
    setNewOrgNameEn('');
    setNewOrgEmail('');
    setNewOrgPhone('');
  };

  return (
    <div className="space-y-6">
      {/* Platform Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            <h1 className="text-xl sm:text-2xl font-black">{t.superAdmin.title}</h1>
          </div>
          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">{t.superAdmin.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddOrgModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-medicore-500 to-medicore-600 hover:from-medicore-600 hover:to-medicore-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.superAdmin.registerOrg}</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{t.superAdmin.mrr}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {mrr.toLocaleString()} <span className="text-xs font-semibold text-slate-500">ج.م / شهر</span>
            </p>
            <p className="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>ARR: {arr.toLocaleString()} ج.م</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total Orgs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{t.superAdmin.totalOrgs}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{totalOrgs}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              {activeSubs} {t.common.active}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-medicore-50 text-medicore-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Active Subscriptions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{t.superAdmin.activeSubscriptions}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{activeSubs}</p>
            <p className="text-[11px] text-purple-600 font-bold mt-1">100% {locale === 'ar' ? 'سداد منتظم' : 'Healthy'}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Storage Used */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{t.superAdmin.storageUsed}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {totalStorage.toFixed(1)} <span className="text-xs font-semibold text-slate-500">MB</span>
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              {locale === 'ar' ? 'سحابة كائنات آمنة' : 'Secure Cloud'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <HardDrive className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Organizations Management Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-medicore-600" />
            {t.nav.organizations}
          </h2>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {orgs.length} {locale === 'ar' ? 'منشأة مسجلة' : 'Registered'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 text-start">{locale === 'ar' ? 'المنشأة الطبية' : 'Organization'}</th>
                <th className="p-3.5 text-start">{locale === 'ar' ? 'النوع' : 'Facility Type'}</th>
                <th className="p-3.5 text-start">{locale === 'ar' ? 'باقة الاشتراك' : 'Plan'}</th>
                <th className="p-3.5 text-start">{locale === 'ar' ? 'الفروع' : 'Branches'}</th>
                <th className="p-3.5 text-start">{locale === 'ar' ? 'الأطباء' : 'Doctors'}</th>
                <th className="p-3.5 text-start">{t.common.status}</th>
                <th className="p-3.5 text-end">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orgs.map(org => {
                const sub = dbClient.getSubscriptionByOrgId(org.id);
                const branches = dbClient.getBranches(org.id);
                const doctors = dbClient.getDoctors(org.id);
                const isDedicated = org.is_enterprise_dedicated;

                return (
                  <tr key={org.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-medicore-100 text-medicore-700 font-bold flex items-center justify-center shrink-0">
                          {org.name_ar.slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            {org[locale === 'ar' ? 'name_ar' : 'name_en']}
                            {isDedicated && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-extrabold uppercase">
                                Dedicated
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">{org.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 capitalize font-medium text-slate-700">
                      {org.facility_type.replace('_', ' ')}
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-800">
                        {sub?.plan?.[locale === 'ar' ? 'name_ar' : 'name_en'] || 'Standard'}
                      </span>
                      <p className="text-[11px] text-emerald-600 font-semibold">{sub?.amount} {sub?.currency} / شهر</p>
                    </td>
                    <td className="p-3.5 font-bold text-slate-700">{branches.length}</td>
                    <td className="p-3.5 font-bold text-slate-700">{doctors.length}</td>
                    <td className="p-3.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        org.status === 'active' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {org.status === 'active' ? t.common.active : t.common.inactive}
                      </span>
                    </td>
                    <td className="p-3.5 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        {org.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(org.id, 'suspended')}
                            className="px-2.5 py-1 text-xs rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 font-bold"
                          >
                            {t.superAdmin.suspendOrg}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(org.id, 'active')}
                            className="px-2.5 py-1 text-xs rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold"
                          >
                            {t.superAdmin.activateOrg}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscription Plans & Limits Configurator */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-medicore-600" />
              {locale === 'ar' ? 'محرك باقات الاشتراك والحدود السحابية' : 'SaaS Subscription Plans & Limits Engine'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {locale === 'ar' ? 'تعديل أسعار الاشتراك والحدود المسموح بها لكل باقة ديناميكياً بدون كود ثابت' : 'Configure dynamic plan pricing, limits, and module entitlements'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-medicore-100 text-medicore-800 uppercase">
                    {plan.tier}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenEditPlan(plan)}
                    className="p-1 text-slate-400 hover:text-medicore-600 rounded"
                    title="تعديل الأسعار والحدود"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {plan[locale === 'ar' ? 'name_ar' : 'name_en']}
                </h4>
                <div className="mt-2">
                  <span className="text-xl font-black text-slate-900">{plan.price_monthly}</span>
                  <span className="text-xs text-slate-500 font-semibold"> {plan.currency} / شهر</span>
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200">
                <div className="flex justify-between">
                  <span>{t.superAdmin.maxBranches}:</span>
                  <span className="font-bold">{plan.max_branches}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.superAdmin.maxDoctors}:</span>
                  <span className="font-bold">{plan.max_doctors}</span>
                </div>
                <div className="flex justify-between">
                  <span>{locale === 'ar' ? 'المساحة السحابية:' : 'Storage:'}</span>
                  <span className="font-bold">{plan.max_storage_mb / 1024} GB</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security Audit Trail Log (Platform Wide) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5 text-medicore-600" />
          {locale === 'ar' ? 'سجل التدقيق الأمني المباشر (Security Audit Trail)' : 'Live Platform Audit Trail'}
        </h3>
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
          {auditLogs.map(log => (
            <div key={log.id} className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-800">{log.user_name}</span>
                <span className="text-slate-500">{log.action}</span>
                <span className="font-mono bg-slate-100 px-1 rounded text-[11px] text-slate-600">{log.entity_type}</span>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">{new Date(log.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in border border-slate-100">
            <h3 className="font-bold text-slate-800 text-base mb-4">
              {locale === 'ar' ? `تعديل باقة (${editingPlan.name_ar})` : `Edit Plan: ${editingPlan.name_en}`}
            </h3>
            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.superAdmin.pricingMonthly} (ج.م)
                </label>
                <input
                  type="number"
                  value={newPlanPrice}
                  onChange={e => setNewPlanPrice(Number(e.target.value))}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.superAdmin.maxBranches}
                  </label>
                  <input
                    type="number"
                    value={newMaxBranches}
                    onChange={e => setNewMaxBranches(Number(e.target.value))}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.superAdmin.maxDoctors}
                  </label>
                  <input
                    type="number"
                    value={newMaxDoctors}
                    onChange={e => setNewMaxDoctors(Number(e.target.value))}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-xl"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Organization Modal */}
      {showAddOrgModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-scale-in border border-slate-100">
            <h3 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-medicore-600" />
              {t.superAdmin.registerOrg}
            </h3>
            <form onSubmit={handleCreateOrg} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'اسم المنشأة بالعربية' : 'Facility Name (Arabic)'}
                </label>
                <input
                  type="text"
                  required
                  value={newOrgNameAr}
                  onChange={e => setNewOrgNameAr(e.target.value)}
                  placeholder="مثال: مجمع الشفاء الطبي التخصصي"
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'اسم المنشأة بالإنجليزية' : 'Facility Name (English)'}
                </label>
                <input
                  type="text"
                  value={newOrgNameEn}
                  onChange={e => setNewOrgNameEn(e.target.value)}
                  placeholder="e.g. Al-Shifa Medical Center"
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === 'ar' ? 'البريد الإلكتروني للإدارة' : 'Official Email'}
                  </label>
                  <input
                    type="email"
                    required
                    value={newOrgEmail}
                    onChange={e => setNewOrgEmail(e.target.value)}
                    placeholder="admin@clinic.com"
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === 'ar' ? 'رقم الهاتف' : 'Phone'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={newOrgPhone}
                    onChange={e => setNewOrgPhone(e.target.value)}
                    placeholder="+20 100 ..."
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.superAdmin.planTier}
                </label>
                <select
                  value={newOrgPlan}
                  onChange={e => setNewOrgPlan(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  <option value="starter">{locale === 'ar' ? 'الباقة الأساسية للعيادات الفردية (599 ج.م)' : 'Starter'}</option>
                  <option value="professional">{locale === 'ar' ? 'باقة العيادات التخصصية المتقدمة (1299 ج.م)' : 'Professional'}</option>
                  <option value="medical_center">{locale === 'ar' ? 'باقة المجمعات والمراكز الطبية الشاملة (2799 ج.م)' : 'Medical Center'}</option>
                  <option value="enterprise">{locale === 'ar' ? 'باقة المستشفيات والمؤسسات الكبرى (6999 ج.م)' : 'Enterprise Dedicated'}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddOrgModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {locale === 'ar' ? 'تأكيد التسجيل وإنشاء الحساب' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
