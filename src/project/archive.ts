import { strFromU8, strToU8, unzipSync, zipSync } from 'three/addons/libs/fflate.module.js';
import type { ProjectData, ProjectDocument } from './types';

const MAX_FILES = 2000;
const MAX_FILE_BYTES = 256 * 1024 * 1024;
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const ASSET_LISTS = ['materials', 'colors', 'images', 'medias', 'audios'] as const;
const RESOURCE_KEYS = new Set(['src', 'detailSrc', 'texture', 'mask', 'url']);

type JsonRecord = Record<string, any>;
type EntryInfo = { name: string; size: number; originalSize: number; compression: number };

function fail(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value: unknown, location: string): asserts value is JsonRecord {
  if (!isRecord(value)) fail(`${location} must be an object.`);
}

function requireString(value: unknown, location: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) fail(`${location} must be a nonempty string.`);
}

function identifier(value: unknown, location: string): string {
  if ((typeof value !== 'string' || !value.trim()) && (typeof value !== 'number' || !Number.isFinite(value))) {
    fail(`${location} must be a nonempty string or finite number.`);
  }
  return String(value);
}

/** Paths are intentionally canonical so ZIP extraction and browser URLs agree. */
function requireAssetPath(path: string, directory = false): void {
  const parts = path.split('/');
  if (directory) parts.pop();
  if (!path.startsWith('assets/') || (!directory && parts.length < 2) || parts.some(part => !part || part === '.' || part === '..')
    || /[\\%?#:\u0000-\u001f\u007f]/.test(path)) {
    fail(`Unsafe archive asset path: ${path}. Files must use canonical paths under assets/.`);
  }
}

function checkEntryLimits(entries: EntryInfo[]): void {
  if (entries.length > MAX_FILES) fail(`Archive file limit exceeded: at most ${MAX_FILES} entries are allowed.`);
  let total = 0;
  const names = new Set<string>();
  for (const entry of entries) {
    if (names.has(entry.name)) fail(`Duplicate archive path: ${entry.name}.`);
    names.add(entry.name);
    if (entry.name !== 'project.json') requireAssetPath(entry.name, entry.name.endsWith('/'));
    if (!Number.isSafeInteger(entry.originalSize) || entry.originalSize < 0 || entry.originalSize > MAX_FILE_BYTES) {
      fail(`Archive file size limit exceeded for ${entry.name}: maximum 256 MiB.`);
    }
    if (entry.name === 'project.json' && entry.originalSize > MAX_MANIFEST_BYTES) fail('project.json manifest exceeds the 4 MiB limit.');
    if (entry.name.endsWith('/') && entry.originalSize !== 0) fail(`Invalid archive directory size: ${entry.name}.`);
    if (entry.compression !== 0 && entry.compression !== 8) fail(`Unsupported ZIP compression for ${entry.name}.`);
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) fail(`Invalid archive compressed size: ${entry.name}.`);
    total += entry.originalSize;
    if (total > MAX_TOTAL_BYTES) fail('Archive total size limit exceeded: maximum 512 MiB.');
  }
}

function validateResource(value: unknown, location: string, files: Map<string, Uint8Array>, required = false): void {
  if (value === undefined || value === null || value === '') {
    if (required) fail(`${location} requires a bundled asset source.`);
    return;
  }
  if (typeof value !== 'string') fail(`${location} must be an asset source string.`);
  // Embedded binary resources are already self contained. SVG and HTML data URLs
  // are excluded because the resulting project may be opened in a browser.
  if (/^data:(?:image\/(?:png|jpeg|jpg|webp|gif|avif|bmp|x-icon)|audio\/[\w.+-]+|video\/[\w.+-]+|application\/(?:octet-stream|gltf-buffer|gltf\+json)|model\/[\w.+-]+);base64,[A-Za-z0-9+/]*={0,2}$/i.test(value)) return;
  if (!value.startsWith('assets/')) fail(`${location} is not portable (${value.slice(0, 160)}). Bundle external, temporary, or unsafe URLs into assets/ before exporting.`);
  requireAssetPath(value);
  if (!files.has(value)) fail(`Missing asset ${value} referenced by ${location}.`);
}

function validateVector(value: unknown, location: string): void {
  if (!isRecord(value) || !['x', 'y', 'z'].every(axis => typeof value[axis] === 'number' && Number.isFinite(value[axis]))) {
    fail(`${location} must contain finite x, y, and z transform values.`);
  }
}

