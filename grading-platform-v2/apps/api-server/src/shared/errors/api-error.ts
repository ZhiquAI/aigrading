import { NextResponse } from "next/server";
import { apiErrorSchema } from "@ai-grading/api-contracts";

export const jsonApiError = (
  requestId: string,
  code: string,
  message: string,
  status: number
): NextResponse => {
  const payload = apiErrorSchema.parse({ code, message, requestId });
  return NextResponse.json(
    { ok: false, error: payload },
    {
      status,
      headers: { "x-request-id": requestId }
    }
  );
};
