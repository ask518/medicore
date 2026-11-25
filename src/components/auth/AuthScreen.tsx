// ============================================================================
// MEDICORE – Standalone Authentication Screen (Login, Register & Password Reset)
// Real Supabase Identity, Session Management & Enterprise Security
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { ShieldCheck, Lock, Mail, User, Eye, EyeOff, ArrowRight } from 'lucide-react';

interface AuthScreenProps {
  defaultMode?: 'login' | 'register' | 'reset' | 'updatePassword';
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  defaultMode = 'login',
}) => {
  const { login, register, resetPassword, updatePassword } = useAuth();
  const { locale, dir } = useLanguage();
  const { success, error, info } = useToast();

  const [mode, setMode] = useState<'login' | 'register' | 'reset' | 'updatePassword'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => setMode(defaultMode), [defaultMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (res.success) {
          success(locale === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Signed in successfully');
        } else {
          error(res.error || (locale === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials'));
        }
      } else if (mode === 'register' || mode === 'updatePassword') {
        if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
          error(locale === 'ar' ? 'استخدم 12 خانة على الأقل مع حرف لاتيني ورقم.' : 'Use at least 12 characters, including a letter and a number.');
          return;
        }
        if (password !== confirmPassword) {
          error(locale === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
          return;
        }

        const res = mode === 'register'
          ? await register(email, password, nameAr, nameEn)
          : await updatePassword(password);
        if (res.success) {
          if (mode === 'register') {
            success(locale === 'ar' ? 'تم إنشاء الحساب. أكّد بريدك الإلكتروني ثم سجّل الدخول لإعداد منشأتك.' : 'Account created. Verify your email, then sign in to set up your facility.');
            setMode('login');
          } else {
            success(locale === 'ar' ? 'تم تحديث كلمة المرور بنجاح.' : 'Your password has been updated.');
          }
        } else {
          error(res.error || (locale === 'ar' ? 'تعذر تحديث الحساب' : 'Could not update the account'));
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

  return (
    <main dir={dir} className="relative flex min-h-screen w-full flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-sky-100 px-4 py-10 sm:gap-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -start-24 -top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute -bottom-28 -end-20 h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-medicore-700 to-medicore-500 text-white shadow-lg shadow-medicore-700/20">
          <span className="text-lg font-black tracking-tight">M+</span>
        </div>
        <div className="text-start">
          <div className="text-xl font-black tracking-tight text-slate-900">MEDICORE</div>
          <div className="text-xs font-medium text-slate-500">{locale === 'ar' ? 'منصة الرعاية الطبية السحابية' : 'Cloud Healthcare Platform'}</div>
        </div>
      </header>

      <section aria-labelledby="auth-screen-title" className="relative z-10 w-full max-w-md rounded-3xl border border-white/80 bg-white/95 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 id="auth-screen-title" className="text-base font-black text-slate-900">
                {mode === 'login' && (locale === 'ar' ? 'تسجيل الدخول للمنصة' : 'Sign In to MEDICORE')}
                {mode === 'register' && (locale === 'ar' ? 'إنشاء حساب جديد' : 'Create New Account')}
                {mode === 'reset' && (locale === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password')}
                {mode === 'updatePassword' && (locale === 'ar' ? 'إنشاء كلمة مرور جديدة' : 'Set a New Password')}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                {mode === 'updatePassword'
                  ? (locale === 'ar' ? 'اختر كلمة مرور جديدة لحسابك' : 'Choose a new password for your account')
                  : (locale === 'ar' ? 'ادخل إلى حسابك للمتابعة' : 'Sign in to continue to your account')}
              </p>
            </div>
          </div>
        </div>

        {/* Mode Switch Tabs */}
        {mode !== 'updatePassword' && <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-4 text-xs font-bold">
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
        </div>}

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

          {mode !== 'updatePassword' && <div>
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
          </div>}

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  {mode === 'updatePassword'
                    ? (locale === 'ar' ? 'كلمة المرور الجديدة *' : 'New password *')
                    : (locale === 'ar' ? 'كلمة المرور *' : 'Password *')}
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
                  minLength={mode === 'register' || mode === 'updatePassword' ? 12 : undefined}
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

          {(mode === 'register' || mode === 'updatePassword') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {mode === 'updatePassword'
                  ? (locale === 'ar' ? 'تأكيد كلمة المرور الجديدة *' : 'Confirm new password *')
                  : (locale === 'ar' ? 'تأكيد كلمة المرور *' : 'Confirm Password *')}
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
                    {mode === 'updatePassword' && (locale === 'ar' ? 'حفظ كلمة المرور الجديدة' : 'Save new password')}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </section>
      <p className="relative z-10 text-center text-[11px] font-medium text-slate-400">{locale === 'ar' ? 'دخول آمن إلى مساحة العمل الخاصة بك' : 'Secure access to your workspace'}</p>
    </main>
  );
};