function validateMatrix(value: unknown, location: string): void {
  if (!Array.isArray(value) || value.length !== 16 || !value.every(number => typeof number === 'number' && Number.isFinite(number))) {
    fail(`${location} matrix must contain exactly 16 finite numbers.`);
  }
}

/** Validate numbers before JSON.stringify can turn Infinity/NaN into null. */
function inspectJson(value: unknown, location: string, ancestors = new Set<object>()): void {
  if (typeof value === 'number' && !Number.isFinite(value)) fail(`${location} must be finite.`);
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') fail(`${location} is not JSON serializable.`);
  if (value === null || typeof value !== 'object') return;
  if (ancestors.has(value)) fail(`${location} contains a circular value.`);
  ancestors.add(value);
  for (const [key, child] of Object.entries(value)) inspectJson(child, `${location}.${key}`, ancestors);
  ancestors.delete(value);
}

function inspectConfig(value: unknown, location: string, files: Map<string, Uint8Array>): void {
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const path = `${location}.${key}`;
    if (RESOURCE_KEYS.has(key)) validateResource(child, path, files);
    if (['position', 'rotation', 'scale'].includes(key) && child !== undefined) validateVector(child, path);
    inspectConfig(child, path, files);
  }
}

function validateDocument(value: unknown, files: Map<string, Uint8Array>): asserts value is ProjectDocument {
  requireRecord(value, 'Project manifest');
  if (value.format !== 'three-auto-creator') fail('Unsupported project format.');
  if (value.version !== 1) fail(`Unsupported project version: ${String(value.version)}.`);
  requireRecord(value.project, 'project metadata');
  for (const key of ['id', 'name', 'createdAt', 'updatedAt']) requireString(value.project[key], `project.${key}`);
  for (const key of ['createdAt', 'updatedAt']) {
    if (!/^\d{4}-\d{2}-\d{2}T/.test(value.project[key]) || !Number.isFinite(Date.parse(value.project[key]))) fail(`project.${key} must be an ISO date.`);
  }
  requireRecord(value.editor, 'editor');
  requireRecord(value.editor.config, 'editor.config');
  if (!Array.isArray(value.editor.config.series)) fail('editor.config.series must be an array.');
  for (const key of ['effectsEnabled', 'ambientEnabled']) {
    if (typeof value.editor[key] !== 'boolean') fail(`editor.${key} must be a boolean.`);
  }
  for (const key of ['activeEffect', 'lightColor', 'shadowType']) requireString(value.editor[key], `editor.${key}`);
  for (const key of ['effectIntensity', 'ambientIntensity', 'lightAlpha']) {
    if (typeof value.editor[key] !== 'number' || !Number.isFinite(value.editor[key])) fail(`editor.${key} must be finite.`);
  }
  requireRecord(value.editor.expandedSections, 'editor.expandedSections');
  if (Object.values(value.editor.expandedSections).some(item => typeof item !== 'boolean')) fail('editor.expandedSections values must be booleans.');

  const series = value.editor.config.series as JsonRecord[];
  const byId = new Map<string, JsonRecord>();
  for (let index = 0; index < series.length; index++) {
    const item = series[index];
    requireRecord(item, `series[${index}]`);
    const id = identifier(item.id, `series[${index}].id`);
    if (byId.has(id)) fail(`Duplicate series id: ${id}.`);
    byId.set(id, item);
    requireString(item.type, `series[${index}].type`);
    if (item.type === 'model' || item.type === 'instances') validateResource(item.src, `series[${index}].src`, files, true);
    if (item.assetMatrix !== undefined) validateMatrix(item.assetMatrix, `series[${index}].assetMatrix`);
    if (item.detailAssetMatrix !== undefined) validateMatrix(item.detailAssetMatrix, `series[${index}].detailAssetMatrix`);
    if (item.instanceMatrices !== undefined) {
      if (!Array.isArray(item.instanceMatrices)) fail(`series[${index}].instanceMatrices must be an array.`);
      item.instanceMatrices.forEach((matrix: unknown, matrixIndex: number) => validateMatrix(matrix, `series[${index}].instanceMatrices[${matrixIndex}]`));
    }
  }
  const complete = new Set<string>();
  // Iterative traversal avoids overflowing the stack on a deeply nested hierarchy.
  for (const id of byId.keys()) {
    const chain = new Set<string>();
    let current: string | undefined = id;
    while (current !== undefined && !complete.has(current)) {
      if (chain.has(current)) fail(`Parent cycle detected at series id ${current}.`);
      chain.add(current);
      const parent = byId.get(current)!.parentId;
      if (parent === null || parent === undefined) break;
      current = identifier(parent, `series ${current}.parentId`);
      if (!byId.has(current)) fail(`Missing parent series id ${current}.`);
    }
    for (const visited of chain) complete.add(visited);
  }
  if (value.editor.config.environment !== undefined) {
    requireRecord(value.editor.config.environment, 'editor.config.environment');
    validateResource(value.editor.config.environment.src, 'editor.config.environment.src', files, true);
  }
  if (value.editor.config.camera?.target !== undefined) validateVector(value.editor.config.camera.target, 'editor.config.camera.target');
  inspectConfig(value.editor.config, 'editor.config', files);

  requireRecord(value.assets, 'assets');
  const assetIds = new Set<string>();
  for (const key of ASSET_LISTS) {
    const list = value.assets[key];
    if (!Array.isArray(list)) fail(`assets.${key} must be an array.`);
    for (let index = 0; index < list.length; index++) {
      const asset = list[index];
      requireRecord(asset, `assets.${key}[${index}]`);
      const id = identifier(asset.id, `assets.${key}[${index}].id`);
      if (assetIds.has(id)) fail(`Duplicate asset id: ${id}.`);
      assetIds.add(id);
      if (['images', 'medias', 'audios'].includes(key) && typeof asset.value === 'string') validateResource(asset.value, `assets.${key}[${index}].value`, files);
      inspectConfig(asset, `assets.${key}[${index}]`, files);
    }
  }
}

