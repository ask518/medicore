// ============================================================================
// MEDICORE – High-End 3D Interactive Orthopedic Skeletal Engine (Three.js WebGL)
// 360° Orbit Rotation, Raycast Hotspot Detection, X-Ray Hologram & Thermal Pain Modes
// ============================================================================

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { BoneRegionId, OrthoFindingType, OrthopedicFinding } from '../../types/specialty';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Activity, RotateCcw, ZoomIn, ZoomOut, Eye, Layers, 
  Sparkles, AlertCircle, X, Shield, Sliders
} from 'lucide-react';

interface SkeletonViewer3DProps {
  findings: OrthopedicFinding[];
  onChange: (findings: OrthopedicFinding[]) => void;
  readOnly?: boolean;
}

type ShaderMode = 'anatomical' | 'xray' | 'thermal';

interface BoneMeshInfo {
  regionId: BoneRegionId;
  name_ar: string;
  name_en: string;
  mesh: THREE.Object3D;
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
  const [hoveredBone, setHoveredBone] = useState<string | null>(null);
  const [activeModalRegion, setActiveModalRegion] = useState<{ regionId: BoneRegionId; name: string } | null>(null);

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
  const boneMeshesRef = useRef<BoneMeshInfo[]>([]);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const skeletonGroupRef = useRef<THREE.Group | null>(null);

