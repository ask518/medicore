// ============================================================================
// MEDICORE – Role-Based Responsive Sidebar Navigation
// ============================================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  LayoutDashboard, Users, Calendar, Stethoscope, Activity, FileText,
  FlaskConical, Radio, CreditCard, DollarSign, Building2, UserCog,
  BarChart3, UploadCloud, Settings, ShieldCheck, Megaphone,
  UserCheck, X, Briefcase, Package
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, isSuperAdmin, isFacilitySupportMode, isPatient, subscription, can } = useAuth();
  const { locale, t } = useLanguage();

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    onCloseMobile();
  };

  // Build navigation items based on role
  let navItems: { id: string; label: string; icon: React.ReactNode; badge?: string }[] = [];

  if (isSuperAdmin && !isFacilitySupportMode) {
    navItems = [
      { id: 'super_admin_dashboard', label: t.nav.superAdminDashboard, icon: <ShieldCheck className="w-4 h-4 text-purple-600" /> },
      { id: 'super_admin_orgs', label: t.nav.organizations, icon: <Building2 className="w-4 h-4 text-medicore-600" /> },
      { id: 'super_admin_users', label: t.nav.platformTeam, icon: <UserCog className="w-4 h-4 text-blue-600" /> },
      { id: 'super_admin_subscriptions', label: t.nav.subscriptions, icon: <CreditCard className="w-4 h-4 text-emerald-600" /> },
      { id: 'super_admin_analytics', label: t.nav.platformAnalytics, icon: <BarChart3 className="w-4 h-4 text-sky-600" /> },
      { id: 'super_admin_announcements', label: t.nav.systemAnnouncements, icon: <Megaphone className="w-4 h-4 text-amber-600" /> },
    ];
  } else if (isPatient) {
    navItems = [
      { id: 'patient_portal', label: t.portal.myAppointments, icon: <Calendar className="w-4 h-4 text-medicore-600" /> },
      { id: 'patient_rx', label: t.portal.myPrescriptions, icon: <FileText className="w-4 h-4 text-emerald-600" /> },
      { id: 'patient_labs', label: t.portal.myLabResults, icon: <FlaskConical className="w-4 h-4 text-purple-600" /> },
    ];
  } else {
    // Clinic Staff (Doctor, Owner, Reception, Accountant) - RBAC Enforced
    const allClinicItems: { id: string; label: string; icon: React.ReactNode; badge?: string; module: any }[] = [
      { id: 'dashboard', label: t.nav.clinicDashboard, icon: <LayoutDashboard className="w-4 h-4 text-medicore-600" />, module: 'dashboard' },
      { id: 'patients', label: t.nav.patients, icon: <Users className="w-4 h-4 text-sky-600" />, module: 'patients' },
      { id: 'appointments', label: t.nav.appointments, icon: <Calendar className="w-4 h-4 text-emerald-600" />, module: 'appointments' },
      { id: 'consultation', label: t.nav.consultations, icon: <Stethoscope className="w-4 h-4 text-indigo-600" />, module: 'consultations' },
      { id: 'specialties', label: t.nav.specialties, icon: <Activity className="w-4 h-4 text-rose-600" />, badge: 'Interactive', module: 'consultations' },
      { id: 'prescriptions', label: t.nav.prescriptions, icon: <FileText className="w-4 h-4 text-teal-600" />, module: 'prescriptions' },
      { id: 'laboratory', label: t.nav.laboratory, icon: <FlaskConical className="w-4 h-4 text-violet-600" />, module: 'laboratory' },
      { id: 'radiology', label: t.nav.radiology, icon: <Radio className="w-4 h-4 text-fuchsia-600" />, module: 'radiology' },
      { id: 'inventory', label: t.nav.inventory, icon: <Package className="w-4 h-4 text-emerald-600" />, module: 'inventory' },
      { id: 'billing', label: t.nav.billing, icon: <CreditCard className="w-4 h-4 text-emerald-600" />, module: 'billing' },
      { id: 'insurance', label: t.nav.insurance, icon: <ShieldCheck className="w-4 h-4 text-teal-600" />, module: 'insurance' },
      { id: 'commissions', label: t.nav.commissions, icon: <DollarSign className="w-4 h-4 text-amber-600" />, module: 'commissions' },
      { id: 'branches', label: t.nav.branches, icon: <Building2 className="w-4 h-4 text-slate-600" />, module: 'branches' },
      { id: 'staff', label: t.nav.staff, icon: <UserCog className="w-4 h-4 text-blue-600" />, module: 'staff' },
      { id: 'hr', label: locale === 'ar' ? 'الموارد البشرية، الرواتب والمصاريف (HR)' : 'HR, Payroll & Expenses', icon: <Briefcase className="w-4 h-4 text-purple-600" />, module: 'hr' },
      { id: 'reports', label: t.nav.reports, icon: <BarChart3 className="w-4 h-4 text-cyan-600" />, module: 'reports' },
      { id: 'data_migration', label: t.nav.dataMigration, icon: <UploadCloud className="w-4 h-4 text-slate-500" />, module: 'settings' },
      { id: 'settings', label: t.nav.settings, icon: <Settings className="w-4 h-4 text-slate-500" />, module: 'settings' },
    ];

    navItems = allClinicItems.filter(item => can(item.module, 'view'));
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 lg:top-16 start-0 z-40 h-full lg:h-[calc(100vh-4rem)] w-64 bg-white border-e border-slate-200 flex flex-col transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 rtl:translate-x-full rtl:lg:translate-x-0'
        }`}
      >
        {/* Mobile Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between lg:hidden">
          <span className="font-black text-medicore-600 text-lg">MEDICORE</span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Status Card */}
        <div className="p-3.5 mx-3 my-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-medicore-100 text-medicore-700 font-black text-xs flex items-center justify-center shrink-0">
              {user?.name_ar.slice(0, 2) || 'MD'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">
                {user ? user[locale === 'ar' ? 'name_ar' : 'name_en'] : ''}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {user ? t.roles[user.role] : ''}
              </p>
            </div>
          </div>
          {subscription && (
            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
              <span>{locale === 'ar' ? 'الباقة:' : 'Plan:'}</span>
              <span className="font-bold text-medicore-700 capitalize">
                {subscription.plan?.name_ar || subscription.plan?.tier}
              </span>
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
          {navItems.map(item => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-medicore-500 text-white shadow-sm shadow-medicore-500/25'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-white' : ''}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-100 text-[10px] text-slate-400 text-center">
          <p>MEDICORE SaaS v1.0</p>
          <p className="text-slate-300">Managed Cloud Healthcare Architecture</p>
        </div>
      </aside>
    </>
  );
};
