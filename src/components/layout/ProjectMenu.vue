<template>
  <div ref="menuRoot" class="project-controls">
    <button type="button" class="project-button" :disabled="disabled" :aria-expanded="menu === 'project'" @click="toggle('project')">项目 ▾</button>
    <button type="button" class="export-button" :disabled="disabled" :aria-expanded="menu === 'export'" @click="toggle('export')">导出 ▾</button>
    <div v-if="menu" class="project-menu custom-scrollbar" role="menu" :aria-label="menu === 'project' ? '项目操作' : '导出项目'">
      <div class="project-heading"><strong>{{ store.projectName }}</strong><small>{{ store.status }}</small></div>
      <template v-if="menu === 'project'">
        <button type="button" role="menuitem" @click="newProject">新建项目…</button>
        <button type="button" role="menuitem" @click="chooseProject">打开项目包… <small>.threeauto / .zip</small></button>
        <button type="button" role="menuitem" @click="importCampus">导入当前园区 <small>完整资源 · 约 82 MB</small></button>
        <button type="button" role="menuitem" @click="chooseModel">导入 GLB 模型…</button>
        <div class="menu-section">本机项目 <small>自动保存</small></div>
        <button v-for="project in store.projects" :key="project.id" type="button" role="menuitemradio"
          :aria-checked="project.id === store.projectId" @click="openRecent(project.id)">
          <span>{{ project.id === store.projectId ? '✓ ' : '' }}{{ project.name }}</span>
        </button>
      </template>
      <template v-else>
        <button type="button" role="menuitem" @click="exportEditable">可编辑项目包 <small>JSON＋模型、贴图、HDR</small></button>
        <button type="button" role="menuitem" @click="exportWeb">独立网页 ZIP <small>HTML＋脚本＋JSON＋资源</small></button>
        <button type="button" role="menuitem" @click="exportJson">仅场景 JSON <small>便于查看参数，不含资源文件</small></button>
      </template>
    </div>
    <input ref="projectInput" hidden type="file" accept=".threeauto,.zip" @change="onProjectFile" />
    <input ref="modelInput" hidden type="file" accept=".glb" @change="onModelFile" />
    <InputDialog :open="nameDialog" title="新建项目" label="项目名称" initial-value="未命名项目"
      @cancel="nameDialog = false" @confirm="confirmNewProject" />
    <Teleport to="body">
      <div v-if="store.busy || store.error" class="project-message" :class="{ error: store.error }" role="status">
        <span>{{ store.busy || store.error }}</span>
        <button v-if="store.error && !store.busy" type="button" aria-label="关闭项目提示" @click="store.error = ''">×</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useProjectStore } from '../../store/ProjectStore';
import InputDialog from '../ui/InputDialog.vue';
const store = useProjectStore();
const menu = ref<'project' | 'export' | ''>('');
const menuRoot = ref<HTMLElement | null>(null);
const projectInput = ref<HTMLInputElement | null>(null);
const modelInput = ref<HTMLInputElement | null>(null);
const nameDialog = ref(false);
const disabled = computed(() => !store.ready || Boolean(store.busy));
const toggle = (value: 'project' | 'export') => { menu.value = menu.value === value ? '' : value; };
const newProject = () => { menu.value = ''; nameDialog.value = true; };
const confirmNewProject = (name: string) => { nameDialog.value = false; void store.createProject(name); };
const chooseProject = () => { menu.value = ''; projectInput.value?.click(); };
const chooseModel = () => { menu.value = ''; modelInput.value?.click(); };
const importCampus = () => { menu.value = ''; void store.importCampus(); };
const openRecent = (id: string) => { menu.value = ''; void store.switchProject(id); };
const exportEditable = () => { menu.value = ''; void store.exportProject(); };
const exportWeb = () => { menu.value = ''; void store.exportWeb(); };
const exportJson = () => { menu.value = ''; void store.exportJson(); };
const onProjectFile = (event: Event) => {
  const input = event.target as HTMLInputElement; const file = input.files?.[0];
  input.value = ''; if (file) void store.importProject(file);
};
const onModelFile = (event: Event) => {
  const input = event.target as HTMLInputElement; const file = input.files?.[0];
  input.value = ''; if (file) void store.importModel(file);
};
const outside = (event: PointerEvent) => { if (!menuRoot.value?.contains(event.target as Node)) menu.value = ''; };
const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') menu.value = ''; };
onMounted(() => { document.addEventListener('pointerdown', outside); document.addEventListener('keydown', keyboard); });
onUnmounted(() => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keyboard); });
</script>

<style scoped>
.project-controls { display: flex; gap: 5px; position: relative; }
.project-button, .export-button { padding: 9px 12px; border: 1px solid #eee; border-radius: 7px; background: #fff; color: #333; cursor: pointer; white-space: nowrap; font-size: 12px; font-weight: 600; }
.export-button { background: #111; color: #fff; border-color: #111; }
button:disabled { opacity: .5; cursor: wait; }
.project-menu { position: absolute; right: 0; top: calc(100% + 15px); width: 290px; max-height: calc(100vh - 110px); overflow-y: auto; padding: 7px; border: 1px solid #e9e9e9; border-radius: 12px; background: #fff; box-shadow: 0 12px 32px #0002; color: #333; }
.project-heading { display: flex; flex-direction: column; gap: 5px; padding: 9px 11px 13px; border-bottom: 1px solid #eee; overflow-wrap: anywhere; }
.project-heading strong { font-size: 13px; } small { color: #888; font-size: 11px; font-weight: 400; }
.project-menu > button { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; width: 100%; padding: 11px; border: 0; border-radius: 7px; background: transparent; color: #333; font-size: 13px; text-align: left; cursor: pointer; }
.project-menu > button:hover { background: #f4f4f4; }
.menu-section { display: flex; justify-content: space-between; padding: 12px 11px 6px; margin-top: 5px; border-top: 1px solid #eee; font-size: 11px; color: #888; }
.project-message { position: fixed; z-index: 6000; top: 84px; left: 50%; transform: translateX(-50%); max-width: min(540px, calc(100vw - 40px)); display: flex; align-items: center; gap: 12px; padding: 12px 18px; border: 1px solid #ddd; border-radius: 10px; background: #fff; color: #333; font-size: 13px; box-shadow: 0 8px 24px #0002; }
.project-message.error { border-color: #eab8b8; color: #a62f2f; }
.project-message button { border: 0; background: transparent; color: inherit; font-size: 20px; cursor: pointer; }
</style>
