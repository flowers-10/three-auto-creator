<template>
  <aside class="floating-sidebar-right custom-scrollbar">
    <div class="property-panel">
      <template v-if="runtimeSelectedObject">
        <div class="panel-header object-header">
          <div class="object-title-group">
            <h3 class="object-title">{{ runtimeObjectName }}</h3>
            <p class="object-subtitle">{{ editorStore.selectedSceneObjectType || 'Object3D' }}</p>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-title static-title">Transform</div>

          <div class="prop-row">
            <label>Name</label>
            <SmartInput v-model="runtimeObjectName" type="text" class="object-name-input" />
          </div>

          <div class="prop-row">
            <label>Visibility</label>
            <div class="prop-control">
              <SegmentedControl v-model="runtimeObjectVisible" :options="visibilityOptions" />
            </div>
          </div>

          <div class="transform-row">
            <label>Position</label>
            <div class="transform-inputs">
              <div class="transform-field"><span>X</span><SmartInput v-model="transformDrafts.position.x" type="number" :step="0.01" :drag-step="0.05" @focus="startEditingTransform('position', 'x')" @commit="commitTransform('position', 'x')" /></div>
              <div class="transform-field"><span>Y</span><SmartInput v-model="transformDrafts.position.y" type="number" :step="0.01" :drag-step="0.05" @focus="startEditingTransform('position', 'y')" @commit="commitTransform('position', 'y')" /></div>
              <div class="transform-field"><span>Z</span><SmartInput v-model="transformDrafts.position.z" type="number" :step="0.01" :drag-step="0.05" @focus="startEditingTransform('position', 'z')" @commit="commitTransform('position', 'z')" /></div>
            </div>
          </div>

          <div class="transform-row">
            <label class="scale-label">Scale<button class="scale-lock" :class="{ active: scaleLocked }" type="button" @click="scaleLocked = !scaleLocked" :title="scaleLocked ? '解锁缩放比例' : '锁定缩放比例'"><svg viewBox="0 0 16 16" aria-hidden="true"><path v-if="scaleLocked" d="M5.5 7V5.5a2.5 2.5 0 1 1 5 0V7M4.5 7h7a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><path v-else d="M10.5 7V5.5a2.5 2.5 0 1 0-4.58-1.36M4.5 7h7a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/></svg></button></label>
            <div class="transform-inputs">
              <div class="transform-field"><span>X</span><SmartInput v-model="transformDrafts.scale.x" type="number" :step="0.01" :drag-step="0.05" @focus="startEditingTransform('scale', 'x')" @commit="commitTransform('scale', 'x')" /></div>
              <div class="transform-field"><span>Y</span><SmartInput v-model="transformDrafts.scale.y" type="number" :step="0.01" :drag-step="0.05" @focus="startEditingTransform('scale', 'y')" @commit="commitTransform('scale', 'y')" /></div>
              <div class="transform-field"><span>Z</span><SmartInput v-model="transformDrafts.scale.z" type="number" :step="0.01" :drag-step="0.05" @focus="startEditingTransform('scale', 'z')" @commit="commitTransform('scale', 'z')" /></div>
            </div>
          </div>

          <div class="transform-row transform-row-last">
            <label>Rotation</label>
            <div class="transform-inputs">
              <div class="transform-field"><span>X</span><SmartInput v-model="transformDrafts.rotation.x" type="number" :step="0.01" :drag-step="0.05" @focus="startEditingTransform('rotation', 'x')" @commit="commitTransform('rotation', 'x')" /></div>
              <div class="transform-field"><span>Y</span><SmartInput v-model="transformDrafts.rotation.y" type="number" :step="0.01" :drag-step="0.05" @focus="startEditingTransform('rotation', 'y')" @commit="commitTransform('rotation', 'y')" /></div>
              <div class="transform-field"><span>Z</span><SmartInput v-model="transformDrafts.rotation.z" type="number" :step="0.01" :drag-step="0.05" @focus="startEditingTransform('rotation', 'z')" @commit="commitTransform('rotation', 'z')" /></div>
            </div>
          </div>
        </div>

        <div class="panel-section" v-if="editorStore.selectedSceneObjectMaterials.length">
          <div class="section-title static-title">Material</div>
          <div class="material-list">
            <div
              v-for="material in editorStore.selectedSceneObjectMaterials"
              :key="material.id"
              class="material-item"
            >
              <span
                class="material-dot"
                :style="{ background: material.color || 'linear-gradient(135deg, #7c4dff 0%, #4f46e5 100%)' }"
              ></span>
              <span class="material-name">{{ material.name }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Scene 属性 -->
      <template v-else-if="editorStore.selectedId === 'scene'">
        <div class="panel-header object-header">
          <div class="object-title-group">
            <h3 class="object-title">Scene Settings</h3>
            <p class="object-subtitle">Scene</p>
          </div>
        </div>
        
        <div class="panel-section">
          <div class="section-title">Frame</div>
          <div class="prop-row">
            <label>Size</label>
            <div class="prop-control">
              <Select v-model="editorStore.config.size.type" :options="sizeOptions" />
            </div>
          </div>
          <div class="prop-row" v-if="editorStore.config.size.type === 'fixed'">
            <div class="input-pair">
              <input type="number" v-model="editorStore.config.size.width" placeholder="W" />
              <input type="number" v-model="editorStore.config.size.height" placeholder="H" />
            </div>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-title">Scene</div>
          <div class="prop-row">
            <label>Background</label>
            <div class="prop-control">
              <ColorPicker 
                v-model="editorStore.config.renderer.clearColor" 
                v-model:alpha="editorStore.config.renderer.clearAlpha"
              />
            </div>
          </div>
        </div>

        <div class="panel-section expandable">
          <div class="section-title" @click="toggleSection('light')">
            <span class="section-title-main"><svg class="section-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5a3.5 3.5 0 0 0-2.21 6.21c.46.38.71.95.71 1.55V11h3v-.74c0-.6.25-1.17.71-1.55A3.5 3.5 0 0 0 8 2.5Z"/><path d="M6.5 12.5h3M6.8 14h2.4"/></svg><span>Light</span></span>
            <span class="arrow" :class="{ rotated: editorStore.expandedSections.light }"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></span>
          </div>
          <div class="section-content" v-show="editorStore.expandedSections.light">
            <div class="prop-row">
              <label>Ambient</label>
              <div class="prop-control">
                <SegmentedControl v-model="editorStore.ambientEnabled" :options="ambientOptions" />
              </div>
            </div>
            <div class="prop-row">
              <label>Color</label>
              <div class="prop-control">
                <ColorPicker 
                  v-model="editorStore.lightColor" 
                  v-model:alpha="editorStore.lightAlpha"
                />
              </div>
            </div>
            <div class="prop-row">
              <label>Intensity</label>
              <div class="prop-control-group">
                <input type="number" step="0.01" v-model="editorStore.ambientIntensity" class="ui-input-small" />
                <Slider :min="0" :max="2" :step="0.01" v-model="editorStore.ambientIntensity" />
              </div>
            </div>
            <div class="prop-row">
              <label>Shadow</label>
              <div class="prop-control">
                <Select v-model="editorStore.shadowType" :options="shadowTypeOptions" />
              </div>
            </div>
          </div>
        </div>

        <div class="panel-section expandable">
          <div class="section-title" @click="toggleSection('effects')">
            <span class="section-title-main"><svg class="section-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="2"/><path d="m5 9 1.8-1.8a1 1 0 0 1 1.4 0L11 10"/><circle cx="6" cy="6" r="1"/></svg><span>Effects</span></span>
            <Switch v-model="editorStore.effectsEnabled" @click.stop />
          </div>
          <div class="section-content" v-show="editorStore.effectsEnabled">
            <div class="prop-row">
              <label>Style</label>
              <div class="prop-control">
                <Select v-model="editorStore.activeEffect" :options="effectOptions" />
              </div>
            </div>
            <div class="prop-row">
              <label>Intensity</label>
              <div class="prop-control-group">
                <input type="number" step="0.1" v-model="editorStore.effectIntensity" class="ui-input-small" />
                <Slider :min="0" :max="1" :step="0.1" v-model="editorStore.effectIntensity" />
              </div>
            </div>
          </div>
        </div>

        <div class="panel-section expandable">
          <div class="section-title" @click="toggleSection('fog')">
            <span class="section-title-main"><svg class="section-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6.5h10M2.5 9h8M5 11.5h6"/></svg><span>Fog</span></span>
            <Switch v-model="editorStore.config.fog.show" @click.stop />
          </div>
          <div class="section-content" v-show="editorStore.config.fog.show">
            <div class="prop-row">
              <label>Color</label>
              <div class="prop-control">
                <ColorPicker 
                  v-model="editorStore.config.fog.color" 
                  v-model:alpha="editorStore.config.fog.alpha"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="panel-section expandable">
          <div class="section-title" @click="toggleSection('shadow')">
            <span class="section-title-main"><svg class="section-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.8A5.5 5.5 0 1 0 13.2 13 6 6 0 1 1 10.8 2.8Z"/></svg><span>Ambient Shadows</span></span>
            <Switch v-model="editorStore.config.shadow.show" @click.stop />
          </div>
          <div class="section-content" v-show="editorStore.config.shadow.show">
            <div class="prop-row">
              <label>Color</label>
              <div class="prop-control">
                <ColorPicker 
                  v-model="editorStore.config.shadow.color" 
                  v-model:alpha="editorStore.config.shadow.opacity"
                />
              </div>
            </div>
            <div class="prop-row">
              <label>Opacity</label>
              <div class="prop-control-group">
                <input type="number" step="0.01" v-model="editorStore.config.shadow.opacity" class="ui-input-small" />
                <Slider :min="0" :max="1" :step="0.01" v-model="editorStore.config.shadow.opacity" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 配置物体属性 -->
      <template v-else-if="selectedObject">
        <div class="panel-header">
          <h3>Object: {{ selectedObject.name }}</h3>
        </div>
        <div class="panel-section">
          <div class="prop-row">
            <label>Name</label>
            <input v-model="selectedObject.name" class="ui-input" />
          </div>
          <div class="prop-row">
            <label>Visibility</label>
            <div class="prop-control">
              <SegmentedControl v-model="selectedObject.show" :options="visibilityOptions" />
            </div>
          </div>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useEditorStore } from '../../store/EditorStore';
