<template>
  <div 
    class="ui-switch" 
    :class="{ active: modelValue }" 
    @click="$emit('update:modelValue', !modelValue)"
  >
    <div class="switch-handle"></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean;
}>();
defineEmits(['update:modelValue']);
</script>

<style scoped>
.ui-switch {
  width: 32px;
  height: 18px;
  background: #e0e0e0;
  border-radius: 99px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.ui-switch.active {
  background: #007aff;
}

.switch-handle {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.ui-switch.active .switch-handle {
  transform: translateX(14px);
}
</style>
