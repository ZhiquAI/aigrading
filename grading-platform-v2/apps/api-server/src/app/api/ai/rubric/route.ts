import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { rubricGenerateRequestSchema } from "@ai-grading/api-contracts";
import { generateRubricDraft } from "@/modules/rubric/rubric-service";

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
    const body = rubricGenerateRequestSchema.parse(await request.json());

    if (!body.answerText && !body.questionImage && !body.answerImage) {
      return legacyError("请提供图片或文本参考答案", "INVALID_REQUEST", 400);
    }

    const generated = generateRubricDraft({
      questionId: body.questionId,
      subject: body.subject,
      questionType: body.questionType,
      strategyType: body.strategyType,
      answerText: body.answerText,
      totalScore: body.totalScore
    });

    return legacySuccess(generated, "评分细则生成成功");
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return legacyError(
        error instanceof Error ? error.message : "请求参数无效",
        "INVALID_REQUEST",
        400
      );
    }

    return legacyError("评分细则生成失败", "INTERNAL_ERROR", 500);
  }
}
