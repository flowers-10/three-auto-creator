import { Plane, Raycaster, Vector3, type Camera, type Object3D, type Vector2 } from 'three';

/** Helpers are intentionally internal; only their visibility affects hit testing. */
export function hitsVisibleHandle(camera: Camera, handles: Object3D[], pointer: Vector2) {
  const raycaster = new Raycaster();
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(handles, true).some(hit => {
    for (let object: Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
    return true;
  });
}

/** Move on the view plane through the grabbed point, preserving the grab offset. */
export function createObjectDrag(camera: Camera, objects: Object3D[], pointer: Vector2, anchor: Vector3) {
  camera.updateWorldMatrix(true, false);
  const chosen = new Set(objects);
  const roots = [...chosen].filter(object => {
    for (let parent = object.parent; parent; parent = parent.parent) if (chosen.has(parent)) return false;
    return true;
  });
  const raycaster = new Raycaster();
  const plane = new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()), anchor);
  const intersection = (point: Vector2) => {
    raycaster.setFromCamera(point, camera);
    return raycaster.ray.intersectPlane(plane, new Vector3());
  };
  const start = intersection(pointer);
  if (!start || !roots.length) return null;
  const positions = roots.map(object => ({
    object, local: object.position.clone(), world: object.getWorldPosition(new Vector3()),
  }));
  return {
    objects: roots,
    move(point: Vector2) {
      const current = intersection(point);
      if (!current) return;
      const delta = current.sub(start);
      positions.forEach(({ object, world }) => {
        const next = world.clone().add(delta);
        if (object.parent) {
          object.parent.updateWorldMatrix(true, false);
          object.parent.worldToLocal(next);
        }
        object.position.copy(next);
        object.updateMatrix(); object.updateWorldMatrix(false, true);
      });
    },
    cancel() {
      positions.forEach(({ object, local }) => {
        object.position.copy(local);
        object.updateMatrix(); object.updateWorldMatrix(false, true);
      });
    },
  };
}
