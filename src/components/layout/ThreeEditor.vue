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
    />

    <!-- UI 悬浮面板 -->
    <template v-if="!isPreview">
      <TopToolbar />

      <LeftSidebar 
        :scene-objects="sceneObjects" 
        :selected-id="selectedId" 
        @select="selectObject" 
      />

      <RightSidebar />
    </template>

    <!-- 预览模式下的退出按钮 -->
    <button v-if="isPreview" class="exit-preview-btn" @click="togglePreview">
      退出预览
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useEditorStore } from "../../store/EditorStore";
import { useAssetStore } from "../../store/useAssetStore";

// 导入子组件
import TopToolbar from "./TopToolbar.vue";
import LeftSidebar from "./LeftSidebar.vue";
import RightSidebar from "./RightSidebar.vue";
import EditorCanvas from "../canvas/EditorCanvas.vue";

const editorStore = useEditorStore();
const assetStore = useAssetStore();

// 从 store 中提取状态
const { 
  config, 
  isPreview, 
  selectedId, 
  effectsEnabled, 
  activeEffect, 
  effectIntensity
} = storeToRefs(editorStore);

const canvasRef = ref<any>(null);

// 计算属性
const sceneObjects = computed(() => {
  return config.value.series.map(s => ({
    id: s.id,
    name: s.name,
    type: s.type
  }));
});

// 方法
const togglePreview = () => {
  editorStore.isPreview = !editorStore.isPreview;
  setTimeout(() => {
    canvasRef.value?.resize();
  }, 100);
};

const selectObject = (id: string | number) => {
  editorStore.selectedId = String(id);
};

onMounted(() => {
  editorStore.loadConfig();
  assetStore.loadAssets();
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
</style>