function prepare(data: ProjectData): { document: ProjectDocument; manifest: Uint8Array; files: Record<string, Uint8Array> } {
  if (!(data?.files instanceof Map)) fail('Project files must be a Map of asset paths to Uint8Array resources.');
  const files: Record<string, Uint8Array> = Object.create(null);
  const entries: EntryInfo[] = [];
  for (const [path, bytes] of data.files) {
    if (typeof path !== 'string') fail('Archive asset paths must be strings.');
    requireAssetPath(path);
    if (!(bytes instanceof Uint8Array)) fail(`Asset ${path} must contain Uint8Array binary data.`);
    files[path] = bytes;
    entries.push({ name: path, size: bytes.byteLength, originalSize: bytes.byteLength, compression: 0 });
  }
  inspectJson(data.document, 'project');
  validateDocument(data.document, data.files);
  const manifest = strToU8(JSON.stringify(data.document));
  entries.push({ name: 'project.json', size: manifest.byteLength, originalSize: manifest.byteLength, compression: 0 });
  checkEntryLimits(entries);
  return { document: data.document, manifest, files };
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 255]!;
  return (crc ^ 0xffffffff) >>> 0;
}

/** fflate does not check CRCs, so validate directory bounds and CRC separately. */
function archiveChecksums(bytes: Uint8Array, entries: EntryInfo[]): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  const first = Math.max(0, bytes.length - 65558);
  while (end >= first && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < first || end + 22 + view.getUint16(end + 20, true) !== bytes.length) fail('Malformed ZIP end directory.');
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) fail('Multidisk ZIP archives are unsupported.');
  const count = view.getUint16(end + 10, true);
  if (count === 0xffff || count !== entries.length || view.getUint16(end + 8, true) !== count) fail('Malformed or unsupported ZIP64 directory.');
  const directorySize = view.getUint32(end + 12, true);
  const directoryStart = view.getUint32(end + 16, true);
  if (directoryStart + directorySize !== end) fail('Malformed ZIP directory bounds.');
  let offset = directoryStart;
  return entries.map(entry => {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) fail('Malformed ZIP file directory.');
    if (view.getUint16(offset + 8, true) & 1) fail('Encrypted ZIP resources are unsupported.');
    const checksum = view.getUint32(offset + 16, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > end || local + 30 > directoryStart || view.getUint32(local, true) !== 0x04034b50) fail(`Malformed ZIP resource header: ${entry.name}.`);
    const localNameLength = view.getUint16(local + 26, true);
    const dataStart = local + 30 + localNameLength + view.getUint16(local + 28, true);
    if (localNameLength !== nameLength || dataStart + entry.size > directoryStart) fail(`Malformed ZIP resource bounds: ${entry.name}.`);
    for (let index = 0; index < nameLength; index++) {
      if (bytes[local + 30 + index] !== bytes[offset + 46 + index]) fail(`Malformed ZIP resource path: ${entry.name}.`);
    }
    offset = next;
    return checksum;
  });
}

/** .threeauto is a standard ZIP containing project.json and binary assets/. */
export function encodeProject(data: ProjectData): Uint8Array {
  const { manifest, files } = prepare(data);
  // GLBs and web textures are already compressed; storing them avoids blocking
  // the UI recompressing hundreds of megabytes of meshopt/WebP resources.
  return zipSync({ 'project.json': manifest, ...files }, { level: 0 });
}

