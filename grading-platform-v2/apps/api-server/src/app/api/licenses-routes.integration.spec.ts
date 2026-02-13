import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.resolve(process.cwd(), "prisma", "test-routes.db");
const testDbUrl = `file:${testDbPath}`;

const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl
    }
  }
});

vi.mock("@/lib/prisma", () => ({
  prisma: testPrisma
}));

type RouteHandler = (request: Request) => Promise<Response>;
type RecordDeleteByIdHandler = (
  request: Request,
  context: { params: { id: string } }
) => Promise<Response>;

let v2ActivatePost: RouteHandler;
let v2StatusGet: RouteHandler;
let v2SettingsGet: RouteHandler;
let v2SettingsPut: RouteHandler;
let v2SettingsDelete: RouteHandler;
let v2RecordsGet: RouteHandler;
let v2RecordsPost: RouteHandler;
let v2RecordsDelete: RouteHandler;
let v2RecordsBatchPost: RouteHandler;
let v2RecordsDeleteById: RecordDeleteByIdHandler;
let v2ExamsGet: RouteHandler;
let v2ExamsPost: RouteHandler;
let v2RubricsGet: RouteHandler;
let v2RubricsPost: RouteHandler;
let v2RubricsDelete: RouteHandler;
let v2RubricsGeneratePost: RouteHandler;
let v2RubricsStandardizePost: RouteHandler;
let v2GradingEvaluatePost: RouteHandler;
let v2GradingEvaluateGet: RouteHandler;

const seedCodes = async (): Promise<void> => {
  await testPrisma.licenseCode.createMany({
    data: [
      { code: "TEST-1111-2222-3333", planType: "trial", totalQuota: 300, maxDevices: 1 },
      { code: "BASIC-AAAA-BBBB-CCCC", planType: "basic", totalQuota: 1000, maxDevices: 2 },
      { code: "PRO-XXXX-YYYY-ZZZZ", planType: "pro", totalQuota: 3000, maxDevices: 3 }
    ]
  });
};

const resetDb = async (): Promise<void> => {
  await testPrisma.idempotencyRecord.deleteMany();
  await testPrisma.rubricDocument.deleteMany();
  await testPrisma.gradingRecord.deleteMany();
  await testPrisma.examSession.deleteMany();
  await testPrisma.settingEntry.deleteMany();
  await testPrisma.licenseBinding.deleteMany();
  await testPrisma.scopeQuota.deleteMany();
  await testPrisma.licenseCode.deleteMany();
  await seedCodes();
};

const parseJson = async <T>(response: Response): Promise<T> => {
  return (await response.json()) as T;
};

beforeAll(async () => {
  fs.rmSync(testDbPath, { force: true });
  fs.closeSync(fs.openSync(testDbPath, "w"));

  execSync("pnpm prisma db push --schema prisma/schema.prisma --skip-generate", {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl
    },
    stdio: "pipe"
  });

  await seedCodes();

  const v2ActivateRoute = await import("@/app/api/v2/licenses/activate/route");
  const v2StatusRoute = await import("@/app/api/v2/licenses/status/route");
  const v2SettingsRoute = await import("@/app/api/v2/settings/route");
  const v2RecordsRoute = await import("@/app/api/v2/records/route");
  const v2RecordsBatchRoute = await import("@/app/api/v2/records/batch/route");
  const v2RecordsDeleteByIdRoute = await import("@/app/api/v2/records/[id]/route");
  const v2ExamsRoute = await import("@/app/api/v2/exams/route");
  const v2RubricsRoute = await import("@/app/api/v2/rubrics/route");
  const v2RubricsGenerateRoute = await import("@/app/api/v2/rubrics/generate/route");
  const v2RubricsStandardizeRoute = await import("@/app/api/v2/rubrics/standardize/route");
  const v2GradingEvaluateRoute = await import("@/app/api/v2/gradings/evaluate/route");

  v2ActivatePost = v2ActivateRoute.POST;
  v2StatusGet = v2StatusRoute.GET;
  v2SettingsGet = v2SettingsRoute.GET;
  v2SettingsPut = v2SettingsRoute.PUT;
  v2SettingsDelete = v2SettingsRoute.DELETE;
  v2RecordsGet = v2RecordsRoute.GET;
  v2RecordsPost = v2RecordsRoute.POST;
  v2RecordsDelete = v2RecordsRoute.DELETE;
  v2RecordsBatchPost = v2RecordsBatchRoute.POST;
  v2RecordsDeleteById = v2RecordsDeleteByIdRoute.DELETE;
  v2ExamsGet = v2ExamsRoute.GET;
  v2ExamsPost = v2ExamsRoute.POST;
  v2RubricsGet = v2RubricsRoute.GET;
  v2RubricsPost = v2RubricsRoute.POST;
  v2RubricsDelete = v2RubricsRoute.DELETE;
  v2RubricsGeneratePost = v2RubricsGenerateRoute.POST;
  v2RubricsStandardizePost = v2RubricsStandardizeRoute.POST;
  v2GradingEvaluatePost = v2GradingEvaluateRoute.POST;
  v2GradingEvaluateGet = v2GradingEvaluateRoute.GET;
});

