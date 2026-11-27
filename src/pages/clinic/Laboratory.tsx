// ============================================================================
// MEDICORE – Laboratory Information System (LIS) Module
// Catalog Management, Order Lifecycle, Results Entry, Approval & Signed Files
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { createAttachmentSignedUrl, uploadMedicalAttachment } from '../../lib/attachments';
import {
  Doctor,
  LaboratoryOrder,
  LaboratoryResult,
  LaboratoryTest,
  MedicalAttachment,
  OrderStatus,
  Patient,
} from '../../types/database';
import {
  FlaskConical,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileUp,
  ExternalLink,
  RefreshCw,
  Printer,
  ShieldCheck,
  TestTube,
  X,
} from 'lucide-react';

type PatientOption = Pick<Patient, 'id' | 'mrn' | 'first_name_ar' | 'last_name_ar' | 'first_name_en' | 'last_name_en'>;
type DoctorOption = Pick<Doctor, 'id' | 'user_id' | 'specialty_title_ar' | 'specialty_title_en'> & {
  user?: { name_ar: string; name_en: string };
};

interface LabOrderWithDetails extends Omit<LaboratoryOrder, 'patient' | 'doctor'> {
  patient?: PatientOption;
  doctor?: DoctorOption;
  results?: LaboratoryResult[];
}

interface ResultDraft {
  result_value: string;
  unit: string;
  reference_range: string;
  is_abnormal: boolean;
  interpretation: string;
}

const LAB_CATEGORIES = [
  { id: 'Hematology', ar: 'أمراض الدم (CBC)', en: 'Hematology' },
  { id: 'Biochemistry', ar: 'الكيمياء الحيوية', en: 'Biochemistry' },
  { id: 'Endocrinology', ar: 'الهرمونات والغدد', en: 'Endocrinology' },
  { id: 'Immunology', ar: 'المناعة والفيروسات', en: 'Immunology' },
  { id: 'Microbiology', ar: 'الميكروبيولوجي والمزارع', en: 'Microbiology' },
  { id: 'Urine/Stool', ar: 'تحاليل البول والبراز', en: 'Urine / Stool' },
];

const generateLabOrderNumber = (): string => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `LAB-${d}-${rand}`;
};

