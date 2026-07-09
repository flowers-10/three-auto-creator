<template>
  <div class="canvas-container">
    <div class="canvas-wrapper">
      <canvas id="_scene"></canvas>
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
import { onMounted, onUnmounted, watch } from "vue";
import * as THREE from "three";
import * as AUTO from "three-auto";
import { useEditorStore } from "../../store/EditorStore";

const props = defineProps<{
  config: any;
  selectedId: string;
  showControls: boolean;
  cameraType: string;
  activeEffect: string;
  effectIntensity: number;
  effectsEnabled: boolean;
}>();

const emit = defineEmits(['update-camera', 'tick']);
const editorStore = useEditorStore();

let instance: any = null;
const SUPPORTED_SERIES_TYPES = new Set(["map", "earth", "bar", "pie"]);
let lastDebugSelectedKey = "__init__";

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

  if (selectedSeries.name) {
    const matchedByName = instance.scene.getObjectByName(selectedSeries.name);
    if (matchedByName) {
      return matchedByName;
    }
  }

  let matchedObject: any = null;
  instance.scene.traverse((object: any) => {
    if (matchedObject) {
      return;
    }

    if (object?.userData?.id === selectedSeries.id || object?.userData?.seriesId === selectedSeries.id) {
      matchedObject = object;
    }
  });

  return matchedObject;
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

const addPrimitiveObjects = (seriesList: any[] = []) => {
  if (!instance) {
    return;
  }

  seriesList.forEach((item: any) => {
    if (item?.show === false) {
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
      sphere.position.set(item.position?.x ?? 0, item.position?.y ?? 0, item.position?.z ?? 0);
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
      cube.position.set(item.position?.x ?? 0, item.position?.y ?? 0, item.position?.z ?? 0);
      instance.scene.add(cube);
    }
  });
};

const initThree = () => {
  if (instance) {
    editorStore.syncSelectedSceneObject(null);
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
    syncDesignSelectionFromSidebar();
    instance.time.on("tick", (data: any) => {
      const selectedObject = instance?.design?.selectedObject ?? null;
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
      editorStore.syncSelectedSceneObject(selectedObject);
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
