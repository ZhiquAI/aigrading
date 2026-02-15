import { NextResponse } from "next/server";
import { getRequestId } from "@/shared/middleware/request-context";
import { ZodError } from "zod";
import {
  settingUpsertRequestSchema
} from "@ai-grading/api-contracts";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import {
  isScopeResolutionError,
  resolveRequestScope
} from "@/shared/scope-resolver/request-scope";
import {
  executeIdempotent,
  isIdempotencyConflictError
} from "@/shared/idempotency/service";
import {
  deleteSetting,
  getSettings,
  upsertSetting
} from "@/modules/settings/settings-service";
import { jsonApiError } from "@/shared/errors/api-error";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const key = new URL(request.url).searchParams.get("key")?.trim() || undefined;

    const data = await getSettings(prisma, scope.scopeKey, key);

    return NextResponse.json(
      {
        ok: true,
        data
      },
      {
        status: 200,
        headers: {
          "x-request-id": requestId
        }
      }
    );
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return jsonApiError(requestId, error.code, error.message, error.statusCode);
    }

    return jsonApiError(
      requestId,
      "INTERNAL_SERVER_ERROR",
      error instanceof Error ? error.message : "Failed to get settings.",
      500
    );
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const body = settingUpsertRequestSchema.parse(await request.json());
    const idempotencyKey = normalizeNonEmpty(request.headers.get("idempotency-key"));

    const result = await executeIdempotent(prisma, {
      scopeKey: scope.scopeKey,
      endpoint: "v2.settings.put",
      idempotencyKey,
      requestPayload: body
    }, async () => {
      const data = await upsertSetting(prisma, {
        scopeKey: scope.scopeKey,
        key: body.key,
        value: body.value
      });

      return {
        statusCode: 200,
        payload: data
      };
    });

    return NextResponse.json(
      {
        ok: true,
        data: result.payload
      },
      {
        status: result.statusCode,
        headers: {
          "x-request-id": requestId,
          ...(result.replayed ? { "x-idempotency-replayed": "true" } : {})
        }
      }
    );
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return jsonApiError(requestId, error.code, error.message, error.statusCode);
    }

    if (isIdempotencyConflictError(error)) {
      return jsonApiError(requestId, "IDEMPOTENCY_CONFLICT", error.message, 409);
    }

    const isBadRequest = error instanceof ZodError || error instanceof SyntaxError;
    return jsonApiError(
      requestId,
      isBadRequest ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
      error instanceof Error
        ? error.message
        : isBadRequest
          ? "Invalid request body."
          : "Failed to save setting.",
      isBadRequest ? 400 : 500
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const key = new URL(request.url).searchParams.get("key")?.trim();
    const idempotencyKey = normalizeNonEmpty(request.headers.get("idempotency-key"));

    if (!key) {
      return jsonApiError(requestId, "BAD_REQUEST", "key is required.", 400);
    }

    const result = await executeIdempotent(prisma, {
      scopeKey: scope.scopeKey,
      endpoint: "v2.settings.delete",
      idempotencyKey,
      requestPayload: { key }
    }, async () => {
      await deleteSetting(prisma, scope.scopeKey, key);

      return {
        statusCode: 200,
        payload: null as null
      };
    });

    return NextResponse.json(
      {
        ok: true,
        data: result.payload
      },
      {
        status: result.statusCode,
        headers: {
          "x-request-id": requestId,
          ...(result.replayed ? { "x-idempotency-replayed": "true" } : {})
        }
      }
    );
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return jsonApiError(requestId, error.code, error.message, error.statusCode);
    }

    if (isIdempotencyConflictError(error)) {
      return jsonApiError(requestId, "IDEMPOTENCY_CONFLICT", error.message, 409);
    }

    return jsonApiError(
      requestId,
      "INTERNAL_SERVER_ERROR",
      error instanceof Error ? error.message : "Failed to delete setting.",
      500
    );
  }
}
