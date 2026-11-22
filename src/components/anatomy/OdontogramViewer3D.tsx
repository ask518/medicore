// ============================================================================
// MEDICORE – High-End Medical-Grade 3D Dental Engine (Three.js WebGL)
// Loads Authentic Anatomical 3D Teeth & Jaws Model (BodyParts3D GLB Dataset)
// OrbitControls 360°, Maxilla/Mandible Arch View, Realistic Enamel, Gold/Zirconia Crowns
// ============================================================================

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DentalCondition, ToothRecord, ToothSurface } from '../../types/specialty';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Smile, RotateCcw, ZoomIn, ZoomOut, Eye, Check, X, 
  Sparkles, DollarSign, Layers, Camera, Loader2, ShieldAlert
} from 'lucide-react';

interface OdontogramViewer3DProps {
  records: Record<number, ToothRecord>;
  onChange: (records: Record<number, ToothRecord>) => void;
  readOnly?: boolean;
}

type ArchFilter = 'both' | 'upper' | 'lower';

interface ToothMeshMeta {
  toothNumber: number;
  nodeName: string;
  name_ar: string;
  name_en: string;
  isUpper: boolean;
  mesh: THREE.Mesh;
}

const NODE_TO_FDI: Record<string, { fdi: number; isUpper: boolean; ar: string; en: string }> = {
  'upper-right-central-incisor': { fdi: 11, isUpper: true, ar: 'القاطع المركزي العلوي الأيمن (11)', en: 'Upper Right Central Incisor (11)' },
  'upper-right-lateral-incisor': { fdi: 12, isUpper: true, ar: 'القاطع الجانبي العلوي الأيمن (12)', en: 'Upper Right Lateral Incisor (12)' },
  'upper-right-canine': { fdi: 13, isUpper: true, ar: 'الناب العلوي الأيمن (13)', en: 'Upper Right Canine (13)' },
  'upper-right-first-premolar': { fdi: 14, isUpper: true, ar: 'الضاحك الأول العلوي الأيمن (14)', en: 'Upper Right First Premolar (14)' },
  'upper-right-second-premolar': { fdi: 15, isUpper: true, ar: 'الضاحك الثاني العلوي الأيمن (15)', en: 'Upper Right Second Premolar (15)' },
  'upper-right-first-molar': { fdi: 16, isUpper: true, ar: 'الضرس الأول العلوي الأيمن (16)', en: 'Upper Right First Molar (16)' },
  'upper-right-second-molar': { fdi: 17, isUpper: true, ar: 'الضرس الثاني العلوي الأيمن (17)', en: 'Upper Right Second Molar (17)' },

  'upper-left-central-incisor': { fdi: 21, isUpper: true, ar: 'القاطع المركزي العلوي الأيسر (21)', en: 'Upper Left Central Incisor (21)' },
  'upper-left-lateral-incisor': { fdi: 22, isUpper: true, ar: 'القاطع الجانبي العلوي الأيسر (22)', en: 'Upper Left Lateral Incisor (22)' },
  'upper-left-canine': { fdi: 23, isUpper: true, ar: 'الناب العلوي الأيسر (23)', en: 'Upper Left Canine (23)' },
  'upper-left-first-premolar': { fdi: 24, isUpper: true, ar: 'الضاحك الأول العلوي الأيسر (24)', en: 'Upper Left First Premolar (24)' },
  'upper-left-second-premolar': { fdi: 25, isUpper: true, ar: 'الضاحك الثاني العلوي الأيسر (25)', en: 'Upper Left Second Premolar (25)' },
  'upper-left-first-molar': { fdi: 26, isUpper: true, ar: 'الضرس الأول العلوي الأيسر (26)', en: 'Upper Left First Molar (26)' },
  'upper-left-second-molar': { fdi: 27, isUpper: true, ar: 'الضرس الثاني العلوي الأيسر (27)', en: 'Upper Left Second Molar (27)' },

  'lower-left-central-incisor': { fdi: 31, isUpper: false, ar: 'القاطع المركزي السفلي الأيسر (31)', en: 'Lower Left Central Incisor (31)' },
  'lower-left-lateral-incisor': { fdi: 32, isUpper: false, ar: 'القاطع الجانبي السفلي الأيسر (32)', en: 'Lower Left Lateral Incisor (32)' },
  'lower-left-canine': { fdi: 33, isUpper: false, ar: 'الناب السفلي الأيسر (33)', en: 'Lower Left Canine (33)' },
  'lower-left-first-premolar': { fdi: 34, isUpper: false, ar: 'الضاحك الأول السفلي الأيسر (34)', en: 'Lower Left First Premolar (34)' },
  'lower-left-second-premolar': { fdi: 35, isUpper: false, ar: 'الضاحك الثاني السفلي الأيسر (35)', en: 'Lower Left Second Premolar (35)' },
  'lower-left-first-molar': { fdi: 36, isUpper: false, ar: 'الضرس الأول السفلي الأيسر (36)', en: 'Lower Left First Molar (36)' },
  'lower-left-second-molar': { fdi: 37, isUpper: false, ar: 'الضرس الثاني السفلي الأيسر (37)', en: 'Lower Left Second Molar (37)' },

  'lower-right-central-incisor': { fdi: 41, isUpper: false, ar: 'القاطع المركزي السفلي الأيمن (41)', en: 'Lower Right Central Incisor (41)' },
  'lower-right-lateral-incisor': { fdi: 42, isUpper: false, ar: 'القاطع الجانبي السفلي الأيمن (42)', en: 'Lower Right Lateral Incisor (42)' },
  'lower-right-canine': { fdi: 43, isUpper: false, ar: 'الناب السفلي الأيمن (43)', en: 'Lower Right Canine (43)' },
  'lower-right-first-premolar': { fdi: 44, isUpper: false, ar: 'الضاحك الأول السفلي الأيمن (44)', en: 'Lower Right First Premolar (44)' },
  'lower-right-second-premolar': { fdi: 45, isUpper: false, ar: 'الضاحك الثاني السفلي الأيمن (45)', en: 'Lower Right Second Premolar (45)' },
  'lower-right-first-molar': { fdi: 46, isUpper: false, ar: 'الضرس الأول السفلي الأيمن (46)', en: 'Lower Right First Molar (46)' },
  'lower-right-second-molar': { fdi: 47, isUpper: false, ar: 'الضرس الثاني السفلي الأيمن (47)', en: 'Lower Right Second Molar (47)' },
};

