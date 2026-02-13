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
let v2GradingEvaluatePost: RouteHandler;
let v2GradingEvaluateGet: RouteHandler;
let legacyActivatePost: RouteHandler;
let legacyActivateGet: RouteHandler;
let legacySyncConfigGet: RouteHandler;
let legacySyncConfigPut: RouteHandler;
let legacySyncRecordsGet: RouteHandler;
let legacySyncRecordsPost: RouteHandler;
let legacySyncRecordsDelete: RouteHandler;
let legacyExamsGet: RouteHandler;
let legacyExamsPost: RouteHandler;
let legacyRubricGet: RouteHandler;
let legacyRubricPost: RouteHandler;
let legacyRubricDelete: RouteHandler;
let legacyAiRubricPost: RouteHandler;
let legacyAiGradePost: RouteHandler;
let legacyAiGradeGet: RouteHandler;

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
  const v2GradingEvaluateRoute = await import("@/app/api/v2/gradings/evaluate/route");
  const legacyRoute = await import("@/app/api/activation/verify/route");
  const legacyConfigRoute = await import("@/app/api/sync/config/route");
  const legacyRecordsRoute = await import("@/app/api/sync/records/route");
  const legacyExamsRoute = await import("@/app/api/exams/route");
  const legacyRubricRoute = await import("@/app/api/rubric/route");
  const legacyAiRubricRoute = await import("@/app/api/ai/rubric/route");
  const legacyAiGradeRoute = await import("@/app/api/ai/grade/route");

  v2ActivatePost = v2ActivateRoute.POST;
  v2StatusGet = v2StatusRoute.GET;
  v2SettingsGet = v2SettingsRoute.GET;
  v2SettingsPut = v2SettingsRoute.PUT;
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
  v2GradingEvaluatePost = v2GradingEvaluateRoute.POST;
  v2GradingEvaluateGet = v2GradingEvaluateRoute.GET;
  legacyActivatePost = legacyRoute.POST;
  legacyActivateGet = legacyRoute.GET;
  legacySyncConfigGet = legacyConfigRoute.GET;
  legacySyncConfigPut = legacyConfigRoute.PUT;
  legacySyncRecordsGet = legacyRecordsRoute.GET;
  legacySyncRecordsPost = legacyRecordsRoute.POST;
  legacySyncRecordsDelete = legacyRecordsRoute.DELETE;
  legacyExamsGet = legacyExamsRoute.GET;
  legacyExamsPost = legacyExamsRoute.POST;
  legacyRubricGet = legacyRubricRoute.GET;
  legacyRubricPost = legacyRubricRoute.POST;
  legacyRubricDelete = legacyRubricRoute.DELETE;
  legacyAiRubricPost = legacyAiRubricRoute.POST;
  legacyAiGradePost = legacyAiGradeRoute.POST;
  legacyAiGradeGet = legacyAiGradeRoute.GET;
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

describe("legacy activation compatibility route", () => {
  it("keeps legacy success shape for POST and GET", async () => {
    const legacyPostResponse = await legacyActivatePost(
      new Request("http://localhost/api/activation/verify", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          code: "BASIC-AAAA-BBBB-CCCC",
          deviceId: "legacy-device"
        })
      })
    );

    expect(legacyPostResponse.status).toBe(200);
    const legacyPostJson = await parseJson<{
      success: boolean;
      data: { remainingQuota: number; totalQuota: number };
    }>(legacyPostResponse);

    expect(legacyPostJson.success).toBe(true);
    expect(legacyPostJson.data.remainingQuota).toBe(1000);
    expect(legacyPostJson.data.totalQuota).toBe(1000);

    const legacyGetResponse = await legacyActivateGet(
      new Request("http://localhost/api/activation/verify?deviceId=legacy-device")
    );

    expect(legacyGetResponse.status).toBe(200);
    const legacyGetJson = await parseJson<{
      success: boolean;
      data: { code: string; isPaid: boolean; quota: number };
    }>(legacyGetResponse);

    expect(legacyGetJson.success).toBe(true);
    expect(legacyGetJson.data.code).toBe("BASIC-AAAA-BBBB-CCCC");
    expect(legacyGetJson.data.isPaid).toBe(true);
    expect(legacyGetJson.data.quota).toBe(1000);
  });
});

