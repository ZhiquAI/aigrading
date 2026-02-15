import { NextResponse } from "next/server";
import { getRequestId } from "@/shared/middleware/request-context";
import {
  licenseActivateRequestSchema,
  licenseActivateResponseSchema
} from "@ai-grading/api-contracts";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonApiError } from "@/shared/errors/api-error";
import {
  activateLicense,
  isLicenseDomainError
} from "@/modules/identity-license/license-service";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const rawBody = await request.json();
    const body = licenseActivateRequestSchema.parse(rawBody);

    const result = await activateLicense(prisma, {
      activationCode: body.activationCode,
      deviceId: body.deviceId ?? request.headers.get("x-device-id"),
      idempotencyKey: request.headers.get("idempotency-key")
    });

    const payload = licenseActivateResponseSchema.parse(result.payload);

    return NextResponse.json(payload, {
      status: result.statusCode,
      headers: {
        "x-request-id": requestId
      }
    });
  } catch (error) {
    if (isLicenseDomainError(error)) {
      return jsonApiError(requestId, error.code, error.message, error.statusCode);
    }

    const isBadRequest = error instanceof ZodError || error instanceof SyntaxError;
    return jsonApiError(
      requestId,
      isBadRequest ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
      error instanceof Error
        ? error.message
        : isBadRequest
          ? "Invalid activation request."
          : "Unexpected activation failure.",
      isBadRequest ? 400 : 500
    );
  }
}
