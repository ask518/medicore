import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Organization, Subscription, User } from '../../types/database';
import { Building2, Users, ShieldCheck, RefreshCw } from 'lucide-react';

interface Props { activeTab: string; onSelectTab: (tab: string) => void }
type OrganizationRow = Organization & { branches?: { id: string }[]; subscriptions?: Subscription[] };

export const SuperAdminDashboard: React.FC<Props> = ({ activeTab, onSelectTab }) => {
  const { locale } = useLanguage(); const { error } = useToast();
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [users, setUsers] = useState<User[]>([]); const [userCount, setUserCount] = useState(0); const [loading, setLoading] = useState(true);
  const ar = locale === 'ar';
  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); error(ar ? 'اتصال قاعدة البيانات غير مهيأ.' : 'Database connection is not configured.'); return; }
    setLoading(true);
    const [orgResult, userResult] = await Promise.all([
      supabase.from('organizations').select('*,branches(id),subscriptions(*)').order('created_at', { ascending: false }),
      supabase.from('users').select('id,email,name_ar,name_en,role,is_active,organization_id', { count: 'exact' }).order('created_at', { ascending: false }),
    ]);
    if (orgResult.error || userResult.error) { error(ar ? 'تعذر تحميل بيانات المنصة. تحقق من ترحيلات الصلاحيات.' : 'Could not load platform data. Check the security migrations.'); setLoading(false); return; }
    setOrganizations((orgResult.data || []) as unknown as OrganizationRow[]); setUsers((userResult.data || []) as User[]); setUserCount(userResult.count || 0); setLoading(false);
  }, [ar, error]);
  useEffect(() => { void load(); }, [load]);

  const activeCount = organizations.filter(org => org.status === 'active').length;
  const branchCount = organizations.reduce((count, org) => count + (org.branches?.length || 0), 0);
  const trialCount = organizations.reduce((count, org) => count + (org.subscriptions || []).filter(sub => sub.status === 'trialing').length, 0);
  const tabs = [['super_admin_dashboard', ar ? 'نظرة عامة' : 'Overview'], ['super_admin_orgs', ar ? 'المنشآت' : 'Facilities'], ['super_admin_users', ar ? 'الحسابات' : 'Accounts'], ['super_admin_subscriptions', ar ? 'الاشتراكات' : 'Subscriptions']];

  return <main className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
    <header className="rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 p-6 text-white"><div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-purple-300"/><div><h1 className="text-2xl font-black">{ar ? 'إدارة المنصة' : 'Platform administration'}</h1><p className="mt-1 text-sm text-purple-100">{ar ? 'عرض بيانات Supabase الفعلية. التغييرات الإدارية وتقمص حساب موظف متوقفة حتى تجهيز إجراءات آمنة على الخادم.' : 'Read-only view of live Supabase data. Administrative changes and impersonation are disabled until secure server workflows are deployed.'}</p></div><button onClick={() => void load()} className="ms-auto rounded-xl border border-white/20 p-2" title={ar ? 'تحديث' : 'Refresh'}><RefreshCw className="h-4 w-4"/></button></div></header>
    <nav className="flex flex-wrap gap-2">{tabs.map(([key, label]) => <button key={key} onClick={() => onSelectTab(key)} className={`rounded-xl px-4 py-2 text-xs font-bold ${activeTab === key ? 'bg-purple-900 text-white' : 'border bg-white text-slate-700'}`}>{label}</button>)}</nav>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[ar ? 'المنشآت' : 'Facilities', organizations.length, <Building2 key="o" className="h-5 w-5"/>], [ar ? 'المنشآت النشطة' : 'Active facilities', activeCount, <ShieldCheck key="a" className="h-5 w-5"/>], [ar ? 'الفروع' : 'Branches', branchCount, <Building2 key="b" className="h-5 w-5"/>], [ar ? 'حسابات المستخدمين' : 'User accounts', userCount, <Users key="u" className="h-5 w-5"/>]].map(([label, value, icon]) => <article key={String(label)} className="flex items-center justify-between rounded-2xl border bg-white p-5"><div><p className="text-xs font-bold text-slate-500">{String(label)}</p><p className="mt-1 text-2xl font-black">{loading ? '—' : String(value)}</p></div><span className="text-purple-700">{icon}</span></article>)}</section>
    {(activeTab === 'super_admin_subscriptions' || activeTab === 'super_admin_dashboard') && <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">{ar ? `الاشتراكات التجريبية الحالية: ${loading ? '—' : trialCount}. إدارة الفوترة والخطط غير مفعلة.` : `Trial subscriptions: ${loading ? '—' : trialCount}. Plan and billing administration are disabled.`}</p>}
    {activeTab === 'super_admin_users' ? <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b p-4 font-black">{ar ? 'حسابات المستخدمين' : 'User accounts'}</div>{loading ? <p className="p-8 text-sm text-slate-500">{ar ? 'جار تحميل البيانات...' : 'Loading...'}</p> : users.map(user => <article key={user.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><p className="font-bold">{ar ? user.name_ar : user.name_en}</p><p className="text-xs text-slate-500">{user.email}</p></div><div className="flex gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{user.role}</span><span className={`rounded-full px-2.5 py-1 text-xs ${user.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{user.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'موقوف' : 'Inactive')}</span></div></article>)}</section> : <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b p-4 font-black">{ar ? 'المنشآت المسجلة' : 'Registered facilities'}</div>{loading ? <p className="p-8 text-sm text-slate-500">{ar ? 'جار تحميل البيانات...' : 'Loading...'}</p> : organizations.length === 0 ? <p className="p-8 text-sm text-slate-500">{ar ? 'لا توجد منشآت مسجلة.' : 'No facilities are registered.'}</p> : <div className="overflow-x-auto"><table className="w-full text-start text-xs"><thead className="bg-slate-50"><tr>{[ar ? 'المنشأة' : 'Facility', ar ? 'المدينة' : 'City', ar ? 'الحالة' : 'Status', ar ? 'الفروع' : 'Branches', ar ? 'تاريخ التسجيل' : 'Created'].map(header => <th key={header} className="p-3 text-start">{header}</th>)}</tr></thead><tbody>{organizations.map(org => <tr key={org.id} className="border-t"><td className="p-3 font-bold">{ar ? org.name_ar : org.name_en}<div className="font-normal text-slate-500">{org.email}</div></td><td className="p-3">{org.city}</td><td className="p-3">{org.status}</td><td className="p-3">{org.branches?.length || 0}</td><td className="p-3">{new Date(org.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}</td></tr>)}</tbody></table></div>}</section>}
    <p className="text-xs leading-6 text-slate-500">{ar ? 'لا توجد أزرار تغيير أدوار أو حذف أو دخول كموظف؛ كل عملية إدارية تحتاج مسارًا موثقًا يراجع الصلاحيات ويسجل التدقيق.' : 'Role changes, deletion, and impersonation are disabled; each administrative action needs a permission-checked and audited server workflow.'}</p>
  </main>;
};