/** Decoding validates the whole package before a caller applies any state. */
export function decodeProject(bytes: Uint8Array): ProjectData {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 22) fail('Invalid ZIP project archive.');
  const entries: EntryInfo[] = [];
  try {
    // First pass visits central-directory metadata without inflating any data.
    // No resource allocation occurs until every entry has passed the limits.
    const names = new Set<string>();
    let total = 0;
    unzipSync(bytes, { filter: entry => {
      // Stop during metadata traversal, including hostile ZIP64 entry counts.
      if (entries.length >= MAX_FILES) fail(`Archive file limit exceeded: at most ${MAX_FILES} entries are allowed.`);
      checkEntryLimits([entry]);
      if (names.has(entry.name)) fail(`Duplicate archive path: ${entry.name}.`);
      names.add(entry.name);
      total += entry.originalSize;
      if (total > MAX_TOTAL_BYTES) fail('Archive total size limit exceeded: maximum 512 MiB.');
      entries.push(entry);
      return false;
    } });
  } catch (error) {
    fail(`Invalid project archive: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!entries.some(entry => entry.name === 'project.json')) fail('Project archive is missing project.json.');
  const checksums = archiveChecksums(bytes, entries);
  let contents: Record<string, Uint8Array>;
  try {
    contents = unzipSync(bytes);
  } catch (error) {
    fail(`Invalid ZIP project archive: ${error instanceof Error ? error.message : String(error)}`);
  }
  for (const [index, entry] of entries.entries()) {
    if (contents[entry.name]?.byteLength !== entry.originalSize) fail(`Malformed ZIP resource size: ${entry.name}.`);
    if (crc32(contents[entry.name]!) !== checksums[index]) fail(`Corrupt ZIP resource checksum: ${entry.name}.`);
  }
  let document: unknown;
  try {
    document = JSON.parse(strFromU8(contents['project.json']!));
  } catch {
    fail('project.json manifest is not valid JSON.');
  }
  const files = new Map(Object.entries(contents).filter(([name]) => name !== 'project.json' && !name.endsWith('/')));
  validateDocument(document, files);
  return { document, files };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

/** runtimeSource must expose globalThis.CreatorViewer.mount from a bundled module. */
export function exportWebsite(data: ProjectData, runtimeSource: string): Uint8Array {
  const { document, manifest, files } = prepare(data);
  if (typeof runtimeSource !== 'string' || !runtimeSource.trim()) fail('A bundled offline runtime source is required.');
  const name = escapeHtml(document.project.name);
  const bootstrap = `
const status = document.getElementById('loading');
function showError(error) {
  status.textContent = '加载失败：' + (error instanceof Error ? error.message : String(error));
  status.setAttribute('role', 'alert');
}
try {
  const response = await fetch(new URL('./project.json', document.baseURI));
  if (!response.ok) throw new Error('project.json: HTTP ' + response.status);
  const project = await response.json();
  let assetError = false;
  const viewer = CreatorViewer.mount({
    canvas: document.getElementById('app'),
    config: project.editor.config,
    editor: project.editor,
    resolveAsset: path => new URL(path, document.baseURI).href,
    onError: error => { assetError = true; showError(error); },
  });
  await viewer.ready;
  if (!assetError) status.remove();
} catch (error) { showError(error); }
`;
  const html = `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name}</title><style>html,body,#app{width:100%;height:100%;margin:0;overflow:hidden}body{font-family:system-ui,sans-serif}canvas{display:block}#loading{position:fixed;inset:0;display:grid;place-items:center;background:#101820;color:white}</style></head><body><canvas id="app"></canvas><div id="loading" role="status">正在加载 ${name}…</div><script type="module" src="./runtime.js"></script><script type="module">${bootstrap}</script></body></html>\n`;
  const readme = `${document.project.name}\n\nStandalone offline website\n\nExtract the ZIP, then serve this directory with a local static server:\n\n  python3 -m http.server 8080\n\nOpen http://localhost:8080 in a browser. Opening index.html through file:// is not supported because browsers block module and asset loading.\n\nThe package includes runtime.js, project.json and all referenced binary assets. It does not require a CDN or an internet connection. Keep the assets/ directory and project.json beside index.html.\n`;
  return zipSync({ 'index.html': strToU8(html), 'runtime.js': strToU8(runtimeSource), 'project.json': manifest, 'README.txt': strToU8(readme), ...files }, { level: 0 });
}
