<template>
  <div class="ui-segmented-control">
    <div 
      v-for="(option, index) in options" 
      :key="index"
      class="segment-item"
      :class="{ active: modelValue === option.value }"
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string | number | boolean;
  options: { label: string; value: string | number | boolean }[];
}>();
defineEmits(['update:modelValue']);
</script>

<style scoped>
.ui-segmented-control {
  display: flex;
  background: #f0f0f0;
  padding: 3px;
  border-radius: 10px;
  gap: 2px;
  width: 100%;
}

.segment-item {
  flex: 1;
  text-align: left; /* 修改为左对齐 */
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #888;
  cursor: pointer;
  border-radius: 7px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.segment-item:hover:not(.active) {
  color: #555;
  background: rgba(0,0,0,0.03);
}

.segment-item.active {
  background: #ffffff;
  color: #000;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
</style>
