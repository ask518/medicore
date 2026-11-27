import { supabase } from './supabase';
import { MedicalAttachment } from '../types/database';

export const MEDICAL_ATTACHMENTS_BUCKET = 'medical-attachments';
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB

const sanitizeFileName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'attachment';

export async function uploadMedicalAttachment(params: {
  organizationId: string;
  patientId: string;
  file: File;
  description?: string;
  consultationId?: string;
  laboratoryOrderId?: string;
  radiologyOrderId?: string;
}): Promise<MedicalAttachment> {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  if (params.file.size <= 0 || params.file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('File size must be between 1 byte and 20 MB');
  }

  const uniqueToken = crypto.randomUUID().slice(0, 8);
  const storagePath = `${params.organizationId}/${params.patientId}/${Date.now()}_${uniqueToken}_${sanitizeFileName(params.file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDICAL_ATTACHMENTS_BUCKET)
    .upload(storagePath, params.file, {
      cacheControl: '3600',
      contentType: params.file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error: insertError } = await supabase
    .from('medical_attachments')
    .insert({
      organization_id: params.organizationId,
      patient_id: params.patientId,
      consultation_id: params.consultationId || null,
      laboratory_order_id: params.laboratoryOrderId || null,
      radiology_order_id: params.radiologyOrderId || null,
      file_name: params.file.name,
      file_type: params.file.type || 'application/octet-stream',
      file_size_bytes: params.file.size,
      storage_path: storagePath,
      description: params.description?.trim() || null,
    })
    .select('*')
    .single();

  if (insertError || !data) {
    await supabase.storage.from(MEDICAL_ATTACHMENTS_BUCKET).remove([storagePath]);
    throw insertError || new Error('Failed to record attachment metadata');
  }

  return data as MedicalAttachment;
}

export async function createAttachmentSignedUrl(storagePath: string, expiresInSeconds = 300): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  const { data, error } = await supabase.storage
    .from(MEDICAL_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw error || new Error('Unable to create signed URL for attachment');
  }
  return data.signedUrl;
}
