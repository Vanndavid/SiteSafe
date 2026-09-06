export const parsePositiveInt = (value: unknown, fallback: number) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  if (typeof value !== 'string') return fallback;

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;

  return parsed;
};
