import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { callAiGatewayJson, isAiGatewayError } from "@ai-grading/ai-gateway";
import { modelConnectionTestRequestSchema } from "@ai-grading/api-contracts";
import { getRequestId } from "@/shared/middleware/request-context";
import { jsonApiError } from "@/shared/errors/api-error";
import { prisma } from "@/lib/prisma";
import {
  isScopeResolutionError,
  resolveRequestScope
} from "@/shared/scope-resolver/request-scope";
import {
  resolveAiGatewayRuntime,
  resolveAiGatewayRuntimeFromInput
} from "@/modules/settings/ai-runtime-service";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const identity = resolveRequestScope(request, { requireIdentity: true });
    const body = modelConnectionTestRequestSchema.parse(await request.json());

    const runtimeOverrides =
      resolveAiGatewayRuntimeFromInput({
        provider: body.provider,
        endpoint: body.endpoint,
        modelName: body.modelName,
        apiKey: body.apiKey
      }) ?? (await resolveAiGatewayRuntime(prisma, identity.scopeKey));

    if (!runtimeOverrides) {
      return jsonApiError(requestId, "BAD_REQUEST", "未找到可用模型配置，请先填写模型参数。", 400);
    }

    try {
      const result = await callAiGatewayJson({
        task: "rubric_generate",
        systemPrompt: "你是连接测试助手。必须输出 JSON 对象。",
        userPrompt: "请返回 {\"ok\": true, \"message\": \"pong\"}。",
        preferredProviders: runtimeOverrides.preferredProviders,
        runtime: runtimeOverrides.runtime,
        temperature: 0,
        maxTokens: 80,
        timeoutMs: 12_000
      });

      return NextResponse.json(
        {
          ok: true,
          data: {
            connected: true,
            provider: `${result.provider}:${result.model}`
          }
        },
        {
          status: 200,
          headers: { "x-request-id": requestId }
        }
      );
    } catch (error) {
      if (isAiGatewayError(error)) {
        return NextResponse.json(
          {
            ok: true,
            data: {
              connected: false,
              reason: error.code,
              attempts: error.attempts
            }
          },
          {
            status: 200,
            headers: { "x-request-id": requestId }
          }
        );
      }

      throw error;
    }
  } catch (error) {
    if (isScopeResolutionError(error)) {
      return jsonApiError(requestId, error.code, error.message, error.statusCode);
    }

    const isBadRequest = error instanceof ZodError || error instanceof SyntaxError;
    return jsonApiError(
      requestId,
      isBadRequest ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
      error instanceof Error
        ? error.message
        : isBadRequest
          ? "Invalid request body."
          : "Failed to test model connection.",
      isBadRequest ? 400 : 500
    );
  }
}
