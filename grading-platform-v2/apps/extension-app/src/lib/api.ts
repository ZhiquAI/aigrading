import { getActivationCode, getDeviceId } from "./device";
import type { GradingResult } from "@ai-grading/domain-core";

const FALLBACK_API_BASE_URLS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:3001",
  "http://localhost:3001"
] as const;

const normalizeApiBaseUrl = (value: string): string => value.trim().replace(/\/+$/, "");

const resolveApiBaseUrls = (): string[] => {
  const envValue = typeof import.meta.env.VITE_API_BASE_URL === "string"
    ? import.meta.env.VITE_API_BASE_URL
    : "";

  const candidates = [
    ...envValue
      .split(",")
      .map((value) => normalizeApiBaseUrl(value))
      .filter((value) => value.length > 0),
    ...FALLBACK_API_BASE_URLS
  ];

  return [...new Set(candidates)];
};

const API_BASE_URLS = resolveApiBaseUrls();

type ApiOk<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error?: { code?: string; message?: string };
};

type ApiResponse<T> = ApiOk<T> | ApiError;

export type LicenseStatusData = {
  identity: {
    scopeKey: string;
    scopeType: "activation" | "device" | "anonymous";
    activationCode?: string;
    deviceId?: string;
  };
  licenseStatus: "active" | "unactivated" | "invalid" | "disabled" | "expired" | "device_limit_reached";
  remainingQuota?: number;
  maxDevices?: number;
};

export type LicenseActivateData = {
  identity: {
    scopeKey: string;
    scopeType: "activation" | "device" | "anonymous";
    activationCode?: string;
    deviceId?: string;
  };
  activated: boolean;
  alreadyBound: boolean;
  remainingQuota: number;
  maxDevices: number;
};

export type SettingEntryDTO = {
  key: string;
  value: string;
  updatedAt: string;
};

export type ModelProviderDTO = "openrouter" | "openai" | "gemini" | "zhipu" | "dashscope";

export type ModelConnectionTestResultDTO = {
  connected: boolean;
  provider?: string;
  reason?: string;
  attempts?: Array<{
    provider: string;
    message: string;
  }>;
};

export type HealthStatusDTO = {
  status: "ok" | "error";
  timestamp: string;
  uptimeSeconds?: number;
  version?: string;
};

export type ExamSessionDTO = {
  id: string;
  name: string;
  date: string | null;
  subject: string | null;
  grade: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RubricLifecycleStatus = "draft" | "published";

export type RubricSummaryDTO = {
  questionId: string;
  title: string;
  totalScore: number;
  pointCount: number;
  updatedAt: string;
  examId: string | null;
  lifecycleStatus: RubricLifecycleStatus;
};

export type RubricDetailDTO = {
  rubric: unknown;
  lifecycleStatus: RubricLifecycleStatus;
} | null;

export type RubricUpsertResultDTO = {
  questionKey: string;
  rubric: unknown;
  examId: string | null;
  lifecycleStatus: RubricLifecycleStatus;
};

export type ProviderTraceDTO = {
  mode: "ai" | "fallback";
  reason?: string;
  attempts?: Array<{
    provider: string;
    model?: string;
    endpoint?: string;
    statusCode?: number;
    durationMs?: number;
    errorCode?: string;
    message: string;
  }>;
};

export type RubricGenerateResultDTO = {
  rubric: Record<string, unknown>;
  provider: string;
  providerTrace: ProviderTraceDTO;
};

export type RubricStandardizeResultDTO = {
  rubric: string;
  provider: string;
  providerTrace: ProviderTraceDTO;
};

export type GradingBreakdownItemDTO = {
  label: string;
  score: number;
  max: number;
  comment: string;
};

export type GradingResultDTO = GradingResult;

export type GradingEvaluateResultDTO = {
  score: number;
  maxScore: number;
  breakdown: GradingBreakdownItemDTO[];
  comment: string;
  provider: string;
  providerTrace: ProviderTraceDTO;
  remaining: number;
  totalUsed: number;
  gradingResult?: GradingResultDTO;
};

export type QuotaStatusDTO = {
  remaining: number;
  totalUsed: number;
  isPaid: boolean;
  status: "active" | "expired" | "disabled";
};

export type RecordItemDTO = {
  id: string;
  questionNo: string | null;
  questionKey: string | null;
  studentName: string;
  examNo: string | null;
  score: number;
  maxScore: number;
  comment: string | null;
  breakdown: unknown;
  deviceId: string | null;
  createdAt: string;
  timestamp: number;
};

export type RecordListResultDTO = {
  records: RecordItemDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type RecordInputDTO = {
  questionNo?: string;
  questionKey?: string;
  studentName?: string;
  name?: string;
  examNo?: string;
  score: number;
  maxScore: number;
  comment?: string;
  breakdown?: unknown;
  deviceId?: string;
};

const buildHeaders = (extraHeaders?: Record<string, string>): HeadersInit => {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-device-id": getDeviceId(),
    ...extraHeaders
  };

  const activationCode = getActivationCode();
  if (activationCode) {
    headers["x-activation-code"] = activationCode;
  }

  return headers;
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as ApiError;
    return payload.error?.message ?? `请求失败 (${response.status})`;
  } catch {
    return `请求失败 (${response.status})`;
  }
};

