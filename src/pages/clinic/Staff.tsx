// ============================================================================
// MEDICORE – Staff & Role-Based Access Control (RBAC) Management
// Doctors, Clinical Specialists, Nurses, Reception & Financial Staff
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { AppRole, User } from '../../types/database';
import { MEDICAL_SPECIALTIES } from '../../config/appConfig';
import { UserCog, Plus, Shield, Mail, Phone, CheckCircle2, X, Stethoscope, DollarSign, Award } from 'lucide-react';

export const Staff: React.FC = () => {
  const { organization, activeBranch } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error } = useToast();

  const [showAddModal, setShowAddModal] = useState(false);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AppRole>('doctor');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialtyCode, setSpecialtyCode] = useState('orthopedics');
  const [consultationFee, setConsultationFee] = useState(300);
  const [followUpFee, setFollowUpFee] = useState(150);
  const [commissionRate, setCommissionRate] = useState(20);

  if (!organization) return null;
  const orgId = organization.id;

  const staff = dbClient.getUsers(orgId);
  const doctors = dbClient.getDoctors(orgId);

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr || !email) {
      error(locale === 'ar' ? 'يرجى إدخال اسم العضو والبريد الإلكتروني' : 'Please provide staff name and email');
      return;
    }

    const selectedSpecialty = MEDICAL_SPECIALTIES.find(s => s.code === specialtyCode);

    dbClient.createStaffMember(orgId, {
      primary_branch_id: activeBranch?.id,
      role,
      name_ar: nameAr,
      name_en: nameEn || nameAr,
      email,
      phone,
      license_number: licenseNumber || undefined,
      is_active: true,
    }, ['doctor', 'assistant_doctor'].includes(role) ? {
      specialty_code: specialtyCode,
      specialty_title_ar: selectedSpecialty?.name_ar || 'طب عام',
      specialty_title_en: selectedSpecialty?.name_en || 'General Practice',
      commission_rate: commissionRate,
      consultation_fee: consultationFee,
      follow_up_fee: followUpFee,
    } : undefined);

    success(locale === 'ar' ? `تم إضافة ${nameAr} إلى فريق العمل بنجاح!` : `Staff member ${nameAr} added!`);
    setShowAddModal(false);

    // Reset
    setNameAr('');
    setNameEn('');
    setEmail('');
    setPhone('');
    setLicenseNumber('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-medicore-600" />
            {t.nav.staff}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' ? 'إدارة الطاقم الطبي، الأطباء الاستشاريين، طاقم الاستقبال والمحاسبة' : 'Clinical & Administrative team with Role-Based Access Control (RBAC)'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-medicore-600 hover:bg-medicore-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{locale === 'ar' ? '+ إضافة طبيب / عضو فريق جديد' : '+ Add Staff / Doctor'}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">
            {staff.length} {locale === 'ar' ? 'أعضاء في فريق عمل المنشأة' : 'Staff Members'}
          </span>
          <span className="text-xs font-bold text-medicore-600">
            {doctors.length} {locale === 'ar' ? 'طبيب ممارس' : 'Doctors'}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {staff.map(member => {
            const docInfo = doctors.find(d => d.user_id === member.id);
            return (
              <div key={member.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-medicore-50 text-medicore-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {member.name_ar.slice(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900">
                        {member[locale === 'ar' ? 'name_ar' : 'name_en']}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {t.roles[member.role] || member.role}
                      </span>
                      {docInfo && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {docInfo.specialty_title_ar}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      <span>{member.email}</span>
                      {member.phone && <span>• {member.phone}</span>}
                      {member.license_number && <span>• ترخيص: {member.license_number}</span>}
                      {docInfo && (
                        <span className="text-emerald-700 font-semibold">
                          • كشف: {docInfo.consultation_fee} ج.م (عمولة: {docInfo.commission_rate}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 self-end sm:self-auto">
                  {t.common.active}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Staff / Doctor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl animate-scale-in border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-medicore-50 text-medicore-600 flex items-center justify-center">
                  <UserCog className="w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-900 text-base">
                  {locale === 'ar' ? 'إضافة عضو فريق / طبيب جديد' : 'Add New Staff / Doctor'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === 'ar' ? 'الاسم بالعربية *' : 'Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={nameAr}
                    onChange={e => setNameAr(e.target.value)}
                    placeholder="مثال: د. كريم عبد الله"
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === 'ar' ? 'الاسم بالإنجليزية' : 'Name (English)'}
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={e => setNameEn(e.target.value)}
                    placeholder="e.g. Dr. Karim Abdullah"
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'الدور الوظيفي والصلاحيات *' : 'Role & Permissions *'}
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as AppRole)}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white focus:border-medicore-500 focus:outline-none font-bold text-slate-800"
                >
                  <option value="doctor">{locale === 'ar' ? 'طبيب أخصائي / استشاري' : 'Doctor / Consultant'}</option>
                  <option value="assistant_doctor">{locale === 'ar' ? 'طبيب مقيم / مساعد' : 'Assistant Doctor'}</option>
                  <option value="receptionist">{locale === 'ar' ? 'موظف استقبال وحجوزات' : 'Receptionist'}</option>
                  <option value="accountant">{locale === 'ar' ? 'محاسب مالي وخزينة' : 'Accountant'}</option>
                  <option value="nurse">{locale === 'ar' ? 'طاقم تمريض' : 'Nurse'}</option>
                  <option value="branch_manager">{locale === 'ar' ? 'مدير فرع' : 'Branch Manager'}</option>
                </select>
              </div>

              {/* Doctor Specific Fields */}
              {['doctor', 'assistant_doctor'].includes(role) && (
                <div className="p-3.5 bg-medicore-50/50 rounded-2xl border border-medicore-100 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-medicore-800">
                    <Stethoscope className="w-4 h-4 text-medicore-600" />
                    <span>{locale === 'ar' ? 'بيانات التخصص والتسعير الطبي' : 'Specialty & Clinical Pricing'}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'التخصص الطبي' : 'Medical Specialty'}
                    </label>
                    <select
                      value={specialtyCode}
                      onChange={e => setSpecialtyCode(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 p-2 bg-white focus:border-medicore-500 focus:outline-none"
                    >
                      {MEDICAL_SPECIALTIES.map(s => (
                        <option key={s.code} value={s.code}>
                          {s.name_ar} ({s.name_en})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {locale === 'ar' ? 'سعر الكشف (ج.م)' : 'Consult Fee'}
                      </label>
                      <input
                        type="number"
                        value={consultationFee}
                        onChange={e => setConsultationFee(Number(e.target.value))}
                        className="w-full text-xs rounded-xl border border-slate-200 p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {locale === 'ar' ? 'الاستشارة (ج.م)' : 'Follow-up'}
                      </label>
                      <input
                        type="number"
                        value={followUpFee}
                        onChange={e => setFollowUpFee(Number(e.target.value))}
                        className="w-full text-xs rounded-xl border border-slate-200 p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {locale === 'ar' ? 'العمولة (%)' : 'Commission %'}
                      </label>
                      <input
                        type="number"
                        value={commissionRate}
                        onChange={e => setCommissionRate(Number(e.target.value))}
                        className="w-full text-xs rounded-xl border border-slate-200 p-2"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === 'ar' ? 'البريد الإلكتروني للدخول *' : 'Email *'}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="doctor@clinic.com"
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === 'ar' ? 'رقم الهاتف' : 'Phone'}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+20 100 ..."
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'رقم ترخيص مزاولة المهنة (نقابة الأطباء / وزارة الصحة)' : 'Medical License No.'}
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={e => setLicenseNumber(e.target.value)}
                  placeholder="مثال: EGY-DOC-84920"
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-medicore-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {locale === 'ar' ? 'حفظ وإضافة العضو' : 'Save Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
