import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createSkyBackground } from './skyBackground';
import { addGroundSurfaceDetail } from './groundSurface';

type RuntimeOptions = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  config: Record<string, any>;
  resolveAsset: (path: string) => string;
  onError?: (error: Error) => void;
};
type Entry = {
  root: THREE.Group;
  item: any;
  signature: string;
  cancelled: boolean;
  coarse?: THREE.Group;
  detail?: THREE.Group;
  detailPromise?: Promise<void>;
  detailFailed?: boolean;
  showingDetail: boolean;
  center: THREE.Vector3;
};

export const portableSeriesTypes = new Set(['model', 'ground', 'instances']);

/** Only the editable outer root uses TRS; imported affine matrices stay untouched below it. */
export function applySeriesTransform(root: THREE.Object3D, item: any) {
  root.position.set(item.position?.x ?? 0, item.position?.y ?? 0, item.position?.z ?? 0);
  root.rotation.set(item.rotation?.x ?? 0, item.rotation?.y ?? 0, item.rotation?.z ?? 0);
  root.scale.set(item.scale?.x ?? 1, item.scale?.y ?? 1, item.scale?.z ?? 1);
  root.visible = item.show !== false;
  root.name = item.name || item.type || '';
  root.updateMatrix();
}

export function isVisibleInHierarchy(object: THREE.Object3D | null) {
  for (let current = object; current; current = current.parent) {
    if (!current.visible || current.userData.__designInternal) return false;
  }
  return true;
}

