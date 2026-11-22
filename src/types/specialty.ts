// ============================================================================
// MEDICORE – Specialty Examination & Anatomy Interactive Visualization Types
// ============================================================================

export type SpecialtyCode = 
  | 'orthopedics'
  | 'dentistry'
  | 'dermatology'
  | 'ophthalmology'
  | 'cardiology'
  | 'pediatrics'
  | 'gynecology_obstetrics'
  | 'ent'
  | 'internal_medicine'
  | 'general_surgery'
  | 'neurology';

export interface SpecialtyMeta {
  code: SpecialtyCode;
  name_ar: string;
  name_en: string;
  iconName: string;
  hasInteractiveCanvas: boolean;
}

// ----------------------------------------------------------------------------
// 1. ORTHOPEDICS TYPES
// ----------------------------------------------------------------------------
export type BoneRegionId = 
  | 'skull'
  | 'cervical_spine'
  | 'thoracic_spine'
  | 'lumbar_spine'
  | 'sacrum_pelvis'
  | 'clavicle_r' | 'clavicle_l'
  | 'scapula_r' | 'scapula_l'
  | 'shoulder_r' | 'shoulder_l'
  | 'humerus_r' | 'humerus_l'
  | 'elbow_r' | 'elbow_l'
  | 'radius_ulna_r' | 'radius_ulna_l'
  | 'wrist_hand_r' | 'wrist_hand_l'
  | 'hip_joint_r' | 'hip_joint_l'
  | 'femur_r' | 'femur_l'
  | 'knee_r' | 'knee_l'
  | 'tibia_fibula_r' | 'tibia_fibula_l'
  | 'ankle_foot_r' | 'ankle_foot_l';

export type OrthoFindingType = 
  | 'fracture_closed'
  | 'fracture_open'
  | 'dislocation'
  | 'sprain_strain'
  | 'osteoarthritis'
  | 'tendon_tear'
  | 'post_operative_hardware'
  | 'point_tenderness';

export interface OrthopedicFinding {
  id: string;
  regionId: BoneRegionId;
  view: 'anterior' | 'posterior';
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  findingType: OrthoFindingType;
  severity: 'mild' | 'moderate' | 'severe';
  painScale: number; // 0 to 10
  dateOfInjury?: string;
  description: string;
  treatmentRecommended?: string;
}

// ----------------------------------------------------------------------------
// 2. DENTISTRY (ODONTOGRAM FDI) TYPES
// ----------------------------------------------------------------------------
// Adult FDI: 11-18, 21-28, 31-38, 41-48
// Pediatric FDI: 51-55, 61-65, 71-75, 81-85
export type ToothSurface = 'O' | 'M' | 'D' | 'B' | 'L'; // Occlusal, Mesial, Distal, Buccal, Lingual

export type DentalCondition = 
  | 'sound'
  | 'caries'
  | 'composite_filling'
  | 'amalgam_filling'
  | 'crown'
  | 'root_canal'
  | 'implant'
  | 'missing'
  | 'impacted'
  | 'fractured'
  | 'mobility_grade_1'
  | 'mobility_grade_2'
  | 'mobility_grade_3'
  | 'extraction_indicated';

export interface ToothRecord {
  toothNumber: number; // e.g. 11, 26, 48, 51
  condition: DentalCondition;
  surfaces: ToothSurface[];
  notes?: string;
  cost?: number;
  completed: boolean;
}

// ----------------------------------------------------------------------------
// 3. DERMATOLOGY TYPES
// ----------------------------------------------------------------------------
export type DermaLesionType = 
  | 'macule'
  | 'papule'
  | 'plaque'
  | 'nodule'
  | 'vesicle_bulla'
  | 'pustule'
  | 'wheal_urticaria'
  | 'ulcer'
  | 'hyperkeratosis'
  | 'hyperpigmentation'
  | 'alopecia'
  | 'biopsy_site';

export interface DermaFinding {
  id: string;
  view: 'anterior' | 'posterior';
  x: number;
  y: number;
  lesionType: DermaLesionType;
  sizeMm?: number;
  colorHex: string;
  symmetry: 'symmetric' | 'asymmetric';
  border: 'regular' | 'irregular';
  symptoms: ('itching' | 'bleeding' | 'pain' | 'asymptomatic')[];
  clinicalNotes: string;
}

// ----------------------------------------------------------------------------
// 4. OPHTHALMOLOGY TYPES
// ----------------------------------------------------------------------------
export interface EyeExaminationData {
  rightEye: {
    visualAcuityUncorrected: string; // e.g. "6/6", "6/18"
    visualAcuityCorrected: string;
    intraocularPressureMmHg: number; // e.g. 15
    anteriorSegmentNotes: string;
    corneaStatus: string;
    lensStatus: string; // clear, cataract
    fundusRetinaNotes: string;
    cupToDiscRatio: number; // 0.3
  };
  leftEye: {
    visualAcuityUncorrected: string;
    visualAcuityCorrected: string;
    intraocularPressureMmHg: number;
    anteriorSegmentNotes: string;
    corneaStatus: string;
    lensStatus: string;
    fundusRetinaNotes: string;
    cupToDiscRatio: number;
  };
  refractionSphereOD?: number;
  refractionCylinderOD?: number;
  refractionAxisOD?: number;
  refractionSphereOS?: number;
  refractionCylinderOS?: number;
  refractionAxisOS?: number;
}
