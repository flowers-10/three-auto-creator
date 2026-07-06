<template>
  <aside class="floating-sidebar-right custom-scrollbar">
    <div class="property-panel">
      <!-- Scene 属性 -->
      <template v-if="editorStore.selectedId === 'scene'">
        <div class="panel-header">
          <h3>Scene Settings</h3>
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
            <span>💡 Light</span>
            <span class="arrow" :class="{ rotated: editorStore.expandedSections.light }">›</span>
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
            <span>🖼️ Effects</span>
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
            <span>🌫️ Fog</span>
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
            <span>🌑 Ambient Shadows</span>
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

      <!-- 物体属性 -->
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
import { computed } from 'vue';
import { useEditorStore } from '../../store/EditorStore';
import ColorPicker from '../ui/ColorPicker.vue';
import Switch from '../ui/Switch.vue';
import Select from '../ui/Select.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import Slider from '../ui/Slider.vue';

const editorStore = useEditorStore();

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

const selectedObject = computed(() => {
  if (editorStore.selectedId === 'scene') return null;
  return editorStore.config.series.find(s => String(s.id) === editorStore.selectedId);
});

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
  width: 240px;
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
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #000;
}

.panel-section {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.section-title {
  font-size: 10px;
  font-weight: 800;
  color: #999;
  text-transform: uppercase;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.arrow {
  transition: transform 0.2s;
  font-size: 12px;
}

.arrow.rotated {
  transform: rotate(90deg);
}

.prop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.prop-row label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
  flex: 1;
  text-align: left; /* 确保文字左对齐 */
}

.prop-control {
  width: 140px;
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
  padding: 6px 10px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  font-size: 11px;
  width: 120px;
  background: #f5f5f5;
  outline: none;
  transition: all 0.2s;
  text-align: left; /* 统一左对齐 */
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
