// ============================================================================
// MEDICORE – Enterprise Multi-Tenant Healthcare Management Platform
// Main Shell, Router, Dynamic Tab Controller & Responsive Layout
// ============================================================================

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { useLanguage } from './context/LanguageContext';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';

// Pages
import { SuperAdminDashboard } from './pages/super-admin/SuperAdminDashboard';
import { ClinicDashboard } from './pages/clinic/ClinicDashboard';
import { Patients } from './pages/clinic/Patients';
import { Appointments } from './pages/clinic/Appointments';
import { Consultation } from './pages/clinic/Consultation';
import { Specialties } from './pages/clinic/Specialties';
import { Laboratory } from './pages/clinic/Laboratory';
import { Radiology } from './pages/clinic/Radiology';
import { Billing } from './pages/clinic/Billing';
import { Insurance } from './pages/clinic/Insurance';
import { Inventory } from './pages/clinic/Inventory';
import { Branches } from './pages/clinic/Branches';
import { Staff } from './pages/clinic/Staff';
import { Reports } from './pages/clinic/Reports';
import { DataMigration } from './pages/clinic/DataMigration';
import { Settings } from './pages/clinic/Settings';
import { HR } from './pages/clinic/HR';
import { PatientPortal } from './pages/patient-portal/PatientPortal';
import { OrganizationOnboarding } from './pages/OrganizationOnboarding';

const AppContent: React.FC = () => {
  const { user, session, isLoading, isPasswordRecovery, logout, isSuperAdmin, isPatient, isFacilitySupportMode, organization, exitFacilitySupport } = useAuth();
  const { locale } = useLanguage();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Automatically adjust default landing tab when role changes
  useEffect(() => {
    if (isSuperAdmin) {
      if (isFacilitySupportMode && currentTab.startsWith('super_admin_')) setCurrentTab('dashboard');
      else if (!isFacilitySupportMode && !currentTab.startsWith('super_admin_')) setCurrentTab('super_admin_dashboard');
    } else if (isPatient) {
      setCurrentTab('patient_portal');
    } else {
      setCurrentTab('dashboard');
    }
  }, [user?.role, isSuperAdmin, isPatient, isFacilitySupportMode, currentTab]);

  if (isLoading) return <div className="grid min-h-screen place-items-center text-sm font-bold text-slate-600">{locale === 'ar' ? 'جار التحقق من جلسة الدخول...' : 'Checking sign-in session...'}</div>;
  if (isPasswordRecovery) return <AuthScreen defaultMode="updatePassword" />;
  if (!session) return <AuthScreen />;
  if (!user) return <div className="grid min-h-screen place-items-center bg-slate-50 p-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"><h1 className="text-xl font-black text-slate-900">{locale === 'ar' ? 'الحساب بانتظار تفعيل المنشأة' : 'Account activation pending'}</h1><p className="mt-3 text-sm leading-7 text-slate-600">{locale === 'ar' ? 'لم يتم تجهيز ملف مستخدم نشط لهذا الحساب. تواصل مع مسؤول المنشأة.' : 'This account has no active staff profile. Contact your facility administrator.'}</p><button type="button" onClick={() => void logout()} className="mt-6 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white">{locale === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</button></section></div>;
  if (!user.organization_id && !isSuperAdmin) return <OrganizationOnboarding />;

  const renderActiveView = () => {
    // If super admin is active and current tab is not a platform tab, redirect immediately to super admin dashboard
    if (isSuperAdmin && !isFacilitySupportMode && !currentTab.startsWith('super_admin_')) {
      return <SuperAdminDashboard activeTab="super_admin_dashboard" onSelectTab={setCurrentTab} />;
    }

    switch (currentTab) {
      // Super Admin
      case 'super_admin_dashboard':
      case 'super_admin_orgs':
      case 'super_admin_users':
      case 'super_admin_subscriptions':
      case 'super_admin_analytics':
      case 'super_admin_announcements':
        return <SuperAdminDashboard activeTab={currentTab} onSelectTab={setCurrentTab} />;

      // Patient Portal
      case 'patient_portal':
      case 'patient_rx':
      case 'patient_labs':
        return <PatientPortal />;

      // Clinic Staff & Doctors
      case 'dashboard':
        return <ClinicDashboard onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'patients':
        return <Patients />;
      case 'prescriptions':
        return <Consultation />;
      case 'appointments':
        return <Appointments />;
      case 'consultation':
        return <Consultation />;
      case 'specialties':
        return <Specialties />;
      case 'laboratory':
        return <Laboratory />;
      case 'radiology':
        return <Radiology />;
      case 'billing':
      case 'commissions':
        return <Billing />;
      case 'insurance':
        return <Insurance />;
      case 'inventory':
        return <Inventory />;
      case 'branches':
        return <Branches />;
      case 'staff':
        return <Staff />;
      case 'hr':
        return <HR />;
      case 'reports':
        return <Reports />;
      case 'data_migration':
        return <DataMigration />;
      case 'settings':
        return <Settings />;
      default:
        return <ClinicDashboard onNavigate={(tab) => setCurrentTab(tab)} />;
    }
  };

  const leaveFacilitySupport = async () => {
    await exitFacilitySupport('user_exit');
    setCurrentTab('super_admin_orgs');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
      {isFacilitySupportMode && organization && <div role="alert" className="flex flex-wrap items-center justify-center gap-3 border-b border-amber-400 bg-amber-100 px-4 py-2.5 text-center text-xs font-bold text-amber-950"><span>{locale === 'ar' ? `دخول دعم للمنشأة: ${organization.name_ar} — تعمل بهوية السوبر أدمن، وكل التغييرات ستُسجل باسمك.` : `Facility support: ${organization.name_en} — you remain the platform super admin; all changes are attributed to your account.`}</span><button type="button" onClick={() => void leaveFacilitySupport()} className="rounded-lg border border-amber-700 px-3 py-1.5 font-black hover:bg-amber-200">{locale === 'ar' ? 'إنهاء دخول المنشأة' : 'Exit facility'}</button></div>}
      <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-semibold leading-5 text-amber-950">{locale === 'ar' ? 'حالة التشغيل: المنصة متصلة بقاعدة Supabase. المرضى والمواعيد والفريق والعيادة والمعمل والأشعة والتخصصات 3D والفواتير والتأمين والمخزون تستخدم مسارات حفظ سحابية. الموارد البشرية وبوابة المريض غير مفعلة حتى اكتمال الحفظ والصلاحيات؛ لا تسجل بيانات فيها.' : 'Live status: the platform is connected to Supabase. Patients, appointments, staff, consultations, prescriptions, laboratory, radiology, interactive specialties, billing, insurance, and inventory use cloud persistence. HR and the patient portal remain disabled until their persistence and access controls are complete; do not enter data there.'}</div>

      <div className="flex flex-1">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}

export default App;
