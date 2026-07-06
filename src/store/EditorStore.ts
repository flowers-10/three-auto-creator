import { defineStore } from 'pinia';
import { reactive, ref, watch } from 'vue';
import ZheJiangCity from '@assets/json/ZheJiangCity.json';

const STORAGE_KEY = 'three-auto-editor-config';

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
      controls: {
        show: true,
        enableDamping: true,
        enablePan: true,
      },
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
    series: [
      {
        shadow: true,
        name: "轮廓地图",
        id: 0,
        type: "map",
        json: ZheJiangCity,
        show: true,
      },
    ],
  });

  const loadConfig = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        Object.assign(config, data.config);
        effectsEnabled.value = data.effectsEnabled ?? false;
        activeEffect.value = data.activeEffect ?? 'moebius';
        effectIntensity.value = data.effectIntensity ?? 1.0;
        ambientIntensity.value = data.ambientIntensity ?? 1.0;
        ambientEnabled.value = data.ambientEnabled ?? true;
        lightColor.value = data.lightColor ?? '#D3D3D3';
        lightAlpha.value = data.lightAlpha ?? 1.0;
        shadowType.value = data.shadowType ?? 'low-faster';
        Object.assign(expandedSections, data.expandedSections);
        
        config.series.forEach(s => {
          if (s.type === 'map' && !s.json) {
            s.json = ZheJiangCity;
          }
        });
      } catch (e) {
        console.error('Failed to load persisted data:', e);
      }
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
    loadConfig,
    saveConfig
  };
});
