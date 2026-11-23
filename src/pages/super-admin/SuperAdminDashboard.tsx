// ============================================================================
// MEDICORE – SaaS Platform Owner (Super Admin) Dashboard
// Multi-Tenant Governance, Commercial Onboarding, MRR/ARR & Live Facility Access
// ============================================================================

import React, { useState } from 'react';
import { dbClient } from '../../lib/dbClient';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { 
  Building2, CreditCard, DollarSign, HardDrive, ShieldCheck, 
  CheckCircle2, Users, Plus, Edit2, Megaphone,
  Activity, ArrowUpRight, Cloud, Trash2, ExternalLink,
  MapPin, Phone, Mail, Sparkles, AlertCircle, FileText
} from 'lucide-react';
import { SubscriptionPlan, Organization, FacilityType } from '../../types/database';

export const SuperAdminDashboard: React.FC = () => {
  const { locale, t } = useLanguage();
  const { switchOrganization } = useAuth();
  const { success, error, info } = useToast();

  const orgs = dbClient.getOrganizations();
  const plans = dbClient.getPlans();
  const auditLogs = dbClient.getAuditLogs();
  const announcements = dbClient.getAnnouncements();

  // Financial & Operational Metrics
  const totalOrgs = orgs.length;
  const activeSubs = orgs.filter(o => o.status === 'active').length;
  const totalStorage = orgs.reduce((acc, o) => acc + (o.storage_consumed_mb || 0), 0);
  
  // Real MRR/ARR computed from registered active organizations
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

  // New Organization Registration Wizard Modal
  const [showAddOrgModal, setShowAddOrgModal] = useState(false);
  const [newOrgNameAr, setNewOrgNameAr] = useState('');
  const [newOrgNameEn, setNewOrgNameEn] = useState('');
  const [newOrgType, setNewOrgType] = useState<FacilityType>('poly_clinic');
  const [newOrgCity, setNewOrgCity] = useState('القاهرة');
  const [newOrgAddress, setNewOrgAddress] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');
  const [newOrgPhone, setNewOrgPhone] = useState('');
  const [newOrgTaxNo, setNewOrgTaxNo] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState('medical_center');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const handleUpdateStatus = (orgId: string, newStatus: Organization['status']) => {
    dbClient.updateOrganizationStatus(orgId, newStatus);
    success(locale === 'ar' ? 'تم تحديث حالة المنشأة الطبية بنجاح' : 'Organization status updated');
  };

  const handleDeleteOrg = (org: Organization) => {
    const orgName = org[locale === 'ar' ? 'name_ar' : 'name_en'];
    if (window.confirm(locale === 'ar' ? `هل أنت متأكد من حذف منشأة "${orgName}" وكافة بياناتها؟` : `Are you sure you want to delete "${orgName}"?`)) {
      dbClient.deleteOrganization(org.id);
      success(locale === 'ar' ? `تم حذف المنشأة ${orgName} بنجاح.` : `Facility ${orgName} deleted successfully.`);
    }
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
    if (!newOrgNameAr || !newOrgEmail || !newOrgPhone) {
      error(locale === 'ar' ? 'يرجى استيفاء الحقول الإلزامية للمنشأة' : 'Please fill all required fields');
      return;
    }

    const { org } = dbClient.createOrganization({
      name_ar: newOrgNameAr,
      name_en: newOrgNameEn || newOrgNameAr,
      slug: newOrgNameEn.toLowerCase().replace(/\s+/g, '-') || `org-${Date.now()}`,
      facility_type: newOrgType,
      status: 'active',
      email: newOrgEmail,
      phone: newOrgPhone,
      country: 'مصر',
      city: newOrgCity,
      address: newOrgAddress,
      tax_number: newOrgTaxNo || undefined,
      timezone: 'Africa/Cairo',
      default_currency: 'EGP',
      is_enterprise_dedicated: newOrgPlan === 'enterprise',
    }, newOrgPlan, {
      name_ar: adminName || `مدير ${newOrgNameAr}`,
      name_en: newOrgNameEn ? `Admin ${newOrgNameEn}` : undefined,
      email: adminEmail || newOrgEmail,
      phone: newOrgPhone,
    });

    success(locale === 'ar' ? `تم تسجيل منشأة "${org.name_ar}" والفرع الرئيسي وحساب الإدارة بنجاح!` : `Facility "${org.name_en}" registered successfully!`);
    setShowAddOrgModal(false);

    // Reset Form Fields
    setNewOrgNameAr('');
    setNewOrgNameEn('');
    setNewOrgType('poly_clinic');
    setNewOrgCity('القاهرة');
    setNewOrgAddress('');
    setNewOrgEmail('');
    setNewOrgPhone('');
    setNewOrgTaxNo('');
    setAdminName('');
    setAdminEmail('');
  };

  const handleEnterClinicWorkspace = (orgId: string) => {
    switchOrganization(orgId);
  };

  const handlePurgeAll = () => {
    if (window.confirm(locale === 'ar' ? 'هل أنت متأكد من تصفير كافة المنشآت والبيانات والبدء ببيئة إنتاج فارغة تماماً؟' : 'Are you sure you want to purge all data and start completely fresh?')) {
      dbClient.purgeAllDemoData();
      info(locale === 'ar' ? 'تم تصفير المنصة وبدء بيئة إنتاج نظيفة.' : 'Platform reset to pure clean slate.');
    }
  };

  const getFacilityTypeName = (type: FacilityType) => {
    switch (type) {
      case 'private_clinic': return locale === 'ar' ? 'عيادة خاصة' : 'Private Clinic';
      case 'poly_clinic': return locale === 'ar' ? 'مجمع عيادات تخصصية' : 'Polyclinic';
      case 'medical_center': return locale === 'ar' ? 'مركز طبي متكامل' : 'Medical Center';
      case 'specialized_center': return locale === 'ar' ? 'مركز تخصصي' : 'Specialized Center';
      case 'hospital': return locale === 'ar' ? 'مستشفى تخصصي' : 'Hospital';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            <h1 className="text-xl sm:text-2xl font-black">{t.superAdmin.title}</h1>
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30 uppercase tracking-wider">
              B2B Business Edition
            </span>
          </div>
          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">{t.superAdmin.subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowAddOrgModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-medicore-500 to-medicore-600 hover:from-medicore-600 hover:to-medicore-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{locale === 'ar' ? '+ تسجيل منشأة طبية جديدة' : '+ Register New Facility'}</span>
          </button>
        </div>
      </div>

      {/* Cloud Status Indicator */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-sm text-slate-900">
                {locale === 'ar' ? 'السحابة المؤسسية وقاعدة البيانات الحية (Supabase PostgreSQL Enterprise)' : 'Supabase Cloud Database Engine'}
              </h3>
              <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>{locale === 'ar' ? 'سحابي حي ومؤمن (Cloud Active)' : 'Live & Verified'}</span>
              </span>
            </div>
            <p className="text-xs font-mono text-slate-500 mt-0.5">
              https://olfebegtdgpenrthhwbd.supabase.co
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
            <span>{locale === 'ar' ? 'بيئة تشغيلية حقيقية (Production Mode)' : 'Production Mode'}</span>
          </span>
          <button
            type="button"
            onClick={handlePurgeAll}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
            title={locale === 'ar' ? 'تصفير البيانات والبدء من جديد' : 'Reset Data'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
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
              <span>ARR: {arr.toLocaleString()} ج.م / سنة</span>
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
            <p className="text-[11px] text-slate-500 font-medium mt-1">
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
            <p className="text-[11px] text-purple-600 font-bold mt-1">
              {totalOrgs > 0 ? `${Math.round((activeSubs / totalOrgs) * 100)}% سداد منتظم` : 'جاهز للبدء'}
            </p>
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
            <p className="text-[11px] text-slate-500 font-medium mt-1">
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
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Building2 className="w-5 h-5 text-medicore-600" />
              <span>{locale === 'ar' ? 'إدارة المنشآت والمجمعات الطبية المسجلة' : 'Registered Medical Organizations'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {locale === 'ar' ? 'يمكنك الدخول لأي منشأة طبية كمسؤول عنها لإعداد عياداتها، أطبائها، حجز مواعيدها وخدماتها' : 'Enter any facility workspace to manage clinics, doctors, appointments and billing'}
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            {orgs.length} {locale === 'ar' ? 'منشأة مسجلة' : 'Registered Facilities'}
          </span>
        </div>

        {orgs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h3 className="font-black text-slate-800 text-base">
                {locale === 'ar' ? 'لا توجد منشآت طبية مسجلة بعد' : 'No Medical Organizations Registered Yet'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {locale === 'ar' 
                  ? 'منصتك تعمل الآن بنظام تجاري حقيقي ونظيف 100%. يمكنك البدء بتسجيل أول عيادة خاصة أو مجمع طبي وإصدار اشتراك رسمي لها.'
                  : 'Your platform is in clean commercial mode. Start by registering your first clinic or medical center.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddOrgModal(true)}
              className="px-5 py-2.5 bg-medicore-600 hover:bg-medicore-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{locale === 'ar' ? 'تسجيل أول منشأة طبية الآن' : 'Register First Facility Now'}</span>
            </button>
          </div>
        ) : (
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
                  <th className="p-3.5 text-end">{locale === 'ar' ? 'التحكم والإدارة' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orgs.map(org => {
                  const sub = dbClient.getSubscriptionByOrgId(org.id);
                  const branches = dbClient.getBranches(org.id);
                  const doctors = dbClient.getDoctors(org.id);

                  return (
                    <tr key={org.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-medicore-100 text-medicore-700 font-bold flex items-center justify-center shrink-0">
                            {org.name_ar.slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {org[locale === 'ar' ? 'name_ar' : 'name_en']}
                              {org.is_enterprise_dedicated && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-extrabold uppercase">
                                  Dedicated
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">{org.city} • {org.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 font-medium text-slate-700">
                        {getFacilityTypeName(org.facility_type)}
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
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Enter Clinic Workspace Button */}
                          <button
                            type="button"
                            onClick={() => handleEnterClinicWorkspace(org.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-medicore-50 hover:bg-medicore-100 text-medicore-700 text-xs font-bold border border-medicore-200 transition-colors shadow-2xs"
                            title={locale === 'ar' ? 'الدخول كمسؤول لإدارة هذه العيادة' : 'Manage this clinic workspace'}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{locale === 'ar' ? 'دخول إدارة العيادة' : 'Enter Workspace'}</span>
                          </button>

                          {org.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(org.id, 'suspended')}
                              className="px-2.5 py-1.5 text-xs rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 font-bold"
                            >
                              {t.superAdmin.suspendOrg}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(org.id, 'active')}
                              className="px-2.5 py-1.5 text-xs rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold"
                            >
                              {t.superAdmin.activateOrg}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteOrg(org)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={locale === 'ar' ? 'حذف المنشأة نهائياً' : 'Delete Organization'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
              {locale === 'ar' ? 'تعديل أسعار الاشتراك والحدود المسموح بها لكل باقة ديناميكياً' : 'Configure dynamic plan pricing, limits, and module entitlements'}
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
          {locale === 'ar' ? 'سجل العمليات الإدارية المباشر (Audit Trail)' : 'Live Platform Audit Trail'}
        </h3>
        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">{locale === 'ar' ? 'لا توجد سجلات بعد' : 'No audit entries logged yet'}</p>
        ) : (
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
        )}
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

      {/* Commercial Organization Registration Wizard Modal */}
      {showAddOrgModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl animate-scale-in border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-medicore-50 text-medicore-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">
                    {locale === 'ar' ? 'تسجيل منشأة طبية جديدة (Business Onboarding)' : 'Register New Medical Organization'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {locale === 'ar' ? 'إنشاء حساب المنشأة، الفرع الرئيسي، باقة الاشتراك وحساب الإدارة الأولي' : 'Setup organization, main branch, subscription plan and primary administrator'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddOrgModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              {/* Group 1: General Info */}
              <div>
                <span className="text-xs font-black text-medicore-700 uppercase tracking-wider block mb-2">
                  1. {locale === 'ar' ? 'بيانات المنشأة ونوع النشاط' : 'Facility Identity & Type'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'اسم المنشأة بالعربية *' : 'Facility Name (Arabic) *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={newOrgNameAr}
                      onChange={e => setNewOrgNameAr(e.target.value)}
                      placeholder="مثال: مجمع الشفاء الطبي التخصصي"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
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
                      placeholder="e.g. Al-Shifa Medical Complex"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'نوع المنشأة الطبية *' : 'Facility Type *'}
                    </label>
                    <select
                      value={newOrgType}
                      onChange={e => setNewOrgType(e.target.value as FacilityType)}
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white focus:border-medicore-500 focus:outline-none"
                    >
                      <option value="private_clinic">{locale === 'ar' ? 'عيادة خاصة فردية' : 'Private Clinic'}</option>
                      <option value="poly_clinic">{locale === 'ar' ? 'مجمع عيادات تخصصية' : 'Polyclinic'}</option>
                      <option value="medical_center">{locale === 'ar' ? 'مركز طبي متكامل' : 'Medical Center'}</option>
                      <option value="specialized_center">{locale === 'ar' ? 'مركز تخصصي (أسنان / عيون / عظام / تجميل)' : 'Specialized Center'}</option>
                      <option value="hospital">{locale === 'ar' ? 'مستشفى تخصصي' : 'Hospital'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'المحافظة / المدينة *' : 'City / Region *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={newOrgCity}
                      onChange={e => setNewOrgCity(e.target.value)}
                      placeholder="مثال: القاهرة / الجيزة / الإسكندرية"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Contact Details */}
              <div>
                <span className="text-xs font-black text-medicore-700 uppercase tracking-wider block mb-2">
                  2. {locale === 'ar' ? 'الموقع الجغرافي وبيانات التواصل' : 'Location & Contacts'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'البريد الإلكتروني الرسمي *' : 'Official Email *'}
                    </label>
                    <input
                      type="email"
                      required
                      value={newOrgEmail}
                      onChange={e => setNewOrgEmail(e.target.value)}
                      placeholder="admin@facility.com"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'رقم الهاتف والتواصل *' : 'Official Phone *'}
                    </label>
                    <input
                      type="tel"
                      required
                      value={newOrgPhone}
                      onChange={e => setNewOrgPhone(e.target.value)}
                      placeholder="+20 100 123 4567"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'العنوان التفصيلي' : 'Address'}
                    </label>
                    <input
                      type="text"
                      value={newOrgAddress}
                      onChange={e => setNewOrgAddress(e.target.value)}
                      placeholder="مثال: شارع التحرير، الدقي، الجيزة"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Group 3: Subscription Plan */}
              <div>
                <span className="text-xs font-black text-medicore-700 uppercase tracking-wider block mb-2">
                  3. {locale === 'ar' ? 'باقة الاشتراك والفوترة' : 'Subscription & Pricing'}
                </span>
                <select
                  value={newOrgPlan}
                  onChange={e => setNewOrgPlan(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white focus:border-medicore-500 focus:outline-none font-bold text-slate-800"
                >
                  <option value="starter">{locale === 'ar' ? 'باقة البداية (Starter) - 599 ج.م/شهر (فرع واحد، حتى 3 أطباء)' : 'Starter Plan (599 EGP/mo)'}</option>
                  <option value="professional">{locale === 'ar' ? 'باقة المحترفين (Pro) - 1,299 ج.م/شهر (فرعين، حتى 8 أطباء)' : 'Professional Plan (1,299 EGP/mo)'}</option>
                  <option value="medical_center">{locale === 'ar' ? 'باقة المراكز والمجمعات (Medical Center) - 2,799 ج.م/شهر (5 فروع، حتى 25 طبيباً)' : 'Medical Center Plan (2,799 EGP/mo)'}</option>
                  <option value="enterprise">{locale === 'ar' ? 'باقة المؤسسات والمستشفيات (Enterprise) - 6,999 ج.م/شهر (سحابة مخصصة غير محدودة)' : 'Enterprise Dedicated (6,999 EGP/mo)'}</option>
                </select>
              </div>

              {/* Group 4: Clinic Admin Credentials */}
              <div>
                <span className="text-xs font-black text-medicore-700 uppercase tracking-wider block mb-2">
                  4. {locale === 'ar' ? 'بيانات مدير المنشأة الأول (Clinic Admin)' : 'Initial Administrator Account'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'اسم المدير / الطبيب المسؤول' : 'Admin Name'}
                    </label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={e => setAdminName(e.target.value)}
                      placeholder="مثال: د. أحمد فؤاد"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'البريد الإلكتروني للدخول' : 'Admin Email'}
                    </label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      placeholder="admin@facility.com"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddOrgModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs bg-gradient-to-r from-medicore-600 to-medicore-700 hover:from-medicore-700 hover:to-medicore-800 text-white font-black rounded-xl shadow-md transition-all"
                >
                  {locale === 'ar' ? '✓ تأكيد تسجيل المنشأة وبدء التشغيل' : 'Confirm Registration & Launch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
