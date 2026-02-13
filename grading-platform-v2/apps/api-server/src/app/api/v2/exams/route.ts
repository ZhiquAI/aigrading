import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiErrorSchema, examCreateRequestSchema } from "@ai-grading/api-contracts";
import { prisma } from "@/lib/prisma";
import { isScopeResolutionError, resolveRequestScope } from "@/lib/request-scope";
import { createExam, isExamDomainError, listExams } from "@/modules/exams/exam-service";

const withError = (
  requestId: string,
  code: string,
  message: string,
  status: number
): NextResponse => {
  const payload = apiErrorSchema.parse({ code, message, requestId });
  return NextResponse.json({ ok: false, error: payload }, {
    status,
    headers: { "x-request-id": requestId }
  });
};

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

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
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const body = examCreateRequestSchema.parse(await request.json());

    const exam = await createExam(prisma, {
      scopeKey: scope.scopeKey,
      name: body.name,
      date: body.date,
      subject: body.subject,
      grade: body.grade,
      description: body.description
    });

    return NextResponse.json({ ok: true, data: exam }, {
      status: 201,
      headers: { "x-request-id": requestId }
    });
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return withError(requestId, error.code, error.message, error.statusCode);
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