const isNetworkFetchError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error instanceof TypeError ||
    /failed to fetch|networkerror|load failed|network request failed/i.test(error.message)
  );
};

const requestWithApiFallback = async (path: string, init: RequestInit): Promise<Response> => {
  let lastError: Error | null = null;

  for (const baseUrl of API_BASE_URLS) {
    try {
      return await fetch(`${baseUrl}${path}`, init);
    } catch (error) {
      if (!isNetworkFetchError(error)) {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error("Network request failed");
    }
  }

  if (lastError) {
    throw new Error(`无法连接本地 API 服务（${API_BASE_URLS.join("、")}）。请确认 API 服务已启动。`);
  }

  throw new Error("请求失败：未找到可用 API 地址");
};

const normalizeText = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const normalizeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeLifecycleStatus = (value: unknown): RubricLifecycleStatus => {
  return value === "published" ? "published" : "draft";
};

const coerceRubricSummaries = (input: unknown): RubricSummaryDTO[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const questionId = normalizeText(record.questionId)
        || normalizeText(record.questionKey)
        || normalizeText(record.id);

      if (!questionId) {
        return null;
      }

      const title = normalizeText(record.title) || questionId;
      const updatedAt = normalizeText(record.updatedAt) || new Date().toISOString();
      const examId = normalizeText(record.examId) || null;

      return {
        questionId,
        title,
        totalScore: normalizeNumber(record.totalScore),
        pointCount: normalizeNumber(record.pointCount),
        updatedAt,
        examId,
        lifecycleStatus: normalizeLifecycleStatus(record.lifecycleStatus)
      };
    })
    .filter((item): item is RubricSummaryDTO => Boolean(item));
};

const coerceRubricDetail = (input: unknown): RubricDetailDTO => {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const hasRubricField = Object.prototype.hasOwnProperty.call(record, "rubric");
  const rubric = hasRubricField ? record.rubric : input;

  return {
    rubric,
    lifecycleStatus: normalizeLifecycleStatus(record.lifecycleStatus)
  };
};

const coerceRubricUpsertResult = (input: unknown): RubricUpsertResultDTO => {
  if (!input || typeof input !== "object") {
    throw new Error("保存 Rubric 返回数据格式非法");
  }

  const record = input as Record<string, unknown>;
  const questionKey = normalizeText(record.questionKey)
    || normalizeText(record.questionId)
    || normalizeText(record.id);

  if (!questionKey) {
    throw new Error("保存 Rubric 返回缺少 questionKey");
  }

  return {
    questionKey,
    rubric: Object.prototype.hasOwnProperty.call(record, "rubric") ? record.rubric : input,
    examId: normalizeText(record.examId) || null,
    lifecycleStatus: normalizeLifecycleStatus(record.lifecycleStatus)
  };
};

