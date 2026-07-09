<template>
  <div
    class="smart-input"
    :class="{ focused: isFocused, dragging: isDragging, disabled }"
    @mousedown="handleMouseDown"
  >
    <input
      ref="inputRef"
      :value="displayValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :inputmode="isNumber ? 'decimal' : undefined"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

type InputType = 'text' | 'number';

const props = withDefaults(defineProps<{
  modelValue: string | number;
  type?: InputType;
  step?: number;
  dragStep?: number;
  min?: number;
  max?: number;
  precision?: number;
  placeholder?: string;
  disabled?: boolean;
}>(), {
  type: 'text',
  step: 1,
  dragStep: 1,
  disabled: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'commit', value: string): void;
  (e: 'focus'): void;
  (e: 'blur'): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const displayValue = ref(String(props.modelValue ?? ''));
const isFocused = ref(false);
const isDragging = ref(false);

const isNumber = computed(() => props.type === 'number');

const getPrecision = () => {
  if (typeof props.precision === 'number') return props.precision;
  const stepText = String(props.step ?? 1);
  const dotIndex = stepText.indexOf('.');
  return dotIndex === -1 ? 0 : stepText.length - dotIndex - 1;
};

const clampValue = (value: number) => {
  let next = value;
  if (typeof props.min === 'number') next = Math.max(props.min, next);
  if (typeof props.max === 'number') next = Math.min(props.max, next);
  return next;
};

const formatNumber = (value: number) => {
  const precision = getPrecision();
  const fixed = value.toFixed(precision);
  return precision > 0 ? fixed.replace(/\.?0+$/, '') : fixed;
};

const parseNumber = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const value = Number(trimmed);
  if (Number.isNaN(value)) return null;
  return clampValue(value);
};

watch(
  () => props.modelValue,
  (value) => {
    if (!isFocused.value && !isDragging.value) {
      displayValue.value = String(value ?? '');
    }
  },
  { immediate: true }
);

const emitCurrentValue = () => {
  emit('update:modelValue', displayValue.value);
};

const commitCurrentValue = () => {
  if (!isNumber.value) {
    emit('update:modelValue', displayValue.value);
    emit('commit', displayValue.value);
    return;
  }

  const parsed = parseNumber(displayValue.value);
  if (parsed === null) {
    displayValue.value = String(props.modelValue ?? '');
    emit('update:modelValue', displayValue.value);
    emit('commit', displayValue.value);
    return;
  }

  const formatted = formatNumber(parsed);
  displayValue.value = formatted;
  emit('update:modelValue', formatted);
  emit('commit', formatted);
};

const applyDelta = (delta: number) => {
  const current =
    parseNumber(displayValue.value) ??
    parseNumber(String(props.modelValue ?? '')) ??
    0;

  const next = clampValue(current + delta);
  const formatted = formatNumber(next);
  displayValue.value = formatted;
  emit('update:modelValue', formatted);
  emit('commit', formatted);
};

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  displayValue.value = target.value;
  emitCurrentValue();
};

const handleFocus = () => {
  isFocused.value = true;
  emit('focus');
};

const handleBlur = () => {
  isFocused.value = false;
  if (!isDragging.value) {
    commitCurrentValue();
  }
  emit('blur');
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!isNumber.value || props.disabled) {
    if (event.key === 'Enter') {
      commitCurrentValue();
      inputRef.value?.blur();
    }
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    applyDelta(props.step);
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    applyDelta(-props.step);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    commitCurrentValue();
    inputRef.value?.blur();
  }
};

const handleMouseDown = (event: MouseEvent) => {
  if (!isNumber.value || props.disabled || event.button !== 0) return;

  const target = event.target as HTMLElement;
  if (target !== inputRef.value) return;

  const startX = event.clientX;
  const startValue =
    parseNumber(displayValue.value) ??
    parseNumber(String(props.modelValue ?? '')) ??
    0;

  let hasMoved = false;

  const onMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - startX;
    if (!hasMoved && Math.abs(deltaX) < 3) return;

    hasMoved = true;
    isDragging.value = true;
    inputRef.value?.blur();

    const delta = (deltaX / 8) * (props.dragStep ?? props.step);
    const next = clampValue(startValue + delta);
    const formatted = formatNumber(next);

    displayValue.value = formatted;
    emit('update:modelValue', formatted);
    emit('commit', formatted);
  };

  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    if (hasMoved) {
      isDragging.value = false;
      commitCurrentValue();
    }
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};
</script>

<style scoped>
.smart-input {
  width: 100%;
}

.smart-input input {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #f3f3f3;
  font-size: 12px;
  line-height: 1.2;
  color: #1f1f1f;
  outline: none;
  box-sizing: border-box;
  appearance: textfield;
  -moz-appearance: textfield;
  transition: all 0.2s ease;
  cursor: text;
}

.smart-input input::-webkit-outer-spin-button,
.smart-input input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.smart-input.focused input {
  background: #fff;
  border-color: #007aff;
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.1);
}

.smart-input.dragging input {
  cursor: ew-resize;
  user-select: none;
}

.smart-input.disabled input {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>