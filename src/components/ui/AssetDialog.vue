<template>
  <Teleport to="body">
  <div class="asset-dialog-container" v-if="isOpen" role="dialog" :aria-label="`${isEdit ? 'Edit' : 'New'} ${typeLabel} Asset`" @mousedown.stop>
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

        <MaterialAssetEditor v-if="type === 'material'" v-model="materialValue" />

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
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import IconButton from './IconButton.vue';
import MaterialAssetEditor from './MaterialAssetEditor.vue';
import { normalizeMaterialAsset, type MaterialAssetValue } from '../../utils/materialAsset';

const props = defineProps<{
  isOpen: boolean;
  type: 'material' | 'color' | 'image' | 'media' | 'audio';
  asset?: any;
}>();

const emit = defineEmits(['close', 'save', 'change']);

const isEdit = computed(() => !!props.asset);
const typeLabel = computed(() => props.type.charAt(0).toUpperCase() + props.type.slice(1));

const form = reactive({
  name: '',
  value: ''
});
const materialValue = ref<MaterialAssetValue>(normalizeMaterialAsset(null));

const fileInput = ref<HTMLInputElement | null>(null);
const fileInfo = ref('');

// 每次打开或切换资源时，从已保存的数据重建草稿。
watch([() => props.isOpen, () => props.asset, () => props.type], () => {
  if (!props.isOpen) return;
  form.name = props.asset?.name ?? '';
  form.value = typeof props.asset?.value === 'string'
    ? props.asset.value
    : props.type === 'color' ? '#6366f1' : '';
  materialValue.value = normalizeMaterialAsset(props.asset?.value);
  fileInfo.value = '';
}, { immediate: true });

watch(form, () => {
  if (props.isOpen) emit('change', { ...form });
}, { flush: 'sync' });

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
  emit('save', {
    name: form.name.trim() || `Untitled ${typeLabel.value}`,
    value: props.type === 'material' ? { ...materialValue.value } : form.value,
    type: props.type,
  });
  emit('close');
};
</script>

<style scoped>
.asset-dialog-container {
  position: fixed;
  left: 268px; /* 左侧栏 16px + 240px + 12px 间距 */
  top: 80px;
  width: 320px;
  max-width: calc(100vw - 284px);
  max-height: calc(100vh - 96px);
  box-sizing: border-box;
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
  max-height: inherit;
}

.modal-header {
  padding: 12px 16px;
  display: flex;
  flex-shrink: 0;
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
  min-height: 0;
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
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
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
  min-width: 0;
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
  width: 100%;
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
  flex-shrink: 0;
  gap: 8px;
  border-top: 1px solid #f0f0f0;
}

.cancel-btn, .save-btn {
  flex: 1;
  min-width: 0;
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

@media (max-width: 620px) {
  .asset-dialog-container {
    left: 12px;
    top: 72px;
    width: calc(100vw - 24px);
    max-width: 320px;
    max-height: calc(100vh - 84px);
  }
}
</style>
