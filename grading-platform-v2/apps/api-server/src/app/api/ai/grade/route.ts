import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { gradingEvaluateRequestSchema } from "@ai-grading/api-contracts";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import { isScopeResolutionError, resolveRequestScope } from "@/lib/request-scope";
import {
  evaluateGrading,
  getQuotaStatus,
  isGradingDomainError
} from "@/modules/grading/grading-service";
import { isRubricDomainError } from "@/modules/rubric/rubric-service";

type LegacySuccessPayload<T> = {
  success: true;
  message: string;
  data: T;
};

type LegacyErrorPayload = {
  success: false;
  error: string;
  code: string;
};

const legacySuccess = <T>(data: T, message: string): NextResponse => {
  const payload: LegacySuccessPayload<T> = {
    success: true,
    message,
    data
  };

  return NextResponse.json(payload, { status: 200 });
};

const legacyError = (error: string, code: string, status: number): NextResponse => {
  const payload: LegacyErrorPayload = {
    success: false,
    error,
    code
  };

  return NextResponse.json(payload, { status });
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const deviceId = normalizeNonEmpty(request.headers.get("x-device-id"));
    if (!deviceId) {
      return legacyError("缺少设备标识", "INVALID_REQUEST", 400);
    }

    const identity = resolveRequestScope(request, { requireIdentity: true });
    const body = gradingEvaluateRequestSchema.parse(await request.json());

    if (!body.imageBase64) {
      return legacyError("请提供学生答案图片", "INVALID_REQUEST", 400);
    }

    if (!body.rubric) {
      return legacyError("请提供评分细则", "INVALID_REQUEST", 400);
    }

    const result = await evaluateGrading(prisma, {
      identity,
      rubric: body.rubric,
      studentName: body.studentName,
      questionNo: body.questionNo,
      questionKey: body.questionKey,
      examNo: body.examNo,
      deviceId,
      imageBase64: body.imageBase64
    });

    return legacySuccess(result, "批改完成");
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.code, error.statusCode);
    }

    if (isGradingDomainError(error) || isRubricDomainError(error)) {
      return legacyError(error.message, error.code, error.statusCode);
    }

    if (error instanceof ZodError || error instanceof SyntaxError) {
      return legacyError(
        error instanceof Error ? error.message : "请求参数无效",
        "INVALID_REQUEST",
        400
      );
    }

    return legacyError("批改失败，请重试", "INTERNAL_ERROR", 500);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const deviceId = normalizeNonEmpty(request.headers.get("x-device-id"));
    if (!deviceId) {
      return legacyError("缺少设备标识", "INVALID_REQUEST", 400);
    }

    const identity = resolveRequestScope(request, { requireIdentity: true });
    const quota = await getQuotaStatus(prisma, identity);

    return legacySuccess(
      {
        isPaid: quota.isPaid,
        quota: quota.remaining,
        totalUsed: quota.totalUsed,
        status: quota.status
      },
      "Success"
    );
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.code, error.statusCode);
    }

    return legacyError("查询失败", "INTERNAL_ERROR", 500);
  }
}