afterAll(async () => {
  await testPrisma.$disconnect();
  fs.rmSync(testDbPath, { force: true });
});

beforeEach(async () => {
  await resetDb();
});

describe("v2 license routes", () => {
  it("activates and resolves active status for bound device", async () => {
    const activateResponse = await v2ActivatePost(
      new Request("http://localhost/api/v2/licenses/activate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-id": "device-a"
        },
        body: JSON.stringify({
          activationCode: "TEST-1111-2222-3333"
        })
      })
    );

    expect(activateResponse.status).toBe(201);
    const activateJson = await parseJson<{
      ok: boolean;
      data: { identity: { scopeType: string }; remainingQuota: number };
    }>(activateResponse);
    expect(activateJson.ok).toBe(true);
    expect(activateJson.data.identity.scopeType).toBe("activation");
    expect(activateJson.data.remainingQuota).toBe(300);

    const statusResponse = await v2StatusGet(
      new Request("http://localhost/api/v2/licenses/status", {
        headers: {
          "x-device-id": "device-a"
        }
      })
    );

    expect(statusResponse.status).toBe(200);
    const statusJson = await parseJson<{
      ok: boolean;
      data: { licenseStatus: string; remainingQuota: number };
    }>(statusResponse);
    expect(statusJson.ok).toBe(true);
    expect(statusJson.data.licenseStatus).toBe("active");
    expect(statusJson.data.remainingQuota).toBe(300);
  });

  it("blocks activation when max device limit reached", async () => {
    await v2ActivatePost(
      new Request("http://localhost/api/v2/licenses/activate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-id": "device-a"
        },
        body: JSON.stringify({
          activationCode: "TEST-1111-2222-3333"
        })
      })
    );

    const secondDeviceResponse = await v2ActivatePost(
      new Request("http://localhost/api/v2/licenses/activate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-id": "device-b"
        },
        body: JSON.stringify({
          activationCode: "TEST-1111-2222-3333"
        })
      })
    );

    expect(secondDeviceResponse.status).toBe(409);
    const conflictJson = await parseJson<{
      ok: boolean;
      error: { code: string };
    }>(secondDeviceResponse);
    expect(conflictJson.ok).toBe(false);
    expect(conflictJson.error.code).toBe("DEVICE_LIMIT_REACHED");
  });

  it("returns idempotency conflict when same key used with different payload", async () => {
    await v2ActivatePost(
      new Request("http://localhost/api/v2/licenses/activate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-id": "device-a",
          "idempotency-key": "idem-1"
        },
        body: JSON.stringify({
          activationCode: "TEST-1111-2222-3333"
        })
      })
    );

    const conflictResponse = await v2ActivatePost(
      new Request("http://localhost/api/v2/licenses/activate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-id": "device-a",
          "idempotency-key": "idem-1"
        },
        body: JSON.stringify({
          activationCode: "BASIC-AAAA-BBBB-CCCC"
        })
      })
    );

    expect(conflictResponse.status).toBe(409);
    const conflictJson = await parseJson<{
      ok: boolean;
      error: { code: string };
    }>(conflictResponse);
    expect(conflictJson.ok).toBe(false);
    expect(conflictJson.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });
});

describe("v2 settings routes", () => {
  it("supports setting upsert/get/delete", async () => {
    const putResponse = await v2SettingsPut(
      new Request("http://localhost/api/v2/settings", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-device-id": "settings-device"
        },
        body: JSON.stringify({
          key: "model.provider",
          value: "openrouter"
        })
      })
    );

    expect(putResponse.status).toBe(200);
    const putJson = await parseJson<{
      ok: boolean;
      data: { key: string; value: string };
    }>(putResponse);
    expect(putJson.ok).toBe(true);
    expect(putJson.data.key).toBe("model.provider");
    expect(putJson.data.value).toBe("openrouter");

    const getResponse = await v2SettingsGet(
      new Request("http://localhost/api/v2/settings?key=model.provider", {
        headers: {
          "x-device-id": "settings-device"
        }
      })
    );

    expect(getResponse.status).toBe(200);
    const getJson = await parseJson<{
      ok: boolean;
      data: { key: string; value: string } | null;
    }>(getResponse);
    expect(getJson.ok).toBe(true);
    expect(getJson.data?.key).toBe("model.provider");
    expect(getJson.data?.value).toBe("openrouter");

    const deleteResponse = await v2SettingsDelete(
      new Request("http://localhost/api/v2/settings?key=model.provider", {
        method: "DELETE",
        headers: {
          "x-device-id": "settings-device"
        }
      })
    );
    expect(deleteResponse.status).toBe(200);

    const getAfterDelete = await v2SettingsGet(
      new Request("http://localhost/api/v2/settings?key=model.provider", {
        headers: {
          "x-device-id": "settings-device"
        }
      })
    );
    expect(getAfterDelete.status).toBe(200);
    const getAfterDeleteJson = await parseJson<{
      ok: boolean;
      data: null;
    }>(getAfterDelete);
    expect(getAfterDeleteJson.ok).toBe(true);
    expect(getAfterDeleteJson.data).toBeNull();
  });
});

