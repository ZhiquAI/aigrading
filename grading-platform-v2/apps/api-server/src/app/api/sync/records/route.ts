import { ZodError } from "zod";
import {
  recordsBatchRequestSchema
} from "@ai-grading/api-contracts";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import {
  isScopeResolutionError,
  resolveRequestScope
} from "@/lib/request-scope";
import { legacyError, legacySuccess } from "@/lib/legacy-api-response";
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

export async function GET(request: Request) {
  try {
    const scope = resolveRequestScope(request, { requireActivation: true });
    const searchParams = new URL(request.url).searchParams;

    const data = await listRecords(prisma, {
      scopeKey: scope.scopeKey,
      page: parsePage(searchParams.get("page")),
      limit: parseLimit(searchParams.get("limit")),
      questionNo: normalizeNonEmpty(searchParams.get("questionNo")) ?? undefined,
      questionKey: normalizeNonEmpty(searchParams.get("questionKey")) ?? undefined
    });

    return legacySuccess(data, "Success");
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.statusCode);
    }

    return legacyError(error instanceof Error ? error.message : "获取记录失败", 500);
  }
}

export async function POST(request: Request) {
  try {
    const scope = resolveRequestScope(request, { requireActivation: true });
    const body = recordsBatchRequestSchema.parse(await request.json());

    const result = await batchCreateRecords(prisma, {
      scopeKey: scope.scopeKey,
      records: body.records,
      requestDeviceId: normalizeNonEmpty(request.headers.get("x-device-id")),
      idempotencyKey: normalizeNonEmpty(request.headers.get("idempotency-key"))
    });

    return legacySuccess(
      {
        created: result.payload.created
      },
      `成功上传 ${result.payload.created} 条记录`,
      result.statusCode
    );
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.statusCode);
    }

    if (isRecordDomainError(error)) {
      return legacyError(error.message, error.statusCode);
    }

    if (error instanceof ZodError || error instanceof SyntaxError) {
      return legacyError("records 必须是非空数组", 400);
    }

    return legacyError(error instanceof Error ? error.message : "上传记录失败", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const scope = resolveRequestScope(request, { requireActivation: true });
    const searchParams = new URL(request.url).searchParams;
    const id = normalizeNonEmpty(searchParams.get("id")) ?? undefined;
    const questionNo = normalizeNonEmpty(searchParams.get("questionNo")) ?? undefined;
    const questionKey = normalizeNonEmpty(searchParams.get("questionKey")) ?? undefined;

    const result = await deleteRecords(prisma, {
      scopeKey: scope.scopeKey,
      id,
      questionNo,
      questionKey
    });

    if (id) {
      return legacySuccess(null, "记录已删除");
    }

    return legacySuccess(
      { deleted: result.deleted },
      `已删除 ${result.deleted} 条记录`
    );
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.statusCode);
    }

    if (isRecordDomainError(error)) {
      return legacyError(error.message, error.statusCode);
    }

    return legacyError(error instanceof Error ? error.message : "删除记录失败", 500);
  }
}
