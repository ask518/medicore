// ============================================================================
// MEDICORE – Top Navigation Bar
// Multi-Tenant Branch Switcher, Super Admin Quick-Return & Identity Manager
// ============================================================================

import React, { FormEvent, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { 
  MapPin, Globe, UserCheck, Shield, ChevronDown,
  LogOut, Menu, KeyRound, Eye, EyeOff, X
} from 'lucide-react';

interface NavbarProps {
  onToggleMobileSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileSidebar }) => {
  const { 
    user, organization, activeBranch, availableBranches, 
    switchBranch, isSuperAdmin, isEnterpriseDedicated, changePassword, logout
  } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const { success, error } = useToast();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const ar = locale === 'ar';

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    if (newPassword.length < 12 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      const msg = ar
        ? 'كلمة المرور الجديدة يجب أن تكون 12 خانة على الأقل مع حرف لاتيني ورقم.'
        : 'New password must be at least 12 characters with a letter and a number.';
      setPasswordError(msg);
      return;
    }
    if (newPassword !== confirmPassword) {
      const msg = ar ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.';
      setPasswordError(msg);
      return;
    }
    setChangingPassword(true);
    const res = await changePassword(currentPassword, newPassword);
    setChangingPassword(false);
    if (!res.success) {
      const msg = res.error || (ar ? 'تعذر تغيير كلمة المرور.' : 'Could not change password.');
      setPasswordError(msg);
      error(msg);
      return;
    }
    success(ar ? 'تم تحديث كلمة المرور بنجاح في السحابة.' : 'Password updated successfully.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(false);
  };

  const toggleLanguage = () => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  };


  return (
    <>
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between gap-2 px-3 sm:px-6 shadow-2xs">
      {/* Brand & Mobile Hamburger */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          aria-label={locale === 'ar' ? 'فتح القائمة' : 'Open menu'}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-medicore-700 to-medicore-500 flex items-center justify-center text-white shadow-md shadow-medicore-500/20 shrink-0">
            <span className="font-extrabold text-base sm:text-lg tracking-wider">M+</span>
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
      <div className="flex items-center justify-end gap-1.5 sm:gap-3 min-w-0 flex-1">
        {/* Branch Selector (For active clinic with multiple branches) */}
        {organization && availableBranches.length > 0 && (
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => setShowBranchMenu(!showBranchMenu)}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors max-w-[105px] sm:max-w-none"
            >
              <MapPin className="w-3.5 h-3.5 text-medicore-600 shrink-0" />
              <span className="truncate sm:max-w-[130px]">
                {activeBranch ? activeBranch[locale === 'ar' ? 'name_ar' : 'name_en'] : t.common.allBranches}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
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
        <div className="relative min-w-0">
          <button
            type="button"
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all border max-w-[115px] sm:max-w-none ${
              isSuperAdmin 
                ? 'bg-purple-950/90 text-purple-200 border-purple-500/30 hover:bg-purple-900/90 shadow-xs' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
            }`}
          >
            {isSuperAdmin ? (
              <Shield className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            ) : (
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}
            <span className="hidden md:inline max-w-[140px] truncate">
              {user ? user[locale === 'ar' ? 'name_ar' : 'name_en'] : (locale === 'ar' ? 'مالك المنصة' : 'Super Admin')}
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full border truncate ${
              isSuperAdmin 
                ? 'bg-purple-800 text-purple-100 border-purple-600 font-black' 
                : 'bg-white text-slate-700 border-slate-200'
            }`}>
              {isSuperAdmin ? (locale === 'ar' ? 'مالك المنصة' : 'Super Admin') : (user ? t.roles[user.role] || user.role : '')}
            </span>
            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
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
                    setPasswordError('');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowPasswordModal(true);
                    setShowRoleMenu(false);
                  }}
                  className="w-full text-start px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-medicore-600" />
                  <span>{ar ? 'تغيير كلمة المرور' : 'Change Password'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void logout();
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
          className="px-2 sm:px-2.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 flex items-center gap-1 text-xs font-bold transition-colors shrink-0"
          title={locale === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
        >
          <Globe className="w-4 h-4 text-medicore-600 shrink-0" />
          <span className="sm:hidden">{locale === 'ar' ? 'EN' : 'ع'}</span>
          <span className="hidden sm:inline">{locale === 'ar' ? 'English' : 'عربي'}</span>
        </button>

        {/* Sign Out */}
        <button
          type="button"
          onClick={() => void logout()}
          title={t.nav.logout}
          aria-label={t.nav.logout}
          className="hidden sm:inline-flex p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>

      {showPasswordModal && (
        <div className="fixed inset-0 z-[70] bg-slate-950/50 backdrop-blur-xs grid place-items-center p-4" dir={ar ? 'rtl' : 'ltr'}>
          <form onSubmit={handlePasswordSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
                <KeyRound className="w-4 h-4 text-medicore-600" />
                <span>{ar ? 'تغيير كلمة المرور' : 'Change Account Password'}</span>
              </h2>
              <button type="button" onClick={() => setShowPasswordModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {user?.email || ''} · {ar ? 'استخدم 12 خانة على الأقل مع حرف لاتيني ورقم.' : 'Use at least 12 characters with a letter and a number.'}
            </p>
            {passwordError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
                {passwordError}
              </div>
            )}
            <label className="block text-xs font-bold text-slate-700">
              {ar ? 'كلمة المرور الحالية *' : 'Current Password *'}
              <div className="relative mt-1">
                <input
                  required
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 pe-10 text-sm"
                />
                <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>
            <label className="block text-xs font-bold text-slate-700">
              {ar ? 'كلمة المرور الجديدة *' : 'New Password *'}
              <input
                required
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono"
              />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              {ar ? 'تأكيد كلمة المرور الجديدة *' : 'Confirm New Password *'}
              <input
                required
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono"
              />
            </label>
            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" onClick={() => setShowPasswordModal(false)} className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button disabled={changingPassword} className="rounded-xl bg-medicore-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                {changingPassword ? '...' : (ar ? 'حفظ كلمة المرور' : 'Update Password')}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
