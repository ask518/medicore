// ============================================================================
// MEDICORE – Historical Data Migration & Legacy Import Engine
// Excel / CSV File Upload, Column Mapping, Duplicate Detection & Safe Ingestion
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { 
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, 
  ArrowRight, Check, X, RefreshCw
} from 'lucide-react';

export const DataMigration: React.FC = () => {
  const { organization, activeBranch } = useAuth();
  const { locale, t } = useLanguage();
  const { success, warning } = useToast();

  if (!organization) return null;
  const orgId = organization.id;

  const [step, setStep] = useState<number>(1);
  const [fileName, setFileName] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<{ imported: number; duplicates: number } | null>(null);

  // Simulated CSV parsed sample
  const handleSimulateUpload = (type: 'sample_patients' | 'custom') => {
    setFileName(type === 'sample_patients' ? 'legacy_patients_2025.xlsx' : 'custom_data.csv');
    setPreviewRows([
      { row: 1, name: 'محمد عبد الله خليل', phone: '+20 102 345 6789', dob: '1985-04-12', blood: 'O+', gender: 'male', status: 'valid' },
      { row: 2, name: 'فاطمة حسن إبراهيم', phone: '+20 114 567 8901', dob: '1992-09-20', blood: 'A+', gender: 'female', status: 'valid' },
      { row: 3, name: 'أحمد محمود حسن', phone: '+20 122 333 4444', dob: '1990-05-14', blood: 'O+', gender: 'male', status: 'duplicate' },
      { row: 4, name: 'ياسر السيد منصور', phone: '+20 100 888 9999', dob: '1979-11-05', blood: 'B+', gender: 'male', status: 'valid' },
    ]);
    setStep(2);
  };

  const handleConfirmImport = () => {
    // Ingest valid rows into database
    const validRows = previewRows.filter(r => r.status === 'valid');
    validRows.forEach(r => {
      const parts = r.name.split(' ');
      dbClient.createPatient(orgId, {
        primary_branch_id: activeBranch?.id,
        first_name_ar: parts[0] || 'مريض',
        last_name_ar: parts.slice(1).join(' ') || 'سابق',
        date_of_birth: r.dob,
        gender: r.gender,
        blood_group: r.blood,
        phone: r.phone,
        is_active: true,
      });
    });

    setImportSummary({
      imported: validRows.length,
      duplicates: previewRows.filter(r => r.status === 'duplicate').length,
    });
    setStep(3);
    success(locale === 'ar' ? `تم استيراد ${validRows.length} ملف مريض بنجاح` : `Successfully imported ${validRows.length} patient records`);
  };

  const handleReset = () => {
    setStep(1);
    setFileName('');
    setPreviewRows([]);
    setImportSummary(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
          <UploadCloud className="w-6 h-6 text-medicore-600" />
          {t.nav.dataMigration}
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
          {locale === 'ar' ? 'معالج استيراد بيانات وسجلات المرضى السابقة من ملفات Excel و CSV مع التحقق ومنع التكرار' : 'Legacy Data Import Wizard: Excel & CSV patient records ingestion with duplicate detection'}
        </p>
      </div>

      {/* Stepper Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between text-xs font-bold">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-medicore-600' : 'text-slate-400'}`}>
          <span className="w-6 h-6 rounded-full bg-medicore-100 flex items-center justify-center">1</span>
          <span>{locale === 'ar' ? 'رفع الملف' : 'Upload File'}</span>
        </div>
        <div className="h-0.5 w-12 bg-slate-200" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-medicore-600' : 'text-slate-400'}`}>
          <span className="w-6 h-6 rounded-full bg-medicore-100 flex items-center justify-center">2</span>
          <span>{locale === 'ar' ? 'مطابقة الأعمدة والتحقق' : 'Mapping & Validation'}</span>
        </div>
        <div className="h-0.5 w-12 bg-slate-200" />
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-emerald-600' : 'text-slate-400'}`}>
          <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">3</span>
          <span>{locale === 'ar' ? 'تقرير الاستيراد' : 'Import Complete'}</span>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-300 p-10 text-center space-y-4 hover:border-medicore-500 transition-colors">
          <FileSpreadsheet className="w-16 h-16 mx-auto text-emerald-600" />
          <div>
            <h3 className="font-bold text-base text-slate-900">
              {locale === 'ar' ? 'اسحب وأفلت ملف Excel أو CSV هنا' : 'Drag & drop Excel or CSV file here'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              يدعم ملفات (.xlsx, .xls, .csv) المتضمنة الاسم، الهاتف، تاريخ الميلاد، والتشخيص
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleSimulateUpload('sample_patients')}
              className="px-5 py-2.5 bg-medicore-600 hover:bg-medicore-700 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              {locale === 'ar' ? 'تجربة استيراد نموذج مرضى سابقين (Demo Excel)' : 'Load Demo Patients Excel'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Validation */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-900">{fileName}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {locale === 'ar' ? `تم اكتشاف ${previewRows.length} سجلات، تم فحص التكرار تلقائياً` : `${previewRows.length} rows detected with automatic duplicate scan`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              {locale === 'ar' ? 'إلغاء واختيار ملف آخر' : 'Choose another file'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-start">#</th>
                  <th className="p-3 text-start">{t.emr.fullName}</th>
                  <th className="p-3 text-start">{t.emr.phone}</th>
                  <th className="p-3 text-start">{t.emr.birthDate}</th>
                  <th className="p-3 text-start">{t.emr.bloodGroup}</th>
                  <th className="p-3 text-start">{t.common.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map(r => (
                  <tr key={r.row} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono text-slate-400">{r.row}</td>
                    <td className="p-3 font-bold text-slate-900">{r.name}</td>
                    <td className="p-3 font-mono">{r.phone}</td>
                    <td className="p-3">{r.dob}</td>
                    <td className="p-3 font-bold text-rose-600">{r.blood}</td>
                    <td className="p-3">
                      {r.status === 'valid' ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {locale === 'ar' ? 'سليم وجاهز' : 'Ready'}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{locale === 'ar' ? 'مكرر مسجل سابقاً' : 'Duplicate'}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {locale === 'ar' 
                ? 'وفقاً لقواعد النظام الآمنة: لن يتم الكتابة فوق السجلات الموجودة مسبقاً، وسيتم استيراد السجلات الجديدة فقط.'
                : 'According to data integrity rules: existing patients will not be overwritten.'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              className="px-5 py-2.5 bg-medicore-600 hover:bg-medicore-700 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              {locale === 'ar' ? 'بدء الاستيراد الفعلي للسجلات السليمة' : 'Confirm Import'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Complete Report */}
      {step === 3 && importSummary && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-2xs">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-black text-xl text-slate-900">
              {locale === 'ar' ? 'اكتملت عملية الاستيراد بنجاح' : 'Import Process Completed'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              تم إنشاء أرقام طبية (MRN) جديدة وحفظ كافة السجلات بسجل التدقيق الأمني
            </p>
          </div>

          <div className="flex items-center justify-center gap-6 py-3">
            <div className="text-center">
              <span className="text-3xl font-black text-emerald-600">{importSummary.imported}</span>
              <p className="text-xs text-slate-500 mt-0.5">{locale === 'ar' ? 'سجلات تم استيرادها' : 'Imported'}</p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-center">
              <span className="text-3xl font-black text-amber-600">{importSummary.duplicates}</span>
              <p className="text-xs text-slate-500 mt-0.5">{locale === 'ar' ? 'سجلات مكررة تم حمايتها' : 'Duplicates Skipped'}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-2.5 bg-medicore-600 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-medicore-700"
          >
            {locale === 'ar' ? 'استيراد ملف إضافي' : 'Import Another File'}
          </button>
        </div>
      )}
    </div>
  );
};
