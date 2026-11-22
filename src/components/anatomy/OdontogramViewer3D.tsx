// ============================================================================
// MEDICORE – High-End 3D Interactive Dental Engine (Three.js WebGL Odontogram)
// True 3D Maxillary & Mandibular Arches, Anatomical Teeth with Roots & Cusps,
// Dynamic Clinical Pathologies (Caries, Zirconia/Gold Crowns, Implants, Endo, Fillings)
// ============================================================================

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { DentalCondition, ToothRecord, ToothSurface } from '../../types/specialty';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Smile, RotateCcw, ZoomIn, ZoomOut, Eye, Check, X, 
  Sparkles, DollarSign, Layers, Camera, ShieldAlert
} from 'lucide-react';

interface OdontogramViewer3DProps {
  records: Record<number, ToothRecord>;
  onChange: (records: Record<number, ToothRecord>) => void;
  readOnly?: boolean;
}

type ArchFilter = 'both' | 'upper' | 'lower';
type CameraView = 'perspective' | 'frontal' | 'occlusal_upper' | 'occlusal_lower';

interface ToothMeshMeta {
  toothNumber: number;
  name_ar: string;
  name_en: string;
  isUpper: boolean;
  type: 'incisor' | 'canine' | 'premolar' | 'molar';
  mesh: THREE.Group;
}

