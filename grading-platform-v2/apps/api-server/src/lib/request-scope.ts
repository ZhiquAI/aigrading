import { normalizeActivationCode, normalizeNonEmpty, resolveScopeIdentity } from "@ai-grading/domain-core";
import type { ScopeIdentity } from "@ai-grading/api-contracts";

export class ScopeResolutionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ScopeResolutionError";
  }
}

type ResolveRequestScopeOptions = {
  requireIdentity?: boolean;
  requireActivation?: boolean;
  anonymousSeed?: string;
};

export const resolveRequestScope = (
  request: Request,
  options: ResolveRequestScopeOptions = {}
): ScopeIdentity => {
  const activationCode = normalizeActivationCode(request.headers.get("x-activation-code"));
  const deviceId = normalizeNonEmpty(request.headers.get("x-device-id"));

  if (options.requireActivation && !activationCode) {
    throw new ScopeResolutionError("MISSING_ACTIVATION_CODE", "缺少激活码", 401);
  }

  if (options.requireIdentity && !activationCode && !deviceId) {
    throw new ScopeResolutionError("MISSING_SCOPE_IDENTITY", "缺少身份标识", 401);
  }

  const identity = resolveScopeIdentity({
    activationCode,
    deviceId,
    anonymousSeed: options.anonymousSeed ?? `${Date.now()}_${crypto.randomUUID()}`
  });

  return {
    ...identity,
    activationCode,
    deviceId
  };
};

export const isScopeResolutionError = (error: unknown): error is ScopeResolutionError => {
  return error instanceof ScopeResolutionError;
};
