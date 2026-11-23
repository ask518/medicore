// ============================================================================
// MEDICORE – Enterprise Multi-Tenant Healthcare Management Platform
// Main Shell, Router, Dynamic Tab Controller & Responsive Layout
// ============================================================================

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
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
import { Branches } from './pages/clinic/Branches';
import { Staff } from './pages/clinic/Staff';
import { Reports } from './pages/clinic/Reports';
import { DataMigration } from './pages/clinic/DataMigration';
import { Settings } from './pages/clinic/Settings';
import { PatientPortal } from './pages/patient-portal/PatientPortal';

const AppContent: React.FC = () => {
  const { user, isSuperAdmin, isPatient } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Automatically adjust default landing tab when role changes
  useEffect(() => {
    if (isSuperAdmin) {
      setCurrentTab('super_admin_dashboard');
    } else if (isPatient) {
      setCurrentTab('patient_portal');
    } else {
      setCurrentTab('dashboard');
    }
  }, [user?.role, isSuperAdmin, isPatient]);

  const renderActiveView = () => {
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
      case 'prescriptions':
        return <Patients />;
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
      case 'branches':
        return <Branches />;
      case 'staff':
        return <Staff />;
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

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