import ColorPicker from '../ui/ColorPicker.vue';
import Switch from '../ui/Switch.vue';
import Select from '../ui/Select.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import Slider from '../ui/Slider.vue';
import SmartInput from '../ui/SmartInput.vue';

const editorStore = useEditorStore();
const createTransformDrafts = () => ({
  position: { x: '0', y: '0', z: '0' },
  scale: { x: '1', y: '1', z: '1' },
  rotation: { x: '0', y: '0', z: '0' },
});
const transformDrafts = reactive(createTransformDrafts());
const activeTransformField = ref<string | null>(null);
const scaleLocked = ref(true);

const sizeOptions = [
  { label: 'Responsive', value: 'parent' },
  { label: 'Custom', value: 'fixed' },
  { label: 'FullHD', value: 'fullhd' },
  { label: 'iPhone X', value: 'iphone' }
];

const effectOptions = [
  { label: 'Moebius', value: 'moebius' },
  { label: 'Bloom', value: 'bloom' },
  { label: 'Pixelation', value: 'pixel' }
];

const visibilityOptions = [
  { label: 'Show', value: true },
  { label: 'Hide', value: false }
];

const ambientOptions = [
  { label: 'Yes', value: true },
  { label: 'No', value: false }
];

const shadowTypeOptions = [
  { label: 'Low faster', value: 'low-faster' },
  { label: 'High quality', value: 'high-quality' },
  { label: 'Ultra', value: 'ultra' }
];

