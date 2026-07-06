<template>
  <div class="canvas-container">
    <div class="canvas-wrapper">
      <canvas id="_scene"></canvas>
    </div>
    <!-- 底部视图切换 - 属于画布功能部分 -->
    <div class="viewport-controls" v-if="showControls">
      <button 
        @click="$emit('update-camera', 'OrthographicCamera')" 
        :class="{ active: cameraType === 'OrthographicCamera' }"
      >Orthographic</button>
      <button 
        @click="$emit('update-camera', 'PerspectiveCamera')" 
        :class="{ active: cameraType === 'PerspectiveCamera' }"
      >Perspective</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import * as AUTO from "three-auto";

const props = defineProps<{
  config: any;
  showControls: boolean;
  cameraType: string;
  activeEffect: string;
  effectIntensity: number;
  effectsEnabled: boolean;
}>();

const emit = defineEmits(['update-camera', 'tick']);

let instance: any = null;

const initThree = () => {
  if (instance) {
    instance.destroy?.();
  }

  const finalConfig = JSON.parse(JSON.stringify(props.config));
  
  // 处理后处理效果
  if (props.effectsEnabled) {
    finalConfig.postprocess = { 
      type: props.activeEffect,
      intensity: props.effectIntensity
    };
  }

  // 处理尺寸预设
  if (props.config.size.type === 'fullhd') {
    finalConfig.size = { type: 'fixed', width: 1920, height: 1080 };
  } else if (props.config.size.type === 'iphone') {
    finalConfig.size = { type: 'fixed', width: 375, height: 812 };
  }

  try {
    instance = new AUTO.ThreeAuto(undefined, finalConfig);
    instance.time.on("tick", (data: any) => {
      emit('tick', data);
    });
  } catch (e) {
    console.error("ThreeAuto initialization failed:", e);
  }
};

// 暴露 resize 方法给外部
defineExpose({
  resize: () => instance?.resize?.()
});

let updateTimer: any = null;
watch(() => [props.config, props.effectsEnabled, props.activeEffect, props.effectIntensity], () => {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    initThree();
  }, 300);
}, { deep: true });

onMounted(() => {
  initThree();
});

onUnmounted(() => {
  if (instance) {
    instance.destroy?.();
  }
});
</script>

<style scoped>
.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.canvas-wrapper {
  width: 100%;
  height: 100%;
}

#_scene {
  width: 100%;
  height: 100%;
  display: block;
}

.viewport-controls {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  padding: 4px;
  border-radius: 99px;
  display: flex;
  gap: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.viewport-controls button {
  border: none;
  background: transparent;
  padding: 8px 20px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.viewport-controls button.active {
  background: #6366f1;
  color: #fff;
}
</style>
