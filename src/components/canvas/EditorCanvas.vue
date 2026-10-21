<template>
  <div class="canvas-container">
    <div class="canvas-wrapper">
      <canvas id="_scene" :class="{ 'shape-drawing': editorStore.activeTool !== 'select' && !editorStore.isPreview }"
        @pointerdown.capture="onShapePointerDown" @pointermove.capture="onShapePointerMove"
        @pointerup.capture="onShapePointerUp" @pointercancel.capture="cancelShapeDrawing"
        @mousedown.capture="onShapeMouseDown"
        @click="onCanvasClick" @contextmenu.prevent="onCanvasContextMenu"></canvas>
      <div v-if="drawDraft" class="shape-draft" :style="draftStyle"></div>
      <div v-if="runtimeError" class="runtime-error" role="status">{{ runtimeError }}</div>
    </div>
    <!-- 底部视图切换 - 属于画布功能部分 -->
    <div class="viewport-controls" v-if="showControls">
      <button 
        @click="$emit('update-camera', 'OrthographicCamera')" 
        :class="{ active: cameraType === 'OrthographicCamera' }"
      >Orthographic</button>
      <button 
        @click="$emit('update-camera', 'PerspectiveCamera')" 
        :class="{ active: cameraType === 'PerspectiveCamera' }"
      >Perspective</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import * as THREE from "three";
import * as AUTO from "three-auto";
import { useEditorStore, type ShapeTool } from "../../store/EditorStore";
import { useProjectStore } from "../../store/ProjectStore";
import { createSceneRuntime, isVisibleInHierarchy, portableSeriesTypes } from "../../project/sceneRuntime";
import { updateDesignHandleSizes } from './designHandles';

const props = defineProps<{
  config: any;
  selectedId: string;
  showControls: boolean;
  cameraType: string;
  activeEffect: string;
  effectIntensity: number;
  effectsEnabled: boolean;
}>();

const emit = defineEmits(['update-camera', 'tick', 'object-context']);
const editorStore = useEditorStore();
const projectStore = useProjectStore();
const runtimeError = ref('');

let instance: any = null;
let runtime: ReturnType<typeof createSceneRuntime> | null = null;
let generation = 0;
let cameraSignature = '';
const primitiveObjects = new Set<THREE.Mesh>();
const SUPPORTED_SERIES_TYPES = new Set(["map", "earth", "bar", "pie"]);
let lastDebugSelectedKey = "__init__";
type DrawPoint = { world: THREE.Vector3; screen: { x: number; y: number } };
const drawDraft = ref<{ start: DrawPoint; end: DrawPoint } | null>(null);
const draftStyle = computed(() => {
  if (!drawDraft.value) return {};
  const { start, end } = drawDraft.value;
  return {
    left: `${Math.min(start.screen.x, end.screen.x)}px`,
    top: `${Math.min(start.screen.y, end.screen.y)}px`,
    width: `${Math.abs(start.screen.x - end.screen.x)}px`,
    height: `${Math.abs(start.screen.y - end.screen.y)}px`,
  };
});

// #region debug-point creator-selection-sync
const reportDebug = (event: string, payload: Record<string, any> = {}) => {
  console.debug("[design-pick-sync][creator:EditorCanvas]", event, payload);
};
// #endregion

const findSceneObjectForSelection = (targetId: string) => {
  if (!instance || !targetId || targetId === "scene") {
    return null;
  }

  const selectedSeries = props.config?.series?.find((item: any) => String(item.id) === targetId);
  if (!selectedSeries) {
    return null;
  }

  let matchedObject: any = null;
  instance.scene.traverse((object: any) => {
    if (matchedObject) {
      return;
    }

    if (String(object?.userData?.id) === targetId || String(object?.userData?.seriesId) === targetId) {
      matchedObject = object;
    }
  });

  return matchedObject || (selectedSeries.name ? instance.scene.getObjectByName(selectedSeries.name) : null);
};

const tagSeriesObjects = (seriesList: any[]) => {
  seriesList.filter(item => item.type !== 'group').forEach(item => {
    const object = findSceneObjectForSelection(String(item.id));
    if (object) {
      object.userData.seriesId = item.id;
      object.userData.designRoot = item.parentId == null;
    }
  });
};

