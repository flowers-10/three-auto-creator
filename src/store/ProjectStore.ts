import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useEditorStore } from './EditorStore';
import { useAssetStore } from './useAssetStore';
import type { AssetSnapshot, ProjectData, ProjectDocument } from '../project/types';
import { decodeProject, encodeProject, exportWebsite } from '../project/archive';
import { installProject, listProjectDocuments, loadProject, saveProjectDocument, saveProjectFile } from '../project/library';

const ACTIVE_KEY = 'three-auto-creator-active-project';
const emptyAssets = (): AssetSnapshot => ({ materials: [], colors: [], images: [], medias: [], audios: [] });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const safeName = (name: string) => name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 100) || 'project';
const mime = (name: string) => name.endsWith('.glb') ? 'model/gltf-binary'
  : /\.png$/i.test(name) ? 'image/png' : /\.jpe?g$/i.test(name) ? 'image/jpeg'
  : /\.webp$/i.test(name) ? 'image/webp' : 'application/octet-stream';
function download(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer]));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const useProjectStore = defineStore('projects', () => {
  const editor = useEditorStore();
  const assets = useAssetStore();
  const ready = ref(false);
  const busy = ref('');
  const error = ref('');
  const status = ref('');
  const projectId = ref('');
  const filesRevision = ref(0);
  const projects = ref<Array<{ id: string; name: string; updatedAt: string }>>([]);
  const current = shallowRef<ProjectDocument | null>(null);
  const files = shallowRef(new Map<string, Uint8Array>());
  const urls = new Map<string, string>();
  let applying = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let saveQueue: Promise<void> = Promise.resolve();
  const projectName = computed(() => String(editor.config.name || '未命名项目'));

  const refreshProjects = async () => {
    projects.value = (await listProjectDocuments()).map(value => ({ id: value.project.id, name: value.project.name, updatedAt: value.project.updatedAt }));
  };
  const snapshot = (): ProjectDocument => {
    if (!current.value) throw new Error('项目尚未准备好。');
    return clone({ ...current.value, project: { ...current.value.project, name: projectName.value, updatedAt: new Date().toISOString() },
      editor: { ...current.value.editor, ...editor.getSnapshot() }, assets: assets.getSnapshot() });
  };
  const flush = async () => {
    clearTimeout(saveTimer);
    if (!current.value) return;
    const document = snapshot();
    status.value = '保存中…';
    const operation = saveQueue.catch(() => {}).then(() => saveProjectDocument(document));
    saveQueue = operation;
    try {
      await operation;
      if (document.project.id === projectId.value) { current.value = document; status.value = '已保存到本机'; }
      await refreshProjects();
    } catch (cause) {
      status.value = '未能自动保存，请导出备份';
      throw cause;
    }
  };
  const activate = async (data: ProjectData) => {
    applying = true;
    const oldUrls = [...urls.values()]; urls.clear();
    current.value = clone(data.document);
    files.value = data.files;
    projectId.value = data.document.project.id;
    filesRevision.value++;
    editor.applySnapshot(data.document.editor);
    assets.replaceSnapshot(data.document.assets);
    localStorage.setItem(ACTIVE_KEY, projectId.value);
    error.value = '';
    status.value = '已保存到本机';
    await nextTick();
    oldUrls.forEach(url => URL.revokeObjectURL(url));
    applying = false;
    await refreshProjects();
  };
  const makeDocument = (name: string, blank: boolean): ProjectDocument => {
    const now = new Date().toISOString();
    return { format: 'three-auto-creator', version: 1, project: { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now },
      editor: blank ? editor.createBlankState(name) : editor.getSnapshot(), assets: blank ? emptyAssets() : assets.getSnapshot() };
  };
  const initialize = async () => {
    if (ready.value) return;
    busy.value = '正在恢复项目…';
    try {
      const previous = localStorage.getItem(ACTIVE_KEY);
      const saved = previous ? await loadProject(previous) : null;
      if (saved) await activate(saved);
      else {
        const initial = { document: makeDocument(projectName.value, false), files: new Map<string, Uint8Array>() };
        await installProject(initial); await activate(initial);
      }
    } catch (cause) {
      current.value = makeDocument(projectName.value, false); projectId.value = current.value.project.id;
      error.value = `本机项目库不可用，仍可编辑和导出：${String(cause)}`;
    } finally { ready.value = true; busy.value = ''; }
  };
  const run = async (message: string, operation: () => Promise<void>) => {
    if (busy.value) return;
    busy.value = message; error.value = '';
    try { await operation(); }
    catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); }
    finally { busy.value = ''; }
  };
  const createProject = (name: string) => run('正在新建项目…', async () => {
    await flush();
    const data = { document: makeDocument(name.trim() || '未命名项目', true), files: new Map<string, Uint8Array>() };
    await installProject(data); await activate(data);
  });
  const switchProject = (id: string) => run('正在打开项目…', async () => {
    if (id === projectId.value) return;
    await flush(); const data = await loadProject(id);
    if (!data) throw new Error('找不到这个项目。');
    await activate(data);
  });
  const openBytes = async (bytes: Uint8Array) => {
    // Decode and validate before changing the active project.
    const data = decodeProject(bytes);
    await flush();
    data.document.project.id = crypto.randomUUID();
    data.document.project.updatedAt = new Date().toISOString();
    await installProject(data); await activate(data);
  };
  const importProject = (file: File) => run('正在导入项目和资源…', async () => {
    if (file.size > 512 * 1024 * 1024) throw new Error('项目包超过 512 MB。');
    await openBytes(new Uint8Array(await file.arrayBuffer()));
  });
  const resolveAsset = (path: string) => {
    if (!path.startsWith('assets/')) return path;
    const bytes = files.value.get(path);
    if (!bytes) throw new Error(`缺少项目资源：${path}`);
    let url = urls.get(path);
    if (!url) { url = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: mime(path) })); urls.set(path, url); }
    return url;
  };
  const importModel = (file: File) => run('正在导入 GLB…', async () => {
    if (!/\.glb$/i.test(file.name) || file.size > 256 * 1024 * 1024) throw new Error('请选择不超过 256 MB 的 GLB 模型。');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    if (bytes.length < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length || view.getUint32(16, true) !== 0x4e4f534a) throw new Error('GLB 文件格式无效。');
    const jsonLength = view.getUint32(12, true);
    if (20 + jsonLength > bytes.length) throw new Error('GLB 文件不完整。');
    const model = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
    if ([...(model.images ?? []), ...(model.buffers ?? [])].some((value: any) => value.uri && !String(value.uri).startsWith('data:'))) throw new Error('请使用贴图已内嵌的 GLB，避免丢失外部文件。');
    const id = crypto.randomUUID(), path = `assets/models/${id}.glb`;
    await saveProjectFile(projectId.value, path, bytes);
    files.value.set(path, bytes); filesRevision.value++;
    (editor.config.series as any[]).push({ id, name: file.name.replace(/\.glb$/i, ''), type: 'model', src: path, fitSize: 50,
      show: true, position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, rotation: { x: 0, y: 0, z: 0 } });
    editor.selectObjects([id]); await flush();
  });
  const exportProject = () => run('正在打包可编辑项目…', async () => {
    await flush().catch(() => {}); download(encodeProject({ document: snapshot(), files: files.value }), `${safeName(projectName.value)}.threeauto`);
    status.value = '项目包已导出';
  });
  const exportWeb = () => run('正在打包独立网页…', async () => {
    await flush().catch(() => {});
    const response = await fetch(`${import.meta.env.BASE_URL}export-runtime.js`);
    if (!response.ok) throw new Error('网页渲染脚本不可用，请重新启动开发服务或重新构建。');
    download(exportWebsite({ document: snapshot(), files: files.value }, await response.text()), `${safeName(projectName.value)}-web.zip`);
    status.value = '网页包已导出';
  });
  const exportJson = () => run('正在导出配置…', async () => {
    await flush().catch(() => {}); download(new TextEncoder().encode(JSON.stringify(snapshot(), null, 2)), `${safeName(projectName.value)}.json`);
    status.value = 'JSON 已导出；资源文件包含在项目包中';
  });
  watch(() => [editor.config, editor.effectsEnabled, editor.activeEffect, editor.effectIntensity,
    editor.ambientIntensity, editor.ambientEnabled, editor.lightColor, editor.lightAlpha, editor.shadowType,
    editor.expandedSections, assets.materials, assets.colors, assets.images, assets.medias, assets.audios], () => {
    if (!ready.value || applying) return;
    status.value = '有更改…'; clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { flush().catch(cause => { error.value = String(cause); }); }, 600);
  }, { deep: true });
  return { ready, busy, error, status, projectId, filesRevision, projectName, projects,
    initialize, createProject, switchProject, importProject, importModel,
    exportProject, exportWeb, exportJson, resolveAsset, flush, refreshProjects };
});
