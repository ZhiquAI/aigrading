import { NextResponse } from "next/server";
import { getRequestId } from "@/shared/middleware/request-context";
import { ZodError } from "zod";
import { rubricStandardizeRequestSchema } from "@ai-grading/api-contracts";
import { standardizeRubric } from "@/modules/rubric/rubric-service";
import { jsonApiError } from "@/shared/errors/api-error";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const body = rubricStandardizeRequestSchema.parse(await request.json());
    const standardized = await standardizeRubric({
      rubric: body.rubric,
      maxScore: body.maxScore
    });

    return NextResponse.json({ ok: true, data: standardized }, {
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
          ? "Invalid rubric payload."
          : "Failed to standardize rubric.",
      isBadRequest ? 400 : 500
    );
  }
}
