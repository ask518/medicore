// ============================================================================
// MEDICORE – Comprehensive Medical Activities & Specialties Catalog
// Structured Master Taxonomy: Categories A through I, Expandable & Multi-Tenant
// ============================================================================

export type SpecialtyCategoryCode = 
  | 'general_medical'
  | 'surgical'
  | 'medical'
  | 'orthopedic_subspecialties'
  | 'dentistry'
  | 'women_and_children'
  | 'ophthalmology'
  | 'ent'
  | 'diagnostic_and_therapeutic';

export type ClinicalModuleType = 
  | 'orthopedics'
  | 'dentistry'
  | 'dermatology'
  | 'ophthalmology'
  | 'cardiology'
  | 'gastroenterology'
  | 'pediatrics'
  | 'gynecology_obstetrics'
  | 'neurology'
  | 'pulmonology'
  | 'ent'
  | 'urology'
  | 'psychiatry'
  | 'general_template';

export interface MedicalSpecialtyItem {
  code: string;
  name_ar: string;
  name_en: string;
  category: SpecialtyCategoryCode;
  category_name_ar: string;
  category_name_en: string;
  clinical_module: ClinicalModuleType;
  icon_name: string;
  description_ar?: string;
  description_en?: string;
  is_active: boolean;
  is_custom?: boolean;
}

export interface SpecialtyCategory {
  code: SpecialtyCategoryCode;
  letter: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
}

export const SPECIALTY_CATEGORIES: SpecialtyCategory[] = [
  {
    code: 'general_medical',
    letter: 'A',
    name_ar: 'التخصصات الطبية العامة والرعاية الأولية',
    name_en: 'General Medical Specialties',
    description_ar: 'الممارسة العامة، طب الأسرة، الباطنة العامة، والطوارئ',
    description_en: 'General practice, family medicine, internal medicine & emergency'
  },
  {
    code: 'surgical',
    letter: 'B',
    name_ar: 'التخصصات الجراحية',
    name_en: 'Surgical Specialties',
    description_ar: 'الجراحة العامة، جراحة القلب، الأوعية، التجميل، والمناظير',
    description_en: 'General surgery, cardiothoracic, vascular, plastic & laparoscopic'
  },
  {
    code: 'medical',
    letter: 'C',
    name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    name_en: 'Medical Specialties',
    description_ar: 'أمراض القلب، الجهاز الهضمي، الصدر، الكلى، السكر، والمخ والأعصاب',
    description_en: 'Cardiology, gastroenterology, pulmonology, nephrology & neurology'
  },
  {
    code: 'orthopedic_subspecialties',
    letter: 'D',
    name_ar: 'جراحة العظام والمفاصل وتخصصاتها الدقيقة',
    name_en: 'Orthopedic Subspecialties',
    description_ar: 'العمود الفقري، تبديل المفاصل، إصابات الملاعب، وجراحة اليد والكسور',
    description_en: 'Spine, joint replacement, sports medicine, hand & trauma surgery'
  },
  {
    code: 'dentistry',
    letter: 'E',
    name_ar: 'طب وجراحة الفم والأسنان',
    name_en: 'Dentistry & Oral Surgery',
    description_ar: 'علاج الجذور، التقويم، زراعة الأسنان، طب أسنان الأطفال، والتجميل',
    description_en: 'Orthodontics, endodontics, implants, pediatric dentistry & aesthetics'
  },
  {
    code: 'women_and_children',
    letter: 'F',
    name_ar: 'صحة المرأة والطفل',
    name_en: "Women & Children's Health",
    description_ar: 'النساء والتوليد، طب الجنين، طب الأطفال وحديثي الولادة',
    description_en: 'Obstetrics, gynecology, maternal-fetal medicine & pediatrics'
  },
  {
    code: 'ophthalmology',
    letter: 'G',
    name_ar: 'طب وجراحة العيون وتخصصاتها',
    name_en: 'Ophthalmic Specialties',
    description_ar: 'الشبكية، القرنية، المياه البيضاء والزرقاء، وعيوب الإبصار',
    description_en: 'Retina, cornea, glaucoma, pediatric ophthalmology & refractive'
  },
  {
    code: 'ent',
    letter: 'H',
    name_ar: 'الأنف والأذن والحنجرة وجراحة الرأس والرقبة',
    name_en: 'Ear, Nose & Throat (ENT)',
    description_ar: 'جراحة الأذن، الجيوب الأنفية، الأحبال الصوتية، ومقاييس السمع',
    description_en: 'Otology, rhinology, laryngology, audiology & head-neck surgery'
  },
  {
    code: 'diagnostic_and_therapeutic',
    letter: 'I',
    name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    description_ar: 'المسالك البولية، الذكورة، العلاج الطبيعي، الأشعة، والتحاليل الطبية',
    description_en: 'Urology, andrology, physiotherapy, radiology, pathology & oncology'
  }
];

