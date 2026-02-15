import { NextResponse } from "next/server";
import { getRequestId } from "@/shared/middleware/request-context";
import { ZodError } from "zod";
import { examCreateRequestSchema } from "@ai-grading/api-contracts";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import { isScopeResolutionError, resolveRequestScope } from "@/shared/scope-resolver/request-scope";
import { executeIdempotent, isIdempotencyConflictError } from "@/shared/idempotency/service";
import { jsonApiError } from "@/shared/errors/api-error";
import { createExam, isExamDomainError, listExams } from "@/modules/exams/exam-service";

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
    const exams = await listExams(prisma, scope.scopeKey);

    return NextResponse.json({ ok: true, data: exams }, {
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
      error instanceof Error ? error.message : "Failed to get exams.",
      500
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const body = examCreateRequestSchema.parse(await request.json());
    const idempotencyKey = normalizeNonEmpty(request.headers.get("idempotency-key"));

    const result = await executeIdempotent(prisma, {
      scopeKey: scope.scopeKey,
      endpoint: "v2.exams.create",
      idempotencyKey,
      requestPayload: body
    }, async () => {
      const exam = await createExam(prisma, {
        scopeKey: scope.scopeKey,
        name: body.name,
        date: body.date,
        subject: body.subject,
        grade: body.grade,
        description: body.description
      });

      return {
        statusCode: 201,
        payload: exam
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

    if (isExamDomainError(error)) {
      return withError(requestId, error.code, error.message, error.statusCode);
    }

    if (error instanceof ZodError || error instanceof SyntaxError) {
      return withError(
        requestId,
        "BAD_REQUEST",
        error instanceof Error ? error.message : "Invalid exam payload.",
        400
      );
    }

    return withError(
      requestId,
      "INTERNAL_SERVER_ERROR",
      error instanceof Error ? error.message : "Failed to create exam.",
      500
    );
  }
}
