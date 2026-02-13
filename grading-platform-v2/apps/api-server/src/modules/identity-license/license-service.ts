import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type {
  LicenseActivateResponse,
  LicenseStatusResponse
} from "@ai-grading/api-contracts";
import {
  buildActivationScopeKey,
  buildDeviceScopeKey,
  normalizeActivationCode,
  normalizeNonEmpty,
  resolveScopeIdentity
} from "@ai-grading/domain-core";

const ACTIVATE_ENDPOINT = "licenses.activate";

type LicenseStatusData = LicenseStatusResponse["data"];

export class LicenseDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "LicenseDomainError";
  }
}

export const isLicenseDomainError = (error: unknown): error is LicenseDomainError => {
  return error instanceof LicenseDomainError;
};

type GetLicenseStatusInput = {
  activationCode?: string | null;
  deviceId?: string | null;
};

type ActivateLicenseInput = {
  activationCode: string;
  deviceId?: string | null;
  idempotencyKey?: string | null;
};

export type ActivateLicenseResult = {
  statusCode: number;
  payload: LicenseActivateResponse;
};

const isCodeExpired = (expiresAt: Date | null): boolean => {
  if (!expiresAt) {
    return false;
  }
  return expiresAt.getTime() <= Date.now();
};

const buildIdempotencyHash = (activationCode: string, deviceId: string): string => {
  return createHash("sha256")
    .update(`${activationCode}:${deviceId}`)
    .digest("hex");
};

const createActiveStatus = (params: {
  activationCode: string;
  deviceId?: string;
  remainingQuota: number;
  maxDevices: number;
}): LicenseStatusData => {
  const identity = {
    ...resolveScopeIdentity({
      activationCode: params.activationCode,
      deviceId: params.deviceId
    }),
    deviceId: params.deviceId
  };

  return {
    identity,
    licenseStatus: "active",
    remainingQuota: params.remainingQuota,
    maxDevices: params.maxDevices
  };
};

export const getLicenseStatus = async (
  db: PrismaClient,
  input: GetLicenseStatusInput
): Promise<LicenseStatusData> => {
  const activationCode = normalizeActivationCode(input.activationCode);
  const deviceId = normalizeNonEmpty(input.deviceId);

  if (activationCode) {
    const codeRecord = await db.licenseCode.findUnique({ where: { code: activationCode } });
    const identity = {
      ...resolveScopeIdentity({ activationCode, deviceId }),
      deviceId
    };

    if (!codeRecord) {
      return { identity, licenseStatus: "invalid" };
    }

    if (!codeRecord.isEnabled) {
      return { identity, licenseStatus: "disabled" };
    }

    if (isCodeExpired(codeRecord.expiresAt)) {
      return { identity, licenseStatus: "expired" };
    }

    if (deviceId) {
      const binding = await db.licenseBinding.findUnique({
        where: {
          code_deviceId: {
            code: activationCode,
            deviceId
          }
        }
      });

      if (!binding) {
        return { identity, licenseStatus: "unactivated", maxDevices: codeRecord.maxDevices };
      }
    }

    const quota = await db.scopeQuota.findUnique({
      where: {
        scopeKey: buildActivationScopeKey(activationCode)
      }
    });

    return createActiveStatus({
      activationCode,
      deviceId,
      remainingQuota: quota?.remaining ?? codeRecord.totalQuota,
      maxDevices: codeRecord.maxDevices
    });
  }

  if (deviceId) {
    const latestBinding = await db.licenseBinding.findFirst({
      where: { deviceId },
      include: { license: true },
      orderBy: { createdAt: "desc" }
    });

    const deviceIdentity = resolveScopeIdentity({ deviceId });

    if (!latestBinding) {
      return {
        identity: deviceIdentity,
        licenseStatus: "unactivated"
      };
    }

    if (!latestBinding.license.isEnabled) {
      return {
        identity: {
          ...resolveScopeIdentity({
            activationCode: latestBinding.code,
            deviceId
          }),
          deviceId
        },
        licenseStatus: "disabled"
      };
    }

    if (isCodeExpired(latestBinding.license.expiresAt)) {
      return {
        identity: {
          ...resolveScopeIdentity({
            activationCode: latestBinding.code,
            deviceId
          }),
          deviceId
        },
        licenseStatus: "expired"
      };
    }

    const quota = await db.scopeQuota.findUnique({
      where: {
        scopeKey: buildActivationScopeKey(latestBinding.code)
      }
    });

    return createActiveStatus({
      activationCode: latestBinding.code,
      deviceId,
      remainingQuota: quota?.remaining ?? latestBinding.license.totalQuota,
      maxDevices: latestBinding.license.maxDevices
    });
  }

  return {
    identity: resolveScopeIdentity({ anonymousSeed: "missing_identity" }),
    licenseStatus: "unactivated"
  };
};

