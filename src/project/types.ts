export type VectorValue = { x: number; y: number; z: number };
export type EditorSnapshot = {
  config: Record<string, any> & { series: any[] };
  effectsEnabled: boolean;
  activeEffect: string;
  effectIntensity: number;
  ambientIntensity: number;
  ambientEnabled: boolean;
  lightColor: string;
  lightAlpha: number;
  shadowType: string;
  expandedSections: Record<string, boolean>;
};
export type AssetSnapshot = {
  materials: any[]; colors: any[]; images: any[]; medias: any[]; audios: any[];
};
export type ProjectDocument = {
  format: 'three-auto-creator';
  version: 1;
  project: { id: string; name: string; createdAt: string; updatedAt: string };
  editor: EditorSnapshot;
  assets: AssetSnapshot;
};
export type ProjectData = { document: ProjectDocument; files: Map<string, Uint8Array> };

// Portable series extensions; rotations use radians.
// model: src, optional detailSrc/assetMatrix/detailAssetMatrix/fitSize, position/rotation/scale.
// ground: texture, width/depth; image orientation matches the campus ground.
// instances: src, instanceMatrices: number[][], optional instanceColors: string[].
// config.environment: { src, background?: boolean, intensity?: number, backgroundScale?: number }.
// backgroundScale defaults to 2 (smaller, distant clouds); 1 preserves the panorama. Whole-number repeats only.
// config.lighting: { hemisphere?: {sky,ground,intensity}, sun?: {color,intensity,position,castShadow} }.
// config.camera.target is the orbit target; config.renderer.exposure defaults to 1.1.
