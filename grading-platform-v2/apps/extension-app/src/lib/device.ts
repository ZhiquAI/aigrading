const DEVICE_STORAGE_KEY = "device_id";
const ACTIVATION_STORAGE_KEY = "activation_code";

const createDeviceId = (): string => {
  return `device_${Math.random().toString(36).slice(2, 12)}`;
};

export const getDeviceId = (): string => {
  const existing = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = createDeviceId();
  localStorage.setItem(DEVICE_STORAGE_KEY, created);
  return created;
};

export const getActivationCode = (): string | null => {
  return localStorage.getItem(ACTIVATION_STORAGE_KEY);
};

export const setActivationCode = (activationCode: string | null): void => {
  if (activationCode && activationCode.trim()) {
    localStorage.setItem(ACTIVATION_STORAGE_KEY, activationCode.trim());
    return;
  }

  localStorage.removeItem(ACTIVATION_STORAGE_KEY);
};
