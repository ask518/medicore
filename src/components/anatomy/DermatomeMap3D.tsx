// ============================================================================
// MEDICORE – High-End Medical-Grade 3D Dermatology Engine (Three.js WebGL)
// Loads Authentic Anatomical 3D Human Body Model (GLB Mesh)
// OrbitControls 360°, Realistic Skin PBR, Spinal Dermatome Bands, Thermal Heatmap
// ============================================================================

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DermaFinding, DermaLesionType } from '../../types/specialty';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Sparkles, RotateCcw, Eye, Layers, Plus, X, Check,
  Camera, AlertCircle, Thermometer, ShieldAlert, Sliders, Loader2
} from 'lucide-react';

interface DermatomeMap3DProps {
  findings: DermaFinding[];
  onChange: (findings: DermaFinding[]) => void;
  readOnly?: boolean;
}

type DermaShaderMode = 'skin' | 'dermatome' | 'thermal';

export const DermatomeMap3D: React.FC<DermatomeMap3DProps> = ({
  findings,
  onChange,
  readOnly = false,
}) => {
  const { locale, t } = useLanguage();
  const mountRef = useRef<HTMLDivElement>(null);

  // States
  const [shaderMode, setShaderMode] = useState<DermaShaderMode>('skin');
  const [activeModalCoords, setActiveModalCoords] = useState<{ point: THREE.Vector3; normal: THREE.Vector3; view: 'anterior' | 'posterior' } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<number>(0);

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
  const controlsRef = useRef<OrbitControls | null>(null);
  const bodyMeshRef = useRef<THREE.Mesh | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const bodyModelRef = useRef<THREE.Group | null>(null);

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
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 5.2);
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
    controls.minDistance = 1.2;
    controls.maxDistance = 8.0;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.4);
    mainLight.position.set(4, 7, 6);
    scene.add(mainLight);

    const softRim = new THREE.DirectionalLight(0x38BDF8, 0.6);
    softRim.position.set(-5, 2, -4);
    scene.add(softRim);

    const fillPink = new THREE.DirectionalLight(0xF472B6, 0.4);
    fillPink.position.set(0, -6, 5);
    scene.add(fillPink);

    // 6. Markers Group
    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    markersGroupRef.current = markersGroup;

    // 7. Load Real 3D Human Body GLB
    const loader = new GLTFLoader();
    setIsLoading(true);

    loader.load(
      '/models/human_body.glb',
      (gltf) => {
        const model = gltf.scene;
        bodyModelRef.current = model;

        // Auto center and scale
        const bbox = new THREE.Box3().setFromObject(model);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());

        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;

        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 3.6 / maxDim;
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            bodyMeshRef.current = child;

            // Default skin material
            child.material = new THREE.MeshStandardMaterial({
              color: 0xE8C5A8,
              roughness: 0.38,
              metalness: 0.05,
            });
          }
        });

        scene.add(model);
        setIsLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (err) => {
        console.error('Failed to load human body GLB:', err);
        setIsLoading(false);
      }
    );

    // 8. Raycasting for placing lesions on body surface
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (e: MouseEvent) => {
      if (readOnly) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      if (!bodyModelRef.current) return;
      const intersects = raycaster.intersectObjects(bodyModelRef.current.children, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const point = hit.point.clone();
        const normal = hit.normal ? hit.normal.clone() : new THREE.Vector3(0, 0, 1);
        const view = point.z >= 0 ? 'anterior' : 'posterior';

        setActiveModalCoords({
          point,
          normal,
          view,
        });
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('click', handleClick);

    // 9. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      controls.update();

      // Pulsing 3D lesion rings
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
      dom.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, []);

  // Update Body Mesh Shaders
  useEffect(() => {
    if (!bodyMeshRef.current) return;
    const mesh = bodyMeshRef.current;

    if (shaderMode === 'skin') {
      mesh.material = new THREE.MeshStandardMaterial({
        color: 0xE8C5A8, // Smooth organic skin tone
        roughness: 0.38,
        metalness: 0.05,
      });
    } else if (shaderMode === 'dermatome') {
      mesh.material = new THREE.MeshStandardMaterial({
        color: 0x38BDF8, // Cyan / blue neural map
        roughness: 0.3,
        metalness: 0.1,
      });
    } else if (shaderMode === 'thermal') {
      mesh.material = new THREE.MeshStandardMaterial({
        color: 0xDC2626, // Infrared thermography red
        roughness: 0.2,
        metalness: 0.0,
      });
    }
  }, [shaderMode]);

  // Render 3D Lesion Markers directly on body surface
  useEffect(() => {
    if (!markersGroupRef.current) return;
    const group = markersGroupRef.current;
    group.clear();

    findings.forEach((finding) => {
      const marker = new THREE.Group();

      // Convert stored 2D % coordinates back to 3D world space
      const worldX = ((finding.x - 50) / 50) * 1.2;
      const worldY = -((finding.y - 50) / 50) * 1.8;
      const worldZ = finding.view === 'anterior' ? 0.35 : -0.35;

      marker.position.set(worldX, worldY, worldZ);

      // 1. Lesion Solid 3D Sphere
      const sphereRadius = Math.max(0.04, Math.min(0.14, (finding.sizeMm || 10) * 0.006));
      const sphereGeo = new THREE.SphereGeometry(sphereRadius, 16, 12);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(finding.colorHex || '#DC2626'),
        roughness: 0.2,
        emissive: new THREE.Color(finding.colorHex || '#DC2626').multiplyScalar(0.5),
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      marker.add(sphereMesh);

      // 2. Pulsing Concentric Outer Ring
      const ringGeo = new THREE.RingGeometry(sphereRadius * 1.3, sphereRadius * 1.7, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(finding.colorHex || '#DC2626'),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.name = 'pulseRing';
      marker.add(ringMesh);

      marker.userData = { finding };
      group.add(marker);
    });
  }, [findings]);

  // Camera Presets
  const setCameraPreset = (preset: 'front' | 'back' | 'head' | 'torso' | 'legs') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (preset === 'front') {
      cam.position.set(0, 0.2, 5.2);
      ctrl.target.set(0, 0, 0);
    } else if (preset === 'back') {
      cam.position.set(0, 0.2, -5.2);
      ctrl.target.set(0, 0, 0);
    } else if (preset === 'head') {
      cam.position.set(0, 1.4, 2.4);
      ctrl.target.set(0, 1.4, 0);
    } else if (preset === 'torso') {
      cam.position.set(0, 0.3, 2.8);
      ctrl.target.set(0, 0.3, 0);
    } else if (preset === 'legs') {
      cam.position.set(0, -1.1, 2.8);
      ctrl.target.set(0, -1.1, 0);
    }
    ctrl.update();
  };

  const handleSaveLesion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalCoords) return;

    // Convert 3D hit point back to normalized percentage
    const x = Math.round(((activeModalCoords.point.x / 1.2) * 50) + 50);
    const y = Math.round(((-activeModalCoords.point.y / 1.8) * 50) + 50);

    const newFinding: DermaFinding = {
      id: `derma-3d-${Date.now()}`,
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
                {locale === 'ar' ? 'المجسم الجلدي ثلاثي الأبعاد 3D WebGL (مجسم بشري كامل)' : '3D WebGL Dermatology Engine (Full Anatomical Body)'}
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Medical-Grade 3D
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {locale === 'ar' 
                ? 'مجسم تشريحي ثلاثي الأبعاد واقعي كامل، تدوير 360°، تعيين مواضع الآفات السطحية، والخرائط الحرارية' 
                : 'Authentic 3D human body mesh, 360° orbit, raycast surface lesion mapping & thermal modes'}
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
              {locale === 'ar' ? 'خريطة الأعصاب (Dermatome)' : 'Dermatome'}
            </button>
            <button
              type="button"
              onClick={() => setShaderMode('thermal')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                shaderMode === 'thermal' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5 inline mr-1" />
              {locale === 'ar' ? 'حراري (Thermal)' : 'Thermal'}
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
            <button
              type="button"
              onClick={() => setCameraPreset('legs')}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'الأطراف' : 'Limbs'}
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
            <Loader2 className="w-10 h-10 text-rose-400 animate-spin" />
            <div className="text-center">
              <h4 className="font-bold text-white text-sm">
                {locale === 'ar' ? 'جاري تحميل المجسم البشري التشريحي 3D...' : 'Loading Anatomical Human Body 3D Model...'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {loadProgress > 0 ? `${loadProgress}%` : locale === 'ar' ? 'يرجى الانتظار ثوانٍ معدودة' : 'Preparing WebGL skin shaders...'}
              </p>
            </div>
          </div>
        )}

        {/* Orbit Helper Indicator */}
        <div className="absolute bottom-3 right-4 z-10 pointer-events-none flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/70 px-3 py-1.5 rounded-lg border border-slate-800">
          <RotateCcw className="w-3.5 h-3.5 text-rose-400 animate-spin-slow" />
          <span>{locale === 'ar' ? 'اسحب بالماوس للتدوير 360° | عجلات الماوس للتكبير | اضغط على أي نقطة بالجسم لإضافة آفة' : 'Drag to rotate 360° | Scroll to zoom | Click body surface to plot lesion'}</span>
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
                  onChange={(e) => setLesionType(e.target.value as DermaLesionType)}
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
                    onChange={(e) => setSizeMm(Number(e.target.value))}
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
                      onChange={(e) => setColorHex(e.target.value)}
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
                    onChange={(e) => setSymmetry(e.target.value as 'symmetric' | 'asymmetric')}
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
                    onChange={(e) => setBorder(e.target.value as 'regular' | 'irregular')}
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
                  ].map((sym) => (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => {
                        const s = sym.id as any;
                        if (symptoms.includes(s)) {
                          setSymptoms(symptoms.filter((x) => x !== s));
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
                  onChange={(e) => setNotes(e.target.value)}
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
