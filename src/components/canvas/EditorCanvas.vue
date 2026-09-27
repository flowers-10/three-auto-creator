<template>
  <div class="canvas-container">
    <div class="canvas-wrapper">
      <canvas id="_scene" :class="{ 'shape-drawing': editorStore.activeTool !== 'select' && !editorStore.isPreview }"
        @pointerdown.capture="onShapePointerDown" @pointermove.capture="onShapePointerMove"
        @pointerup.capture="onShapePointerUp" @pointercancel.capture="cancelShapeDrawing"
        @mousedown.capture="onShapeMouseDown"
        @click="onCanvasClick" @contextmenu.prevent="onCanvasContextMenu"></canvas>
      <div v-if="drawDraft" class="shape-draft" :style="draftStyle"></div>
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

let instance: any = null;
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
      object.userData.designRoot = true;
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
    if (parent && child && parent !== child && parent instanceof THREE.Group) {
      parent.attach(child);
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
  const canvas = event.currentTarget as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, instance._camera);
  const hits = raycaster.intersectObjects(instance.scene.children, true);
  for (const hit of hits) {
    if (hit.object.userData.__designInternal) continue;
    const selected = findEditorObject(hit.object);
    if (selected) return selected;
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

const initThree = () => {
  if (instance) {
    instance.dispose?.();
  }

  const finalConfig = JSON.parse(JSON.stringify(props.config));
  const originalSeries = Array.isArray(finalConfig.series) ? finalConfig.series : [];
  const incomingControls = finalConfig.camera?.controls || {};

  finalConfig.camera = finalConfig.camera || {};
  finalConfig.camera.controls = {
    enable: incomingControls.enable ?? incomingControls.show ?? true,
    enableDamping: incomingControls.enableDamping ?? true,
    enablePan: incomingControls.enablePan ?? true,
    design: incomingControls.design ?? true,
  };
  finalConfig.design = true;
  finalConfig.series = originalSeries.filter((item: any) => SUPPORTED_SERIES_TYPES.has(item?.type));
  
  // 处理后处理效果
  if (props.effectsEnabled) {
    finalConfig.postprocess = { 
      type: props.activeEffect,
      intensity: props.effectIntensity
    };
  }

  // 处理尺寸预设
  if (props.config.size.type === 'fullhd') {
    finalConfig.size = { type: 'fixed', width: 1920, height: 1080 };
  } else if (props.config.size.type === 'iphone') {
    finalConfig.size = { type: 'fixed', width: 375, height: 812 };
  }

  try {
    instance = new AUTO.ThreeAuto(undefined, finalConfig);
    addPrimitiveObjects(originalSeries);
    tagSeriesObjects(originalSeries);
    buildGroups(originalSeries);
    excludeSceneHelpersFromPicking();
    syncDesignSelectionFromSidebar();
    instance.time.on("tick", (data: any) => {
      let selectedObject = instance?.design?.selectedObject ?? null;
      const editableObject = selectedObject ? findEditorObject(selectedObject) : null;
      if (selectedObject && !editableObject) {
        instance.design.select(null);
        editorStore.syncSelectedSceneObject(null);
        selectedObject = null;
      } else if (editableObject && editableObject !== selectedObject) {
        instance.design.select(editableObject);
        selectedObject = editableObject;
      }
      const currentKey = selectedObject ? `${selectedObject.uuid}:${selectedObject.userData?.seriesId ?? "none"}` : "scene";
      if (currentKey !== lastDebugSelectedKey) {
        lastDebugSelectedKey = currentKey;
        reportDebug("tick-selection", {
          selectedId: props.selectedId,
          selectedName: selectedObject?.name ?? null,
          selectedType: selectedObject?.type ?? null,
          selectedSeriesId: selectedObject?.userData?.seriesId ?? null,
        });
      }
      const selectedSeriesId = selectedObject?.userData?.seriesId;
      if (selectedObject && String(selectedSeriesId) === editorStore.selectedId) {
        editorStore.syncSelectedSceneObject(selectedObject);
      } else if (!selectedObject && editorStore.selectedId === 'scene') {
        editorStore.syncSelectedSceneObject(null);
      }
      emit('tick', data);
    });
  } catch (e) {
    console.error("ThreeAuto initialization failed:", e);
  }
};

// 暴露 resize 方法给外部
defineExpose({
  resize: () => instance?.resize?.()
});

let updateTimer: any = null;
watch(() => [props.config, props.effectsEnabled, props.activeEffect, props.effectIntensity], () => {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    initThree();
  }, 300);
}, { deep: true });

watch(() => props.selectedId, () => {
  syncDesignSelectionFromSidebar();
});

onMounted(() => {
  initThree();
});

onUnmounted(() => {
  drawDraft.value = null;
  if (instance) {
    editorStore.syncSelectedSceneObject(null);
    instance.dispose?.();
  }
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
