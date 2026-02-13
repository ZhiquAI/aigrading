import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  apiErrorSchema,
  settingUpsertRequestSchema
} from "@ai-grading/api-contracts";
import { prisma } from "@/lib/prisma";
import {
  isScopeResolutionError,
  resolveRequestScope
} from "@/lib/request-scope";
import {
  deleteSetting,
  getSettings,
  upsertSetting
} from "@/modules/settings/settings-service";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

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
      message: error instanceof Error ? error.message : "Failed to get settings.",
      requestId
    });

    return NextResponse.json(
      {
        ok: false,
        error: errorPayload
      },
      {
        status: 500,
        headers: { "x-request-id": requestId }
      }
    );
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const body = settingUpsertRequestSchema.parse(await request.json());

    const data = await upsertSetting(prisma, {
      scopeKey: scope.scopeKey,
      key: body.key,
      value: body.value
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

    const isBadRequest = error instanceof ZodError || error instanceof SyntaxError;
    const errorPayload = apiErrorSchema.parse(
      isBadRequest
        ? {
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Invalid request body.",
            requestId
          }
        : {
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to save setting.",
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
    const key = new URL(request.url).searchParams.get("key")?.trim();

    if (!key) {
      const errorPayload = apiErrorSchema.parse({
        code: "BAD_REQUEST",
        message: "key is required.",
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

    await deleteSetting(prisma, scope.scopeKey, key);

    return NextResponse.json(
      {
        ok: true,
        data: null
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
      message: error instanceof Error ? error.message : "Failed to delete setting.",
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