const syncDesignSelectionFromSidebar = () => {
  if (!instance?.design) {
    return;
  }

  if (props.selectedId === "scene") {
    reportDebug("sidebar-sync", { selectedId: props.selectedId, action: "select-null" });
    instance.design.select(null);
    editorStore.syncSelectedSceneObject(null);
    return;
  }

  const matchedObject = findSceneObjectForSelection(props.selectedId);
  reportDebug("sidebar-sync", {
    selectedId: props.selectedId,
    matchedName: matchedObject?.name ?? null,
    matchedType: matchedObject?.type ?? null,
    matchedSeriesId: matchedObject?.userData?.seriesId ?? null,
  });
  if (matchedObject) {
    instance.design.select(matchedObject);
    editorStore.syncSelectedSceneObject(matchedObject);
  }
};

const shapeTypes = new Set<ShapeTool>(['rectangle', 'ellipse', 'triangle', 'polygon', 'star']);
const createShapeGeometry = (type: ShapeTool, width: number, height: number) => {
  if (type === 'rectangle') return new THREE.PlaneGeometry(width, height);
  if (type === 'ellipse') {
    const geometry = new THREE.CircleGeometry(0.5, 64);
    geometry.scale(width, height, 1);
    return geometry;
  }
  const shape = new THREE.Shape();
  const vertexCount = type === 'triangle' ? 3 : type === 'polygon' ? 5 : 10;
  for (let index = 0; index < vertexCount; index++) {
    const angle = Math.PI / 2 + index * Math.PI * 2 / vertexCount;
    const radius = type === 'star' && index % 2 ? 0.23 : 0.5;
    const x = Math.cos(angle) * radius * width;
    const y = Math.sin(angle) * radius * height;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
};

const applySeriesTransform = (object: THREE.Object3D, item: any) => {
  object.position.set(item.position?.x ?? 0, item.position?.y ?? 0, item.position?.z ?? 0);
  object.scale.set(item.scale?.x ?? 1, item.scale?.y ?? 1, item.scale?.z ?? 1);
  object.rotation.set(item.rotation?.x ?? 0, item.rotation?.y ?? 0, item.rotation?.z ?? 0);
  object.visible = item.show !== false;
};

const addPrimitiveObjects = (seriesList: any[] = []) => {
  if (!instance) {
    return;
  }

  seriesList.forEach((item: any) => {
    if (shapeTypes.has(item?.type)) {
      const shape = new THREE.Mesh(
        createShapeGeometry(item.type as ShapeTool, item.size?.x ?? 2, item.size?.y ?? 2),
        new THREE.MeshBasicMaterial({ color: item.color ?? '#638cf4', opacity: item.opacity ?? 1, transparent: true, side: THREE.DoubleSide }),
      );
      shape.name = item.name || item.type;
      shape.userData.id = item.id;
      shape.userData.seriesId = item.id;
      applySeriesTransform(shape, item);
      primitiveObjects.add(shape);
      instance.scene.add(shape);
      return;
    }

    if (item?.type === "sphere") {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(item.radius ?? 1.4, 48, 48),
        new THREE.MeshBasicMaterial({ color: item.color ?? "#7c5cff" }),
      );
      sphere.name = item.name || "Sphere";
      sphere.userData.id = item.id;
      sphere.userData.seriesId = item.id;
      applySeriesTransform(sphere, item);
      primitiveObjects.add(sphere);
      instance.scene.add(sphere);
      return;
    }

    if (item?.type === "cube") {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(item.size?.x ?? 2, item.size?.y ?? 2, item.size?.z ?? 2),
        new THREE.MeshBasicMaterial({ color: item.color ?? "#4f8cff" }),
      );
      cube.name = item.name || "Cube";
      cube.userData.id = item.id;
      cube.userData.seriesId = item.id;
      applySeriesTransform(cube, item);
      primitiveObjects.add(cube);
      instance.scene.add(cube);
      return;
    }

    if (item?.type === "cylinder") {
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(item.radiusTop ?? 1, item.radiusBottom ?? 1, item.height ?? 2, 48),
        new THREE.MeshBasicMaterial({ color: item.color ?? "#ff9955" }),
      );
      cylinder.name = item.name || "Cylinder";
      cylinder.userData.id = item.id;
      cylinder.userData.seriesId = item.id;
      applySeriesTransform(cylinder, item);
      primitiveObjects.add(cylinder);
      instance.scene.add(cylinder);
    }
  });
};

