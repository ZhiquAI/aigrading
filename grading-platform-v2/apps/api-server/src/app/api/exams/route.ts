import { NextResponse } from "next/server";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import { isScopeResolutionError, resolveRequestScope } from "@/lib/request-scope";
import { createExam, isExamDomainError, listExams } from "@/modules/exams/exam-service";

type LegacyErrorPayload = {
  success: false;
  error: string;
};

const legacyError = (error: string, status = 400): NextResponse => {
  const payload: LegacyErrorPayload = {
    success: false,
    error
  };
  return NextResponse.json(payload, { status });
};

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const scope = resolveRequestScope(request);
    const exams = await listExams(prisma, scope.scopeKey);
    return NextResponse.json({ success: true, exams });
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.statusCode);
    }

    return legacyError(error instanceof Error ? error.message : "获取考试列表失败", 500);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const scope = resolveRequestScope(request);
    const body = (await request.json()) as {
      name?: unknown;
      date?: unknown;
      subject?: unknown;
      grade?: unknown;
      description?: unknown;
    };

    const exam = await createExam(prisma, {
      scopeKey: scope.scopeKey,
      name: typeof body.name === "string" ? body.name : undefined,
      date: typeof body.date === "string" ? body.date : undefined,
      subject: normalizeNonEmpty(typeof body.subject === "string" ? body.subject : undefined),
      grade: normalizeNonEmpty(typeof body.grade === "string" ? body.grade : undefined),
      description:
        normalizeNonEmpty(typeof body.description === "string" ? body.description : undefined)
    });

    return NextResponse.json({ success: true, exam });
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.statusCode);
    }

    if (isExamDomainError(error)) {
      return legacyError(error.message, error.statusCode);
    }

    return legacyError(error instanceof Error ? error.message : "创建考试失败", 500);
  }
}
