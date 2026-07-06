<template>
  <div class="color-input-wrapper" ref="wrapperRef">
    <div class="color-trigger">
      <div class="color-preview" :style="{ backgroundColor: modelValue, opacity: alpha }" @click="isOpen = !isOpen"></div>
      <input 
        type="text" 
        class="color-hex-input" 
        :value="modelValue.toUpperCase().replace('#', '')"
        @input="handleHexInput"
        @click.stop
      />
      <div class="color-opacity-input-wrapper" @click.stop>
        <input 
          type="text" 
          class="color-opacity-input" 
          :value="Math.round(alpha * 100)"
          @input="handleAlphaInput"
        />
        <span class="percent-symbol">%</span>
      </div>
    </div>
    
    <!-- 弹出的拾色面板 -->
    <ColorPickerPanel 
      :model-value="modelValue" 
      :alpha="alpha"
      :is-open="isOpen" 
      @update:model-value="$emit('update:modelValue', $event)" 
      @update:alpha="$emit('update:alpha', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import ColorPickerPanel from './ColorPickerPanel.vue';

const props = withDefaults(defineProps<{
  modelValue: string;
  alpha?: number;
}>(), {
  alpha: 1
});

const emit = defineEmits(['update:modelValue', 'update:alpha']);

const handleHexInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  if (/^[0-9A-F]{6}$/i.test(val)) {
    emit('update:modelValue', `#${val}`);
  }
};

const handleAlphaInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  const num = parseInt(val);
  if (!isNaN(num)) {
    const alpha = Math.max(0, Math.min(100, num)) / 100;
    emit('update:alpha', alpha);
  }
};

const isOpen = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);

const handleClickOutside = (e: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  window.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener('mousedown', handleClickOutside);
});
</script>

<style scoped>
.color-input-wrapper {
  position: relative;
  width: 100%;
}

.color-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  transition: background 0.2s;
}

.color-trigger:hover {
  background: #f5f5f5;
}

.color-preview {
  width: 14px;
  height: 14px;
  border-radius: 6px;
  border: 1px solid rgba(0,0,0,0.05);
  cursor: pointer;
}

.color-hex-input {
  flex: 1;
  font-size: 11px;
  font-weight: 700;
  color: #333;
  border: none;
  background: transparent;
  outline: none;
  padding: 0;
  border-radius: 4px;
  width: 60px;
  transition: background 0.2s;
}

.color-hex-input:hover, .color-hex-input:focus {
  background: rgba(0,0,0,0.03);
}

.color-opacity-input-wrapper {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  padding: 3px 6px;
  border-radius: 6px;
}

.color-opacity-input {
  font-size: 10px;
  color: #999;
  font-weight: 600;
  border: none;
  background: transparent;
  outline: none;
  padding: 0;
  width: 20px;
  text-align: right;
}

.percent-symbol {
  font-size: 10px;
  color: #999;
  font-weight: 600;
}
</style>