describe("v2 exams routes", () => {
  it("supports create/list", async () => {
    const createOne = await v2ExamsPost(
      new Request("http://localhost/api/v2/exams", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-id": "exam-device"
        },
        body: JSON.stringify({
          name: "高三二模",
          date: "2026-02-10",
          subject: "history"
        })
      })
    );
    expect(createOne.status).toBe(201);

    const createTwo = await v2ExamsPost(
      new Request("http://localhost/api/v2/exams", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-id": "exam-device"
        },
        body: JSON.stringify({
          name: "高三三模",
          date: "2026-03-12",
          subject: "history",
          grade: "高三"
        })
      })
    );
    expect(createTwo.status).toBe(201);

    const listResponse = await v2ExamsGet(
      new Request("http://localhost/api/v2/exams", {
        headers: {
          "x-device-id": "exam-device"
        }
      })
    );
    expect(listResponse.status).toBe(200);

    const listJson = await parseJson<{
      ok: boolean;
      data: Array<{ name: string }>;
    }>(listResponse);
    expect(listJson.ok).toBe(true);
    expect(listJson.data).toHaveLength(2);
    expect(listJson.data.map((item) => item.name)).toEqual(
      expect.arrayContaining(["高三二模", "高三三模"])
    );
  });

  it("returns validation error when exam name is missing", async () => {
    const response = await v2ExamsPost(
      new Request("http://localhost/api/v2/exams", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-id": "exam-device"
        },
        body: JSON.stringify({
          subject: "history"
        })
      })
    );

    expect(response.status).toBe(400);
  });
});

describe("v2 records routes", () => {
  it("supports batch create/list/delete", async () => {
    const batchPost = await v2RecordsBatchPost(
      new Request("http://localhost/api/v2/records/batch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC",
          "x-device-id": "records-device"
        },
        body: JSON.stringify({
          records: [
            {
              questionNo: "Q1",
              questionKey: "question-1",
              studentName: "Alice",
              score: 8,
              maxScore: 10
            }
          ]
        })
      })
    );
    expect(batchPost.status).toBe(201);

    const compatPost = await v2RecordsPost(
      new Request("http://localhost/api/v2/records", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC",
          "x-device-id": "records-device"
        },
        body: JSON.stringify({
          records: [
            {
              questionNo: "Q1",
              questionKey: "question-1",
              studentName: "Bob",
              score: 9,
              maxScore: 10
            }
          ]
        })
      })
    );
    expect(compatPost.status).toBe(201);

    const listResponse = await v2RecordsGet(
      new Request("http://localhost/api/v2/records?page=1&limit=10", {
        headers: {
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC"
        }
      })
    );
    expect(listResponse.status).toBe(200);
    const listJson = await parseJson<{
      ok: boolean;
      data: { total: number; records: Array<{ id: string }> };
    }>(listResponse);
    expect(listJson.ok).toBe(true);
    expect(listJson.data.total).toBe(2);

    const firstRecordId = listJson.data.records.at(0)?.id;
    expect(firstRecordId).toBeTruthy();

    const deleteById = await v2RecordsDeleteById(
      new Request(`http://localhost/api/v2/records/${firstRecordId}`, {
        method: "DELETE",
        headers: {
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC"
        }
      }),
      {
        params: { id: firstRecordId ?? "" }
      }
    );
    expect(deleteById.status).toBe(200);

    const deleteByQuestion = await v2RecordsDelete(
      new Request("http://localhost/api/v2/records?questionKey=question-1", {
        method: "DELETE",
        headers: {
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC"
        }
      })
    );
    expect(deleteByQuestion.status).toBe(200);
    const deleteByQuestionJson = await parseJson<{
      ok: boolean;
      data: { deleted: number };
    }>(deleteByQuestion);
    expect(deleteByQuestionJson.ok).toBe(true);
    expect(deleteByQuestionJson.data.deleted).toBe(1);
  });
});

