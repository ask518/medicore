// ============================================================================
// MEDICORE – Staff & Role-Based Access Control (RBAC) Management
// Multi-Tenant Isolation: Isolated to the Active Facility (Organization)
// Doctors, Clinical Specialists, Nurses, Reception & Financial Staff
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { AppRole, User } from '../../types/database';
import { MASTER_MEDICAL_SPECIALTIES, getSpecialtyByCode } from '../../config/medicalSpecialties';
import { 
  UserCog, Plus, Shield, Mail, Phone, CheckCircle2, X, Stethoscope, 
  DollarSign, Award, Search, Filter, Trash2, Building2, UserCheck, 
  UserX, Activity, Users, MapPin, HeartHandshake, FileText, ChevronDown
} from 'lucide-react';

export const Staff: React.FC = () => {
  const { organization, activeBranch, availableBranches, isSuperAdmin } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AppRole>('doctor');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || '');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialtyCode, setSpecialtyCode] = useState('orthopedics');
  const [consultationFee, setConsultationFee] = useState(300);
  const [followUpFee, setFollowUpFee] = useState(150);
  const [commissionRate, setCommissionRate] = useState(20);

  // Available specialties for this facility
  const availableSpecialties = useMemo(() => {
    if (organization?.specialties && organization.specialties.length > 0) {
      const filtered = MASTER_MEDICAL_SPECIALTIES.filter(s => organization.specialties!.includes(s.code));
      if (filtered.length > 0) return filtered;
    }
    return MASTER_MEDICAL_SPECIALTIES.filter(s => s.is_active);
  }, [organization?.specialties]);

  const orgId = organization?.id || '';
  const staff = orgId ? dbClient.getUsers(orgId) : [];
  const doctors = orgId ? dbClient.getDoctors(orgId) : [];

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staff.filter(member => {
      // Search filter
      const matchesSearch = !searchTerm || 
        member.name_ar.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (member.name_en && member.name_en.toLowerCase().includes(searchTerm.toLowerCase())) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (member.phone && member.phone.includes(searchTerm)) ||
        (member.license_number && member.license_number.toLowerCase().includes(searchTerm.toLowerCase()));

      // Role filter
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;

      // Branch filter
      const matchesBranch = branchFilter === 'all' || member.primary_branch_id === branchFilter;

      return matchesSearch && matchesRole && matchesBranch;
    });
  }, [staff, searchTerm, roleFilter, branchFilter]);

  if (!organization) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">
          {locale === 'ar' ? 'لم يتم تحديد منشأة طبية نشطة' : 'No active medical facility selected'}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {locale === 'ar' 
            ? 'يرجى اختيار المنشأة الطبية أولاً لإدارة فريق العمل والصلاحيات الخاصة بها.' 
            : 'Please select a facility first to manage its staff and RBAC.'}
        </p>
      </div>
    );
  }

  // Statistics
  const doctorsCount = staff.filter(s => ['doctor', 'assistant_doctor'].includes(s.role)).length;
  const nursingAndTechCount = staff.filter(s => ['nurse', 'lab_technician', 'radiology_technician', 'pharmacist'].includes(s.role)).length;
  const adminAndFinanceCount = staff.filter(s => ['receptionist', 'accountant', 'insurance_officer', 'branch_manager', 'org_owner'].includes(s.role)).length;

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr || !email) {
      error(locale === 'ar' ? 'يرجى إدخال اسم العضو والبريد الإلكتروني' : 'Please provide staff name and email');
      return;
    }

    const selectedSpecialty = getSpecialtyByCode(specialtyCode) || availableSpecialties[0];

    dbClient.createStaffMember(orgId, {
      primary_branch_id: selectedBranchId || activeBranch?.id,
      role,
      name_ar: nameAr,
      name_en: nameEn || nameAr,
      email,
      phone,
      license_number: licenseNumber || undefined,
      is_active: true,
    }, ['doctor', 'assistant_doctor'].includes(role) ? {
      specialty_code: selectedSpecialty?.code || specialtyCode,
      specialty_title_ar: selectedSpecialty?.name_ar || 'طب عام',
      specialty_title_en: selectedSpecialty?.name_en || 'General Practice',
      commission_rate: commissionRate,
      consultation_fee: consultationFee,
      follow_up_fee: followUpFee,
    } : undefined);

    success(locale === 'ar' ? `تم إضافة ${nameAr} إلى فريق عمل المنشأة بنجاح!` : `Staff member ${nameAr} added!`);
    setShowAddModal(false);

    // Reset
    setNameAr('');
    setNameEn('');
    setEmail('');
    setPhone('');
    setLicenseNumber('');
    setRole('doctor');
  };

  const handleRoleChange = (userId: string, newRole: AppRole) => {
    dbClient.updateUserRole(userId, newRole);
    success(locale === 'ar' ? 'تم تحديث الدور الوظيفي والصلاحيات بنجاح' : 'Staff role updated successfully');
  };

  const handleToggleStatus = (userId: string, currentStatus: boolean, userName: string) => {
    dbClient.updateUserStatus(userId, !currentStatus);
    if (currentStatus) {
      error(locale === 'ar' ? `تم إيقاف حساب ${userName} مؤقتاً` : `Account ${userName} suspended`);
    } else {
      success(locale === 'ar' ? `تم تفعيل حساب ${userName} بنجاح` : `Account ${userName} activated`);
    }
  };

  const handleDeleteStaff = (userId: string, userName: string) => {
    if (window.confirm(locale === 'ar' ? `هل أنت متأكد من حذف ${userName} من فريق عمل المنشأة؟` : `Are you sure you want to delete ${userName}?`)) {
      try {
        dbClient.deleteUser(userId);
        success(locale === 'ar' ? `تم حذف ${userName} بنجاح` : `User ${userName} deleted`);
      } catch (err: any) {
        error(err.message || 'حدث خطأ أثناء الحذف');
      }
    }
  };

  const getRoleBadgeStyle = (userRole: AppRole) => {
    switch (userRole) {
      case 'org_owner':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'branch_manager':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'doctor':
      case 'assistant_doctor':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'nurse':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'receptionist':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'accountant':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'pharmacist':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'lab_technician':
      case 'radiology_technician':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <UserCog className="w-6 h-6 text-medicore-600" />
              {locale === 'ar' ? 'فريق العمل والصلاحيات (Staff & RBAC)' : 'Staff & Permissions (RBAC)'}
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-medicore-100 text-medicore-800">
              {organization[locale === 'ar' ? 'name_ar' : 'name_en']}
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' 
              ? `إدارة الطاقم الطبي والأطباء والاستقبال والمحاسبة لمنشأة ${organization.name_ar}` 
              : `Clinical & Administrative staff management for ${organization.name_en}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-medicore-600 hover:bg-medicore-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{locale === 'ar' ? '+ إضافة طبيب / عضو فريق جديد' : '+ Add Staff / Doctor'}</span>
        </button>
      </div>

      {/* SaaS Multi-Tenant Isolation Notice */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-emerald-50/50 border border-blue-200/70 text-slate-800 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <span>{locale === 'ar' ? 'عزل البيانات الصارم (Multi-Tenant SaaS Boundary)' : 'Multi-Tenant SaaS Boundary'}</span>
              <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-blue-200 text-blue-900 uppercase">
                {organization.slug}
              </span>
            </div>
            <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
              {locale === 'ar'
                ? `أنت تدير الآن حصرياً الكادر الطبي والإداري لمنشأة «${organization.name_ar}». بيانات الأطباء والتراخيص ونسب العمولات والصلاحيات معزولة كلياً ومحمية ولا تظهر لأي منشأة أخرى أو في لوحة مسؤولي المنصة السحابية.`
                : `You are managing staff specifically for "${organization.name_en}". All clinical licenses, commission rates, and credentials are completely isolated within this tenant.`}
            </p>
          </div>
        </div>
      </div>

      {/* 4 Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-medicore-50 text-medicore-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">{locale === 'ar' ? 'إجمالي الفريق' : 'Total Staff'}</div>
            <div className="text-lg font-black text-slate-900">{staff.length}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">{locale === 'ar' ? 'الأطباء والاستشاريون' : 'Doctors'}</div>
            <div className="text-lg font-black text-blue-700">{doctorsCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">{locale === 'ar' ? 'التمريض والمختبر' : 'Nursing & Labs'}</div>
            <div className="text-lg font-black text-emerald-700">{nursingAndTechCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">{locale === 'ar' ? 'الاستقبال والمالية' : 'Admin & Finance'}</div>
            <div className="text-lg font-black text-amber-700">{adminAndFinanceCount}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={locale === 'ar' ? 'بحث بالاسم، البريد، الهاتف، رقم الترخيص...' : 'Search by name, email, phone, license...'}
            className="w-full text-xs ps-9 pe-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-medicore-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 p-2 bg-white font-medium text-slate-700 focus:outline-none focus:border-medicore-500"
            >
              <option value="all">{locale === 'ar' ? 'كل الأدوار الوظيفية' : 'All Roles'}</option>
              <option value="doctor">{locale === 'ar' ? 'الأطباء الاستشاريون' : 'Doctors'}</option>
              <option value="assistant_doctor">{locale === 'ar' ? 'الأطباء المساعدون' : 'Assistant Doctors'}</option>
              <option value="nurse">{locale === 'ar' ? 'طاقم التمريض' : 'Nurses'}</option>
              <option value="receptionist">{locale === 'ar' ? 'الاستقبال والحجوزات' : 'Receptionists'}</option>
              <option value="accountant">{locale === 'ar' ? 'المحاسبة والخزينة' : 'Accountants'}</option>
              <option value="pharmacist">{locale === 'ar' ? 'الصيدلة الإكلينيكية' : 'Pharmacists'}</option>
              <option value="lab_technician">{locale === 'ar' ? 'المختبرات والتحاليل' : 'Lab Technicians'}</option>
              <option value="radiology_technician">{locale === 'ar' ? 'فنيو الأشعة' : 'Radiology'}</option>
              <option value="branch_manager">{locale === 'ar' ? 'مديرو الفروع' : 'Branch Managers'}</option>
              <option value="org_owner">{locale === 'ar' ? 'مالكو المنشأة' : 'Facility Owners'}</option>
            </select>
          </div>

          {availableBranches.length > 1 && (
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 p-2 bg-white font-medium text-slate-700 focus:outline-none focus:border-medicore-500"
            >
              <option value="all">{locale === 'ar' ? 'كافة الفروع' : 'All Branches'}</option>
              {availableBranches.map(b => (
                <option key={b.id} value={b.id}>
                  {b[locale === 'ar' ? 'name_ar' : 'name_en']}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Staff Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">
            {filteredStaff.length} {locale === 'ar' ? 'عضو مطابق للبحث' : 'Matching Members'}
          </span>
          <span className="text-xs font-bold text-medicore-600">
            {doctorsCount} {locale === 'ar' ? 'طبيب ممارس' : 'Doctors'}
          </span>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">
              {locale === 'ar' ? 'لا يوجد أعضاء يطابقون خيارات البحث' : 'No staff members matching your filter'}
            </p>
            <button
              type="button"
              onClick={() => { setSearchTerm(''); setRoleFilter('all'); setBranchFilter('all'); }}
              className="mt-2 text-xs font-bold text-medicore-600 hover:underline"
            >
              {locale === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset filters'}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredStaff.map(member => {
              const docInfo = doctors.find(d => d.user_id === member.id);
              const branch = availableBranches.find(b => b.id === member.primary_branch_id);

              return (
                <div key={member.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                  {/* Identity & Basic Info */}
                  <div className="flex items-start gap-3.5">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-medicore-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {member.name_ar.slice(0, 1)}
                      </div>
                      <span className={`absolute -bottom-1 -end-1 w-3.5 h-3.5 rounded-full border-2 border-white ${member.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-900">
                          {member[locale === 'ar' ? 'name_ar' : 'name_en']}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(member.role)}`}>
                          {t.roles[member.role] || member.role}
                        </span>
                        {docInfo && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                            <Stethoscope className="w-3 h-3 text-blue-600" />
                            <span>{docInfo.specialty_title_ar}</span>
                          </span>
                        )}
                        {branch && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            <span>{branch[locale === 'ar' ? 'name_ar' : 'name_en']}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{member.email}</span>
                        </span>
                        {member.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{member.phone}</span>
                          </span>
                        )}
                        {member.license_number && (
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <Award className="w-3 h-3 text-amber-500" />
                            <span>{locale === 'ar' ? `ترخيص: ${member.license_number}` : `License: ${member.license_number}`}</span>
                          </span>
                        )}
                        {docInfo && (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            كشف: {docInfo.consultation_fee} ج.م | استشارة: {docInfo.follow_up_fee} ج.م | عمولة: {docInfo.commission_rate}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Role Controls */}
                  <div className="flex items-center gap-2 self-end lg:self-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 w-full lg:w-auto justify-between lg:justify-end">
                    {/* Role changer dropdown */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={member.role}
                        onChange={e => handleRoleChange(member.id, e.target.value as AppRole)}
                        className="text-[11px] font-bold rounded-lg border border-slate-200 p-1.5 bg-white text-slate-700 focus:border-medicore-500 focus:outline-none"
                        title={locale === 'ar' ? 'تغيير الدور الوظيفي' : 'Change staff role'}
                      >
                        <option value="doctor">{locale === 'ar' ? 'طبيب أخصائي' : 'Doctor'}</option>
                        <option value="assistant_doctor">{locale === 'ar' ? 'طبيب مقيم' : 'Assistant Doctor'}</option>
                        <option value="nurse">{locale === 'ar' ? 'تمريض' : 'Nurse'}</option>
                        <option value="receptionist">{locale === 'ar' ? 'استقبال' : 'Receptionist'}</option>
                        <option value="accountant">{locale === 'ar' ? 'محاسب' : 'Accountant'}</option>
                        <option value="pharmacist">{locale === 'ar' ? 'صيدلي' : 'Pharmacist'}</option>
                        <option value="lab_technician">{locale === 'ar' ? 'فني مختبر' : 'Lab Tech'}</option>
                        <option value="radiology_technician">{locale === 'ar' ? 'فني أشعة' : 'Radiology Tech'}</option>
                        <option value="insurance_officer">{locale === 'ar' ? 'مسؤول تأمين' : 'Insurance Officer'}</option>
                        <option value="branch_manager">{locale === 'ar' ? 'مدير فرع' : 'Branch Manager'}</option>
                        <option value="org_owner">{locale === 'ar' ? 'مالك المنشأة' : 'Facility Owner'}</option>
                      </select>
                    </div>

                    {/* Status Toggle (Active / Suspended) */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(member.id, member.is_active, member.name_ar)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                        member.is_active
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                      }`}
                      title={member.is_active ? 'تعليق الحساب' : 'تفعيل الحساب'}
                    >
                      {member.is_active ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t.common.active}</span>
                        </>
                      ) : (
                        <>
                          <UserX className="w-3.5 h-3.5 text-rose-600" />
                          <span>{locale === 'ar' ? 'معلّق' : 'Suspended'}</span>
                        </>
                      )}
                    </button>

                    {/* Delete Member */}
                    <button
                      type="button"
                      onClick={() => handleDeleteStaff(member.id, member.name_ar)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title={locale === 'ar' ? 'حذف العضو' : 'Delete Member'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {locale === 'ar' ? 'إضافة عضو فريق / طبيب جديد' : 'Add New Staff / Doctor'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {locale === 'ar' ? `المنشأة: ${organization.name_ar}` : `Facility: ${organization.name_en}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <option value="nurse">{locale === 'ar' ? 'طاقم تمريض' : 'Nurse'}</option>
                    <option value="receptionist">{locale === 'ar' ? 'موظف استقبال وحجوزات' : 'Receptionist'}</option>
                    <option value="accountant">{locale === 'ar' ? 'محاسب مالي وخزينة' : 'Accountant'}</option>
                    <option value="pharmacist">{locale === 'ar' ? 'صيدلي إكلينيكي' : 'Pharmacist'}</option>
                    <option value="lab_technician">{locale === 'ar' ? 'فني مختبر وتحاليل' : 'Lab Technician'}</option>
                    <option value="radiology_technician">{locale === 'ar' ? 'فني أشعة وتصوير طبي' : 'Radiology Technician'}</option>
                    <option value="insurance_officer">{locale === 'ar' ? 'مسؤول تأمين ومطالبات' : 'Insurance Officer'}</option>
                    <option value="branch_manager">{locale === 'ar' ? 'مدير فرع' : 'Branch Manager'}</option>
                  </select>
                </div>

                {availableBranches.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'الفرع التابع له' : 'Branch'}
                    </label>
                    <select
                      value={selectedBranchId}
                      onChange={e => setSelectedBranchId(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white focus:border-medicore-500 focus:outline-none text-slate-800"
                    >
                      {availableBranches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b[locale === 'ar' ? 'name_ar' : 'name_en']} {b.is_main_branch ? `(${locale === 'ar' ? 'الرئيسي' : 'Main'})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                      {availableSpecialties.map(s => (
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
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
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
