// ============================================================================
// MEDICORE – Insurance Providers, Corporate Contracts & Claims Management
// Full Revenue Cycle Integration: Coverage Tiers, Co-Payments & Settlements
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { InsuranceCompany, InsuranceContract, InsuranceClaim } from '../../types/database';
import {
  ShieldCheck, Building2, FileText, Plus, CheckCircle2, XCircle,
  AlertTriangle, Clock, DollarSign, Phone, Mail, Search, Filter,
  Check, RefreshCw
} from 'lucide-react';

interface PatientOption {
  id: string;
  mrn: string;
  first_name_ar: string;
  last_name_ar: string;
  insurance_company_id?: string;
  insurance_coverage_percent?: number;
  insurance_card_number?: string;
}

interface InvoiceOption {
  id: string;
  invoice_number: string;
  patient_id: string;
  total_amount: number;
  balance_due: number;
  issue_date: string;
}

export const Insurance: React.FC = () => {
  const { organization, activeBranch, can } = useAuth();
  const { locale } = useLanguage();
  const { success, error } = useToast();
  const ar = locale === 'ar';

  const orgId = organization?.id || '';
  const currency = organization?.default_currency || 'EGP';
  const canCreate = can('insurance', 'create');
  const canApprove = can('insurance', 'approve') || can('insurance', 'edit');

  const [activeTab, setActiveTab] = useState<'claims' | 'providers' | 'contracts'>('claims');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [contracts, setContracts] = useState<InsuranceContract[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);

  // Filters
  const [claimStatusFilter, setClaimStatusFilter] = useState<string>('all');
  const [claimCompanyFilter, setClaimCompanyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [reviewClaim, setReviewClaim] = useState<InsuranceClaim | null>(null);

  // Provider Form
  const [provNameAr, setProvNameAr] = useState('');
  const [provNameEn, setProvNameEn] = useState('');
  const [provContact, setProvContact] = useState('');
  const [provPhone, setProvPhone] = useState('');
  const [provEmail, setProvEmail] = useState('');
  const [provTaxId, setProvTaxId] = useState('');
  const [provDiscount, setProvDiscount] = useState('0');

  // Contract Form
  const [contCompanyId, setContCompanyId] = useState('');
  const [contCode, setContCode] = useState('');
  const [contPlanAr, setContPlanAr] = useState('');
  const [contPlanEn, setContPlanEn] = useState('');
  const [contCoverage, setContCoverage] = useState('80');
  const [contAnnualLimit, setContAnnualLimit] = useState('50000');
  const [contPreApprovalAbove, setContPreApprovalAbove] = useState('1500');
  const [contValidFrom, setContValidFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [contValidTo, setContValidTo] = useState('');

  // Claim Form
  const [claimPatientId, setClaimPatientId] = useState('');
  const [claimCompanyId, setClaimCompanyId] = useState('');
  const [claimInvoiceId, setClaimInvoiceId] = useState('');
  const [claimAmount, setClaimAmount] = useState('0');
  const [claimCoPay, setClaimCoPay] = useState('0');
  const [claimPreApproval, setClaimPreApproval] = useState('');
  const [claimNotes, setClaimNotes] = useState('');

  // Review Claim Form
  const [reviewStatus, setReviewStatus] = useState<InsuranceClaim['status']>('approved');
  const [reviewApprovedAmt, setReviewApprovedAmt] = useState('0');
  const [reviewRejectedAmt, setReviewRejectedAmt] = useState('0');
  const [reviewReason, setReviewReason] = useState('');

  const loadData = useCallback(async () => {
    if (!supabase || !orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [compRes, contRes, claimRes, patRes, invRes] = await Promise.all([
        supabase
          .from('insurance_companies')
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false }),
        supabase
          .from('insurance_contracts')
          .select('*, insurance_company:insurance_companies(id, name_ar, name_en)')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false }),
        supabase
          .from('insurance_claims')
          .select('*, insurance_company:insurance_companies(id, name_ar, name_en), patient:patients(id, mrn, first_name_ar, last_name_ar), invoice:invoices(invoice_number, total_amount)')
          .eq('organization_id', orgId)
          .order('submission_date', { ascending: false }),
        supabase
          .from('patients')
          .select('id, mrn, first_name_ar, last_name_ar, insurance_company_id, insurance_coverage_percent, insurance_card_number')
          .eq('organization_id', orgId)
          .eq('is_active', true),
        supabase
          .from('invoices')
          .select('id, invoice_number, patient_id, total_amount, balance_due, issue_date')
          .eq('organization_id', orgId)
          .order('issue_date', { ascending: false })
          .limit(100),
      ]);

      const loadError = compRes.error || contRes.error || claimRes.error || patRes.error || invRes.error;
      if (loadError) throw loadError;
      setCompanies((compRes.data || []) as InsuranceCompany[]);
      setContracts((contRes.data || []) as unknown as InsuranceContract[]);
      setClaims((claimRes.data || []) as unknown as InsuranceClaim[]);
      setPatients((patRes.data || []) as PatientOption[]);
      setInvoices((invRes.data || []) as InvoiceOption[]);
    } catch (err) {
      console.error('Insurance load failed:', err);
      error(ar ? 'تعذر تحميل بيانات التأمين الطبي.' : 'Unable to load insurance records.');
    } finally {
      setLoading(false);
    }
  }, [orgId, ar, error]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handlers
  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !provNameAr.trim()) return;
    setSaving(true);
    const { error: insertErr } = await supabase.from('insurance_companies').insert({
      organization_id: orgId,
      name_ar: provNameAr.trim(),
      name_en: provNameEn.trim() || provNameAr.trim(),
      contact_person: provContact.trim() || null,
      phone: provPhone.trim() || null,
      email: provEmail.trim() || null,
      tax_id: provTaxId.trim() || null,
      default_discount_percent: Number(provDiscount) || 0,
      is_active: true,
    });
    setSaving(false);

    if (insertErr) {
      error(ar ? 'تعذر حفظ شركة التأمين.' : 'Could not save insurance provider.');
      return;
    }

    success(ar ? 'تمت إضافة شركة التأمين بنجاح' : 'Insurance provider added successfully');
    setShowProviderModal(false);
    setProvNameAr(''); setProvNameEn(''); setProvContact(''); setProvPhone(''); setProvEmail(''); setProvTaxId(''); setProvDiscount('0');
    await loadData();
  };

  const handleToggleProvider = async (company: InsuranceCompany) => {
    if (!supabase || !canApprove) return;
    const { error: updErr } = await supabase
      .from('insurance_companies')
      .update({ is_active: !company.is_active })
      .eq('id', company.id)
      .eq('organization_id', orgId);

    if (updErr) {
      error(ar ? 'تعذر تحديث حالة الشركة.' : 'Could not update provider status.');
      return;
    }
    await loadData();
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !contCompanyId || !contCode.trim() || !contPlanAr.trim()) return;
    const cov = Math.min(100, Math.max(0, Number(contCoverage) || 0));
    const copay = Number((100 - cov).toFixed(2));
    setSaving(true);
    const { error: insertErr } = await supabase.from('insurance_contracts').insert({
      organization_id: orgId,
      insurance_company_id: contCompanyId,
      contract_code: contCode.trim().toUpperCase(),
      plan_name_ar: contPlanAr.trim(),
      plan_name_en: contPlanEn.trim() || contPlanAr.trim(),
      coverage_percent: cov,
      co_payment_percent: copay,
      annual_limit: Number(contAnnualLimit) || 50000,
      requires_pre_approval_above: Number(contPreApprovalAbove) || 0,
      valid_from: contValidFrom,
      valid_to: contValidTo || null,
      is_active: true,
    });
    setSaving(false);

    if (insertErr) {
      error(insertErr.code === '23505'
        ? (ar ? 'كود العقد مسجل مسبقاً لهذه المنشأة.' : 'Contract code already exists.')
        : (ar ? 'تعذر حفظ العقد التأميني.' : 'Could not save insurance contract.'));
      return;
    }

    success(ar ? 'تم اعتماد العقد وفئة التغطية بنجاح' : 'Insurance contract saved');
    setShowContractModal(false);
    setContCode(''); setContPlanAr(''); setContPlanEn('');
    await loadData();
  };

  const handleSelectClaimInvoice = (invId: string) => {
    setClaimInvoiceId(invId);
    const inv = invoices.find(i => i.id === invId);
    const pat = patients.find(p => p.id === (inv?.patient_id || claimPatientId));
    if (inv) {
      const cov = pat?.insurance_coverage_percent ? Number(pat.insurance_coverage_percent) : 80;
      const claimed = Number(((inv.total_amount * cov) / 100).toFixed(2));
      const copay = Number((inv.total_amount - claimed).toFixed(2));
      setClaimAmount(String(claimed));
      setClaimCoPay(String(copay));
      if (pat && !claimPatientId) setClaimPatientId(pat.id);
      if (pat?.insurance_company_id && !claimCompanyId) setClaimCompanyId(pat.insurance_company_id);
    }
  };

  const handleSelectClaimPatient = (patId: string) => {
    setClaimPatientId(patId);
    const pat = patients.find(p => p.id === patId);
    if (pat?.insurance_company_id) {
      setClaimCompanyId(pat.insurance_company_id);
    }
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !activeBranch?.id || !claimCompanyId || !claimInvoiceId || !claimPatientId) {
      error(ar ? 'يرجى تحديد المريض، شركة التأمين، الفاتورة، والفرع النشط.' : 'Select patient, provider, invoice, and active branch.');
      return;
    }
    const claimed = Number(claimAmount) || 0;
    const copay = Number(claimCoPay) || 0;
    if (claimed <= 0) {
      error(ar ? 'قيمة المطالبة يجب أن تكون أكبر من صفر.' : 'Claimed amount must be greater than zero.');
      return;
    }

    setSaving(true);
    const claimNumber = `CLM-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const { error: insertErr } = await supabase.from('insurance_claims').insert({
      organization_id: orgId,
      branch_id: activeBranch.id,
      insurance_company_id: claimCompanyId,
      invoice_id: claimInvoiceId,
      patient_id: claimPatientId,
      claim_number: claimNumber,
      claimed_amount: claimed,
      approved_amount: 0,
      rejected_amount: 0,
      co_payment_amount: copay,
      status: 'submitted',
      pre_approval_code: claimPreApproval.trim() || null,
      notes: claimNotes.trim() || null,
      submission_date: new Date().toISOString().split('T')[0],
    });
    setSaving(false);

    if (insertErr) {
      error(ar ? 'تعذر إرسال المطالبة التأمينية.' : 'Could not submit insurance claim.');
      return;
    }

    success(ar ? `تم رفع المطالبة برقم ${claimNumber}` : `Claim ${claimNumber} submitted`);
    setShowClaimModal(false);
    setClaimInvoiceId(''); setClaimPreApproval(''); setClaimNotes('');
    await loadData();
  };

  const openReviewModal = (claim: InsuranceClaim) => {
    setReviewClaim(claim);
    setReviewStatus(claim.status === 'submitted' ? 'approved' : claim.status);
    setReviewApprovedAmt(String(claim.approved_amount || claim.claimed_amount));
    setReviewRejectedAmt(String(claim.rejected_amount || 0));
    setReviewReason(claim.rejection_reason || '');
  };

  const handleUpdateClaimStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !reviewClaim) return;

    const approved = reviewStatus === 'rejected' ? 0 : (Number(reviewApprovedAmt) || 0);
    const rejected = reviewStatus === 'approved' || reviewStatus === 'partially_approved' || reviewStatus === 'paid'
      ? Math.max(0, reviewClaim.claimed_amount - approved)
      : (Number(reviewRejectedAmt) || 0);

    if (approved < 0 || rejected < 0 || approved + rejected > reviewClaim.claimed_amount) {
      error(ar ? 'مجموع المبلغ الموافق عليه والمرفوض لا يمكن أن يتجاوز قيمة المطالبة.' : 'Approved and rejected amounts cannot exceed the claimed amount.');
      return;
    }
    if (reviewStatus === 'approved' && approved !== reviewClaim.claimed_amount) {
      error(ar ? 'الموافقة الكاملة يجب أن تساوي قيمة المطالبة؛ استخدم الموافقة الجزئية عند الحاجة.' : 'A fully approved claim must equal the claimed amount; choose partial approval otherwise.');
      return;
    }
    if (reviewStatus === 'partially_approved' && (approved <= 0 || approved >= reviewClaim.claimed_amount)) {
      error(ar ? 'الموافقة الجزئية يجب أن تكون أكبر من صفر وأقل من قيمة المطالبة.' : 'Partial approval must be greater than zero and less than the claimed amount.');
      return;
    }
    if (reviewStatus === 'rejected' && rejected !== reviewClaim.claimed_amount) {
      error(ar ? 'المطالبة المرفوضة يجب تسجيل كامل قيمتها كمبلغ مرفوض.' : 'A rejected claim must record its full amount as rejected.');
      return;
    }
    if (reviewStatus === 'paid' && approved <= 0) {
      error(ar ? 'لا يمكن تسوية مطالبة بدون مبلغ موافق عليه.' : 'A claim cannot be settled without an approved amount.');
      return;
    }

    setSaving(true);
    const { error: updErr } = await supabase
      .from('insurance_claims')
      .update({
        status: reviewStatus,
        approved_amount: approved,
        rejected_amount: rejected,
        rejection_reason: reviewReason.trim() || null,
        settlement_date: reviewStatus === 'paid' ? new Date().toISOString().split('T')[0] : null,
      })
      .eq('id', reviewClaim.id)
      .eq('organization_id', orgId);
    setSaving(false);

    if (updErr) {
      error(ar ? 'تعذر تحديث حالة المطالبة.' : 'Could not update claim status.');
      return;
    }

    success(ar ? 'تم تحديث تسوية المطالبة بنجاح' : 'Claim settlement updated');
    setReviewClaim(null);
    await loadData();
  };

  if (!organization) return null;

  // Metrics
  const activeProvidersCount = companies.filter(c => c.is_active).length;
  const totalClaimed = claims.reduce((sum, c) => sum + Number(c.claimed_amount || 0), 0);
  const totalSettled = claims
    .filter(c => c.status === 'approved' || c.status === 'partially_approved' || c.status === 'paid')
    .reduce((sum, c) => sum + Number(c.approved_amount || 0), 0);
  const pendingClaimsCount = claims.filter(c => c.status === 'submitted').length;

  const filteredClaims = claims.filter(c => {
    if (claimStatusFilter !== 'all' && c.status !== claimStatusFilter) return false;
    if (claimCompanyFilter !== 'all' && c.insurance_company_id !== claimCompanyFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const patName = `${c.patient?.first_name_ar || ''} ${c.patient?.last_name_ar || ''}`.toLowerCase();
      if (!c.claim_number.toLowerCase().includes(q) && !patName.includes(q) && !(c.patient?.mrn || '').toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const patientInvoices = claimPatientId
    ? invoices.filter(i => i.patient_id === claimPatientId)
    : invoices;

  const statusBadge = (status: InsuranceClaim['status']) => {
    switch (status) {
      case 'submitted': return { bg: 'bg-sky-100 text-sky-800', label: ar ? 'مرفوعة للمراجعة' : 'Submitted' };
      case 'approved': return { bg: 'bg-emerald-100 text-emerald-800', label: ar ? 'معتمدة بالكامل' : 'Approved' };
      case 'partially_approved': return { bg: 'bg-amber-100 text-amber-800', label: ar ? 'موافقة جزئية' : 'Partial' };
      case 'rejected': return { bg: 'bg-rose-100 text-rose-800', label: ar ? 'مرفوضة' : 'Rejected' };
      case 'paid': return { bg: 'bg-teal-100 text-teal-800', label: ar ? 'تم التحصيل ✓' : 'Settled ✓' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-600" />
            <span>{ar ? 'إدارة التأمين الطبي والمطالبات' : 'Health Insurance & Claims'}</span>
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {ar
              ? 'شركات التأمين المتعاقدة، فئات التغطية ونسب التحمل، وتتبع تسوية المطالبات التأمينية'
              : 'Contracted insurance providers, corporate coverage tiers, co-payments, and claims settlement'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            title={ar ? 'تحديث البيانات' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canCreate && activeTab === 'providers' && (
            <button
              type="button"
              onClick={() => setShowProviderModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{ar ? 'إضافة شركة تأمين' : 'Add Provider'}</span>
            </button>
          )}
          {canCreate && activeTab === 'contracts' && (
            <button
              type="button"
              onClick={() => {
                if (companies.length > 0 && !contCompanyId) setContCompanyId(companies[0].id);
                setShowContractModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{ar ? 'إضافة عقد / فئة تغطية' : 'Add Contract'}</span>
            </button>
          )}
          {canCreate && activeTab === 'claims' && (
            <button
              type="button"
              onClick={() => setShowClaimModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-medicore-600 hover:bg-medicore-700 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{ar ? 'رفع مطالبة تأمينية' : 'Submit Claim'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{ar ? 'شركات التأمين النشطة' : 'Active Providers'}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{activeProvidersCount}</p>
            <p className="text-[11px] text-teal-600 font-bold mt-0.5">{contracts.length} {ar ? 'عقود وفئات تغطية' : 'Coverage Tiers'}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{ar ? 'إجمالي المطالبات المرفوعة' : 'Total Claimed'}</p>
            <p className="text-2xl font-black text-slate-900 font-mono mt-1">{totalClaimed.toLocaleString()}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{currency}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{ar ? 'المبالغ المعتمدة والمحصلة' : 'Approved & Settled'}</p>
            <p className="text-2xl font-black text-emerald-700 font-mono mt-1">{totalSettled.toLocaleString()}</p>
            <p className="text-[11px] text-emerald-600 font-bold mt-0.5">{currency}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{ar ? 'مطالبات قيد المراجعة' : 'Pending Review'}</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{pendingClaimsCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{ar ? 'بانتظار موافقة الشركة' : 'Awaiting approval'}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('claims')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'claims'
              ? 'bg-medicore-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{ar ? 'سجل المطالبات والتسويات' : 'Claims & Settlements'}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'claims' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {claims.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('providers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'providers'
              ? 'bg-teal-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>{ar ? 'شركات التأمين المتعاقدة' : 'Insurance Providers'}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'providers' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {companies.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('contracts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'contracts'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{ar ? 'العقود وفئات التغطية' : 'Contracts & Coverage'}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'contracts' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {contracts.length}
          </span>
        </button>
      </div>

      {/* TAB 1: CLAIMS */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={ar ? 'بحث برقم المطالبة أو اسم المريض أو MRN...' : 'Search claim #, patient or MRN...'}
                className="w-full ps-9 pe-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={claimCompanyFilter}
                onChange={e => setClaimCompanyFilter(e.target.value)}
                className="text-xs font-bold p-2 rounded-xl border border-slate-200 bg-slate-50"
              >
                <option value="all">{ar ? 'جميع الشركات' : 'All Providers'}</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{ar ? c.name_ar : c.name_en}</option>
                ))}
              </select>

              <select
                value={claimStatusFilter}
                onChange={e => setClaimStatusFilter(e.target.value)}
                className="text-xs font-bold p-2 rounded-xl border border-slate-200 bg-slate-50"
              >
                <option value="all">{ar ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="submitted">{ar ? 'مرفوعة للمراجعة' : 'Submitted'}</option>
                <option value="approved">{ar ? 'معتمدة بالكامل' : 'Approved'}</option>
                <option value="partially_approved">{ar ? 'موافقة جزئية' : 'Partial'}</option>
                <option value="rejected">{ar ? 'مرفوضة' : 'Rejected'}</option>
                <option value="paid">{ar ? 'تم التحصيل' : 'Paid'}</option>
              </select>
            </div>
          </div>

          {/* Claims Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 text-start">{ar ? 'رقم المطالبة' : 'Claim #'}</th>
                    <th className="p-3.5 text-start">{ar ? 'المريض' : 'Patient'}</th>
                    <th className="p-3.5 text-start">{ar ? 'شركة التأمين' : 'Provider'}</th>
                    <th className="p-3.5 text-center">{ar ? 'المطالبة' : 'Claimed'}</th>
                    <th className="p-3.5 text-center">{ar ? 'تحمل المريض' : 'Co-Pay'}</th>
                    <th className="p-3.5 text-center">{ar ? 'المعتمد' : 'Approved'}</th>
                    <th className="p-3.5 text-center">{ar ? 'الحالة' : 'Status'}</th>
                    <th className="p-3.5 text-center">{ar ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-400">
                        {ar ? 'جارٍ تحميل المطالبات...' : 'Loading claims...'}
                      </td>
                    </tr>
                  ) : filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-400">
                        {ar ? 'لا توجد مطالبات تأمينية مسجلة في هذا النطاق.' : 'No insurance claims found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredClaims.map(claim => {
                      const st = statusBadge(claim.status);
                      return (
                        <tr key={claim.id} className="hover:bg-slate-50/70">
                          <td className="p-3.5">
                            <span className="font-mono font-bold text-slate-900">{claim.claim_number}</span>
                            <div className="text-[10px] text-slate-400">{claim.submission_date}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-800">
                              {claim.patient ? `${claim.patient.first_name_ar} ${claim.patient.last_name_ar}` : '—'}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">{claim.patient?.mrn}</div>
                          </td>
                          <td className="p-3.5 font-semibold text-slate-700">
                            {claim.insurance_company ? (ar ? claim.insurance_company.name_ar : claim.insurance_company.name_en) : '—'}
                            {claim.pre_approval_code && (
                              <div className="text-[10px] font-mono text-teal-600">Auth: {claim.pre_approval_code}</div>
                            )}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-slate-900">
                            {Number(claim.claimed_amount).toLocaleString()} {currency}
                          </td>
                          <td className="p-3.5 text-center font-mono text-slate-600">
                            {Number(claim.co_payment_amount).toLocaleString()} {currency}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-emerald-700">
                            {Number(claim.approved_amount).toLocaleString()} {currency}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${st.bg}`}>
                              {st.label}
                            </span>
                            {claim.rejection_reason && (
                              <div className="text-[10px] text-rose-600 mt-1 max-w-[160px] truncate mx-auto" title={claim.rejection_reason}>
                                {claim.rejection_reason}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            {canApprove && claim.status !== 'paid' && (
                              <button
                                type="button"
                                onClick={() => openReviewModal(claim)}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold"
                              >
                                {ar ? 'مراجعة / تسوية' : 'Settle'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROVIDERS */}
      {activeTab === 'providers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              {ar ? 'لم يتم تسجيل شركات تأمين متعاقدة بعد.' : 'No insurance providers registered yet.'}
            </div>
          ) : (
            companies.map(comp => (
              <div key={comp.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">{ar ? comp.name_ar : comp.name_en}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{ar ? comp.name_en : comp.name_ar}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${comp.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    {comp.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'موقوف' : 'Inactive')}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  {comp.contact_person && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{ar ? 'مسؤول التعاقد:' : 'Contact:'}</span>
                      <span className="font-bold">{comp.contact_person}</span>
                    </div>
                  )}
                  {comp.phone && (
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{comp.phone}</span>
                    </div>
                  )}
                  {comp.email && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{comp.email}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-slate-500">{ar ? 'الخصم التعاقدي الافتراضي:' : 'Contract Discount:'}</span>
                    <span className="font-mono font-black text-teal-700">{comp.default_discount_percent}%</span>
                  </div>
                </div>

                {canApprove && (
                  <button
                    type="button"
                    onClick={() => void handleToggleProvider(comp)}
                    className="w-full py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
                  >
                    {comp.is_active ? (ar ? 'إيقاف التعامل مؤقتاً' : 'Suspend Provider') : (ar ? 'إعادة تفعيل التعامل' : 'Activate Provider')}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: CONTRACTS */}
      {activeTab === 'contracts' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5 text-start">{ar ? 'كود العقد' : 'Code'}</th>
                  <th className="p-3.5 text-start">{ar ? 'شركة التأمين' : 'Provider'}</th>
                  <th className="p-3.5 text-start">{ar ? 'الفئة / الباقة' : 'Plan Tier'}</th>
                  <th className="p-3.5 text-center">{ar ? 'التغطية' : 'Coverage'}</th>
                  <th className="p-3.5 text-center">{ar ? 'تحمل المريض' : 'Co-Pay'}</th>
                  <th className="p-3.5 text-center">{ar ? 'الحد السنوي' : 'Annual Limit'}</th>
                  <th className="p-3.5 text-center">{ar ? 'موافقة مسبقة فوق' : 'Pre-Auth Above'}</th>
                  <th className="p-3.5 text-center">{ar ? 'الصلاحية' : 'Validity'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400">
                      {ar ? 'لا توجد عقود وفئات تغطية مسجلة بعد.' : 'No corporate contracts registered yet.'}
                    </td>
                  </tr>
                ) : (
                  contracts.map(cont => (
                    <tr key={cont.id} className="hover:bg-slate-50/70">
                      <td className="p-3.5 font-mono font-bold text-indigo-700">{cont.contract_code}</td>
                      <td className="p-3.5 font-bold text-slate-800">
                        {cont.insurance_company ? (ar ? cont.insurance_company.name_ar : cont.insurance_company.name_en) : '—'}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-700">{ar ? cont.plan_name_ar : cont.plan_name_en}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-emerald-700">{cont.coverage_percent}%</td>
                      <td className="p-3.5 text-center font-mono font-bold text-amber-700">{cont.co_payment_percent}%</td>
                      <td className="p-3.5 text-center font-mono">{Number(cont.annual_limit).toLocaleString()} {currency}</td>
                      <td className="p-3.5 text-center font-mono">{Number(cont.requires_pre_approval_above || 0).toLocaleString()} {currency}</td>
                      <td className="p-3.5 text-center text-[11px] text-slate-500 font-mono">
                        {cont.valid_from} {cont.valid_to ? `→ ${cont.valid_to}` : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD PROVIDER */}
      {showProviderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-black text-slate-900 text-base mb-4">{ar ? 'إضافة شركة تأمين جديدة' : 'Add Insurance Provider'}</h3>
            <form onSubmit={handleCreateProvider} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'اسم الشركة بالعربية *' : 'Arabic Name *'}</label>
                  <input required value={provNameAr} onChange={e => setProvNameAr(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" placeholder="مثال: بوبا العربية / أكسا" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'اسم الشركة بالإنجليزية' : 'English Name'}</label>
                  <input value={provNameEn} onChange={e => setProvNameEn(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" placeholder="Bupa / AXA Healthcare" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'مسؤول التعاقد' : 'Contact Person'}</label>
                  <input value={provContact} onChange={e => setProvContact(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'رقم الهاتف' : 'Phone'}</label>
                  <input value={provPhone} onChange={e => setProvPhone(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'البريد الإلكتروني للمطالبات' : 'Claims Email'}</label>
                  <input type="email" value={provEmail} onChange={e => setProvEmail(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'نسبة الخصم %' : 'Discount %'}</label>
                  <input type="number" min="0" max="100" step="0.5" value={provDiscount} onChange={e => setProvDiscount(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{ar ? 'الرقم الضريبي' : 'Tax ID'}</label>
                <input value={provTaxId} onChange={e => setProvTaxId(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowProviderModal(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold">{saving ? '...' : (ar ? 'حفظ الشركة' : 'Save Provider')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CONTRACT */}
      {showContractModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-black text-slate-900 text-base mb-4">{ar ? 'إضافة عقد وفئة تغطية' : 'Add Contract Tier'}</h3>
            <form onSubmit={handleCreateContract} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{ar ? 'شركة التأمين *' : 'Provider *'}</label>
                <select required value={contCompanyId} onChange={e => setContCompanyId(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold">
                  <option value="">{ar ? '-- اختر الشركة --' : '-- Select Provider --'}</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{ar ? c.name_ar : c.name_en}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'كود العقد *' : 'Code *'}</label>
                  <input required value={contCode} onChange={e => setContCode(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" placeholder="VIP-2026" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'اسم الفئة بالعربية *' : 'Plan Name AR *'}</label>
                  <input required value={contPlanAr} onChange={e => setContPlanAr(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" placeholder="الفئة الذهبية (Class A)" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'نسبة التغطية %' : 'Coverage %'}</label>
                  <input type="number" min="0" max="100" required value={contCoverage} onChange={e => setContCoverage(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'الحد السنوي' : 'Annual Limit'}</label>
                  <input type="number" min="0" required value={contAnnualLimit} onChange={e => setContAnnualLimit(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'موافقة فوق' : 'Pre-Auth Above'}</label>
                  <input type="number" min="0" value={contPreApprovalAbove} onChange={e => setContPreApprovalAbove(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'ساري من *' : 'Valid From *'}</label>
                  <input type="date" required value={contValidFrom} onChange={e => setContValidFrom(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'ساري حتى' : 'Valid To'}</label>
                  <input type="date" value={contValidTo} onChange={e => setContValidTo(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowContractModal(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">{saving ? '...' : (ar ? 'حفظ العقد' : 'Save Contract')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT CLAIM */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-black text-slate-900 text-base mb-4">{ar ? 'رفع مطالبة تأمينية جديدة' : 'Submit Insurance Claim'}</h3>
            <form onSubmit={handleCreateClaim} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{ar ? 'المريض *' : 'Patient *'}</label>
                <select required value={claimPatientId} onChange={e => handleSelectClaimPatient(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold">
                  <option value="">{ar ? '-- اختر المريض --' : '-- Select Patient --'}</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.first_name_ar} {p.last_name_ar} ({p.mrn})</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{ar ? 'الفاتورة المرتبطة *' : 'Linked Invoice *'}</label>
                <select required value={claimInvoiceId} onChange={e => handleSelectClaimInvoice(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold">
                  <option value="">{ar ? '-- اختر الفاتورة --' : '-- Select Invoice --'}</option>
                  {patientInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {Number(inv.total_amount).toLocaleString()} {currency} ({inv.issue_date})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{ar ? 'شركة التأمين *' : 'Insurance Provider *'}</label>
                <select required value={claimCompanyId} onChange={e => setClaimCompanyId(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold">
                  <option value="">{ar ? '-- اختر الشركة --' : '-- Select Provider --'}</option>
                  {companies.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{ar ? c.name_ar : c.name_en}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'حصة شركة التأمين (المطالبة) *' : 'Claimed Amount *'}</label>
                  <input type="number" step="0.01" min="0.01" required value={claimAmount} onChange={e => setClaimAmount(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'نسبة تحمل المريض (Co-Pay)' : 'Patient Co-Pay'}</label>
                  <input type="number" step="0.01" min="0" value={claimCoPay} onChange={e => setClaimCoPay(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{ar ? 'كود الموافقة المسبقة (Pre-Auth Code)' : 'Pre-Authorization Code'}</label>
                <input value={claimPreApproval} onChange={e => setClaimPreApproval(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" placeholder="AUTH-2026-..." />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowClaimModal(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-medicore-600 hover:bg-medicore-700 text-white font-bold">{saving ? '...' : (ar ? 'رفع المطالبة' : 'Submit Claim')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SETTLE / REVIEW CLAIM */}
      {reviewClaim && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-black text-slate-900 text-base mb-1">{ar ? 'مراجعة وتسوية المطالبة' : 'Settle Insurance Claim'}</h3>
            <p className="text-xs font-mono text-slate-500 mb-4">{reviewClaim.claim_number} — {Number(reviewClaim.claimed_amount).toLocaleString()} {currency}</p>
            <form onSubmit={handleUpdateClaimStatus} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{ar ? 'قرار شركة التأمين' : 'Settlement Decision'}</label>
                <select value={reviewStatus} onChange={e => setReviewStatus(e.target.value as InsuranceClaim['status'])} className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold">
                  <option value="approved">{ar ? 'موافقة كاملة (Approved)' : 'Approved'}</option>
                  <option value="partially_approved">{ar ? 'موافقة جزئية (Partially Approved)' : 'Partially Approved'}</option>
                  <option value="rejected">{ar ? 'رفض المطالبة (Rejected)' : 'Rejected'}</option>
                  <option value="paid">{ar ? 'تم السداد والتحصيل (Paid / Settled)' : 'Paid / Settled'}</option>
                </select>
              </div>
              {reviewStatus !== 'rejected' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'المبلغ المعتمد / المحصل' : 'Approved Amount'}</label>
                  <input type="number" step="0.01" min="0" max={reviewClaim.claimed_amount} value={reviewApprovedAmt} onChange={e => setReviewApprovedAmt(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
              )}
              {(reviewStatus === 'rejected' || reviewStatus === 'partially_approved') && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'سبب الرفض أو الخصم' : 'Rejection / Deduction Reason'}</label>
                  <textarea rows={2} value={reviewReason} onChange={e => setReviewReason(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" placeholder={ar ? 'مثال: خدمة غير مغطاة أو نقص في الموافقة المسبقة...' : 'Reason...'} />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setReviewClaim(null)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>{ar ? 'حفظ التسوية' : 'Save Settlement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
