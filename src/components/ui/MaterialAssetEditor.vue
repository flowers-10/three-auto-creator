<template>
  <div class="material-editor">
    <div class="material-preview" aria-label="Material preview">
      <div class="preview-sphere" :style="previewStyle"></div>
    </div>

    <div class="material-title">
      <strong>Material</strong>
      <span>{{ Math.round(value.opacity * 100) }}%</span>
    </div>

    <div class="material-row">
      <label for="material-lighting">Lighting</label>
      <input id="material-lighting" type="range" min="0" max="100" step="1" :value="value.lighting" @input="setLighting" />
      <input class="number-input" type="number" min="0" max="100" step="1" :value="value.lighting" aria-label="Lighting percentage" @change="setLighting" />
      <span class="percent">%</span>
    </div>

    <div class="material-row color-row">
      <label>Color</label>
      <button type="button" class="material-swatch" :style="{ backgroundColor: value.color }" aria-label="Edit material color" :aria-expanded="pickerOpen" @click="togglePicker"></button>
      <input class="hex-input" type="text" :value="value.color.slice(1).toUpperCase()" maxlength="7" aria-label="Material color hex" @change="setColorFromInput" />
      <input class="number-input" type="number" min="0" max="100" :value="Math.round(value.opacity * 100)" aria-label="Material opacity percentage" @change="setOpacityFromInput" />
      <span class="percent">%</span>
    </div>

    <Teleport to="body">
      <ColorPickerPanel
        v-if="pickerOpen"
        class="material-color-panel"
        :style="pickerPosition"
        :is-open="true"
        :model-value="value.color"
        :alpha="value.opacity"
        @update:model-value="update({ color: $event })"
        @update:alpha="update({ opacity: $event })"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ColorPickerPanel from './ColorPickerPanel.vue';
import type { MaterialAssetValue } from '../../utils/materialAsset';

const props = defineProps<{ modelValue: MaterialAssetValue }>();
const emit = defineEmits<{ 'update:modelValue': [value: MaterialAssetValue] }>();
const value = computed(() => props.modelValue);
const pickerOpen = ref(false);
const pickerPosition = ref({ left: '12px', top: '12px', right: 'auto', width: '244px', zIndex: '2600' });
const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : max;
const update = (patch: Partial<MaterialAssetValue>) => emit('update:modelValue', { ...value.value, ...patch });

const previewStyle = computed(() => {
  const hex = value.value.color.slice(1);
  const channels = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  const light = value.value.lighting / 100;
  const base = channels.map(channel => Math.round(channel * (0.48 + light * 0.52)));
  const highlight = base.map(channel => Math.round(channel + (255 - channel) * light * 0.45));
  const shadow = base.map(channel => Math.round(channel * 0.42));
  return {
    background: `radial-gradient(circle at 32% 26%, rgb(${highlight.join(',')}) 0%, rgb(${base.join(',')}) 51%, rgb(${shadow.join(',')}) 100%)`,
    opacity: value.value.opacity,
  };
});

const setLighting = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const lighting = clamp(Number(input.value), 0, 100);
  update({ lighting });
  input.value = String(lighting);
};
const setColorFromInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const hex = input.value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(hex)) update({ color: `#${hex.toLowerCase()}` });
  else input.value = value.value.color.slice(1).toUpperCase();
};
const setOpacityFromInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const opacity = clamp(Number(input.value) / 100, 0, 1);
  update({ opacity });
  input.value = String(Math.round(opacity * 100));
};
const togglePicker = (event: MouseEvent) => {
  if (pickerOpen.value) { pickerOpen.value = false; return; }
  const dialog = (event.currentTarget as HTMLElement).closest('.asset-dialog-container')?.getBoundingClientRect();
  const width = 270;
  const left = dialog && dialog.left >= width + 12
    ? dialog.left - width - 12
    : Math.min(window.innerWidth - width - 8, (dialog?.right ?? 0) + 12);
  const top = clamp((dialog?.top ?? 0) + 140, 8, Math.max(8, window.innerHeight - 390));
  pickerPosition.value = { left: `${Math.max(8, left)}px`, top: `${top}px`, right: 'auto', width: '244px', zIndex: '2600' };
  pickerOpen.value = true;
};
const onPointerDown = (event: PointerEvent) => {
  if (!(event.target as HTMLElement).closest('.material-color-panel, .material-swatch')) pickerOpen.value = false;
};
onMounted(() => window.addEventListener('pointerdown', onPointerDown));
onUnmounted(() => window.removeEventListener('pointerdown', onPointerDown));
</script>

<style scoped>
.material-editor { display: flex; flex-direction: column; gap: 14px; }
.material-preview { height: 164px; display: grid; place-items: center; border-radius: 10px; background: #f1f1f1; overflow: hidden; }
.preview-sphere { width: 112px; height: 112px; border-radius: 50%; box-shadow: inset -8px -14px 17px #0002, 0 14px 18px #0002; }
.material-title { display: flex; align-items: center; justify-content: space-between; color: #222; font-size: 13px; }
.material-title span { padding: 7px 10px; border-radius: 7px; background: #f1f1f1; color: #666; font-weight: 600; }
.material-row { display: flex; align-items: center; gap: 5px; min-width: 0; }
.material-row label { flex: 0 0 60px; color: #666; font-size: 12px; }
.material-row input[type='range'] { flex: 1; min-width: 40px; accent-color: #8d1741; cursor: pointer; }
.number-input, .hex-input { box-sizing: border-box; height: 32px; border: 0; border-radius: 6px; background: #f1f1f1; text-align: center; color: #444; font-size: 11px; }
.number-input { width: 40px; }
.hex-input { flex: 1; min-width: 0; width: 64px; }
.percent { color: #888; font-size: 11px; }
.material-swatch { width: 32px; height: 32px; flex: none; border: 1px solid #ddd; border-radius: 7px; cursor: pointer; }
</style>
