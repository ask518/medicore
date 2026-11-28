import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { formatQuotaErrorMessage } from '../../lib/facilityLabels';
import { PlanQuotaNotice } from '../../components/common/PlanQuotaNotice';
import { UploadCloud, Download, FileSpreadsheet, Info } from 'lucide-react';

type PatientRow = {
  first_name_ar: string;
  last_name_ar: string;
  phone: string;
  date_of_birth: string;
  gender: 'male' | 'female';
  blood_group?: string;
  national_id?: string;
  opening_balance?: number;
  balance_type?: 'legacy_debit' | 'legacy_credit';
  balance_note?: string;
  legacy_medical_note?: string;
};

const TEMPLATE_HEADERS = [
  'first_name_ar',
  'last_name_ar',
  'phone',
  'date_of_birth',
  'gender',
  'blood_group',
  'national_id',
  'opening_balance',
  'balance_type',
  'balance_note',
  'legacy_medical_note',
];

function csvRows(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const out: string[][] = []; let cells: string[] = []; let value = ''; let quoted = false;
  for (let i = 0; i < cleanText.length; i++) {
    const c = cleanText[i];
    if (c === '"' && quoted && cleanText[i + 1] === '"') { value += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { cells.push(value.trim()); value = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && cleanText[i + 1] === '\n') i++;
      cells.push(value.trim());
      if (cells.some(Boolean)) out.push(cells);
      cells = []; value = '';
    } else value += c;
  }
  cells.push(value.trim()); if (cells.some(Boolean)) out.push(cells); return out;
}

