// ============================================================================
// MEDICORE – Top Navigation Bar
// Multi-Tenant Branch Switcher, Super Admin Quick-Return & Identity Manager
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Building2, MapPin, Globe, UserCheck, Shield, ChevronDown,
  LogOut, Menu, Sparkles
} from 'lucide-react';

interface NavbarProps {
  onToggleMobileSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileSidebar }) => {
  const { 
    user, organization, activeBranch, availableBranches, 
    switchBranch, isSuperAdmin, isEnterpriseDedicated, logout
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
              {organization ? organization[locale === 'ar' ? 'name_ar' : 'name_en'] : (locale === 'ar' ? 'لوحة مالك المنصة' : 'Platform Owner Console')}
            </p>
          </div>
        </div>
      </div>

      {/* Center / Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Branch Selector (For active clinic with multiple branches) */}
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

        {/* User Identity & Profile Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              isSuperAdmin 
                ? 'bg-purple-950/90 text-purple-200 border-purple-500/30 hover:bg-purple-900/90 shadow-xs' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
            }`}
          >
            {isSuperAdmin ? (
              <Shield className="w-3.5 h-3.5 text-purple-400" />
            ) : (
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span className="hidden md:inline max-w-[140px] truncate">
              {user ? user[locale === 'ar' ? 'name_ar' : 'name_en'] : (locale === 'ar' ? 'مالك المنصة' : 'Super Admin')}
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full border ${
              isSuperAdmin 
                ? 'bg-purple-800 text-purple-100 border-purple-600 font-black' 
                : 'bg-white text-slate-700 border-slate-200'
            }`}>
              {isSuperAdmin ? (locale === 'ar' ? 'مالك المنصة' : 'Super Admin') : (user ? t.roles[user.role] || user.role : '')}
            </span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {showRoleMenu && (
            <div className="absolute end-0 mt-1.5 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-scale-in">
              <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-slate-900">
                    {user ? user[locale === 'ar' ? 'name_ar' : 'name_en'] : 'Super Admin'}
                  </div>
                  <div className="text-[11px] text-slate-500">{user?.email || ''}</div>
                </div>
                {isSuperAdmin && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    OWNER
                  </span>
                )}
              </div>

              <div className="p-1 border-t border-slate-100 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setShowRoleMenu(false);
                  }}
                  className="w-full text-start px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t.nav.logout}</span>
                </button>
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