const coerceRubricGenerateResult = (input: unknown): RubricGenerateResultDTO => {
  if (!input || typeof input !== "object") {
    throw new Error("生成 Rubric 返回数据格式非法");
  }

  const record = input as Record<string, unknown>;
  const rubric = (
    (record.rubric && typeof record.rubric === "object" && !Array.isArray(record.rubric))
      ? record.rubric
      : record
  ) as Record<string, unknown>;

  return {
    rubric,
    provider: normalizeText(record.provider) || "rule-based",
    providerTrace: (record.providerTrace && typeof record.providerTrace === "object"
      ? record.providerTrace
      : { mode: "fallback", message: "provider trace unavailable" }) as ProviderTraceDTO
  };
};

const coerceRubricStandardizeResult = (input: unknown): RubricStandardizeResultDTO => {
  if (!input || typeof input !== "object") {
    throw new Error("标准化 Rubric 返回数据格式非法");
  }

  const record = input as Record<string, unknown>;
  const rubricRaw = record.rubric;
  const rubric = typeof rubricRaw === "string"
    ? rubricRaw
    : JSON.stringify(rubricRaw ?? {}, null, 2);

  return {
    rubric,
    provider: normalizeText(record.provider) || "rule-based",
    providerTrace: (record.providerTrace && typeof record.providerTrace === "object"
      ? record.providerTrace
      : { mode: "fallback", message: "provider trace unavailable" }) as ProviderTraceDTO
  };
};

const coerceModelConnectionTestResult = (input: unknown): ModelConnectionTestResultDTO => {
  if (!input || typeof input !== "object") {
    throw new Error("模型测试返回数据格式非法");
  }

  const record = input as Record<string, unknown>;
  const attemptsRaw = Array.isArray(record.attempts) ? record.attempts : [];
  const attempts = attemptsRaw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;
      const provider = normalizeText(row.provider);
      const message = normalizeText(row.message);

      if (!provider || !message) {
        return null;
      }

      return {
        provider,
        message
      };
    })
    .filter((item): item is { provider: string; message: string } => Boolean(item));

  return {
    connected: Boolean(record.connected),
    provider: normalizeText(record.provider) || undefined,
    reason: normalizeText(record.reason) || undefined,
    attempts
  };
};

const coerceGradingBreakdown = (input: unknown): GradingBreakdownItemDTO[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;
      const label = normalizeText(row.label);
      if (!label) {
        return null;
      }

      return {
        label,
        score: normalizeNumber(row.score),
        max: Math.max(0, normalizeNumber(row.max)),
        comment: normalizeText(row.comment)
      };
    })
    .filter((item): item is GradingBreakdownItemDTO => Boolean(item));
};

const coerceProviderTrace = (input: unknown): ProviderTraceDTO => {
  if (!input || typeof input !== "object") {
    return { mode: "fallback", reason: "provider trace unavailable" };
  }

  const row = input as Record<string, unknown>;
  const mode = row.mode === "ai" ? "ai" : "fallback";
  const attemptsRaw = Array.isArray(row.attempts) ? row.attempts : [];
  const attempts: ProviderTraceDTO["attempts"] = [];

  attemptsRaw.forEach((attempt) => {
    if (!attempt || typeof attempt !== "object") {
      return;
    }

    const attemptRow = attempt as Record<string, unknown>;
    const provider = normalizeText(attemptRow.provider);
    const model = normalizeText(attemptRow.model);
    const message = normalizeText(attemptRow.message);
    if (!provider || !message) {
      return;
    }

    attempts.push({
      provider,
      model: model || undefined,
      endpoint: normalizeText(attemptRow.endpoint) || undefined,
      statusCode: Number.isFinite(Number(attemptRow.statusCode)) ? Number(attemptRow.statusCode) : undefined,
      durationMs: Number.isFinite(Number(attemptRow.durationMs)) ? Number(attemptRow.durationMs) : undefined,
      errorCode: normalizeText(attemptRow.errorCode) || undefined,
      message
    });
  });

  return {
    mode,
    reason: normalizeText(row.reason) || undefined,
    attempts
  };
};

