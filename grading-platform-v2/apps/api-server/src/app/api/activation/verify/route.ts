import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  activateLicense,
  getLicenseStatus,
  isLicenseDomainError
} from "@/modules/identity-license/license-service";
import { normalizeActivationCode, normalizeNonEmpty } from "@ai-grading/domain-core";

type LegacySuccessPayload<T> = {
  success: true;
  message: string;
  data: T;
};

type LegacyErrorPayload = {
  success: false;
  message: string;
  data: null;
};

const legacySuccess = <T>(data: T, message: string): NextResponse => {
  const payload: LegacySuccessPayload<T> = {
    success: true,
    message,
    data
  };

  return NextResponse.json(payload, { status: 200 });
};

const legacyError = (message: string, status = 400): NextResponse => {
  const payload: LegacyErrorPayload = {
    success: false,
    message,
    data: null
  };

  return NextResponse.json(payload, { status });
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      code?: string;
      deviceId?: string;
    };

    const activationCode = normalizeActivationCode(body.code);
    const deviceId = normalizeNonEmpty(body.deviceId);

    if (!activationCode || !deviceId) {
      return legacyError("请输入激活码和设备标识", 400);
    }

    const result = await activateLicense(prisma, {
      activationCode,
      deviceId,
      idempotencyKey: request.headers.get("idempotency-key")
    });

    const codeRecord = await prisma.licenseCode.findUnique({ where: { code: activationCode } });
    if (!codeRecord) {
      return legacyError("激活码状态异常", 500);
    }

    const bindingCount = await prisma.licenseBinding.count({ where: { code: activationCode } });
    const isFirstActivation = !result.payload.data.alreadyBound && bindingCount === 1;

    return legacySuccess(
      {
        type: codeRecord.planType,
        remainingQuota: result.payload.data.remainingQuota,
        totalQuota: codeRecord.totalQuota,
        isFirstActivation
      },
      `激活成功，当前共享余额：${result.payload.data.remainingQuota} 份`
    );
  } catch (error) {
    if (isLicenseDomainError(error)) {
      if (error.code === "INVALID_LICENSE_CODE") {
        return legacyError("激活码不存在", 404);
      }
      if (error.code === "LICENSE_DISABLED") {
        return legacyError("激活码已被禁用", 400);
      }
      if (error.code === "LICENSE_EXPIRED") {
        return legacyError("激活码已过期", 400);
      }
      if (error.code === "DEVICE_LIMIT_REACHED") {
        return legacyError("该激活码已达到最大设备绑定数", 400);
      }
      if (error.code === "MISSING_DEVICE_ID") {
        return legacyError("设备标识不能为空", 400);
      }
      return legacyError(error.message, error.statusCode);
    }

    return legacyError("激活失败，请稍后重试", 500);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = normalizeNonEmpty(searchParams.get("deviceId"));
    const codeFromQuery = normalizeActivationCode(searchParams.get("code"));

    if (!deviceId) {
      return legacyError("设备标识不能为空", 400);
    }

    let targetCode = codeFromQuery;

    if (!targetCode) {
      const latestBinding = await prisma.licenseBinding.findFirst({
        where: { deviceId },
        orderBy: { createdAt: "desc" }
      });

      targetCode = latestBinding?.code;
    }

    if (!targetCode) {
      return legacySuccess(
        {
          isPaid: false,
          quota: 10,
          totalUsed: 0
        },
        "Success"
      );
    }

    const statusData = await getLicenseStatus(prisma, {
      activationCode: targetCode,
      deviceId
    });

    const codeRecord = await prisma.licenseCode.findUnique({ where: { code: targetCode } });
    if (!codeRecord) {
      return legacyError("激活码状态异常", 500);
    }

    if (["invalid", "disabled", "expired"].includes(statusData.licenseStatus)) {
      return legacyError("激活码状态异常", 400);
    }

    if (statusData.licenseStatus === "unactivated") {
      return legacySuccess(
        {
          isPaid: false,
          quota: 10,
          totalUsed: 0
        },
        "Success"
      );
    }

    const quota = statusData.remainingQuota ?? codeRecord.totalQuota;

    return legacySuccess(
      {
        isPaid: codeRecord.planType !== "trial",
        code: targetCode,
        type: codeRecord.planType,
        quota,
        maxQuota: codeRecord.totalQuota,
        used: Math.max(0, codeRecord.totalQuota - quota),
        expiresAt: codeRecord.expiresAt ? codeRecord.expiresAt.toISOString() : undefined
      },
      "Success"
    );
  } catch (error) {
    return legacyError(
      error instanceof Error ? error.message : "查询失败",
      500
    );
  }
}
