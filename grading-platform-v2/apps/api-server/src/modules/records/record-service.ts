import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { RecordsBatchRequest } from "@ai-grading/api-contracts";

const BATCH_ENDPOINT = "records.batch";

type RecordInput = RecordsBatchRequest["records"][number];

export type RecordListResult = {
  records: Array<{
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
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const serializeBreakdown = (breakdown: unknown): string | null => {
  if (breakdown === undefined || breakdown === null) {
    return null;
  }
  return typeof breakdown === "string" ? breakdown : JSON.stringify(breakdown);
};

const parseBreakdown = (breakdown: string | null): unknown => {
  if (!breakdown) {
    return null;
  }

  try {
    return JSON.parse(breakdown);
  } catch {
    return breakdown;
  }
};

const hashBatchPayload = (records: RecordInput[]): string => {
  return createHash("sha256").update(JSON.stringify(records)).digest("hex");
};

export class RecordDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "RecordDomainError";
  }
}

export const isRecordDomainError = (error: unknown): error is RecordDomainError => {
  return error instanceof RecordDomainError;
};

export const listRecords = async (
  db: PrismaClient,
  input: {
    scopeKey: string;
    page: number;
    limit: number;
    questionNo?: string;
    questionKey?: string;
  }
): Promise<RecordListResult> => {
  const where: {
    scopeKey: string;
    questionNo?: string;
    questionKey?: string;
  } = {
    scopeKey: input.scopeKey
  };

  if (input.questionNo) {
    where.questionNo = input.questionNo;
  }

  if (input.questionKey) {
    where.questionKey = input.questionKey;
  }

  const [records, total] = await Promise.all([
    db.gradingRecord.findMany({
      where,
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      orderBy: { createdAt: "desc" }
    }),
    db.gradingRecord.count({ where })
  ]);

  return {
    records: records.map((record) => ({
      id: record.id,
      questionNo: record.questionNo,
      questionKey: record.questionKey,
      studentName: record.studentName,
      examNo: record.examNo,
      score: record.score,
      maxScore: record.maxScore,
      comment: record.comment,
      breakdown: parseBreakdown(record.breakdown),
      deviceId: record.deviceId,
      createdAt: record.createdAt.toISOString(),
      timestamp: record.createdAt.getTime()
    })),
    total,
    page: input.page,
    limit: input.limit,
    totalPages: Math.ceil(total / input.limit)
  };
};

const findIdempotency = async (
  db: PrismaClient,
  input: {
    scopeKey: string;
    idempotencyKey?: string;
    requestHash: string;
  }
): Promise<{ statusCode: number; payload: { created: number } } | null> => {
  if (!input.idempotencyKey) {
    return null;
  }

  const record = await db.idempotencyRecord.findUnique({
    where: {
      scopeKey_endpoint_key: {
        scopeKey: input.scopeKey,
        endpoint: BATCH_ENDPOINT,
        key: input.idempotencyKey
      }
    }
  });

  if (!record) {
    return null;
  }

  if (record.requestHash !== input.requestHash) {
    throw new RecordDomainError(
      "IDEMPOTENCY_CONFLICT",
      "The idempotency key has been used with a different records payload.",
      409
    );
  }

  return {
    statusCode: record.statusCode,
    payload: JSON.parse(record.responseBody) as { created: number }
  };
};

const persistIdempotency = async (
  db: PrismaClient,
  input: {
    scopeKey: string;
    idempotencyKey?: string;
    requestHash: string;
    statusCode: number;
    payload: { created: number };
  }
): Promise<void> => {
  if (!input.idempotencyKey) {
    return;
  }

  try {
    await db.idempotencyRecord.create({
      data: {
        scopeKey: input.scopeKey,
        endpoint: BATCH_ENDPOINT,
        key: input.idempotencyKey,
        requestHash: input.requestHash,
        responseBody: JSON.stringify(input.payload),
        statusCode: input.statusCode
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }

    throw error;
  }
};

export const batchCreateRecords = async (
  db: PrismaClient,
  input: {
    scopeKey: string;
    records: RecordInput[];
    requestDeviceId?: string;
    idempotencyKey?: string;
  }
): Promise<{ statusCode: number; payload: { created: number } }> => {
  if (input.records.length === 0) {
    throw new RecordDomainError("INVALID_RECORDS", "records 必须是非空数组", 400);
  }

  if (input.records.length > 100) {
    throw new RecordDomainError("TOO_MANY_RECORDS", "单次最多上传 100 条记录", 400);
  }

  const requestHash = hashBatchPayload(input.records);
  const idem = await findIdempotency(db, {
    scopeKey: input.scopeKey,
    idempotencyKey: input.idempotencyKey,
    requestHash
  });

  if (idem) {
    return idem;
  }

  const created = await db.gradingRecord.createMany({
    data: input.records.map((record) => ({
      scopeKey: input.scopeKey,
      questionNo: record.questionNo ?? null,
      questionKey: record.questionKey ?? null,
      studentName: record.studentName ?? record.name ?? "未知",
      examNo: record.examNo ?? null,
      score: Number(record.score) || 0,
      maxScore: Number(record.maxScore) || 0,
      comment: record.comment ?? null,
      breakdown: serializeBreakdown(record.breakdown),
      deviceId: record.deviceId ?? input.requestDeviceId ?? null
    }))
  });

  const payload = {
    created: created.count
  };

  await persistIdempotency(db, {
    scopeKey: input.scopeKey,
    idempotencyKey: input.idempotencyKey,
    requestHash,
    statusCode: 201,
    payload
  });

  return {
    statusCode: 201,
    payload
  };
};

export const deleteRecords = async (
  db: PrismaClient,
  input: {
    scopeKey: string;
    id?: string;
    questionNo?: string;
    questionKey?: string;
  }
): Promise<{ deleted: number }> => {
  if (input.id) {
    const result = await db.gradingRecord.deleteMany({
      where: {
        id: input.id,
        scopeKey: input.scopeKey
      }
    });

    return {
      deleted: result.count
    };
  }

  if (input.questionKey) {
    const result = await db.gradingRecord.deleteMany({
      where: {
        scopeKey: input.scopeKey,
        questionKey: input.questionKey
      }
    });

    return {
      deleted: result.count
    };
  }

  if (input.questionNo) {
    const result = await db.gradingRecord.deleteMany({
      where: {
        scopeKey: input.scopeKey,
        questionNo: input.questionNo
      }
    });

    return {
      deleted: result.count
    };
  }

  throw new RecordDomainError("MISSING_DELETE_FILTER", "请指定 id、questionNo 或 questionKey", 400);
};
