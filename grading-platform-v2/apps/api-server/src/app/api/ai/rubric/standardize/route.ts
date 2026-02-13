import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { rubricStandardizeRequestSchema } from "@ai-grading/api-contracts";
import { standardizeRubric } from "@/modules/rubric/rubric-service";

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
    const body = rubricStandardizeRequestSchema.parse(await request.json());
    const standardized = await standardizeRubric({
      rubric: body.rubric,
      maxScore: body.maxScore
    });

    return legacySuccess(standardized, "格式化成功");
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return legacyError(
        error instanceof Error ? error.message : "请求参数无效",
        "INVALID_REQUEST",
        400
      );
    }

    return legacyError("标准化评分细则失败", "INTERNAL_ERROR", 500);
  }
}