describe("settings compatibility and v2 routes", () => {
  it("supports v2 settings upsert/get and legacy sync config shape", async () => {
    const v2Put = await v2SettingsPut(
      new Request("http://localhost/api/v2/settings", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-device-id": "device-settings"
        },
        body: JSON.stringify({
          key: "model.provider",
          value: "openrouter"
        })
      })
    );

    expect(v2Put.status).toBe(200);
    const v2PutJson = await parseJson<{
      ok: boolean;
      data: { key: string; value: string };
    }>(v2Put);
    expect(v2PutJson.ok).toBe(true);
    expect(v2PutJson.data.key).toBe("model.provider");
    expect(v2PutJson.data.value).toBe("openrouter");

    const v2Get = await v2SettingsGet(
      new Request("http://localhost/api/v2/settings?key=model.provider", {
        headers: {
          "x-device-id": "device-settings"
        }
      })
    );
    expect(v2Get.status).toBe(200);

    const legacyPut = await legacySyncConfigPut(
      new Request("http://localhost/api/sync/config", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-device-id": "device-settings"
        },
        body: JSON.stringify({
          key: "grading.mode",
          value: "strict"
        })
      })
    );

    expect(legacyPut.status).toBe(200);
    const legacyPutJson = await parseJson<{
      success: boolean;
      data: { key: string; value: string };
    }>(legacyPut);
    expect(legacyPutJson.success).toBe(true);
    expect(legacyPutJson.data.key).toBe("grading.mode");
    expect(legacyPutJson.data.value).toBe("strict");

    const legacyGet = await legacySyncConfigGet(
      new Request("http://localhost/api/sync/config?key=grading.mode", {
        headers: {
          "x-device-id": "device-settings"
        }
      })
    );
    expect(legacyGet.status).toBe(200);
    const legacyGetJson = await parseJson<{
      success: boolean;
      data: { key: string; value: string };
    }>(legacyGet);
    expect(legacyGetJson.success).toBe(true);
    expect(legacyGetJson.data.key).toBe("grading.mode");
    expect(legacyGetJson.data.value).toBe("strict");
  });
});