const runtimeSelectedObject = computed(() => editorStore.selectedSceneObject);
const runtimeObjectName = computed({
  get: () => editorStore.selectedSceneObjectName,
  set: (value: string) => editorStore.renameSelectedSceneObject(value),
});
const runtimeObjectVisible = computed({
  get: () => editorStore.selectedSceneObjectVisible,
  set: (value: boolean) => editorStore.setSelectedSceneObjectVisible(value),
});

const selectedObject = computed(() => {
  if (editorStore.selectedId === 'scene') return null;
  return editorStore.config.series.find(s => String(s.id) === editorStore.selectedId);
});

const getTransformFieldKey = (section: 'position' | 'scale' | 'rotation', axis: 'x' | 'y' | 'z') => `${section}.${axis}`;
const syncTransformDrafts = () => {
  (['position', 'scale', 'rotation'] as const).forEach((section) => {
    (['x', 'y', 'z'] as const).forEach((axis) => {
      if (activeTransformField.value === getTransformFieldKey(section, axis)) return;
      transformDrafts[section][axis] = String(editorStore.selectedSceneObjectTransform[section][axis]);
    });
  });
};
const startEditingTransform = (section: 'position' | 'scale' | 'rotation', axis: 'x' | 'y' | 'z') => {
  activeTransformField.value = getTransformFieldKey(section, axis);
};
const commitTransform = (section: 'position' | 'scale' | 'rotation', axis: 'x' | 'y' | 'z') => {
  const rawValue = transformDrafts[section][axis].trim();
  activeTransformField.value = null;
  if (!rawValue || rawValue === '-' || rawValue === '.' || rawValue === '-.') {
    syncTransformDrafts();
    return;
  }

  if (section === 'scale' && scaleLocked.value) {
    const currentScale = {
      x: Number(editorStore.selectedSceneObjectTransform.scale.x) || 0,
      y: Number(editorStore.selectedSceneObjectTransform.scale.y) || 0,
      z: Number(editorStore.selectedSceneObjectTransform.scale.z) || 0,
    };
    const nextValue = Number(rawValue);
    if (Number.isNaN(nextValue)) {
      syncTransformDrafts();
      return;
    }
    const baseValue = currentScale[axis];
    const ratio = baseValue === 0 ? null : nextValue / baseValue;

    (['x', 'y', 'z'] as const).forEach((targetAxis) => {
      const value = ratio === null
        ? (targetAxis === axis ? nextValue : currentScale[targetAxis])
        : currentScale[targetAxis] * ratio;
      editorStore.updateSelectedSceneObjectTransform('scale', targetAxis, Number(value.toFixed(4)));
    });
    syncTransformDrafts();
    return;
  }

  editorStore.updateSelectedSceneObjectTransform(section, axis, rawValue);
  syncTransformDrafts();
};
watch(
  () => [
    editorStore.selectedId,
    editorStore.selectedSceneObjectTransform.position.x,
    editorStore.selectedSceneObjectTransform.position.y,
    editorStore.selectedSceneObjectTransform.position.z,
    editorStore.selectedSceneObjectTransform.scale.x,
    editorStore.selectedSceneObjectTransform.scale.y,
    editorStore.selectedSceneObjectTransform.scale.z,
    editorStore.selectedSceneObjectTransform.rotation.x,
    editorStore.selectedSceneObjectTransform.rotation.y,
    editorStore.selectedSceneObjectTransform.rotation.z,
  ],
  syncTransformDrafts,
  { immediate: true },
);

