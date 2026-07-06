<template>
  <aside class="floating-sidebar-left">
    <div class="sidebar-tabs">
      <div class="tab" :class="{ active: activeTab === 'objects' }" @click="activeTab = 'objects'">Objects</div>
      <div class="tab" :class="{ active: activeTab === 'assets' }" @click="activeTab = 'assets'">Assets</div>
    </div>
    
    <div class="sidebar-content custom-scrollbar" v-if="activeTab === 'objects'">
      <div class="search-box">
        <input type="text" placeholder="Search..." />
      </div>
      <div class="object-tree">
        <div 
          class="tree-item scene-root" 
          :class="{ active: selectedId === 'scene' }"
          @click="$emit('select', 'scene')"
        >
          <span class="tree-icon">🏠</span>
          <span class="tree-label">Scene</span>
          <span class="add-icon">+</span>
        </div>
        <div class="tree-children">
          <div 
            v-for="item in sceneObjects" 
            :key="item.id" 
            class="tree-node"
          >
            <div 
              class="tree-item"
              :class="{ active: selectedId === String(item.id) }"
              @click="$emit('select', item.id)"
            >
              <span class="tree-line-guide"></span>
              <span class="node-toggle" v-if="item.children && item.children.length">▼</span>
              <span class="tree-icon">{{ getObjectIcon(item.type) }}</span>
              <span class="tree-label">{{ item.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Assets 选项卡内容 -->
    <div class="sidebar-content custom-scrollbar" v-else>
      <div class="local-assets-header">
        <span>Local Assets</span>
        <button class="manage-btn">Manage Libraries</button>
      </div>
      
      <div class="search-box">
        <input type="text" placeholder="Search..." />
      </div>

      <!-- 资源分类列表 -->
      <div class="asset-sections">
        <div v-for="type in assetTypes" :key="type.key" class="asset-section">
          <div class="section-title">
            <span>{{ type.label }} Assets</span>
            <span class="add-asset-btn" @click="handleAddAsset(type.key)">+</span>
          </div>
          <div class="asset-items">
            <div 
              v-for="asset in getAssetsByType(type.key)" 
              :key="asset.id" 
              class="asset-item"
              @click="handleEditAsset(asset)"
            >
              <span class="asset-icon">{{ getAssetIcon(type.key) }}</span>
              <span class="asset-name">{{ asset.name }}</span>
              <IconButton 
                class="delete-asset-btn" 
                type="danger" 
                size="small" 
                @click.stop="assetStore.removeAsset(asset.id, type.key)"
              />
            </div>
            <div v-if="!getAssetsByType(type.key).length" class="empty-assets">
              Click + to create your first asset.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 资源编辑弹窗 -->
    <AssetDialog 
      :is-open="isAssetDialogOpen" 
      :type="currentAssetType" 
      :asset="editingAsset"
      @close="isAssetDialogOpen = false" 
      @save="saveAsset"
    />
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAssetStore } from '../../store/useAssetStore';
import AssetDialog from '../ui/AssetDialog.vue';
import IconButton from '../ui/IconButton.vue';

const props = defineProps<{
  sceneObjects: any[];
  selectedId: string;
}>();

defineEmits(['select']);

const assetStore = useAssetStore();
const activeTab = ref('objects');
const isAssetDialogOpen = ref(false);
const currentAssetType = ref<'material' | 'color' | 'image' | 'media' | 'audio'>('image');
const editingAsset = ref<any>(null);

const assetTypes = [
  { key: 'material', label: 'Material' },
  { key: 'color', label: 'Color' },
  { key: 'image', label: 'Image' },
  { key: 'media', label: 'Media' },
  { key: 'audio', label: 'Audio' }
] as const;

const getAssetsByType = (type: typeof assetTypes[number]['key']) => {
  return assetStore[(`${type}s` as keyof typeof assetStore)] as any[];
};

const getAssetIcon = (type: string) => {
  switch (type) {
    case 'material': return '🎨';
    case 'color': return '🔴';
    case 'image': return '🖼️';
    case 'media': return '📹';
    case 'audio': return '🎵';
    default: return '📄';
  }
};

const handleAddAsset = (type: 'material' | 'color' | 'image' | 'media' | 'audio') => {
  currentAssetType.value = type;
  editingAsset.value = null;
  isAssetDialogOpen.value = true;
};

const handleEditAsset = (asset: any) => {
  currentAssetType.value = asset.type;
  editingAsset.value = asset;
  isAssetDialogOpen.value = true;
};

const saveAsset = (asset: any) => {
  if (editingAsset.value) {
    assetStore.updateAsset(editingAsset.value.id, asset);
  } else {
    assetStore.addAsset(asset);
  }
};

const getObjectIcon = (type: string) => {
  switch (type) {
    case 'map': return '🗺️';
    case 'light': return '💡';
    case 'cube': return '📦';
    case 'sphere': return '⚪';
    case 'text': return 'T';
    case 'tooltip': return '💬';
    default: return '🔹';
  }
};
</script>

<style scoped>
.floating-sidebar-left {
  position: fixed;
  left: 16px;
  top: 16px;
  bottom: 16px;
  width: 240px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  z-index: 999;
  overflow: hidden;
}

.sidebar-tabs {
  display: flex;
  padding: 4px;
  background: #f5f5f5;
  margin: 12px;
  border-radius: 8px;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.tab.active {
  background: #fff;
  color: #000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.sidebar-content {
  padding: 0 12px 12px 12px;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.search-box input {
  width: 100%;
  padding: 8px 12px;
  background: #f0f0f0;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  margin-bottom: 12px;
  box-sizing: border-box;
}

.tree-item {
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 6px;
  font-size: 12px;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  transition: all 0.2s;
  color: #333;
}

.tree-item:hover {
  background: #f5f5f5;
}

.tree-item.active {
  background: #007aff;
  color: #fff;
}

.scene-root {
  font-weight: 700;
  margin-top: 8px;
  margin-bottom: 4px;
}

.add-icon {
  margin-left: auto;
  font-size: 16px;
  color: #999;
}

.active .add-icon {
  color: #fff;
}

.tree-children {
  margin-left: 10px;
  padding-left: 0;
  border-left: 1px solid #eee;
  position: relative;
}

.tree-node {
  position: relative;
}

.tree-line-guide {
  position: absolute;
  left: -10px;
  top: 50%;
  width: 10px;
  height: 1px;
  background: #eee;
}

.tree-icon {
  font-size: 12px;
  flex-shrink: 0;
  opacity: 0.7;
}

.active .tree-icon {
  opacity: 1;
}

.tree-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.node-toggle {
  font-size: 8px;
  margin-right: 2px;
  color: #999;
}

.active .node-toggle {
  color: rgba(255, 255, 255, 0.8);
}

/* 新增 Assets 相关样式 */
.local-assets-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.local-assets-header span {
  font-size: 11px;
  font-weight: 700;
  color: #999;
  text-transform: uppercase;
}

.manage-btn {
  background: #f0f0f0;
  border: none;
  border-radius: 6px;
  padding: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  color: #333;
}

.asset-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.asset-section .section-title {
  font-size: 10px;
  font-weight: 800;
  color: #999;
  text-transform: uppercase;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.add-asset-btn {
  font-size: 16px;
  cursor: pointer;
  color: #ccc;
}

.add-asset-btn:hover {
  color: #007aff;
}

.asset-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.asset-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.asset-item:hover {
  background: #eee;
  transform: translateY(-1px);
}

.asset-item:hover .delete-asset-btn {
  opacity: 1;
  transform: scale(1);
}

.delete-asset-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  z-index: 10;
}

.empty-assets {
  font-size: 10px;
  color: #ccc;
  font-style: italic;
  padding: 4px 8px;
}
</style>
