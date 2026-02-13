import { NextResponse } from "next/server";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import {
  isScopeResolutionError,
  resolveRequestScope
} from "@/lib/request-scope";
import {
  deleteRubric,
  getRubricByQuestionKey,
  isRubricDomainError,
  listRubrics,
  upsertRubric
} from "@/modules/rubric/rubric-service";

type LegacyErrorPayload = {
  success: false;
  error: string;
  code: string;
  details?: string[];
};

const legacyError = (
  error: string,
  code = "INTERNAL_ERROR",
  status = 400,
  details?: string[]
): NextResponse => {
  const payload: LegacyErrorPayload = {
    success: false,
    error,
    code,
    ...(details ? { details } : {})
  };

  return NextResponse.json(payload, { status });
};

const inferQuestionKeyFromRubric = (rubric: unknown): string | undefined => {
  if (!rubric || typeof rubric !== "object") {
    return undefined;
  }

  const obj = rubric as {
    metadata?: { questionId?: unknown };
    questionKey?: unknown;
    questionId?: unknown;
  };

  if (typeof obj.metadata?.questionId === "string" && obj.metadata.questionId.trim().length > 0) {
    return obj.metadata.questionId.trim();
  }

  if (typeof obj.questionKey === "string" && obj.questionKey.trim().length > 0) {
    return obj.questionKey.trim();
  }

  if (typeof obj.questionId === "string" && obj.questionId.trim().length > 0) {
    return obj.questionId.trim();
  }

  return undefined;
};

const parseUpdatedAtMs = (rubric: unknown): number | null => {
  if (!rubric || typeof rubric !== "object") {
    return null;
  }

  const updatedAt = (rubric as { updatedAt?: unknown }).updatedAt;
  if (typeof updatedAt !== "string") {
    return null;
  }

  const timestamp = new Date(updatedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const parseLegacyUpsertBody = async (request: Request): Promise<{
  rubric: unknown;
  questionKey?: string;
  examId?: string | null;
  lifecycleStatus?: string;
}> => {
  const body = (await request.json()) as unknown;

  if (!body || typeof body !== "object") {
    throw new Error("无效的请求体");
  }

  const bodyObj = body as {
    rubric?: unknown;
    questionKey?: unknown;
    examId?: unknown;
    lifecycleStatus?: unknown;
  };

  let rubricPayload = bodyObj.rubric ?? body;

  if (typeof rubricPayload === "string") {
    try {
      rubricPayload = JSON.parse(rubricPayload);
    } catch {
      throw new Error("无效的 JSON 字符串");
    }
  }

  return {
    rubric: rubricPayload,
    questionKey: normalizeNonEmpty(
      typeof bodyObj.questionKey === "string" ? bodyObj.questionKey : undefined
    ),
    examId:
      bodyObj.examId === null
        ? null
        : normalizeNonEmpty(typeof bodyObj.examId === "string" ? bodyObj.examId : undefined),
    lifecycleStatus:
      typeof bodyObj.lifecycleStatus === "string" ? bodyObj.lifecycleStatus : undefined
  };
};

export async function GET(request: Request): Promise<NextResponse> {
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

      if (!item) {
        return NextResponse.json({
          success: true,
          rubric: null,
          message: "评分细则不存在"
        });
      }

      return NextResponse.json({
        success: true,
        rubric: item.rubric,
        lifecycleStatus: item.lifecycleStatus
      });
    }

    const rubrics = await listRubrics(prisma, {
      scopeKey: scope.scopeKey,
      examId: examId ?? undefined
    });

    return NextResponse.json({
      success: true,
      rubrics,
      skippedInvalid: 0
    });
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.code, error.statusCode);
    }

    return legacyError(
      error instanceof Error ? error.message : "获取评分细则失败",
      "INTERNAL_ERROR",
      500
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const body = await parseLegacyUpsertBody(request);

    const questionKey = body.questionKey ?? inferQuestionKeyFromRubric(body.rubric);
    if (questionKey) {
      const serverItem = await getRubricByQuestionKey(prisma, {
        scopeKey: scope.scopeKey,
        questionKey
      });

      if (serverItem) {
        const serverUpdated = parseUpdatedAtMs(serverItem.rubric);
        const clientUpdated = parseUpdatedAtMs(body.rubric);

        if (
          serverUpdated !== null &&
          clientUpdated !== null &&
          serverUpdated > clientUpdated
        ) {
          return NextResponse.json(
            {
              success: false,
              error: "conflict",
              code: "CONFLICT",
              serverRubric: serverItem.rubric,
              clientRubric: body.rubric
            },
            { status: 409 }
          );
        }
      }
    }

    const result = await upsertRubric(prisma, {
      scopeKey: scope.scopeKey,
      questionKey,
      rubric: body.rubric,
      examId: body.examId,
      lifecycleStatus: body.lifecycleStatus,
      deviceId: scope.deviceId
    });

    return NextResponse.json({
      success: true,
      rubric: result.rubric,
      examId: result.examId,
      lifecycleStatus: result.lifecycleStatus
    });
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.code, error.statusCode);
    }

    if (isRubricDomainError(error)) {
      return legacyError(error.message, error.code, error.statusCode);
    }

    return legacyError(
      error instanceof Error ? error.message : "保存评分细则失败",
      "INTERNAL_ERROR",
      500
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const questionKey = normalizeNonEmpty(new URL(request.url).searchParams.get("questionKey"));

    if (!questionKey) {
      return legacyError("缺少必填参数（需要questionKey）", "INVALID_REQUEST", 400);
    }

    const existing = await getRubricByQuestionKey(prisma, {
      scopeKey: scope.scopeKey,
      questionKey
    });

    if (!existing) {
      return legacyError("评分细则不存在", "NOT_FOUND", 404);
    }

    await deleteRubric(prisma, { scopeKey: scope.scopeKey, questionKey });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.code, error.statusCode);
    }

    return legacyError(
      error instanceof Error ? error.message : "删除评分细则失败",
      "INTERNAL_ERROR",
      500
    );
  }
}
