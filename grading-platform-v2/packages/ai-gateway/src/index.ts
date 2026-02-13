export type AiProvider = "openrouter" | "zhipu";
export type AiGatewayTask = "rubric_generate" | "grading_evaluate";

export type AiGatewayImageInput = {
  base64: string;
  label?: string;
  mimeType?: string;
};

export type AiGatewayRequest = {
  task: AiGatewayTask;
  systemPrompt: string;
  userPrompt: string;
  images?: AiGatewayImageInput[];
  preferredProviders?: AiProvider[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  runtime?: Partial<AiGatewayRuntimeConfig>;
};

export type AiGatewayResult = {
  provider: AiProvider;
  model: string;
  rawText: string;
  json: Record<string, unknown>;
};

type ProviderTaskModelConfig = {
  rubric_generate: string;
  grading_evaluate: string;
};

type ProviderConfig = {
  apiKey?: string;
  endpoint: string;
  models: ProviderTaskModelConfig;
};

type ProviderPlan = {
  provider: AiProvider;
  config: ProviderConfig;
};

export type AiGatewayRuntimeConfig = {
  openrouter: ProviderConfig;
  zhipu: ProviderConfig;
};

export type AiProviderAttempt = {
  provider: AiProvider;
  message: string;
};

const DEFAULT_PROVIDER_ORDER: AiProvider[] = ["openrouter", "zhipu"];

const DEFAULT_RUNTIME_CONFIG = (): AiGatewayRuntimeConfig => {
  return {
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY ?? process.env.OPENROUTER_KEY,
      endpoint: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1/chat/completions",
      models: {
        rubric_generate:
          process.env.OPENROUTER_MODEL_RUBRIC ??
          process.env.OPENROUTER_MODEL ??
          "openai/gpt-4o-mini",
        grading_evaluate:
          process.env.OPENROUTER_MODEL_GRADING ??
          process.env.OPENROUTER_MODEL ??
          "openai/gpt-4o-mini"
      }
    },
    zhipu: {
      apiKey: process.env.ZHIPU_API_KEY,
      endpoint: process.env.ZHIPU_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      models: {
        rubric_generate: process.env.ZHIPU_MODEL_RUBRIC ?? process.env.ZHIPU_MODEL ?? "glm-4-flash",
        grading_evaluate: process.env.ZHIPU_MODEL_GRADING ?? process.env.ZHIPU_MODEL ?? "glm-4-flash"
      }
    }
  };
};

const toDataUrl = (image: AiGatewayImageInput): string => {
  if (image.base64.startsWith("data:")) {
    return image.base64;
  }
  const mimeType = image.mimeType ?? "image/jpeg";
  return `data:${mimeType};base64,${image.base64}`;
};

const buildUserContent = (
  userPrompt: string,
  images: AiGatewayImageInput[] | undefined
): Array<
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
> => {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: userPrompt }];

  for (const image of images ?? []) {
    if (image.label) {
      content.push({ type: "text", text: image.label });
    }

    content.push({
      type: "image_url",
      image_url: { url: toDataUrl(image) }
    });
  }

  return content;
};

const parseMessageText = (responseJson: unknown): string => {
  const root = responseJson as {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  };

  const firstContent = root.choices?.[0]?.message?.content;
  if (typeof firstContent === "string") {
    return firstContent;
  }

  if (Array.isArray(firstContent)) {
    return firstContent
      .map((chunk) => {
        if (!chunk || typeof chunk !== "object") {
          return "";
        }
        const text = (chunk as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      })
      .join("\n")
      .trim();
  }

  return "";
};

const parseJsonFromText = (text: string): Record<string, unknown> => {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("LLM 返回为空");
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Try to recover from markdown code blocks or extra text.
  }

  const markdownCodeMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonCandidate = markdownCodeMatch?.[1] ?? trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonCandidate) {
    throw new Error("未找到有效 JSON");
  }

  const parsed = JSON.parse(jsonCandidate) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON 根节点必须是对象");
  }

  return parsed as Record<string, unknown>;
};

const callProvider = async (
  plan: ProviderPlan,
  input: AiGatewayRequest
): Promise<AiGatewayResult> => {
  if (!plan.config.apiKey) {
    throw new Error(`${plan.provider} API key 未配置`);
  }

  const model = plan.config.models[input.task];
  const timeoutMs = Math.max(1_000, input.timeoutMs ?? 30_000);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(plan.config.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${plan.config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: input.systemPrompt },
          {
            role: "user",
            content: buildUserContent(input.userPrompt, input.images)
          }
        ],
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 2048,
        response_format: { type: "json_object" }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${plan.provider} 调用失败: ${response.status} ${body.slice(0, 200)}`);
    }

    const responseJson = (await response.json()) as unknown;
    const rawText = parseMessageText(responseJson);
    const json = parseJsonFromText(rawText);

    return {
      provider: plan.provider,
      model,
      rawText,
      json
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const resolveProviderPlans = (input: AiGatewayRequest): ProviderPlan[] => {
  const runtimeConfig = {
    ...DEFAULT_RUNTIME_CONFIG(),
    ...(input.runtime ?? {})
  };

  const order = input.preferredProviders?.length
    ? input.preferredProviders
    : DEFAULT_PROVIDER_ORDER;

  const plans: ProviderPlan[] = [];
  for (const provider of order) {
    const config = runtimeConfig[provider];
    if (!config) {
      continue;
    }

    plans.push({
      provider,
      config
    });
  }

  return plans;
};

export class AiGatewayError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly attempts: AiProviderAttempt[]
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

export const isAiGatewayError = (error: unknown): error is AiGatewayError => {
  return error instanceof AiGatewayError;
};

export const callAiGatewayJson = async (input: AiGatewayRequest): Promise<AiGatewayResult> => {
  const plans = resolveProviderPlans(input);
  if (plans.length === 0) {
    throw new AiGatewayError("NO_PROVIDER_AVAILABLE", "未找到可用 AI 提供方配置", []);
  }

  const attempts: AiProviderAttempt[] = [];

  for (const plan of plans) {
    try {
      return await callProvider(plan, input);
    } catch (error) {
      attempts.push({
        provider: plan.provider,
        message: error instanceof Error ? error.message : "Unknown provider error."
      });
    }
  }

  throw new AiGatewayError(
    "ALL_PROVIDERS_FAILED",
    "所有 AI 提供方调用失败",
    attempts
  );
};