const escapeCsvCell = (value: string | number | null | undefined): string =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsvFile = (filename: string, matrix: (string | number | null | undefined)[][]) => {
  const csv = '\uFEFF' + matrix.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const DataMigration: React.FC = () => {
  const { user, organization, activeBranch, hasCustomPermission } = useAuth();
  const { locale } = useLanguage();
  const { success, error } = useToast();
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ar = locale === 'ar';

  const canManageBalances = hasCustomPermission('patient_balances_manage');
  const canEditClinical = ['super_admin', 'org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse'].includes(user?.role || '')
    || hasCustomPermission('clinical_manage');

  const downloadTemplate = () => {
    const sampleRows = [
      TEMPLATE_HEADERS,
      ['أحمد', 'محمود', '+201001122334', '1992-04-15', 'male', 'O+', '29204150101234', '1200', 'legacy_credit', 'باقة 6 جلسات علاج طبيعي', 'آلام أسفل الظهر L4-L5'],
      ['سارة', 'علي', '+201112233445', '1988-11-03', 'female', 'A+', '', '350', 'legacy_debit', 'رصيد متبقي من كشف سابق', ''],
    ];
    downloadCsvFile(`medicore-patients-template.csv`, sampleRows);
    success(ar ? 'تم تحميل الاسطمبة الجاهزة بصيغة CSV متوافقة مع Excel.' : 'CSV import template downloaded.');
  };

  const exportExistingPatients = async () => {
    if (!supabase || !organization) return;
    setExporting(true);
    const { data: pts, error: ptsErr } = await supabase
      .from('patients')
      .select('id,first_name_ar,last_name_ar,phone,date_of_birth,gender,blood_group,national_id')
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (ptsErr) {
      setExporting(false);
      error(ar ? 'تعذر تصدير بيانات المرضى الحاليين.' : 'Could not export existing patients.');
      return;
    }

    const patientRows = pts || [];
    const balMap = new Map<string, { net: number; note: string }>();
    if (patientRows.length > 0 && (canManageBalances || hasCustomPermission('billing_view'))) {
      const { data: balEntries } = await supabase
        .from('patient_balance_entries')
        .select('patient_id,entry_type,amount,description')
        .eq('organization_id', organization.id);
      const debitSum = new Map<string, number>();
      const creditSum = new Map<string, number>();
      const noteMap = new Map<string, string>();
      for (const b of (balEntries || []) as Array<{ patient_id: string; entry_type: string; amount: number; description: string }>) {
        if (b.entry_type === 'legacy_debit') debitSum.set(b.patient_id, (debitSum.get(b.patient_id) || 0) + Number(b.amount));
        if (b.entry_type === 'debit_payment') debitSum.set(b.patient_id, (debitSum.get(b.patient_id) || 0) - Number(b.amount));
        if (b.entry_type === 'legacy_credit') creditSum.set(b.patient_id, (creditSum.get(b.patient_id) || 0) + Number(b.amount));
        if (b.entry_type === 'credit_usage' || b.entry_type === 'credit_refund') creditSum.set(b.patient_id, (creditSum.get(b.patient_id) || 0) - Number(b.amount));
        if (!noteMap.has(b.patient_id) && b.description) noteMap.set(b.patient_id, b.description);
      }
      for (const p of patientRows) {
        const net = (debitSum.get(p.id) || 0) - (creditSum.get(p.id) || 0);
        if (net !== 0) {
          balMap.set(p.id, { net, note: noteMap.get(p.id) || '' });
        }
      }
    }

    const matrix = [
      TEMPLATE_HEADERS,
      ...patientRows.map(p => {
        const bal = balMap.get(p.id);
        return [
          p.first_name_ar,
          p.last_name_ar,
          p.phone,
          p.date_of_birth,
          p.gender,
          p.blood_group || 'unknown',
          p.national_id || '',
          bal ? Math.abs(bal.net).toFixed(2) : '',
          bal ? (bal.net > 0 ? 'legacy_debit' : 'legacy_credit') : '',
          bal?.note || '',
          '',
        ];
      }),
    ];
    downloadCsvFile(`medicore-patients-export-${organization.slug || 'clinic'}.csv`, matrix);
    setExporting(false);
    success(ar ? `تم تصدير ${patientRows.length} مريض بنجاح.` : `Exported ${patientRows.length} patient records.`);
  };

  const selectFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 5 * 1024 * 1024) { error(ar ? 'اختر CSV بحد أقصى 5 ميجابايت.' : 'Choose a CSV up to 5 MB.'); return; }
    const matrix = csvRows(await file.text());
    const headers = matrix.shift()?.map(x => x.replace(/^\uFEFF/, '').toLowerCase().trim()) || [];
    const required = ['first_name_ar', 'last_name_ar', 'phone', 'date_of_birth', 'gender'];
    if (required.some(x => !headers.includes(x))) { error(`${ar ? 'الأعمدة المطلوبة' : 'Required columns'}: ${required.join(', ')}`); return; }
    if (matrix.length > 1000) { error(ar ? 'الحد الأقصى 1000 سجل.' : 'Maximum 1,000 records.'); return; }
    const at = (key: string, row: string[]) => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? (row[idx] || '') : '';
    };
    const parsed: PatientRow[] = [];
    for (const row of matrix) {
      const gender = at('gender', row).toLowerCase();
      const dob = at('date_of_birth', row);
      const first = at('first_name_ar', row);
      const last = at('last_name_ar', row);
      const phone = at('phone', row);
      const date = new Date(`${dob}T00:00:00Z`);
      if (!first || !last || !phone || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dob || !['male', 'female'].includes(gender)) {
        error(ar ? 'صف غير صالح: راجع الأسماء والهاتف والتاريخ (YYYY-MM-DD) والنوع (male/female).' : 'Invalid row: check names, phone, date (YYYY-MM-DD), and gender (male/female).');
        return;
      }
      const rawBal = Number(at('opening_balance', row) || 0);
      const rawType = at('balance_type', row).toLowerCase();
      const bType: 'legacy_debit' | 'legacy_credit' = ['credit', 'legacy_credit', 'prepaid', 'له'].includes(rawType) ? 'legacy_credit' : 'legacy_debit';
      parsed.push({
        first_name_ar: first,
        last_name_ar: last,
        phone,
        date_of_birth: dob,
        gender: gender as 'male' | 'female',
        blood_group: at('blood_group', row) || undefined,
        national_id: at('national_id', row) || undefined,
        opening_balance: Number.isFinite(rawBal) && rawBal > 0 ? rawBal : undefined,
        balance_type: Number.isFinite(rawBal) && rawBal > 0 ? bType : undefined,
        balance_note: at('balance_note', row) || undefined,
        legacy_medical_note: at('legacy_medical_note', row) || undefined,
      });
    }
    setRows(parsed); setFileName(file.name); setMessage('');
  };

  const importRows = async () => {
    if (!supabase || !organization || rows.length === 0) return;
    setBusy(true);
    const phones = [...new Set(rows.map(r => r.phone))];
    const { data: found, error: duplicateError } = await supabase.from('patients').select('phone').eq('organization_id', organization.id).in('phone', phones);
    if (duplicateError) { setBusy(false); error(ar ? 'تعذر فحص التكرار.' : 'Could not check duplicates.'); return; }
    const existing = new Set((found || []).map(r => r.phone));
    const added = new Set<string>();
    const readyRows = rows.filter(r => { if (existing.has(r.phone) || added.has(r.phone)) return false; added.add(r.phone); return true; });
    const readyInsert = readyRows.map(r => ({
      first_name_ar: r.first_name_ar, last_name_ar: r.last_name_ar, phone: r.phone,
      date_of_birth: r.date_of_birth, gender: r.gender,
      blood_group: r.blood_group || 'unknown', national_id: r.national_id || null,
      organization_id: organization.id, primary_branch_id: activeBranch?.id || null,
      mrn: `MRN-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      is_active: true,
    }));
    const result = readyInsert.length
      ? await supabase.from('patients').insert(readyInsert).select('id,phone')
      : { data: [] as { id: string; phone: string }[], error: null };
    if (result.error) { setBusy(false); error(formatQuotaErrorMessage(result.error.message, ar) || (ar ? 'فشل الحفظ في قاعدة البيانات.' : 'Database insert failed.')); return; }
    const createdByPhone = new Map((result.data || []).map(p => [p.phone, p.id]));
    let skippedBalances = 0;
    let skippedNotes = 0;
    for (const r of readyRows) {
      const pid = createdByPhone.get(r.phone);
      if (!pid) continue;
      if (r.opening_balance && r.opening_balance > 0) {
        if (canManageBalances) {
          const { error: balErr } = await supabase.rpc('record_patient_balance_entry', {
            p_patient_id: pid,
            p_entry_type: r.balance_type || 'legacy_debit',
            p_amount: r.opening_balance,
            p_description: r.balance_note || (ar ? 'رصيد قديم مستورد من CSV' : 'Imported legacy balance from CSV'),
            p_entry_date: new Date().toISOString().slice(0, 10),
            p_payment_mode: null,
            p_cashbox_id: null,
            p_is_legacy: true,
            p_reference_no: null,
          });
          if (balErr) skippedBalances++;
        } else {
          skippedBalances++;
        }
      }
      if (r.legacy_medical_note) {
        if (canEditClinical) {
          const { error: mhErr } = await supabase.from('medical_histories').insert({
            organization_id: organization.id,
            patient_id: pid,
            condition_type: 'chronic_disease',
            condition_name: ar ? 'ملف طبي سابق (مستورد)' : 'Imported Legacy Summary',
            notes: r.legacy_medical_note,
            is_active: true,
          });
          if (mhErr) skippedNotes++;
        } else {
          skippedNotes++;
        }
      }
    }
    setBusy(false);
    const extraNotice = (skippedBalances > 0 || skippedNotes > 0)
      ? (ar ? ` (ملاحظة: تعذر حفظ ${skippedBalances} رصيد و ${skippedNotes} ملاحظة طبية لعدم كفاية الصلاحية)` : ` (${skippedBalances} balance / ${skippedNotes} clinical note skipped due to permissions)`)
      : '';
    const note = (ar
      ? `تم حفظ ${readyRows.length} مريض وتجاوز ${rows.length - readyRows.length} مكرر.`
      : `Saved ${readyRows.length} patients; skipped ${rows.length - readyRows.length} duplicates.`) + extraNotice;
    setMessage(note);
    success(note);
    setRows([]);
  };

  if (!organization) return null;
  return (
    <main className="mx-auto max-w-4xl space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <UploadCloud className="h-6 w-6 text-medicore-600" />
            {ar ? 'استيراد وتصدير ملفات المرضى (CSV / Excel)' : 'Import & Export Patient Records (CSV / Excel)'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {ar
              ? 'حمّل الاسطمبة الجاهزة أو صدّر ملفات المرضى الحاليين أولاً لتعبئة البيانات بالترتيب الصحيح بدون لخبطة.'
              : 'Download the ready-to-fill CSV template or export existing patients first so columns match exactly.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-xl border border-medicore-200 bg-medicore-50 px-4 py-2.5 text-xs font-bold text-medicore-800 hover:bg-medicore-100"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{ar ? 'تحميل اسطمبة جاهزة (CSV)' : 'Download CSV Template'}</span>
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void exportExistingPatients()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>{exporting ? (ar ? 'جارٍ التصدير...' : 'Exporting...') : (ar ? 'تصدير المرضى الحاليين (CSV)' : 'Export Current Patients')}</span>
          </button>
        </div>
      </header>

      <PlanQuotaNotice orgId={organization.id} ar={ar} scope="patients" />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 text-xs">
        <h2 className="flex items-center gap-2 font-black text-slate-900 text-sm">
          <Info className="h-4 w-4 text-medicore-600" />
          <span>{ar ? 'دليل أعمدة ملف الاستيراد' : 'CSV Column Format Guide'}</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-start font-mono">Column</th>
                <th className="p-2 text-start">{ar ? 'إلزامي؟' : 'Required'}</th>
                <th className="p-2 text-start">{ar ? 'الشرح والمثال' : 'Description & Example'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="p-2 font-mono font-bold">first_name_ar, last_name_ar</td><td className="p-2 text-rose-700 font-bold">{ar ? 'إلزامي' : 'Required'}</td><td className="p-2">{ar ? 'الاسم الأول واسم العائلة' : 'Arabic first & last name'}</td></tr>
              <tr><td className="p-2 font-mono font-bold">phone</td><td className="p-2 text-rose-700 font-bold">{ar ? 'إلزامي' : 'Required'}</td><td className="p-2">{ar ? 'رقم الموبايل (يُستخدم لمنع التكرار): +201001122334' : 'Phone number (deduplication key)'}</td></tr>
              <tr><td className="p-2 font-mono font-bold">date_of_birth</td><td className="p-2 text-rose-700 font-bold">{ar ? 'إلزامي' : 'Required'}</td><td className="p-2">{ar ? 'بصيغة YYYY-MM-DD مثل 1992-04-15' : 'Format YYYY-MM-DD'}</td></tr>
              <tr><td className="p-2 font-mono font-bold">gender</td><td className="p-2 text-rose-700 font-bold">{ar ? 'إلزامي' : 'Required'}</td><td className="p-2 font-mono">male / female</td></tr>
              <tr><td className="p-2 font-mono font-bold">opening_balance, balance_type, balance_note</td><td className="p-2 text-slate-500">{ar ? 'اختياري' : 'Optional'}</td><td className="p-2">{ar ? 'المبلغ + النوع (legacy_credit لباقة مدفوعة / legacy_debit عليه للعيادة) + البيان' : 'Amount + legacy_credit / legacy_debit + note'}</td></tr>
              <tr><td className="p-2 font-mono font-bold">blood_group, national_id, legacy_medical_note</td><td className="p-2 text-slate-500">{ar ? 'اختياري' : 'Optional'}</td><td className="p-2">{ar ? 'فصيلة الدم، الرقم القومي، وملخص الملف الطبي السابق' : 'Blood group, national ID & legacy medical note'}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <label className="block text-xs font-bold text-slate-700">
          {ar ? 'اختر ملف CSV بعد تعبئته من الاسطمبة:' : 'Upload completed CSV file:'}
          <input type="file" accept=".csv,text/csv" onChange={e => void selectFile(e.target.files?.[0])} className="mt-2 block w-full text-xs" />
        </label>
        {fileName && <p className="text-xs text-slate-500">{fileName} · {rows.length} {ar ? 'سجل' : 'rows'}</p>}
        {rows.length > 0 && (
          <>
            <div className="max-h-72 overflow-auto border rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {['first_name_ar', 'last_name_ar', 'phone', 'date_of_birth', 'gender', 'opening_balance', 'balance_type'].map(h => (
                      <th key={h} className="p-2 text-start">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.first_name_ar}</td>
                      <td className="p-2">{r.last_name_ar}</td>
                      <td className="p-2 font-mono">{r.phone}</td>
                      <td className="p-2 font-mono">{r.date_of_birth}</td>
                      <td className="p-2">{r.gender}</td>
                      <td className="p-2 font-mono">{r.opening_balance ?? '—'}</td>
                      <td className="p-2 font-mono">{r.balance_type ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button disabled={busy} onClick={() => void importRows()} className="rounded-xl bg-medicore-600 px-5 py-3 font-bold text-white disabled:opacity-50">
              {busy ? (ar ? 'جار الحفظ...' : 'Saving...') : (ar ? 'تحقق واحفظ في قاعدة البيانات' : 'Validate and save')}
            </button>
          </>
        )}
        {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p>}
      </section>
    </main>
  );
};
