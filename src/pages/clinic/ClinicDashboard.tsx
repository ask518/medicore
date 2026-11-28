// ============================================================================
// MEDICORE – Clinic & Medical Complex Overview Dashboard
// Realtime Reception Waiting Queue, Daily Financial Metrics & Patient Flow
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Appointment, Doctor } from '../../types/database';
import { 
  Users, Calendar, Clock, DollarSign, Stethoscope, 
  CheckCircle2, ArrowRight, UserCheck, AlertCircle, Plus
} from 'lucide-react';

interface ClinicDashboardProps {
  onNavigate: (tab: string) => void;
}

export const ClinicDashboard: React.FC<ClinicDashboardProps> = ({ onNavigate }) => {
  const { organization, activeBranch, availableBranches } = useAuth();
  const { locale, t } = useLanguage();
  const { error: showError } = useToast();
  const [patientsCount,setPatientsCount]=useState(0);const [todayApts,setTodayApts]=useState<Appointment[]>([]);const [doctors,setDoctors]=useState<(Doctor&{user?:{name_ar:string;name_en:string}})[]>([]);const [totalCashboxBalance,setTotalCashboxBalance]=useState(0);const [todayRevenue,setTodayRevenue]=useState(0);const [loading,setLoading]=useState(true);

  const orgId = organization?.id || '';
  const currency = organization?.default_currency || 'EGP';
  const todayStr = (()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;})();
  const load=useCallback(async()=>{if(!supabase||!orgId){setLoading(false);return;}setLoading(true);const todayStart=new Date(`${todayStr}T00:00:00`);const tomorrow=new Date(todayStart);tomorrow.setDate(tomorrow.getDate()+1);
    const [patientResult,appointmentResult,boxResult,paymentResult]=await Promise.all([
      supabase.from('patients').select('id',{count:'exact',head:true}).eq('organization_id',orgId).eq('is_active',true),
      (()=>{let q=supabase.from('appointments').select('*,patient:patients(id,mrn,first_name_ar,last_name_ar),doctor:doctors(id,specialty_title_ar,specialty_title_en,user:users(name_ar,name_en))').eq('organization_id',orgId).eq('appointment_date',todayStr).order('start_time');if(activeBranch?.id)q=q.eq('branch_id',activeBranch.id);return q;})(),
      activeBranch?.id?supabase.from('cashboxes').select('current_balance').eq('organization_id',orgId).eq('branch_id',activeBranch.id).eq('is_active',true):Promise.resolve({data:[],error:null}),
      (()=>{let q=supabase.from('payments').select('amount').eq('organization_id',orgId).gte('payment_date',todayStart.toISOString()).lt('payment_date',tomorrow.toISOString()).eq('is_reversal',false);if(activeBranch?.id)q=q.eq('branch_id',activeBranch.id);return q;})(),
    ]);
    if(patientResult.error||appointmentResult.error||boxResult.error||paymentResult.error){setLoading(false);return;}
    setPatientsCount(patientResult.count||0);setTodayApts((appointmentResult.data||[]) as unknown as Appointment[]);setTotalCashboxBalance((boxResult.data||[]).reduce((s,row)=>s+Number(row.current_balance||0),0));setTodayRevenue((paymentResult.data||[]).reduce((s,row)=>s+Number(row.amount||0),0));
    if(activeBranch?.id){const {data:access}=await supabase.from('user_branch_access').select('user_id').eq('organization_id',orgId).eq('branch_id',activeBranch.id);const ids=(access||[]).map(x=>x.user_id);if(ids.length){const {data:docRows}=await supabase.from('doctors').select('*,user:users(name_ar,name_en)').eq('organization_id',orgId).eq('is_active',true).in('user_id',ids);setDoctors((docRows||[]) as unknown as typeof doctors);}else setDoctors([]);}else{setDoctors([]);}setLoading(false);
  },[orgId,activeBranch?.id,todayStr]);
  useEffect(()=>{void load();},[load]);

  const waitingQueue = todayApts.filter(a => ['checked_in', 'waiting', 'in_consultation'].includes(a.status));
  const completedToday = todayApts.filter(a => a.status === 'completed').length;

  const handleStartConsultation=async(id:string)=>{if(!supabase)return;const {error}=await supabase.from('appointments').update({status:'in_consultation'}).eq('id',id).eq('organization_id',orgId);if(error){showError(locale==='ar'?'تعذر بدء الكشف للموعد. تحقق من الصلاحية وحالة الموعد.':'Could not start consultation for this appointment.');return;}await load();onNavigate('consultation');};

  if (!organization) return null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-medicore-700 via-medicore-600 to-teal-700 p-6 rounded-3xl text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/20 text-white uppercase tracking-wider">
            {activeBranch ? activeBranch[locale === 'ar' ? 'name_ar' : 'name_en'] : t.common.allBranches}
          </span>
          <h1 className="text-xl md:text-2xl font-black mt-2">
            {organization[locale === 'ar' ? 'name_ar' : 'name_en']}
          </h1>
          <p className="text-medicore-100 text-xs md:text-sm mt-1">
            {locale === 'ar' ? 'متابعة تدفق المرضى، طابور الانتظار بالاستقبال والمؤشرات المالية اليومية' : 'Live patient flow, waiting room queue, and daily financials'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => onNavigate('appointments')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-medicore-700 hover:bg-medicore-50 text-xs font-bold rounded-xl shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t.appointments.newAppointment}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('consultation')}
            className="flex items-center gap-2 px-4 py-2.5 bg-medicore-800/80 hover:bg-medicore-800 text-white text-xs font-bold rounded-xl border border-white/20 transition-all"
          >
            <Stethoscope className="w-4 h-4" />
            <span>{t.consultation.doctorDesk}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Patients */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{t.emr.patientFile}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{loading?'—':patientsCount}</p>
            <p className="text-[11px] text-medicore-600 font-semibold mt-1">
              {locale === 'ar' ? 'سجل طبي إلكتروني موثق' : 'EMR Records'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-medicore-50 text-medicore-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Appointments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{t.appointments.schedule} (اليوم)</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{loading?'—':todayApts.length}</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">
              {completedToday} {t.appointments.status_completed}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Waiting Room Queue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{t.nav.reception}</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{loading?'—':waitingQueue.length}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              {locale === 'ar' ? 'مرضى في صالة الانتظار الآن' : 'In waiting room now'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Total Cashbox Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{t.billing.cashboxBalance}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {totalCashboxBalance.toLocaleString()} <span className="text-xs font-semibold text-slate-500">{currency}</span>
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">
              + {todayRevenue.toLocaleString()} {currency} {locale === 'ar' ? 'تحصيل اليوم' : 'Collected today'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Live Reception Queue & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waiting Queue Table (2 Columns on large screens) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h2 className="font-bold text-slate-900 text-base">
                {locale === 'ar' ? 'طابور الاستقبال المباشر (صالة الانتظار)' : 'Live Reception & Waiting Queue'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('appointments')}
              className="text-xs font-bold text-medicore-600 hover:text-medicore-700 flex items-center gap-1"
            >
              <span>{locale === 'ar' ? 'عرض الجدول الكامل' : 'Full Schedule'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? <div className="p-10 text-center text-slate-400 text-xs">{locale==='ar'?'جار تحميل بيانات اليوم...':'Loading today’s data...'}</div> : todayApts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>{locale === 'ar' ? 'لا توجد مواعيد مسجلة لهذا اليوم حتى الآن' : 'No appointments scheduled for today'}</p>
              </div>
            ) : (
              todayApts.map(apt => {
                const statusStyles = {
                  checked_in: 'bg-emerald-100 text-emerald-800',
                  waiting: 'bg-amber-100 text-amber-800',
                  in_consultation: 'bg-indigo-100 text-indigo-800 animate-pulse font-bold',
                  confirmed: 'bg-sky-100 text-sky-800',
                  completed: 'bg-slate-100 text-slate-600',
                  pending: 'bg-slate-100 text-slate-600',
                  cancelled: 'bg-rose-100 text-rose-800 line-through',
                  no_show: 'bg-rose-50 text-rose-600',
                };

                return (
                  <div key={apt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 font-mono font-bold text-xs flex items-center justify-center text-slate-700 shrink-0">
                        {apt.start_time}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <span>{apt.patient ? `${apt.patient.first_name_ar} ${apt.patient.last_name_ar}` : apt.appointment_number}</span>
                          <span className="text-xs font-normal text-slate-400 font-mono">({apt.patient?.mrn})</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {locale === 'ar' ? 'الطبيب المعالج:' : 'Doctor:'} {apt.doctor?.specialty_title_ar || 'عيادة عامة'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${statusStyles[apt.status]}`}>
                        {t.appointments[`status_${apt.status}`] || apt.status}
                      </span>
                      {apt.status === 'checked_in' && (
                        <button
                          type="button"
                          onClick={() => {
                            void handleStartConsultation(apt.id);
                          }}
                          className="px-3 py-1 bg-medicore-600 hover:bg-medicore-700 text-white text-xs font-bold rounded-lg shadow-xs"
                        >
                          {t.appointments.startConsultation}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Available Doctors Roster */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 pb-3 border-b border-slate-100">
            <Stethoscope className="w-5 h-5 text-medicore-600" />
            {locale === 'ar' ? 'فريق الأطباء بالمنشأة' : 'Medical Staff Roster'}
          </h2>

          <div className="space-y-3">
            {doctors.map(doc => (
              <div key={doc.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900">
                    {doc.user ? doc.user[locale === 'ar' ? 'name_ar' : 'name_en'] : ''}
                  </h4>
                  <p className="text-[11px] text-medicore-600 font-medium">
                    {doc[locale === 'ar' ? 'specialty_title_ar' : 'specialty_title_en']}
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {doc.slot_duration_minutes} دقيقة / كشف
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigate('specialties')}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-rose-500 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-95 transition-all text-center flex items-center justify-center gap-2"
            >
              <span>{locale === 'ar' ? 'فتح المحركات التشخيصية التفاعلية' : 'Open Specialty Canvases'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