export const OdontogramViewer3D: React.FC<OdontogramViewer3DProps> = ({
  records,
  onChange,
  readOnly = false,
}) => {
  const { locale, t } = useLanguage();
  const mountRef = useRef<HTMLDivElement>(null);

  // States
  const [archFilter, setArchFilter] = useState<ArchFilter>('both');
  const [hoveredTooth, setHoveredTooth] = useState<ToothMeshMeta | null>(null);
  const [activeModalTooth, setActiveModalTooth] = useState<ToothMeshMeta | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<number>(0);

  // Modal edit fields
  const [condition, setCondition] = useState<DentalCondition>('sound');
  const [surfaces, setSurfaces] = useState<ToothSurface[]>([]);
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState<number>(0);
  const [completed, setCompleted] = useState<boolean>(false);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const toothMeshesRef = useRef<ToothMeshMeta[]>([]);
  const teethModelRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = 560;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 1.8, 4.2);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.0;
    controls.maxDistance = 8.0;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);

    const cyanRim = new THREE.DirectionalLight(0x38BDF8, 0.7);
    cyanRim.position.set(-5, -3, 4);
    scene.add(cyanRim);

    const topFill = new THREE.DirectionalLight(0xFDFBF7, 0.8);
    topFill.position.set(0, 6, -3);
    scene.add(topFill);

    // 6. Load Authentic 3D Teeth GLB
    const loader = new GLTFLoader();
    setIsLoading(true);

    loader.load(
      '/models/teeth.glb',
      (gltf) => {
        const model = gltf.scene;
        teethModelRef.current = model;

        // Auto center and scale
        const bbox = new THREE.Box3().setFromObject(model);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());

        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;

        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 2.8 / maxDim;
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);

        const meshesList: ToothMeshMeta[] = [];

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            const name = child.name.toLowerCase();
            const mapped = NODE_TO_FDI[name];

            if (mapped) {
              const toothMeta: ToothMeshMeta = {
                toothNumber: mapped.fdi,
                nodeName: child.name,
                name_ar: mapped.ar,
                name_en: mapped.en,
                isUpper: mapped.isUpper,
                mesh: child,
              };

              child.userData = { toothMeta };
              meshesList.push(toothMeta);
            } else if (name.includes('gum')) {
              // Gingival gum material
              child.material = new THREE.MeshStandardMaterial({
                color: 0xDC6576,
                roughness: 0.35,
                metalness: 0.05,
              });
            } else if (name.includes('maxilla') || name.includes('mandible')) {
              // Jaw bone material
              child.material = new THREE.MeshStandardMaterial({
                color: 0xEAD8C0,
                roughness: 0.5,
                metalness: 0.05,
              });
            }
          }
        });

        toothMeshesRef.current = meshesList;
        scene.add(model);
        setIsLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (err) => {
        console.error('Failed to load teeth GLB:', err);
        setIsLoading(false);
      }
    );

    // 7. Raycasting for selecting teeth
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getIntersectedTooth = (e: MouseEvent): ToothMeshMeta | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      if (!teethModelRef.current) return null;
      const intersects = raycaster.intersectObjects(teethModelRef.current.children, true);

      if (intersects.length > 0) {
        let curr: THREE.Object3D | null = intersects[0].object;
        while (curr) {
          if (curr.userData && curr.userData.toothMeta) {
            return curr.userData.toothMeta as ToothMeshMeta;
          }
          curr = curr.parent;
        }
      }
      return null;
    };

    const handlePointerMove = (e: MouseEvent) => {
      const hit = getIntersectedTooth(e);
      setHoveredTooth(hit);
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    };

    const handleClick = (e: MouseEvent) => {
      if (readOnly) return;
      const hit = getIntersectedTooth(e);
      if (hit) {
        openToothModal(hit);
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousemove', handlePointerMove);
    dom.addEventListener('click', handleClick);

    // 8. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousemove', handlePointerMove);
      dom.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, []);

  // Update Tooth Materials based on records & Hover
  useEffect(() => {
    if (!toothMeshesRef.current.length) return;

    toothMeshesRef.current.forEach((tMeta) => {
      const rec = records[tMeta.toothNumber];
      const isHovered = hoveredTooth?.toothNumber === tMeta.toothNumber;

      let color = 0xFAF7EE; // Realistic pearlescent enamel
      let roughness = 0.22;
      let metalness = 0.05;
      let opacity = 1.0;
      let transparent = false;
      let wireframe = false;
      let emissive = 0x000000;
      let emissiveIntensity = 0.0;

      if (rec) {
        switch (rec.condition) {
          case 'caries':
            color = 0x881337; // Deep cavitation maroon
            emissive = 0x4C0519;
            emissiveIntensity = 0.6;
            break;
          case 'crown':
            color = 0xF59E0B; // 24K Gold / Ceramic
            metalness = 0.85;
            roughness = 0.18;
            break;
          case 'amalgam_filling':
            color = 0x64748B; // Slate metallic silver
            metalness = 0.9;
            roughness = 0.25;
            break;
          case 'composite_filling':
            color = 0x38BDF8; // Composite boundary indicator
            emissive = 0x0284C7;
            emissiveIntensity = 0.4;
            break;
          case 'root_canal':
            color = 0xA855F7; // Glowing endodontic purple
            emissive = 0x7E22CE;
            emissiveIntensity = 0.5;
            break;
          case 'implant':
            color = 0x94A3B8; // Titanium screw
            metalness = 0.95;
            roughness = 0.15;
            break;
          case 'missing':
          case 'extraction_indicated':
            color = 0x334155;
            transparent = true;
            opacity = 0.15;
            wireframe = true;
            break;
          default:
            color = 0xFAF7EE;
            break;
        }
      }

      if (isHovered) {
        emissive = 0x10B981; // Bright emerald highlight
        emissiveIntensity = 0.8;
      }

      tMeta.mesh.material = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        opacity,
        transparent,
        wireframe,
        emissive,
        emissiveIntensity,
      });
    });
  }, [records, hoveredTooth]);

  // Handle Arch Filter (Upper vs Lower vs Both)
  useEffect(() => {
    if (!toothMeshesRef.current.length || !teethModelRef.current) return;

    toothMeshesRef.current.forEach((tMeta) => {
      if (archFilter === 'both') {
        tMeta.mesh.visible = true;
      } else if (archFilter === 'upper') {
        tMeta.mesh.visible = tMeta.isUpper;
      } else if (archFilter === 'lower') {
        tMeta.mesh.visible = !tMeta.isUpper;
      }
    });

    // Also toggle gums
    teethModelRef.current.traverse((child) => {
      const n = child.name.toLowerCase();
      if (n.includes('upper-gum') || n.includes('maxilla')) {
        child.visible = archFilter === 'both' || archFilter === 'upper';
      }
      if (n.includes('lower-gum') || n.includes('mandible')) {
        child.visible = archFilter === 'both' || archFilter === 'lower';
      }
    });
  }, [archFilter]);

  const openToothModal = (toothMeta: ToothMeshMeta) => {
    setActiveModalTooth(toothMeta);
    const existing = records[toothMeta.toothNumber];
    if (existing) {
      setCondition(existing.condition);
      setSurfaces(existing.surfaces || []);
      setNotes(existing.notes || '');
      setCost(existing.cost || 0);
      setCompleted(existing.completed || false);
    } else {
      setCondition('caries');
      setSurfaces(['O']);
      setNotes('');
      setCost(400);
      setCompleted(false);
    }
  };

  const handleSaveTooth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalTooth) return;

    const updated: ToothRecord = {
      toothNumber: activeModalTooth.toothNumber,
      condition,
      surfaces,
      notes,
      cost,
      completed,
    };

    onChange({
      ...records,
      [activeModalTooth.toothNumber]: updated,
    });

    setActiveModalTooth(null);
  };

  const handleDeleteToothRecord = (num: number) => {
    const next = { ...records };
    delete next[num];
    onChange(next);
    setActiveModalTooth(null);
  };

  const setCameraPreset = (preset: 'front' | 'upper_occ' | 'lower_occ') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (preset === 'front') {
      cam.position.set(0, 0.4, 4.2);
      ctrl.target.set(0, 0, 0);
    } else if (preset === 'upper_occ') {
      setArchFilter('upper');
      cam.position.set(0, 3.8, 0.5);
      ctrl.target.set(0, 0, 0);
    } else if (preset === 'lower_occ') {
      setArchFilter('lower');
      cam.position.set(0, -3.8, 0.5);
      ctrl.target.set(0, 0, 0);
    }
    ctrl.update();
  };

  const toggleSurface = (surf: ToothSurface) => {
    if (surfaces.includes(surf)) {
      setSurfaces(surfaces.filter((s) => s !== surf));
    } else {
      setSurfaces([...surfaces, surf]);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col relative text-slate-100">
      {/* 3D Viewport Header */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Smile className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-white tracking-wide">
                {locale === 'ar' ? 'المخطط السني ثلاثي الأبعاد 3D WebGL (أقواس الفكين والأسنان التشريحية)' : '3D WebGL Dental Engine (Anatomical Arches & Teeth)'}
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Medical-Grade 3D
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {locale === 'ar' 
                ? 'أسنان تشريحية مجسمة كاملة مع اللثة وعظام الفكين، تدوير 360°، طرابيش زيركون، علاج جذور وغرسات' 
                : 'Authentic 3D sculpted teeth with gingiva & jaw bones, 360° orbit, crowns, endo & implants'}
            </p>
          </div>
        </div>

        {/* View & Arch Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Arch Filter */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setArchFilter('both')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                archFilter === 'both' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              {locale === 'ar' ? 'الفكان معاً' : 'Both'}
            </button>
            <button
              type="button"
              onClick={() => setArchFilter('upper')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                archFilter === 'upper' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              {locale === 'ar' ? 'العلوي (Maxilla)' : 'Maxilla'}
            </button>
            <button
              type="button"
              onClick={() => setArchFilter('lower')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                archFilter === 'lower' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              {locale === 'ar' ? 'السفلي (Mandible)' : 'Mandible'}
            </button>
          </div>

          {/* Camera Angles */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setCameraPreset('front')}
              className="px-2.5 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'أمامي (الابتسامة)' : 'Front Smile'}
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('upper_occ')}
              className="px-2.5 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'أطباقي علوي' : 'Upper Occ'}
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('lower_occ')}
              className="px-2.5 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'أطباقي سفلي' : 'Lower Occ'}
            </button>
          </div>

          {/* Reset Orbit */}
          <button
            type="button"
            onClick={() => setCameraPreset('front')}
            title={locale === 'ar' ? 'إعادة ضبط المنظر' : 'Reset View'}
            className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Mount */}
      <div className="relative w-full h-[560px] bg-gradient-to-b from-[#080C16] to-[#03060E] overflow-hidden select-none">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            <div className="text-center">
              <h4 className="font-bold text-white text-sm">
                {locale === 'ar' ? 'جاري تحميل نموذج الأسنان والفكين التشريحي 3D...' : 'Loading Anatomical Dental 3D Model...'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {loadProgress > 0 ? `${loadProgress}%` : locale === 'ar' ? 'يرجى الانتظار ثوانٍ معدودة' : 'Preparing WebGL dental arches...'}
              </p>
            </div>
          </div>
        )}

        {/* Hover Tooth Dynamic HUD */}
        {hoveredTooth && (
          <div className="absolute top-4 left-4 z-10 bg-slate-900/90 border border-cyan-500/40 rounded-xl px-4 py-2.5 backdrop-blur-md shadow-2xl flex items-center gap-3 animate-fade-in pointer-events-none">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center font-black text-cyan-300 text-sm">
              {hoveredTooth.toothNumber}
            </div>
            <div>
              <div className="font-bold text-sm text-white">
                {locale === 'ar' ? hoveredTooth.name_ar : hoveredTooth.name_en}
              </div>
              <div className="text-[11px] text-cyan-400 font-medium">
                {records[hoveredTooth.toothNumber] ? (
                  <span className="text-amber-400 font-bold">
                    {records[hoveredTooth.toothNumber].condition.toUpperCase()} 
                    {records[hoveredTooth.toothNumber].surfaces.length > 0 && ` (${records[hoveredTooth.toothNumber].surfaces.join('')})`}
                  </span>
                ) : (
                  <span>{locale === 'ar' ? 'سليم طبيعي (Sound)' : 'Healthy / Sound'}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Orbit Helper Indicator */}
        <div className="absolute bottom-3 right-4 z-10 pointer-events-none flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/70 px-3 py-1.5 rounded-lg border border-slate-800">
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
          <span>{locale === 'ar' ? 'اسحب بالماوس للتدوير 360° | عجلات الماوس للتكبير | اضغط على أي سن للتشخيص' : 'Drag to orbit 360° | Scroll to zoom | Click tooth to diagnose'}</span>
        </div>

        {/* Clinical Condition Legend */}
        <div className="absolute bottom-3 left-4 z-10 hidden sm:flex items-center gap-3 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span> {locale === 'ar' ? 'تسوس' : 'Caries'}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> {locale === 'ar' ? 'طربوش' : 'Crown'}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span> {locale === 'ar' ? 'سحب عصب' : 'Endo'}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span> {locale === 'ar' ? 'حشو كمبوزيت' : 'Composite'}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span> {locale === 'ar' ? 'غرسة' : 'Implant'}</span>
        </div>
      </div>

      {/* Clinical Finding Modal */}
      {activeModalTooth && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center font-black text-cyan-300 text-lg">
                  {activeModalTooth.toothNumber}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {locale === 'ar' ? activeModalTooth.name_ar : activeModalTooth.name_en}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {locale === 'ar' ? 'توثيق الإجراء السني والأسطح المتأثرة' : 'Document dental pathology & affected surfaces'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalTooth(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTooth} className="space-y-4 mt-4">
              {/* Clinical Condition Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {locale === 'ar' ? 'الحالة التشخيصية (Condition)' : 'Diagnosis Condition'}
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as DentalCondition)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="sound">{locale === 'ar' ? 'سليم وطبيعي (Sound)' : 'Sound / Healthy'}</option>
                  <option value="caries">{locale === 'ar' ? 'تسوس (Caries)' : 'Dental Caries'}</option>
                  <option value="composite_filling">{locale === 'ar' ? 'حشو تجميلي ليزر (Composite)' : 'Composite Filling'}</option>
                  <option value="amalgam_filling">{locale === 'ar' ? 'حشو أملغم فضي (Amalgam)' : 'Amalgam Filling'}</option>
                  <option value="crown">{locale === 'ar' ? 'طربوش / تاج (Crown - Zirconia/Gold)' : 'Crown (Zirconia/Gold)'}</option>
                  <option value="root_canal">{locale === 'ar' ? 'علاج جذور / سحب عصب (Endodontics)' : 'Root Canal Therapy'}</option>
                  <option value="implant">{locale === 'ar' ? 'غرسة تيتانيوم (Dental Implant)' : 'Titanium Implant'}</option>
                  <option value="missing">{locale === 'ar' ? 'مفقود / مخلوع (Missing)' : 'Missing / Extracted'}</option>
                  <option value="extraction_indicated">{locale === 'ar' ? 'مؤشر للخلع (Extraction Indicated)' : 'Extraction Indicated'}</option>
                  <option value="fractured">{locale === 'ar' ? 'كسر بالسن (Fractured)' : 'Fractured Tooth'}</option>
                </select>
              </div>

              {/* 5 Surfaces Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {locale === 'ar' ? 'الأسطح السنية المتأثرة (Surfaces)' : 'Affected Surfaces'}
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { code: 'O' as ToothSurface, label_ar: 'أطباقي (O)', label_en: 'Occlusal' },
                    { code: 'M' as ToothSurface, label_ar: 'إنسي (M)', label_en: 'Mesial' },
                    { code: 'D' as ToothSurface, label_ar: 'وحشي (D)', label_en: 'Distal' },
                    { code: 'B' as ToothSurface, label_ar: 'دهليزي (B)', label_en: 'Buccal' },
                    { code: 'L' as ToothSurface, label_ar: 'لساني (L)', label_en: 'Lingual' },
                  ].map((surf) => (
                    <button
                      key={surf.code}
                      type="button"
                      onClick={() => toggleSurface(surf.code)}
                      className={`p-2 rounded-xl text-center font-bold text-xs border transition-all ${
                        surfaces.includes(surf.code)
                          ? 'bg-cyan-600 text-white border-cyan-400 shadow-md'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <div>{surf.code}</div>
                      <div className="text-[9px] font-normal opacity-80">{locale === 'ar' ? surf.label_ar : surf.label_en}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cost & Completion */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {locale === 'ar' ? 'التكلفة التقديرية (EGP)' : 'Estimated Cost'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={cost}
                      onChange={(e) => setCost(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 pl-8"
                    />
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-750">
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={(e) => setCompleted(e.target.checked)}
                      className="rounded text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-200">
                      {locale === 'ar' ? 'تم اكتمال العلاج' : 'Treatment Completed'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {locale === 'ar' ? 'ملاحظات إكلينيكية وتفاصيل العلاج' : 'Clinical Treatment Notes'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={locale === 'ar' ? 'مثال: تم برد السن وأخذ مقاس للتاج الزيركونيوم...' : 'e.g. Tooth prepped, shade A2 recorded...'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                {records[activeModalTooth.toothNumber] ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteToothRecord(activeModalTooth.toothNumber)}
                    className="px-3 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition-all"
                  >
                    {locale === 'ar' ? 'حذف التشخيص (إعادة سليم)' : 'Clear Record'}
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModalTooth(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl shadow-lg shadow-cyan-600/30 transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {locale === 'ar' ? 'حفظ في السجل السني' : 'Save Tooth'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
