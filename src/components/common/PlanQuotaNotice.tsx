import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle } from 'lucide-react';

export interface OrgQuotaSnapshot {
  subscription_status: string;
  plan_name_ar: string;
  plan_name_en: string;
  limits: {
    max_branches: number;
    max_doctors: number;
    max_users: number;
    max_patients: number;
  };
  usage: {
    branches: number;
    doctors: number;
    users: number;
    patients: number;
  };
}

interface PlanQuotaNoticeProps {
  orgId: string;
  ar: boolean;
  scope?: 'all' | 'operations' | 'branches' | 'doctors' | 'users' | 'patients';
  onLoaded?: (snapshot: OrgQuotaSnapshot | null) => void;
}

export const PlanQuotaNotice: React.FC<PlanQuotaNoticeProps> = ({
  orgId,
  ar,
  scope = 'all',
  onLoaded,
}) => {
  const [snapshot, setSnapshot] = useState<OrgQuotaSnapshot | null>(null);

  useEffect(() => {
    if (!supabase || !orgId) return;
    let alive = true;
    void supabase.rpc('get_org_plan_limits', { p_org_id: orgId }).then(({ data, error }) => {
      if (!alive || error || !data) return;
      const payload = data as unknown as OrgQuotaSnapshot;
      setSnapshot(payload);
      onLoaded?.(payload);
    });
    return () => { alive = false; };
  }, [orgId, onLoaded]);

  if (!snapshot) return null;

  const checks: Array<{ key: 'branches' | 'doctors' | 'users' | 'patients'; labelAr: string; labelEn: string; max: number; used: number }> = [
    { key: 'branches', labelAr: 'الفروع', labelEn: 'Branches', max: snapshot.limits.max_branches, used: snapshot.usage.branches },
    { key: 'doctors', labelAr: 'الأطباء', labelEn: 'Doctors', max: snapshot.limits.max_doctors, used: snapshot.usage.doctors },
    { key: 'users', labelAr: 'فريق العمل', labelEn: 'Staff accounts', max: snapshot.limits.max_users, used: snapshot.usage.users },
    { key: 'patients', labelAr: 'المرضى', labelEn: 'Patients', max: snapshot.limits.max_patients, used: snapshot.usage.patients },
  ];

  const relevant = checks.filter(c => {
    const inScope = scope === 'all' || (scope === 'operations' ? c.key !== 'branches' : c.key === scope);
    return inScope && c.max > 0 && c.used >= c.max;
  });
  if (relevant.length === 0) return null;

  const summaryText = relevant
    .map(r => `${ar ? r.labelAr : r.labelEn}: ${r.used}/${r.max}`)
    .join(' · ');

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs leading-6 text-amber-950"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div>
        <p className="font-black">
          {ar
            ? `تنبيه حد الباقة (${snapshot.plan_name_ar}): ${summaryText}`
            : `Plan Quota Notice (${snapshot.plan_name_en}): ${summaryText}`}
        </p>
        <p className="text-amber-900">
          {ar
            ? 'يمكنك الاستمرار في إدارة وتحديث السجلات والكشوفات والمواعيد الحالية بشكل طبيعي، ولكن تم إيقاف الإضافات الجديدة لهذا المورد لحين ترقية الباقة.'
            : 'You can continue managing existing patients, visits, and records normally. New additions for this resource are paused until your plan is upgraded.'}
        </p>
      </div>
    </div>
  );
};