  // Mouse interaction state
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const rotationTargetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = 540;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Background gradient effect
    scene.background = new THREE.Color(shaderMode === 'xray' ? 0x07111e : 0x0b1329);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 32);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting setup (Medical Studio Lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x0c87eb, 1.8);
    dirLight1.position.set(10, 20, 15);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x14b8a6, 1.2);
    dirLight2.position.set(-15, -10, -10);
    scene.add(dirLight2);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(0, 15, -20);
    scene.add(rimLight);

    // 5. Build Articulated 3D Anatomical Skeleton
    const skeletonGroup = new THREE.Group();
    skeletonGroupRef.current = skeletonGroup;
    scene.add(skeletonGroup);

    const boneList: BoneMeshInfo[] = [];

    // Helper material generator
    const getBoneMaterial = (color = 0xe2e8f0, roughness = 0.35) => {
      if (shaderMode === 'xray') {
        return new THREE.MeshPhysicalMaterial({
          color: 0x38bdf8,
          emissive: 0x0369a1,
          emissiveIntensity: 0.3,
          roughness: 0.1,
          metalness: 0.1,
          transparent: true,
          opacity: 0.88,
          wireframe: false,
        });
      } else if (shaderMode === 'thermal') {
        return new THREE.MeshStandardMaterial({
          color: 0x10b981,
          roughness: 0.4,
          metalness: 0.1,
        });
      }
      return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness: 0.05,
      });
    };

    // A. Skull & Cranium
    const skullGroup = new THREE.Group();
    const craniumGeom = new THREE.SphereGeometry(1.4, 32, 24);
    craniumGeom.scale(1, 1.15, 1.1);
    const craniumMesh = new THREE.Mesh(craniumGeom, getBoneMaterial(0xf8fafc));
    craniumMesh.position.y = 8.5;
    skullGroup.add(craniumMesh);

    // Facial skeleton & Mandible
    const jawGeom = new THREE.CylinderGeometry(0.7, 0.5, 0.9, 16);
    jawGeom.scale(1, 1, 0.7);
    const jawMesh = new THREE.Mesh(jawGeom, getBoneMaterial(0xf1f5f9));
    jawMesh.position.set(0, 7.3, 0.3);
    skullGroup.add(jawMesh);
    skeletonGroup.add(skullGroup);
    boneList.push({ regionId: 'skull', name_ar: 'الجمجمة والفك (Cranium & Mandible)', name_en: 'Skull & Mandible', mesh: skullGroup });

    // B. Cervical Spine (C1-C7)
    const cervicalGroup = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const vertGeom = new THREE.CylinderGeometry(0.5, 0.55, 0.2, 16);
      const vert = new THREE.Mesh(vertGeom, getBoneMaterial(0xe2e8f0));
      vert.position.set(0, 6.7 - i * 0.28, -0.05);
      cervicalGroup.add(vert);
    }
    skeletonGroup.add(cervicalGroup);
    boneList.push({ regionId: 'cervical_spine', name_ar: 'الفقرات العنقية (Cervical Spine C1-C7)', name_en: 'Cervical Spine', mesh: cervicalGroup });

    // C. Thoracic Spine & Ribcage
    const thoracicGroup = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const vert = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.7, 0.28, 16), getBoneMaterial(0xe2e8f0));
      vert.position.set(0, 4.6 - i * 0.32, -0.1);
      thoracicGroup.add(vert);

      // Rib pairs
      const ribRadius = 2.2 - Math.abs(i - 5) * 0.12;
      const ribGeom = new THREE.TorusGeometry(ribRadius, 0.1, 10, 24, Math.PI * 1.5);
      const ribMesh = new THREE.Mesh(ribGeom, getBoneMaterial(0xdbeafe));
      ribMesh.rotation.x = Math.PI / 2 + 0.15;
      ribMesh.rotation.z = Math.PI * 0.75;
      ribMesh.position.set(0, 4.6 - i * 0.32, 0.2);
      thoracicGroup.add(ribMesh);
    }
    // Sternum
    const sternumMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.2, 0.2), getBoneMaterial(0xf1f5f9));
    sternumMesh.position.set(0, 3.2, 2.1);
    thoracicGroup.add(sternumMesh);
    skeletonGroup.add(thoracicGroup);
    boneList.push({ regionId: 'thoracic_spine', name_ar: 'الفقرات الصدرية والقفص الصدري (Thorax & Ribs)', name_en: 'Thoracic Spine & Ribcage', mesh: thoracicGroup });

    // D. Lumbar Spine (L1-L5)
    const lumbarGroup = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const vert = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.38, 18), getBoneMaterial(0xe2e8f0));
      vert.position.set(0, 0.5 - i * 0.44, -0.05);
      lumbarGroup.add(vert);
    }
    skeletonGroup.add(lumbarGroup);
    boneList.push({ regionId: 'lumbar_spine', name_ar: 'الفقرات القطنية (Lumbar Spine L1-L5)', name_en: 'Lumbar Spine', mesh: lumbarGroup });

    // E. Pelvis & Sacrum
    const pelvisGroup = new THREE.Group();
    // Sacrum
    const sacrumMesh = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 16), getBoneMaterial(0xe2e8f0));
    sacrumMesh.position.set(0, -2.1, -0.2);
    sacrumMesh.rotation.x = Math.PI;
    pelvisGroup.add(sacrumMesh);

    // Iliac Wings (Right & Left)
    const iliumR = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.35, 12, 24, Math.PI), getBoneMaterial(0xf1f5f9));
    iliumR.position.set(-1.4, -1.8, 0.2);
    iliumR.rotation.z = -Math.PI * 0.25;
    pelvisGroup.add(iliumR);

    const iliumL = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.35, 12, 24, Math.PI), getBoneMaterial(0xf1f5f9));
    iliumL.position.set(1.4, -1.8, 0.2);
    iliumL.rotation.z = Math.PI * 1.25;
    pelvisGroup.add(iliumL);
    skeletonGroup.add(pelvisGroup);
    boneList.push({ regionId: 'sacrum_pelvis', name_ar: 'الحوض والعجز (Pelvis & Sacrum)', name_en: 'Pelvic Girdle & Sacrum', mesh: pelvisGroup });

    // F. Upper Limbs (Clavicle, Shoulder, Humerus, Forearm, Hand)
    // Right Shoulder & Humerus
    const shoulderR = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), getBoneMaterial(0x93c5fd));
    shoulderR.position.set(-3.1, 4.4, 0);
    skeletonGroup.add(shoulderR);
    boneList.push({ regionId: 'shoulder_r', name_ar: 'مفصل الكتف الأيمن (Right Shoulder)', name_en: 'Right Shoulder', mesh: shoulderR });

    const humerusR = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 4.2, 16), getBoneMaterial(0xf8fafc));
    humerusR.position.set(-3.4, 2.2, 0);
    skeletonGroup.add(humerusR);
    boneList.push({ regionId: 'humerus_r', name_ar: 'عضد اليد اليمنى (Right Humerus)', name_en: 'Right Humerus', mesh: humerusR });

    const elbowR = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), getBoneMaterial(0x93c5fd));
    elbowR.position.set(-3.5, 0.0, 0);
    skeletonGroup.add(elbowR);
    boneList.push({ regionId: 'elbow_r', name_ar: 'مفصل الكوع الأيمن (Right Elbow)', name_en: 'Right Elbow', mesh: elbowR });

    const forearmR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 4.0, 16), getBoneMaterial(0xf1f5f9));
    forearmR.position.set(-3.6, -2.1, 0);
    skeletonGroup.add(forearmR);
    boneList.push({ regionId: 'radius_ulna_r', name_ar: 'ساعد اليد اليمنى (Right Radius & Ulna)', name_en: 'Right Radius & Ulna', mesh: forearmR });

    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.3), getBoneMaterial(0xe2e8f0));
    handR.position.set(-3.7, -4.6, 0);
    skeletonGroup.add(handR);
    boneList.push({ regionId: 'wrist_hand_r', name_ar: 'رسغ ومشط اليد اليمنى (Right Hand)', name_en: 'Right Wrist & Hand', mesh: handR });

    // Left Shoulder & Humerus
    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), getBoneMaterial(0x93c5fd));
    shoulderL.position.set(3.1, 4.4, 0);
    skeletonGroup.add(shoulderL);
    boneList.push({ regionId: 'shoulder_l', name_ar: 'مفصل الكتف الأيسر (Left Shoulder)', name_en: 'Left Shoulder', mesh: shoulderL });

    const humerusL = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 4.2, 16), getBoneMaterial(0xf8fafc));
    humerusL.position.set(3.4, 2.2, 0);
    skeletonGroup.add(humerusL);
    boneList.push({ regionId: 'humerus_l', name_ar: 'عضد اليد اليسرى (Left Humerus)', name_en: 'Left Humerus', mesh: humerusL });

    const elbowL = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), getBoneMaterial(0x93c5fd));
    elbowL.position.set(3.5, 0.0, 0);
    skeletonGroup.add(elbowL);
    boneList.push({ regionId: 'elbow_l', name_ar: 'مفصل الكوع الأيسر (Left Elbow)', name_en: 'Left Elbow', mesh: elbowL });

    const forearmL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 4.0, 16), getBoneMaterial(0xf1f5f9));
    forearmL.position.set(3.6, -2.1, 0);
    skeletonGroup.add(forearmL);
    boneList.push({ regionId: 'radius_ulna_l', name_ar: 'ساعد اليد اليسرى (Left Radius & Ulna)', name_en: 'Left Radius & Ulna', mesh: forearmL });

    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.3), getBoneMaterial(0xe2e8f0));
    handL.position.set(3.7, -4.6, 0);
    skeletonGroup.add(handL);
    boneList.push({ regionId: 'wrist_hand_l', name_ar: 'رسغ ومشط اليد اليسرى (Left Hand)', name_en: 'Left Wrist & Hand', mesh: handL });

    // G. Lower Limbs (Hips, Femur, Patella/Knee, Tibia, Foot)
    // Right Lower Limb
    const hipR = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), getBoneMaterial(0x60a5fa));
    hipR.position.set(-1.8, -3.1, 0.2);
    skeletonGroup.add(hipR);
    boneList.push({ regionId: 'hip_joint_r', name_ar: 'مفصل الفخذ الأيمن (Right Hip)', name_en: 'Right Hip Joint', mesh: hipR });

    const femurR = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 5.8, 18), getBoneMaterial(0xf8fafc));
    femurR.position.set(-2.0, -6.1, 0.2);
    skeletonGroup.add(femurR);
    boneList.push({ regionId: 'femur_r', name_ar: 'عظمة الفخذ اليمنى (Right Femur)', name_en: 'Right Femur', mesh: femurR });

    const kneeR = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), getBoneMaterial(0x60a5fa));
    kneeR.position.set(-2.0, -9.2, 0.3);
    skeletonGroup.add(kneeR);
    boneList.push({ regionId: 'knee_r', name_ar: 'مفصل الركبة اليمنى (Right Knee)', name_en: 'Right Knee Joint', mesh: kneeR });

    const tibiaR = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 5.6, 18), getBoneMaterial(0xf1f5f9));
    tibiaR.position.set(-2.0, -12.2, 0.2);
    skeletonGroup.add(tibiaR);
    boneList.push({ regionId: 'tibia_fibula_r', name_ar: 'ساق وقصبة الرجل اليمنى (Right Tibia & Fibula)', name_en: 'Right Tibia & Fibula', mesh: tibiaR });

    const footR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 2.0), getBoneMaterial(0xe2e8f0));
    footR.position.set(-2.0, -15.2, 0.8);
    skeletonGroup.add(footR);
    boneList.push({ regionId: 'ankle_foot_r', name_ar: 'كاحل وقدم الرجل اليمنى (Right Ankle & Foot)', name_en: 'Right Ankle & Foot', mesh: footR });

    // Left Lower Limb
    const hipL = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), getBoneMaterial(0x60a5fa));
    hipL.position.set(1.8, -3.1, 0.2);
    skeletonGroup.add(hipL);
    boneList.push({ regionId: 'hip_joint_l', name_ar: 'مفصل الفخذ الأيسر (Left Hip)', name_en: 'Left Hip Joint', mesh: hipL });

    const femurL = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 5.8, 18), getBoneMaterial(0xf8fafc));
    femurL.position.set(2.0, -6.1, 0.2);
    skeletonGroup.add(femurL);
    boneList.push({ regionId: 'femur_l', name_ar: 'عظمة الفخذ اليسرى (Left Femur)', name_en: 'Left Femur', mesh: femurL });

    const kneeL = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), getBoneMaterial(0x60a5fa));
    kneeL.position.set(2.0, -9.2, 0.3);
    skeletonGroup.add(kneeL);
    boneList.push({ regionId: 'knee_l', name_ar: 'مفصل الركبة اليسرى (Left Knee)', name_en: 'Left Knee Joint', mesh: kneeL });

    const tibiaL = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 5.6, 18), getBoneMaterial(0xf1f5f9));
    tibiaL.position.set(2.0, -12.2, 0.2);
    skeletonGroup.add(tibiaL);
    boneList.push({ regionId: 'tibia_fibula_l', name_ar: 'ساق وقصبة الرجل اليسرى (Left Tibia & Fibula)', name_en: 'Left Tibia & Fibula', mesh: tibiaL });

    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 2.0), getBoneMaterial(0xe2e8f0));
    footL.position.set(2.0, -15.2, 0.8);
    skeletonGroup.add(footL);
    boneList.push({ regionId: 'ankle_foot_l', name_ar: 'كاحل وقدم الرجل اليسرى (Left Ankle & Foot)', name_en: 'Left Ankle & Foot', mesh: footL });

    boneMeshesRef.current = boneList;

    // 6. Holographic Markers Group
    const markersGroup = new THREE.Group();
    markersGroupRef.current = markersGroup;
    skeletonGroup.add(markersGroup);

    // 7. Raycaster for 3D picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const deltaX = e.clientX - prevMouseRef.current.x;
        const deltaY = e.clientY - prevMouseRef.current.y;

        rotationTargetRef.current.y += deltaX * 0.008;
        rotationTargetRef.current.x += deltaY * 0.008;

        prevMouseRef.current = { x: e.clientX, y: e.clientY };
      }

      // Raycast detection
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const allMeshes: THREE.Object3D[] = [];
      boneMeshesRef.current.forEach(b => {
        if (b.mesh instanceof THREE.Group) {
          allMeshes.push(...b.mesh.children);
        } else {
          allMeshes.push(b.mesh);
        }
      });

      const intersects = raycaster.intersectObjects(allMeshes);
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const match = boneMeshesRef.current.find(b => 
          b.mesh === hitMesh || (b.mesh instanceof THREE.Group && b.mesh.children.includes(hitMesh))
        );
        if (match) {
          setHoveredBone(locale === 'ar' ? match.name_ar : match.name_en);
        }
      } else {
        setHoveredBone(null);
      }
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    const handleCanvasClick = (e: MouseEvent) => {
      if (readOnly) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const allMeshes: THREE.Object3D[] = [];
      boneMeshesRef.current.forEach(b => {
        if (b.mesh instanceof THREE.Group) {
          allMeshes.push(...b.mesh.children);
        } else {
          allMeshes.push(b.mesh);
        }
      });

      const intersects = raycaster.intersectObjects(allMeshes);
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const match = boneMeshesRef.current.find(b => 
          b.mesh === hitMesh || (b.mesh instanceof THREE.Group && b.mesh.children.includes(hitMesh))
        );
        if (match) {
          setActiveModalRegion({ regionId: match.regionId, name: locale === 'ar' ? match.name_ar : match.name_en });
          setFindingType('fracture_closed');
          setSeverity('moderate');
          setPainScale(6);
          setDescription('');
          setTreatment('');
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    domElement.addEventListener('click', handleCanvasClick);

    // Zoom on Wheel
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + e.deltaY * 0.02, 12, 60);
    };
    domElement.addEventListener('wheel', handleWheel, { passive: false });

    // 8. Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Smooth damping rotation
      skeletonGroup.rotation.y += (rotationTargetRef.current.y - skeletonGroup.rotation.y) * 0.1;
      skeletonGroup.rotation.x += (rotationTargetRef.current.x - skeletonGroup.rotation.x) * 0.1;
      skeletonGroup.rotation.x = THREE.MathUtils.clamp(skeletonGroup.rotation.x, -0.6, 0.6);

      // Pulse markers in 3D
      if (markersGroupRef.current) {
        const t = clock.getElapsedTime() * 3;
        markersGroupRef.current.children.forEach((child, i) => {
          const s = 1 + Math.sin(t + i) * 0.15;
          child.scale.set(s, s, s);
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      domElement.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      domElement.removeEventListener('click', handleCanvasClick);
      domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [shaderMode, locale]);

  // Update 3D Pins when findings change
  useEffect(() => {
    const group = markersGroupRef.current;
    if (!group) return;

    // Clear old marker meshes
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    // Add pins for current findings
    findings.forEach(f => {
      const match = boneMeshesRef.current.find(b => b.regionId === f.regionId);
      if (match) {
        const pos = new THREE.Vector3();
        match.mesh.getWorldPosition(pos);

        // Marker Sphere
        const pinGeom = new THREE.SphereGeometry(0.5, 16, 16);
        const pinMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const pinMesh = new THREE.Mesh(pinGeom, pinMat);

        // Holographic Outer Ring
        const ringGeom = new THREE.RingGeometry(0.6, 0.85, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.position.z = 0.1;
        pinMesh.add(ringMesh);

        pinMesh.position.copy(pos);
        group.add(pinMesh);
      }
    });
  }, [findings]);

  const handleResetCamera = () => {
    rotationTargetRef.current = { x: 0, y: 0 };
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 0, 32);
    }
  };

  const handleRotateLeft = () => {
    rotationTargetRef.current.y -= Math.PI / 4;
  };

  const handleRotateRight = () => {
    rotationTargetRef.current.y += Math.PI / 4;
  };

  const handleZoom = (delta: number) => {
    if (cameraRef.current) {
      cameraRef.current.position.z = THREE.MathUtils.clamp(cameraRef.current.position.z + delta, 12, 60);
    }
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalRegion) return;

    const newF: OrthopedicFinding = {
      id: `ortho-3d-${Date.now()}`,
      regionId: activeModalRegion.regionId,
      view: 'anterior',
      x: 50,
      y: 50,
      findingType,
      severity,
      painScale,
      description: description || activeModalRegion.name,
      treatmentRecommended: treatment,
    };

    onChange([...findings, newF]);
    setActiveModalRegion(null);
  };

  const handleDeleteFinding = (id: string) => {
    onChange(findings.filter(f => f.id !== id));
  };

  return (
    <div className="bg-slate-950 text-white rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
      {/* 3D Viewport Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <h3 className="font-black text-sm sm:text-base text-cyan-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              {locale === 'ar' ? 'المحرك التشخيصي ثلاثي الأبعاد لجراحة العظام (3D WebGL Engine)' : '3D WebGL Orthopedic Diagnostic Engine'}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {locale === 'ar' ? 'تدوير كامل 360° بالسحب، تكبير بالبكرة، وفحص الأشعة السينية بالألوان الطيفية' : 'Full 360° Orbit rotation, Raycast bone picking & X-Ray Shader'}
          </p>
        </div>

        {/* Shader Mode Switches */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setShaderMode('xray')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                shaderMode === 'xray' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              {locale === 'ar' ? 'أشعة سينية (X-Ray)' : 'X-Ray'}
            </button>
            <button
              type="button"
              onClick={() => setShaderMode('anatomical')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                shaderMode === 'anatomical' ? 'bg-white text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {locale === 'ar' ? 'تشريحي واقعي' : 'Realistic'}
            </button>
            <button
              type="button"
              onClick={() => setShaderMode('thermal')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                shaderMode === 'thermal' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              {locale === 'ar' ? 'خريطة الألم (Thermal)' : 'Pain Heatmap'}
            </button>
          </div>

          {/* Orbit Navigation Controls */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={handleRotateLeft}
              title="تدوير لليسار"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg"
            >
              ↺
            </button>
            <button
              type="button"
              onClick={handleRotateRight}
              title="تدوير لليمين"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg"
            >
              ↻
            </button>
            <button
              type="button"
              onClick={() => handleZoom(-4)}
              title="تكبير"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(4)}
              title="تصغير"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetCamera}
              title="إعادة ضبط المشهد"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3D WebGL Canvas Viewport */}
      <div className="relative w-full h-[540px] bg-radial from-slate-900 to-slate-950 flex items-center justify-center cursor-grab active:cursor-grabbing select-none overflow-hidden">
        <div ref={mountRef} className="w-full h-full" />

        {/* Hovered Bone Overlay HUD */}
        {hoveredBone && (
          <div className="absolute top-4 start-4 bg-slate-900/90 border border-cyan-500/40 px-4 py-2 rounded-xl text-xs font-bold text-cyan-300 shadow-xl backdrop-blur-md flex items-center gap-2 pointer-events-none animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>{hoveredBone}</span>
          </div>
        )}

        {/* 3D Navigation Guide Pill */}
        <div className="absolute bottom-4 start-4 text-[10px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 backdrop-blur-sm pointer-events-none flex items-center gap-2">
          <span>🖱️ {locale === 'ar' ? 'اسحب بالماوس للتدوير 360° • عجلة الماوس للتكبير • اضغط على العظمة للتوثيق' : 'Drag to rotate 360° • Wheel to zoom • Click bone to document'}</span>
        </div>
      </div>

      {/* Findings List Summary */}
      {findings.length > 0 && (
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-500" />
            {locale === 'ar' ? 'الإصابات الموثقة في النموذج ثلاثي الأبعاد:' : '3D Documented Skeletal Findings:'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {findings.map((f, i) => (
              <div key={f.id} className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 flex items-start justify-between text-xs">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[10px] flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="font-bold text-slate-200">{f.description}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="text-amber-400">الألم: {f.painScale}/10</span>
                    <span className="uppercase text-slate-500">{f.findingType.replace('_', ' ')}</span>
                  </div>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFinding(f.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finding Documentation Modal */}
      {activeModalRegion && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-700 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-sm sm:text-base text-cyan-300">
                  {locale === 'ar' ? 'توثيق سريري على الهيكل ثلاثي الأبعاد' : '3D Clinical Skeletal Finding'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalRegion(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div className="bg-cyan-950/40 p-3 rounded-xl border border-cyan-800/50">
                <p className="text-xs text-cyan-400 font-semibold mb-0.5">
                  {locale === 'ar' ? 'العظمة / المفصل المحدد في المشهد ثلاثي الأبعاد:' : 'Selected 3D Bone / Joint:'}
                </p>
                <p className="font-bold text-white text-sm">{activeModalRegion.name}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {locale === 'ar' ? 'التشخيص ونوع الإصابة' : 'Pathology Type'}
                </label>
                <select
                  value={findingType}
                  onChange={e => setFindingType(e.target.value as OrthoFindingType)}
                  className="w-full text-sm rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="fracture_closed">{locale === 'ar' ? 'كسر مغلق (Closed Fracture)' : 'Closed Fracture'}</option>
                  <option value="fracture_open">{locale === 'ar' ? 'كسر مضاعف مفتوح (Open Fracture)' : 'Open Fracture'}</option>
                  <option value="dislocation">{locale === 'ar' ? 'خلع مفصلي (Dislocation)' : 'Dislocation'}</option>
                  <option value="sprain_strain">{locale === 'ar' ? 'تمزق أربطة أو غضروف هلالي (Sprain / Tear)' : 'Sprain / Ligament Tear'}</option>
                  <option value="osteoarthritis">{locale === 'ar' ? 'خشونة وتآكل مفصلي (Osteoarthritis)' : 'Osteoarthritis'}</option>
                  <option value="post_operative_hardware">{locale === 'ar' ? 'تثبيت جراحي سابق / شرائح ومسامير (Hardware)' : 'Hardware'}</option>
                  <option value="point_tenderness">{locale === 'ar' ? 'نقطة ألم حادة وموضعية (Point Tenderness)' : 'Point Tenderness'}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {locale === 'ar' ? 'الشدة السريرية' : 'Severity'}
                  </label>
                  <select
                    value={severity}
                    onChange={e => setSeverity(e.target.value as 'mild' | 'moderate' | 'severe')}
                    className="w-full text-sm rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white"
                  >
                    <option value="mild">{locale === 'ar' ? 'بسيط (Mild)' : 'Mild'}</option>
                    <option value="moderate">{locale === 'ar' ? 'متوسط (Moderate)' : 'Moderate'}</option>
                    <option value="severe">{locale === 'ar' ? 'شديد / حاد (Severe)' : 'Severe'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {locale === 'ar' ? `مقياس الألم (${painScale}/10)` : `Pain Scale (${painScale}/10)`}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={painScale}
                    onChange={e => setPainScale(Number(e.target.value))}
                    className="w-full accent-cyan-400 mt-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {locale === 'ar' ? 'الملاحظات السريرية' : 'Clinical Description'}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={locale === 'ar' ? 'تفاصيل الإصابة، الفحص الموضعي...' : 'Clinical details...'}
                  className="w-full text-sm rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveModalRegion(null)}
                  className="px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-slate-950 font-black rounded-xl shadow-lg"
                >
                  {locale === 'ar' ? 'تثبيت الإشارة ثلاثية الأبعاد' : 'Place 3D Pin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
