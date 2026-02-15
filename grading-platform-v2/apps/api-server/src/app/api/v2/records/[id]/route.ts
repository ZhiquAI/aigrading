import { NextResponse } from "next/server";
import { getRequestId } from "@/shared/middleware/request-context";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import {
  isScopeResolutionError,
  resolveRequestScope
} from "@/shared/scope-resolver/request-scope";
import { deleteRecords, isRecordDomainError } from "@/modules/records/record-service";
import { jsonApiError } from "@/shared/errors/api-error";

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const id = normalizeNonEmpty(context.params.id);

    if (!id) {
      return jsonApiError(requestId, "BAD_REQUEST", "record id is required.", 400);
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
      return jsonApiError(requestId, error.code, error.message, error.statusCode);
    }

    if (isRecordDomainError(error)) {
      return jsonApiError(requestId, error.code, error.message, error.statusCode);
    }

    return jsonApiError(
      requestId,
      "INTERNAL_SERVER_ERROR",
      error instanceof Error ? error.message : "Failed to delete record.",
      500
    );
  }
}