describe("exams compatibility and v2 routes", () => {
  it("supports create/list for v2 and legacy shapes", async () => {
    const legacyPost = await legacyExamsPost(
      new Request("http://localhost/api/exams", {
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

    expect(legacyPost.status).toBe(200);
    const legacyPostJson = await parseJson<{
      success: boolean;
      exam: { name: string; subject: string | null };
    }>(legacyPost);
    expect(legacyPostJson.success).toBe(true);
    expect(legacyPostJson.exam.name).toBe("高三二模");
    expect(legacyPostJson.exam.subject).toBe("history");

    const v2Post = await v2ExamsPost(
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

    expect(v2Post.status).toBe(201);
    const v2PostJson = await parseJson<{
      ok: boolean;
      data: { name: string; grade: string | null };
    }>(v2Post);
    expect(v2PostJson.ok).toBe(true);
    expect(v2PostJson.data.name).toBe("高三三模");
    expect(v2PostJson.data.grade).toBe("高三");

    const legacyGet = await legacyExamsGet(
      new Request("http://localhost/api/exams", {
        headers: {
          "x-device-id": "exam-device"
        }
      })
    );

    expect(legacyGet.status).toBe(200);
    const legacyGetJson = await parseJson<{
      success: boolean;
      exams: Array<{ name: string }>;
    }>(legacyGet);
    expect(legacyGetJson.success).toBe(true);
    expect(legacyGetJson.exams).toHaveLength(2);
    expect(legacyGetJson.exams.at(0)?.name).toBe("高三三模");

    const v2Get = await v2ExamsGet(
      new Request("http://localhost/api/v2/exams", {
        headers: {
          "x-device-id": "exam-device"
        }
      })
    );

    expect(v2Get.status).toBe(200);
    const v2GetJson = await parseJson<{
      ok: boolean;
      data: Array<{ name: string }>;
    }>(v2Get);
    expect(v2GetJson.ok).toBe(true);
    expect(v2GetJson.data).toHaveLength(2);
    expect(v2GetJson.data.at(1)?.name).toBe("高三二模");
  });

  it("returns validation error when exam name is missing", async () => {
    const legacyPost = await legacyExamsPost(
      new Request("http://localhost/api/exams", {
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
    expect(legacyPost.status).toBe(400);

    const v2Post = await v2ExamsPost(
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
    expect(v2Post.status).toBe(400);
  });
});

describe("records compatibility and v2 routes", () => {
  it("supports batch create/list/delete and legacy sync records shape", async () => {
    const v2BatchPost = await v2RecordsBatchPost(
      new Request("http://localhost/api/v2/records/batch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC",
          "x-device-id": "records-device-a"
        },
        body: JSON.stringify({
          records: [
            {
              questionNo: "Q1",
              questionKey: "question-1",
              studentName: "Alice",
              score: 8,
              maxScore: 10,
              breakdown: [{ point: "史实", score: 4 }]
            }
          ]
        })
      })
    );

    expect(v2BatchPost.status).toBe(201);
    const v2BatchPostJson = await parseJson<{
      ok: boolean;
      data: { created: number };
    }>(v2BatchPost);
    expect(v2BatchPostJson.ok).toBe(true);
    expect(v2BatchPostJson.data.created).toBe(1);

    // 兼容保留：仍支持 POST /api/v2/records
    const v2CompatPost = await v2RecordsPost(
      new Request("http://localhost/api/v2/records", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC",
          "x-device-id": "records-device-a"
        },
        body: JSON.stringify({
          records: [
            {
              questionNo: "Q1",
              questionKey: "question-1",
              studentName: "Carol",
              score: 7,
              maxScore: 10
            }
          ]
        })
      })
    );
    expect(v2CompatPost.status).toBe(201);

    const legacyPost = await legacySyncRecordsPost(
      new Request("http://localhost/api/sync/records", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC",
          "x-device-id": "records-device-a"
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

    expect(legacyPost.status).toBe(201);
    const legacyPostJson = await parseJson<{
      success: boolean;
      data: { created: number };
    }>(legacyPost);
    expect(legacyPostJson.success).toBe(true);
    expect(legacyPostJson.data.created).toBe(1);

    const legacyGet = await legacySyncRecordsGet(
      new Request("http://localhost/api/sync/records?page=1&limit=10", {
        headers: {
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC"
        }
      })
    );

    expect(legacyGet.status).toBe(200);
    const legacyGetJson = await parseJson<{
      success: boolean;
      data: { total: number; records: Array<{ studentName: string }> };
    }>(legacyGet);
    expect(legacyGetJson.success).toBe(true);
    expect(legacyGetJson.data.total).toBe(3);

    const v2Get = await v2RecordsGet(
      new Request("http://localhost/api/v2/records?page=1&limit=10", {
        headers: {
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC"
        }
      })
    );
    expect(v2Get.status).toBe(200);
    const v2GetJson = await parseJson<{
      ok: boolean;
      data: { total: number; records: Array<{ id: string }> };
    }>(v2Get);
    expect(v2GetJson.ok).toBe(true);
    expect(v2GetJson.data.total).toBe(3);

    const firstRecordId = v2GetJson.data.records.at(0)?.id;
    expect(firstRecordId).toBeTruthy();

    const v2DeleteById = await v2RecordsDeleteById(
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
    expect(v2DeleteById.status).toBe(200);
    const v2DeleteByIdJson = await parseJson<{
      ok: boolean;
      data: { deleted: number };
    }>(v2DeleteById);
    expect(v2DeleteByIdJson.ok).toBe(true);
    expect(v2DeleteByIdJson.data.deleted).toBe(1);

    const v2Delete = await v2RecordsDelete(
      new Request("http://localhost/api/v2/records?questionKey=question-1", {
        method: "DELETE",
        headers: {
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC"
        }
      })
    );
    expect(v2Delete.status).toBe(200);

    const v2GetAfterDelete = await v2RecordsGet(
      new Request("http://localhost/api/v2/records?page=1&limit=10", {
        headers: {
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC"
        }
      })
    );
    expect(v2GetAfterDelete.status).toBe(200);
    const v2GetAfterDeleteJson = await parseJson<{
      ok: boolean;
      data: { total: number };
    }>(v2GetAfterDelete);
    expect(v2GetAfterDeleteJson.ok).toBe(true);
    expect(v2GetAfterDeleteJson.data.total).toBe(0);

    const legacyDelete = await legacySyncRecordsDelete(
      new Request("http://localhost/api/sync/records?questionKey=question-1", {
        method: "DELETE",
        headers: {
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC"
        }
      })
    );
    expect(legacyDelete.status).toBe(200);
    const legacyDeleteJson = await parseJson<{
      success: boolean;
      data: { deleted: number };
    }>(legacyDelete);
    expect(legacyDeleteJson.success).toBe(true);
    expect(legacyDeleteJson.data.deleted).toBe(0);
  });
});

describe("rubrics compatibility and v2 routes", () => {
  it("supports v2 upsert and legacy conflict/delete behavior", async () => {
    const v2Post = await v2RubricsPost(
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

    expect(v2Post.status).toBe(200);
    const v2PostJson = await parseJson<{
      ok: boolean;
      data: { questionKey: string; lifecycleStatus: string };
    }>(v2Post);
    expect(v2PostJson.ok).toBe(true);
    expect(v2PostJson.data.questionKey).toBe("q-1");
    expect(v2PostJson.data.lifecycleStatus).toBe("draft");

    const legacyGet = await legacyRubricGet(
      new Request("http://localhost/api/rubric?questionKey=q-1", {
        headers: {
          "x-device-id": "rubric-device"
        }
      })
    );

    expect(legacyGet.status).toBe(200);
    const legacyGetJson = await parseJson<{
      success: boolean;
      rubric: { metadata: { questionId: string } };
      lifecycleStatus: string;
    }>(legacyGet);
    expect(legacyGetJson.success).toBe(true);
    expect(legacyGetJson.rubric.metadata.questionId).toBe("q-1");
    expect(legacyGetJson.lifecycleStatus).toBe("draft");

    const conflictPost = await legacyRubricPost(
      new Request("http://localhost/api/rubric", {
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
              title: "旧版稿"
            },
            answerPoints: [{ content: "要点", score: 10 }],
            updatedAt: "2020-01-01T00:00:00.000Z"
          }
        })
      })
    );

    expect(conflictPost.status).toBe(409);
    const conflictJson = await parseJson<{
      success: boolean;
      code: string;
    }>(conflictPost);
    expect(conflictJson.success).toBe(false);
    expect(conflictJson.code).toBe("CONFLICT");

    const legacyDelete = await legacyRubricDelete(
      new Request("http://localhost/api/rubric?questionKey=q-1", {
        method: "DELETE",
        headers: {
          "x-device-id": "rubric-device"
        }
      })
    );
    expect(legacyDelete.status).toBe(200);

    const v2Get = await v2RubricsGet(
      new Request("http://localhost/api/v2/rubrics?questionKey=q-1", {
        headers: {
          "x-device-id": "rubric-device"
        }
      })
    );
    expect(v2Get.status).toBe(200);
    const v2GetJson = await parseJson<{
      ok: boolean;
      data: unknown;
    }>(v2Get);
    expect(v2GetJson.ok).toBe(true);
    expect(v2GetJson.data).toBeNull();
  });
});

describe("grading and ai-rubric compatibility routes", () => {
  it("supports legacy ai/rubric and ai/grade with shared quota", async () => {
    const v2Generated = await v2RubricsGeneratePost(
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

    expect(v2Generated.status).toBe(200);
    const v2GeneratedJson = await parseJson<{
      ok: boolean;
      data: { rubric: unknown };
    }>(v2Generated);
    expect(v2GeneratedJson.ok).toBe(true);

    const legacyGenerated = await legacyAiRubricPost(
      new Request("http://localhost/api/ai/rubric", {
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

    expect(legacyGenerated.status).toBe(200);
    const legacyGeneratedJson = await parseJson<{
      success: boolean;
      data: { rubric: unknown };
    }>(legacyGenerated);
    expect(legacyGeneratedJson.success).toBe(true);

    const v2Evaluate = await v2GradingEvaluatePost(
      new Request("http://localhost/api/v2/gradings/evaluate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC",
          "x-device-id": "grade-device"
        },
        body: JSON.stringify({
          imageBase64: "base64-placeholder",
          rubric: v2GeneratedJson.data.rubric,
          studentName: "Alice",
          questionNo: "Q2"
        })
      })
    );

    expect(v2Evaluate.status).toBe(200);
    const v2EvaluateJson = await parseJson<{
      ok: boolean;
      data: { remaining: number; totalUsed: number };
    }>(v2Evaluate);
    expect(v2EvaluateJson.ok).toBe(true);
    expect(v2EvaluateJson.data.remaining).toBe(999);
    expect(v2EvaluateJson.data.totalUsed).toBe(1);

    const legacyEvaluate = await legacyAiGradePost(
      new Request("http://localhost/api/ai/grade", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC",
          "x-device-id": "grade-device"
        },
        body: JSON.stringify({
          imageBase64: "base64-placeholder",
          rubric: legacyGeneratedJson.data.rubric,
          studentName: "Bob",
          questionNo: "Q2"
        })
      })
    );

    expect(legacyEvaluate.status).toBe(200);
    const legacyEvaluateJson = await parseJson<{
      success: boolean;
      data: { remaining: number };
    }>(legacyEvaluate);
    expect(legacyEvaluateJson.success).toBe(true);
    expect(legacyEvaluateJson.data.remaining).toBe(998);

    const legacyQuota = await legacyAiGradeGet(
      new Request("http://localhost/api/ai/grade", {
        headers: {
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC",
          "x-device-id": "grade-device"
        }
      })
    );

    expect(legacyQuota.status).toBe(200);
    const legacyQuotaJson = await parseJson<{
      success: boolean;
      data: { quota: number; totalUsed: number };
    }>(legacyQuota);
    expect(legacyQuotaJson.success).toBe(true);
    expect(legacyQuotaJson.data.quota).toBe(998);
    expect(legacyQuotaJson.data.totalUsed).toBe(2);

    const v2Quota = await v2GradingEvaluateGet(
      new Request("http://localhost/api/v2/gradings/evaluate", {
        headers: {
          "x-activation-code": "BASIC-AAAA-BBBB-CCCC",
          "x-device-id": "grade-device"
        }
      })
    );

    expect(v2Quota.status).toBe(200);
    const v2QuotaJson = await parseJson<{
      ok: boolean;
      data: { remaining: number; totalUsed: number };
    }>(v2Quota);
    expect(v2QuotaJson.ok).toBe(true);
    expect(v2QuotaJson.data.remaining).toBe(998);
    expect(v2QuotaJson.data.totalUsed).toBe(2);
  });
});
