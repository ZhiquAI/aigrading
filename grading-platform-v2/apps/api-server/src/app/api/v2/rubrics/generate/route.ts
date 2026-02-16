import { NextResponse } from "next/server";
import { getRequestId } from "@/shared/middleware/request-context";
import { ZodError } from "zod";
import { rubricGenerateRequestSchema } from "@ai-grading/api-contracts";
import { generateRubricDraft } from "@/modules/rubric/rubric-service";
import { jsonApiError } from "@/shared/errors/api-error";
import { prisma } from "@/lib/prisma";
import { resolveRequestScope } from "@/shared/scope-resolver/request-scope";
import { resolveAiGatewayRuntime } from "@/modules/settings/ai-runtime-service";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const scope = resolveRequestScope(request);
    const body = rubricGenerateRequestSchema.parse(await request.json());

    if (!body.answerText && !body.questionImage && !body.answerImage) {
      return jsonApiError(requestId, "BAD_REQUEST", "请提供图片或文本参考答案", 400);
    }

    const gatewayOverrides = await resolveAiGatewayRuntime(prisma, scope.scopeKey);

    const generated = await generateRubricDraft({
      questionId: body.questionId,
      subject: body.subject,
      questionType: body.questionType,
      strategyType: body.strategyType,
      answerText: body.answerText,
      totalScore: body.totalScore,
      questionImage: body.questionImage,
      answerImage: body.answerImage,
      gatewayOverrides
    });

    return NextResponse.json({ ok: true, data: generated }, {
      status: 200,
      headers: { "x-request-id": requestId }
    });
  } catch (error) {
    const isBadRequest = error instanceof ZodError || error instanceof SyntaxError;
    return jsonApiError(
      requestId,
      isBadRequest ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
      error instanceof Error
        ? error.message
        : isBadRequest
          ? "Invalid request body."
          : "Failed to generate rubric.",
      isBadRequest ? 400 : 500
    );
  }
}