const coerceGradingResult = (input: unknown): GradingResultDTO | undefined => {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const row = input as Record<string, unknown>;
  const id = normalizeText(row.id);
  const studentName = normalizeText(row.studentName);
  const questionNo = normalizeText(row.questionNo);
  const questionKey = normalizeText(row.questionKey);
  const examNo = normalizeText(row.examNo);
  const comment = typeof row.comment === "string" ? row.comment : "";
  const segments = Array.isArray(row.segments) ? row.segments : [];
  const segmentAggregation = row.segmentAggregation;
  const timestamp = Number(row.timestamp);

  if (
    !id
    || !studentName
    || !questionNo
    || !questionKey
    || !examNo
    || !Number.isFinite(timestamp)
    || !Array.isArray(segments)
    || !["sum", "weighted_sum", "max"].includes(String(segmentAggregation))
  ) {
    return undefined;
  }

  return {
    id,
    studentName,
    questionNo,
    questionKey,
    examNo,
    score: normalizeNumber(row.score),
    maxScore: normalizeNumber(row.maxScore),
    comment,
    segments: segments as GradingResultDTO["segments"],
    segmentAggregation: segmentAggregation as GradingResultDTO["segmentAggregation"],
    provider: normalizeText(row.provider) || undefined,
    model: normalizeText(row.model) || undefined,
    durationMs: Number.isFinite(Number(row.durationMs)) ? Number(row.durationMs) : undefined,
    timestamp,
    remaining: Number.isFinite(Number(row.remaining)) ? Number(row.remaining) : undefined,
    totalUsed: Number.isFinite(Number(row.totalUsed)) ? Number(row.totalUsed) : undefined
  };
};

const coerceGradingEvaluateResult = (input: unknown): GradingEvaluateResultDTO => {
  if (!input || typeof input !== "object") {
    throw new Error("批改返回数据格式非法");
  }

  const row = input as Record<string, unknown>;
  const provider = normalizeText(row.provider) || "rule-evaluator";
  const breakdown = coerceGradingBreakdown(row.breakdown);

  return {
    score: normalizeNumber(row.score),
    maxScore: normalizeNumber(row.maxScore),
    breakdown,
    comment: typeof row.comment === "string" ? row.comment : "",
    provider,
    providerTrace: coerceProviderTrace(row.providerTrace),
    remaining: Math.max(0, Math.floor(normalizeNumber(row.remaining))),
    totalUsed: Math.max(0, Math.floor(normalizeNumber(row.totalUsed))),
    gradingResult: coerceGradingResult(row.gradingResult)
  };
};

const requestJson = async <T>(
  path: string,
  init: RequestInit,
  errorFallbackMessage: string
): Promise<T> => {
  const response = await requestWithApiFallback(path, init);

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new Error(payload.error?.message ?? errorFallbackMessage);
  }

  return payload.data;
};

export const fetchLicenseStatus = async (): Promise<LicenseStatusData> => {
  return requestJson<LicenseStatusData>(
    "/api/v2/licenses/status",
    {
      method: "GET",
      headers: buildHeaders()
    },
    "获取授权状态失败"
  );
};

export const fetchHealthStatus = async (): Promise<HealthStatusDTO> => {
  const response = await requestWithApiFallback("/api/health", {
    method: "GET",
    headers: buildHeaders()
  });

  if (!response.ok) {
    throw new Error(`健康检查失败 (${response.status})`);
  }

  const payload = (await response.json()) as {
    ok?: boolean;
    service?: string;
    timestamp?: string;
    message?: string;
  };

  if (!payload.ok) {
    throw new Error(payload.message ?? "健康检查失败");
  }

  return {
    status: "ok",
    timestamp: payload.timestamp ?? new Date().toISOString(),
    version: payload.service
  };
};

export const activateLicenseCode = async (activationCode: string): Promise<LicenseActivateData> => {
  return requestJson<LicenseActivateData>(
    "/api/v2/licenses/activate",
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        activationCode,
        deviceId: getDeviceId()
      })
    },
    "激活失败"
  );
};