const buildGroups = (seriesList: any[]) => {
  if (!instance) return;
  const groups = seriesList.filter(item => item.type === 'group');
  groups.forEach(item => {
    const group = new THREE.Group();
    group.name = item.name || 'Group';
    group.userData.id = item.id;
    group.userData.seriesId = item.id;
    group.userData.designRoot = true;
    group.visible = item.show !== false;
    applySeriesTransform(group, item);
    instance.scene.add(group);
  });
  seriesList.filter(item => item.parentId != null).forEach(item => {
    const parent = findSceneObjectForSelection(String(item.parentId));
    const child = findSceneObjectForSelection(String(item.id));
    if (parent && child && parent !== child && parent.isGroup) {
      let ancestor = parent;
      while (ancestor && ancestor !== child) ancestor = ancestor.parent;
      if (ancestor === child) return;
      parent.add(child);
      child.userData.designRoot = false;
    }
  });
};

const findEditorObject = (object: THREE.Object3D | null): THREE.Object3D | null => {
  let current = object;
  while (current && current !== instance?.scene) {
    const seriesId = current.userData?.seriesId;
    if (seriesId != null && props.config.series.some((item: any) => String(item.id) === String(seriesId))) {
      return current;
    }
    current = current.parent;
  }
  return null;
};

const excludeSceneHelpersFromPicking = () => {
  instance.scene.traverse((object: THREE.Object3D) => {
    if (object instanceof THREE.Mesh && !findEditorObject(object)) {
      object.userData.designSelectable = false;
    }
  });
};

const pickEditorObject = (event: MouseEvent): THREE.Object3D | null => {
  if (!instance?._camera) return null;
  const canvas = instance._canvas as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, instance._camera);
  const hits = raycaster.intersectObjects(instance.scene.children, true);
  for (const hit of hits) {
    if (!isVisibleInHierarchy(hit.object)) continue;
    const selected = findEditorObject(hit.object);
    if (selected) {
      let root = selected;
      while (root.parent && root.parent !== instance.scene && root.userData.designRoot !== true) root = root.parent;
      return findEditorObject(root);
    }
  }
  return null;
};

const drawPointFromEvent = (event: PointerEvent): DrawPoint | null => {
  if (!instance?._camera) return null;
  const canvas = event.currentTarget as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();
  const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(
    (screen.x / rect.width) * 2 - 1,
    -(screen.y / rect.height) * 2 + 1,
  ), instance._camera);
  const world = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), world)) return null;
  return { screen, world };
};

const onShapePointerDown = (event: PointerEvent) => {
  if (editorStore.activeTool === 'select' || editorStore.isPreview || event.button !== 0) return;
  const start = drawPointFromEvent(event);
  if (!start) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
  drawDraft.value = { start, end: start };
};