const toggleSection = (section: string) => {
  (editorStore.expandedSections as any)[section] = !(editorStore.expandedSections as any)[section];
};
</script>

<style scoped>
.floating-sidebar-right {
  position: fixed;
  right: 16px;
  top: 16px;
  bottom: 16px;
  width: 272px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  z-index: 999;
  overflow-y: auto;
  overflow-x: hidden;
}

.panel-header {
  padding: 14px 16px 12px;
  border-bottom: 1px solid #efefef;
}

.object-header {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

.object-title-group {
  min-width: 0;
}

.object-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  color: #212121;
}

.object-subtitle {
  width: 40px;
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.2;
  color: #a0a0a0;
}

.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.section-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #9b9b9b;
  text-transform: uppercase;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.static-title {
  cursor: default;
}

.section-title-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.section-icon,
.scale-lock svg,
.arrow svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}

.arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
  color: #9b9b9b;
}

.arrow.rotated {
  transform: rotate(90deg);
}

.prop-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  margin-bottom: 12px;
}

.prop-row label {
  font-size: 12px;
  color: #4a4a4a;
  font-weight: 500;
  text-align: left;
}

.prop-control {
  width: 100%;
}

.prop-control-group {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 140px;
}

.ui-input-small {
  width: 50px !important;
  padding: 4px 6px !important;
  font-size: 11px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #f5f5f5;
  text-align: left; /* 统一左对齐 */
  outline: none;
}

