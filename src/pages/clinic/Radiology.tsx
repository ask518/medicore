// ============================================================================
// MEDICORE – Radiology & Medical Imaging Management Module
// Imaging Orders, Radiologist Report Approval & Private Storage Signed Scans
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { createAttachmentSignedUrl, uploadMedicalAttachment } from '../../lib/attachments';
import {
  Doctor,
  MedicalAttachment,
  OrderStatus,
  Patient,
  RadiologyOrder,
} from '../../types/database';
import {
  Radio,
  Plus,
  Search,
  CheckCircle2,
  FileUp,
  ExternalLink,
  RefreshCw,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Scan,
  X,
} from 'lucide-react';

type PatientOption = Pick<Patient, 'id' | 'mrn' | 'first_name_ar' | 'last_name_ar' | 'first_name_en' | 'last_name_en'>;
type DoctorOption = Pick<Doctor, 'id' | 'user_id' | 'specialty_title_ar' | 'specialty_title_en'> & {
  user?: { name_ar: string; name_en: string };
};

interface RadiologyOrderRow extends Omit<RadiologyOrder, 'patient' | 'doctor'> {
  patient?: PatientOption;
  doctor?: DoctorOption;
}

const MODALITIES = ['X-Ray', 'CT', 'MRI', 'Ultrasound', 'Mammography', 'Panoramic Dental'];

const generateRadOrderNumber = (): string => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `RAD-${d}-${rand}`;
};