const onShapeMouseDown = (event: MouseEvent) => {
  if (editorStore.activeTool === 'select' || editorStore.isPreview || event.button !== 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
};

const onShapePointerMove = (event: PointerEvent) => {
  if (!drawDraft.value) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const end = drawPointFromEvent(event);
  if (end) drawDraft.value = { ...drawDraft.value, end };
};

const onShapePointerUp = (event: PointerEvent) => {
  if (!drawDraft.value) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (editorStore.activeTool === 'select' || editorStore.isPreview) {
    drawDraft.value = null;
    return;
  }
  const end = drawPointFromEvent(event) ?? drawDraft.value.end;
  const start = drawDraft.value.start;
  const isDrag = Math.hypot(end.screen.x - start.screen.x, end.screen.y - start.screen.y) >= 5;
  const rounded = (value: number) => Number(value.toFixed(2));
  const position = isDrag
    ? { x: rounded((start.world.x + end.world.x) / 2), y: rounded((start.world.y + end.world.y) / 2), z: 0 }
    : { x: rounded(start.world.x), y: rounded(start.world.y), z: 0 };
  const size = isDrag
    ? { x: rounded(Math.max(0.1, Math.abs(end.world.x - start.world.x))), y: rounded(Math.max(0.1, Math.abs(end.world.y - start.world.y))) }
    : { x: 2, y: 2 };
  drawDraft.value = null;
  editorStore.addShape(editorStore.activeTool as ShapeTool, position, size);
};

const cancelShapeDrawing = () => { drawDraft.value = null; };

const onCanvasClick = (event: MouseEvent) => {
  if (!instance?.design || editorStore.isPreview || editorStore.activeTool !== 'select') return;
  const current = findEditorObject(instance.design.selectedObject);
  const selected = current || pickEditorObject(event);
  instance.design.select(selected);
  editorStore.syncSelectedSceneObject(selected);
};

const onCanvasContextMenu = (event: MouseEvent) => {
  if (!instance?.design || editorStore.isPreview) return;
  const selected = pickEditorObject(event);
  if (selected) {
    instance.design.select(selected);
    editorStore.syncSelectedSceneObject(selected);
    emit('object-context', event, selected.userData.seriesId);
  }
};

const getCameraTarget = () => {
  const target = new THREE.Vector3();
  if (instance?.design?.controls?.getTarget) instance.design.controls.getTarget(target);
  else if (instance?.camera?.controls?.target) target.copy(instance.camera.controls.target);
  else target.set(props.config.camera?.target?.x ?? 0, props.config.camera?.target?.y ?? 0, props.config.camera?.target?.z ?? 0);
  return target;
};

const captureCamera = () => {
  if (!instance?._camera) return null;
  const target = getCameraTarget();
  const position = instance._camera.position;
  return {
    type: instance._camera.type,
    position: { x: position.x, y: position.y, z: position.z },
    target: { x: target.x, y: target.y, z: target.z },
    ...(instance._camera.isOrthographicCamera ? { zoom: instance._camera.zoom } : {}),
  };
};

const setCameraView = (position: THREE.Vector3, target: THREE.Vector3) => {
  if (!instance?._camera) return;
  instance._camera.position.copy(position);
  instance._camera.lookAt(target);
  const orbit = instance.camera?.controls;
  if (orbit?.target) { orbit.target.copy(target); orbit.update(); }
  const designControls = instance.design?.controls;
  designControls?.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z, false);
  instance._camera.updateProjectionMatrix();
};

const focusObject = (id: string) => {
  const object = findSceneObjectForSelection(String(id));
  if (!object || !instance?._camera) return;
  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return;
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const target = sphere.center;
  const direction = instance._camera.position.clone().sub(getCameraTarget()).normalize();
  if (direction.lengthSq() < 0.01) direction.set(1, 0.8, -1).normalize();
  const distance = Math.max(sphere.radius * 2.8, 5);
  if (instance.design?.controls) instance.design.controls.maxDistance = Math.max(instance.design.controls.maxDistance, distance * 2);
  if (instance._camera.isOrthographicCamera) {
    const height = instance._camera.top - instance._camera.bottom;
    instance._camera.zoom = height / Math.max(sphere.radius * 2.6, 1);
  }
  setCameraView(target.clone().addScaledVector(direction, distance), target);
};

const disposeThree = () => {
  generation++;
  runtime?.dispose(); runtime = null;
  primitiveObjects.forEach(mesh => {
    mesh.removeFromParent(); mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose());
  });
  primitiveObjects.clear();
  instance?.dispose?.(); instance = null;
};

const syncObjectTransforms = () => {
  if (!instance) return;
  runtime?.sync(props.config.series ?? []);
  (props.config.series ?? []).forEach((item: any) => {
    const object = findSceneObjectForSelection(String(item.id));
    if (!object) return;
    applySeriesTransform(object, item);
    object.name = item.name || item.type;
    object.updateMatrix();
  });
};

