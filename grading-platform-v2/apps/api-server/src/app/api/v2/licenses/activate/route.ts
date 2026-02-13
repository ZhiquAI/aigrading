import { NextResponse } from "next/server";
import {
  apiErrorSchema,
  licenseActivateRequestSchema,
  licenseActivateResponseSchema
} from "@ai-grading/api-contracts";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  activateLicense,
  isLicenseDomainError
} from "@/modules/identity-license/license-service";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

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
      const errorPayload = apiErrorSchema.parse({
        code: error.code,
        message: error.message,
        requestId
      });

      return NextResponse.json(
        {
          ok: false,
          error: errorPayload
        },
        {
          status: error.statusCode,
          headers: {
            "x-request-id": requestId
          }
        }
      );
    }

    const isBadRequest = error instanceof ZodError || error instanceof SyntaxError;

    const errorPayload = apiErrorSchema.parse(
      isBadRequest
        ? {
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Invalid activation request.",
            requestId
          }
        : {
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Unexpected activation failure.",
            requestId
          }
    );

    return NextResponse.json(
      {
        ok: false,
        error: errorPayload
      },
      {
        status: isBadRequest ? 400 : 500,
        headers: {
          "x-request-id": requestId
        }
      }
    );
  }
}