export const OdontogramViewer3D: React.FC<OdontogramViewer3DProps> = ({
  records,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();
  const mountRef = useRef<HTMLDivElement>(null);

  // States
  const [archFilter, setArchFilter] = useState<ArchFilter>('both');
  const [dentitionType, setDentitionType] = useState<'adult' | 'pediatric'>('adult');
  const [hoveredTooth, setHoveredTooth] = useState<ToothMeshMeta | null>(null);
  const [activeModalTooth, setActiveModalTooth] = useState<ToothMeshMeta | null>(null);

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
  const toothMeshesRef = useRef<ToothMeshMeta[]>([]);
  const upperArchGroupRef = useRef<THREE.Group | null>(null);
  const lowerArchGroupRef = useRef<THREE.Group | null>(null);

  // Mouse drag & interaction
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const rotationTargetRef = useRef({ x: 0.3, y: 0 });

  // Tooth Names dictionary (FDI)
  const getToothName = (num: number) => {
    const isAr = locale === 'ar';
    const names: Record<number, { ar: string; en: string; type: 'incisor' | 'canine' | 'premolar' | 'molar' }> = {
      // Upper Right (Q1)
      18: { ar: 'ضرس العقل العلوي الأيمن (18)', en: 'Upper Right Third Molar (18)', type: 'molar' },
      17: { ar: 'الضرس الثاني العلوي الأيمن (17)', en: 'Upper Right Second Molar (17)', type: 'molar' },
      16: { ar: 'الضرس الأول العلوي الأيمن (16)', en: 'Upper Right First Molar (16)', type: 'molar' },
      15: { ar: 'الضاحك الثاني العلوي الأيمن (15)', en: 'Upper Right Second Premolar (15)', type: 'premolar' },
      14: { ar: 'الضاحك الأول العلوي الأيمن (14)', en: 'Upper Right First Premolar (14)', type: 'premolar' },
      13: { ar: 'الناب العلوي الأيمن (13)', en: 'Upper Right Canine (13)', type: 'canine' },
      12: { ar: 'القاطع الجانبي العلوي الأيمن (12)', en: 'Upper Right Lateral Incisor (12)', type: 'incisor' },
      11: { ar: 'القاطع المركزي العلوي الأيمن (11)', en: 'Upper Right Central Incisor (11)', type: 'incisor' },
      // Upper Left (Q2)
      21: { ar: 'القاطع المركزي العلوي الأيسر (21)', en: 'Upper Left Central Incisor (21)', type: 'incisor' },
      22: { ar: 'القاطع الجانبي العلوي الأيسر (22)', en: 'Upper Left Lateral Incisor (22)', type: 'incisor' },
      23: { ar: 'الناب العلوي الأيسر (23)', en: 'Upper Left Canine (23)', type: 'canine' },
      24: { ar: 'الضاحك الأول العلوي الأيسر (24)', en: 'Upper Left First Premolar (24)', type: 'premolar' },
      25: { ar: 'الضاحك الثاني العلوي الأيسر (25)', en: 'Upper Left Second Premolar (25)', type: 'premolar' },
      26: { ar: 'الضرس الأول العلوي الأيسر (26)', en: 'Upper Left First Molar (26)', type: 'molar' },
      27: { ar: 'الضرس الثاني العلوي الأيسر (27)', en: 'Upper Left Second Molar (27)', type: 'molar' },
      28: { ar: 'ضرس العقل العلوي الأيسر (28)', en: 'Upper Left Third Molar (28)', type: 'molar' },
      // Lower Left (Q3)
      38: { ar: 'ضرس العقل السفلي الأيسر (38)', en: 'Lower Left Third Molar (38)', type: 'molar' },
      37: { ar: 'الضرس الثاني السفلي الأيسر (37)', en: 'Lower Left Second Molar (37)', type: 'molar' },
      36: { ar: 'الضرس الأول السفلي الأيسر (36)', en: 'Lower Left First Molar (36)', type: 'molar' },
      35: { ar: 'الضاحك الثاني السفلي الأيسر (35)', en: 'Lower Left Second Premolar (35)', type: 'premolar' },
      34: { ar: 'الضاحك الأول السفلي الأيسر (34)', en: 'Lower Left First Premolar (34)', type: 'premolar' },
      33: { ar: 'الناب السفلي الأيسر (33)', en: 'Lower Left Canine (33)', type: 'canine' },
      32: { ar: 'القاطع الجانبي السفلي الأيسر (32)', en: 'Lower Left Lateral Incisor (32)', type: 'incisor' },
      31: { ar: 'القاطع المركزي السفلي الأيسر (31)', en: 'Lower Left Central Incisor (31)', type: 'incisor' },
      // Lower Right (Q4)
      41: { ar: 'القاطع المركزي السفلي الأيمن (41)', en: 'Lower Right Central Incisor (41)', type: 'incisor' },
      42: { ar: 'القاطع الجانبي السفلي الأيمن (42)', en: 'Lower Right Lateral Incisor (42)', type: 'incisor' },
      43: { ar: 'الناب السفلي الأيمن (43)', en: 'Lower Right Canine (43)', type: 'canine' },
      44: { ar: 'الضاحك الأول السفلي الأيمن (44)', en: 'Lower Right First Premolar (44)', type: 'premolar' },
      45: { ar: 'الضاحك الثاني السفلي الأيمن (45)', en: 'Lower Right Second Premolar (45)', type: 'premolar' },
      46: { ar: 'الضرس الأول السفلي الأيمن (46)', en: 'Lower Right First Molar (46)', type: 'molar' },
      47: { ar: 'الضرس الثاني السفلي الأيمن (47)', en: 'Lower Right Second Molar (47)', type: 'molar' },
      48: { ar: 'ضرس العقل السفلي الأيمن (48)', en: 'Lower Right Third Molar (48)', type: 'molar' },
    };

    return names[num] || { 
      ar: `سن رقم ${num}`, 
      en: `Tooth #${num}`, 
      type: num % 10 >= 6 ? 'molar' : num % 10 >= 4 ? 'premolar' : num % 10 === 3 ? 'canine' : 'incisor' 
    };
  };

  // Helper to build 3D tooth geometry
  const createTooth3D = (type: 'incisor' | 'canine' | 'premolar' | 'molar', isUpper: boolean) => {
    const group = new THREE.Group();

    // 1. Crown Geometry
    let crownGeo: THREE.BufferGeometry;
    if (type === 'incisor') {
      crownGeo = new THREE.BoxGeometry(0.55, 0.7, 0.35);
    } else if (type === 'canine') {
      crownGeo = new THREE.ConeGeometry(0.35, 0.85, 8);
    } else if (type === 'premolar') {
      crownGeo = new THREE.CylinderGeometry(0.42, 0.45, 0.65, 8);
    } else {
      // Molar: broad multi-cusp top
      crownGeo = new THREE.BoxGeometry(0.85, 0.75, 0.8);
    }

    const defaultMat = new THREE.MeshStandardMaterial({
      color: 0xFDFBF7,
      roughness: 0.25,
      metalness: 0.05,
    });

    const crownMesh = new THREE.Mesh(crownGeo, defaultMat);
    crownMesh.castShadow = true;
    crownMesh.receiveShadow = true;
    crownMesh.name = 'crown';
    group.add(crownMesh);

    // 2. Root Geometry
    const rootMat = new THREE.MeshStandardMaterial({
      color: 0xEAD8C0,
      roughness: 0.4,
      metalness: 0.0,
    });

    const rootLength = type === 'canine' ? 1.1 : type === 'molar' ? 0.9 : 0.8;
    const rootDir = isUpper ? 1 : -1;

    if (type === 'molar') {
      // 2 roots for visual realism
      const root1 = new THREE.Mesh(new THREE.ConeGeometry(0.2, rootLength, 6), rootMat);
      root1.position.set(-0.25, rootDir * (0.35 + rootLength / 2), 0);
      root1.rotation.z = isUpper ? Math.PI : 0;
      root1.name = 'root1';
      group.add(root1);

      const root2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, rootLength, 6), rootMat);
      root2.position.set(0.25, rootDir * (0.35 + rootLength / 2), 0);
      root2.rotation.z = isUpper ? Math.PI : 0;
      root2.name = 'root2';
      group.add(root2);
    } else {
      const singleRoot = new THREE.Mesh(new THREE.ConeGeometry(0.22, rootLength, 6), rootMat);
      singleRoot.position.set(0, rootDir * (0.35 + rootLength / 2), 0);
      singleRoot.rotation.z = isUpper ? Math.PI : 0;
      singleRoot.name = 'root';
      group.add(singleRoot);
    }

    // 3. Occlusal marker surface (interactive surface indicator)
    const occlusalSurface = new THREE.Mesh(
      new THREE.CircleGeometry(0.25, 8),
      new THREE.MeshBasicMaterial({ color: 0x94A3B8, transparent: true, opacity: 0.0 })
    );
    occlusalSurface.position.set(0, isUpper ? -0.36 : 0.36, 0);
    occlusalSurface.rotation.x = isUpper ? Math.PI / 2 : -Math.PI / 2;
    occlusalSurface.name = 'surface_O';
    group.add(occlusalSurface);

    return group;
  };

  // Build Dental Arch and Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = 540;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0A0F1D); // Deep surgical dark blue
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 3.5, 9.5);
    camera.lookAt(0, 0, 0);
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

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(5, 8, 7);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38BDF8, 0.6); // Cyan rim light
    fillLight.position.set(-5, -4, 5);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0x818CF8, 0.5); // Indigo backlight
    backLight.position.set(0, 6, -8);
    scene.add(backLight);

    // 5. Build Arches
    const upperArchGroup = new THREE.Group();
    upperArchGroup.name = 'upperArch';
    scene.add(upperArchGroup);
    upperArchGroupRef.current = upperArchGroup;

    const lowerArchGroup = new THREE.Group();
    lowerArchGroup.name = 'lowerArch';
    scene.add(lowerArchGroup);
    lowerArchGroupRef.current = lowerArchGroup;

    // Gum tissue curves
    const createGumMesh = (isUpper: boolean) => {
      const gumCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.8, isUpper ? 0.8 : -0.8, -2.4),
        new THREE.Vector3(-2.5, isUpper ? 0.8 : -0.8, -1.0),
        new THREE.Vector3(-1.8, isUpper ? 0.8 : -0.8, 0.6),
        new THREE.Vector3(0, isUpper ? 0.8 : -0.8, 1.6),
        new THREE.Vector3(1.8, isUpper ? 0.8 : -0.8, 0.6),
        new THREE.Vector3(2.5, isUpper ? 0.8 : -0.8, -1.0),
        new THREE.Vector3(2.8, isUpper ? 0.8 : -0.8, -2.4),
      ]);

      const gumGeo = new THREE.TubeGeometry(gumCurve, 40, 0.5, 12, false);
      const gumMat = new THREE.MeshStandardMaterial({
        color: 0xDC6576, // Gingival pink
        roughness: 0.35,
        metalness: 0.05,
      });
      const mesh = new THREE.Mesh(gumGeo, gumMat);
      mesh.receiveShadow = true;
      return mesh;
    };

    upperArchGroup.add(createGumMesh(true));
    lowerArchGroup.add(createGumMesh(false));

    // Arch definition points (FDI 11-18, 21-28, 31-38, 41-48)
    const upperTeethOrder = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
    const lowerTeethOrder = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

    const toothMeshesList: ToothMeshMeta[] = [];

    // Helper to calculate parametric arch positions
    const placeTeethOnArch = (teeth: number[], isUpper: boolean, parentGroup: THREE.Group) => {
      const count = teeth.length;
      teeth.forEach((toothNum, idx) => {
        const t = idx / (count - 1); // 0 to 1
        const angle = -Math.PI * 0.75 + t * (Math.PI * 1.5); // Curved parabolic distribution
        
        // Parabolic arch formula
        const rx = 2.4;
        const rz = 2.8;
        const x = rx * Math.sin(angle);
        const z = -rz * Math.cos(angle) + 0.8;
        const y = isUpper ? 0.8 : -0.8;

        const info = getToothName(toothNum);
        const toothGroup = createTooth3D(info.type, isUpper);
        toothGroup.position.set(x, y, z);

        // Orient tooth outward
        toothGroup.rotation.y = angle + Math.PI;
        // Natural tilt
        toothGroup.rotation.x = isUpper ? -0.1 : 0.1;

        toothGroup.userData = { toothNumber: toothNum };
        parentGroup.add(toothGroup);

        toothMeshesList.push({
          toothNumber: toothNum,
          name_ar: info.ar,
          name_en: info.en,
          isUpper,
          type: info.type,
          mesh: toothGroup,
        });
      });
    };

    placeTeethOnArch(upperTeethOrder, true, upperArchGroup);
    placeTeethOnArch(lowerTeethOrder, false, lowerArchGroup);
    toothMeshesRef.current = toothMeshesList;

    // 6. Raycasting Setup
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getIntersectedTooth = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Collect all child meshes from teeth
      const allMeshes: THREE.Object3D[] = [];
      toothMeshesList.forEach(t => {
        t.mesh.traverse(child => {
          if (child instanceof THREE.Mesh) {
            child.userData.parentTooth = t;
            allMeshes.push(child);
          }
        });
      });

      const intersects = raycaster.intersectObjects(allMeshes);
      if (intersects.length > 0) {
        return (intersects[0].object.userData.parentTooth as ToothMeshMeta) || null;
      }
      return null;
    };

    // Event listeners
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDraggingRef.current = true;
        prevMouseRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const deltaX = e.clientX - prevMouseRef.current.x;
        const deltaY = e.clientY - prevMouseRef.current.y;
        prevMouseRef.current = { x: e.clientX, y: e.clientY };

        rotationTargetRef.current.y += deltaX * 0.007;
        rotationTargetRef.current.x += deltaY * 0.007;
        // Limit vertical pitch
        rotationTargetRef.current.x = Math.max(-0.8, Math.min(1.2, rotationTargetRef.current.x));
      } else {
        const hit = getIntersectedTooth(e);
        setHoveredTooth(hit);
        renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleClick = (e: MouseEvent) => {
      if (readOnly) return;
      const hit = getIntersectedTooth(e);
      if (hit) {
        openToothModal(hit);
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('click', handleClick);

    // 7. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Smooth camera orbit damping
      const currentTarget = scene.rotation;
      currentTarget.y += (rotationTargetRef.current.y - currentTarget.y) * 0.1;
      currentTarget.x += (rotationTargetRef.current.x - currentTarget.x) * 0.1;

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 540;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, []);

  // Update Tooth Materials based on records & Hover
  useEffect(() => {
    if (!toothMeshesRef.current.length) return;

    toothMeshesRef.current.forEach(tMeta => {
      const rec = records[tMeta.toothNumber];
      const isHovered = hoveredTooth?.toothNumber === tMeta.toothNumber;
      const crown = tMeta.mesh.getObjectByName('crown') as THREE.Mesh | undefined;
      const roots = [
        tMeta.mesh.getObjectByName('root'),
        tMeta.mesh.getObjectByName('root1'),
        tMeta.mesh.getObjectByName('root2'),
      ].filter(Boolean) as THREE.Mesh[];

      if (!crown) return;

      // Base Materials according to clinical condition
      let crownColor = 0xFDFBF7;
      let roughness = 0.25;
      let metalness = 0.05;
      let opacity = 1.0;
      let transparent = false;
      let wireframe = false;
      let emissive = 0x000000;

      if (rec) {
        switch (rec.condition) {
          case 'caries':
            crownColor = 0x881337; // Cavitation maroon/black
            emissive = 0x4C0519;
            break;
          case 'crown':
            // Gold / Zirconia
            crownColor = 0xF59E0B; // Amber gold
            metalness = 0.85;
            roughness = 0.2;
            break;
          case 'amalgam_filling':
            crownColor = 0x64748B; // Metallic slate silver
            metalness = 0.9;
            roughness = 0.3;
            break;
          case 'composite_filling':
            crownColor = 0x38BDF8; // Electric cyan border filling indicator
            emissive = 0x0284C7;
            break;
          case 'root_canal':
            crownColor = 0xA855F7; // Purple endo indicator
            emissive = 0x7E22CE;
            break;
          case 'implant':
            crownColor = 0x94A3B8; // Titanium screw
            metalness = 0.95;
            roughness = 0.15;
            break;
          case 'missing':
          case 'extraction_indicated':
            crownColor = 0x334155;
            transparent = true;
            opacity = 0.15;
            wireframe = true;
            break;
          default:
            crownColor = 0xFDFBF7;
            break;
        }
      }

      if (isHovered) {
        emissive = 0x22C55E; // Emerald highlight on hover
      }

      const mat = new THREE.MeshStandardMaterial({
        color: crownColor,
        roughness,
        metalness,
        opacity,
        transparent,
        wireframe,
        emissive,
      });

      crown.material = mat;

      // Roots styling (e.g. Implant titanium post)
      roots.forEach(r => {
        if (rec?.condition === 'implant') {
          r.material = new THREE.MeshStandardMaterial({
            color: 0x64748B,
            metalness: 0.9,
            roughness: 0.2,
          });
        } else if (rec?.condition === 'missing') {
          r.material = new THREE.MeshStandardMaterial({
            color: 0x334155,
            transparent: true,
            opacity: 0.15,
            wireframe: true,
          });
        } else {
          r.material = new THREE.MeshStandardMaterial({
            color: 0xEAD8C0,
            roughness: 0.4,
          });
        }
      });
    });
  }, [records, hoveredTooth]);

  // Handle Visibility according to arch filter
  useEffect(() => {
    if (upperArchGroupRef.current) {
      upperArchGroupRef.current.visible = archFilter === 'both' || archFilter === 'upper';
    }
    if (lowerArchGroupRef.current) {
      lowerArchGroupRef.current.visible = archFilter === 'both' || archFilter === 'lower';
    }
  }, [archFilter]);

  // Open Edit Modal
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
      setCost(350);
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

  // Camera presets
  const setCameraPreset = (preset: CameraView) => {
    if (!cameraRef.current || !sceneRef.current) return;
    const cam = cameraRef.current;
    if (preset === 'perspective') {
      rotationTargetRef.current = { x: 0.35, y: 0 };
      cam.position.set(0, 3.5, 9.5);
    } else if (preset === 'frontal') {
      rotationTargetRef.current = { x: 0.0, y: 0 };
      cam.position.set(0, 0, 8.5);
    } else if (preset === 'occlusal_upper') {
      setArchFilter('upper');
      rotationTargetRef.current = { x: Math.PI / 2.2, y: 0 };
      cam.position.set(0, 7.5, 1.5);
    } else if (preset === 'occlusal_lower') {
      setArchFilter('lower');
      rotationTargetRef.current = { x: -Math.PI / 2.2, y: 0 };
      cam.position.set(0, -7.5, 1.5);
    }
    cam.lookAt(0, 0, 0);
  };

  const toggleSurface = (surf: ToothSurface) => {
    if (surfaces.includes(surf)) {
      setSurfaces(surfaces.filter(s => s !== surf));
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
                {locale === 'ar' ? 'المخطط السني ثلاثي الأبعاد 3D WebGL (FDI Arch)' : '3D WebGL Dental Odontogram (FDI Arch)'}
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                True 3D Interactive
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {locale === 'ar' 
                ? 'استكشاف تشريحي كامل للفكين، تدوير 360°، تحديد حالات الأسنان، التركيبات، الجذور والغرسات' 
                : '360° dental arch orbit, raycast tooth inspection, roots, crowns, endo & implants'}
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
              onClick={() => setCameraPreset('perspective')}
              title={locale === 'ar' ? 'منظور مائل' : 'Perspective Angle'}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <Camera className="w-3.5 h-3.5 inline mr-1" />
              {locale === 'ar' ? 'مائل' : '3D'}
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('frontal')}
              title={locale === 'ar' ? 'منظر أمامي (الابتسامة)' : 'Frontal Smile'}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'أمامي' : 'Front'}
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('occlusal_upper')}
              title={locale === 'ar' ? 'أطباقي علوي' : 'Upper Occlusal'}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'أطباقي علوي' : 'Occ Upper'}
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('occlusal_lower')}
              title={locale === 'ar' ? 'أطباقي سفلي' : 'Lower Occlusal'}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'أطباقي سفلي' : 'Occ Lower'}
            </button>
          </div>

          {/* Reset Orbit */}
          <button
            type="button"
            onClick={() => setCameraPreset('perspective')}
            title={locale === 'ar' ? 'إعادة ضبط المنظر' : 'Reset Orbit'}
            className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Mount */}
      <div className="relative w-full h-[540px] bg-gradient-to-b from-[#090D16] to-[#040711] overflow-hidden select-none">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Hover Tooth Dynamic HUD / Tooltip */}
        {hoveredTooth && (
          <div className="absolute top-4 left-4 z-10 bg-slate-900/90 border border-cyan-500/40 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-2xl flex items-center gap-3 animate-fade-in pointer-events-none">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center font-black text-cyan-300 text-sm">
              {hoveredTooth.toothNumber}
            </div>
            <div>
              <div className="font-bold text-xs text-white">
                {locale === 'ar' ? hoveredTooth.name_ar : hoveredTooth.name_en}
              </div>
              <div className="text-[10px] text-cyan-400 font-medium">
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

        {/* Orbit Helper Watermark */}
        <div className="absolute bottom-3 right-4 z-10 pointer-events-none flex items-center gap-2 text-[11px] text-slate-500 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
          <RotateCcw className="w-3.5 h-3.5 text-slate-400 animate-spin-slow" />
          <span>{locale === 'ar' ? 'اسحب الماوس للتدوير 360° | اضغط على أي سن للتشخيص' : 'Drag to orbit 360° | Click tooth to diagnose'}</span>
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

      {/* Clinical Finding Modal (Raycast Selection) */}
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
                  onChange={e => setCondition(e.target.value as DentalCondition)}
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
                  ].map(surf => (
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
                      onChange={e => setCost(Number(e.target.value))}
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
                      onChange={e => setCompleted(e.target.checked)}
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
                  onChange={e => setNotes(e.target.value)}
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
