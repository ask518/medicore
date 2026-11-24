import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { UploadCloud } from 'lucide-react';

type PatientRow = { first_name_ar: string; last_name_ar: string; phone: string; date_of_birth: string; gender: 'male' | 'female'; blood_group?: string; national_id?: string };
function csvRows(text: string): string[][] {
  const out: string[][] = []; let cells: string[] = []; let value = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; } else if (c === '"') quoted = !quoted; else if (c === ',' && !quoted) { cells.push(value.trim()); value = ''; } else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; cells.push(value.trim()); if (cells.some(Boolean)) out.push(cells); cells = []; value = ''; } else value += c; }
  cells.push(value.trim()); if (cells.some(Boolean)) out.push(cells); return out;
}

export const DataMigration: React.FC = () => {
  const { organization, activeBranch } = useAuth(); const { locale } = useLanguage(); const { success, error } = useToast();
  const [rows, setRows] = useState<PatientRow[]>([]); const [fileName, setFileName] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const ar = locale === 'ar';
  const selectFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 5 * 1024 * 1024) { error(ar ? 'اختر CSV بحد أقصى 5 ميجابايت.' : 'Choose a CSV up to 5 MB.'); return; }
    const matrix = csvRows(await file.text()); const headers = matrix.shift()?.map(x => x.toLowerCase()) || []; const required = ['first_name_ar','last_name_ar','phone','date_of_birth','gender'];
    if (required.some(x => !headers.includes(x))) { error(`${ar ? 'الأعمدة المطلوبة' : 'Required columns'}: ${required.join(', ')}`); return; }
    if (matrix.length > 1000) { error(ar ? 'الحد الأقصى 1000 سجل.' : 'Maximum 1,000 records.'); return; }
    const at = (key: string, row: string[]) => row[headers.indexOf(key)] || '';
    const parsed: PatientRow[] = [];
    for (const row of matrix) { const gender = at('gender', row).toLowerCase(); const dob = at('date_of_birth', row); const first = at('first_name_ar', row); const last = at('last_name_ar', row); const phone = at('phone', row); const date = new Date(`${dob}T00:00:00Z`); if (!first || !last || !phone || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== dob || !['male','female'].includes(gender)) { error(ar ? 'صف غير صالح: راجع الأسماء والهاتف والتاريخ والنوع.' : 'Invalid row: check names, phone, date, and gender.'); return; } parsed.push({ first_name_ar:first, last_name_ar:last, phone, date_of_birth:dob, gender:gender as 'male'|'female', blood_group:at('blood_group',row) || undefined, national_id:at('national_id',row) || undefined }); }
    setRows(parsed); setFileName(file.name); setMessage('');
  };
  const importRows = async () => {
    if (!supabase || !organization || rows.length === 0) return;
    setBusy(true); const phones = [...new Set(rows.map(r => r.phone))]; const { data: found, error: duplicateError } = await supabase.from('patients').select('phone').eq('organization_id', organization.id).in('phone', phones);
    if (duplicateError) { setBusy(false); error(ar ? 'تعذر فحص التكرار.' : 'Could not check duplicates.'); return; }
    const existing = new Set((found || []).map(r => r.phone)); const added = new Set<string>(); const ready = rows.filter(r => { if (existing.has(r.phone) || added.has(r.phone)) return false; added.add(r.phone); return true; }).map(r => ({ ...r, organization_id: organization.id, primary_branch_id: activeBranch?.id || null, mrn: `MRN-${new Date().getFullYear()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`, blood_group: r.blood_group || 'unknown', is_active: true }));
    const result = ready.length ? await supabase.from('patients').insert(ready) : { error: null };
    setBusy(false); if (result.error) { error(ar ? 'فشل الحفظ في قاعدة البيانات.' : 'Database insert failed.'); return; }
    const note = ar ? `تم حفظ ${ready.length} وتجاوز ${rows.length-ready.length} مكرر.` : `Saved ${ready.length}; skipped ${rows.length-ready.length} duplicates.`; setMessage(note); success(note); setRows([]);
  };
  if (!organization) return null;
  return <main className="mx-auto max-w-4xl space-y-5" dir={ar?'rtl':'ltr'}><header><h1 className="text-2xl font-black"><UploadCloud className="me-2 inline h-6 w-6"/>{ar?'استيراد ملفات المرضى':'Import patient records'}</h1><p className="mt-2 text-sm text-slate-600">{ar?'استيراد CSV فعلي. المطلوب: first_name_ar,last_name_ar,phone,date_of_birth,gender (male/female). الاختياري: blood_group,national_id.':'Real CSV import. Required: first_name_ar,last_name_ar,phone,date_of_birth,gender (male/female). Optional: blood_group,national_id.'}</p></header><section className="space-y-4 rounded-2xl border bg-white p-6"><input type="file" accept=".csv,text/csv" onChange={e=>void selectFile(e.target.files?.[0])}/>{fileName&&<p className="text-xs text-slate-500">{fileName} · {rows.length} {ar?'سجل':'rows'}</p>}{rows.length>0&&<><div className="max-h-72 overflow-auto border"><table className="w-full text-xs"><thead><tr>{['first_name_ar','last_name_ar','phone','date_of_birth','gender'].map(h=><th key={h} className="p-2 text-start">{h}</th>)}</tr></thead><tbody>{rows.slice(0,20).map((r,i)=><tr key={i} className="border-t"><td className="p-2">{r.first_name_ar}</td><td>{r.last_name_ar}</td><td>{r.phone}</td><td>{r.date_of_birth}</td><td>{r.gender}</td></tr>)}</tbody></table></div><button disabled={busy} onClick={()=>void importRows()} className="rounded-xl bg-medicore-600 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?(ar?'جار الحفظ':'Saving'):(ar?'تحقق واحفظ':'Validate and save')}</button></>}{message&&<p role="status" className="bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}</section></main>;
};
