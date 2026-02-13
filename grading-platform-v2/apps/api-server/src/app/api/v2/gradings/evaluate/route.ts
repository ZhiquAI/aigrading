import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiErrorSchema, gradingEvaluateRequestSchema } from "@ai-grading/api-contracts";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import { isScopeResolutionError, resolveRequestScope } from "@/lib/request-scope";
import { evaluateGrading, getQuotaStatus, isGradingDomainError } from "@/modules/grading/grading-service";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const identity = resolveRequestScope(request, { requireIdentity: true });
    const body = gradingEvaluateRequestSchema.parse(await request.json());

    const data = await evaluateGrading(prisma, {
      identity,
      rubric: body.rubric,
      studentName: body.studentName,
      questionNo: body.questionNo,
      questionKey: body.questionKey,
      examNo: body.examNo,
      deviceId: normalizeNonEmpty(request.headers.get("x-device-id"))
    });

    return NextResponse.json({ ok: true, data }, {
      status: 200,
      headers: { "x-request-id": requestId }
    });
  } catch (error) {
    if (isScopeResolutionError(error)) {
      const payload = apiErrorSchema.parse({
        code: error.code,
        message: error.message,
        requestId
      });
      return NextResponse.json({ ok: false, error: payload }, { status: error.statusCode });
    }

    if (isGradingDomainError(error)) {
      const payload = apiErrorSchema.parse({
        code: error.code,
        message: error.message,
        requestId
      });
      return NextResponse.json({ ok: false, error: payload }, { status: error.statusCode });
    }

    const isBadRequest = error instanceof ZodError || error instanceof SyntaxError;
    const payload = apiErrorSchema.parse(
      isBadRequest
        ? {
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Invalid grading payload.",
            requestId
          }
        : {
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to evaluate grading.",
            requestId
          }
    );

    return NextResponse.json({ ok: false, error: payload }, {
      status: isBadRequest ? 400 : 500,
      headers: { "x-request-id": requestId }
    });
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const identity = resolveRequestScope(request, { requireIdentity: true });
    const data = await getQuotaStatus(prisma, identity);

    return NextResponse.json({ ok: true, data }, {
      status: 200,
      headers: { "x-request-id": requestId }
    });
  } catch (error) {
    if (isScopeResolutionError(error)) {
      const payload = apiErrorSchema.parse({
        code: error.code,
        message: error.message,
        requestId
      });
      return NextResponse.json({ ok: false, error: payload }, { status: error.statusCode });
    }

    const payload = apiErrorSchema.parse({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Failed to get quota status.",
      requestId
    });

    return NextResponse.json({ ok: false, error: payload }, {
      status: 500,
      headers: { "x-request-id": requestId }
    });
  }
}
