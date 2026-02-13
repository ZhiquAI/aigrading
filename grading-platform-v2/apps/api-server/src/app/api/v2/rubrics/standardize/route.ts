import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiErrorSchema, rubricUpsertRequestSchema } from "@ai-grading/api-contracts";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const body = rubricUpsertRequestSchema.parse(await request.json());
    const baseRubric =
      body.rubric && typeof body.rubric === "object"
        ? (body.rubric as Record<string, unknown>)
        : { content: body.rubric };

    const standardized = {
      ...baseRubric,
      version: "2.0",
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json({ ok: true, data: { rubric: standardized } }, {
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