export const MASTER_MEDICAL_SPECIALTIES: MedicalSpecialtyItem[] = [
  // ==========================================
  // Category A: General Medical Specialties
  // ==========================================
  {
    code: 'general_practice',
    name_ar: 'الممارسة العامة (طبيب عام)',
    name_en: 'General Practice',
    category: 'general_medical',
    category_name_ar: 'التخصصات الطبية العامة والرعاية الأولية',
    category_name_en: 'General Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'Stethoscope',
    is_active: true
  },
  {
    code: 'family_medicine',
    name_ar: 'طب الأسرة والمجتمع',
    name_en: 'Family Medicine',
    category: 'general_medical',
    category_name_ar: 'التخصصات الطبية العامة والرعاية الأولية',
    category_name_en: 'General Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'Users',
    is_active: true
  },
  {
    code: 'internal_medicine',
    name_ar: 'الأمراض الباطنية العامة',
    name_en: 'Internal Medicine',
    category: 'general_medical',
    category_name_ar: 'التخصصات الطبية العامة والرعاية الأولية',
    category_name_en: 'General Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'Activity',
    is_active: true
  },
  {
    code: 'general_surgery',
    name_ar: 'الجراحة العامة والمناظير',
    name_en: 'General Surgery',
    category: 'general_medical',
    category_name_ar: 'التخصصات الطبية العامة والرعاية الأولية',
    category_name_en: 'General Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'Scissors',
    is_active: true
  },
  {
    code: 'emergency_medicine',
    name_ar: 'طب الطوارئ والحوادث',
    name_en: 'Emergency Medicine',
    category: 'general_medical',
    category_name_ar: 'التخصصات الطبية العامة والرعاية الأولية',
    category_name_en: 'General Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'AlertCircle',
    is_active: true
  },
  {
    code: 'icu_medicine',
    name_ar: 'طب الرعاية الحرجة والعناية المركزة',
    name_en: 'Intensive Care Medicine (ICU)',
    category: 'general_medical',
    category_name_ar: 'التخصصات الطبية العامة والرعاية الأولية',
    category_name_en: 'General Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'HeartPulse',
    is_active: true
  },
  {
    code: 'geriatric_medicine',
    name_ar: 'طب وصحة المسنين',
    name_en: 'Geriatric Medicine',
    category: 'general_medical',
    category_name_ar: 'التخصصات الطبية العامة والرعاية الأولية',
    category_name_en: 'General Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'Shield',
    is_active: true
  },
  {
    code: 'preventive_medicine',
    name_ar: 'الطب الوقائي والصحة المهنية',
    name_en: 'Preventive & Occupational Medicine',
    category: 'general_medical',
    category_name_ar: 'التخصصات الطبية العامة والرعاية الأولية',
    category_name_en: 'General Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'CheckCircle2',
    is_active: true
  },

  // ==========================================
  // Category B: Surgical Specialties
  // ==========================================
  {
    code: 'orthopedic_surgery',
    name_ar: 'جراحة العظام والمفاصل والكسور',
    name_en: 'Orthopedic Surgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'orthopedics',
    icon_name: 'Bone',
    is_active: true
  },
  {
    code: 'neurosurgery',
    name_ar: 'جراحة المخ والأعصاب والعمود الفقري',
    name_en: 'Neurosurgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'neurology',
    icon_name: 'Brain',
    is_active: true
  },
  {
    code: 'cardiothoracic_surgery',
    name_ar: 'جراحة القلب والصدر',
    name_en: 'Cardiothoracic Surgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'cardiology',
    icon_name: 'Heart',
    is_active: true
  },
  {
    code: 'vascular_surgery',
    name_ar: 'جراحة الأوعية الدموية والقسطرة التداخلية',
    name_en: 'Vascular Surgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'general_template',
    icon_name: 'GitCommit',
    is_active: true
  },
  {
    code: 'plastic_surgery',
    name_ar: 'جراحة التجميل والحروق',
    name_en: 'Plastic & Aesthetic Surgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'dermatology',
    icon_name: 'Sparkles',
    is_active: true
  },
  {
    code: 'reconstructive_surgery',
    name_ar: 'الجراحة الترميمية والإصلاحية',
    name_en: 'Reconstructive Surgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'general_template',
    icon_name: 'Layers',
    is_active: true
  },
  {
    code: 'pediatric_surgery',
    name_ar: 'جراحة الأطفال والعيوب الخلقية',
    name_en: 'Pediatric Surgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'pediatrics',
    icon_name: 'Baby',
    is_active: true
  },
  {
    code: 'urological_surgery',
    name_ar: 'جراحة المسالك البولية والتناسلية',
    name_en: 'Urological Surgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'urology',
    icon_name: 'Droplet',
    is_active: true
  },
  {
    code: 'general_surgical_procedures',
    name_ar: 'الإجراءات الجراحية الصغرى واليوم الواحد',
    name_en: 'Day-Case & Minor Surgical Procedures',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'general_template',
    icon_name: 'Activity',
    is_active: true
  },
  {
    code: 'colorectal_surgery',
    name_ar: 'جراحة القولون والمستقيم والشرج',
    name_en: 'Colorectal Surgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'gastroenterology',
    icon_name: 'CircleDot',
    is_active: true
  },
  {
    code: 'bariatric_surgery',
    name_ar: 'جراحة السمنة المفرطة وتكميم المعدة',
    name_en: 'Bariatric & Metabolic Surgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'gastroenterology',
    icon_name: 'Scale',
    is_active: true
  },
  {
    code: 'ent_surgery',
    name_ar: 'جراحة الأنف والأذن والحنجرة',
    name_en: 'ENT Surgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'ent',
    icon_name: 'Headphones',
    is_active: true
  },
  {
    code: 'ophthalmic_surgery',
    name_ar: 'جراحات العيون والمياه البيضاء والليزك',
    name_en: 'Ophthalmic Surgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'ophthalmology',
    icon_name: 'Eye',
    is_active: true
  },
  {
    code: 'gynecological_surgery',
    name_ar: 'جراحة النساء والتوليد والمناظير الرحمية',
    name_en: 'Gynecological Surgery',
    category: 'surgical',
    category_name_ar: 'التخصصات الجراحية',
    category_name_en: 'Surgical Specialties',
    clinical_module: 'gynecology_obstetrics',
    icon_name: 'HeartHandshake',
    is_active: true
  },

  // ==========================================
  // Category C: Medical Specialties
  // ==========================================
  {
    code: 'cardiology',
    name_ar: 'أمراض القلب والأوعية الدموية والقسطرة',
    name_en: 'Cardiology',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'cardiology',
    icon_name: 'Heart',
    is_active: true
  },
  {
    code: 'gastroenterology',
    name_ar: 'أمراض الجهاز الهضمي والمناظير',
    name_en: 'Gastroenterology',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'gastroenterology',
    icon_name: 'Compass',
    is_active: true
  },
  {
    code: 'hepatology',
    name_ar: 'أمراض وزراعة الكبد',
    name_en: 'Hepatology',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'gastroenterology',
    icon_name: 'Activity',
    is_active: true
  },
  {
    code: 'pulmonology',
    name_ar: 'أمراض الصدر والجهاز التنفسي والحساسية',
    name_en: 'Pulmonology & Respiratory Medicine',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'pulmonology',
    icon_name: 'Wind',
    is_active: true
  },
  {
    code: 'nephrology',
    name_ar: 'أمراض وزراعة الكلى والغسيل الكلوي',
    name_en: 'Nephrology & Dialysis',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'urology',
    icon_name: 'Filter',
    is_active: true
  },
  {
    code: 'endocrinology',
    name_ar: 'الغدد الصماء والهرمونات',
    name_en: 'Endocrinology',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'Zap',
    is_active: true
  },
  {
    code: 'diabetes_metabolism',
    name_ar: 'السكري والتمثيل الغذائي ومضاعفاته',
    name_en: 'Diabetes & Metabolism',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'Droplets',
    is_active: true
  },
  {
    code: 'rheumatology',
    name_ar: 'أمراض المفاصل والروماتيزم والمناعة الذاتية',
    name_en: 'Rheumatology & Autoimmune Diseases',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'orthopedics',
    icon_name: 'Bone',
    is_active: true
  },
  {
    code: 'neurology',
    name_ar: 'أمراض المخ والأعصاب والصرع والجلطات',
    name_en: 'Neurology',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'neurology',
    icon_name: 'Cpu',
    is_active: true
  },
  {
    code: 'oncology',
    name_ar: 'علاج الأورام والطب النووي والعلاج الكيماوي',
    name_en: 'Medical Oncology',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'Target',
    is_active: true
  },
  {
    code: 'hematology',
    name_ar: 'أمراض الدم وزراعة النخاع',
    name_en: 'Hematology',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'Droplet',
    is_active: true
  },
  {
    code: 'infectious_diseases',
    name_ar: 'الأمراض المعدية والحميات والفيروسات',
    name_en: 'Infectious Diseases',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'ShieldAlert',
    is_active: true
  },
  {
    code: 'dermatology',
    name_ar: 'الأمراض الجلدية والتناسلية والليزر',
    name_en: 'Dermatology & Venereology',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'dermatology',
    icon_name: 'Sparkles',
    is_active: true
  },
  {
    code: 'allergy_immunology',
    name_ar: 'الحساسية والمناعة السريرية',
    name_en: 'Allergy & Clinical Immunology',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'pulmonology',
    icon_name: 'Feather',
    is_active: true
  },
  {
    code: 'psychiatry',
    name_ar: 'الطب النفسي وعلاج الإدمان والصحة السلوكية',
    name_en: 'Psychiatry & Behavioral Health',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'psychiatry',
    icon_name: 'Smile',
    is_active: true
  },
  {
    code: 'clinical_nutrition',
    name_ar: 'التغذية العلاجية وإدارة الوزن',
    name_en: 'Clinical Nutrition',
    category: 'medical',
    category_name_ar: 'التخصصات الطبية الباطنية والتخصصية',
    category_name_en: 'Medical Specialties',
    clinical_module: 'general_template',
    icon_name: 'Apple',
    is_active: true
  },

  // ==========================================
  // Category D: Orthopedic Subspecialties
  // ==========================================
  {
    code: 'orthopedics_general',
    name_ar: 'جراحة العظام العامة والكسور',
    name_en: 'General Orthopedics',
    category: 'orthopedic_subspecialties',
    category_name_ar: 'جراحة العظام والمفاصل وتخصصاتها الدقيقة',
    category_name_en: 'Orthopedic Subspecialties',
    clinical_module: 'orthopedics',
    icon_name: 'Bone',
    is_active: true
  },
  {
    code: 'spine_surgery',
    name_ar: 'جراحة وتشوهات وانزلاق الغضروف والعمود الفقري',
    name_en: 'Spine Surgery',
    category: 'orthopedic_subspecialties',
    category_name_ar: 'جراحة العظام والمفاصل وتخصصاتها الدقيقة',
    category_name_en: 'Orthopedic Subspecialties',
    clinical_module: 'orthopedics',
    icon_name: 'AlignVerticalDistributeCenter',
    is_active: true
  },
  {
    code: 'joint_replacement',
    name_ar: 'جراحة استبدال المفاصل (الركبة والحوض)',
    name_en: 'Joint Replacement (Arthroplasty)',
    category: 'orthopedic_subspecialties',
    category_name_ar: 'جراحة العظام والمفاصل وتخصصاتها الدقيقة',
    category_name_en: 'Orthopedic Subspecialties',
    clinical_module: 'orthopedics',
    icon_name: 'Minimize2',
    is_active: true
  },
  {
    code: 'sports_medicine',
    name_ar: 'الطب الرياضي وإصابات الملاعب ومناظير المفاصل',
    name_en: 'Sports Medicine & Arthroscopy',
    category: 'orthopedic_subspecialties',
    category_name_ar: 'جراحة العظام والمفاصل وتخصصاتها الدقيقة',
    category_name_en: 'Orthopedic Subspecialties',
    clinical_module: 'orthopedics',
    icon_name: 'Trophy',
    is_active: true
  },
  {
    code: 'hand_surgery',
    name_ar: 'جراحة اليد والطرف العلوي والجراحة الميكروسكوبية',
    name_en: 'Hand & Upper Extremity Surgery',
    category: 'orthopedic_subspecialties',
    category_name_ar: 'جراحة العظام والمفاصل وتخصصاتها الدقيقة',
    category_name_en: 'Orthopedic Subspecialties',
    clinical_module: 'orthopedics',
    icon_name: 'Hand',
    is_active: true
  },
  {
    code: 'foot_ankle_surgery',
    name_ar: 'جراحة وتشوهات القدم والكاحل',
    name_en: 'Foot & Ankle Surgery',
    category: 'orthopedic_subspecialties',
    category_name_ar: 'جراحة العظام والمفاصل وتخصصاتها الدقيقة',
    category_name_en: 'Orthopedic Subspecialties',
    clinical_module: 'orthopedics',
    icon_name: 'Footprints',
    is_active: true
  },
  {
    code: 'pediatric_orthopedics',
    name_ar: 'جراحة عظام الأطفال والتشوهات الخلقية',
    name_en: 'Pediatric Orthopedics',
    category: 'orthopedic_subspecialties',
    category_name_ar: 'جراحة العظام والمفاصل وتخصصاتها الدقيقة',
    category_name_en: 'Orthopedic Subspecialties',
    clinical_module: 'orthopedics',
    icon_name: 'Baby',
    is_active: true
  },
  {
    code: 'trauma_fracture_surgery',
    name_ar: 'جراحة الإصابات الشديدة وتثبيت الكسور المعقدة',
    name_en: 'Trauma & Fracture Surgery',
    category: 'orthopedic_subspecialties',
    category_name_ar: 'جراحة العظام والمفاصل وتخصصاتها الدقيقة',
    category_name_en: 'Orthopedic Subspecialties',
    clinical_module: 'orthopedics',
    icon_name: 'ShieldAlert',
    is_active: true
  },

  // ==========================================
  // Category E: Dentistry
  // ==========================================
  {
    code: 'general_dentistry',
    name_ar: 'طب الأسنان العام والحشوات',
    name_en: 'General Dentistry',
    category: 'dentistry',
    category_name_ar: 'طب وجراحة الفم والأسنان',
    category_name_en: 'Dentistry & Oral Surgery',
    clinical_module: 'dentistry',
    icon_name: 'Smile',
    is_active: true
  },
  {
    code: 'orthodontics',
    name_ar: 'تقويم الأسنان والفكين',
    name_en: 'Orthodontics',
    category: 'dentistry',
    category_name_ar: 'طب وجراحة الفم والأسنان',
    category_name_en: 'Dentistry & Oral Surgery',
    clinical_module: 'dentistry',
    icon_name: 'Sparkle',
    is_active: true
  },
  {
    code: 'endodontics',
    name_ar: 'علاج الجذور والأعصاب (حشو العصب)',
    name_en: 'Endodontics',
    category: 'dentistry',
    category_name_ar: 'طب وجراحة الفم والأسنان',
    category_name_en: 'Dentistry & Oral Surgery',
    clinical_module: 'dentistry',
    icon_name: 'Zap',
    is_active: true
  },
  {
    code: 'periodontics',
    name_ar: 'أمراض وجراحة اللثة والأنسجة المحيطة',
    name_en: 'Periodontics',
    category: 'dentistry',
    category_name_ar: 'طب وجراحة الفم والأسنان',
    category_name_en: 'Dentistry & Oral Surgery',
    clinical_module: 'dentistry',
    icon_name: 'Layers',
    is_active: true
  },
  {
    code: 'prosthodontics',
    name_ar: 'الاستعاضة الصناعية والتركيبات الثابتة والمتحركة',
    name_en: 'Prosthodontics',
    category: 'dentistry',
    category_name_ar: 'طب وجراحة الفم والأسنان',
    category_name_en: 'Dentistry & Oral Surgery',
    clinical_module: 'dentistry',
    icon_name: 'Shield',
    is_active: true
  },
  {
    code: 'maxillofacial_surgery',
    name_ar: 'جراحة الوجه والفكين وزراعة العظام',
    name_en: 'Oral & Maxillofacial Surgery',
    category: 'dentistry',
    category_name_ar: 'طب وجراحة الفم والأسنان',
    category_name_en: 'Dentistry & Oral Surgery',
    clinical_module: 'dentistry',
    icon_name: 'Scissors',
    is_active: true
  },
  {
    code: 'pediatric_dentistry',
    name_ar: 'طب أسنان الأطفال وذوي الاحتياجات الخاصة',
    name_en: 'Pediatric Dentistry',
    category: 'dentistry',
    category_name_ar: 'طب وجراحة الفم والأسنان',
    category_name_en: 'Dentistry & Oral Surgery',
    clinical_module: 'dentistry',
    icon_name: 'Baby',
    is_active: true
  },
  {
    code: 'dental_implants',
    name_ar: 'زراعة الأسنان والتعويضات الدقيقة',
    name_en: 'Dental Implants',
    category: 'dentistry',
    category_name_ar: 'طب وجراحة الفم والأسنان',
    category_name_en: 'Dentistry & Oral Surgery',
    clinical_module: 'dentistry',
    icon_name: 'Anchor',
    is_active: true
  },
  {
    code: 'cosmetic_dentistry',
    name_ar: 'طب الأسنان التجميلي والفينير وهوليوود سمايل',
    name_en: 'Cosmetic Dentistry',
    category: 'dentistry',
    category_name_ar: 'طب وجراحة الفم والأسنان',
    category_name_en: 'Dentistry & Oral Surgery',
    clinical_module: 'dentistry',
    icon_name: 'Sparkles',
    is_active: true
  },
  {
    code: 'restorative_dentistry',
    name_ar: 'طب الأسنان التحفظي وترميم الأسنان',
    name_en: 'Restorative Dentistry',
    category: 'dentistry',
    category_name_ar: 'طب وجراحة الفم والأسنان',
    category_name_en: 'Dentistry & Oral Surgery',
    clinical_module: 'dentistry',
    icon_name: 'RefreshCw',
    is_active: true
  },

  // ==========================================
  // Category F: Women and Children's Health
  // ==========================================
  {
    code: 'obstetrics',
    name_ar: 'التوليد ورعاية الحوامل والولادة',
    name_en: 'Obstetrics',
    category: 'women_and_children',
    category_name_ar: 'صحة المرأة والطفل',
    category_name_en: "Women & Children's Health",
    clinical_module: 'gynecology_obstetrics',
    icon_name: 'Heart',
    is_active: true
  },
  {
    code: 'gynecology',
    name_ar: 'أمراض النساء وجراحات الحوض',
    name_en: 'Gynecology',
    category: 'women_and_children',
    category_name_ar: 'صحة المرأة والطفل',
    category_name_en: "Women & Children's Health",
    clinical_module: 'gynecology_obstetrics',
    icon_name: 'Users',
    is_active: true
  },
  {
    code: 'maternal_fetal_medicine',
    name_ar: 'طب الأم والجنين والسونار رباعي الأبعاد',
    name_en: 'Maternal & Fetal Medicine',
    category: 'women_and_children',
    category_name_ar: 'صحة المرأة والطفل',
    category_name_en: "Women & Children's Health",
    clinical_module: 'gynecology_obstetrics',
    icon_name: 'Activity',
    is_active: true
  },
  {
    code: 'reproductive_medicine',
    name_ar: 'علاج العقم وتأخر الإنجاب والحقن المجهري',
    name_en: 'Reproductive Endocrinology & IVF',
    category: 'women_and_children',
    category_name_ar: 'صحة المرأة والطفل',
    category_name_en: "Women & Children's Health",
    clinical_module: 'gynecology_obstetrics',
    icon_name: 'Sparkles',
    is_active: true
  },
  {
    code: 'pediatrics',
    name_ar: 'طب الأطفال العام والنمو والتطعيمات',
    name_en: 'Pediatrics',
    category: 'women_and_children',
    category_name_ar: 'صحة المرأة والطفل',
    category_name_en: "Women & Children's Health",
    clinical_module: 'pediatrics',
    icon_name: 'Baby',
    is_active: true
  },
  {
    code: 'neonatology',
    name_ar: 'طب الأطفال حديثي الولادة والمبتسرين والحضانات',
    name_en: 'Neonatology',
    category: 'women_and_children',
    category_name_ar: 'صحة المرأة والطفل',
    category_name_en: "Women & Children's Health",
    clinical_module: 'pediatrics',
    icon_name: 'HeartPulse',
    is_active: true
  },
  {
    code: 'pediatric_cardiology',
    name_ar: 'أمراض قلب الأطفال والعيوب الخلقية',
    name_en: 'Pediatric Cardiology',
    category: 'women_and_children',
    category_name_ar: 'صحة المرأة والطفل',
    category_name_en: "Women & Children's Health",
    clinical_module: 'cardiology',
    icon_name: 'Heart',
    is_active: true
  },
  {
    code: 'pediatric_neurology',
    name_ar: 'أمراض مخ وأعصاب الأطفال وتأخر النمو',
    name_en: 'Pediatric Neurology',
    category: 'women_and_children',
    category_name_ar: 'صحة المرأة والطفل',
    category_name_en: "Women & Children's Health",
    clinical_module: 'neurology',
    icon_name: 'Brain',
    is_active: true
  },
  {
    code: 'pediatric_endocrinology',
    name_ar: 'سكر وغدد صماء ونمو الأطفال',
    name_en: 'Pediatric Endocrinology',
    category: 'women_and_children',
    category_name_ar: 'صحة المرأة والطفل',
    category_name_en: "Women & Children's Health",
    clinical_module: 'pediatrics',
    icon_name: 'Zap',
    is_active: true
  },

  // ==========================================
  // Category G: Eye Specialties
  // ==========================================
  {
    code: 'general_ophthalmology',
    name_ar: 'طب وجراحة العيون العام',
    name_en: 'General Ophthalmology',
    category: 'ophthalmology',
    category_name_ar: 'طب وجراحة العيون وتخصصاتها',
    category_name_en: 'Ophthalmic Specialties',
    clinical_module: 'ophthalmology',
    icon_name: 'Eye',
    is_active: true
  },
  {
    code: 'retina',
    name_ar: 'أمراض وجراحة الشبكية والجسم الزجاجي',
    name_en: 'Vitreoretinal Diseases & Surgery',
    category: 'ophthalmology',
    category_name_ar: 'طب وجراحة العيون وتخصصاتها',
    category_name_en: 'Ophthalmic Specialties',
    clinical_module: 'ophthalmology',
    icon_name: 'Eye',
    is_active: true
  },
  {
    code: 'cornea',
    name_ar: 'أمراض وجراحة وزراعة القرنية وسطح العين',
    name_en: 'Cornea & External Eye Diseases',
    category: 'ophthalmology',
    category_name_ar: 'طب وجراحة العيون وتخصصاتها',
    category_name_en: 'Ophthalmic Specialties',
    clinical_module: 'ophthalmology',
    icon_name: 'Eye',
    is_active: true
  },
  {
    code: 'glaucoma',
    name_ar: 'المياه الزرقاء وضغط العين (الجلوكوما)',
    name_en: 'Glaucoma',
    category: 'ophthalmology',
    category_name_ar: 'طب وجراحة العيون وتخصصاتها',
    category_name_en: 'Ophthalmic Specialties',
    clinical_module: 'ophthalmology',
    icon_name: 'Eye',
    is_active: true
  },
  {
    code: 'pediatric_ophthalmology',
    name_ar: 'عيون الأطفال وجراحة الحول',
    name_en: 'Pediatric Ophthalmology & Strabismus',
    category: 'ophthalmology',
    category_name_ar: 'طب وجراحة العيون وتخصصاتها',
    category_name_en: 'Ophthalmic Specialties',
    clinical_module: 'ophthalmology',
    icon_name: 'Eye',
    is_active: true
  },
  {
    code: 'neuro_ophthalmology',
    name_ar: 'أمراض العصب البصري والعيون العصبية',
    name_en: 'Neuro-Ophthalmology',
    category: 'ophthalmology',
    category_name_ar: 'طب وجراحة العيون وتخصصاتها',
    category_name_en: 'Ophthalmic Specialties',
    clinical_module: 'ophthalmology',
    icon_name: 'Eye',
    is_active: true
  },
  {
    code: 'refractive_surgery',
    name_ar: 'جراحات تصحيح الإبصار والليزك والفيمتو ليزك',
    name_en: 'Refractive Surgery (LASIK)',
    category: 'ophthalmology',
    category_name_ar: 'طب وجراحة العيون وتخصصاتها',
    category_name_en: 'Ophthalmic Specialties',
    clinical_module: 'ophthalmology',
    icon_name: 'Sparkles',
    is_active: true
  },

  // ==========================================
  // Category H: Ear, Nose and Throat
  // ==========================================
  {
    code: 'general_ent',
    name_ar: 'الأنف والأذن والحنجرة العام',
    name_en: 'General ENT',
    category: 'ent',
    category_name_ar: 'الأنف والأذن والحنجرة وجراحة الرأس والرقبة',
    category_name_en: 'Ear, Nose & Throat (ENT)',
    clinical_module: 'ent',
    icon_name: 'Headphones',
    is_active: true
  },
  {
    code: 'otology',
    name_ar: 'أمراض وجراحة الأذن الدقيقة وقوقعة الأذن والاتزان',
    name_en: 'Otology, Neurotology & Cochlear Implants',
    category: 'ent',
    category_name_ar: 'الأنف والأذن والحنجرة وجراحة الرأس والرقبة',
    category_name_en: 'Ear, Nose & Throat (ENT)',
    clinical_module: 'ent',
    icon_name: 'Radio',
    is_active: true
  },
  {
    code: 'rhinology',
    name_ar: 'أمراض ومناظير الجيوب الأنفية وقاع الجمجمة',
    name_en: 'Rhinology & Skull Base Surgery',
    category: 'ent',
    category_name_ar: 'الأنف والأذن والحنجرة وجراحة الرأس والرقبة',
    category_name_en: 'Ear, Nose & Throat (ENT)',
    clinical_module: 'ent',
    icon_name: 'Compass',
    is_active: true
  },
  {
    code: 'laryngology',
    name_ar: 'أمراض الحنجرة والصوت والبلع والشخير',
    name_en: 'Laryngology & Voice Disorders',
    category: 'ent',
    category_name_ar: 'الأنف والأذن والحنجرة وجراحة الرأس والرقبة',
    category_name_en: 'Ear, Nose & Throat (ENT)',
    clinical_module: 'ent',
    icon_name: 'Mic',
    is_active: true
  },
  {
    code: 'audiology',
    name_ar: 'السمعيات ومقاييس السمع والاتزان',
    name_en: 'Audiology & Vestibular Medicine',
    category: 'ent',
    category_name_ar: 'الأنف والأذن والحنجرة وجراحة الرأس والرقبة',
    category_name_en: 'Ear, Nose & Throat (ENT)',
    clinical_module: 'ent',
    icon_name: 'Activity',
    is_active: true
  },
  {
    code: 'head_neck_surgery',
    name_ar: 'جراحة الرأس والرقبة والغدد اللعابية والدرقية',
    name_en: 'Head & Neck Surgery',
    category: 'ent',
    category_name_ar: 'الأنف والأذن والحنجرة وجراحة الرأس والرقبة',
    category_name_en: 'Ear, Nose & Throat (ENT)',
    clinical_module: 'ent',
    icon_name: 'User',
    is_active: true
  },

  // ==========================================
  // Category I: Additional Specialties
  // ==========================================
  {
    code: 'urology',
    name_ar: 'أمراض وجراحة المسالك البولية وتفتيت الحصوات',
    name_en: 'Urology',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'urology',
    icon_name: 'Droplet',
    is_active: true
  },
  {
    code: 'andrology',
    name_ar: 'أمراض الذكورة والعقم والصحة الجنسية',
    name_en: 'Andrology & Men Health',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'urology',
    icon_name: 'UserCheck',
    is_active: true
  },
  {
    code: 'sleep_medicine',
    name_ar: 'طب واضطرابات النوم وانقطاع التنفس',
    name_en: 'Pulmonary & Sleep Medicine',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'pulmonology',
    icon_name: 'Moon',
    is_active: true
  },
  {
    code: 'pain_management',
    name_ar: 'علاج الآلام المزمنة وآلام العمود الفقري والأورام',
    name_en: 'Interventional Pain Management',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'orthopedics',
    icon_name: 'Zap',
    is_active: true
  },
  {
    code: 'pm_and_rehab',
    name_ar: 'الطب الطبيعي والروماتيزم والتأهيل الحركي',
    name_en: 'Physical Medicine & Rehabilitation',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'orthopedics',
    icon_name: 'Activity',
    is_active: true
  },
  {
    code: 'physiotherapy',
    name_ar: 'العلاج الطبيعي والتأهيل البدني',
    name_en: 'Physiotherapy & Physical Therapy',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'orthopedics',
    icon_name: 'Activity',
    is_active: true
  },
  {
    code: 'occupational_therapy',
    name_ar: 'العلاج الوظيفي وإعادة التأهيل',
    name_en: 'Occupational Therapy',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'general_template',
    icon_name: 'Layers',
    is_active: true
  },
  {
    code: 'speech_therapy',
    name_ar: 'أمراض التخاطب وعيوب النطق وتأخر الكلام',
    name_en: 'Speech & Language Therapy',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'general_template',
    icon_name: 'Volume2',
    is_active: true
  },
  {
    code: 'radiology',
    name_ar: 'الأشعة التشخيصية والتداخلية (رنين/مقطعية/سونار)',
    name_en: 'Diagnostic & Interventional Radiology',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'general_template',
    icon_name: 'Radio',
    is_active: true
  },
  {
    code: 'diagnostic_imaging',
    name_ar: 'التصوير الطبي والأشعة الرقمية والماموجرام',
    name_en: 'Diagnostic Imaging & Mammography',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'general_template',
    icon_name: 'Image',
    is_active: true
  },
  {
    code: 'laboratory_medicine',
    name_ar: 'الطب المخبري والتحاليل الطبية والبيولوجيا الجزيئية',
    name_en: 'Laboratory Medicine & Diagnostics',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'general_template',
    icon_name: 'FlaskConical',
    is_active: true
  },
  {
    code: 'clinical_pathology',
    name_ar: 'الباثولوجيا الإكلينيكية وأمراض الأنسجة والخلايا',
    name_en: 'Clinical Pathology & Histopathology',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'general_template',
    icon_name: 'Microscope',
    is_active: true
  },
  {
    code: 'medical_genetics',
    name_ar: 'الوراثة الطبية والإرشاد الوراثي',
    name_en: 'Medical Genetics & Genomics',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'general_template',
    icon_name: 'Dna',
    is_active: true
  },
  {
    code: 'anesthesiology',
    name_ar: 'التخدير وعلاج الألم الجراحي',
    name_en: 'Anesthesiology',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'general_template',
    icon_name: 'Shield',
    is_active: true
  },
  {
    code: 'palliative_care',
    name_ar: 'الرعاية التلطيفية وتخفيف المعاناة',
    name_en: 'Palliative Care',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'general_template',
    icon_name: 'Heart',
    is_active: true
  },
  {
    code: 'dietetics',
    name_ar: 'الحميات والأنظمة الغذائية المتخصصة',
    name_en: 'Nutrition & Dietetics',
    category: 'diagnostic_and_therapeutic',
    category_name_ar: 'تخصصات إضافية، تأهيلية وتشخيصية',
    category_name_en: 'Diagnostic, Therapeutic & Supportive Specialties',
    clinical_module: 'general_template',
    icon_name: 'Coffee',
    is_active: true
  }
];

