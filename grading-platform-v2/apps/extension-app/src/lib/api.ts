import { getActivationCode, getDeviceId } from "./device";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

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
    model: string;
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

export type GradingEvaluateResultDTO = {
  score: number;
  maxScore: number;
  breakdown: GradingBreakdownItemDTO[];
  comment: string;
  provider: string;
  providerTrace: ProviderTraceDTO;
  remaining: number;
  totalUsed: number;
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

const requestJson = async <T>(
  path: string,
  init: RequestInit,
  errorFallbackMessage: string
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, init);

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
  return requestJson<RubricSummaryDTO[]>(
    `/api/v2/rubrics${suffix ? `?${suffix}` : ""}`,
    {
      method: "GET",
      headers: buildHeaders()
    },
    "读取 Rubric 列表失败"
  );
};

export const fetchRubricByQuestionKey = async (questionKey: string): Promise<RubricDetailDTO> => {
  const query = new URLSearchParams({ questionKey }).toString();
  return requestJson<RubricDetailDTO>(
    `/api/v2/rubrics?${query}`,
    {
      method: "GET",
      headers: buildHeaders()
    },
    "读取 Rubric 失败"
  );
};

export const upsertRubric = async (input: {
  questionKey?: string;
  rubric: unknown;
  examId?: string | null;
  lifecycleStatus?: RubricLifecycleStatus;
}): Promise<RubricUpsertResultDTO> => {
  return requestJson<RubricUpsertResultDTO>(
    "/api/v2/rubrics",
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input)
    },
    "保存 Rubric 失败"
  );
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
  return requestJson<RubricGenerateResultDTO>(
    "/api/v2/rubrics/generate",
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input)
    },
    "生成 Rubric 失败"
  );
};

export const standardizeRubric = async (input: {
  rubric: string | Record<string, unknown>;
  maxScore?: number;
}): Promise<RubricStandardizeResultDTO> => {
  return requestJson<RubricStandardizeResultDTO>(
    "/api/v2/rubrics/standardize",
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input)
    },
    "标准化 Rubric 失败"
  );
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
  return requestJson<GradingEvaluateResultDTO>(
    "/api/v2/gradings/evaluate",
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input)
    },
    "批改失败"
  );
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
    "/api/v2/records",
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