export const Laboratory: React.FC = () => {
  const { user, organization, activeBranch, availableBranches, can } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error } = useToast();
  const ar = locale === 'ar';

  const orgId = organization?.id || '';
  const branchId = activeBranch?.id || '';
  const currency = organization?.default_currency || 'EGP';
  const role = user?.role || '';

  const canView = can('laboratory', 'view');
  const canOrder =
    can('laboratory', 'create') ||
    ['super_admin', 'org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor', 'lab_technician'].includes(role);
  const canProcess = ['super_admin', 'org_owner', 'general_manager', 'medical_director', 'branch_manager', 'lab_technician'].includes(role);
  const canCollectSample = canProcess || role === 'nurse';
  const canApprove = ['super_admin', 'org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'lab_technician'].includes(role);

  const [activeTab, setActiveTab] = useState<'orders' | 'catalog'>('orders');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tests, setTests] = useState<LaboratoryTest[]>([]);
  const [orders, setOrders] = useState<LabOrderWithDetails[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [attachments, setAttachments] = useState<MedicalAttachment[]>([]);

  // Selection & Filters
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [catalogSearch, setCatalogSearch] = useState('');

  // Result drafts keyed by result.id
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>({});
  const [uploadingFile, setUploadingFile] = useState(false);

  // Order Modal State
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderPatientId, setOrderPatientId] = useState('');
  const [orderDoctorId, setOrderDoctorId] = useState('');
  const [orderPriority, setOrderPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [orderIndication, setOrderIndication] = useState('');
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);

  // Test Catalog Modal State
  const [showTestModal, setShowTestModal] = useState(false);
  const [editingTest, setEditingTest] = useState<LaboratoryTest | null>(null);
  const [testCode, setTestCode] = useState('');
  const [testNameAr, setTestNameAr] = useState('');
  const [testNameEn, setTestNameEn] = useState('');
  const [testCategory, setTestCategory] = useState('Hematology');
  const [testSampleType, setTestSampleType] = useState('Venous Blood');
  const [testPrice, setTestPrice] = useState('0');
  const [testUnit, setTestUnit] = useState('');
  const [testRange, setTestRange] = useState('');

  const loadData = useCallback(async () => {
    if (!supabase || !orgId || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const branchIds = branchId ? [branchId] : availableBranches.map((b) => b.id);

      let ordersQuery = supabase
        .from('laboratory_orders')
        .select(
          '*, patient:patients(id,mrn,first_name_ar,last_name_ar,first_name_en,last_name_en), doctor:doctors(id,user_id,specialty_title_ar,specialty_title_en,user:users(name_ar,name_en)), results:laboratory_results(*, test:laboratory_tests(*))'
        )
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (branchId) ordersQuery = ordersQuery.eq('branch_id', branchId);

      const accessQuery = branchIds.length
        ? supabase.from('user_branch_access').select('user_id').eq('organization_id', orgId).in('branch_id', branchIds)
        : Promise.resolve({ data: [], error: null });

      const [testsRes, ordersRes, patientsRes, accessRes] = await Promise.all([
        supabase.from('laboratory_tests').select('*').eq('organization_id', orgId).order('category').order('name_ar'),
        ordersQuery,
        supabase
          .from('patients')
          .select('id,mrn,first_name_ar,last_name_ar,first_name_en,last_name_en')
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(200),
        accessQuery,
      ]);

      if (testsRes.error) throw testsRes.error;
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

      const fetchedOrders = (ordersRes.data || []) as unknown as LabOrderWithDetails[];
      setTests((testsRes.data || []) as LaboratoryTest[]);
      setOrders(fetchedOrders);
      setPatients((patientsRes.data || []) as PatientOption[]);
      const fetchedDoctors = (doctorsRes.data || []) as unknown as DoctorOption[];
      setDoctors(fetchedDoctors);

      if (patientsRes.data?.length && !orderPatientId) {
        setOrderPatientId(patientsRes.data[0].id);
      }
      const myDoctor = fetchedDoctors.find((d) => d.user_id === user?.id) || fetchedDoctors[0];
      if (myDoctor && !orderDoctorId) {
        setOrderDoctorId(myDoctor.id);
      }

      if (fetchedOrders.length && !fetchedOrders.some((o) => o.id === selectedOrderId)) {
        setSelectedOrderId(fetchedOrders[0].id);
      }
    } catch (err) {
      console.error('Laboratory load error:', err);
      error(ar ? 'تعذر تحميل بيانات المعمل والتحاليل.' : 'Unable to load laboratory data.');
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

  // Sync result drafts & load attachments whenever selected order changes
  useEffect(() => {
    if (!selectedOrder) {
      setResultDrafts({});
      setAttachments([]);
      return;
    }
    const drafts: Record<string, ResultDraft> = {};
    for (const res of selectedOrder.results || []) {
      drafts[res.id] = {
        result_value: res.result_value === 'PENDING' ? '' : res.result_value,
        unit: res.unit || res.test?.unit || '',
        reference_range: res.reference_range || res.test?.reference_range_text || '',
        is_abnormal: Boolean(res.is_abnormal),
        interpretation: res.interpretation || '',
      };
    }
    setResultDrafts(drafts);

    if (supabase && orgId) {
      supabase
        .from('medical_attachments')
        .select('*')
        .eq('organization_id', orgId)
        .eq('laboratory_order_id', selectedOrder.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setAttachments((data || []) as MedicalAttachment[]);
        });
    }
  }, [selectedOrder, orgId]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && order.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const patientName = `${order.patient?.first_name_ar || ''} ${order.patient?.last_name_ar || ''} ${order.patient?.first_name_en || ''} ${order.patient?.last_name_en || ''}`.toLowerCase();
        const mrn = (order.patient?.mrn || '').toLowerCase();
        if (!order.order_number.toLowerCase().includes(q) && !patientName.includes(q) && !mrn.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [orders, statusFilter, priorityFilter, searchQuery]);

  const filteredTests = useMemo(() => {
    if (!catalogSearch.trim()) return tests;
    const q = catalogSearch.toLowerCase();
    return tests.filter(
      (item) =>
        item.test_code.toLowerCase().includes(q) ||
        item.name_ar.toLowerCase().includes(q) ||
        item.name_en.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [tests, catalogSearch]);

  const stats = useMemo(() => {
    const requested = orders.filter((o) => o.status === 'requested').length;
    const inProgress = orders.filter((o) => o.status === 'sample_collected' || o.status === 'in_progress').length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    const abnormalCount = orders.reduce(
      (acc, o) => acc + (o.results || []).filter((r) => r.is_abnormal).length,
      0
    );
    return { total: orders.length, requested, inProgress, completed, abnormalCount };
  }, [orders]);

  const createLabOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !orgId || !branchId) {
      error(ar ? 'اختر فرعاً نشطاً قبل إنشاء الطلب.' : 'Select an active branch before creating a lab order.');
      return;
    }
    if (!orderPatientId || !orderDoctorId || selectedTestIds.length === 0) {
      error(ar ? 'اختر المريض والطبيب وتحليل واحد على الأقل.' : 'Select a patient, ordering doctor, and at least one test.');
      return;
    }
    setSaving(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('laboratory_orders')
        .insert({
          organization_id: orgId,
          branch_id: branchId,
          patient_id: orderPatientId,
          doctor_id: orderDoctorId,
          order_number: generateLabOrderNumber(),
          status: 'requested',
          priority: orderPriority,
          clinical_indication: orderIndication.trim() || null,
        })
        .select('*')
        .single();

      if (orderError || !orderData) throw orderError || new Error('Order insert failed');

      const resultRows = selectedTestIds.map((tid) => {
        const test = tests.find((x) => x.id === tid);
        return {
          organization_id: orgId,
          order_id: orderData.id,
          test_id: tid,
          result_value: 'PENDING',
          unit: test?.unit || null,
          reference_range: test?.reference_range_text || null,
          is_abnormal: false,
        };
      });

      const { error: resultsError } = await supabase.from('laboratory_results').insert(resultRows);
      if (resultsError) throw resultsError;

      success(ar ? 'تم إنشاء طلب التحليل وحفظه.' : 'Laboratory order created.');
      setShowOrderModal(false);
      setSelectedTestIds([]);
      setOrderIndication('');
      setSelectedOrderId(orderData.id);
      await loadData();
    } catch (err) {
      console.error('Create lab order error:', err);
      error(ar ? 'تعذر إنشاء طلب التحليل. تحقق من الصلاحيات.' : 'Failed to create laboratory order.');
    } finally {
      setSaving(false);
    }
  };

  const updateOrderStatus = async (order: LabOrderWithDetails, nextStatus: OrderStatus) => {
    if (!supabase || !orgId) return;
    setSaving(true);
    try {
      const { error: updError } = await supabase
        .from('laboratory_orders')
        .update({ status: nextStatus })
        .eq('id', order.id)
        .eq('organization_id', orgId);
      if (updError) throw updError;
      success(ar ? 'تم تحديث حالة الطلب.' : 'Order status updated.');
      await loadData();
    } catch (err) {
      console.error('Status update error:', err);
      error(ar ? 'تعذر تحديث حالة الطلب.' : 'Unable to update order status.');
    } finally {
      setSaving(false);
    }
  };

  const saveSingleResult = async (resRow: LaboratoryResult) => {
    if (!supabase || !orgId) return;
    const draft = resultDrafts[resRow.id];
    if (!draft || !draft.result_value.trim()) {
      error(ar ? 'أدخل قيمة النتيجة قبل الحفظ.' : 'Enter the result value before saving.');
      return;
    }
    setSaving(true);
    try {
      const { error: updError } = await supabase
        .from('laboratory_results')
        .update({
          result_value: draft.result_value.trim(),
          unit: draft.unit.trim() || null,
          reference_range: draft.reference_range.trim() || null,
          is_abnormal: draft.is_abnormal,
          interpretation: draft.interpretation.trim() || null,
        })
        .eq('id', resRow.id)
        .eq('organization_id', orgId);

      if (updError) throw updError;

      if (selectedOrder && (selectedOrder.status === 'requested' || selectedOrder.status === 'sample_collected')) {
        await supabase
          .from('laboratory_orders')
          .update({ status: 'in_progress' })
          .eq('id', selectedOrder.id)
          .eq('organization_id', orgId);
      }

      success(ar ? 'تم حفظ النتيجة.' : 'Result saved.');
      await loadData();
    } catch (err) {
      console.error('Save result error:', err);
      error(ar ? 'تعذر حفظ النتيجة. تأكد أن النتيجة غير معتمدة مسبقاً.' : 'Failed to save result.');
    } finally {
      setSaving(false);
    }
  };

  const approveAndCompleteOrder = async () => {
    if (!supabase || !orgId || !selectedOrder) return;
    const orderResults = selectedOrder.results || [];
    if (orderResults.length === 0) {
      error(ar ? 'لا توجد تحاليل مسجلة في هذا الطلب.' : 'No tests found in this order.');
      return;
    }

    for (const r of orderResults) {
      const draft = resultDrafts[r.id];
      const val = draft ? draft.result_value.trim() : r.result_value;
      if (!val || val === 'PENDING') {
        error(ar ? 'يجب إدخال وحفظ نتائج جميع التحاليل قبل الاعتماد النهائي.' : 'All test results must be entered before final approval.');
        return;
      }
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      for (const r of orderResults) {
        if (r.approved_at) continue;
        const draft = resultDrafts[r.id];
        const { error: updError } = await supabase
          .from('laboratory_results')
          .update({
            result_value: draft ? draft.result_value.trim() : r.result_value,
            unit: draft ? draft.unit.trim() || null : r.unit || null,
            reference_range: draft ? draft.reference_range.trim() || null : r.reference_range || null,
            is_abnormal: draft ? draft.is_abnormal : r.is_abnormal,
            interpretation: draft ? draft.interpretation.trim() || null : r.interpretation || null,
            approved_at: nowIso,
          })
          .eq('id', r.id)
          .eq('organization_id', orgId);
        if (updError) throw updError;
      }

      const { error: orderErr } = await supabase
        .from('laboratory_orders')
        .update({ status: 'completed' })
        .eq('id', selectedOrder.id)
        .eq('organization_id', orgId);
      if (orderErr) throw orderErr;

      success(ar ? 'تم اعتماد نتائج التحاليل وإتمام الطلب.' : 'Laboratory results approved and order completed.');
      await loadData();
    } catch (err) {
      console.error('Approve lab order error:', err);
      error(ar ? 'تعذر اعتماد النتائج.' : 'Could not approve results.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedOrder || !orgId) return;
    setUploadingFile(true);
    try {
      const uploaded = await uploadMedicalAttachment({
        organizationId: orgId,
        patientId: selectedOrder.patient_id,
        laboratoryOrderId: selectedOrder.id,
        file,
        description: `Lab attachment - ${selectedOrder.order_number}`,
      });
      setAttachments((prev) => [uploaded, ...prev]);
      success(ar ? 'تم رفع ملف النتيجة بأمان.' : 'Attachment uploaded securely.');
    } catch (err) {
      console.error('Upload lab attachment error:', err);
      error(ar ? 'تعذر رفع الملف. تأكد من الصيغة والحجم (حد أقصى 20 ميجابايت).' : 'Upload failed; check file type and 20 MB limit.');
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
      error(ar ? 'تعذر فتح الملف.' : 'Unable to generate secure download link.');
    }
  };

  const openTestModal = (item?: LaboratoryTest) => {
    if (item) {
      setEditingTest(item);
      setTestCode(item.test_code);
      setTestNameAr(item.name_ar);
      setTestNameEn(item.name_en);
      setTestCategory(item.category);
      setTestSampleType(item.sample_type);
      setTestPrice(String(item.price));
      setTestUnit(item.unit || '');
      setTestRange(item.reference_range_text || '');
    } else {
      setEditingTest(null);
      setTestCode('');
      setTestNameAr('');
      setTestNameEn('');
      setTestCategory('Hematology');
      setTestSampleType('Venous Blood');
      setTestPrice('0');
      setTestUnit('');
      setTestRange('');
    }
    setShowTestModal(true);
  };

  const saveLabTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !orgId || !testCode.trim() || !testNameAr.trim()) {
      error(ar ? 'أدخل كود التحليل واسمه بالعربية.' : 'Test code and Arabic name are required.');
      return;
    }
    const priceNum = Number(testPrice);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      error(ar ? 'السعر غير صالح.' : 'Invalid price.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        test_code: testCode.trim().toUpperCase(),
        name_ar: testNameAr.trim(),
        name_en: testNameEn.trim() || testNameAr.trim(),
        category: testCategory,
        sample_type: testSampleType.trim() || 'Venous Blood',
        price: priceNum,
        unit: testUnit.trim() || null,
        reference_range_text: testRange.trim() || null,
        is_active: true,
      };
      if (editingTest) {
        const { error: updErr } = await supabase
          .from('laboratory_tests')
          .update(payload)
          .eq('id', editingTest.id)
          .eq('organization_id', orgId);
        if (updErr) throw updErr;
        success(ar ? 'تم تحديث بيانات التحليل.' : 'Test updated.');
      } else {
        const { error: insErr } = await supabase.from('laboratory_tests').insert(payload);
        if (insErr) throw insErr;
        success(ar ? 'تمت إضافة التحليل للكتالوج.' : 'Test added to catalog.');
      }
      setShowTestModal(false);
      await loadData();
    } catch (err) {
      console.error('Save lab test error:', err);
      error(ar ? 'تعذر حفظ التحليل. تحقق من عدم تكرار الكود.' : 'Could not save test; check duplicate code or permissions.');
    } finally {
      setSaving(false);
    }
  };

  const toggleTestActive = async (item: LaboratoryTest) => {
    if (!supabase || !orgId) return;
    const { error: updErr } = await supabase
      .from('laboratory_tests')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
      .eq('organization_id', orgId);
    if (updErr) {
      error(ar ? 'تعذر تحديث حالة التحليل.' : 'Could not update test status.');
      return;
    }
    await loadData();
  };

  const printSelectedOrder = () => {
    window.print();
  };

  if (!canView) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center" dir={ar ? 'rtl' : 'ltr'}>
        <AlertTriangle className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-3 text-lg font-black text-slate-900">{t.nav.laboratory}</h1>
        <p className="mt-2 text-sm text-rose-900">
          {ar ? 'ليست لديك صلاحية عرض وحدة المعمل والتحاليل.' : 'You do not have permission to view the laboratory module.'}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <FlaskConical className="h-7 w-7 text-teal-600" />
            {t.nav.laboratory}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ar
              ? 'إدارة طلبات التحاليل، سحب العينات، إدخال واعتماد النتائج، وكتالوج الفحوصات المخبري.'
              : 'Manage lab orders, sample collection, verified results entry, and test catalog.'}
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
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              {ar ? 'طلب تحليل جديد' : 'New Lab Order'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">{ar ? 'إجمالي الطلبات' : 'Total Orders'}</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-800">{ar ? 'بانتظار العينة / قيد العمل' : 'Pending / In Progress'}</p>
          <p className="mt-1 text-2xl font-black text-amber-900">{stats.requested + stats.inProgress}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold text-emerald-800">{ar ? 'الطلبات المعتمدة' : 'Completed & Approved'}</p>
          <p className="mt-1 text-2xl font-black text-emerald-900">{stats.completed}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-semibold text-rose-800">{ar ? 'نتائج غير طبيعية' : 'Abnormal Flags'}</p>
          <p className="mt-1 text-2xl font-black text-rose-900">{stats.abnormalCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === 'orders' ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          {ar ? 'طلبات التحاليل والنتائج' : 'Lab Orders & Results'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === 'catalog' ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          {ar ? `كتالوج التحاليل (${tests.length})` : `Test Catalog (${tests.length})`}
        </button>
      </div>

      {activeTab === 'orders' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Orders List */}
          <div className="space-y-4 lg:col-span-5">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 h-4 w-4 text-slate-400 ltr:left-3 rtl:right-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={ar ? 'بحث برقم الطلب أو المريض أو MRN...' : 'Search order #, patient, MRN...'}
                  className="w-full rounded-xl border border-slate-200 py-2 text-sm focus:border-teal-500 focus:outline-none ltr:pl-9 ltr:pr-3 rtl:pl-3 rtl:pr-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  <option value="all">{ar ? 'كل الحالات' : 'All Statuses'}</option>
                  <option value="requested">{ar ? 'مطلوب' : 'Requested'}</option>
                  <option value="sample_collected">{ar ? 'تم سحب العينة' : 'Sample Collected'}</option>
                  <option value="in_progress">{ar ? 'قيد التحليل' : 'In Progress'}</option>
                  <option value="completed">{ar ? 'مكتمل ومعتمد' : 'Completed'}</option>
                  <option value="canceled">{ar ? 'ملغي' : 'Canceled'}</option>
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  <option value="all">{ar ? 'كل الأولويات' : 'All Priorities'}</option>
                  <option value="routine">{ar ? 'عادي' : 'Routine'}</option>
                  <option value="urgent">{ar ? 'عاجل' : 'Urgent'}</option>
                  <option value="stat">{ar ? 'طوارئ قصوى (STAT)' : 'STAT'}</option>
                </select>
              </div>
            </div>

            <div className="space-y-2.5">
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  {ar ? 'جاري تحميل الطلبات...' : 'Loading lab orders...'}
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  {ar ? 'لا توجد طلبات تحاليل مطابقة للبحث.' : 'No matching laboratory orders.'}
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const isSelected = order.id === selectedOrderId;
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
                        isSelected
                          ? 'border-teal-500 bg-teal-50/70 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-black text-teal-700">{order.order_number}</span>
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
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>MRN: {order.patient?.mrn || '-'}</span>
                        <span>
                          {ar ? `${order.results?.length || 0} تحاليل` : `${order.results?.length || 0} tests`} •{' '}
                          <strong className={order.priority === 'stat' ? 'text-rose-600' : ''}>{order.priority.toUpperCase()}</strong>
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Order Detail & Results Entry */}
          <div className="lg:col-span-7">
            {!selectedOrder ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
                <TestTube className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                {ar ? 'اختر طلب تحليل من القائمة لعرض النتائج وإدارتها.' : 'Select a lab order to inspect and enter results.'}
              </div>
            ) : (
              <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-teal-700">{selectedOrder.order_number}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                        {selectedOrder.priority.toUpperCase()}
                      </span>
                    </div>
                    <h2 className="mt-1 text-lg font-black text-slate-900">
                      {selectedOrder.patient
                        ? `${selectedOrder.patient.first_name_ar} ${selectedOrder.patient.last_name_ar} (${selectedOrder.patient.mrn})`
                        : '-'}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {ar ? 'الطبيب الطالب: ' : 'Ordering Doctor: '}
                      {selectedOrder.doctor?.user?.name_ar || selectedOrder.doctor?.user?.name_en || '-'}
                      {selectedOrder.clinical_indication ? ` • ${selectedOrder.clinical_indication}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 print:hidden">
                    {selectedOrder.status === 'requested' && canCollectSample && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void updateOrderStatus(selectedOrder, 'sample_collected')}
                        className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {ar ? 'تأكيد سحب العينة' : 'Mark Sample Collected'}
                      </button>
                    )}
                    {selectedOrder.status === 'sample_collected' && canProcess && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void updateOrderStatus(selectedOrder, 'in_progress')}
                        className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {ar ? 'بدء التشغيل المخبري' : 'Start Processing'}
                      </button>
                    )}
                    {selectedOrder.status !== 'completed' && selectedOrder.status !== 'canceled' && canProcess && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void updateOrderStatus(selectedOrder, 'canceled')}
                        className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {ar ? 'إلغاء' : 'Cancel'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={printSelectedOrder}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {ar ? 'طباعة' : 'Print'}
                    </button>
                  </div>
                </div>

                {/* Results Table */}
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-slate-800">
                    {ar ? 'نتائج التحاليل المطلوبة' : 'Requested Tests & Results'}
                  </h3>
                  {(selectedOrder.results || []).map((res) => {
                    const draft = resultDrafts[res.id] || {
                      result_value: '',
                      unit: res.unit || '',
                      reference_range: res.reference_range || '',
                      is_abnormal: false,
                      interpretation: '',
                    };
                    const isLocked = Boolean(res.approved_at) || selectedOrder.status === 'canceled';
                    return (
                      <div
                        key={res.id}
                        className={`rounded-xl border p-4 ${
                          res.approved_at ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-bold text-teal-700">{res.test?.test_code || '-'}</span>
                            <h4 className="text-sm font-bold text-slate-900">
                              {ar ? res.test?.name_ar : res.test?.name_en || res.test?.name_ar}
                            </h4>
                          </div>
                          {res.approved_at ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {ar ? 'معتمد' : 'Approved'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                              <Clock className="h-3.5 w-3.5" />
                              {res.result_value === 'PENDING' ? (ar ? 'بانتظار الإدخال' : 'Pending') : ar ? 'مسودة محفوظة' : 'Draft Saved'}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600">{ar ? 'النتيجة' : 'Result Value'}</label>
                            <input
                              type="text"
                              disabled={isLocked || !canProcess}
                              value={draft.result_value}
                              onChange={(e) =>
                                setResultDrafts((prev) => ({
                                  ...prev,
                                  [res.id]: { ...draft, result_value: e.target.value },
                                }))
                              }
                              placeholder={ar ? 'أدخل النتيجة...' : 'Enter value...'}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm disabled:bg-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600">{ar ? 'الوحدة' : 'Unit'}</label>
                            <input
                              type="text"
                              disabled={isLocked || !canProcess}
                              value={draft.unit}
                              onChange={(e) =>
                                setResultDrafts((prev) => ({
                                  ...prev,
                                  [res.id]: { ...draft, unit: e.target.value },
                                }))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm disabled:bg-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600">{ar ? 'المعدل الطبيعي' : 'Reference Range'}</label>
                            <input
                              type="text"
                              disabled={isLocked || !canProcess}
                              value={draft.reference_range}
                              onChange={(e) =>
                                setResultDrafts((prev) => ({
                                  ...prev,
                                  [res.id]: { ...draft, reference_range: e.target.value },
                                }))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm disabled:bg-slate-100"
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <label className="inline-flex items-center gap-2 text-xs font-bold text-rose-700">
                            <input
                              type="checkbox"
                              disabled={isLocked || !canProcess}
                              checked={draft.is_abnormal}
                              onChange={(e) =>
                                setResultDrafts((prev) => ({
                                  ...prev,
                                  [res.id]: { ...draft, is_abnormal: e.target.checked },
                                }))
                              }
                              className="rounded border-slate-300 text-rose-600"
                            />
                            {ar ? 'نتيجة غير طبيعية (Abnormal / Flag)' : 'Abnormal Flag'}
                          </label>
                          <input
                            type="text"
                            disabled={isLocked || !canProcess}
                            value={draft.interpretation}
                            onChange={(e) =>
                              setResultDrafts((prev) => ({
                                ...prev,
                                [res.id]: { ...draft, interpretation: e.target.value },
                              }))
                            }
                            placeholder={ar ? 'ملاحظات الطبيب / التفسير...' : 'Interpretation / notes...'}
                            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs disabled:bg-slate-100"
                          />
                          {!isLocked && canProcess && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void saveSingleResult(res)}
                              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50 print:hidden"
                            >
                              {ar ? 'حفظ النتيجة' : 'Save Result'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedOrder.status !== 'completed' && selectedOrder.status !== 'canceled' && canApprove && (
                  <div className="flex justify-end border-t border-slate-100 pt-4 print:hidden">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void approveAndCompleteOrder()}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {ar ? 'اعتماد كل النتائج وإغلاق الطلب' : 'Approve Results & Complete Order'}
                    </button>
                  </div>
                )}

                {/* Secure Private Attachments */}
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-800">
                      {ar ? 'مرفقات وتقارير PDF المرفوعة' : 'Secure Lab PDF / Scan Attachments'}
                    </h3>
                    {canProcess && (
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 print:hidden">
                        <FileUp className="h-3.5 w-3.5" />
                        {uploadingFile ? (ar ? 'جاري الرفع...' : 'Uploading...') : ar ? 'رفع ملف نتيجة' : 'Upload Attachment'}
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          disabled={uploadingFile}
                          onChange={handleUploadAttachment}
                        />
                      </label>
                    )}
                  </div>
                  {attachments.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      {ar ? 'لا توجد ملفات مرفقة لهذا الطلب.' : 'No attachments uploaded for this order.'}
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
                              {(att.file_size_bytes / 1024).toFixed(0)} KB
                            </p>
                          </div>
                          <ExternalLink className="h-4 w-4 shrink-0 text-teal-600" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Catalog Tab */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute top-2.5 h-4 w-4 text-slate-400 ltr:left-3 rtl:right-3" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder={ar ? 'بحث في التحاليل بالكود أو الاسم...' : 'Search tests by code or name...'}
                className="w-full rounded-xl border border-slate-200 py-2 text-sm focus:border-teal-500 focus:outline-none ltr:pl-9 ltr:pr-3 rtl:pl-3 rtl:pr-9"
              />
            </div>
            {canProcess && (
              <button
                type="button"
                onClick={() => openTestModal()}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700"
              >
                <Plus className="h-4 w-4" />
                {ar ? 'إضافة تحليل للكتالوج' : 'Add Lab Test'}
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-start">{ar ? 'الكود' : 'Code'}</th>
                  <th className="px-4 py-3 text-start">{ar ? 'اسم التحليل' : 'Test Name'}</th>
                  <th className="px-4 py-3 text-start">{ar ? 'التصنيف' : 'Category'}</th>
                  <th className="px-4 py-3 text-start">{ar ? 'العينة' : 'Sample'}</th>
                  <th className="px-4 py-3 text-start">{ar ? 'المرجع والوحدة' : 'Reference & Unit'}</th>
                  <th className="px-4 py-3 text-start">{ar ? 'السعر' : 'Price'}</th>
                  <th className="px-4 py-3 text-start">{ar ? 'الحالة' : 'Status'}</th>
                  {canProcess && <th className="px-4 py-3 text-end">{ar ? 'إجراء' : 'Action'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      {ar ? 'لا توجد تحاليل مسجلة في الكتالوج بعد.' : 'No tests defined in catalog yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredTests.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-teal-700">{item.test_code}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {ar ? item.name_ar : item.name_en}
                        <span className="block text-xs font-normal text-slate-400">{ar ? item.name_en : item.name_ar}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.category}</td>
                      <td className="px-4 py-3 text-slate-600">{item.sample_type}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {item.reference_range_text || '-'} {item.unit ? `(${item.unit})` : ''}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {Number(item.price).toFixed(2)} {currency}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            item.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {item.is_active ? (ar ? 'نشط' : 'Active') : ar ? 'معطل' : 'Inactive'}
                        </span>
                      </td>
                      {canProcess && (
                        <td className="px-4 py-3 text-end">
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => openTestModal(item)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                            >
                              {ar ? 'تعديل' : 'Edit'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleTestActive(item)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                              {item.is_active ? (ar ? 'إيقاف' : 'Disable') : ar ? 'تفعيل' : 'Enable'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={createLabOrder}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">{ar ? 'إنشاء طلب تحليل جديد' : 'Create Laboratory Order'}</h3>
              <button type="button" onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'الأولوية' : 'Priority'}</label>
                  <select
                    value={orderPriority}
                    onChange={(e) => setOrderPriority(e.target.value as 'routine' | 'urgent' | 'stat')}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="routine">{ar ? 'عادي (Routine)' : 'Routine'}</option>
                    <option value="urgent">{ar ? 'عاجل (Urgent)' : 'Urgent'}</option>
                    <option value="stat">{ar ? 'طوارئ (STAT)' : 'STAT'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'الداعي السريري' : 'Clinical Indication'}</label>
                  <input
                    type="text"
                    value={orderIndication}
                    onChange={(e) => setOrderIndication(e.target.value)}
                    placeholder={ar ? 'مثال: متابعة سكر أو التهاب حاد...' : 'e.g. Fever workup...'}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {ar ? 'اختر التحاليل المطلوبة من الكتالوج' : 'Select Laboratory Tests'}
                </label>
                {tests.filter((item) => item.is_active).length === 0 ? (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    {ar
                      ? 'لا توجد تحاليل نشطة في الكتالوج. أضف التحاليل أولاً من تبويب كتالوج التحاليل.'
                      : 'No active tests in catalog. Add tests in the Catalog tab first.'}
                  </p>
                ) : (
                  <div className="mt-2 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                    {tests
                      .filter((item) => item.is_active)
                      .map((test) => {
                        const checked = selectedTestIds.includes(test.id);
                        return (
                          <label
                            key={test.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                              checked ? 'border-teal-500 bg-teal-50' : 'border-slate-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedTestIds((prev) =>
                                  e.target.checked ? [...prev, test.id] : prev.filter((id) => id !== test.id)
                                )
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-slate-900">
                                {test.test_code} — {ar ? test.name_ar : test.name_en}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {Number(test.price).toFixed(2)} {currency}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                )}
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
                disabled={saving || selectedTestIds.length === 0}
                className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? (ar ? 'جاري الحفظ...' : 'Saving...') : ar ? 'تأكيد الطلب' : 'Submit Order'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Test Catalog Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={saveLabTest} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">
                {editingTest ? (ar ? 'تعديل تحليل مخبري' : 'Edit Lab Test') : ar ? 'إضافة تحليل جديد' : 'Add Lab Test'}
              </h3>
              <button type="button" onClick={() => setShowTestModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'كود التحليل' : 'Test Code'}</label>
                  <input
                    required
                    type="text"
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value)}
                    placeholder="CBC, HBA1C..."
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'التصنيف' : 'Category'}</label>
                  <select
                    value={testCategory}
                    onChange={(e) => setTestCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {LAB_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {ar ? c.ar : c.en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'الاسم بالعربية' : 'Arabic Name'}</label>
                  <input
                    required
                    type="text"
                    value={testNameAr}
                    onChange={(e) => setTestNameAr(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'الاسم بالإنجليزية' : 'English Name'}</label>
                  <input
                    type="text"
                    value={testNameEn}
                    onChange={(e) => setTestNameEn(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'نوع العينة' : 'Sample Type'}</label>
                  <input
                    type="text"
                    value={testSampleType}
                    onChange={(e) => setTestSampleType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'السعر' : 'Price'}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={testPrice}
                    onChange={(e) => setTestPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'وحدة القياس' : 'Unit'}</label>
                  <input
                    type="text"
                    value={testUnit}
                    onChange={(e) => setTestUnit(e.target.value)}
                    placeholder="mg/dL, %, 10^9/L"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'النطاق المرجعي' : 'Reference Range'}</label>
                  <input
                    type="text"
                    value={testRange}
                    onChange={(e) => setTestRange(e.target.value)}
                    placeholder="70 - 110"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
              >
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? (ar ? 'جاري الحفظ...' : 'Saving...') : ar ? 'حفظ' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
