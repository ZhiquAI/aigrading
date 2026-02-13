import { NextResponse } from "next/server";
import { apiErrorSchema } from "@ai-grading/api-contracts";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import {
  isScopeResolutionError,
  resolveRequestScope
} from "@/lib/request-scope";
import { deleteRecords, isRecordDomainError } from "@/modules/records/record-service";

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const id = normalizeNonEmpty(context.params.id);

    if (!id) {
      const errorPayload = apiErrorSchema.parse({
        code: "BAD_REQUEST",
        message: "record id is required.",
        requestId
      });

      return NextResponse.json(
        { ok: false, error: errorPayload },
        {
          status: 400,
          headers: { "x-request-id": requestId }
        }
      );
    }

    const result = await deleteRecords(prisma, {
      scopeKey: scope.scopeKey,
      id
    });

    return NextResponse.json(
      {
        ok: true,
        data: result
      },
      {
        status: 200,
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

    const errorPayload = apiErrorSchema.parse({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Failed to delete record.",
      requestId
    });

    return NextResponse.json(
      { ok: false, error: errorPayload },
      {
        status: 500,
        headers: { "x-request-id": requestId }
      }
    );
  }
}
