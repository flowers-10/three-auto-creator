<template>
  <div class="three-editor" :class="{ 'preview-mode': isPreview }">
    <!-- 画布组件 - 独立于 UI 布局 -->
    <EditorCanvas 
      ref="canvasRef"
      :config="config" 
      :selected-id="selectedId"
      :show-controls="!isPreview"
      :camera-type="config.camera.type"
      :active-effect="activeEffect"
      :effect-intensity="effectIntensity"
      :effects-enabled="effectsEnabled"
      @update-camera="(type) => config.camera.type = type"
      @object-context="openObjectContext"
    />

    <!-- UI 悬浮面板 -->
    <template v-if="!isPreview">
      <TopToolbar />

      <LeftSidebar 
        :scene-objects="sceneObjects" 
        :selected-id="selectedId" 
        :selected-ids="selectedIds"
        @select="selectObject" 
        @object-context="openObjectContext"
      />

      <RightSidebar />
    </template>

    <div v-if="contextMenu.open && !isPreview" ref="menuRef" class="object-context-menu" role="menu" aria-label="Object actions"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }">
      <div class="context-summary">Selected Objects <span>{{ selectedIds.length }}</span></div>
      <button type="button" role="menuitem" class="pending" disabled>Center In Object <span>未实现</span></button>
      <button type="button" role="menuitem" class="pending" disabled>Reset Camera <span>未实现</span></button>
      <button type="button" role="menuitem" @click="runAction('group')">Group Selection <span>Ctrl+G</span></button>
      <button type="button" role="menuitem" class="pending" disabled>Reset Pivot <span>未实现</span></button>
      <button type="button" role="menuitem" :disabled="!hasSelectedGroup" @click="runAction('ungroup')">Ungroup Selection <span>Ctrl+Shift+G</span></button>
      <div class="context-divider"></div>
      <button type="button" role="menuitem" class="pending" disabled>Create Component <span>未实现</span></button>
      <button type="button" role="menuitem" class="pending" disabled>Copy Events <span>未实现</span></button>
      <button type="button" role="menuitem" class="pending" disabled>Paste Events <span>未实现</span></button>
      <button type="button" role="menuitem" class="pending" disabled>Copy Development Object ID <span>未实现</span></button>
      <div class="context-divider"></div>
      <button type="button" role="menuitem" class="pending" disabled>Copy <span>未实现</span></button>
      <button type="button" role="menuitem" class="pending" disabled>Cut <span>未实现</span></button>
      <button type="button" role="menuitem" @click="runAction('duplicate')">Duplicate <span>Ctrl+D</span></button>
      <button type="button" role="menuitem" class="pending" disabled>Paste <span>未实现</span></button>
      <button type="button" role="menuitem" class="pending" disabled>Paste Over Selection <span>未实现</span></button>
      <div class="context-divider"></div>
      <button type="button" role="menuitem" class="pending" disabled>Lock/Unlock Object <span>未实现</span></button>
      <button type="button" role="menuitem" @click="runAction('visibility')">{{ allSelectedVisible ? 'Hide Object' : 'Show Object' }}</button>
      <button type="button" role="menuitem" :disabled="selectedIds.length !== 1" @click="runAction('rename')">Rename</button>
      <button type="button" role="menuitem" class="pending" disabled>Reset Scale <span>未实现</span></button>
      <button type="button" role="menuitem" class="pending" disabled>Reset Position <span>未实现</span></button>
      <div class="context-divider"></div>
      <button type="button" role="menuitem" class="danger" @click="runAction('delete')">Delete <span>Del</span></button>
    </div>

    <InputDialog
      :open="renameDialogOpen"
      title="重命名对象"
      label="对象名称"
      :initial-value="renameInitialValue"
      placeholder="输入对象名称"
      @confirm="confirmRename"
      @cancel="renameDialogOpen = false"
    />

    <!-- 预览模式下的退出按钮 -->
    <button v-if="isPreview" class="exit-preview-btn" @click="togglePreview">
      退出预览
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useEditorStore } from "../../store/EditorStore";
import { useAssetStore } from "../../store/useAssetStore";

// 导入子组件
import TopToolbar from "./TopToolbar.vue";
import LeftSidebar from "./LeftSidebar.vue";
import RightSidebar from "./RightSidebar.vue";
import EditorCanvas from "../canvas/EditorCanvas.vue";
import InputDialog from "../ui/InputDialog.vue";

const editorStore = useEditorStore();
const assetStore = useAssetStore();

// 从 store 中提取状态
const { 
  config, 
  isPreview, 
  selectedId, 
  selectedIds,
  effectsEnabled, 
  activeEffect, 
  effectIntensity
} = storeToRefs(editorStore);

const canvasRef = ref<any>(null);
const menuRef = ref<HTMLElement | null>(null);
const contextMenu = ref({ open: false, x: 0, y: 0 });
const renameDialogOpen = ref(false);
const renameTargetId = ref<string | number | null>(null);
const renameInitialValue = ref('');
const selectedItems = computed(() => (config.value.series as any[]).filter(item => selectedIds.value.includes(String(item.id))));
const hasSelectedGroup = computed(() => selectedItems.value.some(item => item.type === 'group'));
const allSelectedVisible = computed(() => selectedItems.value.every(item => item.show !== false));

