export const parseBooleanEnv = (value: string | undefined, defaultValue: boolean) => {
  if (value == null) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }

  return defaultValue;
};

export const parsePositiveIntEnv = (value: string | undefined, defaultValue: number) => {
  if (value == null) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
};

export const parseCsvEnv = (value: string | undefined) =>
  new Set(
    (value || '')
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean),
  );
