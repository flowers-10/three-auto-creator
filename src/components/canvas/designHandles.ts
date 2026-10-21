import { Vector3, type Camera, type Object3D } from 'three';

type DesignHandles = {
  gizmo: Object3D;
  selectOverlay: { group: Object3D; cornerDots: Object3D[]; faceDots: Object3D[] };
};

const viewPosition = new Vector3();

/** Keep the actual rendered/pickable helpers usable at any scene scale. */
export function updateDesignHandleSizes(design: DesignHandles, camera: Camera, viewportHeight: number) {
  const projectionY = Math.abs(camera.projectionMatrix.elements[5]!);
  if (viewportHeight <= 0 || !Number.isFinite(projectionY) || projectionY === 0) return;
  camera.updateWorldMatrix(true, false);

  const resize = (object: Object3D, pixels: number) => {
    object.getWorldPosition(viewPosition).applyMatrix4(camera.matrixWorldInverse);
    // The projection matrix includes fov/zoom; perspective size also depends on view depth.
    const depth = (camera as Camera & { isPerspectiveCamera?: boolean }).isPerspectiveCamera
      ? Math.max(.001, -viewPosition.z) : 1;
    object.scale.setScalar(pixels * 2 * depth / (projectionY * viewportHeight));
    object.updateMatrixWorld(true);
  };

  if (design.gizmo.visible) resize(design.gizmo, 88);
  if (design.selectOverlay.group.visible) {
    design.selectOverlay.cornerDots.forEach(dot => resize(dot, 8));
    design.selectOverlay.faceDots.forEach(dot => resize(dot, 8));
  }
}
