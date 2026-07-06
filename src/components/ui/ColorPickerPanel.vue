<template>
  <div class="color-picker-panel" v-if="isOpen" @mousedown.stop>
    <div class="color-header">
      <div class="color-preview-block" :style="{ backgroundColor: modelValue, opacity: alpha }"></div>
      <input type="text" :value="modelValue.toUpperCase()" @input="handleHexInput" class="hex-input" />
      <div class="opacity-label">{{ Math.round(alpha * 100) }}%</div>
    </div>

    <div class="picker-tabs">
      <div class="tab" :class="{ active: activeTab === 'custom' }" @click="activeTab = 'custom'">Custom</div>
      <div class="tab" :class="{ active: activeTab === 'assets' }" @click="activeTab = 'assets'">Assets</div>
      <button class="add-btn">+</button>
    </div>

    <template v-if="activeTab === 'custom'">
      <div class="saturation-palette" ref="paletteRef" @mousedown="startPicking">
        <div class="saturation-base" :style="{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }"></div>
        <div class="saturation-white"></div>
        <div class="saturation-black"></div>
        <div class="picker-cursor" :style="cursorStyle"></div>
      </div>

      <div class="sliders-area">
        <div class="eyedropper-tool">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M17.5,3C15.8,3 14.5,4.3 14.5,6C14.5,6.3 14.6,6.6 14.7,6.9L4,17.6L4,20L6.4,20L17.1,9.3C17.4,9.4 17.7,9.5 18,9.5C19.7,9.5 21,8.2 21,6.5C21,4.8 19.7,3.5 18,3.5L17.5,3M17.5,5L18,5C18.8,5 19.5,5.7 19.5,6.5C19.5,7.3 18.8,8 18,8C17.2,8 16.5,7.3 16.5,6.5L16.5,6C16.5,5.4 17,5 17.5,5M5.5,18.5L5.5,19L6,19L15.4,9.6C14.9,9.1 14.4,8.6 13.9,8.1L5.5,16.5V18.5Z"/></svg>
        </div>
        <div class="sliders-controls">
          <div class="hue-slider-track" ref="hueRef" @mousedown="startHuePicking">
            <div class="hue-cursor" :style="{ left: (hsv.h / 360) * 100 + '%' }"></div>
          </div>
          <div class="alpha-slider-track" ref="alphaRef" @mousedown="startAlphaPicking">
            <div class="alpha-bg" :style="{ background: `linear-gradient(to right, transparent, hsl(${hsv.h}, 100%, 50%))` }"></div>
            <div class="alpha-cursor" :style="{ left: alpha * 100 + '%' }"></div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="assets-color-list custom-scrollbar">
        <div 
          v-for="color in assetStore.colors" 
          :key="color.id" 
          class="asset-color-item"
          :class="{ active: modelValue === color.value }"
          @click="$emit('update:modelValue', color.value)"
        >
          <div class="color-swatch" :style="{ backgroundColor: color.value }"></div>
          <span class="color-name">{{ color.name }}</span>
        </div>
        <div v-if="!assetStore.colors.length" class="empty-assets">
          No color assets found.
        </div>
      </div>
    </template>

    <div class="color-values">
      {{ modelValue }} <span v-if="alpha < 1">({{ Math.round(alpha * 100) }}%)</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import { useAssetStore } from '../../store/useAssetStore';

const props = defineProps<{
  modelValue: string;
  alpha: number;
  isOpen: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'update:alpha']);

const assetStore = useAssetStore();
const activeTab = ref('custom');

// HSV 状态
const hsv = reactive({ h: 0, s: 100, v: 100 });

// DOM 引用
const paletteRef = ref<HTMLElement | null>(null);
const hueRef = ref<HTMLElement | null>(null);
const alphaRef = ref<HTMLElement | null>(null);

// 将 Hex 转换为 HSV
const hexToHSV = (hex: string) => {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, v = max;

  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, v: v * 100 };
};

// 将 HSV 转换为 Hex
const hsvToHex = (h: number, s: number, v: number) => {
  s /= 100;
  v /= 100;
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r = 0, g = 0, b = 0;
  switch (i) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }

  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// 初始化 HSV
watch(() => props.modelValue, (newHex) => {
  const newHSV = hexToHSV(newHex);
  // 仅当颜色显著变化时更新，避免精度导致的循环
  if (Math.abs(newHSV.h - hsv.h) > 0.1 || Math.abs(newHSV.s - hsv.s) > 0.1 || Math.abs(newHSV.v - hsv.v) > 0.1) {
    Object.assign(hsv, newHSV);
  }
}, { immediate: true });

const cursorStyle = computed(() => ({
  left: `${hsv.s}%`,
  top: `${100 - hsv.v}%`,
  backgroundColor: props.modelValue
}));

const handleHexInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  if (/^#[0-9A-F]{6}$/i.test(val)) {
    emit('update:modelValue', val);
  }
};

