import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Doctor, Patient } from '../../types/database';
import { FileText, HeartPulse, ShieldCheck } from 'lucide-react';

type PatientOption = Pick<Patient, 'id'|'mrn'|'first_name_ar'|'last_name_ar'>;
type DoctorOption = Pick<Doctor, 'id'|'user_id'|'specialty_code'|'specialty_title_ar'|'specialty_title_en'> & { user?: { name_ar: string; name_en: string } };
type ConsultationRow = { id: string; branch_id: string; patient_id: string; doctor_id: string; consultation_date: string; chief_complaint: string; treatment_plan: string | null; patient?: PatientOption; doctor?: { specialty_title_ar: string; user?: { name_ar: string } } };
type PrescriptionItemDraft = { drug_name: string; dosage: string; frequency: string; duration: string; quantity: string; instructions: string };
const numberOrNull = (value: string) => value.trim() === '' ? null : Number(value);

export const Consultation: React.FC = () => {
  const { user, organization, activeBranch, availableBranches } = useAuth();
  const { locale } = useLanguage(); const { success, error } = useToast();
  const [patients, setPatients] = useState<PatientOption[]>([]); const [doctors, setDoctors] = useState<DoctorOption[]>([]); const [records, setRecords] = useState<ConsultationRow[]>([]);
  const [patientId, setPatientId] = useState(''); const [doctorId, setDoctorId] = useState(''); const [branchId, setBranchId] = useState(activeBranch?.id || '');
  const [chief, setChief] = useState(''); const [history, setHistory] = useState(''); const [exam, setExam] = useState(''); const [plan, setPlan] = useState(''); const [followUp, setFollowUp] = useState('');
  const [systolic, setSystolic] = useState(''); const [diastolic, setDiastolic] = useState(''); const [heartRate, setHeartRate] = useState(''); const [temperature, setTemperature] = useState(''); const [weight, setWeight] = useState(''); const [height, setHeight] = useState(''); const [saving, setSaving] = useState(false); const [loading, setLoading] = useState(true);
  const [prescriptionConsultationId, setPrescriptionConsultationId] = useState(''); const [prescriptionSaving, setPrescriptionSaving] = useState(false); const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItemDraft[]>([{ drug_name: '', dosage: '', frequency: '', duration: '', quantity: '', instructions: '' }]);
  const ar = locale === 'ar'; const orgId = organization?.id || '';
  const isAuthorized = ['org_owner','general_manager','doctor','assistant_doctor'].includes(user?.role || '');

  const loadData = useCallback(async () => {
    if (!supabase || !orgId) { setLoading(false); return; }
    setLoading(true);
    const { data: patientRows, error: patientError } = await supabase.from('patients').select('id,mrn,first_name_ar,last_name_ar').eq('organization_id', orgId).eq('is_active', true).order('created_at', { ascending: false });
    if (patientError) { setLoading(false); error(ar ? 'تعذر تحميل ملفات المرضى.' : 'Could not load patients.'); return; }
    const permittedBranches = activeBranch?.id ? [activeBranch.id] : availableBranches.map(b => b.id);
    const { data: accessRows, error: accessError } = permittedBranches.length ? await supabase.from('user_branch_access').select('user_id,branch_id').eq('organization_id', orgId).in('branch_id', permittedBranches) : { data: [], error: null };
    if (accessError) { setLoading(false); error(ar ? 'تعذر تحميل صلاحيات الفروع.' : 'Could not load branch access.'); return; }
    const doctorIds = [...new Set((accessRows || []).map(row => row.user_id))];
    const doctorResult = doctorIds.length ? await supabase.from('doctors').select('id,user_id,specialty_code,specialty_title_ar,specialty_title_en,user:users(name_ar,name_en)').eq('organization_id', orgId).eq('is_active', true).in('user_id', doctorIds) : { data: [], error: null };
    if (doctorResult.error) { setLoading(false); error(ar ? 'تعذر تحميل الأطباء.' : 'Could not load doctors.'); return; }
    let recordQuery = supabase.from('consultations').select('id,branch_id,patient_id,doctor_id,consultation_date,chief_complaint,treatment_plan,patient:patients(id,mrn,first_name_ar,last_name_ar),doctor:doctors(specialty_title_ar,user:users(name_ar))').eq('organization_id', orgId).eq('status', 'finalized').order('consultation_date', { ascending: false }).limit(50);
    if (activeBranch?.id) recordQuery = recordQuery.eq('branch_id', activeBranch.id);
    const { data: consultationRows, error: recordsError } = await recordQuery;
    if (recordsError) { error(ar ? 'تعذر تحميل سجل الكشوفات.' : 'Could not load consultations.'); }
    setPatients((patientRows || []) as PatientOption[]); setDoctors((doctorResult.data || []) as unknown as DoctorOption[]); setRecords((consultationRows || []) as unknown as ConsultationRow[]);
    if (patientRows?.length && !patientId) setPatientId(patientRows[0].id);
    const selectedDoctor = (doctorResult.data || []).find(d => user?.role === 'doctor' || user?.role === 'assistant_doctor' ? d.user_id === user.id : true);
    if (selectedDoctor && !doctorId) setDoctorId(selectedDoctor.id);
    setLoading(false);
  }, [orgId, activeBranch?.id, availableBranches, ar, error, patientId, doctorId, user?.id, user?.role]);
  useEffect(() => { void loadData(); }, [loadData]);

  const saveConsultation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !organization || !user || !activeBranch || !patientId || !doctorId || !chief.trim()) { error(ar ? 'اختر المريض والطبيب واكتب الشكوى الرئيسية.' : 'Select a patient and doctor and enter the chief complaint.'); return; }
    if (!isAuthorized) { error(ar ? 'ليس لديك صلاحية اعتماد كشف.' : 'You cannot sign consultations.'); return; }
    if (['doctor','assistant_doctor'].includes(user.role) && doctors.find(d=>d.id===doctorId)?.user_id !== user.id) { error(ar ? 'يمكن للطبيب اعتماد كشفه فقط.' : 'Clinicians may sign only their own consultations.'); return; }
    const vitals = [systolic,diastolic,heartRate,temperature,weight,height].map(numberOrNull);
    if (vitals.some(value => value !== null && !Number.isFinite(value))) { error(ar ? 'راجع قيم العلامات الحيوية.' : 'Check the vital sign values.'); return; }
    if (vitals[0] !== null && (vitals[0]! < 40 || vitals[0]! > 300) || vitals[1] !== null && (vitals[1]! < 20 || vitals[1]! > 200) || vitals[2] !== null && (vitals[2]! < 20 || vitals[2]! > 250) || vitals[3] !== null && (vitals[3]! < 25 || vitals[3]! > 45) || vitals[4] !== null && (vitals[4]! <= 0 || vitals[4]! > 500) || vitals[5] !== null && (vitals[5]! <= 0 || vitals[5]! > 300)) { error(ar ? 'إحدى قيم العلامات الحيوية خارج النطاق المقبول.' : 'A vital sign is outside the accepted range.'); return; }
    const weightValue = vitals[4]; const heightValue = vitals[5]; const bmi = weightValue && heightValue ? Number((weightValue / Math.pow(heightValue / 100, 2)).toFixed(1)) : null;
    setSaving(true);
    const { error: insertError } = await supabase.from('consultations').insert({
      organization_id: organization.id, branch_id: activeBranch.id, patient_id: patientId, doctor_id: doctorId,
      status: 'finalized', chief_complaint: chief.trim(), history_of_present_illness: history.trim() || null,
      physical_examination: exam.trim() || null, treatment_plan: plan.trim() || null, follow_up_date: followUp || null,
      systolic_bp: vitals[0], diastolic_bp: vitals[1], heart_rate: vitals[2], temperature_celsius: vitals[3],
      weight_kg: weightValue, height_cm: heightValue, bmi, diagnoses_json: [], specialty_code: doctors.find(d=>d.id===doctorId)?.specialty_code || 'general_medicine', specialty_data: {},
    });
    setSaving(false);
    if (insertError) { error(insertError.message.includes('Signed consultations') ? (ar?'الكشف المعتمد غير قابل للتعديل.':'Signed consultations cannot be edited.') : (ar ? 'تعذر حفظ الكشف. راجع الفرع والصلاحيات.' : 'Could not save consultation; check branch access and permissions.')); return; }
    success(ar ? 'تم حفظ الكشف واعتماده وتوقيعه.' : 'Consultation saved, finalized, and signed.');
    setChief(''); setHistory(''); setExam(''); setPlan(''); setFollowUp(''); setSystolic(''); setDiastolic(''); setHeartRate(''); setTemperature(''); setWeight(''); setHeight('');
    await loadData();
  };

  const issuePrescription = async (event: React.FormEvent) => {
    event.preventDefault();
    const consultation = records.find(row => row.id === prescriptionConsultationId);
    if (!supabase || !consultation || !user || !isAuthorized) return;
    if (['doctor','assistant_doctor'].includes(user.role) && !doctors.some(d => d.id === consultation.doctor_id && d.user_id === user.id)) {
      error(ar ? 'يمكن للطبيب إصدار روشتة لكشفه فقط.' : 'Clinicians may prescribe only for their own consultations.'); return;
    }
    const items = prescriptionItems.map(item => ({ ...item, drug_name: item.drug_name.trim(), dosage: item.dosage.trim(), frequency: item.frequency.trim(), duration: item.duration.trim(), quantity: Number(item.quantity) }));
    if (items.some(item => !item.drug_name || !item.dosage || !item.frequency || !item.duration || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000)) {
      error(ar ? 'أكمل بيانات كل دواء والجرعة والتكرار والمدة والكمية.' : 'Complete every medicine, dose, frequency, duration, and quantity.'); return;
    }
    setPrescriptionSaving(true);
    const { data, error: issueError } = await supabase.rpc('issue_prescription', {
      p_consultation_id: consultation.id,
      p_items: items,
      p_diagnosis_summary: consultation.chief_complaint,
      p_notes: prescriptionNotes.trim() || null,
    });
    setPrescriptionSaving(false);
    if (issueError) { error(ar ? 'تعذر إصدار الروشتة. تحقق من صلاحية الطبيب والكشف المعتمد.' : 'Could not issue the prescription. Check clinician access and signed consultation.'); return; }
    const issued = Array.isArray(data) ? data[0] : data;
    success(ar ? `تم إصدار الروشتة ${issued?.prescription_number || ''}` : `Prescription ${issued?.prescription_number || ''} issued.`);
    setPrescriptionNotes(''); setPrescriptionItems([{ drug_name: '', dosage: '', frequency: '', duration: '', quantity: '', instructions: '' }]);
  };

  if (!organization) return null;
  return <main className="space-y-6" dir={ar?'rtl':'ltr'}>
    <header><h1 className="flex items-center gap-2 text-2xl font-black"><FileText className="h-6 w-6 text-medicore-600"/>{ar?'الكشف السريري':'Clinical consultation'}</h1><p className="mt-1 text-sm text-slate-500">{ar?'يُحفظ الكشف في قاعدة البيانات ويُوقّع باسم المستخدم الحالي. الكشف المعتمد غير قابل للتعديل.' : 'Consultations are stored in the database and signed by the current user. Finalized records cannot be edited.'}</p></header>
    {!isAuthorized&&<div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{ar?'الدور الحالي لا يسمح باعتماد الكشوفات.':'Your role cannot sign consultations.'}</div>}
    <form onSubmit={saveConsultation} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold">{ar?'المريض':'Patient'}<select required value={patientId} onChange={e=>setPatientId(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm"><option value="">{ar?'اختر مريضًا':'Select patient'}</option>{patients.map(p=><option key={p.id} value={p.id}>{p.first_name_ar} {p.last_name_ar} · {p.mrn}</option>)}</select></label><label className="text-xs font-bold">{ar?'الطبيب المعالج':'Treating clinician'}<select required value={doctorId} onChange={e=>setDoctorId(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm"><option value="">{ar?'اختر طبيبًا':'Select clinician'}</option>{doctors.filter(d=>!['doctor','assistant_doctor'].includes(user?.role||'')||d.user_id===user?.id).map(d=><option key={d.id} value={d.id}>{d.user?.[ar?'name_ar':'name_en']||d.specialty_title_ar} · {ar?d.specialty_title_ar:d.specialty_title_en}</option>)}</select></label><label className="text-xs font-bold">{ar?'الفرع':'Branch'}<select required value={activeBranch?.id||branchId} disabled={Boolean(activeBranch)} onChange={e=>setBranchId(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">{availableBranches.map(b=><option key={b.id} value={b.id}>{ar?b.name_ar:b.name_en}</option>)}</select></label></div>
      <label className="block text-xs font-bold">{ar?'الشكوى الرئيسية':'Chief complaint'}<textarea required maxLength={5000} value={chief} onChange={e=>setChief(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">{ar?'تاريخ الحالة':'History of present illness'}<textarea maxLength={10000} value={history} onChange={e=>setHistory(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label><label className="text-xs font-bold">{ar?'الفحص السريري':'Physical examination'}<textarea maxLength={10000} value={exam} onChange={e=>setExam(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label></div>
      <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4"><h2 className="mb-3 flex items-center gap-2 text-sm font-black"><HeartPulse className="h-4 w-4 text-rose-600"/>{ar?'العلامات الحيوية (تُترك فارغة إن لم تُقَس)':'Vitals (leave blank if not measured)'}</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{[[ar?'ضغط انقباضي':'Systolic','mmHg',systolic,setSystolic],[ar?'ضغط انبساطي':'Diastolic','mmHg',diastolic,setDiastolic],[ar?'النبض':'Heart rate','bpm',heartRate,setHeartRate],[ar?'الحرارة':'Temperature','°C',temperature,setTemperature],[ar?'الوزن':'Weight','kg',weight,setWeight],[ar?'الطول':'Height','cm',height,setHeight]].map(([label,unit,value,setter])=><label key={String(label)} className="text-[11px] font-bold text-slate-700">{String(label)} ({String(unit)})<input type="number" step="0.1" value={String(value)} onChange={e=>(setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label>)}</div></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">{ar?'خطة العلاج':'Treatment plan'}<textarea maxLength={10000} value={plan} onChange={e=>setPlan(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label><label className="text-xs font-bold">{ar?'موعد المتابعة':'Follow-up date'}<input type="date" value={followUp} onChange={e=>setFollowUp(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label></div>
      <button disabled={saving||loading||!isAuthorized||patients.length===0||doctors.length===0||!activeBranch} className="inline-flex items-center gap-2 rounded-xl bg-medicore-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"><ShieldCheck className="h-4 w-4"/>{saving?(ar?'جار الحفظ...':'Saving...'):(ar?'حفظ واعتماد الكشف':'Save and sign consultation')}</button>
    </form>
    <section className="overflow-hidden rounded-2xl border bg-white"><h2 className="border-b p-4 text-sm font-black">{ar?'الكشوفات الحديثة':'Recent consultations'}</h2>{loading?<div className="p-6 text-sm text-slate-500">{ar?'جار التحميل...':'Loading...'}</div>:records.length===0?<div className="p-6 text-sm text-slate-500">{ar?'لا توجد كشوفات بعد.':'No consultations yet.'}</div>:records.map(record=><article key={record.id} className="border-b p-4 last:border-b-0"><div className="flex flex-wrap justify-between gap-2 text-sm font-bold"><span>{record.patient?.first_name_ar} {record.patient?.last_name_ar} · {record.patient?.mrn}</span><time className="text-xs font-normal text-slate-500">{new Date(record.consultation_date).toLocaleString(ar?'ar-EG':'en-GB')}</time></div><p className="mt-2 text-sm"><b>{ar?'الشكوى:':'Complaint:'}</b> {record.chief_complaint}</p>{record.treatment_plan&&<p className="mt-1 text-sm text-slate-600"><b>{ar?'الخطة:':'Plan:'}</b> {record.treatment_plan}</p>}<p className="mt-2 text-[11px] font-bold text-emerald-700">{ar?'موقّع ومعتمد ·':'Signed and finalized ·'} {record.doctor?.user?.name_ar||record.doctor?.specialty_title_ar}</p></article>)}</section>
    <form onSubmit={issuePrescription} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div><h2 className="text-lg font-black">{ar?'إصدار روشتة':'Issue prescription'}</h2><p className="mt-1 text-xs text-slate-500">{ar?'تُربط الروشتة بكشف معتمد، ولا توجد أدوية أو جرعات افتراضية. راجع البيانات الطبية قبل الإصدار.':'Prescriptions require a signed consultation. No medicine or dose is prefilled; verify all clinical details before issuing.'}</p></div>
      <label className="block text-xs font-bold">{ar?'الكشف المعتمد':'Signed consultation'}<select required value={prescriptionConsultationId} onChange={e=>setPrescriptionConsultationId(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3 text-sm"><option value="">{ar?'اختر كشفًا':'Select consultation'}</option>{records.map(row=><option key={row.id} value={row.id}>{row.patient?.first_name_ar} {row.patient?.last_name_ar} · {new Date(row.consultation_date).toLocaleDateString(ar?'ar-EG':'en-GB')} · {row.chief_complaint.slice(0,80)}</option>)}</select></label>
      {prescriptionItems.map((item,index)=><fieldset key={index} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-3"><legend className="px-1 text-xs font-bold">{ar?`الدواء ${index+1}`:`Medicine ${index+1}`}</legend>{([['drug_name',ar?'اسم الدواء':'Medicine name'],['dosage',ar?'الجرعة':'Dose'],['frequency',ar?'التكرار':'Frequency'],['duration',ar?'المدة':'Duration'],['quantity',ar?'الكمية':'Quantity'],['instructions',ar?'تعليمات إضافية':'Additional instructions']] as const).map(([key,label])=><label key={key} className="text-xs font-bold">{label}<input required={key!=='instructions'} type={key==='quantity'?'number':'text'} min={key==='quantity'?1:undefined} maxLength={key==='quantity'?undefined:2000} value={item[key]} onChange={e=>setPrescriptionItems(rows=>rows.map((row,i)=>i===index?{...row,[key]:e.target.value}:row))} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>)}{prescriptionItems.length>1&&<button type="button" onClick={()=>setPrescriptionItems(rows=>rows.filter((_,i)=>i!==index))} className="justify-self-start text-xs font-bold text-rose-700">{ar?'حذف الدواء':'Remove medicine'}</button>}</fieldset>)}
      <div className="flex flex-wrap gap-3"><button type="button" disabled={prescriptionItems.length>=30} onClick={()=>setPrescriptionItems(rows=>[...rows,{drug_name:'',dosage:'',frequency:'',duration:'',quantity:'',instructions:''}])} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">{ar?'إضافة دواء':'Add medicine'}</button><label className="min-w-64 flex-1 text-xs font-bold">{ar?'ملاحظات الروشتة':'Prescription notes'}<input value={prescriptionNotes} maxLength={2000} onChange={e=>setPrescriptionNotes(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label><button disabled={prescriptionSaving||!isAuthorized||records.length===0} className="rounded-xl bg-medicore-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{prescriptionSaving?(ar?'جار الإصدار...':'Issuing...'):(ar?'إصدار الروشتة':'Issue prescription')}</button></div>
    </form>
  </main>;
};
