import * as THREE from 'three';

export function createSkyBackground(source: THREE.DataTexture, scale = 2): THREE.DataTexture {
  if (!Number.isFinite(scale) || scale <= 1) return source;
  // Whole panorama repeats keep the azimuth seam continuous.
  const repeats = Math.max(1, Math.round(scale));
  if (repeats === 1) return source;
  const { width, height, data } = source.image;
  if (!data || !width || !height) return source;
  const halfFloat = source.type === THREE.HalfFloatType;
  const pixels = halfFloat ? Float32Array.from(data, THREE.DataUtils.fromHalfFloat) : data;
  const output = new Float32Array(data.length);
  const channels = data.length / (width * height);
  const columns = Array.from({ length: width }, (_, x) => {
    const sample = ((x + .5) * repeats - .5) % width;
    return { left: Math.floor(sample), right: (Math.floor(sample) + 1) % width, blend: sample % 1 };
  });
  for (let y = 0; y < height; y++) {
    const latitude = ((y + .5) / height - .5) * Math.PI;
    // Compress the cloud band toward the horizon, keeping both poles continuous.
    const sample = (.5 + Math.atan(Math.tan(latitude) * repeats) / Math.PI) * height - .5;
    const bottom = Math.max(0, Math.min(height - 1, Math.floor(sample)));
    const top = Math.max(0, Math.min(height - 1, Math.floor(sample) + 1));
    const blendY = Math.max(0, Math.min(1, sample - bottom));
    for (let x = 0; x < width; x++) {
      const { left, right, blend } = columns[x]!;
      for (let channel = 0; channel < channels; channel++) {
        const a = Number(pixels[(bottom * width + left) * channels + channel]);
        const b = Number(pixels[(bottom * width + right) * channels + channel]);
        const c = Number(pixels[(top * width + left) * channels + channel]);
        const d = Number(pixels[(top * width + right) * channels + channel]);
        output[(y * width + x) * channels + channel] =
          (a + (b - a) * blend) * (1 - blendY) + (c + (d - c) * blend) * blendY;
      }
    }
  }
  const background = new THREE.DataTexture(
    halfFloat ? Uint16Array.from(output, THREE.DataUtils.toHalfFloat) : output,
    width, height, source.format as THREE.PixelFormat, source.type,
  );
  background.mapping = THREE.EquirectangularReflectionMapping;
  background.colorSpace = source.colorSpace;
  background.minFilter = source.minFilter; background.magFilter = source.magFilter;
  background.wrapS = THREE.RepeatWrapping; background.wrapT = THREE.ClampToEdgeWrapping;
  background.flipY = source.flipY;
  background.needsUpdate = true;
  return background;
}