// 调色盘拖拽
const startPicking = (e: MouseEvent) => {
  updatePalette(e);
  window.addEventListener('mousemove', updatePalette);
  window.addEventListener('mouseup', stopPicking);
};

const updatePalette = (e: MouseEvent) => {
  if (!paletteRef.value) return;
  const rect = paletteRef.value.getBoundingClientRect();
  let x = (e.clientX - rect.left) / rect.width;
  let y = (e.clientY - rect.top) / rect.height;

  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));

  hsv.s = x * 100;
  hsv.v = (1 - y) * 100;
  emit('update:modelValue', hsvToHex(hsv.h, hsv.s, hsv.v));
};

const stopPicking = () => {
  window.removeEventListener('mousemove', updatePalette);
  window.removeEventListener('mouseup', stopPicking);
};

// 色相拖拽
const startHuePicking = (e: MouseEvent) => {
  updateHue(e);
  window.addEventListener('mousemove', updateHue);
  window.addEventListener('mouseup', stopHuePicking);
};

const updateHue = (e: MouseEvent) => {
  if (!hueRef.value) return;
  const rect = hueRef.value.getBoundingClientRect();
  let x = (e.clientX - rect.left) / rect.width;
  x = Math.max(0, Math.min(1, x));

  hsv.h = x * 360;
  emit('update:modelValue', hsvToHex(hsv.h, hsv.s, hsv.v));
};

const stopHuePicking = () => {
  window.removeEventListener('mousemove', updateHue);
  window.removeEventListener('mouseup', stopHuePicking);
};

// 透明度拖拽
const startAlphaPicking = (e: MouseEvent) => {
  updateAlpha(e);
  window.addEventListener('mousemove', updateAlpha);
  window.addEventListener('mouseup', stopAlphaPicking);
};

const updateAlpha = (e: MouseEvent) => {
  if (!alphaRef.value) return;
  const rect = alphaRef.value.getBoundingClientRect();
  let x = (e.clientX - rect.left) / rect.width;
  x = Math.max(0, Math.min(1, x));

  emit('update:alpha', parseFloat(x.toFixed(2)));
};

const stopAlphaPicking = () => {
  window.removeEventListener('mousemove', updateAlpha);
  window.removeEventListener('mouseup', stopAlphaPicking);
};
</script>

<style scoped>
/* ... 原有样式 ... */
.assets-color-list {
  height: 140px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.asset-color-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.asset-color-item:hover {
  background: #f5f5f5;
}

.asset-color-item.active {
  background: #eef2ff;
}

.color-swatch {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.05);
}

.color-name {
  font-size: 11px;
  color: #333;
  font-weight: 500;
}

.empty-assets {
  font-size: 10px;
  color: #ccc;
  text-align: center;
  margin-top: 40px;
  font-style: italic;
}
/* ... 之前的样式 ... */
</style>

<style scoped>
.color-picker-panel {
  position: fixed;
  left: auto;
  right: 270px; /* 侧边栏宽度 240px + 间距 */
  top: 150px;
  width: 220px;
  background: #ffffff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 9999;
  border: 1px solid #f0f0f0;
}

.color-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-preview-block {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(0,0,0,0.05);
}

.hex-input {
  flex: 1;
  border: none;
  background: #f5f5f5;
  padding: 6px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.opacity-label {
  background: #f5f5f5;
  padding: 6px;
  border-radius: 6px;
  font-size: 11px;
  color: #999;
}

.picker-tabs {
  display: flex;
  background: #f5f5f5;
  padding: 2px;
  border-radius: 8px;
  align-items: center;
}

.picker-tabs .tab {
  flex: 1;
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  padding: 6px 0;
  border-radius: 6px;
  cursor: pointer;
  color: #999;
}

.picker-tabs .tab.active {
  background: #fff;
  color: #000;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.add-btn {
  border: none;
  background: transparent;
  padding: 0 8px;
  font-size: 18px;
  color: #ccc;
  cursor: pointer;
}

.saturation-palette {
  height: 140px;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  cursor: crosshair;
}

.saturation-base {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
}

.saturation-white {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(to right, #fff, rgba(255,255,255,0));
}

.saturation-black {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(to top, #000, rgba(0,0,0,0));
}

.picker-cursor {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2.5px solid #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 5px rgba(0,0,0,0.3);
}

.sliders-area {
  display: flex;
  gap: 10px;
  align-items: center;
}

.eyedropper-tool {
  width: 32px;
  height: 32px;
  background: #f5f5f5;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
}

.sliders-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hue-slider-track {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
  position: relative;
}

.hue-cursor, .alpha-cursor {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}

.alpha-slider-track {
  height: 12px;
  border-radius: 6px;
  position: relative;
  cursor: pointer;
  background-image: linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
}

.alpha-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  border-radius: 6px;
}

.color-values {
  background: #f5f5f5;
  padding: 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-align: center;
}
</style>
