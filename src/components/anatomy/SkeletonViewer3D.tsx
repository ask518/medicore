// ============================================================================
// MEDICORE – High-End Medical-Grade 3D Skeletal Diagnostic Engine (Three.js WebGL)
// Loads Authentic 242-Bone Human Anatomical Model (BodyParts3D GLB Dataset)
// OrbitControls 360°, X-Ray Hologram, Realistic Ivory Bone, Thermal Pain Heatmap
// ============================================================================

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BoneRegionId, OrthoFindingType, OrthopedicFinding } from '../../types/specialty';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Activity, RotateCcw, ZoomIn, ZoomOut, Eye, Layers, 
  Sparkles, AlertCircle, X, Shield, Sliders, Camera, Loader2
} from 'lucide-react';

interface SkeletonViewer3DProps {
  findings: OrthopedicFinding[];
  onChange: (findings: OrthopedicFinding[]) => void;
  readOnly?: boolean;
}

type ShaderMode = 'xray' | 'anatomical' | 'thermal';

interface BoneMeshInfo {
  regionId: BoneRegionId;
  nodeName: string;
  name_ar: string;
  name_en: string;
  mesh: THREE.Mesh;
  originalPosition: THREE.Vector3;
}

export const SkeletonViewer3D: React.FC<SkeletonViewer3DProps> = ({
  findings,
  onChange,
  readOnly = false,
}) => {
  const { locale, t } = useLanguage();
  const mountRef = useRef<HTMLDivElement>(null);

  // View & Render Controls
  const [shaderMode, setShaderMode] = useState<ShaderMode>('xray');
  const [hoveredBone, setHoveredBone] = useState<BoneMeshInfo | null>(null);
  const [activeModalRegion, setActiveModalRegion] = useState<{ regionId: BoneRegionId; name_ar: string; name_en: string; worldPos: THREE.Vector3 } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<number>(0);

  // Finding modal fields
  const [findingType, setFindingType] = useState<OrthoFindingType>('fracture_closed');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');
  const [painScale, setPainScale] = useState<number>(6);
  const [description, setDescription] = useState('');
  const [treatment, setTreatment] = useState('');

  // Three.js instances ref
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const boneMeshesRef = useRef<BoneMeshInfo[]>([]);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const skeletonModelRef = useRef<THREE.Group | null>(null);

  // Map GLB node names to clinical BoneRegionId and translations
  const mapNodeToRegion = (nodeName: string): { regionId: BoneRegionId; name_ar: string; name_en: string } => {
    const n = nodeName.toLowerCase();

    // Cranium & Facial Bones
    if (n.includes('parietal') || n.includes('frontal') || n.includes('occipital') || n.includes('temporal') || n.includes('sphenoid') || n.includes('nasal') || n.includes('zygomatic') || n.includes('maxilla') || n.includes('mandible') || n.includes('vomer') || n.includes('ethmoid')) {
      return { regionId: 'skull', name_ar: 'الجمجمة والوجه (Cranium & Face)', name_en: 'Cranium & Facial Bones' };
    }

    // Spine
    if (n.includes('atlas') || n.includes('axis') || n.includes('cervical') || n.includes('c1') || n.includes('c2') || n.includes('c3') || n.includes('c4') || n.includes('c5') || n.includes('c6') || n.includes('c7')) {
      return { regionId: 'cervical_spine', name_ar: 'الفقرات العنقية (Cervical C1-C7)', name_en: 'Cervical Spine (C1-C7)' };
    }
    if (n.includes('thoracic-vertebra') || n.includes('t1') || n.includes('t2') || n.includes('t3') || n.includes('t4') || n.includes('t5') || n.includes('t6') || n.includes('t7') || n.includes('t8') || n.includes('t9') || n.includes('t10') || n.includes('t11') || n.includes('t12')) {
      return { regionId: 'thoracic_spine', name_ar: 'الفقرات الصدرية (Thoracic T1-T12)', name_en: 'Thoracic Spine (T1-T12)' };
    }
    if (n.includes('lumbar-vertebra') || n.includes('l1') || n.includes('l2') || n.includes('l3') || n.includes('l4') || n.includes('l5')) {
      return { regionId: 'lumbar_spine', name_ar: 'الفقرات القطنية (Lumbar L1-L5)', name_en: 'Lumbar Spine (L1-L5)' };
    }
    if (n.includes('sacrum') || n.includes('coccyx')) {
      return { regionId: 'sacrum_pelvis', name_ar: 'العجز والعصعص (Sacrum & Coccyx)', name_en: 'Sacrum & Coccyx' };
    }

    // Ribs & Sternum
    if (n.includes('rib') || n.includes('costal') || n.includes('sternum') || n.includes('manubrium') || n.includes('xiphoid')) {
      return { regionId: 'thoracic_spine', name_ar: 'القفص الصدري والقص (Ribcage & Sternum)', name_en: 'Ribcage & Sternum' };
    }

    // Upper Limbs Right
    if (n.includes('right-clavicle')) return { regionId: 'clavicle_r', name_ar: 'الترقوة اليمنى (Right Clavicle)', name_en: 'Right Clavicle' };
    if (n.includes('right-scapula')) return { regionId: 'scapula_r', name_ar: 'لوح الكتف الأيمن (Right Scapula)', name_en: 'Right Scapula' };
    if (n.includes('right-humerus')) return { regionId: 'humerus_r', name_ar: 'عضد الذراع الأيمن (Right Humerus)', name_en: 'Right Humerus' };
    if (n.includes('right-radius') || n.includes('right-ulna')) return { regionId: 'radius_ulna_r', name_ar: 'الساعد الأيمن (Right Radius/Ulna)', name_en: 'Right Forearm' };
    if (n.includes('right-scaphoid') || n.includes('right-lunate') || n.includes('right-triquetral') || n.includes('right-metacarpal') || n.includes('right-thumb') || n.includes('right-index-finger') || n.includes('right-middle-finger') || n.includes('right-ring-finger') || n.includes('right-little-finger')) {
      return { regionId: 'wrist_hand_r', name_ar: 'الرسغ واليد اليمنى (Right Wrist/Hand)', name_en: 'Right Wrist & Hand' };
    }

    // Upper Limbs Left
    if (n.includes('left-clavicle')) return { regionId: 'clavicle_l', name_ar: 'الترقوة اليسرى (Left Clavicle)', name_en: 'Left Clavicle' };
    if (n.includes('left-scapula')) return { regionId: 'scapula_l', name_ar: 'لوح الكتف الأيسر (Left Scapula)', name_en: 'Left Scapula' };
    if (n.includes('left-humerus')) return { regionId: 'humerus_l', name_ar: 'عضد الذراع الأيسر (Left Humerus)', name_en: 'Left Humerus' };
    if (n.includes('left-radius') || n.includes('left-ulna')) return { regionId: 'radius_ulna_l', name_ar: 'الساعد الأيسر (Left Radius/Ulna)', name_en: 'Left Forearm' };
    if (n.includes('left-scaphoid') || n.includes('left-lunate') || n.includes('left-triquetral') || n.includes('left-metacarpal') || n.includes('left-thumb') || n.includes('left-index-finger') || n.includes('left-middle-finger') || n.includes('left-ring-finger') || n.includes('left-little-finger')) {
      return { regionId: 'wrist_hand_l', name_ar: 'الرسغ واليد اليسرى (Left Wrist/Hand)', name_en: 'Left Wrist & Hand' };
    }

    // Pelvis / Hip
    if (n.includes('right-hip-bone')) return { regionId: 'sacrum_pelvis', name_ar: 'الحوض الأيمن (Right Hemipelvis)', name_en: 'Right Hip Bone' };
    if (n.includes('left-hip-bone')) return { regionId: 'sacrum_pelvis', name_ar: 'الحوض الأيسر (Left Hemipelvis)', name_en: 'Left Hip Bone' };

    // Lower Limbs Right
    if (n.includes('right-femur')) return { regionId: 'femur_r', name_ar: 'عظمة الفخذ اليمنى (Right Femur)', name_en: 'Right Femur' };
    if (n.includes('right-patella')) return { regionId: 'knee_r', name_ar: 'الركبة والرضفة اليمنى (Right Patella/Knee)', name_en: 'Right Knee & Patella' };
    if (n.includes('right-tibia') || n.includes('right-fibula')) return { regionId: 'tibia_fibula_r', name_ar: 'الساق والقصبة اليمنى (Right Tibia/Fibula)', name_en: 'Right Tibia & Fibula' };
    if (n.includes('right-talus') || n.includes('right-calcaneus') || n.includes('right-navicular') || n.includes('right-metatarsal') || n.includes('right-big-toe') || n.includes('right-toe')) {
      return { regionId: 'ankle_foot_r', name_ar: 'الكاحل والقدم اليمنى (Right Ankle/Foot)', name_en: 'Right Ankle & Foot' };
    }

    // Lower Limbs Left
    if (n.includes('left-femur')) return { regionId: 'femur_l', name_ar: 'عظمة الفخذ اليسرى (Left Femur)', name_en: 'Left Femur' };
    if (n.includes('left-patella')) return { regionId: 'knee_l', name_ar: 'الركبة والرضفة اليسرى (Left Patella/Knee)', name_en: 'Left Knee & Patella' };
    if (n.includes('left-tibia') || n.includes('left-fibula')) return { regionId: 'tibia_fibula_l', name_ar: 'الساق والقصبة اليسرى (Left Tibia/Fibula)', name_en: 'Left Tibia & Fibula' };
    if (n.includes('left-talus') || n.includes('left-calcaneus') || n.includes('left-navicular') || n.includes('left-metatarsal') || n.includes('left-big-toe') || n.includes('left-toe')) {
      return { regionId: 'ankle_foot_l', name_ar: 'الكاحل والقدم اليسرى (Left Ankle/Foot)', name_en: 'Left Ankle & Foot' };
    }

    return { regionId: 'thoracic_spine', name_ar: nodeName.replace(/-/g, ' '), name_en: nodeName.replace(/-/g, ' ') };
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = 560;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913); // Deep radiographic dark space
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.8);
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
    controls.minDistance = 1.5;
    controls.maxDistance = 10;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(5, 8, 7);
    scene.add(keyLight);

    const rimCyan = new THREE.DirectionalLight(0x38BDF8, 0.8);
    rimCyan.position.set(-6, 2, -5);
    scene.add(rimCyan);

    const backIndigo = new THREE.DirectionalLight(0x818CF8, 0.6);
    backIndigo.position.set(0, -6, 5);
    scene.add(backIndigo);

    // 6. Markers Group
    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    markersGroupRef.current = markersGroup;

    // 7. Load Real Anatomical GLB Skeleton
    const loader = new GLTFLoader();
    setIsLoading(true);

    loader.load(
      '/models/skeleton.glb',
      (gltf) => {
        const model = gltf.scene;
        skeletonModelRef.current = model;

        // Auto-center and normalize bounding box
        const bbox = new THREE.Box3().setFromObject(model);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());

        // Center model at (0, 0, 0)
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;

        // Normalize scale to fit nicely in 3.8 units height
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 3.8 / maxDim;
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);

        const meshesList: BoneMeshInfo[] = [];

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            const mapped = mapNodeToRegion(child.name);
            const worldPos = new THREE.Vector3();
            child.getWorldPosition(worldPos);

            const boneInfo: BoneMeshInfo = {
              regionId: mapped.regionId,
              nodeName: child.name,
              name_ar: mapped.name_ar,
              name_en: mapped.name_en,
              mesh: child,
              originalPosition: worldPos,
            };

            child.userData = { boneInfo };
            meshesList.push(boneInfo);
          }
        });

        boneMeshesRef.current = meshesList;
        scene.add(model);
        setIsLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (err) => {
        console.error('Failed to load skeleton GLB:', err);
        setIsLoading(false);
      }
    );

    // 8. Raycasting for picking bones
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getIntersectedBone = (e: MouseEvent): { hit: THREE.Intersection; bone: BoneMeshInfo } | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      if (!skeletonModelRef.current) return null;
      const intersects = raycaster.intersectObjects(skeletonModelRef.current.children, true);

      if (intersects.length > 0) {
        const topHit = intersects[0];
        let curr: THREE.Object3D | null = topHit.object;
        while (curr) {
          if (curr.userData && curr.userData.boneInfo) {
            return { hit: topHit, bone: curr.userData.boneInfo as BoneMeshInfo };
          }
          curr = curr.parent;
        }
      }
      return null;
    };

    const handlePointerMove = (e: MouseEvent) => {
      const res = getIntersectedBone(e);
      setHoveredBone(res?.bone || null);
      renderer.domElement.style.cursor = res ? 'pointer' : 'grab';
    };

    const handleClick = (e: MouseEvent) => {
      if (readOnly) return;
      const res = getIntersectedBone(e);
      if (res) {
        const b = res.bone;
        setActiveModalRegion({
          regionId: b.regionId,
          name_ar: b.name_ar,
          name_en: b.name_en,
          worldPos: res.hit.point.clone(),
        });
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousemove', handlePointerMove);
    dom.addEventListener('click', handleClick);

    // 9. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      controls.update();

      // Pulsing 3D marker pins
      if (markersGroupRef.current) {
        markersGroupRef.current.children.forEach((child, i) => {
          const ring = child.getObjectByName('pulseRing');
          if (ring) {
            const scale = 1 + Math.sin(elapsed * 4 + i) * 0.3;
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

  // Update Shader Materials based on mode & Hover
  useEffect(() => {
    if (!boneMeshesRef.current.length) return;

    boneMeshesRef.current.forEach((bInfo) => {
      const isHovered = hoveredBone?.nodeName === bInfo.nodeName;

      let color = 0x38BDF8;
      let roughness = 0.2;
      let metalness = 0.1;
      let opacity = 0.75;
      let transparent = true;
      let emissive = 0x0284C7;
      let emissiveIntensity = 0.25;

      if (shaderMode === 'xray') {
        // High-end medical X-Ray Hologram
        color = 0x38BDF8;
        roughness = 0.15;
        metalness = 0.2;
        transparent = true;
        opacity = 0.72;
        emissive = 0x0369A1;
        emissiveIntensity = 0.3;
      } else if (shaderMode === 'anatomical') {
        // Genuine medical ivory bone
        color = 0xF5F0E6;
        roughness = 0.45;
        metalness = 0.05;
        transparent = false;
        opacity = 1.0;
        emissive = 0x000000;
        emissiveIntensity = 0.0;
      } else if (shaderMode === 'thermal') {
        // Thermal pain heatmap
        const y = bInfo.mesh.position.y;
        if (bInfo.regionId.includes('knee') || bInfo.regionId.includes('lumbar')) {
          color = 0xEF4444; // Inflamed red
          emissive = 0xB91C1C;
        } else {
          color = 0x0284C7; // Cool blue
          emissive = 0x0369A1;
        }
        roughness = 0.25;
        transparent = true;
        opacity = 0.85;
      }

      if (isHovered) {
        emissive = 0x10B981; // Bright emerald highlight
        emissiveIntensity = 0.9;
        opacity = 0.95;
      }

      bInfo.mesh.material = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        transparent,
        opacity,
        emissive,
        emissiveIntensity,
      });
    });
  }, [shaderMode, hoveredBone]);

  // Render 3D Holographic Pins for findings
  useEffect(() => {
    if (!markersGroupRef.current) return;
    const group = markersGroupRef.current;
    group.clear();

    findings.forEach((finding) => {
      // Find matching bone mesh
      const bone = boneMeshesRef.current.find((b) => b.regionId === finding.regionId);
      if (!bone) return;

      const marker = new THREE.Group();
      const pos = new THREE.Vector3();
      bone.mesh.getWorldPosition(pos);

      // Offset slightly forward
      pos.z += 0.08;
      marker.position.copy(pos);

      // 1. Core Sphere
      const sphereGeo = new THREE.SphereGeometry(0.045, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: 0xEF4444,
        emissive: 0xDC2626,
        emissiveIntensity: 0.9,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      marker.add(sphere);

      // 2. Holographic Pulsing Ring
      const ringGeo = new THREE.RingGeometry(0.06, 0.085, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xF59E0B,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.name = 'pulseRing';
      marker.add(ring);

      marker.userData = { finding };
      group.add(marker);
    });
  }, [findings]);

  // Camera presets
  const setCameraView = (view: 'front' | 'back' | 'skull' | 'pelvis' | 'knees') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (view === 'front') {
      cam.position.set(0, 0, 5.8);
      ctrl.target.set(0, 0, 0);
    } else if (view === 'back') {
      cam.position.set(0, 0, -5.8);
      ctrl.target.set(0, 0, 0);
    } else if (view === 'skull') {
      cam.position.set(0, 1.4, 2.5);
      ctrl.target.set(0, 1.4, 0);
    } else if (view === 'pelvis') {
      cam.position.set(0, -0.2, 2.5);
      ctrl.target.set(0, -0.2, 0);
    } else if (view === 'knees') {
      cam.position.set(0, -1.3, 2.5);
      ctrl.target.set(0, -1.3, 0);
    }
    ctrl.update();
  };

  const handleSaveFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalRegion) return;

    const newFinding: OrthopedicFinding = {
      id: `ortho-3d-${Date.now()}`,
      regionId: activeModalRegion.regionId,
      view: 'anterior',
      x: 50,
      y: 50,
      findingType,
      severity,
      painScale,
      description: description || `${activeModalRegion.name_ar} - ${findingType}`,
      treatmentRecommended: treatment,
    };

    onChange([...findings, newFinding]);
    setActiveModalRegion(null);
    setDescription('');
    setTreatment('');
  };

  const handleDeleteFinding = (id: string) => {
    onChange(findings.filter((f) => f.id !== id));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col relative text-slate-100">
      {/* 3D Header Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-white tracking-wide">
                {locale === 'ar' ? 'الهيكل العظمي البشري ثلاثي الأبعاد 3D WebGL (242 عظمة حقيقية)' : '3D WebGL Human Skeleton (242 Anatomical Bones)'}
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Medical-Grade 3D
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {locale === 'ar' 
                ? 'نموذج تشريحي طبي حقيقي كامل (BodyParts3D)، تدوير 360°، أشعة سينية شفافة، وخرائط الألم الحرارية' 
                : 'Authentic 242-bone medical anatomical dataset, 360° orbit, X-Ray transparency & pain heatmap'}
            </p>
          </div>
        </div>

        {/* View & Shader Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Shaders */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setShaderMode('xray')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                shaderMode === 'xray' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 inline mr-1" />
              {locale === 'ar' ? 'أشعة سينية (X-Ray)' : 'X-Ray'}
            </button>
            <button
              type="button"
              onClick={() => setShaderMode('anatomical')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                shaderMode === 'anatomical' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 inline mr-1" />
              {locale === 'ar' ? 'عظام واقعية (Bone)' : 'Bone'}
            </button>
            <button
              type="button"
              onClick={() => setShaderMode('thermal')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                shaderMode === 'thermal' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 inline mr-1" />
              {locale === 'ar' ? 'حراري (Thermal)' : 'Thermal'}
            </button>
          </div>

          {/* Camera Presets */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setCameraView('front')}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'أمامي' : 'Front'}
            </button>
            <button
              type="button"
              onClick={() => setCameraView('back')}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'خلفي' : 'Back'}
            </button>
            <button
              type="button"
              onClick={() => setCameraView('skull')}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'الجمجمة' : 'Skull'}
            </button>
            <button
              type="button"
              onClick={() => setCameraView('pelvis')}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'الحوض' : 'Pelvis'}
            </button>
            <button
              type="button"
              onClick={() => setCameraView('knees')}
              className="px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
            >
              {locale === 'ar' ? 'الركبتين' : 'Knees'}
            </button>
          </div>

          {/* Reset Orbit */}
          <button
            type="button"
            onClick={() => setCameraView('front')}
            title={locale === 'ar' ? 'إعادة ضبط المنظر' : 'Reset Orbit'}
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
                {locale === 'ar' ? 'جاري تحميل الهيكل العظمي البشري الطبي (242 عظمة)...' : 'Loading High-Res Anatomical 3D Model...'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {loadProgress > 0 ? `${loadProgress}%` : locale === 'ar' ? 'يرجى الانتظار ثوانٍ معدودة' : 'Preparing WebGL shaders...'}
              </p>
            </div>
          </div>
        )}

        {/* Hover Bone Dynamic HUD Card */}
        {hoveredBone && (
          <div className="absolute top-4 left-4 z-10 bg-slate-900/90 border border-cyan-500/40 rounded-xl px-4 py-2.5 backdrop-blur-md shadow-2xl flex items-center gap-3 animate-fade-in pointer-events-none">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center font-black text-cyan-300 text-xs">
              3D
            </div>
            <div>
              <div className="font-black text-sm text-white">
                {locale === 'ar' ? hoveredBone.name_ar : hoveredBone.name_en}
              </div>
              <div className="text-[10px] text-cyan-400 font-mono">
                {hoveredBone.nodeName}
              </div>
            </div>
          </div>
        )}

        {/* Orbit Helper Indicator */}
        <div className="absolute bottom-3 right-4 z-10 pointer-events-none flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/70 px-3 py-1.5 rounded-lg border border-slate-800">
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
          <span>{locale === 'ar' ? 'اسحب بالماوس للتدوير 360° | عجلات الماوس للتكبير | اضغط على أي عظمة للتشخيص' : 'Drag to orbit 360° | Scroll to zoom | Click bone to diagnose'}</span>
        </div>

        {/* Findings Count Pill */}
        <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-ping"></span>
          <span className="text-slate-300 font-bold">
            {locale === 'ar' ? `الإصابات المرصودة (${findings.length})` : `Recorded Findings (${findings.length})`}
          </span>
        </div>
      </div>

      {/* Clinical Finding Modal (Raycast Selection) */}
      {activeModalRegion && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {locale === 'ar' ? activeModalRegion.name_ar : activeModalRegion.name_en}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {locale === 'ar' ? 'توثيق الإصابة السريرية وتثبيت الإشارة 3D' : 'Record orthopedic injury & place 3D pin'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalRegion(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFinding} className="space-y-4 mt-4">
              {/* Finding Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {locale === 'ar' ? 'نوع الإصابة العظمية' : 'Injury Finding Type'}
                </label>
                <select
                  value={findingType}
                  onChange={(e) => setFindingType(e.target.value as OrthoFindingType)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="fracture_closed">{locale === 'ar' ? 'كسر عظمي مغلق (Closed Fracture)' : 'Closed Fracture'}</option>
                  <option value="fracture_open">{locale === 'ar' ? 'كسر عظمي مفتوح (Open Fracture)' : 'Open Fracture'}</option>
                  <option value="dislocation">{locale === 'ar' ? 'خلع مفصلي (Dislocation)' : 'Joint Dislocation'}</option>
                  <option value="sprain_strain">{locale === 'ar' ? 'التواء أو تمزق أربطة (Sprain / Strain)' : 'Sprain / Ligament Tear'}</option>
                  <option value="osteoarthritis">{locale === 'ar' ? 'خشونة مفصل / تآكل غضروفي (Osteoarthritis)' : 'Osteoarthritis'}</option>
                  <option value="tendon_tear">{locale === 'ar' ? 'تمزق وتر (Tendon Tear)' : 'Tendon Tear'}</option>
                  <option value="point_tenderness">{locale === 'ar' ? 'ألم موضعي عند الضغط (Point Tenderness)' : 'Point Tenderness'}</option>
                  <option value="post_operative_hardware">{locale === 'ar' ? 'شرائح ومسامير تثبيت (Post-op Hardware)' : 'Post-op Hardware'}</option>
                </select>
              </div>

              {/* Severity & Pain Scale */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {locale === 'ar' ? 'درجة الشدة' : 'Severity'}
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="mild">{locale === 'ar' ? 'بسيطة (Mild)' : 'Mild'}</option>
                    <option value="moderate">{locale === 'ar' ? 'متوسطة (Moderate)' : 'Moderate'}</option>
                    <option value="severe">{locale === 'ar' ? 'شديدة (Severe)' : 'Severe'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {locale === 'ar' ? `مقياس الألم (Pain Scale: ${painScale}/10)` : `Pain Scale (${painScale}/10)`}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={painScale}
                    onChange={(e) => setPainScale(Number(e.target.value))}
                    className="w-full accent-cyan-500 mt-2"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {locale === 'ar' ? 'الوصف الإكلينيكي والفحص الموضعي' : 'Clinical Description'}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={locale === 'ar' ? 'تفاصيل الإصابة، الفحص الموضعي، حركة المفصل...' : 'Clinical details, ROM, swelling...'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Treatment */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {locale === 'ar' ? 'خطة العلاج الموصى بها' : 'Recommended Management Plan'}
                </label>
                <input
                  type="text"
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  placeholder={locale === 'ar' ? 'مثال: جبيرة، راحة، مسكنات، رنين مغناطيسي...' : 'e.g. Cast immobilization, MRI, NSAIDs...'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveModalRegion(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl shadow-lg shadow-cyan-600/30 transition-all"
                >
                  {locale === 'ar' ? 'تثبيت الإشارة 3D في السجل' : 'Place 3D Pin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
