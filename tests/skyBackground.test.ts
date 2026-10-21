import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSkyBackground } from '../src/project/skyBackground';

function sky(type = THREE.FloatType as THREE.TextureDataType) {
  const width = 256, height = 128;
  const pixels = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    // A cloud centred 22.5 degrees above the horizon.
    pixels[offset] = x >= 112 && x < 144 && y >= 76 && y < 84 ? 4 : 0;
    pixels[offset + 2] = .25; pixels[offset + 3] = 1;
  }
  return new THREE.DataTexture(type === THREE.HalfFloatType ? Uint16Array.from(pixels, THREE.DataUtils.toHalfFloat) : pixels,
    width, height, THREE.RGBAFormat, type);
}

test('distant sky makes clouds narrower and lower while preserving the source HDR', () => {
  const source = sky();
  const original = source.image.data.slice();
  const result = createSkyBackground(source, 2);
  const { data, width, height } = result.image;
  const cloudRows = new Set<number>();
  let widestCloud = 0;
  for (let y = 0; y < height; y++) {
    let run = 0;
    for (let x = 0; x < width; x++) {
      if (Number(data[(y * width + x) * 4]) > 2) {
        cloudRows.add(y); widestCloud = Math.max(widestCloud, ++run);
      } else run = 0;
    }
  }
  assert.equal(widestCloud, 16, 'horizontal angular size is halved');
  assert.ok(cloudRows.size >= 4 && cloudRows.size <= 5, 'vertical angular size is reduced');
  assert.ok(Math.max(...cloudRows) < 76 && Math.min(...cloudRows) > 64, 'cloud moves closer to the horizon');
  assert.deepEqual(source.image.data, original, 'lighting and reflections keep the unmodified HDR');
  assert.equal(result.mapping, THREE.EquirectangularReflectionMapping);
  source.dispose(); result.dispose();
});

test('half-float sky retains HDR values and joins without a panorama seam', () => {
  const source = sky(THREE.HalfFloatType);
  const result = createSkyBackground(source, 2);
  assert.equal(result.type, THREE.HalfFloatType);
  const data = result.image.data as Uint16Array;
  assert.ok(Array.from(data).some(value => THREE.DataUtils.fromHalfFloat(value) > 1), 'radiance is not clipped to LDR');
  for (let y = 0; y < result.image.height; y++) {
    const start = y * result.image.width * 4;
    const end = start + (result.image.width - 1) * 4;
    assert.deepEqual(data.slice(start, start + 4), data.slice(end, end + 4));
  }
  source.dispose(); result.dispose();
});

test('scale one and invalid scales keep the original panorama', () => {
  const source = sky();
  for (const scale of [1, 0, -2, NaN, Infinity]) assert.equal(createSkyBackground(source, scale), source);
  source.dispose();
});
