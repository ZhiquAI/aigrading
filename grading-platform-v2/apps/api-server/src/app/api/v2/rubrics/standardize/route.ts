import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiErrorSchema, rubricStandardizeRequestSchema } from "@ai-grading/api-contracts";
import { standardizeRubric } from "@/modules/rubric/rubric-service";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

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
    const errorPayload = apiErrorSchema.parse(
      isBadRequest
        ? {
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Invalid rubric payload.",
            requestId
          }
        : {
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to standardize rubric.",
            requestId
          }
    );

    return NextResponse.json({ ok: false, error: errorPayload }, {
      status: isBadRequest ? 400 : 500,
      headers: { "x-request-id": requestId }
    });
  }
}
