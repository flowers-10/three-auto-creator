<template>
  <button 
    class="ui-icon-button" 
    :class="[type, size]"
    @click="$emit('click', $event)"
  >
    <slot>
      <span class="default-icon">×</span>
    </slot>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  type?: 'danger' | 'primary' | 'ghost';
  size?: 'small' | 'medium' | 'large';
}>();

defineEmits(['click']);
</script>

<style scoped>
.ui-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
  outline: none;
  background: transparent;
}

/* Sizes */
.small {
  width: 16px;
  height: 16px;
  font-size: 10px;
}

.medium {
  width: 24px;
  height: 24px;
  font-size: 14px;
}

.large {
  width: 32px;
  height: 32px;
  font-size: 18px;
}

/* Types */
.danger {
  background: #ff4d4f;
  color: white;
}

.danger:hover {
  background: #ff7875;
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(255, 77, 79, 0.3);
}

.primary {
  background: #007aff;
  color: white;
}

.primary:hover {
  background: #40a9ff;
}

.ghost {
  background: transparent;
  color: #666;
}

.ghost:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
}

.default-icon {
  line-height: 1;
}
</style>
