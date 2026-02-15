import { NextResponse } from "next/server";
import { getRequestId } from "@/shared/middleware/request-context";
import { ZodError } from "zod";
import { rubricUpsertRequestSchema } from "@ai-grading/api-contracts";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import { isScopeResolutionError, resolveRequestScope } from "@/shared/scope-resolver/request-scope";
import { executeIdempotent, isIdempotencyConflictError } from "@/shared/idempotency/service";
import { jsonApiError } from "@/shared/errors/api-error";
import {
  deleteRubric,
  getRubricByQuestionKey,
  isRubricDomainError,
  listRubrics,
  upsertRubric
} from "@/modules/rubric/rubric-service";

const withError = (
  requestId: string,
  code: string,
  message: string,
  status: number
): NextResponse => {
  return jsonApiError(requestId, code, message, status);
};

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const searchParams = new URL(request.url).searchParams;
    const questionKey = normalizeNonEmpty(searchParams.get("questionKey"));
    const examId = normalizeNonEmpty(searchParams.get("examId"));

    if (questionKey) {
      const item = await getRubricByQuestionKey(prisma, {
        scopeKey: scope.scopeKey,
        questionKey
      });

      return NextResponse.json({
        ok: true,
        data: item
      }, {
        status: 200,
        headers: { "x-request-id": requestId }
      });
    }

    const items = await listRubrics(prisma, {
      scopeKey: scope.scopeKey,
      examId: examId ?? undefined
    });

    return NextResponse.json({ ok: true, data: items }, {
      status: 200,
      headers: { "x-request-id": requestId }
    });
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return withError(requestId, error.code, error.message, error.statusCode);
    }

    return withError(
      requestId,
      "INTERNAL_SERVER_ERROR",
      error instanceof Error ? error.message : "Failed to get rubrics.",
      500
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const body = rubricUpsertRequestSchema.parse(await request.json());
    const idempotencyKey = normalizeNonEmpty(request.headers.get("idempotency-key"));

    const result = await executeIdempotent(prisma, {
      scopeKey: scope.scopeKey,
      endpoint: "v2.rubrics.upsert",
      idempotencyKey,
      requestPayload: body
    }, async () => {
      const data = await upsertRubric(prisma, {
        scopeKey: scope.scopeKey,
        questionKey: body.questionKey,
        rubric: body.rubric,
        examId: body.examId,
        lifecycleStatus: body.lifecycleStatus,
        deviceId: scope.deviceId
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
      return withError(requestId, error.code, error.message, error.statusCode);
    }

    if (isIdempotencyConflictError(error)) {
      return withError(
        requestId,
        "IDEMPOTENCY_CONFLICT",
        error.message,
        409
      );
    }

    if (isRubricDomainError(error)) {
      return withError(requestId, error.code, error.message, error.statusCode);
    }

    if (error instanceof ZodError || error instanceof SyntaxError) {
      return withError(
        requestId,
        "BAD_REQUEST",
        error instanceof Error ? error.message : "Invalid rubric payload.",
        400
      );
    }

    return withError(
      requestId,
      "INTERNAL_SERVER_ERROR",
      error instanceof Error ? error.message : "Failed to save rubric.",
      500
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const questionKey = normalizeNonEmpty(new URL(request.url).searchParams.get("questionKey"));
    const idempotencyKey = normalizeNonEmpty(request.headers.get("idempotency-key"));

    if (!questionKey) {
      return withError(requestId, "BAD_REQUEST", "questionKey is required.", 400);
    }

    const result = await executeIdempotent(prisma, {
      scopeKey: scope.scopeKey,
      endpoint: "v2.rubrics.delete",
      idempotencyKey,
      requestPayload: { questionKey }
    }, async () => {
      await deleteRubric(prisma, { scopeKey: scope.scopeKey, questionKey });
      return {
        statusCode: 200,
        payload: null as null
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
      return withError(requestId, error.code, error.message, error.statusCode);
    }

    if (isIdempotencyConflictError(error)) {
      return withError(
        requestId,
        "IDEMPOTENCY_CONFLICT",
        error.message,
        409
      );
    }

    return withError(
      requestId,
      "INTERNAL_SERVER_ERROR",
      error instanceof Error ? error.message : "Failed to delete rubric.",
      500
    );
  }
}
