import type { ScopeIdentity } from "@ai-grading/api-contracts";

export type ScopeResolveInput = {
  activationCode?: string | null;
  deviceId?: string | null;
  anonymousSeed?: string;
};

export const normalizeNonEmpty = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const normalizeActivationCode = (value?: string | null): string | undefined => {
  const trimmed = normalizeNonEmpty(value);
  return trimmed ? trimmed.toUpperCase() : undefined;
};

export const buildActivationScopeKey = (activationCode: string): string => `ac:${activationCode}`;

export const buildDeviceScopeKey = (deviceId: string): string => `device:${deviceId}`;

export const buildAnonymousScopeKey = (seed: string): string => `anon:${seed}`;

export const resolveScopeIdentity = (input: ScopeResolveInput): ScopeIdentity => {
  const activationCode = normalizeActivationCode(input.activationCode);
  if (activationCode) {
    return {
      scopeKey: buildActivationScopeKey(activationCode),
      scopeType: "activation",
      activationCode
    };
  }

  const deviceId = normalizeNonEmpty(input.deviceId);
  if (deviceId) {
    return {
      scopeKey: buildDeviceScopeKey(deviceId),
      scopeType: "device",
      deviceId
    };
  }

  const fallbackSeed = normalizeNonEmpty(input.anonymousSeed) || crypto.randomUUID();
  return {
    scopeKey: buildAnonymousScopeKey(fallbackSeed),
    scopeType: "anonymous"
  };
};