const persistIdempotencyResult = async (
  db: PrismaClient,
  input: {
    scopeKey: string;
    idempotencyKey: string;
    requestHash: string;
    payload: LicenseActivateResponse;
    statusCode: number;
  }
): Promise<void> => {
  try {
    await db.idempotencyRecord.create({
      data: {
        scopeKey: input.scopeKey,
        endpoint: ACTIVATE_ENDPOINT,
        key: input.idempotencyKey,
        requestHash: input.requestHash,
        responseBody: JSON.stringify(input.payload),
        statusCode: input.statusCode
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
};

export const activateLicense = async (
  db: PrismaClient,
  input: ActivateLicenseInput
): Promise<ActivateLicenseResult> => {
  const activationCode = normalizeActivationCode(input.activationCode);
  const deviceId = normalizeNonEmpty(input.deviceId);

  if (!activationCode) {
    throw new LicenseDomainError("INVALID_ACTIVATION_CODE", "Activation code is required.", 400);
  }

  if (!deviceId) {
    throw new LicenseDomainError("MISSING_DEVICE_ID", "Device ID is required for activation.", 400);
  }

  const idempotencyKey = normalizeNonEmpty(input.idempotencyKey);
  const preScopeKey = buildDeviceScopeKey(deviceId);
  const requestHash = buildIdempotencyHash(activationCode, deviceId);

  if (idempotencyKey) {
    const idempotencyRecord = await db.idempotencyRecord.findUnique({
      where: {
        scopeKey_endpoint_key: {
          scopeKey: preScopeKey,
          endpoint: ACTIVATE_ENDPOINT,
          key: idempotencyKey
        }
      }
    });

    if (idempotencyRecord) {
      if (idempotencyRecord.requestHash !== requestHash) {
        throw new LicenseDomainError(
          "IDEMPOTENCY_CONFLICT",
          "The idempotency key has been used with a different activation payload.",
          409
        );
      }

      return {
        statusCode: idempotencyRecord.statusCode,
        payload: JSON.parse(idempotencyRecord.responseBody) as LicenseActivateResponse
      };
    }
  }

  const transactionResult = await db.$transaction(async (tx) => {
    const codeRecord = await tx.licenseCode.findUnique({ where: { code: activationCode } });

    if (!codeRecord) {
      throw new LicenseDomainError(
        "INVALID_LICENSE_CODE",
        "Activation code does not exist.",
        404
      );
    }

    if (!codeRecord.isEnabled) {
      throw new LicenseDomainError("LICENSE_DISABLED", "Activation code has been disabled.", 409);
    }

    if (isCodeExpired(codeRecord.expiresAt)) {
      throw new LicenseDomainError("LICENSE_EXPIRED", "Activation code has expired.", 409);
    }

    let alreadyBound = false;

    const existingBinding = await tx.licenseBinding.findUnique({
      where: {
        code_deviceId: {
          code: activationCode,
          deviceId
        }
      }
    });

    if (existingBinding) {
      alreadyBound = true;
    } else {
      const bindingCount = await tx.licenseBinding.count({ where: { code: activationCode } });
      if (bindingCount >= codeRecord.maxDevices) {
        throw new LicenseDomainError(
          "DEVICE_LIMIT_REACHED",
          "The activation code reached the maximum number of devices.",
          409
        );
      }

      try {
        await tx.licenseBinding.create({
          data: {
            code: activationCode,
            deviceId,
            scopeKey: buildActivationScopeKey(activationCode)
          }
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          alreadyBound = true;
        } else {
          throw error;
        }
      }
    }

    const activationScopeKey = buildActivationScopeKey(activationCode);
    const quota = await tx.scopeQuota.upsert({
      where: {
        scopeKey: activationScopeKey
      },
      update: {
        code: activationCode
      },
      create: {
        scopeKey: activationScopeKey,
        code: activationCode,
        remaining: codeRecord.totalQuota
      }
    });

    const payload: LicenseActivateResponse = {
      ok: true,
      data: {
        identity: {
          ...resolveScopeIdentity({
            activationCode,
            deviceId
          }),
          deviceId
        },
        activated: true,
        alreadyBound,
        remainingQuota: quota.remaining,
        maxDevices: codeRecord.maxDevices
      }
    };

    return {
      statusCode: alreadyBound ? 200 : 201,
      payload
    };
  });

  if (idempotencyKey) {
    await persistIdempotencyResult(db, {
      scopeKey: preScopeKey,
      idempotencyKey,
      requestHash,
      payload: transactionResult.payload,
      statusCode: transactionResult.statusCode
    });
  }

  return transactionResult;
};
