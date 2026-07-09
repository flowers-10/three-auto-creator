<template>
  <div class="ui-slider">
    <input 
      type="range" 
      :min="min" 
      :max="max" 
      :step="step" 
      :value="modelValue"
      @input="handleInput"
      class="slider-input"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
}>();

const emit = defineEmits(['update:modelValue']);

const handleInput = (e: Event) => {
  const val = parseFloat((e.target as HTMLInputElement).value);
  emit('update:modelValue', val);
};
</script>

<style scoped>
.ui-slider {
  width: 100%;
  display: flex;
  align-items: center;
}

.slider-input {
  -webkit-appearance: none;
  width: 100%;
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
  outline: none;
  margin: 0;
  cursor: pointer;
}

/* Track styles */
.slider-input::-webkit-slider-runnable-track {
  width: 100%;
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
}

/* Thumb styles */
.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 16px;
  width: 32px;
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
  margin-top: 2px; /* Centers thumb on the track */
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.slider-input:active::-webkit-slider-thumb {
  transform: scale(0.95);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

/* Firefox support */
.slider-input::-moz-range-track {
  width: 100%;
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
}

.slider-input::-moz-range-thumb {
  height: 16px;
  width: 32px;
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}
</style>
