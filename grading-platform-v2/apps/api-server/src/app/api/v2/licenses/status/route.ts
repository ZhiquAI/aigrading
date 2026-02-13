import { NextResponse } from "next/server";
import {
  apiErrorSchema,
  licenseStatusResponseSchema
} from "@ai-grading/api-contracts";
import { prisma } from "@/lib/prisma";
import { getLicenseStatus } from "@/modules/identity-license/license-service";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const statusData = await getLicenseStatus(prisma, {
      activationCode: request.headers.get("x-activation-code"),
      deviceId: request.headers.get("x-device-id")
    });

    const payload = licenseStatusResponseSchema.parse({
      ok: true,
      data: statusData
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "x-request-id": requestId
      }
    });
  } catch (error) {
    const errorPayload = apiErrorSchema.parse({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Failed to get license status.",
      requestId
    });

    return NextResponse.json(
      {
        ok: false,
        error: errorPayload
      },
      {
        status: 500,
        headers: {
          "x-request-id": requestId
        }
      }
    );
  }
}
