import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSceneRuntime, applySeriesTransform } from './sceneRuntime';

type ViewerEditor = { effectsEnabled?: boolean; activeEffect?: string; effectIntensity?: number };
type ViewerOptions = {
  canvas: HTMLCanvasElement;
  config: Record<string, any>;
  resolveAsset?: (path: string) => string;
  onError?: (error: Error) => void;
  editor?: ViewerEditor;
};

export function normalizeViewerEffect(editor?: ViewerEditor) {
  if (!editor?.effectsEnabled) return null;
  const type = editor.activeEffect ?? 'moebius';
  const intensity = editor.effectIntensity ?? 1;
  if (!Number.isFinite(intensity) || intensity < 0) throw new Error('后期效果强度必须为有限的非负数。');
  if (type === 'bloom') return { type, options: { intensity } };
  if (type === 'moebius') return { type, options: { thickness: 1.5 * intensity, amplitude: 2 * intensity } };
  throw new Error(`不支持的后期效果：${type}。当前可导出 moebius、bloom。`);
}

type OfflinePass = {
  render(): void;
  composer: { setSize(width: number, height: number): void; dispose(): void };
  depthRenderTarget?: THREE.WebGLRenderTarget;
  normalRenderTarget?: THREE.WebGLRenderTarget;
  normalMat?: THREE.Material;
};
const shapeTypes = new Set(['rectangle', 'ellipse', 'triangle', 'polygon', 'star']);
function shapeGeometry(type: string, width: number, height: number): THREE.BufferGeometry {
  if (type === 'rectangle') return new THREE.PlaneGeometry(width, height);
  if (type === 'ellipse') {
    const geometry = new THREE.CircleGeometry(0.5, 64);
    geometry.scale(width, height, 1);
    return geometry;
  }
  const shape = new THREE.Shape();
  const count = type === 'triangle' ? 3 : type === 'polygon' ? 5 : 10;
  for (let i = 0; i < count; i++) {
    const angle = Math.PI / 2 + i * Math.PI * 2 / count;
    const radius = type === 'star' && i % 2 ? 0.23 : 0.5;
    const x = Math.cos(angle) * radius * width, y = Math.sin(angle) * radius * height;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** Standalone, bundled offline viewer. Every asset URL is supplied by the exported project. */
export function mount({ canvas, config, resolveAsset = path => path, onError, editor }: ViewerOptions) {
  const reportError = (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    if (onError) onError(error); else console.error(error);
    return error;
  };
  let effect: ReturnType<typeof normalizeViewerEffect>;
  try { effect = normalizeViewerEffect(editor); }
  catch (error) { throw reportError(error); }
  const scene = new THREE.Scene();
  const renderConfig = config.renderer ?? {};
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: renderConfig.antialias !== false, alpha: renderConfig.alpha ?? false });
  renderer.setClearColor(renderConfig.clearColor ?? '#ffffff', renderConfig.clearAlpha ?? 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cameraConfig = config.camera ?? {};
  const camera = cameraConfig.type === 'OrthographicCamera'
    ? new THREE.OrthographicCamera(-10, 10, 10, -10, cameraConfig.near ?? 0.1, cameraConfig.far ?? 2000)
    : new THREE.PerspectiveCamera(cameraConfig.fov ?? 45, 1, cameraConfig.near ?? 0.1, cameraConfig.far ?? 2000);
  camera.position.set(cameraConfig.position?.x ?? 0, cameraConfig.position?.y ?? 10, cameraConfig.position?.z ?? 20);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(cameraConfig.target?.x ?? 0, cameraConfig.target?.y ?? 0, cameraConfig.target?.z ?? 0);
  controls.enableDamping = cameraConfig.controls?.enableDamping ?? true;
  controls.enablePan = cameraConfig.controls?.enablePan ?? true;
  for (const property of ['minDistance', 'maxDistance', 'minPolarAngle', 'maxPolarAngle', 'minAzimuthAngle', 'maxAzimuthAngle'] as const) {
    if (typeof cameraConfig.controls?.[property] === 'number') controls[property] = cameraConfig.controls[property];
  }
  controls.update();
  if (config.fog?.show) scene.fog = new THREE.Fog(config.fog.color ?? '#ffffff', config.fog.near ?? 1, config.fog.far ?? 1500);
  const runtime = createSceneRuntime({ scene, camera, renderer, config, resolveAsset, onError });
  const roots = new Map<string, THREE.Object3D>();
  scene.children.forEach(object => { if (object.userData.seriesId != null) roots.set(String(object.userData.seriesId), object); });
  const primitiveMeshes: THREE.Mesh[] = [];
  for (const item of config.series ?? []) {
    let geometry: THREE.BufferGeometry | undefined;
    if (shapeTypes.has(item.type)) geometry = shapeGeometry(item.type, item.size?.x ?? 2, item.size?.y ?? 2);
    else if (item.type === 'cube') geometry = new THREE.BoxGeometry(item.size?.x ?? 2, item.size?.y ?? 2, item.size?.z ?? 2);
    else if (item.type === 'sphere') geometry = new THREE.SphereGeometry(item.radius ?? 1.4, 48, 48);
    else if (item.type === 'cylinder') geometry = new THREE.CylinderGeometry(item.radiusTop ?? 1, item.radiusBottom ?? 1, item.height ?? 2, 48);
    let object: THREE.Object3D;
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: item.color ?? ({ sphere: '#7c5cff', cube: '#4f8cff', cylinder: '#ff9955' } as Record<string, string>)[item.type] ?? '#638cf4', opacity: item.opacity ?? 1, transparent: (item.opacity ?? 1) < 1 || shapeTypes.has(item.type), side: shapeTypes.has(item.type) ? THREE.DoubleSide : THREE.FrontSide }));
      primitiveMeshes.push(mesh); object = mesh;
    } else if (item.type === 'group') object = new THREE.Group();
    else continue;
    object.userData = { id: item.id, seriesId: item.id, designRoot: true };
    applySeriesTransform(object, item);
    roots.set(String(item.id), object); scene.add(object);
  }
  for (const item of config.series ?? []) {
    const child = roots.get(String(item.id)), parent = roots.get(String(item.parentId));
    if (child && parent && parent !== child && (parent as THREE.Group).isGroup) {
      let ancestor: THREE.Object3D | null = parent;
      while (ancestor && ancestor !== child) ancestor = ancestor.parent;
      if (ancestor === child) continue;
      parent.add(child); child.userData.designRoot = false;
    }
  }
  let frame = 0, disposed = false;
  let postprocess: OfflinePass | null = null;
  const sizes = { width: 1, height: 1, pixelRatio: renderer.getPixelRatio() };
  const resize = () => {
    const width = Math.max(1, canvas.clientWidth || innerWidth), height = Math.max(1, canvas.clientHeight || innerHeight);
    renderer.setSize(width, height, false);
    if (camera instanceof THREE.PerspectiveCamera) camera.aspect = width / height;
    else { camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2; }
    camera.updateProjectionMatrix();
    sizes.width = width; sizes.height = height; sizes.pixelRatio = renderer.getPixelRatio();
    postprocess?.composer.setSize(width, height);
    postprocess?.depthRenderTarget?.setSize(width, height);
    postprocess?.normalRenderTarget?.setSize(width, height);
  };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  if (camera instanceof THREE.OrthographicCamera) {
    const distance = camera.position.distanceTo(controls.target);
    const height = 2 * Math.max(distance, 1) * Math.tan(THREE.MathUtils.degToRad(cameraConfig.fov ?? 75) / 2);
    camera.zoom = cameraConfig.zoom ?? ((camera.top - camera.bottom) / height);
    camera.updateProjectionMatrix();
  }
  const animate = () => {
    if (disposed) return;
    try {
      controls.update(); runtime.update();
      if (postprocess) postprocess.render(); else renderer.render(scene, camera);
    } catch (error) { reportError(error); return; }
    frame = requestAnimationFrame(animate);
  };
  const ready = (effect ? import('three-auto').then(({ MoebiusPass, BloomPass }) => {
    if (disposed) return;
    // Reuse Creator's exact shader and bloom kernel, with the scene/render
    // adapter consumed by AUTO's BaseThree. The dependency is bundled offline.
    const adapter = { scene, camera: { instance: camera }, renderer: { instance: renderer }, sizes, _canvas: canvas, time: {} };
    try {
      postprocess = (effect.type === 'moebius'
        ? new MoebiusPass(effect.options, adapter as any)
        : new BloomPass(effect.options, adapter as any)) as unknown as OfflinePass;
      postprocess.composer.setSize(sizes.width, sizes.height);
    } catch (error) {
      observer.disconnect(); controls.dispose(); runtime.dispose(); renderer.dispose();
      throw error;
    }
  }) : Promise.resolve()).then(() => {
    if (!disposed) animate();
    return runtime.ready;
  }).catch(error => { throw reportError(error); });
  return {
    ready, scene, camera, renderer, resize,
    dispose() {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); runtime.dispose();
      primitiveMeshes.forEach(mesh => {
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose());
      });
      postprocess?.composer.dispose();
      postprocess?.depthRenderTarget?.dispose();
      postprocess?.normalRenderTarget?.dispose();
      postprocess?.normalMat?.dispose();
      renderer.dispose(); scene.clear();
    },
  };
}
