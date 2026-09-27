export interface MaterialAssetValue {
  color: string;
  opacity: number;
  lighting: number;
}

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : max;

export const normalizeMaterialAsset = (value: unknown): MaterialAssetValue => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawColor = typeof value === 'string' ? value : source.color;
  const color = typeof rawColor === 'string' && /^#[0-9a-f]{6}$/i.test(rawColor)
    ? rawColor.toLowerCase()
    : '#97305a';
  return {
    color,
    opacity: clamp(Number(source.opacity ?? 1), 0, 1),
    lighting: clamp(Number(source.lighting ?? 100), 0, 100),
  };
};
