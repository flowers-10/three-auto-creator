<template>
  <header class="floating-toolbar">
    <div class="toolbar-content">
      <div class="dropdown">
        <button class="tool-btn">➕ 新增</button>
        <div class="dropdown-content">
          <a @click="addObject('cube')">📦 立方体</a>
          <a @click="addObject('sphere')">⚪ 球体</a>
          <a @click="addObject('light')">💡 灯光</a>
          <a @click="addObject('text')">T 文字</a>
          <a @click="addObject('tooltip')">💬 提示卡</a>
        </div>
      </div>
      <div class="divider"></div>
      <button class="tool-btn" @click="togglePreview">👁️ 预览</button>
      <div class="divider"></div>
      <button class="share-btn">Share</button>
      <button class="export-btn">Export</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useEditorStore } from '../../store/EditorStore';

const editorStore = useEditorStore();

const addObject = (type: string) => {
  const newId = Date.now();
  editorStore.config.series.push({
    id: newId,
    name: `New ${type}`,
    type: type as any,
    show: true,
  } as any);
  editorStore.selectedId = String(newId);
};

const togglePreview = () => {
  editorStore.isPreview = !editorStore.isPreview;
};
</script>

<style scoped>
.floating-toolbar {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: #ffffff;
  padding: 6px 12px;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #f0f0f0;
}

.toolbar-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-btn {
  border: none;
  background: transparent;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
  color: #333;
}

.tool-btn:hover {
  background: #f5f5f5;
}

.divider {
  width: 1px;
  height: 16px;
  background: #eee;
}

.dropdown-content {
  display: none;
  position: absolute;
  background-color: #fff;
  min-width: 120px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 6px;
  top: 100%;
  left: 0;
  margin-top: 8px;
  border: 1px solid #f0f0f0;
}

.dropdown-content a {
  color: #333;
  padding: 6px 10px;
  text-decoration: none;
  display: block;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
}

.dropdown-content a:hover {
  background-color: #f5f5f5;
  color: #007aff;
}

.share-btn, .export-btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #eee;
  background: #fff;
  color: #333;
}

.export-btn {
  background: #000;
  color: #fff;
  border: none;
}
</style>
