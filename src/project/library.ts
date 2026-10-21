import type { ProjectData, ProjectDocument } from './types';

let database: Promise<IDBDatabase> | null = null;
function openDatabase() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('three-auto-creator-projects', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('projects', { keyPath: 'project.id' });
      request.result.createObjectStore('files', { keyPath: ['projectId', 'path'] });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
    request.onblocked = () => reject(new Error('请关闭其他 Creator 标签页后重试。'));
  });
  return database;
}
const resultOf = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const completed = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error('项目保存失败。'));
});
export async function listProjectDocuments(): Promise<ProjectDocument[]> {
  const db = await openDatabase();
  const values = await resultOf(db.transaction('projects').objectStore('projects').getAll());
  return values.sort((a, b) => b.project.updatedAt.localeCompare(a.project.updatedAt));
}
export async function saveProjectDocument(document: ProjectDocument) {
  const db = await openDatabase();
  const transaction = db.transaction('projects', 'readwrite');
  const done = completed(transaction);
  transaction.objectStore('projects').put(document);
  await done;
}
export async function installProject(data: ProjectData) {
  const db = await openDatabase();
  const transaction = db.transaction(['projects', 'files'], 'readwrite');
  const done = completed(transaction);
  transaction.objectStore('projects').put(data.document);
  for (const [path, bytes] of data.files) transaction.objectStore('files').put({
    projectId: data.document.project.id, path, bytes: Uint8Array.from(bytes).buffer,
  });
  await done;
}
export async function saveProjectFile(projectId: string, path: string, bytes: Uint8Array) {
  const db = await openDatabase();
  const transaction = db.transaction('files', 'readwrite');
  const done = completed(transaction);
  transaction.objectStore('files').put({ projectId, path, bytes: Uint8Array.from(bytes).buffer });
  await done;
}
export async function loadProject(id: string): Promise<ProjectData | null> {
  const db = await openDatabase();
  const transaction = db.transaction(['projects', 'files']);
  const documentRequest = transaction.objectStore('projects').get(id);
  const fileRequest = transaction.objectStore('files').getAll(IDBKeyRange.bound([id, ''], [id, '\uffff']));
  const [document, files] = await Promise.all([resultOf(documentRequest), resultOf(fileRequest)]);
  return document ? { document, files: new Map(files.map(file => [file.path, new Uint8Array(file.bytes)])) } : null;
}
