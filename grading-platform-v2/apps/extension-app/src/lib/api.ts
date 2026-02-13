import { getActivationCode, getDeviceId } from "./device";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type ApiOk<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error?: { code?: string; message?: string };
};

type ApiResponse<T> = ApiOk<T> | ApiError;

export type LicenseStatusData = {
  identity: {
    scopeKey: string;
    scopeType: "activation" | "device" | "anonymous";
    activationCode?: string;
    deviceId?: string;
  };
  licenseStatus: "active" | "unactivated" | "invalid" | "disabled" | "expired" | "device_limit_reached";
  remainingQuota?: number;
  maxDevices?: number;
};

export type LicenseActivateData = {
  identity: {
    scopeKey: string;
    scopeType: "activation" | "device" | "anonymous";
    activationCode?: string;
    deviceId?: string;
  };
  activated: boolean;
  alreadyBound: boolean;
  remainingQuota: number;
  maxDevices: number;
};

export type SettingEntryDTO = {
  key: string;
  value: string;
  updatedAt: string;
};

const buildHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-device-id": getDeviceId()
  };

  const activationCode = getActivationCode();
  if (activationCode) {
    headers["x-activation-code"] = activationCode;
  }

  return headers;
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as ApiError;
    return payload.error?.message ?? `请求失败 (${response.status})`;
  } catch {
    return `请求失败 (${response.status})`;
  }
};

export const fetchLicenseStatus = async (): Promise<LicenseStatusData> => {
  const response = await fetch(`${API_BASE_URL}/api/v2/licenses/status`, {
    method: "GET",
    headers: buildHeaders()
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiResponse<LicenseStatusData>;
  if (!payload.ok) {
    throw new Error(payload.error?.message ?? "获取授权状态失败");
  }

  return payload.data;
};

export const activateLicenseCode = async (activationCode: string): Promise<LicenseActivateData> => {
  const response = await fetch(`${API_BASE_URL}/api/v2/licenses/activate`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      activationCode,
      deviceId: getDeviceId()
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiResponse<LicenseActivateData>;
  if (!payload.ok) {
    throw new Error(payload.error?.message ?? "激活失败");
  }

  return payload.data;
};

export const fetchSettingByKey = async (key: string): Promise<SettingEntryDTO | null> => {
  const query = new URLSearchParams({ key }).toString();
  const response = await fetch(`${API_BASE_URL}/api/v2/settings?${query}`, {
    method: "GET",
    headers: buildHeaders()
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiResponse<SettingEntryDTO | SettingEntryDTO[] | null>;
  if (!payload.ok) {
    throw new Error(payload.error?.message ?? "读取设置失败");
  }

  if (payload.data && !Array.isArray(payload.data)) {
    return payload.data;
  }

  return null;
};

export const upsertSettingByKey = async (key: string, value: unknown): Promise<SettingEntryDTO> => {
  const response = await fetch(`${API_BASE_URL}/api/v2/settings`, {
    method: "PUT",
    headers: buildHeaders(),
    body: JSON.stringify({ key, value })
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiResponse<SettingEntryDTO>;
  if (!payload.ok) {
    throw new Error(payload.error?.message ?? "保存设置失败");
  }

  return payload.data;
};

export const deleteSettingByKey = async (key: string): Promise<void> => {
  const query = new URLSearchParams({ key }).toString();
  const response = await fetch(`${API_BASE_URL}/api/v2/settings?${query}`, {
    method: "DELETE",
    headers: buildHeaders()
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiResponse<null>;
  if (!payload.ok) {
    throw new Error(payload.error?.message ?? "删除设置失败");
  }
};
