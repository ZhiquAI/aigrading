import type { PrismaClient } from "@prisma/client";
import type { AiGatewayRequest, AiGatewayRuntimeConfig } from "@ai-grading/ai-gateway";
import { normalizeNonEmpty } from "@ai-grading/domain-core";

export type ModelProviderSetting = "openrouter" | "openai" | "gemini" | "zhipu" | "dashscope";

type ModelSettingKey = "model.provider" | "model.endpoint" | "model.name" | "model.apiKey";

const MODEL_SETTING_KEYS: readonly ModelSettingKey[] = [
  "model.provider",
  "model.endpoint",
  "model.name",
  "model.apiKey"
];

const DEFAULT_OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_ZHIPU_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";
const DEFAULT_ZHIPU_MODEL = "glm-4-flash";

const parseStoredValue = (rawValue: string): unknown => {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return rawValue;
  }
};

const toSettingString = (rawValue: string): string | undefined => {
  const parsedValue = parseStoredValue(rawValue);

  if (typeof parsedValue === "string") {
    return normalizeNonEmpty(parsedValue);
  }

  if (typeof parsedValue === "number" || typeof parsedValue === "boolean") {
    return String(parsedValue);
  }

  return undefined;
};

const isProviderSetting = (value: string): value is ModelProviderSetting => {
  return ["openrouter", "openai", "gemini", "zhipu", "dashscope"].includes(value);
};

const getOpenrouterModelByTask = (task: "rubric_generate" | "grading_evaluate"): string => {
  if (task === "rubric_generate") {
    return process.env.OPENROUTER_MODEL_RUBRIC ?? process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
  }

  return process.env.OPENROUTER_MODEL_GRADING ?? process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
};

const getZhipuModelByTask = (task: "rubric_generate" | "grading_evaluate"): string => {
  if (task === "rubric_generate") {
    return process.env.ZHIPU_MODEL_RUBRIC ?? process.env.ZHIPU_MODEL ?? DEFAULT_ZHIPU_MODEL;
  }

  return process.env.ZHIPU_MODEL_GRADING ?? process.env.ZHIPU_MODEL ?? DEFAULT_ZHIPU_MODEL;
};

export type AiGatewayOverrides = Pick<AiGatewayRequest, "preferredProviders" | "runtime">;

export type AiRuntimeInput = {
  provider?: string | null;
  endpoint?: string | null;
  modelName?: string | null;
  apiKey?: string | null;
};

export const resolveAiGatewayRuntimeFromInput = (
  input: AiRuntimeInput
): AiGatewayOverrides | undefined => {
  const providerRaw = normalizeNonEmpty(input.provider ?? "");
  const endpoint = normalizeNonEmpty(input.endpoint ?? "");
  const modelName = normalizeNonEmpty(input.modelName ?? "");
  const apiKey = normalizeNonEmpty(input.apiKey ?? "");

  const providerSetting = providerRaw && isProviderSetting(providerRaw) ? providerRaw : undefined;
  const mappedProvider = providerSetting === "zhipu" ? "zhipu" : "openrouter";

  const hasAnyOverride = Boolean(providerSetting || endpoint || modelName || apiKey);
  if (!hasAnyOverride) {
    return undefined;
  }

  if (mappedProvider === "zhipu") {
    return {
      preferredProviders: ["zhipu"],
      runtime: {
        zhipu: {
          apiKey: apiKey ?? process.env.ZHIPU_API_KEY,
          endpoint: endpoint ?? process.env.ZHIPU_BASE_URL ?? DEFAULT_ZHIPU_ENDPOINT,
          models: {
            rubric_generate: modelName ?? getZhipuModelByTask("rubric_generate"),
            grading_evaluate: modelName ?? getZhipuModelByTask("grading_evaluate")
          }
        }
      } satisfies Partial<AiGatewayRuntimeConfig>
    };
  }

  return {
    preferredProviders: ["openrouter"],
    runtime: {
      openrouter: {
        apiKey: apiKey ?? process.env.OPENROUTER_API_KEY ?? process.env.OPENROUTER_KEY,
        endpoint: endpoint ?? process.env.OPENROUTER_BASE_URL ?? DEFAULT_OPENROUTER_ENDPOINT,
        models: {
          rubric_generate: modelName ?? getOpenrouterModelByTask("rubric_generate"),
          grading_evaluate: modelName ?? getOpenrouterModelByTask("grading_evaluate")
        }
      }
    } satisfies Partial<AiGatewayRuntimeConfig>
  };
};

export const resolveAiGatewayRuntime = async (
  db: PrismaClient,
  scopeKey: string
): Promise<AiGatewayOverrides | undefined> => {
  const entries = await db.settingEntry.findMany({
    where: {
      scopeKey,
      key: {
        in: [...MODEL_SETTING_KEYS]
      }
    },
    select: {
      key: true,
      value: true
    }
  });

  if (entries.length === 0) {
    return undefined;
  }

  const valueByKey = new Map<ModelSettingKey, string>();
  for (const entry of entries) {
    if (MODEL_SETTING_KEYS.includes(entry.key as ModelSettingKey)) {
      valueByKey.set(entry.key as ModelSettingKey, entry.value);
    }
  }

  const providerRaw = toSettingString(valueByKey.get("model.provider") ?? "");
  const endpoint = toSettingString(valueByKey.get("model.endpoint") ?? "");
  const modelName = toSettingString(valueByKey.get("model.name") ?? "");
  const apiKey = toSettingString(valueByKey.get("model.apiKey") ?? "");

  return resolveAiGatewayRuntimeFromInput({
    provider: providerRaw,
    endpoint,
    modelName,
    apiKey
  });
};