export const fetchSettingByKey = async (key: string): Promise<SettingEntryDTO | null> => {
  const query = new URLSearchParams({ key }).toString();
  const data = await requestJson<SettingEntryDTO | SettingEntryDTO[] | null>(
    `/api/v2/settings?${query}`,
    {
      method: "GET",
      headers: buildHeaders()
    },
    "读取设置失败"
  );

  if (data && !Array.isArray(data)) {
    return data;
  }

  return null;
};

export const fetchSettingsList = async (): Promise<SettingEntryDTO[]> => {
  const data = await requestJson<SettingEntryDTO[] | SettingEntryDTO | null>(
    "/api/v2/settings",
    {
      method: "GET",
      headers: buildHeaders()
    },
    "读取设置列表失败"
  );

  if (Array.isArray(data)) {
    return data;
  }

  if (data) {
    return [data];
  }

  return [];
};

export const upsertSettingByKey = async (key: string, value: unknown): Promise<SettingEntryDTO> => {
  return requestJson<SettingEntryDTO>(
    "/api/v2/settings",
    {
      method: "PUT",
      headers: buildHeaders(),
      body: JSON.stringify({ key, value })
    },
    "保存设置失败"
  );
};

export const testModelConnection = async (input: {
  provider: ModelProviderDTO;
  endpoint: string;
  modelName: string;
  apiKey: string;
}): Promise<ModelConnectionTestResultDTO> => {
  const data = await requestJson<unknown>(
    "/api/v2/settings/model/test",
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input)
    },
    "测试模型连接失败"
  );

  return coerceModelConnectionTestResult(data);
};

export const deleteSettingByKey = async (key: string): Promise<void> => {
  const query = new URLSearchParams({ key }).toString();

  await requestJson<null>(
    `/api/v2/settings?${query}`,
    {
      method: "DELETE",
      headers: buildHeaders()
    },
    "删除设置失败"
  );
};

export const fetchExams = async (): Promise<ExamSessionDTO[]> => {
  return requestJson<ExamSessionDTO[]>(
    "/api/v2/exams",
    {
      method: "GET",
      headers: buildHeaders()
    },
    "读取考试列表失败"
  );
};

export const createExam = async (input: {
  name: string;
  date?: string;
  subject?: string;
  grade?: string;
  description?: string;
}): Promise<ExamSessionDTO> => {
  return requestJson<ExamSessionDTO>(
    "/api/v2/exams",
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input)
    },
    "创建考试失败"
  );
};

export const fetchRubricSummaries = async (input?: { examId?: string }): Promise<RubricSummaryDTO[]> => {
  const query = new URLSearchParams();
  if (input?.examId) {
    query.set("examId", input.examId);
  }

  const suffix = query.toString();
  const data = await requestJson<unknown>(
    `/api/v2/rubrics${suffix ? `?${suffix}` : ""}`,
    {
      method: "GET",
      headers: buildHeaders()
    },
    "读取 Rubric 列表失败"
  );

  return coerceRubricSummaries(data);
};

export const fetchRubricByQuestionKey = async (questionKey: string): Promise<RubricDetailDTO> => {
  const query = new URLSearchParams({ questionKey }).toString();
  const data = await requestJson<unknown>(
    `/api/v2/rubrics?${query}`,
    {
      method: "GET",
      headers: buildHeaders()
    },
    "读取 Rubric 失败"
  );

  return coerceRubricDetail(data);
};

export const upsertRubric = async (input: {
  questionKey?: string;
  rubric: unknown;
  examId?: string | null;
  lifecycleStatus?: RubricLifecycleStatus;
}): Promise<RubricUpsertResultDTO> => {
  const data = await requestJson<unknown>(
    "/api/v2/rubrics",
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input)
    },
    "保存 Rubric 失败"
  );

  return coerceRubricUpsertResult(data);
};

export const deleteRubricByQuestionKey = async (questionKey: string): Promise<void> => {
  const query = new URLSearchParams({ questionKey }).toString();

  await requestJson<null>(
    `/api/v2/rubrics?${query}`,
    {
      method: "DELETE",
      headers: buildHeaders()
    },
    "删除 Rubric 失败"
  );
};

