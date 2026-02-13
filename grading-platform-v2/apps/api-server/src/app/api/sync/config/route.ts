import { ZodError } from "zod";
import {
  settingUpsertRequestSchema
} from "@ai-grading/api-contracts";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import { prisma } from "@/lib/prisma";
import {
  isScopeResolutionError,
  resolveRequestScope
} from "@/lib/request-scope";
import { legacyError, legacySuccess } from "@/lib/legacy-api-response";
import {
  deleteSetting,
  getSettings,
  upsertSetting
} from "@/modules/settings/settings-service";

export async function GET(request: Request) {
  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const key = normalizeNonEmpty(new URL(request.url).searchParams.get("key"));

    const result = await getSettings(prisma, scope.scopeKey, key);

    if (key && !result) {
      return legacySuccess(null, "配置不存在");
    }

    return legacySuccess(result, "Success");
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.statusCode);
    }

    return legacyError(error instanceof Error ? error.message : "获取配置失败", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const body = settingUpsertRequestSchema.parse(await request.json());

    const result = await upsertSetting(prisma, {
      scopeKey: scope.scopeKey,
      key: body.key,
      value: body.value
    });

    return legacySuccess(result, "配置已保存");
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.statusCode);
    }

    if (error instanceof ZodError || error instanceof SyntaxError) {
      return legacyError("key 和 value 为必填项", 400);
    }

    return legacyError(error instanceof Error ? error.message : "保存配置失败", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const scope = resolveRequestScope(request, { requireIdentity: true });
    const key = normalizeNonEmpty(new URL(request.url).searchParams.get("key"));

    if (!key) {
      return legacyError("请指定要删除的配置 key", 400);
    }

    await deleteSetting(prisma, scope.scopeKey, key);
    return legacySuccess(null, "配置已删除");
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return legacyError(error.message, error.statusCode);
    }

    return legacyError(error instanceof Error ? error.message : "删除配置失败", 500);
  }
}