// Helper to look up specialty by code
export const getSpecialtyByCode = (code: string): MedicalSpecialtyItem | undefined => {
  return MASTER_MEDICAL_SPECIALTIES.find(s => s.code === code);
};

// Helper to resolve the matching ClinicalModuleType for any specialty code
export const resolveClinicalModule = (code: string): ClinicalModuleType => {
  const item = getSpecialtyByCode(code);
  if (item) return item.clinical_module;
  const c = code.toLowerCase();
  if (c.includes('ortho') || c.includes('bone') || c.includes('spine')) return 'orthopedics';
  if (c.includes('dent') || c.includes('oral') || c.includes('teeth')) return 'dentistry';
  if (c.includes('derm') || c.includes('skin')) return 'dermatology';
  if (c.includes('eye') || c.includes('ophthalm')) return 'ophthalmology';
  if (c.includes('cardio') || c.includes('heart')) return 'cardiology';
  if (c.includes('gastro') || c.includes('hepato') || c.includes('digest')) return 'gastroenterology';
  if (c.includes('ped') || c.includes('child') || c.includes('neo')) return 'pediatrics';
  if (c.includes('gyn') || c.includes('obs') || c.includes('women')) return 'gynecology_obstetrics';
  if (c.includes('neuro') || c.includes('brain')) return 'neurology';
  if (c.includes('pulm') || c.includes('resp') || c.includes('chest') || c.includes('lung')) return 'pulmonology';
  if (c.includes('ent') || c.includes('oto') || c.includes('ear') || c.includes('nose')) return 'ent';
  if (c.includes('uro') || c.includes('andro') || c.includes('renal')) return 'urology';
  if (c.includes('psych') || c.includes('mental')) return 'psychiatry';
  return 'general_template';
};

// Helper to get all specialties belonging to a category
export const getSpecialtiesByCategory = (category: SpecialtyCategoryCode): MedicalSpecialtyItem[] => {
  return MASTER_MEDICAL_SPECIALTIES.filter(s => s.category === category && s.is_active);
};