/** Shared by Creator and its offline export. No labels or DOM UI are created here. */
export function createSceneRuntime({ scene, camera, renderer, config, resolveAsset, onError }: RuntimeOptions) {
  let disposed = false;
  const entries = new Map<string, Entry>();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const lights: THREE.Light[] = [];
  const instancedMeshes = new Set<THREE.InstancedMesh>();
  const initialTasks: Promise<unknown>[] = [];
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const sources = new Map<string, Promise<THREE.Group>>();
  const textureSources = new Map<string, Promise<THREE.Texture>>();
  const oldEnvironment = scene.environment;
  const oldBackground = scene.background;
  const oldEnvironmentIntensity = scene.environmentIntensity;
  let environment: THREE.Texture | null = null;
  let environmentBackground: THREE.Texture | null = null;
  let environmentTarget: THREE.WebGLRenderTarget | null = null;
  const position = new THREE.Vector3();
  const worldCenter = new THREE.Vector3();
  const report = (reason: unknown, path = '') => {
    if (disposed) return;
    const error = new Error(`${path ? `无法加载 ${path}：` : ''}${reason instanceof Error ? reason.message : String(reason)}`);
    if (onError) onError(error);
    else console.error(error);
  };
  const releaseResources = () => {
    geometries.forEach(resource => resource.dispose()); geometries.clear();
    materials.forEach(resource => resource.dispose()); materials.clear();
    textures.forEach(resource => resource.dispose()); textures.clear();
  };
  const rememberMaterial = (material: THREE.Material) => {
    materials.add(material);
    Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
  };
  const rememberObject = (root: THREE.Object3D) => root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(rememberMaterial);
  });
  const loadSource = (path: string) => {
    let promise = sources.get(path);
    if (!promise) {
      promise = loader.loadAsync(resolveAsset(path)).then(gltf => {
        rememberObject(gltf.scene);
        if (disposed) releaseResources();
        return gltf.scene;
      });
      sources.set(path, promise);
    }
    return promise;
  };
  const loadTexture = (path: string) => {
    let promise = textureSources.get(path);
    if (!promise) {
      promise = new THREE.TextureLoader().loadAsync(resolveAsset(path)).then(texture => {
        if (disposed) texture.dispose();
        else textures.add(texture);
        return texture;
      });
      textureSources.set(path, promise);
    }
    return promise;
  };
  const isLive = (entry: Entry) => !disposed && !entry.cancelled;
  const prepareMeshes = (root: THREE.Object3D, item: any, mask?: THREE.Texture) => {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = item.castShadow !== false;
      object.receiveShadow = item.receiveShadow !== false;
      object.frustumCulled = true;
      const reflection = item.reflection ?? item.envMapIntensity;
      if (!item.glass && reflection == null) return;
      const prepare = (source: THREE.Material) => {
        if (!(source instanceof THREE.MeshStandardMaterial)) return source;
        if (!item.glass) {
          const material = source.clone();
          material.envMapIntensity = reflection;
          rememberMaterial(material);
          return material;
        }
        const material = new THREE.MeshPhysicalMaterial();
        // Copy every imported standard material property before adding the optional glass finish.
        THREE.MeshStandardMaterial.prototype.copy.call(material, source);
        material.metalness = item.glass.metalness ?? 0.9;
        material.roughness = item.glass.roughness ?? 0.12;
        material.envMapIntensity = item.glass.reflection ?? 1;
        material.clearcoat = 1;
        material.clearcoatRoughness = 0.08;
        if (mask) {
          material.metalnessMap = mask;
          material.roughnessMap = mask;
          material.clearcoatMap = mask;
        }
        rememberMaterial(material);
        return material;
      };
      object.material = Array.isArray(object.material) ? object.material.map(prepare) : prepare(object.material);
    });
  };
  const loadModel = async (entry: Entry, detail = false) => {
    const item = entry.item;
    const path = detail ? item.detailSrc : item.src;
    const [source, mask] = await Promise.all([
      loadSource(path),
      item.glass?.mask ? loadTexture(item.glass.mask) : Promise.resolve(undefined),
    ]);
    if (!isLive(entry)) return;
    if (mask) { mask.flipY = false; mask.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); }
    const asset = new THREE.Group();
    const model = source.clone(true);
    asset.add(model);
    const matrix = detail ? (item.detailAssetMatrix ?? item.assetMatrix) : item.assetMatrix;
    if (Array.isArray(matrix) && matrix.length === 16) {
      asset.matrix.fromArray(matrix);
      asset.matrixAutoUpdate = false;
    } else if (item.fitSize != null) {
      asset.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(asset);
      const size = bounds.getSize(new THREE.Vector3());
      const fit = item.fitSize;
      if (typeof fit === 'number') {
        model.scale.multiplyScalar(fit / (Math.max(size.x, size.y, size.z) || 1));
      } else {
        const x = fit.x ?? fit.width, y = fit.y ?? fit.height, z = fit.z ?? fit.depth;
        if (x != null) model.scale.x *= x / (size.x || 1);
        if (y != null) model.scale.y *= y / (size.y || 1);
        if (z != null) model.scale.z *= z / (size.z || 1);
      }
      asset.updateMatrixWorld(true);
      bounds.setFromObject(asset);
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
    }
    prepareMeshes(model, item, mask);
    asset.name = detail ? 'detail-asset' : 'base-asset';
    asset.visible = !detail;
    entry.root.add(asset);
    if (detail) entry.detail = asset;
    else {
      entry.coarse = asset;
      entry.root.updateWorldMatrix(true, true);
      const center = new THREE.Box3().setFromObject(asset).getCenter(new THREE.Vector3());
      entry.center.copy(entry.root.worldToLocal(center));
    }
  };
  const loadGround = async (entry: Entry) => {
    const item = entry.item;
    const [texture, surfaceAtlas] = await Promise.all([
      item.texture ? loadTexture(item.texture) : Promise.resolve(null),
      item.surfaceDetail?.src ? loadTexture(item.surfaceDetail.src) : Promise.resolve(null),
    ]);
    if (!isLive(entry)) return;
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      // Ground textures start from the opposite image corner on both axes.
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(-1, -1);
      texture.offset.set(1, 1);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
    }
    const geometry = new THREE.PlaneGeometry(item.width ?? 420, item.depth ?? 460);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ map: texture, color: item.color ?? '#ffffff', roughness: 1, metalness: 0, alphaTest: item.alphaTest ?? 0.65, side: THREE.DoubleSide });
    if (texture && surfaceAtlas) addGroundSurfaceDetail(material, texture, surfaceAtlas, item.surfaceDetail, renderer);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    geometries.add(geometry); rememberMaterial(material);
    entry.root.add(mesh);
  };
  const loadInstances = async (entry: Entry) => {
    const source = await loadSource(entry.item.src);
    if (!isLive(entry)) return;
    source.updateMatrixWorld(true);
    const transforms: number[][] = entry.item.instanceMatrices ?? [];
    const transform = new THREE.Matrix4();
    source.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const mesh = new THREE.InstancedMesh(object.geometry, object.material, transforms.length);
      transforms.forEach((matrix, index) => {
        transform.fromArray(matrix).multiply(object.matrixWorld);
        mesh.setMatrixAt(index, transform);
        const color = entry.item.instanceColors?.[index];
        if (color != null) mesh.setColorAt(index, new THREE.Color(color));
      });
      instancedMeshes.add(mesh);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      mesh.castShadow = entry.item.castShadow !== false;
      mesh.receiveShadow = entry.item.receiveShadow !== false;
      prepareMeshes(mesh, entry.item);
      entry.root.add(mesh);
    });
  };
  const signatureOf = (item: any) => {
    const { position: _position, rotation: _rotation, scale: _scale, name: _name, show: _show, parentId: _parentId, ...structural } = item;
    return JSON.stringify(structural);
  };
  const sync = (series: any[]) => {
    if (disposed) return;
    const alive = new Set<string>();
    series.filter(item => portableSeriesTypes.has(item.type)).forEach(item => {
      const id = String(item.id);
      alive.add(id);
      let entry = entries.get(id);
      const signature = signatureOf(item);
      if (entry && entry.signature !== signature) {
        entry.cancelled = true; entry.root.removeFromParent(); entries.delete(id); entry = undefined;
      }
      if (!entry) {
        const root = new THREE.Group();
        root.userData = { id: item.id, seriesId: item.id, designRoot: true };
        entry = { root, item, signature, cancelled: false, showingDetail: false, center: new THREE.Vector3() };
        entries.set(id, entry); scene.add(root);
        const task = (item.type === 'model' ? loadModel(entry) : item.type === 'ground' ? loadGround(entry) : loadInstances(entry))
          .catch(error => report(error, item.src ?? item.texture));
        initialTasks.push(task);
      }
      entry.item = item;
      applySeriesTransform(entry.root, item);
    });
    entries.forEach((entry, id) => {
      if (alive.has(id)) return;
      entry.cancelled = true; entry.root.removeFromParent(); entries.delete(id);
    });
  };
  const update = () => {
    if (disposed) return;
    camera.getWorldPosition(position);
    entries.forEach(entry => {
      if (!entry.item.detailSrc || !entry.coarse || !isVisibleInHierarchy(entry.root)) return;
      entry.root.updateWorldMatrix(true, false);
      worldCenter.copy(entry.center).applyMatrix4(entry.root.matrixWorld);
      const distance = position.distanceTo(worldCenter);
      const mode = entry.item.detailMode ?? config.detailMode ?? 'auto';
      const wantsDetail = mode === 'detail' || (mode === 'auto' && distance < (entry.showingDetail ? (entry.item.lod?.exit ?? 185) : (entry.item.lod?.enter ?? 155)));
      if (!entry.detail && !entry.detailPromise && !entry.detailFailed && (mode === 'detail' || (mode === 'auto' && distance < (entry.item.lod?.prefetch ?? 225)))) {
        entry.detailPromise = loadModel(entry, true)
          .catch(error => { entry.detailFailed = true; report(error, entry.item.detailSrc); })
          .finally(() => { entry.detailPromise = undefined; if (isLive(entry)) update(); });
      }
      entry.showingDetail = wantsDetail && Boolean(entry.detail);
      entry.coarse.visible = !entry.showingDetail;
      if (entry.detail) entry.detail.visible = entry.showingDetail;
    });
  };

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = config.renderer?.exposure ?? 1.1;
  const needsFallbackLight = (config.series ?? []).some((item: any) => item.type === 'model' || item.type === 'instances')
    && config.lighting == null && config.environment == null && config.light == null;
  if (needsFallbackLight) {
    const hemisphere = new THREE.HemisphereLight('#e8f5ff', '#738167', 1.15);
    lights.push(hemisphere); scene.add(hemisphere);
  }
  if (config.lighting?.hemisphere) {
    const light = config.lighting.hemisphere;
    const hemisphere = new THREE.HemisphereLight(light.sky ?? '#e8f5ff', light.ground ?? '#738167', light.intensity ?? 1.15);
    lights.push(hemisphere); scene.add(hemisphere);
  }
  if (config.lighting?.sun) {
    const light = config.lighting.sun;
    const sun = new THREE.DirectionalLight(light.color ?? '#fff4dc', light.intensity ?? 1.6);
    sun.position.set(light.position?.x ?? -90, light.position?.y ?? 160, light.position?.z ?? 55);
    sun.castShadow = light.castShadow ?? false;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -270, right: 270, top: 270, bottom: -270, near: 1, far: 450 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0001; sun.shadow.normalBias = 0.02;
    renderer.shadowMap.enabled = sun.castShadow; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    lights.push(sun); scene.add(sun); scene.add(sun.target);
  }
  if (config.environment?.src) {
    const path = config.environment.src;
    const task = new HDRLoader().loadAsync(resolveAsset(path)).then(texture => {
      if (disposed) { texture.dispose(); return; }
      const generator = new THREE.PMREMGenerator(renderer);
      try { environmentTarget = generator.fromEquirectangular(texture); }
      catch (error) { texture.dispose(); throw error; }
      finally { generator.dispose(); }
      environment = environmentTarget.texture;
      scene.environment = environment;
      scene.environmentIntensity = config.environment.intensity ?? 0.35;
      if (config.environment.background) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const background = createSkyBackground(texture, config.environment.backgroundScale ?? 2);
        environmentBackground = background; textures.add(background); scene.background = background;
        if (background !== texture) texture.dispose();
      } else texture.dispose();
    }).catch(error => report(error, path));
    initialTasks.push(task);
  }
  sync(config.series ?? []);
  const ready = Promise.all(initialTasks).then(() => { if (!disposed) update(); });
  return {
    ready, sync, update,
    dispose() {
      if (disposed) return;
      disposed = true;
      entries.forEach(entry => { entry.cancelled = true; entry.root.removeFromParent(); }); entries.clear();
      lights.forEach(light => {
        light.removeFromParent();
        if (light instanceof THREE.DirectionalLight) light.target.removeFromParent();
        light.dispose();
      });
      if (scene.environment === environment && environment) scene.environment = oldEnvironment;
      if (scene.background === environmentBackground && environmentBackground) scene.background = oldBackground;
      scene.environmentIntensity = oldEnvironmentIntensity;
      environmentTarget?.dispose();
      instancedMeshes.forEach(mesh => mesh.dispose()); instancedMeshes.clear();
      releaseResources(); sources.clear(); textureSources.clear();
    },
  };
}
