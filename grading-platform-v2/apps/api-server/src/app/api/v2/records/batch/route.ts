import { NextResponse } from "next/server";
import { getRequestId } from "@/shared/middleware/request-context";
import { ZodError } from "zod";
import {
  recordsBatchRequestSchema
} from "@ai-grading/api-contracts";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import {
  isScopeResolutionError,
  resolveRequestScope
} from "@/shared/scope-resolver/request-scope";
import {
  batchCreateRecords,
  isRecordDomainError
} from "@/modules/records/record-service";
import { jsonApiError } from "@/shared/errors/api-error";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const body = recordsBatchRequestSchema.parse(await request.json());

    const result = await batchCreateRecords(prisma, {
      scopeKey: scope.scopeKey,
      records: body.records,
      requestDeviceId: normalizeNonEmpty(request.headers.get("x-device-id")),
      idempotencyKey: normalizeNonEmpty(request.headers.get("idempotency-key"))
    });

    return NextResponse.json(
      {
        ok: true,
        data: result.payload
      },
      {
        status: result.statusCode,
        headers: { "x-request-id": requestId }
      }
    );
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return jsonApiError(requestId, error.code, error.message, error.statusCode);
    }

    if (isRecordDomainError(error)) {
      return jsonApiError(requestId, error.code, error.message, error.statusCode);
    }

    const isBadRequest = error instanceof ZodError || error instanceof SyntaxError;
    return jsonApiError(
      requestId,
      isBadRequest ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
      error instanceof Error
        ? error.message
        : isBadRequest
          ? "Invalid records payload."
          : "Failed to create records.",
      isBadRequest ? 400 : 500
    );
  }
}