describe("v2 rubrics routes", () => {
  it("supports upsert/get/delete", async () => {
    const upsertResponse = await v2RubricsPost(
      new Request("http://localhost/api/v2/rubrics", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-id": "rubric-device"
        },
        body: JSON.stringify({
          questionKey: "q-1",
          rubric: {
            version: "2.0",
            metadata: {
              questionId: "q-1",
              title: "材料题一"
            },
            answerPoints: [
              { content: "史实准确", score: 6 },
              { content: "论证完整", score: 4 }
            ],
            updatedAt: "2026-01-01T00:00:00.000Z"
          },
          lifecycleStatus: "draft"
        })
      })
    );
    expect(upsertResponse.status).toBe(200);

    const getResponse = await v2RubricsGet(
      new Request("http://localhost/api/v2/rubrics?questionKey=q-1", {
        headers: {
          "x-device-id": "rubric-device"
        }
      })
    );
    expect(getResponse.status).toBe(200);
    const getJson = await parseJson<{
      ok: boolean;
      data: { rubric: { metadata: { questionId: string } }; lifecycleStatus: string } | null;
    }>(getResponse);
    expect(getJson.ok).toBe(true);
    expect(getJson.data?.rubric.metadata.questionId).toBe("q-1");
    expect(getJson.data?.lifecycleStatus).toBe("draft");

    const deleteResponse = await v2RubricsDelete(
      new Request("http://localhost/api/v2/rubrics?questionKey=q-1", {
        method: "DELETE",
        headers: {
          "x-device-id": "rubric-device"
        }
      })
    );
    expect(deleteResponse.status).toBe(200);

    const getAfterDelete = await v2RubricsGet(
      new Request("http://localhost/api/v2/rubrics?questionKey=q-1", {
        headers: {
          "x-device-id": "rubric-device"
        }
      })
    );
    const getAfterDeleteJson = await parseJson<{
      ok: boolean;
      data: null;
    }>(getAfterDelete);
    expect(getAfterDeleteJson.ok).toBe(true);
    expect(getAfterDeleteJson.data).toBeNull();
  });
});

describe("v2 grading and rubric generate routes", () => {
  it("supports generate/evaluate with shared quota", async () => {
    const generated = await v2RubricsGeneratePost(
      new Request("http://localhost/api/v2/rubrics/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          questionId: "Q2",
          answerText: "第一点：史实准确\n第二点：逻辑完整",
          subject: "history",
          totalScore: 10
        })
      })
    );
    expect(generated.status).toBe(200);
    const generatedJson = await parseJson<{
      ok: boolean;
      data: {
        rubric: unknown;
        providerTrace: { mode: string };
      };
    }>(generated);
    expect(generatedJson.ok).toBe(true);
    expect(["ai", "fallback"]).toContain(generatedJson.data.providerTrace.mode);

    const evaluate = await v2GradingEvaluatePost(
      new Request("http://localhost/api/v2/gradings/evaluate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC",
          "x-device-id": "grade-device"
        },
        body: JSON.stringify({
          imageBase64: "base64-placeholder",
          rubric: generatedJson.data.rubric,
          studentName: "Alice",
          questionNo: "Q2"
        })
      })
    );
    expect(evaluate.status).toBe(200);
    const evaluateJson = await parseJson<{
      ok: boolean;
      data: {
        remaining: number;
        totalUsed: number;
        providerTrace: { mode: string };
      };
    }>(evaluate);
    expect(evaluateJson.ok).toBe(true);
    expect(evaluateJson.data.remaining).toBe(999);
    expect(evaluateJson.data.totalUsed).toBe(1);
    expect(["ai", "fallback"]).toContain(evaluateJson.data.providerTrace.mode);

    const quotaResponse = await v2GradingEvaluateGet(
      new Request("http://localhost/api/v2/gradings/evaluate", {
        headers: {
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC",
          "x-device-id": "grade-device"
        }
      })
    );
    expect(quotaResponse.status).toBe(200);
    const quotaJson = await parseJson<{
      ok: boolean;
      data: { remaining: number; totalUsed: number };
    }>(quotaResponse);
    expect(quotaJson.ok).toBe(true);
    expect(quotaJson.data.remaining).toBe(999);
    expect(quotaJson.data.totalUsed).toBe(1);
  });
});

describe("v2 rubric standardize route", () => {
  it("returns standardize response shape", async () => {
    const response = await v2RubricsStandardizePost(
      new Request("http://localhost/api/v2/rubrics/standardize", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          rubric: "1. 史实准确（6分）\n2. 逻辑完整（4分）",
          maxScore: 10
        })
      })
    );
    expect(response.status).toBe(200);

    const json = await parseJson<{
      ok: boolean;
      data: { rubric: string; providerTrace: { mode: string } };
    }>(response);
    expect(json.ok).toBe(true);
    expect(json.data.rubric).toContain("## 总分: 10分");
    expect(json.data.rubric).toContain("| 分值 | 给分标准 | 常见错误及扣分 |");
    expect(["ai", "fallback"]).toContain(json.data.providerTrace.mode);
  });
});
