import { defineStore } from 'pinia';
import { reactive, watch } from 'vue';

export interface Asset {
  id: string;
  name: string;
  type: 'material' | 'color' | 'image' | 'media' | 'audio';
  value: any;
  metadata?: any;
}

const STORAGE_KEY = 'three-auto-assets';
const makeAssetId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useAssetStore = defineStore('assets', () => {
  const materials = reactive<Asset[]>([]);
  const colors = reactive<Asset[]>([]);
  const images = reactive<Asset[]>([]);
  const medias = reactive<Asset[]>([]);
  const audios = reactive<Asset[]>([]);

  const addAsset = (asset: Omit<Asset, 'id'>) => {
    // 去重逻辑：检查同类型下是否有同名资源
    const list = getListByType(asset.type);
    const existing = list.find(a => a.name === asset.name);
    if (existing) {
      existing.value = asset.value;
      existing.metadata = asset.metadata;
      return;
    }

    const newAsset = {
      ...asset,
      id: makeAssetId()
    };
    
    list.push(newAsset);
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    const type = updates.type || materials.find(a => a.id === id)?.type || colors.find(a => a.id === id)?.type || images.find(a => a.id === id)?.type || medias.find(a => a.id === id)?.type || audios.find(a => a.id === id)?.type;
    if (!type) return;
    
    const list = getListByType(type as Asset['type']);
    const index = list.findIndex(a => a.id === id);
    if (index !== -1) {
      Object.assign(list[index], updates);
    }
  };

  const removeAsset = (id: string, type: Asset['type']) => {
    const list = getListByType(type);
    const index = list.findIndex(a => a.id === id);
    if (index !== -1) list.splice(index, 1);
  };

  const getListByType = (type: Asset['type']) => {
    switch (type) {
      case 'material': return materials;
      case 'color': return colors;
      case 'image': return images;
      case 'media': return medias;
      case 'audio': return audios;
    }
  };

  const loadAssets = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const replaceList = (list: Asset[], savedList: Asset[] = []) => {
          const byId = new Map<string, Asset>();
          for (const asset of savedList) {
            const previous = byId.get(asset.id);
            if (previous && JSON.stringify(previous) === JSON.stringify(asset)) continue;
            const restored = previous ? { ...asset, id: makeAssetId() } : asset;
            byId.set(restored.id, restored);
          }
          list.splice(0, list.length, ...byId.values());
        };
        replaceList(materials, data.materials);
        replaceList(colors, data.colors);
        replaceList(images, data.images);
        replaceList(medias, data.medias);
        replaceList(audios, data.audios);
      } catch (e) {
        console.error('Failed to load assets:', e);
      }
    }
  };

  const saveAssets = () => {
    const data = { materials, colors, images, medias, audios };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  watch([materials, colors, images, medias, audios], () => {
    saveAssets();
  }, { deep: true });

  return {
    materials,
    colors,
    images,
    medias,
    audios,
    addAsset,
    updateAsset,
    removeAsset,
    loadAssets,
    saveAssets
  };
});
