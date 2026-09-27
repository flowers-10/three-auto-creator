<template>
  <header ref="toolbarRef" class="floating-toolbar">
    <div class="toolbar-content">
      <button class="tool-btn add-btn" type="button" aria-label="Add object" aria-haspopup="menu" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen"><UiIcon name="plus" /></button>
      <button class="tool-btn quick-btn" type="button" title="Rectangle (待实现)" aria-label="Rectangle" @click="showPending('Rectangle')"><UiIcon name="square" /></button>
      <button class="tool-btn quick-btn" type="button" title="Cube" aria-label="Cube" @click="addObject('cube')"><UiIcon name="cube" /></button>
      <button class="tool-btn quick-btn" type="button" title="Text (待实现)" aria-label="Text" @click="showPending('Text')"><UiIcon name="text" /></button>
      <button class="tool-btn quick-btn" type="button" title="Path (待实现)" aria-label="Path" @click="showPending('Path')"><UiIcon name="path" /></button>
      <button class="tool-btn quick-btn" type="button" title="Input (待实现)" aria-label="Input" @click="showPending('Input')"><UiIcon name="input" /></button>
      <div class="divider"></div>
      <button class="tool-btn quick-btn" type="button" title="Select" aria-label="Select"><UiIcon name="select" /></button>
      <button class="tool-btn quick-btn" type="button" title="Preview" aria-label="Preview" @click="togglePreview"><UiIcon name="preview" /></button>
      <div class="divider"></div>
      <button class="share-btn" type="button" @click="showPending('Share')">Share</button>
      <button class="export-btn" type="button" @click="showPending('Export')">Export</button>
    </div>

    <div v-if="menuOpen" class="dropdown-content custom-scrollbar" role="menu" aria-label="Add object">
      <div v-for="(group, groupIndex) in menuGroups" :key="groupIndex" class="menu-group">
        <button v-for="item in group" :key="item.label" class="menu-item" type="button" role="menuitem"
          :title="item.type ? `Add ${item.label}` : `${item.label} · 待实现`" @click="selectItem(item)">
          <span class="menu-icon"><UiIcon :name="menuIcon(item.label)" /></span>
          <span class="menu-label">{{ item.label }}</span>
          <span v-if="item.shortcut" class="menu-shortcut">{{ item.shortcut }}</span>
          <span v-else-if="!item.type" class="menu-pending">待实现</span>
        </button>
      </div>
    </div>
    <div v-if="notice" class="toolbar-notice" role="status">{{ notice }}</div>
  </header>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useEditorStore } from '../../store/EditorStore';
import UiIcon from '../ui/UiIcon.vue';

type MenuItem = { label: string; icon: string; type?: 'cube' | 'sphere'; shortcut?: string };

const menuGroups: MenuItem[][] = [
  [{ label: 'Templates', icon: '▣' }],
  [
    { label: 'Rectangle', icon: '▢', shortcut: 'R' },
    { label: 'Ellipse', icon: '◯', shortcut: 'O' },
    { label: 'Triangle', icon: '△', shortcut: 'K' },
    { label: 'Pentagon', icon: '⬠', shortcut: 'J' },
    { label: 'Star', icon: '☆' },
  ],
  [
    { label: 'Text', icon: 'T' },
    { label: 'Input', icon: '▤' },
    { label: 'Path', icon: '〰' },
    { label: 'Shape Blend', icon: '♧' },
    { label: 'Decal', icon: '▧' },
  ],
  [
    { label: 'Particle Emitter', icon: '⁙' },
    { label: 'Particle Force', icon: '✳' },
    { label: 'Hair System', icon: '♨' },
  ],
  [
    { label: 'Plane', icon: '⊞' },
    { label: 'Backdrop', icon: '◩' },
    { label: 'Cube', icon: '⬡', type: 'cube' },
    { label: 'Sphere', icon: '◎', type: 'sphere' },
    { label: 'Cylinder', icon: '▥' },
    { label: 'Torus', icon: '◉' },
    { label: 'Helix', icon: '≋' },
    { label: 'Cone', icon: '♧' },
    { label: 'Pyramid', icon: '◇' },
    { label: 'Icosahedron', icon: '⬡' },
    { label: 'Dodecahedron', icon: '⬢' },
    { label: 'Torus Knot', icon: '♧' },
  ],
  [
    { label: 'Lathe', icon: '♜' },
    { label: 'Bunny', icon: '♙' },
    { label: 'Teapot', icon: '♧' },
  ],
  [{ label: 'Group', icon: '☷' }],
  [
    { label: 'Camera', icon: '▣' },
    { label: 'Point Light', icon: '♧' },
    { label: 'Directional Light', icon: '☼' },
    { label: 'Spot Light', icon: '⌁' },
  ],
];