const initThree = () => {
  const nextCameraSignature = JSON.stringify({ ...(props.config.camera ?? {}), type: undefined });
  const savedView = cameraSignature === nextCameraSignature ? captureCamera() : null;
  disposeThree();
  const currentGeneration = generation;
  runtimeError.value = '';
  cameraSignature = nextCameraSignature;
  const finalConfig = JSON.parse(JSON.stringify(props.config));
  const originalSeries = Array.isArray(finalConfig.series) ? finalConfig.series : [];
  const incomingControls = finalConfig.camera?.controls || {};
  const hasPortableModels = originalSeries.some((item: any) => portableSeriesTypes.has(item.type));

  finalConfig.camera = finalConfig.camera || {};
  finalConfig.camera.controls = {
    ...incomingControls,
    enable: incomingControls.enable ?? incomingControls.show ?? true,
    enableDamping: incomingControls.enableDamping ?? true,
    enablePan: incomingControls.enablePan ?? true,
    design: {
      ...(typeof incomingControls.design === 'object' ? incomingControls.design : {}),
      enable: true,
      minDistance: incomingControls.minDistance ?? (hasPortableModels ? 1 : 2.5),
      maxDistance: incomingControls.maxDistance ?? (hasPortableModels ? Math.max(finalConfig.camera.far ?? 2000, 900) : 22),
    },
  };
  finalConfig.design = true;
  finalConfig.series = originalSeries.filter((item: any) => SUPPORTED_SERIES_TYPES.has(item?.type));
  if (props.effectsEnabled) finalConfig.postprocess = { type: props.activeEffect, intensity: props.effectIntensity };
  if (props.config.size?.type === 'fullhd') finalConfig.size = { type: 'fixed', width: 1920, height: 1080 };
  else if (props.config.size?.type === 'iphone') finalConfig.size = { type: 'fixed', width: 375, height: 812 };

  try {
    instance = new AUTO.ThreeAuto(undefined, finalConfig);
    const engine = instance;
    if (finalConfig.fog?.show) engine.scene.fog = new THREE.Fog(finalConfig.fog.color ?? '#ffffff', finalConfig.fog.near ?? 1, finalConfig.fog.far ?? 1500);
    runtime = createSceneRuntime({
      scene: engine.scene, camera: engine._camera, renderer: engine._renderer,
      config: { ...finalConfig, series: originalSeries },
      resolveAsset: projectStore.resolveAsset,
      onError: error => {
        if (generation !== currentGeneration) return;
        console.error(error); runtimeError.value = error.message;
      },
    });
    addPrimitiveObjects(originalSeries);
    tagSeriesObjects(originalSeries);
    buildGroups(originalSeries);
    excludeSceneHelpersFromPicking();
    // three-auto bundles Three internally; use stable flags instead of cross-bundle instanceof.
    if (engine.design) {
      // The engine caps helper sizes in world units, making them subpixel in campus scenes.
      // Resize after its native update, before rendering, so hit targets match the visible handles.
      const updateDesign = engine.design.update.bind(engine.design);
      engine.design.update = () => {
        updateDesign();
        updateDesignHandleSizes(engine.design, engine._camera, engine._canvas.clientHeight);
      };
      for (const property of ['minPolarAngle', 'maxPolarAngle', 'minAzimuthAngle', 'maxAzimuthAngle']) {
        if (typeof incomingControls[property] === 'number') engine.design.controls[property] = incomingControls[property];
      }
      engine.design.getSelectableMeshes = () => {
        const meshes: THREE.Object3D[] = [];
        engine.scene.traverse((object: any) => {
          if (object.isMesh && isVisibleInHierarchy(object) && object.userData.designSelectable !== false && findEditorObject(object)) meshes.push(object);
        });
        return meshes;
      };
    }
    const cameraPosition = savedView?.position ?? finalConfig.camera.position ?? { x: 0, y: 0, z: 20 };
    const target = savedView?.target ?? finalConfig.camera.target ?? { x: 0, y: 0, z: 0 };
    setCameraView(new THREE.Vector3(cameraPosition.x, cameraPosition.y, cameraPosition.z), new THREE.Vector3(target.x, target.y, target.z));
    if (engine._camera.isOrthographicCamera) {
      const distance = engine._camera.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z));
      const viewHeight = 2 * Math.max(distance, 1) * Math.tan(THREE.MathUtils.degToRad(finalConfig.camera.fov ?? 75) / 2);
      engine._camera.zoom = savedView?.zoom ?? finalConfig.camera.zoom ?? ((engine._camera.top - engine._camera.bottom) / viewHeight);
      engine._camera.updateProjectionMatrix();
    }
    syncDesignSelectionFromSidebar();
    runtime.ready.then(() => {
      if (generation !== currentGeneration || instance !== engine) return;
      tagSeriesObjects(originalSeries);
      excludeSceneHelpersFromPicking();
      syncDesignSelectionFromSidebar();
    });
    engine.time.on("tick", (data: any) => {
      if (instance !== engine || generation !== currentGeneration) return;
      runtime?.update();
      let selectedObject = engine.design?.selectedObject ?? null;
      const editableObject = selectedObject ? findEditorObject(selectedObject) : null;
      if (selectedObject && !editableObject) {
        engine.design.select(null);
        editorStore.syncSelectedSceneObject(null);
        selectedObject = null;
      } else if (editableObject && editableObject !== selectedObject) {
        engine.design.select(editableObject);
        selectedObject = editableObject;
      }
      const currentKey = selectedObject ? `${selectedObject.uuid}:${selectedObject.userData?.seriesId ?? "none"}` : "scene";
      if (currentKey !== lastDebugSelectedKey) {
        lastDebugSelectedKey = currentKey;
        reportDebug("tick-selection", { selectedId: props.selectedId, selectedName: selectedObject?.name ?? null, selectedSeriesId: selectedObject?.userData?.seriesId ?? null });
      }
      const selectedSeriesId = selectedObject?.userData?.seriesId;
      if (selectedObject && String(selectedSeriesId) === editorStore.selectedId) editorStore.syncSelectedSceneObject(selectedObject);
      else if (!selectedObject && editorStore.selectedId === 'scene') editorStore.syncSelectedSceneObject(null);
      emit('tick', data);
    });
  } catch (error) {
    console.error("ThreeAuto initialization failed:", error);
    runtimeError.value = error instanceof Error ? error.message : String(error);
  }
};