.ui-input-hex {
  width: 80px !important;
  padding: 4px 8px !important;
  font-size: 11px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #f5f5f5;
  text-transform: uppercase;
  text-align: left; /* 统一左对齐 */
  outline: none;
}

.color-preview {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid rgba(0,0,0,0.05);
  flex-shrink: 0;
}

.prop-row select, .prop-row input[type="text"], .prop-row input[type="number"], .ui-input {
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 12px;
  width: 146px;
  background: #f3f3f3;
  outline: none;
  transition: all 0.2s;
  text-align: left;
}

.ui-input:focus {
  background: #fff;
  border-color: #007aff;
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.1);
}

.input-pair {
  display: flex;
  gap: 6px;
}

.input-pair input {
  width: 47px;
}

.object-name-input {
  box-sizing: border-box;
  width: 100% !important;
}

.transform-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: start;
  column-gap: 12px;
  margin-bottom: 14px;
}

.transform-row label {
  padding-top: 22px;
  font-size: 12px;
  font-weight: 500;
  color: #4a4a4a;
  text-align: left;
}

.scale-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.scale-lock {
  border: none;
  background: transparent;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #9aa0a6;
}

.scale-lock.active {
  color: #4a4a4a;
}

.transform-row-last {
  margin-bottom: 0;
}

.transform-inputs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

.transform-field {
  width: 100%;
}

.transform-field span {
  display: block;
  font-size: 10px;
  color: #76a8ff;
  margin-bottom: 4px;
  padding-left: 0;
  text-align: center;
}

.transform-field input {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #f3f3f3;
  font-size: 12px;
  line-height: 1.2;
  outline: none;
  box-sizing: border-box;
  appearance: textfield;
  -moz-appearance: textfield;
}

.transform-field input:focus {
  background: #fff;
  border-color: #007aff;
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.1);
}

.transform-field input::-webkit-outer-spin-button,
.transform-field input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.material-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.material-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f5f5f5;
}

.material-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.24);
}

.material-name {
  font-size: 12px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-hint {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: #8a8a8a;
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-picker-wrapper input[type="color"] {
  width: 20px;
  height: 20px;
  border: none;
  padding: 0;
  background: none;
  cursor: pointer;
  border-radius: 4px;
}

.color-text {
  width: 70px !important;
}

.btn-group {
  display: flex;
  background: #f0f0f0;
  padding: 2px;
  border-radius: 6px;
}

.btn-group button {
  border: none;
  background: transparent;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  color: #666;
}

.btn-group button.active {
  background: #fff;
  color: #007aff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
</style>
