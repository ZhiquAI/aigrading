import { NextResponse } from "next/server";
import { getRequestId } from "@/shared/middleware/request-context";
import { ZodError } from "zod";
import { gradingEvaluateRequestSchema } from "@ai-grading/api-contracts";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import { isScopeResolutionError, resolveRequestScope } from "@/shared/scope-resolver/request-scope";
import { executeIdempotent, isIdempotencyConflictError } from "@/shared/idempotency/service";
import { evaluateGrading, getQuotaStatus, isGradingDomainError } from "@/modules/grading/grading-service";
import { jsonApiError } from "@/shared/errors/api-error";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const identity = resolveRequestScope(request, { requireIdentity: true });
    const body = gradingEvaluateRequestSchema.parse(await request.json());
    const deviceId = normalizeNonEmpty(request.headers.get("x-device-id"));
    const idempotencyKey = normalizeNonEmpty(request.headers.get("idempotency-key"));

    const result = await executeIdempotent(prisma, {
      scopeKey: identity.scopeKey,
      endpoint: "v2.gradings.evaluate",
      idempotencyKey,
      requestPayload: {
        ...body,
        deviceId: deviceId ?? null
      }
    }, async () => {
      const data = await evaluateGrading(prisma, {
        identity,
        rubric: body.rubric,
        studentName: body.studentName,
        questionNo: body.questionNo,
        questionKey: body.questionKey,
        examNo: body.examNo,
        deviceId,
        imageBase64: body.imageBase64
      });

      return {
        statusCode: 200,
        payload: data
      };
    });

    return NextResponse.json({ ok: true, data: result.payload }, {
      status: result.statusCode,
      headers: {
        "x-request-id": requestId,
        ...(result.replayed ? { "x-idempotency-replayed": "true" } : {})
      }
    });
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return jsonApiError(requestId, error.code, error.message, error.statusCode);
    }

    if (isIdempotencyConflictError(error)) {
      return jsonApiError(requestId, "IDEMPOTENCY_CONFLICT", error.message, 409);
    }

    if (isGradingDomainError(error)) {
      return jsonApiError(requestId, error.code, error.message, error.statusCode);
    }

    const isBadRequest = error instanceof ZodError || error instanceof SyntaxError;
    return jsonApiError(
      requestId,
      isBadRequest ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
      error instanceof Error
        ? error.message
        : isBadRequest
          ? "Invalid grading payload."
          : "Failed to evaluate grading.",
      isBadRequest ? 400 : 500
    );
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const identity = resolveRequestScope(request, { requireIdentity: true });
    const data = await getQuotaStatus(prisma, identity);

    return NextResponse.json({ ok: true, data }, {
      status: 200,
      headers: { "x-request-id": requestId }
    });
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return jsonApiError(requestId, error.code, error.message, error.statusCode);
    }

    return jsonApiError(
      requestId,
      "INTERNAL_SERVER_ERROR",
      error instanceof Error ? error.message : "Failed to get quota status.",
      500
    );
  }
}