export const generateRubric = async (input: {
  questionImage?: string;
  answerImage?: string;
  answerText?: string;
  questionId?: string;
  subject?: string;
  questionType?: string;
  strategyType?: string;
  totalScore?: number;
  customRules?: string[];
}): Promise<RubricGenerateResultDTO> => {
  const data = await requestJson<unknown>(
    "/api/v2/rubrics/generate",
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input)
    },
    "生成 Rubric 失败"
  );

  return coerceRubricGenerateResult(data);
};

export const standardizeRubric = async (input: {
  rubric: string | Record<string, unknown>;
  maxScore?: number;
}): Promise<RubricStandardizeResultDTO> => {
  const data = await requestJson<unknown>(
    "/api/v2/rubrics/standardize",
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input)
    },
    "标准化 Rubric 失败"
  );

  return coerceRubricStandardizeResult(data);
};

export const fetchQuotaStatus = async (): Promise<QuotaStatusDTO> => {
  return requestJson<QuotaStatusDTO>(
    "/api/v2/gradings/evaluate",
    {
      method: "GET",
      headers: buildHeaders()
    },
    "读取配额状态失败"
  );
};

export const evaluateGrading = async (input: {
  imageBase64?: string;
  rubric: unknown;
  studentName?: string;
  questionNo?: string;
  questionKey?: string;
  examNo?: string;
}): Promise<GradingEvaluateResultDTO> => {
  const data = await requestJson<unknown>(
    "/api/v2/gradings/evaluate",
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input)
    },
    "批改失败"
  );

  return coerceGradingEvaluateResult(data);
};

export const fetchRecords = async (input?: {
  page?: number;
  limit?: number;
  questionNo?: string;
  questionKey?: string;
}): Promise<RecordListResultDTO> => {
  const query = new URLSearchParams();

  if (input?.page) {
    query.set("page", String(input.page));
  }

  if (input?.limit) {
    query.set("limit", String(input.limit));
  }

  if (input?.questionNo) {
    query.set("questionNo", input.questionNo);
  }

  if (input?.questionKey) {
    query.set("questionKey", input.questionKey);
  }

  const suffix = query.toString();

  return requestJson<RecordListResultDTO>(
    `/api/v2/records${suffix ? `?${suffix}` : ""}`,
    {
      method: "GET",
      headers: buildHeaders()
    },
    "读取记录失败"
  );
};

export const createRecordBatch = async (
  records: RecordInputDTO[],
  idempotencyKey?: string
): Promise<{ created: number }> => {
  const extraHeaders: Record<string, string> = {};
  if (idempotencyKey) {
    extraHeaders["idempotency-key"] = idempotencyKey;
  }

  return requestJson<{ created: number }>(
    "/api/v2/records/batch",
    {
      method: "POST",
      headers: buildHeaders(extraHeaders),
      body: JSON.stringify({ records })
    },
    "创建记录失败"
  );
};

export const createSingleRecord = async (record: RecordInputDTO): Promise<{ created: number }> => {
  return createRecordBatch([record]);
};

export const deleteRecordById = async (id: string): Promise<{ deleted: number }> => {
  return requestJson<{ deleted: number }>(
    `/api/v2/records/${id}`,
    {
      method: "DELETE",
      headers: buildHeaders()
    },
    "删除记录失败"
  );
};

export const deleteRecordsByFilter = async (input: {
  questionNo?: string;
  questionKey?: string;
}): Promise<{ deleted: number }> => {
  const query = new URLSearchParams();

  if (input.questionNo) {
    query.set("questionNo", input.questionNo);
  }

  if (input.questionKey) {
    query.set("questionKey", input.questionKey);
  }

  const suffix = query.toString();
  if (!suffix) {
    throw new Error("删除记录至少需要 questionNo 或 questionKey");
  }

  return requestJson<{ deleted: number }>(
    `/api/v2/records?${suffix}`,
    {
      method: "DELETE",
      headers: buildHeaders()
    },
    "删除记录失败"
  );
};
