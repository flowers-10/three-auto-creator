<template>
  <div class="ui-select" ref="selectRef">
    <div class="select-trigger" @click="isOpen = !isOpen">
      <span class="selected-label">{{ selectedOption?.label || placeholder }}</span>
      <span class="select-arrow">▼</span>
    </div>
    
    <div class="select-options-panel" v-if="isOpen">
      <div 
        v-for="option in options" 
        :key="option.value" 
        class="select-option"
        :class="{ active: modelValue === option.value }"
        @click="handleSelect(option.value)"
      >
        <span class="option-check" v-if="modelValue === option.value">✓</span>
        <span class="option-label">{{ option.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  modelValue: string | number;
  options: { label: string; value: string | number }[];
  placeholder?: string;
}>();

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const selectRef = ref<HTMLElement | null>(null);

const selectedOption = computed(() => 
  props.options.find(o => o.value === props.modelValue)
);

const handleSelect = (val: string | number) => {
  emit('update:modelValue', val);
  isOpen.value = false;
};

const handleClickOutside = (e: MouseEvent) => {
  if (selectRef.value && !selectRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => window.addEventListener('click', handleClickOutside));
onUnmounted(() => window.removeEventListener('click', handleClickOutside));
</script>

<style scoped>
.ui-select {
  position: relative;
  width: 100%;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #f5f5f5;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  text-align: left; /* 确保触发器文字左对齐 */
}

.select-arrow {
  font-size: 8px;
  color: #999;
  margin-left: 8px;
}

.select-options-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 6px;
  z-index: 100;
  border: 1px solid #f0f0f0;
}

.select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.select-option:hover {
  background: #f5f5f5;
}

.select-option.active {
  color: #007aff;
}

.option-check {
  font-size: 10px;
  width: 12px;
}

.option-label {
  flex: 1;
}
</style>