defineExpose({ resize: () => instance?.resize?.(), focusObject, captureCamera });

let updateTimer: ReturnType<typeof setTimeout> | null = null;
const structuralConfig = () => {
  const { series = [], ...sceneConfig } = props.config;
  return JSON.stringify({
    ...sceneConfig,
    series: series.map((item: any) => {
      const { position: _position, rotation: _rotation, scale: _scale, name: _name, show: _show, ...structure } = item;
      return structure;
    }),
    effectsEnabled: props.effectsEnabled, activeEffect: props.activeEffect, effectIntensity: props.effectIntensity,
    projectId: projectStore.projectId, filesRevision: projectStore.filesRevision,
  });
};
watch(structuralConfig, () => {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => { updateTimer = null; initThree(); }, 120);
});
watch(() => (props.config.series ?? []).map((item: any) => ({ id: item.id, position: item.position, rotation: item.rotation, scale: item.scale, name: item.name, show: item.show })), syncObjectTransforms, { deep: true });

watch(() => props.selectedId, () => {
  syncDesignSelectionFromSidebar();
});

onMounted(() => {
  initThree();
});

onUnmounted(() => {
  drawDraft.value = null;
  if (updateTimer) clearTimeout(updateTimer);
  editorStore.syncSelectedSceneObject(null);
  disposeThree();
});
</script>

<style scoped>
.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.canvas-wrapper {
  width: 100%;
  height: 100%;
}

#_scene {
  width: 100%;
  height: 100%;
  display: block;
}
#_scene.shape-drawing { cursor: crosshair; touch-action: none; }
.shape-draft { position: absolute; pointer-events: none; border: 1px solid #4777e9; background: #638cf44d; box-shadow: 0 0 0 1px #fff8 inset; z-index: 2; }

.runtime-error { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 3; padding: 10px 14px; border-radius: 8px; background: #fff4e9ed; color: #7b381b; font-size: 12px; pointer-events: none; }

.viewport-controls {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  padding: 4px;
  border-radius: 99px;
  display: flex;
  gap: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.viewport-controls button {
  border: none;
  background: transparent;
  padding: 8px 20px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.viewport-controls button.active {
  background: #6366f1;
  color: #fff;
}
</style>
