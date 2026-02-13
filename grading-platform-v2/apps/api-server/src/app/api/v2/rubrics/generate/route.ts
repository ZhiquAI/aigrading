import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiErrorSchema, rubricGenerateRequestSchema } from "@ai-grading/api-contracts";
import { generateRubricDraft } from "@/modules/rubric/rubric-service";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const body = rubricGenerateRequestSchema.parse(await request.json());

    if (!body.answerText && !body.questionImage && !body.answerImage) {
      const errorPayload = apiErrorSchema.parse({
        code: "BAD_REQUEST",
        message: "请提供图片或文本参考答案",
        requestId
      });

      return NextResponse.json({ ok: false, error: errorPayload }, {
        status: 400,
        headers: { "x-request-id": requestId }
      });
    }

    const generated = await generateRubricDraft({
      questionId: body.questionId,
      subject: body.subject,
      questionType: body.questionType,
      strategyType: body.strategyType,
      answerText: body.answerText,
      totalScore: body.totalScore,
      questionImage: body.questionImage,
      answerImage: body.answerImage
    });

    return NextResponse.json({ ok: true, data: generated }, {
      status: 200,
      headers: { "x-request-id": requestId }
    });
  } catch (error) {
    const isBadRequest = error instanceof ZodError || error instanceof SyntaxError;
    const errorPayload = apiErrorSchema.parse(
      isBadRequest
        ? {
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Invalid request body.",
            requestId
          }
        : {
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to generate rubric.",
            requestId
          }
    );

    return NextResponse.json(
      { ok: false, error: errorPayload },
      {
        status: isBadRequest ? 400 : 500,
        headers: { "x-request-id": requestId }
      }
    );
  }
}
