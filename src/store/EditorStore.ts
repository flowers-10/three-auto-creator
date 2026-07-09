import { defineStore } from 'pinia';
import { reactive, ref, shallowRef, watch } from 'vue';

const STORAGE_KEY = 'three-auto-editor-config';

type TransformAxis = 'x' | 'y' | 'z';
type TransformSection = 'position' | 'scale' | 'rotation';
type RuntimeMaterialSummary = {
  id: string;
  name: string;
  color?: string;
};

const createTransformState = () => ({
  position: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 },
});

const createDefaultCameraControls = () => ({
  enable: false,
  enableDamping: true,
  enablePan: true,
  design: true,
});

const createDefaultSeries = () => ([
  {
    id: 1,
    name: '测试圆球',
    type: 'sphere',
    show: true,
    radius: 1.4,
    position: { x: 0, y: 0, z: 0 },
    color: '#7c5cff',
  },
]);

export const useEditorStore = defineStore('editor', () => {
  const isPreview = ref(false);
  const selectedId = ref('scene');
  const effectsEnabled = ref(false);
  const activeEffect = ref('moebius');
  const effectIntensity = ref(1.0);
  const ambientIntensity = ref(1.0);
  const ambientEnabled = ref(true);
  const lightColor = ref('#D3D3D3');
  const lightAlpha = ref(1.0);
  const shadowType = ref('low-faster');
  const selectedSceneObject = shallowRef<any | null>(null);
  const selectedSceneObjectName = ref('');
  const selectedSceneObjectType = ref('');
  const selectedSceneObjectVisible = ref(true);
  const selectedSceneObjectTransform = reactive(createTransformState());
  const selectedSceneObjectMaterials = ref<RuntimeMaterialSummary[]>([]);
  
  const expandedSections = reactive({
    light: true,
    effects: false,
    fog: false,
    shadow: false
  });

  const config = reactive({
    id: "_scene",
    name: "Hello three auto",
    shadow: {
      show: true,
      width: 1000,
      height: 1000,
      color: '#000',
      opacity: 0.1,
      rotation:  { x: 0, y: 0, z: 0 },
    },
    camera: {
      type: 'PerspectiveCamera',
      fov: 75,
      near: 0.1,
      far: 1000,
      position: { x: 0, y: 0, z: 20 },
      lookAt: true,
      controls: createDefaultCameraControls(),
    },
    size: {
      type: "parent",
      id: '_scene',
      width: 1920,
      height: 1080
    },
    renderer: {
      antialias: true,
      alpha: true,
      clearAlpha: 1,
      clearColor: '#ffffff',
    },
    fog: {
      show: false,
      color: '#ffffff',
      alpha: 1.0,
      near: 1,
      far: 1000
    },
    series: createDefaultSeries(),
  });

  const loadConfig = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        Object.assign(config, data.config);
        config.camera = {
          ...config.camera,
          controls: {
            ...createDefaultCameraControls(),
            ...(data.config?.camera?.controls || {}),
            enable: data.config?.camera?.controls?.enable
              ?? data.config?.camera?.controls?.show
              ?? false,
            design: true,
          },
        };
        effectsEnabled.value = data.effectsEnabled ?? false;
        activeEffect.value = data.activeEffect ?? 'moebius';
        effectIntensity.value = data.effectIntensity ?? 1.0;
        ambientIntensity.value = data.ambientIntensity ?? 1.0;
        ambientEnabled.value = data.ambientEnabled ?? true;
        lightColor.value = data.lightColor ?? '#D3D3D3';
        lightAlpha.value = data.lightAlpha ?? 1.0;
        shadowType.value = data.shadowType ?? 'low-faster';
        Object.assign(expandedSections, data.expandedSections);
        
        if (!Array.isArray(config.series) || !config.series.length || config.series.every(s => s.type === 'map')) {
          config.series = createDefaultSeries() as any;
        }
      } catch (e) {
        console.error('Failed to load persisted data:', e);
      }
    }

    config.camera.controls = {
      ...createDefaultCameraControls(),
      ...(config.camera.controls || {}),
      enable: config.camera.controls?.enable ?? (config.camera.controls as any)?.show ?? false,
      design: true,
    };

    if (!Array.isArray(config.series) || !config.series.length || config.series.every(s => s.type === 'map')) {
      config.series = createDefaultSeries() as any;
    }
  };

  const saveConfig = () => {
    const data = {
      config: JSON.parse(JSON.stringify(config)),
      effectsEnabled: effectsEnabled.value,
      activeEffect: activeEffect.value,
      effectIntensity: effectIntensity.value,
      ambientIntensity: ambientIntensity.value,
      ambientEnabled: ambientEnabled.value,
      lightColor: lightColor.value,
      lightAlpha: lightAlpha.value,
      shadowType: shadowType.value,
      expandedSections: JSON.parse(JSON.stringify(expandedSections))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const roundValue = (value: number) => Number(value.toFixed(2));

  const resetRuntimeSelection = () => {
    selectedId.value = 'scene';
    selectedSceneObject.value = null;
    selectedSceneObjectName.value = '';
    selectedSceneObjectType.value = '';
    selectedSceneObjectVisible.value = true;
    Object.assign(selectedSceneObjectTransform, createTransformState());
    selectedSceneObjectMaterials.value = [];
  };

  const readMaterials = (object: any | null): RuntimeMaterialSummary[] => {
    if (!object?.traverse) {
      return [];
    }

    const materialMap = new Map<string, RuntimeMaterialSummary>();

    object.traverse((child: any) => {
      const materialValue = child?.material;
      const materials = Array.isArray(materialValue) ? materialValue : [materialValue];

      materials.filter(Boolean).forEach((material: any, index: number) => {
        const id = material.uuid ?? `${child.uuid || child.name || 'material'}-${index}`;
        if (materialMap.has(id)) {
          return;
        }

        let color: string | undefined;
        if (material?.color?.isColor && typeof material.color.getHexString === 'function') {
          color = `#${material.color.getHexString()}`;
        }

        materialMap.set(id, {
          id,
          name: material.name || child.name || material.type || `Material ${materialMap.size + 1}`,
          color,
        });
      });
    });

    return Array.from(materialMap.values());
  };

  const syncSelectedSceneObject = (object: any | null) => {
    if (!object) {
      resetRuntimeSelection();
      return;
    }

    const seriesId = object?.userData?.seriesId ?? object?.userData?.id;
    const matchedSeries = config.series.find((item: any) => String(item.id) === String(seriesId));

    if (seriesId !== undefined && seriesId !== null) {
      selectedId.value = String(seriesId);
    }

    selectedSceneObject.value = object;
    selectedSceneObjectName.value = matchedSeries?.name || object.name || object.type || 'Unnamed Object';
    selectedSceneObjectType.value = object.type || 'Object3D';
    selectedSceneObjectVisible.value = object.visible !== false;
    selectedSceneObjectTransform.position.x = roundValue(object.position?.x ?? 0);
    selectedSceneObjectTransform.position.y = roundValue(object.position?.y ?? 0);
    selectedSceneObjectTransform.position.z = roundValue(object.position?.z ?? 0);
    selectedSceneObjectTransform.scale.x = roundValue(object.scale?.x ?? 1);
    selectedSceneObjectTransform.scale.y = roundValue(object.scale?.y ?? 1);
    selectedSceneObjectTransform.scale.z = roundValue(object.scale?.z ?? 1);
    selectedSceneObjectTransform.rotation.x = roundValue(object.rotation?.x ?? 0);
    selectedSceneObjectTransform.rotation.y = roundValue(object.rotation?.y ?? 0);
    selectedSceneObjectTransform.rotation.z = roundValue(object.rotation?.z ?? 0);
    selectedSceneObjectMaterials.value = readMaterials(object);
  };

  const renameSelectedSceneObject = (name: string) => {
    if (!selectedSceneObject.value) {
      return;
    }

    const seriesId = selectedSceneObject.value?.userData?.seriesId ?? selectedSceneObject.value?.userData?.id ?? selectedId.value;
    const matchedSeries = config.series.find((item: any) => String(item.id) === String(seriesId));

    selectedSceneObject.value.name = name;
    selectedSceneObjectName.value = name;

    if (matchedSeries) {
      matchedSeries.name = name;
    }
  };

  const setSelectedSceneObjectVisible = (visible: boolean) => {
    if (!selectedSceneObject.value) {
      return;
    }

    selectedSceneObject.value.visible = visible;
    selectedSceneObjectVisible.value = visible;
  };

  const updateSelectedSceneObjectTransform = (
    section: TransformSection,
    axis: TransformAxis,
    rawValue: number | string,
  ) => {
    if (!selectedSceneObject.value) {
      return;
    }

    const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (Number.isNaN(value)) {
      return;
    }

    const object = selectedSceneObject.value;

    if (section === 'rotation') {
      object.rotation[axis] = value;
    } else {
      object[section][axis] = value;
    }

    object.updateMatrix?.();
    object.updateMatrixWorld?.(true);
    syncSelectedSceneObject(object);
  };

  // 监听并保存
  watch([config, effectsEnabled, activeEffect, effectIntensity, ambientIntensity, ambientEnabled, lightColor, lightAlpha, shadowType, expandedSections], () => {
    saveConfig();
  }, { deep: true });

  return {
    isPreview,
    selectedId,
    effectsEnabled,
    activeEffect,
    effectIntensity,
    ambientIntensity,
    ambientEnabled,
    lightColor,
    lightAlpha,
    shadowType,
    expandedSections,
    config,
    selectedSceneObject,
    selectedSceneObjectName,
    selectedSceneObjectType,
    selectedSceneObjectVisible,
    selectedSceneObjectTransform,
    selectedSceneObjectMaterials,
    loadConfig,
    saveConfig,
    syncSelectedSceneObject,
    renameSelectedSceneObject,
    setSelectedSceneObjectVisible,
    updateSelectedSceneObjectTransform,
  };
});