export const Radiology: React.FC = () => {
  const { user, organization, activeBranch, availableBranches, can } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error } = useToast();
  const ar = locale === 'ar';

  const orgId = organization?.id || '';
  const branchId = activeBranch?.id || '';
  const role = user?.role || '';

  const canView = can('radiology', 'view');
  const canOrder =
    can('radiology', 'create') ||
    ['super_admin', 'org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor', 'radiology_technician'].includes(role);
  const canReport = ['super_admin', 'org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'radiology_technician'].includes(role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [orders, setOrders] = useState<RadiologyOrderRow[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [attachments, setAttachments] = useState<MedicalAttachment[]>([]);

  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');

  // Report Draft State
  const [findingsReport, setFindingsReport] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [dicomLink, setDicomLink] = useState('');

  // New Order Modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderPatientId, setOrderPatientId] = useState('');
  const [orderDoctorId, setOrderDoctorId] = useState('');
  const [modality, setModality] = useState('X-Ray');
  const [bodyPart, setBodyPart] = useState('');

  const loadData = useCallback(async () => {
    if (!supabase || !orgId || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const branchIds = branchId ? [branchId] : availableBranches.map((b) => b.id);

      let radQuery = supabase
        .from('radiology_orders')
        .select(
          '*, patient:patients(id,mrn,first_name_ar,last_name_ar,first_name_en,last_name_en), doctor:doctors(id,user_id,specialty_title_ar,specialty_title_en,user:users(name_ar,name_en))'
        )
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (branchId) radQuery = radQuery.eq('branch_id', branchId);

      const accessQuery = branchIds.length
        ? supabase.from('user_branch_access').select('user_id').eq('organization_id', orgId).in('branch_id', branchIds)
        : Promise.resolve({ data: [], error: null });

      const [ordersRes, patientsRes, accessRes] = await Promise.all([
        radQuery,
        supabase
          .from('patients')
          .select('id,mrn,first_name_ar,last_name_ar,first_name_en,last_name_en')
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(200),
        accessQuery,
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (patientsRes.error) throw patientsRes.error;
      if (accessRes.error) throw accessRes.error;

      const doctorUserIds = [...new Set((accessRes.data || []).map((row: { user_id: string }) => row.user_id))];
      const doctorsRes = doctorUserIds.length
        ? await supabase
            .from('doctors')
            .select('id,user_id,specialty_title_ar,specialty_title_en,user:users(name_ar,name_en)')
            .eq('organization_id', orgId)
            .eq('is_active', true)
            .in('user_id', doctorUserIds)
        : { data: [], error: null };

      if (doctorsRes.error) throw doctorsRes.error;

      const fetchedOrders = (ordersRes.data || []) as unknown as RadiologyOrderRow[];
      setOrders(fetchedOrders);
      setPatients((patientsRes.data || []) as PatientOption[]);
      const fetchedDoctors = (doctorsRes.data || []) as unknown as DoctorOption[];
      setDoctors(fetchedDoctors);

      if (patientsRes.data?.length && !orderPatientId) setOrderPatientId(patientsRes.data[0].id);
      const myDoctor = fetchedDoctors.find((d) => d.user_id === user?.id) || fetchedDoctors[0];
      if (myDoctor && !orderDoctorId) setOrderDoctorId(myDoctor.id);

      if (fetchedOrders.length && !fetchedOrders.some((o) => o.id === selectedOrderId)) {
        setSelectedOrderId(fetchedOrders[0].id);
      }
    } catch (err) {
      console.error('Radiology load error:', err);
      error(ar ? 'تعذر تحميل طلبات الأشعة والتقارير.' : 'Unable to load radiology orders.');
    } finally {
      setLoading(false);
    }
  }, [orgId, branchId, availableBranches, canView, user?.id, ar, error, orderPatientId, orderDoctorId, selectedOrderId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  useEffect(() => {
    if (!selectedOrder) {
      setFindingsReport('');
      setConclusion('');
      setDicomLink('');
      setAttachments([]);
      return;
    }
    setFindingsReport(selectedOrder.findings_report || '');
    setConclusion(selectedOrder.conclusion || '');
    setDicomLink(selectedOrder.dicom_link || '');

    if (supabase && orgId) {
      supabase
        .from('medical_attachments')
        .select('*')
        .eq('organization_id', orgId)
        .eq('radiology_order_id', selectedOrder.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setAttachments((data || []) as MedicalAttachment[]);
        });
    }
  }, [selectedOrder, orgId]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (modalityFilter !== 'all' && order.imaging_modality !== modalityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const patientName = `${order.patient?.first_name_ar || ''} ${order.patient?.last_name_ar || ''} ${order.patient?.first_name_en || ''} ${order.patient?.last_name_en || ''}`.toLowerCase();
        const mrn = (order.patient?.mrn || '').toLowerCase();
        if (
          !order.order_number.toLowerCase().includes(q) &&
          !order.body_part.toLowerCase().includes(q) &&
          !patientName.includes(q) &&
          !mrn.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [orders, statusFilter, modalityFilter, searchQuery]);

  const stats = useMemo(() => {
    const requested = orders.filter((o) => o.status === 'requested').length;
    const inProgress = orders.filter((o) => o.status === 'in_progress').length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    return { total: orders.length, requested, inProgress, completed };
  }, [orders]);

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !orgId || !branchId) {
      error(ar ? 'اختر فرعاً نشطاً قبل إنشاء الطلب.' : 'Select an active branch first.');
      return;
    }
    if (!orderPatientId || !orderDoctorId || !bodyPart.trim()) {
      error(ar ? 'أكمل بيانات المريض والطبيب ومنطقة الفحص.' : 'Select patient, doctor, and body part.');
      return;
    }
    setSaving(true);
    try {
      const { data, error: insError } = await supabase
        .from('radiology_orders')
        .insert({
          organization_id: orgId,
          branch_id: branchId,
          patient_id: orderPatientId,
          doctor_id: orderDoctorId,
          order_number: generateRadOrderNumber(),
          imaging_modality: modality,
          body_part: bodyPart.trim(),
          status: 'requested',
        })
        .select('*')
        .single();
      if (insError || !data) throw insError || new Error('Insert failed');

      success(ar ? 'تم تسجيل طلب الأشعة بنجاح.' : 'Radiology order created.');
      setShowOrderModal(false);
      setBodyPart('');
      setSelectedOrderId(data.id);
      await loadData();
    } catch (err) {
      console.error('Create radiology order error:', err);
      error(ar ? 'تعذر إنشاء طلب الأشعة.' : 'Failed to create radiology order.');
    } finally {
      setSaving(false);
    }
  };

  const updateOrderStatus = async (order: RadiologyOrderRow, status: OrderStatus) => {
    if (!supabase || !orgId) return;
    setSaving(true);
    try {
      const { error: updErr } = await supabase
        .from('radiology_orders')
        .update({ status })
        .eq('id', order.id)
        .eq('organization_id', orgId);
      if (updErr) throw updErr;
      success(ar ? 'تم تحديث حالة الفحص.' : 'Order status updated.');
      await loadData();
    } catch (err) {
      console.error('Radiology status error:', err);
      error(ar ? 'تعذر تحديث الحالة.' : 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  };

  const saveReport = async (approve: boolean) => {
    if (!supabase || !orgId || !selectedOrder) return;
    if (approve && !findingsReport.trim()) {
      error(ar ? 'اكتب تقرير الأشعة (Findings) قبل الاعتماد.' : 'Findings report is required before approval.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        findings_report: findingsReport.trim() || null,
        conclusion: conclusion.trim() || null,
        dicom_link: dicomLink.trim() || null,
      };
      if (approve) {
        payload.status = 'completed';
        payload.report_approved_at = new Date().toISOString();
      } else if (selectedOrder.status === 'requested') {
        payload.status = 'in_progress';
      }

      const { error: updErr } = await supabase
        .from('radiology_orders')
        .update(payload)
        .eq('id', selectedOrder.id)
        .eq('organization_id', orgId);
      if (updErr) throw updErr;

      success(approve ? (ar ? 'تم اعتماد تقرير الأشعة وإغلاق الطلب.' : 'Radiology report approved.') : ar ? 'تم حفظ مسودة التقرير.' : 'Report draft saved.');
      await loadData();
    } catch (err) {
      console.error('Save radiology report error:', err);
      error(ar ? 'تعذر حفظ التقرير. تأكد من الصلاحيات وعدم تعديل تقرير معتمد.' : 'Failed to save report.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedOrder || !orgId) return;
    setUploadingFile(true);
    try {
      const uploaded = await uploadMedicalAttachment({
        organizationId: orgId,
        patientId: selectedOrder.patient_id,
        radiologyOrderId: selectedOrder.id,
        file,
        description: `${selectedOrder.imaging_modality} - ${selectedOrder.body_part}`,
      });
      setAttachments((prev) => [uploaded, ...prev]);
      success(ar ? 'تم رفع ملف الأشعة وتأمينه.' : 'Radiology scan uploaded securely.');
    } catch (err) {
      console.error('Upload scan error:', err);
      error(ar ? 'تعذر رفع الملف. الحد الأقصى 20 ميجابايت.' : 'Upload failed (max 20 MB).');
    } finally {
      setUploadingFile(false);
    }
  };

  const openAttachment = async (att: MedicalAttachment) => {
    try {
      const url = await createAttachmentSignedUrl(att.storage_path, 300);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Signed URL error:', err);
      error(ar ? 'تعذر فتح الملف.' : 'Unable to generate secure link.');
    }
  };

  if (!canView) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center" dir={ar ? 'rtl' : 'ltr'}>
        <AlertTriangle className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-3 text-lg font-black text-slate-900">{t.nav.radiology}</h1>
        <p className="mt-2 text-sm text-rose-900">
          {ar ? 'ليست لديك صلاحية عرض وحدة الأشعة والتصوير.' : 'You do not have permission to view radiology.'}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <Radio className="h-7 w-7 text-indigo-600" />
            {t.nav.radiology}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ar
              ? 'طلبات التصوير الطبي، رفع الأشعة بتخزين خاص مشفر، وكتابة واعتماد تقارير الأشعة.'
              : 'Diagnostic imaging orders, private encrypted scan uploads, and signed radiology reports.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {ar ? 'تحديث' : 'Refresh'}
          </button>
          {canOrder && (
            <button
              type="button"
              onClick={() => setShowOrderModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              {ar ? 'طلب أشعة جديد' : 'New Radiology Order'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">{ar ? 'إجمالي الفحوصات' : 'Total Orders'}</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-800">{ar ? 'بانتظار التصوير' : 'Requested'}</p>
          <p className="mt-1 text-2xl font-black text-amber-900">{stats.requested}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-800">{ar ? 'قيد التنفيذ والتقرير' : 'In Progress'}</p>
          <p className="mt-1 text-2xl font-black text-blue-900">{stats.inProgress}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold text-emerald-800">{ar ? 'تقارير معتمدة' : 'Approved Reports'}</p>
          <p className="mt-1 text-2xl font-black text-emerald-900">{stats.completed}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Orders Sidebar */}
        <div className="space-y-4 lg:col-span-5">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 h-4 w-4 text-slate-400 ltr:left-3 rtl:right-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={ar ? 'بحث برقم الطلب أو المريض أو العضو...' : 'Search order #, patient, body part...'}
                className="w-full rounded-xl border border-slate-200 py-2 text-sm focus:border-indigo-500 focus:outline-none ltr:pl-9 ltr:pr-3 rtl:pl-3 rtl:pr-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={modalityFilter}
                onChange={(e) => setModalityFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="all">{ar ? 'كل أنواع الأشعة' : 'All Modalities'}</option>
                {MODALITIES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="all">{ar ? 'كل الحالات' : 'All Statuses'}</option>
                <option value="requested">{ar ? 'مطلوب' : 'Requested'}</option>
                <option value="in_progress">{ar ? 'قيد العمل' : 'In Progress'}</option>
                <option value="completed">{ar ? 'مكتمل ومعتمد' : 'Completed'}</option>
                <option value="canceled">{ar ? 'ملغي' : 'Canceled'}</option>
              </select>
            </div>
          </div>

          <div className="space-y-2.5">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                {ar ? 'جاري تحميل طلبات الأشعة...' : 'Loading radiology orders...'}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                {ar ? 'لا توجد طلبات أشعة مطابقة.' : 'No matching radiology orders.'}
              </div>
            ) : (
              filteredOrders.map((order) => {
                const selected = order.id === selectedOrderId;
                const pName = order.patient
                  ? ar
                    ? `${order.patient.first_name_ar} ${order.patient.last_name_ar}`
                    : `${order.patient.first_name_en || order.patient.first_name_ar} ${order.patient.last_name_en || order.patient.last_name_ar}`
                  : '-';
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full rounded-2xl border p-4 text-start transition ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50/70 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-black text-indigo-700">{order.order_number}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          order.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : order.status === 'canceled'
                            ? 'bg-slate-100 text-slate-600'
                            : order.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-1.5 font-bold text-slate-900">{pName}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      <span className="font-bold text-indigo-700">{order.imaging_modality}</span> — {order.body_part}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Report & Scans Area */}
        <div className="lg:col-span-7">
          {!selectedOrder ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
              <Scan className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              {ar ? 'اختر طلب أشعة لعرض الصور وكتابة التقرير.' : 'Select a radiology order to view scans and write reports.'}
            </div>
          ) : (
            <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-indigo-700">{selectedOrder.order_number}</span>
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                      {selectedOrder.imaging_modality}
                    </span>
                    {selectedOrder.report_approved_at && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {ar ? 'تقرير معتمد' : 'Approved'}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 text-lg font-black text-slate-900">
                    {selectedOrder.patient
                      ? `${selectedOrder.patient.first_name_ar} ${selectedOrder.patient.last_name_ar} (${selectedOrder.patient.mrn})`
                      : '-'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {ar ? 'منطقة الفحص: ' : 'Body Part: '}
                    <strong>{selectedOrder.body_part}</strong> •{' '}
                    {ar ? 'الطبيب الطالب: ' : 'Doctor: '}
                    {selectedOrder.doctor?.user?.name_ar || selectedOrder.doctor?.user?.name_en || '-'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 print:hidden">
                  {selectedOrder.status === 'requested' && canReport && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void updateOrderStatus(selectedOrder, 'in_progress')}
                      className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      {ar ? 'بدء التصوير' : 'Start Imaging'}
                    </button>
                  )}
                  {selectedOrder.status !== 'completed' && selectedOrder.status !== 'canceled' && canReport && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void updateOrderStatus(selectedOrder, 'canceled')}
                      className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                    >
                      {ar ? 'إلغاء' : 'Cancel'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    {ar ? 'طباعة' : 'Print'}
                  </button>
                </div>
              </div>

              {/* Radiology Report Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {ar ? 'تقرير الفحص التفصيلي (Findings)' : 'Detailed Findings Report'}
                  </label>
                  <textarea
                    rows={5}
                    disabled={Boolean(selectedOrder.report_approved_at) || selectedOrder.status === 'canceled' || !canReport}
                    value={findingsReport}
                    onChange={(e) => setFindingsReport(e.target.value)}
                    placeholder={ar ? 'اكتب الملاحظات التشريحية والتصويرية بالتفصيل...' : 'Enter radiological observations and findings...'}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm disabled:bg-slate-50"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {ar ? 'الخلاصة التشخيصية (Impression / Conclusion)' : 'Diagnostic Conclusion'}
                    </label>
                    <textarea
                      rows={2}
                      disabled={Boolean(selectedOrder.report_approved_at) || selectedOrder.status === 'canceled' || !canReport}
                      value={conclusion}
                      onChange={(e) => setConclusion(e.target.value)}
                      placeholder={ar ? 'الخلاصة النهائية...' : 'Summary impression...'}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {ar ? 'رابط PACS / DICOM (اختياري)' : 'External PACS / DICOM URL (Optional)'}
                    </label>
                    <input
                      type="url"
                      disabled={Boolean(selectedOrder.report_approved_at) || selectedOrder.status === 'canceled' || !canReport}
                      value={dicomLink}
                      onChange={(e) => setDicomLink(e.target.value)}
                      placeholder="https://pacs.example.org/study/..."
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                  </div>
                </div>

                {!selectedOrder.report_approved_at && selectedOrder.status !== 'canceled' && canReport && (
                  <div className="flex flex-wrap justify-end gap-2 print:hidden">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveReport(false)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {ar ? 'حفظ المسودة' : 'Save Draft'}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveReport(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {ar ? 'اعتماد التقرير وإغلاق الطلب' : 'Approve Report & Complete'}
                    </button>
                  </div>
                )}
              </div>

              {/* Secure Private Scan Uploads */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800">
                    {ar ? 'صور الأشعة والملفات المرفوعة (تخزين خاص)' : 'Encrypted Scan Images & Attachments'}
                  </h3>
                  {canReport && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100 print:hidden">
                      <FileUp className="h-3.5 w-3.5" />
                      {uploadingFile ? (ar ? 'جاري الرفع...' : 'Uploading...') : ar ? 'رفع صورة أشعة / PDF' : 'Upload Scan / PDF'}
                      <input
                        type="file"
                        accept="image/*,.pdf,.dcm"
                        className="hidden"
                        disabled={uploadingFile}
                        onChange={handleUploadScan}
                      />
                    </label>
                  )}
                </div>
                {attachments.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    {ar ? 'لا توجد صور أشعة مرفوعة لهذا الطلب.' : 'No scan attachments uploaded yet.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {attachments.map((att) => (
                      <button
                        key={att.id}
                        type="button"
                        onClick={() => void openAttachment(att)}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-start text-xs hover:bg-slate-50"
                      >
                        <div className="truncate">
                          <p className="truncate font-bold text-slate-800">{att.file_name}</p>
                          <p className="text-[11px] text-slate-400">
                            {(att.file_size_bytes / 1024).toFixed(0)} KB • {att.description || att.file_type}
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-indigo-600" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Radiology Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={createOrder} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">{ar ? 'إنشاء طلب أشعة جديد' : 'New Radiology Order'}</h3>
              <button type="button" onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">{ar ? 'المريض' : 'Patient'}</label>
                <select
                  required
                  value={orderPatientId}
                  onChange={(e) => setOrderPatientId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">{ar ? 'اختر المريض...' : 'Select patient...'}</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name_ar} {p.last_name_ar} ({p.mrn})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">{ar ? 'الطبيب الطالب' : 'Ordering Doctor'}</label>
                <select
                  required
                  value={orderDoctorId}
                  onChange={(e) => setOrderDoctorId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">{ar ? 'اختر الطبيب...' : 'Select doctor...'}</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.user?.name_ar || d.user?.name_en || d.specialty_title_ar}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'نوع الأشعة' : 'Modality'}</label>
                  <select
                    value={modality}
                    onChange={(e) => setModality(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {MODALITIES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'منطقة الفحص' : 'Body Part'}</label>
                  <input
                    required
                    type="text"
                    value={bodyPart}
                    onChange={(e) => setBodyPart(e.target.value)}
                    placeholder={ar ? 'مثال: الصدر، الفقرات القطنية...' : 'e.g. Chest PA, Lumbar Spine...'}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
              >
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? (ar ? 'جاري الحفظ...' : 'Saving...') : ar ? 'تأكيد الطلب' : 'Submit Order'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