// 计算属性
const sceneObjects = computed(() => {
  const series = config.value.series as any[];
  const result: any[] = [];
  const visited = new Set<string>();
  const append = (item: any, ancestors: string[]) => {
    const id = String(item.id);
    if (visited.has(id)) return;
    visited.add(id);
    result.push({ id: item.id, name: item.name, type: item.type, depth: ancestors.length, ancestorIds: ancestors });
    series.filter(child => String(child.parentId) === id).forEach(child => append(child, [...ancestors, id]));
  };
  series.filter(item => item.parentId == null || !series.some(parent => String(parent.id) === String(item.parentId)))
    .forEach(item => append(item, []));
  series.forEach(item => append(item, []));
  return result;
});

// 方法
const togglePreview = () => {
  editorStore.isPreview = !editorStore.isPreview;
  setTimeout(() => {
    canvasRef.value?.resize();
  }, 100);
};

const selectObject = (id: string | number, additive = false) => {
  contextMenu.value.open = false;
  if (String(id) === 'scene') editorStore.selectObjects([]);
  else if (additive) {
    const ids = selectedIds.value.includes(String(id))
      ? selectedIds.value.filter(value => value !== String(id))
      : [...selectedIds.value, String(id)];
    editorStore.selectObjects(ids);
  } else editorStore.selectObjects([id]);
};

const openObjectContext = async (event: MouseEvent, id: string | number) => {
  if (isPreview.value) return;
  event.preventDefault();
  if (!selectedIds.value.includes(String(id))) editorStore.selectObjects([id]);
  contextMenu.value = { open: true, x: event.clientX, y: event.clientY };
  await nextTick();
  if (menuRef.value) {
    contextMenu.value.x = Math.max(8, Math.min(event.clientX, window.innerWidth - menuRef.value.offsetWidth - 8));
    contextMenu.value.y = Math.max(8, Math.min(event.clientY, window.innerHeight - menuRef.value.offsetHeight - 8));
  }
};

const runAction = (action: string) => {
  contextMenu.value.open = false;
  if (action === 'delete') editorStore.deleteSelectedObjects();
  if (action === 'group') editorStore.groupSelectedObjects();
  if (action === 'ungroup') editorStore.ungroupSelectedObjects();
  if (action === 'duplicate') editorStore.duplicateSelectedObjects();
  if (action === 'visibility') {
    const visible = !allSelectedVisible.value;
    selectedItems.value.forEach(item => { item.show = visible; });
  }
  if (action === 'rename' && selectedItems.value.length === 1) {
    const item = selectedItems.value[0];
    renameTargetId.value = item.id;
    renameInitialValue.value = item.name ?? '';
    renameDialogOpen.value = true;
  }
};

const confirmRename = (name: string) => {
  const item = (config.value.series as any[]).find(entry => String(entry.id) === String(renameTargetId.value));
  if (item) {
    item.name = name;
    if (String(editorStore.selectedSceneObject?.userData?.seriesId) === String(item.id)) editorStore.renameSelectedSceneObject(name);
  }
  renameDialogOpen.value = false;
};

const onKeyDown = (event: KeyboardEvent) => {
  if (isPreview.value || renameDialogOpen.value) return;
  const target = event.target as HTMLElement | null;
  if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;
  if (event.key === 'Escape') { contextMenu.value.open = false; return; }
  if (!selectedIds.value.length) return;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault(); runAction('delete');
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
    event.preventDefault(); runAction(event.shiftKey ? 'ungroup' : 'group');
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault(); runAction('duplicate');
  }
};
const onPointerDown = (event: PointerEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) contextMenu.value.open = false;
};

onMounted(() => {
  editorStore.loadConfig();
  assetStore.loadAssets();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('pointerdown', onPointerDown);
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('pointerdown', onPointerDown);
});
</script>

<style scoped>
.three-editor {
  position: relative;
  width: 100vw;
  height: 100vh;
  background-color: #000;
  overflow: hidden;
}

.exit-preview-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2000;
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: none;
  border-radius: 99px;
  cursor: pointer;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.object-context-menu {
  position: fixed;
  z-index: 3000;
  width: min(280px, calc(100vw - 16px));
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  padding: 6px;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 36px #0003;
  color: #303030;
  font-size: 12px;
}
.context-summary { display: flex; justify-content: space-between; padding: 10px 12px; color: #999; }
.object-context-menu button { display: flex; justify-content: space-between; width: 100%; padding: 9px 12px; border: 0; border-radius: 6px; background: transparent; color: inherit; text-align: left; cursor: pointer; font: inherit; }
.object-context-menu button span { color: #999; }
.object-context-menu button:hover:not(:disabled) { background: #f2f2f2; }
.object-context-menu button:disabled { opacity: .4; cursor: default; }
.object-context-menu button.pending:disabled { opacity: 1; color: #777; }
.object-context-menu button.pending span { color: #aaa; font-size: 11px; }
.object-context-menu button.danger { color: #d43d3d; }
.context-divider { height: 1px; margin: 5px 6px; background: #eee; }
</style>
