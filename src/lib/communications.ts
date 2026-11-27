// ============================================================================
// MEDICORE – Patient Communication Helper (WhatsApp Notifications & Direct Call)
// Real Phone Formatting, Template Rendering & Cloud Audit Logging
// ============================================================================

import { supabase } from './supabase';

export type NotificationTemplateKey =
  | 'appointment_confirmation'
  | 'appointment_reminder'
  | 'follow_up_reminder'
  | 'lab_results_ready'
  | 'custom';

export const normalizePhoneForDial = (rawPhone?: string | null): string => {
  if (!rawPhone) return '';
  return rawPhone.replace(/[^\d+]/g, '');
};

export const normalizePhoneForWhatsApp = (rawPhone?: string | null): string => {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  // Default Egyptian local mobile numbers starting with 01x (11 digits) to +20
  if (digits.startsWith('01') && digits.length === 11) {
    return `20${digits.slice(1)}`;
  }
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  return digits;
};

export const buildTemplateMessage = (
  template: NotificationTemplateKey,
  params: {
    patientName: string;
    clinicName: string;
    date?: string;
    time?: string;
    doctorName?: string;
    locale?: 'ar' | 'en';
  }
): string => {
  const ar = params.locale !== 'en';
  const clinic = params.clinicName;
  const name = params.patientName;
  switch (template) {
    case 'appointment_confirmation':
      return ar
        ? `مرحباً ${name}، نؤكد لكم حجز موعدكم في ${clinic}${params.doctorName ? ` مع ${params.doctorName}` : ''}${params.date ? ` بتاريخ ${params.date}` : ''}${params.time ? ` الساعة ${params.time}` : ''}. نتمنى لكم دوام الصحة.`
        : `Hello ${name}, your appointment at ${clinic}${params.doctorName ? ` with ${params.doctorName}` : ''}${params.date ? ` on ${params.date}` : ''}${params.time ? ` at ${params.time}` : ''} is confirmed.`;
    case 'appointment_reminder':
      return ar
        ? `تذكير بموعدكم القادم في ${clinic}: عزيزي/عزيزتي ${name}، موعدكم${params.date ? ` يوم ${params.date}` : ''}${params.time ? ` الساعة ${params.time}` : ''}. في حال الرغبة في التعديل يرجى التواصل معنا.`
        : `Reminder from ${clinic}: Dear ${name}, you have an appointment${params.date ? ` on ${params.date}` : ''}${params.time ? ` at ${params.time}` : ''}.`;
    case 'follow_up_reminder':
      return ar
        ? `مرحباً ${name}، فريق ${clinic} يذكركم بموعد المتابعة الدورية للاطمئنان على صحتكم. يسعدنا تواصلكم لتحديد الوقت المناسب.`
        : `Hello ${name}, ${clinic} would like to remind you of your upcoming follow-up visit.`;
    case 'lab_results_ready':
      return ar
        ? `مرحباً ${name}، نحيطكم علماً بأن نتائج فحوصاتكم في ${clinic} جاهزة للمراجعة.`
        : `Hello ${name}, your lab/diagnostic results at ${clinic} are ready for review.`;
    default:
      return ar ? `مرحباً ${name}، رسالة من ${clinic}: ` : `Hello ${name}, message from ${clinic}: `;
  }
};

export const logAndOpenWhatsApp = async (params: {
  organizationId: string;
  branchId?: string | null;
  patientId?: string | null;
  phone: string;
  templateKey: NotificationTemplateKey;
  message: string;
  userId?: string | null;
}): Promise<{ ok: boolean; url?: string; error?: string }> => {
  const waPhone = normalizePhoneForWhatsApp(params.phone);
  if (!waPhone) {
    return { ok: false, error: 'رقم واتساب غير صالح.' };
  }

  if (supabase) {
    await supabase.from('notifications').insert({
      organization_id: params.organizationId,
      branch_id: params.branchId || null,
      patient_id: params.patientId || null,
      channel: 'whatsapp',
      template_key: params.templateKey,
      recipient_phone: waPhone,
      message_body: params.message,
      status: 'dispatched',
      sent_by: params.userId || null,
    });
  }

  const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(params.message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return { ok: true, url };
};

export const logAndStartCall = async (params: {
  organizationId: string;
  branchId?: string | null;
  patientId?: string | null;
  phone: string;
  userId?: string | null;
}): Promise<{ ok: boolean; error?: string }> => {
  const dial = normalizePhoneForDial(params.phone);
  if (!dial) {
    return { ok: false, error: 'رقم الهاتف غير صالح.' };
  }

  if (supabase) {
    await supabase.from('notifications').insert({
      organization_id: params.organizationId,
      branch_id: params.branchId || null,
      patient_id: params.patientId || null,
      channel: 'call',
      template_key: 'direct_call',
      recipient_phone: dial,
      message_body: 'Direct telephone call initiated from clinic desk',
      status: 'dispatched',
      sent_by: params.userId || null,
    });
  }

  window.location.href = `tel:${dial}`;
  return { ok: true };
};
