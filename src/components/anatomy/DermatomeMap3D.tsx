// ============================================================================
// MEDICORE – High-End 3D Interactive Dermatology Engine (Three.js WebGL)
// 360° Anatomical Human Mannequin, Neurological Dermatome Bands, Thermal Heatmap,
// Raycast 3D Surface Lesion Mapping & Clinical ABCDE Melanoma Risk Scoring
// ============================================================================

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { DermaFinding, DermaLesionType } from '../../types/specialty';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Sparkles, RotateCcw, Eye, Layers, Plus, X, Check,
  Camera, AlertCircle, Thermometer, ShieldAlert, Sliders
} from 'lucide-react';

interface DermatomeMap3DProps {
  findings: DermaFinding[];
  onChange: (findings: DermaFinding[]) => void;
  readOnly?: boolean;
}

type DermaShaderMode = 'skin' | 'dermatome' | 'thermal';
type CameraViewPreset = 'front' | 'back' | 'right' | 'left' | 'head' | 'torso';

interface BodyMeshMeta {
  partId: string;
  name_ar: string;
  name_en: string;
  dermatomeSegment: string; // e.g. "C5-C6", "T4-T10", "L3-L4"
  mesh: THREE.Mesh;
}

export const DermatomeMap3D: React.FC<DermatomeMap3DProps> = ({
  findings,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();
  const mountRef = useRef<HTMLDivElement>(null);

  // States
  const [shaderMode, setShaderMode] = useState<DermaShaderMode>('skin');
  const [hoveredPart, setHoveredPart] = useState<BodyMeshMeta | null>(null);
  const [activeModalCoords, setActiveModalCoords] = useState<{ point: THREE.Vector3; normal: THREE.Vector3; view: 'anterior' | 'posterior' } | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<DermaFinding | null>(null);

  // Form states for new lesion
  const [lesionType, setLesionType] = useState<DermaLesionType>('plaque');
  const [sizeMm, setSizeMm] = useState<number>(10);
  const [colorHex, setColorHex] = useState<string>('#DC2626');
  const [symmetry, setSymmetry] = useState<'symmetric' | 'asymmetric'>('symmetric');
  const [border, setBorder] = useState<'regular' | 'irregular'>('regular');
  const [symptoms, setSymptoms] = useState<('itching' | 'bleeding' | 'pain' | 'asymptomatic')[]>(['itching']);
  const [notes, setNotes] = useState('');

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const bodyMeshesRef = useRef<BodyMeshMeta[]>([]);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const mannequinGroupRef = useRef<THREE.Group | null>(null);

  // Mouse orbit
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const rotationTargetRef = useRef({ x: 0.1, y: 0 });

  // Color palette for Dermatome segments
  const dermatomeColors: Record<string, number> = {
    'C2-C4': 0x60A5FA, // Sky blue
    'C5-C8': 0x3B82F6, // Blue
    'T1-T4': 0x34D399, // Emerald
    'T5-T9': 0x10B981, // Teal
    'T10-T12': 0xFBBF24, // Amber
    'L1-L3': 0xF59E0B, // Orange
    'L4-L5': 0xEF4444, // Red
    'S1-S3': 0xEC4899, // Pink
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = 540;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0A0F1D);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 1.0, 7.8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.3);
    mainLight.position.set(4, 8, 6);
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x38BDF8, 0.7);
    rimLight.position.set(-5, 2, -4);
    scene.add(rimLight);

    const softFill = new THREE.DirectionalLight(0xF472B6, 0.4);
    softFill.position.set(0, -6, 5);
    scene.add(softFill);

    // 5. Construct 3D Human Body Mannequin Group
    const mannequinGroup = new THREE.Group();
    scene.add(mannequinGroup);
    mannequinGroupRef.current = mannequinGroup;

    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    markersGroupRef.current = markersGroup;

    const bodyMeshesList: BodyMeshMeta[] = [];

    // Helper to add smooth body parts
    const addBodyPart = (
      id: string,
      name_ar: string,
      name_en: string,
      dermatomeSegment: string,
      geometry: THREE.BufferGeometry,
      pos: [number, number, number],
      rot: [number, number, number] = [0, 0, 0]
    ) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xE8C5A8, // Base warm skin tone
        roughness: 0.38,
        metalness: 0.05,
      });

      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { partId: id };

      mannequinGroup.add(mesh);

      const meta: BodyMeshMeta = {
        partId: id,
        name_ar,
        name_en,
        dermatomeSegment,
        mesh,
      };
      bodyMeshesList.push(meta);
      return mesh;
    };

    // --- ANATOMICAL MANNEQUIN CONSTRUCTION ---
    // Head (Cranium & Face)
    addBodyPart(
      'head',
      'الرأس والوجه',
      'Head & Cranium',
      'C2-C4',
      new THREE.SphereGeometry(0.55, 32, 24),
      [0, 2.3, 0]
    );

    // Neck
    addBodyPart(
      'neck',
      'الرقبة والعنق',
      'Cervical Neck',
      'C2-C4',
      new THREE.CylinderGeometry(0.24, 0.28, 0.45, 20),
      [0, 1.8, 0]
    );

    // Upper Torso / Chest
    addBodyPart(
      'chest',
      'الصدر وأعلى الظهر',
      'Upper Thoracic & Chest',
      'T1-T4',
      new THREE.BoxGeometry(1.4, 0.75, 0.7),
      [0, 1.25, 0]
    );

    // Abdomen / Mid Trunk
    addBodyPart(
      'abdomen',
      'البطن ومنتصف الظهر',
      'Abdominal Trunk',
      'T5-T9',
      new THREE.BoxGeometry(1.25, 0.65, 0.65),
      [0, 0.58, 0]
    );

    // Lower Trunk / Pelvis
    addBodyPart(
      'pelvis',
      'الحوض وأسفل الظهر',
      'Pelvis & Lower Back',
      'T10-T12',
      new THREE.BoxGeometry(1.3, 0.6, 0.68),
      [0, -0.02, 0]
    );

    // Right Shoulder
    addBodyPart(
      'shoulder_r',
      'الكتف الأيمن',
      'Right Shoulder',
      'C5-C8',
      new THREE.SphereGeometry(0.28, 20, 16),
      [-0.85, 1.45, 0]
    );

    // Left Shoulder
    addBodyPart(
      'shoulder_l',
      'الكتف الأيسر',
      'Left Shoulder',
      'C5-C8',
      new THREE.SphereGeometry(0.28, 20, 16),
      [0.85, 1.45, 0]
    );

    // Right Arm (Humerus)
    addBodyPart(
      'arm_r',
      'العضد الأيمن',
      'Right Upper Arm',
      'C5-C8',
      new THREE.CylinderGeometry(0.18, 0.16, 0.85, 16),
      [-0.95, 0.95, 0],
      [0, 0, 0.12]
    );

    // Left Arm (Humerus)
    addBodyPart(
      'arm_l',
      'العضد الأيسر',
      'Left Upper Arm',
      'C5-C8',
      new THREE.CylinderGeometry(0.18, 0.16, 0.85, 16),
      [0.95, 0.95, 0],
      [0, 0, -0.12]
    );

    // Right Forearm
    addBodyPart(
      'forearm_r',
      'الساعد واليد اليمنى',
      'Right Forearm & Hand',
      'C5-C8',
      new THREE.CylinderGeometry(0.15, 0.13, 0.9, 16),
      [-1.1, 0.1, 0],
      [0, 0, 0.08]
    );

    // Left Forearm
    addBodyPart(
      'forearm_l',
      'الساعد واليد اليسرى',
      'Left Forearm & Hand',
      'C5-C8',
      new THREE.CylinderGeometry(0.15, 0.13, 0.9, 16),
      [1.1, 0.1, 0],
      [0, 0, -0.08]
    );

    // Right Thigh (Femur)
    addBodyPart(
      'thigh_r',
      'الفخذ الأيمن',
      'Right Thigh',
      'L1-L3',
      new THREE.CylinderGeometry(0.28, 0.22, 1.25, 20),
      [-0.42, -0.9, 0],
      [0, 0, -0.04]
    );

    // Left Thigh (Femur)
    addBodyPart(
      'thigh_l',
      'الفخذ الأيسر',
      'Left Thigh',
      'L1-L3',
      new THREE.CylinderGeometry(0.28, 0.22, 1.25, 20),
      [0.42, -0.9, 0],
      [0, 0, 0.04]
    );

    // Right Leg & Foot
    addBodyPart(
      'leg_r',
      'الساق والقدم اليمنى',
      'Right Lower Leg & Foot',
      'L4-L5',
      new THREE.CylinderGeometry(0.21, 0.16, 1.35, 20),
      [-0.45, -2.15, 0]
    );

    // Left Leg & Foot
    addBodyPart(
      'leg_l',
      'الساق والقدم اليسرى',
      'Left Lower Leg & Foot',
      'L4-L5',
      new THREE.CylinderGeometry(0.21, 0.16, 1.35, 20),
      [0.45, -2.15, 0]
    );

    bodyMeshesRef.current = bodyMeshesList;

    // 6. Raycasting on Surface
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getSurfaceIntersection = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshes = bodyMeshesList.map(b => b.mesh);
      const intersects = raycaster.intersectObjects(meshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const partMeta = bodyMeshesList.find(b => b.mesh === hit.object);
        return { hit, partMeta };
      }
      return null;
    };

    // Event Handlers
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
        rotationTargetRef.current.x = Math.max(-0.6, Math.min(0.6, rotationTargetRef.current.x));
      } else {
        const res = getSurfaceIntersection(e);
        setHoveredPart(res?.partMeta || null);
        renderer.domElement.style.cursor = res ? 'crosshair' : 'grab';
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleClick = (e: MouseEvent) => {
      if (readOnly) return;
      const res = getSurfaceIntersection(e);
      if (res && res.hit.point) {
        // Determine whether clicked anterior (front z > 0) or posterior (back z < 0)
        const view = res.hit.point.z >= 0 ? 'anterior' : 'posterior';
        const normal = res.hit.normal ? res.hit.normal.clone() : new THREE.Vector3(0, 0, 1);
        setActiveModalCoords({
          point: res.hit.point.clone(),
          normal,
          view,
        });
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('click', handleClick);

    // 7. Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth camera orbit
      const currentRot = mannequinGroup.rotation;
      currentRot.y += (rotationTargetRef.current.y - currentRot.y) * 0.1;
      currentRot.x += (rotationTargetRef.current.x - currentRot.x) * 0.1;

      // Pulse 3D lesion rings
      if (markersGroupRef.current) {
        markersGroupRef.current.children.forEach((child, i) => {
          const ring = child.getObjectByName('pulseRing');
          if (ring) {
            const scale = 1 + Math.sin(elapsed * 4 + i) * 0.25;
            ring.scale.set(scale, scale, scale);
          }
        });
      }

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

  // Update Body Mesh Shaders
  useEffect(() => {
    if (!bodyMeshesRef.current.length) return;

    bodyMeshesRef.current.forEach(meta => {
      const isHovered = hoveredPart?.partId === meta.partId;

      let color = 0xE8C5A8; // Natural skin
      let roughness = 0.38;
      let metalness = 0.05;
      let emissive = 0x000000;

      if (shaderMode === 'dermatome') {
        color = dermatomeColors[meta.dermatomeSegment] || 0x3B82F6;
        roughness = 0.3;
      } else if (shaderMode === 'thermal') {
        // Infrared thermography gradient
        color = meta.partId.includes('torso') || meta.partId.includes('chest') ? 0xDC2626 : 0x0284C7;
        roughness = 0.2;
      }

      if (isHovered) {
        emissive = 0x14B8A6; // Cyan highlight
      }

      meta.mesh.material = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        emissive,
      });
    });
  }, [shaderMode, hoveredPart]);

  // Render 3D Lesion Markers
  useEffect(() => {
    if (!markersGroupRef.current) return;
    const group = markersGroupRef.current;
    group.clear();

    findings.forEach(finding => {
      const marker = new THREE.Group();

      // Convert stored 2D % coordinates back to 3D world space
      // x: 0-100 mapped to [-1.8, 1.8], y: 0-100 mapped to [2.5, -2.5]
      const worldX = ((finding.x - 50) / 50) * 1.5;
      const worldY = -((finding.y - 50) / 50) * 2.3;
      const worldZ = finding.view === 'anterior' ? 0.42 : -0.42;

      marker.position.set(worldX, worldY, worldZ);

      // 1. Lesion Solid 3D Sphere
      const sphereRadius = Math.max(0.04, Math.min(0.18, (finding.sizeMm || 10) * 0.008));
      const sphereGeo = new THREE.SphereGeometry(sphereRadius, 16, 12);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(finding.colorHex || '#DC2626'),
        roughness: 0.2,
        emissive: new THREE.Color(finding.colorHex || '#DC2626').multiplyScalar(0.4),
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      marker.add(sphereMesh);

      // 2. Pulsing Concentric Outer Ring
      const ringGeo = new THREE.RingGeometry(sphereRadius * 1.3, sphereRadius * 1.7, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(finding.colorHex || '#DC2626'),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.name = 'pulseRing';
      marker.add(ringMesh);

      marker.userData = { finding };
      group.add(marker);
    });
  }, [findings]);

  // Camera Presets
  const setCameraPreset = (preset: CameraViewPreset) => {
    if (!cameraRef.current || !mannequinGroupRef.current) return;
    const cam = cameraRef.current;

    if (preset === 'front') {
      rotationTargetRef.current = { x: 0.05, y: 0 };
      cam.position.set(0, 0.4, 7.8);
    } else if (preset === 'back') {
      rotationTargetRef.current = { x: 0.05, y: Math.PI };
      cam.position.set(0, 0.4, 7.8);
    } else if (preset === 'right') {
      rotationTargetRef.current = { x: 0.05, y: -Math.PI / 2 };
      cam.position.set(0, 0.4, 7.8);
    } else if (preset === 'left') {
      rotationTargetRef.current = { x: 0.05, y: Math.PI / 2 };
      cam.position.set(0, 0.4, 7.8);
    } else if (preset === 'head') {
      rotationTargetRef.current = { x: 0.05, y: 0 };
      cam.position.set(0, 2.3, 4.0);
    } else if (preset === 'torso') {
      rotationTargetRef.current = { x: 0.05, y: 0 };
      cam.position.set(0, 0.8, 4.5);
    }
  };

  // Save new 3D Lesion
  const handleSaveLesion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalCoords) return;

    // Convert 3D hit point back to normalized percentage
    const x = Math.round(((activeModalCoords.point.x / 1.5) * 50) + 50);
    const y = Math.round(((-activeModalCoords.point.y / 2.3) * 50) + 50);

    const newFinding: DermaFinding = {
      id: `derma-${Date.now()}`,
      view: activeModalCoords.view,
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y)),
      lesionType,
      sizeMm,
      colorHex,
      symmetry,
      border,
      symptoms,
      clinicalNotes: notes,
    };

    onChange([...findings, newFinding]);
    setActiveModalCoords(null);
    setNotes('');
  };

  const handleDeleteFinding = (id: string) => {
    onChange(findings.filter(f => f.id !== id));
    setSelectedFinding(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col relative text-slate-100">
      {/* 3D Header Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-white tracking-wide">
                {locale === 'ar' ? 'المجسم الجلدي ثلاثي الأبعاد 3D WebGL (Dermatome Body)' : '3D WebGL Dermatology Body Engine'}
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                True 3D Interactive
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {locale === 'ar' 
                ? 'استكشاف مجسم الإنسان 360°، تعيين الآفات السطحية بدقة، خرائط الأعصاب والحرارة' 
                : '360° mannequin orbit, raycast surface lesion mapping, dermatome nerves & thermal modes'}
            </p>
          </div>
        </div>

        {/* View & Shader Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Shaders */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setShaderMode('skin')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                shaderMode === 'skin' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              {locale === 'ar' ? 'بشرة طبيعية' : 'Skin PBR'}
            </button>
            <button
              type="button"
              onClick={() => setShaderMode('dermatome')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                shaderMode === 'dermatome' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              {locale === 'ar' ? 'خريطة الأعصاب (Dermatome)' : 'Dermatome Map'}
            </button>
            <button
              type="button"
              onClick={() => setShaderMode('thermal')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                shaderMode === 'thermal' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5 inline mr-1" />
              {locale === 'ar' ? 'حراري (Thermal)' : 'Thermal Heatmap'}
            </button>
          </div>

          {/* Camera View Presets */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setCameraPreset('front')}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'أمامي' : 'Front'}
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('back')}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'خلفي' : 'Back'}
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('head')}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'الرأس' : 'Head'}
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('torso')}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'الجذع' : 'Torso'}
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
      <div className="relative w-full h-[540px] bg-gradient-to-b from-[#090D16] to-[#040711] overflow-hidden select-none">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Hover Part Dynamic HUD */}
        {hoveredPart && (
          <div className="absolute top-4 left-4 z-10 bg-slate-900/90 border border-rose-500/40 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-2xl flex items-center gap-3 animate-fade-in pointer-events-none">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-400/30 flex items-center justify-center font-black text-rose-300 text-xs">
              3D
            </div>
            <div>
              <div className="font-bold text-xs text-white">
                {locale === 'ar' ? hoveredPart.name_ar : hoveredPart.name_en}
              </div>
              <div className="text-[10px] text-rose-400 font-medium">
                {locale === 'ar' 
                  ? `القطاع العصبي الشوكي: ${hoveredPart.dermatomeSegment}` 
                  : `Spinal Segment: ${hoveredPart.dermatomeSegment}`}
              </div>
            </div>
          </div>
        )}

        {/* Orbit Helper Indicator */}
        <div className="absolute bottom-3 right-4 z-10 pointer-events-none flex items-center gap-2 text-[11px] text-slate-500 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
          <RotateCcw className="w-3.5 h-3.5 text-slate-400 animate-spin-slow" />
          <span>{locale === 'ar' ? 'اسحب للتدوير 360° | اضغط على أي نقطة بالجسم لإضافة آفة جلدية' : 'Drag to rotate 360° | Click body surface to plot lesion'}</span>
        </div>

        {/* Lesion counter pill */}
        <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-ping"></span>
          <span className="text-slate-300 font-bold">
            {locale === 'ar' ? `الآفات المرصودة (${findings.length})` : `Recorded Lesions (${findings.length})`}
          </span>
        </div>
      </div>

      {/* Raycast Click Surface Modal (Add Lesion) */}
      {activeModalCoords && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {locale === 'ar' ? 'توثيق آفة جلدية جديدة (3D Surface Plot)' : 'New 3D Cutaneous Lesion'}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {locale === 'ar' ? `الموقع: ${activeModalCoords.view === 'anterior' ? 'الجهة الأمامية' : 'الجهة الخلفية'}` : `Surface: ${activeModalCoords.view}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalCoords(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLesion} className="space-y-4 mt-4">
              {/* Lesion Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {locale === 'ar' ? 'نوع الآفة الجلدية (Lesion Type)' : 'Lesion Morphology'}
                </label>
                <select
                  value={lesionType}
                  onChange={e => setLesionType(e.target.value as DermaLesionType)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="plaque">{locale === 'ar' ? 'لويحة صدفية / مرتفعة (Plaque)' : 'Plaque'}</option>
                  <option value="papule">{locale === 'ar' ? 'حطاطة / حبة صغيرة (Papule)' : 'Papule'}</option>
                  <option value="macule">{locale === 'ar' ? 'بقعة مسطحة (Macule)' : 'Macule'}</option>
                  <option value="nodule">{locale === 'ar' ? 'عقدة تحت الجلد (Nodule)' : 'Nodule'}</option>
                  <option value="vesicle_bulla">{locale === 'ar' ? 'حويصلة مائية (Vesicle/Bulla)' : 'Vesicle / Bulla'}</option>
                  <option value="pustule">{locale === 'ar' ? 'بثرة صديدية (Pustule)' : 'Pustule'}</option>
                  <option value="wheal_urticaria">{locale === 'ar' ? 'انتباره أرتيكاريا (Wheal/Urticaria)' : 'Wheal / Urticaria'}</option>
                  <option value="ulcer">{locale === 'ar' ? 'قرحة جلدية (Ulcer)' : 'Cutaneous Ulcer'}</option>
                  <option value="hyperpigmentation">{locale === 'ar' ? 'تصبغ داكن / وحمة (Pigmentation/Nevus)' : 'Hyperpigmentation / Nevus'}</option>
                  <option value="biopsy_site">{locale === 'ar' ? 'موضع أخذ خزعة (Biopsy Site)' : 'Biopsy Punch Site'}</option>
                </select>
              </div>

              {/* ABCDE Criteria & Size */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {locale === 'ar' ? 'القطر بالملليمتر (Size mm)' : 'Diameter (mm)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={sizeMm}
                    onChange={e => setSizeMm(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {locale === 'ar' ? 'اللون المميز (Color)' : 'Visual Color'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorHex}
                      onChange={e => setColorHex(e.target.value)}
                      className="w-10 h-9 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer p-0.5"
                    />
                    <span className="text-xs font-mono text-slate-300">{colorHex}</span>
                  </div>
                </div>
              </div>

              {/* Symmetry & Border */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {locale === 'ar' ? 'التناظر (Symmetry)' : 'Symmetry'}
                  </label>
                  <select
                    value={symmetry}
                    onChange={e => setSymmetry(e.target.value as 'symmetric' | 'asymmetric')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="symmetric">{locale === 'ar' ? 'متناظر (Symmetric)' : 'Symmetric'}</option>
                    <option value="asymmetric">{locale === 'ar' ? 'غير متناظر (Asymmetric)' : 'Asymmetric'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {locale === 'ar' ? 'الحواف (Border)' : 'Border'}
                  </label>
                  <select
                    value={border}
                    onChange={e => setBorder(e.target.value as 'regular' | 'irregular')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="regular">{locale === 'ar' ? 'منتظمة (Regular)' : 'Regular'}</option>
                    <option value="irregular">{locale === 'ar' ? 'غير منتظمة / مشرشرة (Irregular)' : 'Irregular'}</option>
                  </select>
                </div>
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {locale === 'ar' ? 'الأعراض المصاحبة (Symptoms)' : 'Accompanying Symptoms'}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'itching', ar: 'حكة', en: 'Itching' },
                    { id: 'bleeding', ar: 'نزيف', en: 'Bleeding' },
                    { id: 'pain', ar: 'ألم', en: 'Pain' },
                    { id: 'asymptomatic', ar: 'بدون أعراض', en: 'Asymptomatic' },
                  ].map(sym => (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => {
                        const s = sym.id as any;
                        if (symptoms.includes(s)) {
                          setSymptoms(symptoms.filter(x => x !== s));
                        } else {
                          setSymptoms([...symptoms, s]);
                        }
                      }}
                      className={`p-2 rounded-xl text-center font-bold text-xs border transition-all ${
                        symptoms.includes(sym.id as any)
                          ? 'bg-rose-600 text-white border-rose-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {locale === 'ar' ? sym.ar : sym.en}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {locale === 'ar' ? 'الوصف الإكلينيكي وخطة العلاج' : 'Clinical Diagnosis & Notes'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={locale === 'ar' ? 'اكتب ملاحظات الفحص المجهري أو نوع الخزعة...' : 'Enter clinical notes...'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveModalCoords(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {locale === 'ar' ? 'تثبيت الآفة على المجسم 3D' : 'Plot on 3D Body'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
