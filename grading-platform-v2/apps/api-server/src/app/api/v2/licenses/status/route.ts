import { NextResponse } from "next/server";
import { getRequestId } from "@/shared/middleware/request-context";
import {
  licenseStatusResponseSchema
} from "@ai-grading/api-contracts";
import { prisma } from "@/lib/prisma";
import { getLicenseStatus } from "@/modules/identity-license/license-service";
import { jsonApiError } from "@/shared/errors/api-error";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

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
    return jsonApiError(
      requestId,
      "INTERNAL_SERVER_ERROR",
      error instanceof Error ? error.message : "Failed to get license status.",
      500
    );
  }
}
