const toSafeInt = (value: string | null, fallback: number): number => {
  const parsed = Number(value ?? `${fallback}`);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.floor(parsed);
};

export const parsePage = (raw: string | null): number => {
  const value = toSafeInt(raw, 1);
  return value >= 1 ? value : 1;
};

export const parseLimit = (
  raw: string | null,
  options: { fallback?: number; max?: number } = {}
): number => {
  const fallback = options.fallback ?? 50;
  const max = options.max ?? 100;
  const value = toSafeInt(raw, fallback);

  if (value < 1) {
    return fallback;
  }

  return Math.min(value, max);
};
