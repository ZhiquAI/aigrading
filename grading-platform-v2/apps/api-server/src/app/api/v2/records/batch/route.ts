import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  apiErrorSchema,
  recordsBatchRequestSchema
} from "@ai-grading/api-contracts";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import {
  isScopeResolutionError,
  resolveRequestScope
} from "@/lib/request-scope";
import {
  batchCreateRecords,
  isRecordDomainError
} from "@/modules/records/record-service";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

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
      const errorPayload = apiErrorSchema.parse({
        code: error.code,
        message: error.message,
        requestId
      });

      return NextResponse.json(
        { ok: false, error: errorPayload },
        {
          status: error.statusCode,
          headers: { "x-request-id": requestId }
        }
      );
    }

    if (isRecordDomainError(error)) {
      const errorPayload = apiErrorSchema.parse({
        code: error.code,
        message: error.message,
        requestId
      });

      return NextResponse.json(
        { ok: false, error: errorPayload },
        {
          status: error.statusCode,
          headers: { "x-request-id": requestId }
        }
      );
    }

    const isBadRequest = error instanceof ZodError || error instanceof SyntaxError;
    const errorPayload = apiErrorSchema.parse(
      isBadRequest
        ? {
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Invalid records payload.",
            requestId
          }
        : {
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to create records.",
            requestId
          }
    );

    return NextResponse.json(
      { ok: false, error: errorPayload },
      {
        status: isBadRequest ? 400 : 500,
        headers: { "x-request-id": requestId }
      }
    );
  }
}
