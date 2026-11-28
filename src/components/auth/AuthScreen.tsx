// ============================================================================
// MEDICORE – Standalone Authentication Screen (Login, Register & Password Reset)
// Real Supabase Identity, Session Management & Enterprise Security
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { ShieldCheck, Lock, Mail, User, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'reset' | 'updatePassword';

interface AuthScreenProps {
  defaultMode?: AuthMode;
}

const isStrongPassword = (value: string): boolean =>
  value.length >= 12 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);

export const AuthScreen: React.FC<AuthScreenProps> = ({ defaultMode = 'login' }) => {
  const { login, register, resetPassword, updatePassword } = useAuth();
  const { locale, dir } = useLanguage();
  const { success, error, info } = useToast();
  const ar = locale === 'ar';

  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'info' | 'success'; message: string } | null>(null);

  useEffect(() => {
    setMode(defaultMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setFeedback(null);
  }, [defaultMode]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setFeedback(null);
    if (nextMode !== 'login' && !email.includes('@')) {
      setEmail('');
    }
  };

  const modeCopy: Record<AuthMode, { title: string; subtitle: string; submit: string }> = {
    login: {
      title: ar ? 'تسجيل الدخول للمنصة' : 'Sign In to MEDICORE',
      subtitle: ar ? 'ادخل إلى حسابك للمتابعة' : 'Sign in to continue to your account',
      submit: ar ? 'دخول المنظومة' : 'Sign In',
    },
    register: {
      title: ar ? 'إنشاء حساب جديد' : 'Create New Account',
      subtitle: ar ? 'أنشئ حساباً موثقاً بالبريد الإلكتروني ثم سجّل الدخول' : 'Create a verified account with your email',
      submit: ar ? 'تأكيد التسجيل السحابي' : 'Register Account',
    },
    reset: {
      title: ar ? 'استعادة كلمة المرور' : 'Reset Password',
      subtitle: ar ? 'أدخل بريدك الإلكتروني لإرسال رابط استعادة آمن' : 'Enter your email to receive a secure reset link',
      submit: ar ? 'إرسال رابط الاستعادة' : 'Send Reset Link',
    },
    updatePassword: {
      title: ar ? 'إنشاء كلمة مرور جديدة' : 'Set a New Password',
      subtitle: ar ? 'اختر كلمة مرور جديدة قوية لحسابك' : 'Choose a strong new password for your account',
      submit: ar ? 'حفظ كلمة المرور الجديدة' : 'Save new password',
    },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedIdentifier = email.trim();
    if (mode !== 'updatePassword' && !trimmedIdentifier) {
      const msg = ar ? 'أدخل البريد الإلكتروني أو اسم المستخدم.' : 'Enter your email or username.';
      setFeedback({ type: 'error', message: msg });
      error(msg);
      return;
    }

    if (mode === 'register' && !nameAr.trim()) {
      const msg = ar ? 'أدخل الاسم الكامل بالعربية.' : 'Enter your full Arabic name.';
      setFeedback({ type: 'error', message: msg });
      error(msg);
      return;
    }

    if ((mode === 'register' || mode === 'updatePassword') && !isStrongPassword(password)) {
      const msg = ar
        ? 'استخدم 12 خانة على الأقل مع حرف لاتيني ورقم.'
        : 'Use at least 12 characters, including a letter and a number.';
      setFeedback({ type: 'error', message: msg });
      error(msg);
      return;
    }

    if ((mode === 'register' || mode === 'updatePassword') && password !== confirmPassword) {
      const msg = ar ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.';
      setFeedback({ type: 'error', message: msg });
      error(msg);
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        if (!password) {
          const msg = ar ? 'أدخل كلمة المرور.' : 'Enter your password.';
          setFeedback({ type: 'error', message: msg });
          error(msg);
          return;
        }
        const res = await login(trimmedIdentifier, password);
        if (res.success) {
          success(ar ? 'تم تسجيل الدخول بنجاح' : 'Signed in successfully');
        } else {
          const msg = res.error || (ar ? 'بيانات الدخول غير صحيحة.' : 'Invalid credentials.');
          setFeedback({ type: 'error', message: msg });
          error(msg);
        }
      } else if (mode === 'register') {
        const res = await register(trimmedIdentifier, password, nameAr.trim(), nameEn.trim() || undefined);
        if (res.success) {
          const msg = ar
            ? 'تم إنشاء الحساب. أكّد بريدك الإلكتروني ثم سجّل الدخول.'
            : 'Account created. Verify your email, then sign in.';
          success(msg);
          switchMode('login');
          setFeedback({ type: 'success', message: msg });
        } else {
          const raw = res.error || '';
          const msg = ar && /invalid/i.test(raw)
            ? 'البريد الإلكتروني غير صالح. استخدم بريداً حقيقياً بنطاق صحيح (مثل name@domain.com).'
            : ar && /already registered/i.test(raw)
            ? 'هذا البريد الإلكتروني مسجل مسبقاً. يمكنك تسجيل الدخول مباشرة.'
            : (raw || (ar ? 'تعذر إنشاء الحساب.' : 'Could not create account.'));
          setFeedback({ type: 'error', message: msg });
          error(msg);
        }
      } else if (mode === 'updatePassword') {
        const res = await updatePassword(password);
        if (res.success) {
          const msg = ar ? 'تم تحديث كلمة المرور بنجاح.' : 'Your password has been updated.';
          success(msg);
          setFeedback({ type: 'success', message: msg });
        } else {
          const msg = res.error || (ar ? 'تعذر تحديث كلمة المرور.' : 'Could not update password.');
          setFeedback({ type: 'error', message: msg });
          error(msg);
        }
      } else if (mode === 'reset') {
        const res = await resetPassword(trimmedIdentifier);
        if (res.success) {
          const msg = ar
            ? 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.'
            : 'Password reset link sent to your email.';
          info(msg);
          switchMode('login');
          setFeedback({ type: 'info', message: msg });
        } else {
          const msg = res.error || (ar ? 'فشل إرسال رابط الاستعادة.' : 'Reset request failed.');
          setFeedback({ type: 'error', message: msg });
          error(msg);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication error';
      setFeedback({ type: 'error', message: msg });
      error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      dir={dir}
      className="relative flex min-h-screen w-full flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-sky-100 px-4 py-10 sm:gap-8"
    >
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
          <div className="text-xs font-medium text-slate-500">
            {ar ? 'منصة الرعاية الطبية السحابية' : 'Cloud Healthcare Platform'}
          </div>
        </div>
      </header>

      <section
        aria-labelledby="auth-screen-title"
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/80 bg-white/95 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 id="auth-screen-title" className="text-base font-black text-slate-900">
              {modeCopy[mode].title}
            </h1>
            <p className="mt-1 text-xs text-slate-500">{modeCopy[mode].subtitle}</p>
          </div>
        </div>

        {mode !== 'updatePassword' && (
          <div className="mt-4 mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
            {(
              [
                ['login', ar ? 'دخول' : 'Sign In'],
                ['register', ar ? 'تسجيل جديد' : 'Register'],
                ['reset', ar ? 'استعادة' : 'Reset'],
              ] as const
            ).map(([tabMode, label]) => (
              <button
                key={tabMode}
                type="button"
                onClick={() => switchMode(tabMode)}
                className={`rounded-lg py-1.5 transition-all ${
                  mode === tabMode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {feedback && (
          <div
            role="alert"
            className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${
              feedback.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label htmlFor="auth-name-ar" className="mb-1 block text-xs font-bold text-slate-700">
                  {ar ? 'الاسم بالكامل (بالعربية) *' : 'Full Name (Arabic) *'}
                </label>
                <div className="relative">
                  <User className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-name-ar"
                    name="name_ar"
                    type="text"
                    autoComplete="name"
                    required
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="مثال: د. إبراهيم خليل"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pe-3 ps-9 text-xs focus:border-medicore-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-name-en" className="mb-1 block text-xs font-bold text-slate-700">
                  {ar ? 'الاسم بالإنجليزية' : 'Full Name (English)'}
                </label>
                <div className="relative">
                  <User className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-name-en"
                    name="name_en"
                    type="text"
                    autoComplete="name"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Dr. Ibrahim Khalil"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pe-3 ps-9 text-xs focus:border-medicore-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {mode !== 'updatePassword' && (
            <div>
              <label htmlFor="auth-identifier" className="mb-1 block text-xs font-bold text-slate-700">
                {mode === 'login'
                  ? ar
                    ? 'البريد الإلكتروني أو اسم المستخدم *'
                    : 'Email or Username *'
                  : ar
                  ? 'البريد الإلكتروني الرسمي *'
                  : 'Official Email *'}
              </label>
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-identifier"
                  name={mode === 'login' ? 'username' : 'email'}
                  type={mode === 'login' ? 'text' : 'email'}
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === 'login' ? (ar ? 'name@clinic.com أو اسم المستخدم' : 'name@clinic.com or username') : 'name@clinic.com'}
                  className="w-full rounded-xl border border-slate-200 py-2.5 pe-3 ps-9 text-xs focus:border-medicore-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {mode !== 'reset' && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="auth-password" className="text-xs font-bold text-slate-700">
                  {mode === 'updatePassword'
                    ? ar
                      ? 'كلمة المرور الجديدة *'
                      : 'New password *'
                    : ar
                    ? 'كلمة المرور *'
                    : 'Password *'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="text-[11px] font-bold text-medicore-600 hover:underline"
                  >
                    {ar ? 'نسيت كلمة المرور؟' : 'Forgot?'}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={mode === 'register' || mode === 'updatePassword' ? 12 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pe-10 ps-9 text-xs focus:border-medicore-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? (ar ? 'إخفاء كلمة المرور' : 'Hide password') : ar ? 'إظهار كلمة المرور' : 'Show password'}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {(mode === 'register' || mode === 'updatePassword') && (
            <div>
              <label htmlFor="auth-confirm-password" className="mb-1 block text-xs font-bold text-slate-700">
                {mode === 'updatePassword'
                  ? ar
                    ? 'تأكيد كلمة المرور الجديدة *'
                    : 'Confirm new password *'
                  : ar
                  ? 'تأكيد كلمة المرور *'
                  : 'Confirm Password *'}
              </label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-confirm-password"
                  name="confirm_password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pe-3 ps-9 text-xs focus:border-medicore-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-medicore-600 to-medicore-700 px-4 py-2.5 text-xs font-black text-white shadow-md transition-all hover:from-medicore-700 hover:to-medicore-800 disabled:opacity-60"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>{modeCopy[mode].submit}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      <p className="relative z-10 text-center text-[11px] font-medium text-slate-400">
        {ar ? 'دخول آمن إلى مساحة العمل الخاصة بك' : 'Secure access to your workspace'}
      </p>
    </main>
  );
};
