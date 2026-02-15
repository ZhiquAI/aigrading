import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export class IdempotencyConflictError extends Error {
  constructor(message = "The idempotency key has been used with a different payload.") {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

const IDEMPOTENCY_PENDING_STATUS_CODE = -1;
const IDEMPOTENCY_PENDING_RESPONSE_BODY = "{\"pending\":true}";
const IDEMPOTENCY_WAIT_TIMEOUT_MS = 3000;
const IDEMPOTENCY_POLL_INTERVAL_MS = 100;

type Serializable =
  | null
  | boolean
  | number
  | string
  | Serializable[]
  | { [key: string]: Serializable };

const normalizeForStableHash = (value: unknown): Serializable => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForStableHash(item));
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    const normalized: Record<string, Serializable> = {};

    for (const key of keys) {
      const current = objectValue[key];
      if (current === undefined) {
        continue;
      }
      normalized[key] = normalizeForStableHash(current);
    }

    return normalized;
  }

  return String(value);
};

const buildRequestHash = (payload: unknown): string => {
  const normalized = normalizeForStableHash(payload);
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
};

export const isIdempotencyConflictError = (error: unknown): error is IdempotencyConflictError => {
  return error instanceof IdempotencyConflictError;
};

const findIdempotencyRecord = async (
  db: PrismaClient,
  input: { scopeKey: string; endpoint: string },
  key: string
) => {
  return db.idempotencyRecord.findUnique({
    where: {
      scopeKey_endpoint_key: {
        scopeKey: input.scopeKey,
        endpoint: input.endpoint,
        key
      }
    }
  });
};

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const waitForRecordCompletion = async (
  db: PrismaClient,
  input: { scopeKey: string; endpoint: string },
  key: string,
  requestHash: string
) => {
  const deadline = Date.now() + IDEMPOTENCY_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(IDEMPOTENCY_POLL_INTERVAL_MS);
    const latest = await findIdempotencyRecord(db, input, key);

    if (!latest) {
      return { state: "missing" as const };
    }

    if (latest.requestHash !== requestHash) {
      throw new IdempotencyConflictError();
    }

    if (latest.statusCode !== IDEMPOTENCY_PENDING_STATUS_CODE) {
      return { state: "completed" as const, record: latest };
    }
  }

  return { state: "timeout" as const };
};

export const executeIdempotent = async <TPayload>(
  db: PrismaClient,
  input: {
    scopeKey: string;
    endpoint: string;
    idempotencyKey?: string;
    requestPayload: unknown;
  },
  run: () => Promise<{ statusCode: number; payload: TPayload }>
): Promise<{ statusCode: number; payload: TPayload; replayed: boolean }> => {
  const key = input.idempotencyKey?.trim();
  if (!key) {
    const fresh = await run();
    return {
      ...fresh,
      replayed: false
    };
  }

  const requestHash = buildRequestHash(input.requestPayload);

  while (true) {
    let acquired = false;

    try {
      await db.idempotencyRecord.create({
        data: {
          scopeKey: input.scopeKey,
          endpoint: input.endpoint,
          key,
          requestHash,
          responseBody: IDEMPOTENCY_PENDING_RESPONSE_BODY,
          statusCode: IDEMPOTENCY_PENDING_STATUS_CODE
        }
      });
      acquired = true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        acquired = false;
      } else {
        throw error;
      }
    }

    if (!acquired) {
      const existing = await findIdempotencyRecord(db, input, key);

      if (!existing) {
        continue;
      }

      if (existing.requestHash !== requestHash) {
        throw new IdempotencyConflictError();
      }

      if (existing.statusCode !== IDEMPOTENCY_PENDING_STATUS_CODE) {
        return {
          statusCode: existing.statusCode,
          payload: JSON.parse(existing.responseBody) as TPayload,
          replayed: true
        };
      }

      const waitResult = await waitForRecordCompletion(db, input, key, requestHash);
      if (waitResult.state === "missing") {
        continue;
      }

      if (waitResult.state === "timeout") {
        throw new IdempotencyConflictError("The idempotency request is still being processed. Please retry.");
      }

      return {
        statusCode: waitResult.record.statusCode,
        payload: JSON.parse(waitResult.record.responseBody) as TPayload,
        replayed: true
      };
    }

    try {
      const fresh = await run();

      await db.idempotencyRecord.update({
        where: {
          scopeKey_endpoint_key: {
            scopeKey: input.scopeKey,
            endpoint: input.endpoint,
            key
          }
        },
        data: {
          responseBody: JSON.stringify(fresh.payload),
          statusCode: fresh.statusCode
        }
      });

      return {
        ...fresh,
        replayed: false
      };
    } catch (error) {
      try {
        await db.idempotencyRecord.delete({
          where: {
            scopeKey_endpoint_key: {
              scopeKey: input.scopeKey,
              endpoint: input.endpoint,
              key
            }
          }
        });
      } catch (cleanupError) {
        if (
          !(
            cleanupError instanceof Prisma.PrismaClientKnownRequestError &&
            cleanupError.code === "P2025"
          )
        ) {
          throw cleanupError;
        }
      }

      throw error;
    }
  }
};