const menuIcon = (label: string) => ({
  Templates: 'template', Rectangle: 'square', Ellipse: 'circle', Triangle: 'triangle', Pentagon: 'pentagon', Star: 'star',
  Text: 'text', Input: 'input', Path: 'path', 'Shape Blend': 'blend', Decal: 'image',
  'Particle Emitter': 'particles', 'Particle Force': 'particles', 'Hair System': 'particles',
  Plane: 'plane', Backdrop: 'square', Cube: 'cube', Sphere: 'sphere', Cylinder: 'cylinder',
  Torus: 'torus', Helix: 'path', Cone: 'cone', Pyramid: 'cone', Icosahedron: 'cube', Dodecahedron: 'cube', 'Torus Knot': 'torus',
  Lathe: 'cylinder', Bunny: 'sphere', Teapot: 'torus', Group: 'group', Camera: 'camera',
  'Point Light': 'light', 'Directional Light': 'light', 'Spot Light': 'light',
} as Record<string, string>)[label] ?? 'square';

const editorStore = useEditorStore();
const toolbarRef = ref<HTMLElement | null>(null);
const menuOpen = ref(false);
const notice = ref('');
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

const showPending = (label: string) => {
  notice.value = `${label} 功能待实现`;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.value = ''; }, 2500);
};

const addObject = (type: 'cube' | 'sphere') => {
  const newId = Date.now();
  editorStore.config.series.push({
    id: newId,
    name: `New ${type}`,
    type,
    show: true,
  } as any);
  editorStore.selectObjects([newId]);
  menuOpen.value = false;
};

const selectItem = (item: MenuItem) => {
  if (item.type) addObject(item.type);
  else if (item.label === 'Group') {
    editorStore.groupSelectedObjects();
    menuOpen.value = false;
  }
  else showPending(item.label);
};

const togglePreview = () => { editorStore.isPreview = !editorStore.isPreview; };
const onPointerDown = (event: PointerEvent) => {
  if (toolbarRef.value && !toolbarRef.value.contains(event.target as Node)) menuOpen.value = false;
};
const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') menuOpen.value = false;
};

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKeyDown);
});
onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown);
  document.removeEventListener('keydown', onKeyDown);
  clearTimeout(noticeTimer);
});
</script>

<style scoped>
.floating-toolbar {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: #fff;
  padding: 6px 10px;
  border: 1px solid #eee;
  border-radius: 12px;
  box-shadow: 0 4px 20px #00000014;
}
.toolbar-content { display: flex; align-items: center; gap: 5px; }
.tool-btn { display: grid; place-items: center; flex: none; padding: 0; border: 0; background: transparent; color: #333; cursor: pointer; }
.tool-btn:hover, .add-btn { background: #f1f1f1; }
.add-btn { width: 42px; height: 42px; border-radius: 11px; }
.quick-btn { width: 42px; height: 42px; border-radius: 10px; }
.divider { width: 1px; height: 24px; background: #eee; margin: 0 3px; }
.dropdown-content {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 365px;
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  padding: 7px;
  border: 1px solid #e9e9e9;
  border-radius: 17px;
  background: #fff;
  box-shadow: 0 12px 32px #00000021;
}
.menu-group + .menu-group { border-top: 1px solid #f0f0f0; padding-top: 7px; margin-top: 7px; }
.menu-item { display: flex; align-items: center; width: 100%; min-height: 47px; padding: 0 14px; border: 0; border-radius: 8px; background: transparent; color: #474747; text-align: left; cursor: pointer; font: 500 15px/1.4 Arial, sans-serif; }
.menu-item:hover, .menu-item:focus-visible { background: #f4f4f5; outline: none; }
.menu-icon { display: inline-flex; align-items: center; justify-content: center; width: 30px; margin-right: 14px; color: #777; }
.menu-label { flex: 1; }
.menu-shortcut, .menu-pending { color: #aaa; font-size: 12px; }
.menu-pending { opacity: 0; }
.menu-item:hover .menu-pending, .menu-item:focus-visible .menu-pending { opacity: 1; }
.share-btn, .export-btn { padding: 8px 12px; border: 1px solid #eee; border-radius: 7px; background: #fff; color: #333; cursor: pointer; font-size: 12px; font-weight: 600; }
.export-btn { background: #111; color: #fff; border-color: #111; }
.toolbar-notice { position: absolute; top: calc(100% + 10px); left: 50%; transform: translateX(-50%); width: max-content; max-width: 260px; padding: 8px 12px; border-radius: 8px; background: #222; color: #fff; font-size: 12px; box-shadow: 0 4px 12px #0003; }
@media (max-width: 750px) {
  .floating-toolbar { left: 50%; max-width: calc(100vw - 24px); }
  .toolbar-content { overflow-x: auto; }
  .dropdown-content { width: min(365px, calc(100vw - 24px)); }
  .quick-btn { flex: 0 0 38px; }
}
</style>
