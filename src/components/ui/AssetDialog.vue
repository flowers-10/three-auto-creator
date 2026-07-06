<template>
  <div class="asset-dialog-container" v-if="isOpen" @mousedown.stop>
    <div class="asset-dialog-content">
      <div class="modal-header">
        <h3>{{ isEdit ? 'Edit' : 'New' }} {{ typeLabel }} Asset</h3>
        <IconButton size="small" type="ghost" @click="$emit('close')" />
      </div>
      
      <div class="modal-body custom-scrollbar">
        <div class="form-group">
          <label>Name</label>
          <input type="text" v-model="form.name" placeholder="Untitled Asset" />
        </div>

        <!-- 图片/媒体上传预览区 -->
        <div v-if="type === 'image' || type === 'media'" class="upload-preview-area">
          <div class="preview-box">
            <img v-if="type === 'image' && form.value" :src="form.value" />
            <div v-else class="placeholder">
              <span>{{ form.value ? 'File Loaded' : 'No File' }}</span>
            </div>
          </div>
          <button class="replace-btn" @click="triggerFileInput">Replace {{ typeLabel }}</button>
          <input type="file" ref="fileInput" style="display: none" @change="handleFileChange" />
          <div class="file-info" v-if="fileInfo">{{ fileInfo }}</div>
        </div>

        <!-- 颜色选择区 -->
        <div v-if="type === 'color'" class="color-form-group">
          <label>Color Value</label>
          <div class="color-input-row">
            <input type="color" v-model="form.value" />
            <input type="text" v-model="form.value" placeholder="#000000" />
          </div>
        </div>

        <button class="ai-btn" v-if="type === 'image'">✨ Generate with AI</button>
      </div>

      <div class="modal-footer">
        <button class="cancel-btn" @click="$emit('close')">Cancel</button>
        <button class="save-btn" @click="handleSave">Save Asset</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import IconButton from './IconButton.vue';

const props = defineProps<{
  isOpen: boolean;
  type: 'material' | 'color' | 'image' | 'media' | 'audio';
  asset?: any;
}>();

const emit = defineEmits(['close', 'save']);

const isEdit = computed(() => !!props.asset);
const typeLabel = computed(() => props.type.charAt(0).toUpperCase() + props.type.slice(1));

const form = reactive({
  name: '',
  value: ''
});

const fileInput = ref<HTMLInputElement | null>(null);
const fileInfo = ref('');

// 核心：监听 asset 变化，实现实时切换更新内容
watch(() => props.asset, (newAsset) => {
  if (newAsset) {
    form.name = newAsset.name;
    form.value = newAsset.value;
  } else {
    form.name = '';
    form.value = props.type === 'color' ? '#6366f1' : '';
  }
  fileInfo.value = '';
}, { immediate: true });

// 监听 type 变化（当新增不同类型资源时）
watch(() => props.type, (newType) => {
  if (!props.asset) {
    form.name = '';
    form.value = newType === 'color' ? '#6366f1' : '';
  }
});

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    fileInfo.value = `${file.size} bytes`;
    const reader = new FileReader();
    reader.onload = (event) => {
      form.value = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};

const handleSave = () => {
  emit('save', { ...form, type: props.type });
  emit('close');
};
</script>

<style scoped>
.asset-dialog-container {
  position: fixed;
  right: 270px; /* 侧边栏 240px + 间距 */
  top: 80px;
  width: 260px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  z-index: 2500;
  border: 1px solid #f0f0f0;
  overflow: hidden;
}

.asset-dialog-content {
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}

.close-btn {
  background: none; border: none; font-size: 18px; color: #999; cursor: pointer;
}

.modal-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 10px;
  font-weight: 800;
  color: #999;
  text-transform: uppercase;
}

.form-group input {
  padding: 8px 12px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  font-size: 12px;
  background: #f5f5f5;
  outline: none;
  transition: all 0.2s;
}

.form-group input:focus {
  background: #fff;
  border-color: #007aff;
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.1);
}

.color-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.color-form-group label {
  font-size: 10px;
  font-weight: 800;
  color: #999;
  text-transform: uppercase;
}

.color-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-input-row input[type="color"] {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.color-input-row input[type="text"] {
  flex: 1;
  padding: 8px;
  border: 1px solid #eee;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.upload-preview-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 12px;
}

.preview-box {
  width: 100%;
  height: 100px;
  background: #eee;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.placeholder {
  font-size: 10px;
  color: #ccc;
}

.replace-btn {
  background: #333;
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.file-info {
  font-size: 9px;
  color: #999;
}

.ai-btn {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
  border: none;
  padding: 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.modal-footer {
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  border-top: 1px solid #f0f0f0;
}

.cancel-btn, .save-btn {
  flex: 1;
  padding: 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.cancel-btn {
  background: #f5f5f5;
  border: none;
  color: #666;
}

.save-btn {
  background: #007aff;
  border: none;
  color: #fff;
}
</style>
