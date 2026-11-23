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
  MapPin, Phone, Mail, Sparkles, AlertCircle, FileText,
  Search, Filter, BarChart3, TrendingUp, PieChart, Layers, Check
} from 'lucide-react';
import { SubscriptionPlan, Organization, FacilityType } from '../../types/database';
import { SpecialtyMultiSelector } from '../../components/specialties/SpecialtyMultiSelector';
import { getSpecialtyByCode } from '../../config/medicalSpecialties';

interface SuperAdminDashboardProps {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  activeTab = 'super_admin_dashboard',
  onSelectTab,
}) => {
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

  // Search & Filter state for Organizations table
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  const filteredOrgs = orgs.filter(o => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      o.name_ar.toLowerCase().includes(term) ||
      o.name_en.toLowerCase().includes(term) ||
      o.city.toLowerCase().includes(term) ||
      o.phone.includes(term);
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([
    'internal_medicine', 'general_surgery', 'orthopedic_surgery', 'dentistry', 'pediatrics', 'gynecology'
  ]);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  // Announcement Form State
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnMessage, setNewAnnMessage] = useState('');
  const [newAnnSeverity, setNewAnnSeverity] = useState<'info' | 'warning' | 'maintenance'>('info');

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
      error(locale === 'ar' ? 'يرجى ملء الحقول الإلزامية للمنشأة' : 'Please provide required facility details');
      return;
    }

    const slug = (newOrgNameEn || newOrgNameAr).toLowerCase().replace(/[^a-z0-9]+/g, '-') || `org-${Date.now()}`;
    const result = dbClient.createOrganization({
      name_ar: newOrgNameAr,
      name_en: newOrgNameEn || newOrgNameAr,
      slug,
      facility_type: newOrgType,
      country: 'Egypt',
      city: newOrgCity,
      address: newOrgAddress,
      email: newOrgEmail,
      phone: newOrgPhone,
      tax_number: newOrgTaxNo,
      timezone: 'Africa/Cairo',
      default_currency: 'EGP',
      is_enterprise_dedicated: false,
      status: 'active',
      specialties: selectedSpecialties,
    }, newOrgPlan, {
      name_ar: adminName || `مدير ${newOrgNameAr}`,
      name_en: newOrgNameEn ? `Admin ${newOrgNameEn}` : undefined,
      email: adminEmail || newOrgEmail,
      phone: newOrgPhone,
    });

    const org = result.org;
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

  const handlePublishAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle || !newAnnMessage) {
      error(locale === 'ar' ? 'يرجى كتابة عنوان الإعلان والرسالة' : 'Please provide announcement title and message');
      return;
    }

    dbClient.createAnnouncement({
      title_ar: newAnnTitle,
      title_en: newAnnTitle,
      body_ar: newAnnMessage,
      body_en: newAnnMessage,
      severity: newAnnSeverity,
      is_active: true,
      starts_at: new Date().toISOString(),
    });

    success(locale === 'ar' ? 'تم بث الإعلان بنجاح لكافة المنشآت المشتركة!' : 'Announcement broadcast successfully!');
    setNewAnnTitle('');
    setNewAnnMessage('');
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

      {/* Sub-Navigation Tabs Bar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => onSelectTab?.('super_admin_dashboard')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'super_admin_dashboard'
              ? 'bg-white text-medicore-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-purple-600" />
          <span>{locale === 'ar' ? 'نظرة عامة على المنصة' : 'Platform Overview'}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab?.('super_admin_orgs')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'super_admin_orgs'
              ? 'bg-white text-medicore-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-medicore-600" />
          <span>{locale === 'ar' ? 'إدارة المنشآت الطبية' : 'Facilities Management'}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-medicore-100 text-medicore-800">
            {totalOrgs}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab?.('super_admin_subscriptions')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'super_admin_subscriptions'
              ? 'bg-white text-medicore-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-600" />
          <span>{locale === 'ar' ? 'الاشتراكات والفوترة السحابية' : 'Subscriptions & Billing'}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab?.('super_admin_analytics')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'super_admin_analytics'
              ? 'bg-white text-medicore-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-sky-600" />
          <span>{locale === 'ar' ? 'إحصائيات المنصة و MRR' : 'Analytics & MRR'}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab?.('super_admin_announcements')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'super_admin_announcements'
              ? 'bg-white text-medicore-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Megaphone className="w-4 h-4 text-amber-600" />
          <span>{locale === 'ar' ? 'إعلانات وتنبيهات النظام' : 'System Announcements'}</span>
        </button>
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

      {/* ========================================================================= */}
      {/* VIEW 1: SUPER ADMIN DASHBOARD / OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'super_admin_dashboard' && (
        <div className="space-y-6">
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

          {/* Quick Facilities Preview Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-medicore-600" />
                  <span>{locale === 'ar' ? 'المراكز والعيادات الطبية المشتركة' : 'Active Medical Organizations'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {locale === 'ar' ? 'انقر على "دخول إدارة العيادة" للتحكم بالعيادة كمسؤول عنها' : 'Click "Enter Workspace" to manage a clinic'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectTab?.('super_admin_orgs')}
                  className="text-xs font-bold text-medicore-600 hover:text-medicore-700 underline"
                >
                  {locale === 'ar' ? 'عرض كافة المنشآت ←' : 'View all facilities →'}
                </button>
              </div>
            </div>

            {orgs.length === 0 ? (
              <div className="p-8 text-center border border-dashed rounded-2xl border-slate-200 bg-slate-50/50 flex flex-col items-center">
                <Building2 className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-700">{locale === 'ar' ? 'لا توجد منشآت طبية مسجلة بعد' : 'No facilities registered yet'}</p>
                <p className="text-xs text-slate-400 mt-0.5">{locale === 'ar' ? 'قم بتسجيل أول منشأة لاختبار كامل وظائف النظام' : 'Register your first facility to test the platform'}</p>
                <button
                  type="button"
                  onClick={() => setShowAddOrgModal(true)}
                  className="mt-3 px-4 py-2 bg-medicore-600 text-white rounded-xl text-xs font-bold"
                >
                  {locale === 'ar' ? '+ تسجيل منشأة جديدة' : '+ Add Facility'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {orgs.slice(0, 6).map(org => {
                  const sub = dbClient.getSubscriptionByOrgId(org.id);
                  return (
                    <div key={org.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-medicore-100 text-medicore-800">
                            {getFacilityTypeName(org.facility_type)}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            org.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {org.status === 'active' ? t.common.active : t.common.inactive}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {org[locale === 'ar' ? 'name_ar' : 'name_en']}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{org.city}</span>
                          {org.phone && <span>• {org.phone}</span>}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600">
                          {sub?.plan?.[locale === 'ar' ? 'name_ar' : 'name_en'] || 'Standard'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEnterClinicWorkspace(org.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-medicore-600 hover:bg-medicore-700 text-white rounded-lg text-xs font-bold shadow-2xs"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{locale === 'ar' ? 'دخول العيادة' : 'Enter'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DEDICATED ORGANIZATIONS MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'super_admin_orgs' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Header with Search and Filter */}
            <div className="p-5 border-b border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-medicore-600" />
                    <span>{locale === 'ar' ? 'إدارة المنشآت والمجمعات الطبية المسجلة' : 'Registered Medical Organizations'}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {locale === 'ar' 
                      ? 'التحكم بالمنشآت المشتركة، الدخول لأي عيادة لإعداد أطبائها وخدماتها، أو إضافة فروع وتخصصات جديدة'
                      : 'Control subscribed facilities, enter any clinic workspace, or manage their branches and specialties'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddOrgModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-medicore-600 hover:bg-medicore-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{locale === 'ar' ? '+ تسجيل منشأة جديدة' : '+ Add Facility'}</span>
                </button>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder={locale === 'ar' ? 'بحث بالاسم، المدينة، أو الهاتف...' : 'Search by name, city, phone...'}
                    className="w-full ps-9 pe-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:border-medicore-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <span className="text-xs text-slate-500 font-medium">{locale === 'ar' ? 'الحالة:' : 'Status:'}</span>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700"
                  >
                    <option value="all">{locale === 'ar' ? 'كافة المنشآت' : 'All Facilities'}</option>
                    <option value="active">{locale === 'ar' ? 'النشطة فقط' : 'Active Only'}</option>
                    <option value="suspended">{locale === 'ar' ? 'الموقوفة' : 'Suspended'}</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredOrgs.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <Building2 className="w-8 h-8" />
                </div>
                <div className="max-w-md">
                  <h3 className="font-black text-slate-800 text-base">
                    {orgs.length === 0 
                      ? (locale === 'ar' ? 'لا توجد منشآت طبية مسجلة بعد' : 'No Facilities Registered Yet')
                      : (locale === 'ar' ? 'لا توجد نتائج مطابقة لبحثك' : 'No facilities match your search')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {locale === 'ar' 
                      ? 'يمكنك البدء فوراً بإنشاء أول منشأة وتحديد تخصصاتها الطبية وكافة تفاصيلها.'
                      : 'You can immediately start by registering a new medical facility.'}
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
                      <th className="p-3.5 text-start">{locale === 'ar' ? 'التخصصات المفعلة' : 'Specialties'}</th>
                      <th className="p-3.5 text-start">{locale === 'ar' ? 'باقة الاشتراك' : 'Plan'}</th>
                      <th className="p-3.5 text-start">{locale === 'ar' ? 'الفروع' : 'Branches'}</th>
                      <th className="p-3.5 text-start">{locale === 'ar' ? 'الأطباء' : 'Doctors'}</th>
                      <th className="p-3.5 text-start">{t.common.status}</th>
                      <th className="p-3.5 text-end">{locale === 'ar' ? 'التحكم والإدارة' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrgs.map(org => {
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
                                <div className="text-[11px] text-slate-400">
                                  <span>{org.city} • {org.phone}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 font-medium text-slate-700">
                            {getFacilityTypeName(org.facility_type)}
                          </td>
                          <td className="p-3.5">
                            {org.specialties && org.specialties.length > 0 ? (
                              <div className="flex items-center gap-1 flex-wrap max-w-xs">
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200 text-[10px]">
                                  {org.specialties.length} {locale === 'ar' ? 'تخصص طبي' : 'Specialties'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">{locale === 'ar' ? 'شامل عام' : 'All General'}</span>
                            )}
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
                                <span>{locale === 'ar' ? 'دخول إدارة العيادة' : 'Enter'}</span>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: DEDICATED SUBSCRIPTIONS & BILLING ENGINE */}
      {/* ========================================================================= */}
      {activeTab === 'super_admin_subscriptions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-medicore-600" />
                  {locale === 'ar' ? 'محرك باقات الاشتراك والفوترة السحابية (SaaS Plans)' : 'SaaS Subscription Plans & Billing Engine'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {locale === 'ar' ? 'تعديل أسعار الاشتراك والحدود المسموح بها لكل باقة ديناميكياً' : 'Configure dynamic plan pricing, limits, and module entitlements'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
                  MRR: {mrr.toLocaleString()} EGP/mo
                </span>
                <span className="text-xs font-bold px-3 py-1.5 bg-purple-50 text-purple-800 rounded-xl border border-purple-200">
                  ARR: {arr.toLocaleString()} EGP/yr
                </span>
              </div>
            </div>

            {/* Plan Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              {plans.map(plan => (
                <div key={plan.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-4 hover:border-medicore-300 transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-medicore-100 text-medicore-800 uppercase">
                        {plan.tier}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditPlan(plan)}
                        className="p-1.5 text-slate-400 hover:text-medicore-600 hover:bg-medicore-50 rounded-lg transition-colors"
                        title={locale === 'ar' ? 'تعديل الأسعار والحدود' : 'Edit Plan'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="font-bold text-slate-900 text-base">
                      {plan[locale === 'ar' ? 'name_ar' : 'name_en']}
                    </h4>
                    <div className="mt-3">
                      <span className="text-2xl font-black text-slate-900">{plan.price_monthly}</span>
                      <span className="text-xs text-slate-500 font-semibold"> {plan.currency} / شهر</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1.5 pt-3 border-t border-slate-200">
                    <div className="flex justify-between">
                      <span>{t.superAdmin.maxBranches}:</span>
                      <span className="font-bold text-slate-800">{plan.max_branches}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t.superAdmin.maxDoctors}:</span>
                      <span className="font-bold text-slate-800">{plan.max_doctors}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{locale === 'ar' ? 'المساحة السحابية:' : 'Storage:'}</span>
                      <span className="font-bold text-slate-800">{plan.max_storage_mb / 1024} GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{locale === 'ar' ? 'مختبر وأشعة:' : 'Lab & Rad:'}</span>
                      <span className="font-bold text-emerald-600">{plan.has_laboratory ? 'مفعل' : 'غير متاح'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subscriptions Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span>{locale === 'ar' ? 'سجل اشتراكات المنشآت الطبية والدفع الدوري' : 'Subscribed Facilities Ledger'}</span>
            </h3>

            {orgs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">{locale === 'ar' ? 'لا توجد اشتراكات مسجلة بعد' : 'No subscriptions recorded yet'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-start">{locale === 'ar' ? 'المنشأة' : 'Facility'}</th>
                      <th className="p-3 text-start">{locale === 'ar' ? 'الباقة' : 'Plan'}</th>
                      <th className="p-3 text-start">{locale === 'ar' ? 'القيمة الشهرية' : 'Monthly Fee'}</th>
                      <th className="p-3 text-start">{locale === 'ar' ? 'حالة السداد' : 'Payment Status'}</th>
                      <th className="p-3 text-start">{locale === 'ar' ? 'دورة الفوترة' : 'Cycle'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orgs.map(org => {
                      const sub = dbClient.getSubscriptionByOrgId(org.id);
                      return (
                        <tr key={org.id}>
                          <td className="p-3 font-bold text-slate-900">{org[locale === 'ar' ? 'name_ar' : 'name_en']}</td>
                          <td className="p-3">{sub?.plan?.[locale === 'ar' ? 'name_ar' : 'name_en'] || 'Standard'}</td>
                          <td className="p-3 font-mono font-bold text-emerald-600">{sub?.amount} {sub?.currency}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              {sub?.status || 'active'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{sub?.cycle || 'monthly'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: DEDICATED PLATFORM ANALYTICS & MRR */}
      {/* ========================================================================= */}
      {activeTab === 'super_admin_analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block mb-1">
                {locale === 'ar' ? 'الدخل الشهري المتكرر (MRR)' : 'Monthly Recurring Revenue'}
              </span>
              <span className="text-2xl font-black text-slate-900">{mrr.toLocaleString()} EGP</span>
              <p className="text-[11px] text-emerald-600 font-bold mt-2">
                ARR: {arr.toLocaleString()} EGP
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block mb-1">
                {locale === 'ar' ? 'متوسط الإيراد لكل منشأة (ARPU)' : 'Average Revenue Per User (ARPU)'}
              </span>
              <span className="text-2xl font-black text-slate-900">
                {totalOrgs > 0 ? Math.round(mrr / totalOrgs).toLocaleString() : 0} EGP
              </span>
              <p className="text-[11px] text-slate-500 mt-2">
                {totalOrgs} {locale === 'ar' ? 'منشأة مسجلة' : 'Facilities'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block mb-1">
                {locale === 'ar' ? 'معدل السداد الفعال' : 'Active Paid Ratio'}
              </span>
              <span className="text-2xl font-black text-slate-900">
                {totalOrgs > 0 ? `${Math.round((activeSubs / totalOrgs) * 100)}%` : '100%'}
              </span>
              <p className="text-[11px] text-purple-600 font-bold mt-2">
                {activeSubs} {locale === 'ar' ? 'اشتراك نشط' : 'Active Subs'}
              </p>
            </div>
          </div>

          {/* Breakdown by Facility Type */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-medicore-600" />
              <span>{locale === 'ar' ? 'توزيع المنشآت الطبية حسب الفئة التشغيلية' : 'Facility Distribution by Type'}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(['private_clinic', 'poly_clinic', 'medical_center', 'specialized_center', 'hospital'] as FacilityType[]).map(ft => {
                const count = orgs.filter(o => o.facility_type === ft).length;
                return (
                  <div key={ft} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[11px] font-bold text-slate-600 block mb-1">{getFacilityTypeName(ft)}</span>
                    <span className="text-xl font-black text-slate-900">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 5: DEDICATED SYSTEM ANNOUNCEMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'super_admin_announcements' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-2 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-amber-600" />
              <span>{locale === 'ar' ? 'بث إعلان جديد للمنشآت والمراكز الطبية' : 'Broadcast System Announcement'}</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {locale === 'ar' 
                ? 'يظهر هذا الإعلان فورياً في شريط التنبيهات لجميع مدراء وأطباء المنشآت الطبية المشتركة' 
                : 'Broadcast real-time announcements to all clinic administrators and healthcare staff'}
            </p>

            <form onSubmit={handlePublishAnnouncement} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'عنوان الإعلان *' : 'Announcement Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={newAnnTitle}
                  onChange={e => setNewAnnTitle(e.target.value)}
                  placeholder={locale === 'ar' ? 'مثال: تحديث أمني وتفعيل التخصصات الطبية الجديدة...' : 'e.g. Maintenance update...'}
                  className="w-full text-xs p-2.5 border rounded-xl border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'نص الإعلان والرسالة *' : 'Message Content *'}
                </label>
                <textarea
                  rows={3}
                  required
                  value={newAnnMessage}
                  onChange={e => setNewAnnMessage(e.target.value)}
                  placeholder={locale === 'ar' ? 'تفاصيل الإعلان أو التحديث...' : 'Detailed message...'}
                  className="w-full text-xs p-2.5 border rounded-xl border-slate-200 bg-slate-50"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">{locale === 'ar' ? 'الأهمية:' : 'Priority:'}</span>
                  <select
                    value={newAnnSeverity}
                    onChange={e => setNewAnnSeverity(e.target.value as any)}
                    className="text-xs p-1.5 border rounded-lg bg-slate-50 font-bold"
                  >
                    <option value="info">{locale === 'ar' ? 'معلوماتي (Info)' : 'Info'}</option>
                    <option value="warning">{locale === 'ar' ? 'تحذيري (Warning)' : 'Warning'}</option>
                    <option value="maintenance">{locale === 'ar' ? 'صيانة طارئة (Maintenance)' : 'Maintenance'}</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2 bg-medicore-600 hover:bg-medicore-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  {locale === 'ar' ? 'نشر الإعلان الآن' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>

          {/* Announcements History List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-3">
              {locale === 'ar' ? 'الإعلانات السابقة المنشورة' : 'Past Announcements'}
            </h3>
            {announcements.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">{locale === 'ar' ? 'لا توجد إعلانات منشورة بعد' : 'No announcements published yet'}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {announcements.map(ann => (
                  <div key={ann.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-sm">{ann[locale === 'ar' ? 'title_ar' : 'title_en']}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {ann.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{ann[locale === 'ar' ? 'body_ar' : 'body_en']}</p>
                    <span className="text-[10px] text-slate-400 block pt-1 font-mono">{new Date(ann.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
                      {locale === 'ar' ? 'العنوان بالتفصيل' : 'Street Address'}
                    </label>
                    <input
                      type="text"
                      value={newOrgAddress}
                      onChange={e => setNewOrgAddress(e.target.value)}
                      placeholder="شارع التحرير، الدقي"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'البريد الإلكتروني الرسمي *' : 'Official Email *'}
                    </label>
                    <input
                      type="email"
                      required
                      value={newOrgEmail}
                      onChange={e => setNewOrgEmail(e.target.value)}
                      placeholder="info@clinic.com"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'رقم الهاتف / الواتساب *' : 'Phone / WhatsApp *'}
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

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'الرقم الضريبي / السجل التجاري' : 'Tax / Commercial Reg No.'}
                    </label>
                    <input
                      type="text"
                      value={newOrgTaxNo}
                      onChange={e => setNewOrgTaxNo(e.target.value)}
                      placeholder="123-456-789"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Group 3: Complete Medical Activities & Specialties Catalog Selector */}
              <div>
                <span className="text-xs font-black text-medicore-700 uppercase tracking-wider block mb-2">
                  3. {locale === 'ar' ? 'الأنشطة والعيادات التخصصية المرخصة للمنشأة (94+ تخصص)' : 'Medical Activities & Specialties (Categories A-I)'}
                </span>
                <SpecialtyMultiSelector
                  selectedCodes={selectedSpecialties}
                  onChange={setSelectedSpecialties}
                />
              </div>

              {/* Group 4: SaaS Plan Selection */}
              <div>
                <span className="text-xs font-black text-medicore-700 uppercase tracking-wider block mb-2">
                  4. {locale === 'ar' ? 'باقة الاشتراك السحابية' : 'SaaS Subscription Plan'}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {plans.map(p => (
                    <label
                      key={p.slug}
                      className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                        newOrgPlan === p.slug 
                          ? 'border-medicore-600 bg-medicore-50/60 ring-2 ring-medicore-500' 
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={p.slug}
                        checked={newOrgPlan === p.slug}
                        onChange={e => setNewOrgPlan(e.target.value)}
                        className="sr-only"
                      />
                      <div>
                        <span className="font-bold text-xs text-slate-900 block">{p[locale === 'ar' ? 'name_ar' : 'name_en']}</span>
                        <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">{p.price_monthly} ج.م/شهر</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-2 block">
                        {p.max_doctors} أطباء • {p.max_branches} فروع
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Group 5: Initial Administrator Account */}
              <div>
                <span className="text-xs font-black text-medicore-700 uppercase tracking-wider block mb-2">
                  5. {locale === 'ar' ? 'بيانات حساب مدير المنشأة الأولي' : 'Initial Facility Admin Account'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'اسم المدير المسؤول' : 'Admin Name'}
                    </label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={e => setAdminName(e.target.value)}
                      placeholder="د. أحمد فؤاد (مدير المركز)"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'البريد الإلكتروني للدخول' : 'Admin Login Email'}
                    </label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      placeholder="admin@clinic.com"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddOrgModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-medicore-600 to-medicore-700 hover:from-medicore-700 hover:to-medicore-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{locale === 'ar' ? 'اعتماد وتسجيل المنشأة' : 'Register Facility'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
