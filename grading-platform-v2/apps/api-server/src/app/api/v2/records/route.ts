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
  deleteRecords,
  isRecordDomainError,
  listRecords
} from "@/modules/records/record-service";

const parsePage = (raw: string | null): number => {
  const value = Number(raw ?? "1");
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
};

const parseLimit = (raw: string | null): number => {
  const value = Number(raw ?? "50");
  if (!Number.isFinite(value) || value < 1) {
    return 50;
  }
  return Math.min(Math.floor(value), 100);
};

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const searchParams = new URL(request.url).searchParams;

    const data = await listRecords(prisma, {
      scopeKey: scope.scopeKey,
      page: parsePage(searchParams.get("page")),
      limit: parseLimit(searchParams.get("limit")),
      questionNo: normalizeNonEmpty(searchParams.get("questionNo")),
      questionKey: normalizeNonEmpty(searchParams.get("questionKey"))
    });

    return NextResponse.json(
      {
        ok: true,
        data
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

    const errorPayload = apiErrorSchema.parse({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Failed to get records.",
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

export async function DELETE(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const searchParams = new URL(request.url).searchParams;

    const result = await deleteRecords(prisma, {
      scopeKey: scope.scopeKey,
      id: normalizeNonEmpty(searchParams.get("id")),
      questionNo: normalizeNonEmpty(searchParams.get("questionNo")),
      questionKey: normalizeNonEmpty(searchParams.get("questionKey"))
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
      message: error instanceof Error ? error.message : "Failed to delete records.",
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
