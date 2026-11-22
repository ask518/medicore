// ============================================================================
// MEDICORE – Top Navigation Bar
// Multi-Tenant Branch Switcher, Fast Role/Identity Switcher & Language Toggle
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Building2, MapPin, Globe, UserCheck, Shield, ChevronDown,
  LogOut, Bell, Menu, Sparkles
} from 'lucide-react';
import { INITIAL_USERS } from '../../lib/mockData';

interface NavbarProps {
  onToggleMobileSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileSidebar }) => {
  const { 
    user, organization, activeBranch, availableBranches, 
    switchRole, switchBranch, isSuperAdmin, isEnterpriseDedicated, logout
  } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showBranchMenu, setShowBranchMenu] = useState(false);

  const toggleLanguage = () => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 shadow-2xs">
      {/* Brand & Mobile Hamburger */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-medicore-700 to-medicore-500 flex items-center justify-center text-white shadow-md shadow-medicore-500/20">
            <span className="font-extrabold text-lg tracking-wider">M+</span>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-slate-900 text-lg tracking-tight">MEDICORE</span>
              {isEnterpriseDedicated ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 uppercase tracking-wider">
                  Enterprise
                </span>
              ) : (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-medicore-100 text-medicore-700 uppercase tracking-wider">
                  SaaS Cloud
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
              {organization ? organization[locale === 'ar' ? 'name_ar' : 'name_en'] : t.superAdmin.title}
            </p>
          </div>
        </div>
      </div>

      {/* Center / Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Branch Selector (For multi-branch clinics) */}
        {organization && availableBranches.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowBranchMenu(!showBranchMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-medicore-600" />
              <span className="max-w-[130px] truncate">
                {activeBranch ? activeBranch[locale === 'ar' ? 'name_ar' : 'name_en'] : t.common.allBranches}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showBranchMenu && (
              <div className="absolute end-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-scale-in">
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  {t.common.selectBranch}
                </div>
                {availableBranches.map(branch => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => {
                      switchBranch(branch.id);
                      setShowBranchMenu(false);
                    }}
                    className={`w-full text-start px-3 py-2 text-xs flex items-center justify-between hover:bg-medicore-50 transition-colors ${
                      activeBranch?.id === branch.id ? 'bg-medicore-50/70 text-medicore-700 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <span>{branch[locale === 'ar' ? 'name_ar' : 'name_en']}</span>
                    {branch.is_main_branch && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                        {locale === 'ar' ? 'الرئيسي' : 'Main'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fast Role / Identity Switcher (Testing & Demonstration Bar) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 transition-colors border border-slate-200"
            title="تبديل الهوية لاختبار الصلاحيات وعزل المستأجرين"
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden md:inline max-w-[140px] truncate">
              {user ? user[locale === 'ar' ? 'name_ar' : 'name_en'] : 'تسجيل دخول'}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white text-slate-700 border border-slate-200">
              {user ? t.roles[user.role] || user.role : ''}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {showRoleMenu && (
            <div className="absolute end-0 mt-1.5 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-scale-in">
              <div className="px-3.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                <span>{locale === 'ar' ? 'تبديل الدور والمنشأة (Audit Demo)' : 'Switch Identity / Tenant'}</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {INITIAL_USERS.map(u => {
                  const isCurrent = user?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        switchRole(u.id);
                        setShowRoleMenu(false);
                      }}
                      className={`w-full text-start p-2.5 text-xs flex flex-col gap-0.5 hover:bg-slate-50 transition-colors ${
                        isCurrent ? 'bg-medicore-50/80 text-medicore-800 font-bold' : 'text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{u[locale === 'ar' ? 'name_ar' : 'name_en']}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                          {t.roles[u.role] || u.role}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">{u.email}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Language Switcher */}
        <button
          type="button"
          onClick={toggleLanguage}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5 text-xs font-bold transition-colors"
          title={locale === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
        >
          <Globe className="w-4 h-4 text-medicore-600" />
          <span>{locale === 'ar' ? 'English' : 'عربي'}</span>
        </button>

        {/* Sign Out */}
        <button
          type="button"
          onClick={logout}
          title={t.nav.logout}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
