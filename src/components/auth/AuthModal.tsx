// ============================================================================
// MEDICORE – Production Authentication Modal (Login, Register & Password Reset)
// Real Supabase Identity, Session Management & Enterprise Security
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { 
  ShieldCheck, Lock, Mail, User, Eye, EyeOff, 
  ArrowRight, CheckCircle2, AlertTriangle, KeyRound, Sparkles, X
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register' | 'reset';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'login',
}) => {
  const { login, register, resetPassword } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error, info } = useToast();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (res.success) {
          success(locale === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Signed in successfully');
          onClose();
        } else {
          error(res.error || (locale === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials'));
        }
      } else if (mode === 'register') {
        if (password.length < 6) {
          error(locale === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          error(locale === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
          setIsLoading(false);
          return;
        }

        const res = await register(email, password, nameAr, nameEn);
        if (res.success) {
          success(locale === 'ar' ? 'تم إنشاء الحساب بنجاح! تفقد بريدك لتأكيد الحساب.' : 'Account registered successfully! Check email.');
          setMode('login');
        } else {
          error(res.error || (locale === 'ar' ? 'فشل إنشاء الحساب' : 'Registration failed'));
        }
      } else if (mode === 'reset') {
        const res = await resetPassword(email);
        if (res.success) {
          info(locale === 'ar' ? 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.' : 'Password reset link sent to your email.');
          setMode('login');
        } else {
          error(res.error || (locale === 'ar' ? 'فشل إرسال رابط الاستعادة' : 'Reset request failed'));
        }
      }
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Authentication error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSuperAdmin = () => {
    setEmail('admin@medicore.cloud');
    setPassword('Medicore@2026!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl animate-scale-in border border-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                {mode === 'login' && (locale === 'ar' ? 'تسجيل الدخول للمنصة' : 'Sign In to MEDICORE')}
                {mode === 'register' && (locale === 'ar' ? 'إنشاء حساب جديد' : 'Create New Account')}
                {mode === 'reset' && (locale === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password')}
              </h3>
              <p className="text-[11px] text-slate-500">
                {locale === 'ar' ? 'مصادقة سحابية مشفرة عبر Supabase Auth' : 'Secured via Supabase Cloud Identity'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-1.5 rounded-lg transition-all ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {locale === 'ar' ? 'دخول' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`py-1.5 rounded-lg transition-all ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {locale === 'ar' ? 'تسجيل جديد' : 'Register'}
          </button>
          <button
            type="button"
            onClick={() => setMode('reset')}
            className={`py-1.5 rounded-lg transition-all ${
              mode === 'reset' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {locale === 'ar' ? 'استعادة' : 'Reset'}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'الاسم بالكامل (بالعربية) *' : 'Full Name (Arabic) *'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={nameAr}
                    onChange={e => setNameAr(e.target.value)}
                    placeholder="مثال: د. إبراهيم خليل"
                    className="w-full text-xs rounded-xl border border-slate-200 ps-9 pe-3 py-2.5 focus:border-medicore-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'الاسم بالإنجليزية' : 'Full Name (English)'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={nameEn}
                    onChange={e => setNameEn(e.target.value)}
                    placeholder="e.g. Dr. Ibrahim Khalil"
                    className="w-full text-xs rounded-xl border border-slate-200 ps-9 pe-3 py-2.5 focus:border-medicore-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {locale === 'ar' ? 'البريد الإلكتروني الرسمي *' : 'Official Email *'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@clinic.com"
                className="w-full text-xs rounded-xl border border-slate-200 ps-9 pe-3 py-2.5 focus:border-medicore-500 focus:outline-none"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  {locale === 'ar' ? 'كلمة المرور *' : 'Password *'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    className="text-[11px] font-bold text-medicore-600 hover:underline"
                  >
                    {locale === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot?'}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs rounded-xl border border-slate-200 ps-9 pe-10 py-2.5 focus:border-medicore-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === 'ar' ? 'تأكيد كلمة المرور *' : 'Confirm Password *'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs rounded-xl border border-slate-200 ps-9 pe-3 py-2.5 focus:border-medicore-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Quick Platform Owner Bootstrap helper */}
          {mode === 'login' && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleQuickSuperAdmin}
                className="w-full text-center text-[11px] font-bold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 p-2 rounded-xl transition-all border border-purple-200 flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{locale === 'ar' ? 'تسجيل دخول كـ مالك المنصة (Super Admin Bootstrap)' : 'Login as Platform Super Admin'}</span>
              </button>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-medicore-600 to-medicore-700 hover:from-medicore-700 hover:to-medicore-800 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'login' && (locale === 'ar' ? 'دخول المنظومة' : 'Sign In')}
                    {mode === 'register' && (locale === 'ar' ? 'تأكيد التسجيل السحابي' : 'Register Account')}
                    {mode === 'reset' && (locale === 'ar' ? 'إرسال رابط الاستعادة' : 'Send Reset Link')}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
